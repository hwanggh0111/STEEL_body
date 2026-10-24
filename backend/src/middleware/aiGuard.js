/**
 * AI Guard v2 — 제로 톨러런스 보안 시스템
 * 4단계 위협 레벨 + 자동 감지/정지 + AI 사유 생성
 *
 * **자동으로 지우지 않는다.** 예전 머리말에 「삭제」가 적혀 있었지만, 8/21 에
 * 자동 판정에서 계정 삭제를 떼어냈다 — 오판이면 되돌릴 것이 남아 있어야 한다.
 * 지우는 것은 관리자가 화면에서 보고 직접 한다 (executeLevel4 주석 참고).
 */
// 쓸 때 든다 — 까닭은 `utils/tokens.js` 에 적어뒀다 (2026-10-09)
let _jwt;
const jwt = () => (_jwt || (_jwt = require('jsonwebtoken')));
const db = require('../db');

// ── 상태 저장소 (인메모리, 크기 제한) ──
const MAX_MAP_SIZE = 10000;
function limitedSet(map, key, value) {
  if (map.size >= MAX_MAP_SIZE) {
    const firstKey = map.keys().next().value;
    map.delete(firstKey);
  }
  map.set(key, value);
}

const requestCounts = new Map();    // IP → { count, firstRequest }
const blockedIPs = new Map();       // IP → { until, level, reason }

// 막을 때는 램과 **파일에 같이** 적는다.
//
// 8/31 까지 차단은 이 Map 하나였다. 서버가 다시 뜨면 통째로 비었다 —
// 「영구 차단」으로 적어둔 것도 같이 사라졌다. Render 무료 플랜은 15분만 놀아도
// 프로세스를 내린다. 공격자가 할 일은 **기다리는 것**뿐이었다.
//
// 램을 그대로 두는 이유는 요청마다 파일을 읽지 않기 위해서다. 파일은 서버가 뜰 때
// 한 번 읽어 램을 채우고(`hydrateBlocks`), 막을 때마다 같이 적는다
/** 우리 자신. 맨 앞에서 화이트리스트로 흘려보내는 주소들과 같은 목록이다 */
const SELF_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

// ── 사설 주소는 사람이 아니다 (2026-10-15) ──
//
// 10/14 에 차단 목록에 `10.31.78.209` · `10.31.50.190` 이 남아 있었다. Render 내부
// 프록시 주소다(`TRUST_PROXY` 가 홉 수로 세고 있었다 — index.js 주석 참고).
// **그걸 막으면 그 홉을 지나는 사람이 전부 막힌다.** 실제로 그랬다.
//
// 설정은 고쳤지만, 여기서도 막는다 — 사설 IP 가 차단 목록에 들어오는 것은
// **그 자체가 「IP 를 잘못 읽고 있다」는 신호**다. 막을 것이 아니라 알아야 할 일이다.
// 조용히 흘리면 또 못 보고 지나가므로 기록을 남긴다.
const PRIVATE_V4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
/** 사람의 공인 IP 가 아닌가 (사설 · 루프백 · 링크로컬 · IPv6 사설 fc00::/7) */
function isPrivateIp(ip) {
  if (!ip || ip === 'unknown') return true;
  const s = String(ip).toLowerCase().replace(/^::ffff:/, ''); // IPv4-mapped 로 속이는 길을 막는다
  if (s === '::1' || s === '::') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(s) || /^fe80:/.test(s)) return true;
  return PRIVATE_V4.test(s);
}

function block(ip, until, level, reason) {
  if (!ip || ip === 'unknown') return;
  // ── 우리 자신은 안 막는다 (2026-09-29) ──
  //
  // 프록시를 안 믿는 자리(개발 · 터널 · `TRUST_PROXY` 없이 띄운 서버)에서는 모든
  // 요청이 `127.0.0.1` 로 들어온다. 그 자리에서 로그인을 몇 번 틀리면
  // `recordLoginFailure` 가 **localhost 를 72시간 막은 기록을 파일에 적었다.**
  //
  // 막히지는 않는다 — 그 주소는 맨 앞에서 화이트리스트로 흘러가기 때문이다.
  // 그래서 **아무 일도 안 하면서 기록만 남는다**: 보안 화면의 차단 목록에 우리
  // 자신이 앉아 있고, 관리자는 그것을 풀어야 하나 들여다보게 된다.
  // 적을 이유가 없는 것은 안 적는다.
  if (SELF_IPS.includes(ip)) return;
  // 사설 주소를 막으라는 요청은 **읽기가 틀렸다는 뜻**이다 (2026-10-15, 위 주석 참고).
  // 막으면 그 홉을 지나는 사람이 전부 걸리므로 막지 않고, 대신 소리를 낸다.
  if (isPrivateIp(ip)) {
    // 종류는 **이미 있는 `WARNING`** 을 쓴다. 새 글자를 만들면 관리자 화면이
    // 이름표를 모르고 영문 키를 그대로 뿌린다 (`npm run logtypes` 가 그걸 잡는다)
    addLog('WARNING', `사설 IP 를 막으라는 요청이 왔다 — TRUST_PROXY 설정이 틀렸을 수 있다: ${ip} (${reason})`, ip);
    return;
  }
  // **약한 것으로 덮어쓰지 않는다.** 파일 쪽(`db.blockIp`)은 이미 그렇게 하는데
  // 램만 덮어쓰고 있었다. 그러면 둘이 어긋난다 — 영구 차단된 주소를 관리자가
  // 「60분 차단」으로 다시 걸면 램은 60분이 되고 파일은 그대로 forever 다.
  // 60분 뒤 그 주소가 다시 오면 아래 만료 자리가 **파일의 영구 차단까지 지운다.**
  // 이 changeset 이 막으려던 바로 그 일이 여기서 났다
  const had = blockedIPs.get(ip);
  if (had && (had.until === Infinity || (until !== Infinity && until <= had.until))) {
    // 이미 더 세게(또는 더 길게) 막혀 있다 — 램은 그대로 두고 파일만 맞춰본다
    try { db.blockIp(ip, until, level, reason); db.flushNow(); } catch { /* 파일이 안 써져도 막기는 막는다 */ }
    return;
  }
  limitedSet(blockedIPs, ip, { until, level, reason });
  // **곧바로 파일에 쓴다.** 보통 쓰기는 0.5초 뒤로 미뤄지는데, 막는 순간은 공격받는
  // 중이라 그 사이에 서버가 죽을 수 있다 — 죽으면서 차단만 사라지면 막은 적이 없는 것이다
  try { db.blockIp(ip, until, level, reason); db.flushNow(); } catch { /* 파일이 안 써져도 막기는 막는다 */ }
}

/** 서버가 뜰 때 파일에 남아 있던 차단을 램으로 올린다 */
function hydrateBlocks() {
  let n = 0;
  try {
    for (const row of db.listBlocks()) {
      // 10/14 에 남은 `10.31.x.x` 같은 것 — 사람이 아니라 프록시 주소다.
      // 올려두면 그 홉을 지나는 사람이 전부 막힌다. 올리지 않고 파일에서도 지운다
      // (손으로 비우러 Neon 을 열지 않아도 되게).
      if (isPrivateIp(row.ip)) {
        try { db.unblockIp(row.ip); } catch { /* 못 지워도 램에 안 올리는 것이 중요하다 */ }
        continue;
      }
      const until = row.until === 'forever' ? Infinity : new Date(row.until).getTime();
      limitedSet(blockedIPs, row.ip, { until, level: row.level, reason: row.reason });
      n++;
    }
  } catch { /* 파일이 없으면 빈 채로 시작한다 */ }
  return n;
}
const loginFailures = new Map();    // IP → { count, lastFailure }
const notFoundCounts = new Map();   // IP → { count, firstHit }
const tokenForgeries = new Map();   // IP → { count, first }
const spamCounts = new Map();       // userId → { count, firstCreate }

// 1분에 이만큼 넘게 POST 하면 되돌려 보낸다.
//
// 예전에는 10건이었다. 그런데 운동은 기록 하나가 POST 하나다 — 운동을 끝내고 앉아서
// 몰아 적으면 5개 종목 × 3세트만 해도 15건이다. **정상적으로 쓰는 사람이 걸렸다.**
// 그리고 걸리면 7일 정지였고, 두 번 걸리면 계정이 지워졌다.
const SPAM_PER_MINUTE = 60;

// ── 자동 판정의 문턱값 ──
//
// **관리자 화면이 이 숫자를 그대로 보여준다.** 예전에는 화면이 손으로 적어두고 있었고,
// 그래서 **틀린 값을 보고 있었다** — 대량 요청은 「15/30/50회」라고 적혀 있었지만 실제는
// 200/300/500 이었고, 로그인 실패는 「3/5/10회」라고 적혀 있었지만 실제는 7/10/20 이었다.
// 스팸은 「10건/분」이라 적혀 있었지만 60 이고, 없어진 SQL·몽고 인젝션도 아직 적혀 있었다.
//
// 숫자를 두 곳에 적어두면 반드시 어긋난다. 여기 한 곳에 두고 화면은 받아서 그린다.
// 잘못된 방어 규칙을 보고 판단하는 것이, 규칙을 모르는 것보다 나쁘다.
// ── 주소로 세면 **한 사람이 걸릴 때 그 뒤의 모두가 걸린다** ── (2026-10-22)
//
// 이 앱은 **헬스장에서 쓰는 앱**이다. 회원 여럿이 같은 와이파이에 붙어 있고,
// 통신사 데이터도 NAT 로 묶여 **수백 명이 한 주소로 보인다.** 10/15 에 `req.ip` 를
// 진짜 접속자로 고친 뒤로는 더 그렇다 — 이제 그 값이 **공유 주소**다.
//
// 한 사람이 운동을 몰아 적으면 분당 수십 건이다(세트 하나가 요청 하나다).
// 거기에 화면을 열 때마다 열 몇 건이 더 나간다. **대여섯 사람이면 200을 넘긴다** —
// 그러면 아래 사다리가 **그 와이파이를 1시간 잠근다.** 운동하러 온 사람들이
// 한꺼번에 「접근이 차단되었습니다」를 본다. 공격이 아니라 **영업 시간**이다.
//
// 그래서 센 다음에 **무엇을 잠그는가**를 갈랐다 —
//
//   로그인한 요청   **계정별로** 센다. 넘으면 그 계정에만 429(「잠시 뒤에」)를 준다.
//                   주소는 잠그지 않는다 — 옆 사람은 아무 일도 없다.
//                   1분 창이 지나면 저절로 풀린다(관리자가 풀어줄 일이 없다)
//   로그인 안 한 요청   여태처럼 **주소별로** 세고 사다리대로 잠근다. 훑고 다니는
//                   것 · 봇 · 토큰 위조가 이쪽이고, 사람 몫은 분당 몇 건이라
//                   NAT 뒤에서도 200 을 넘기지 않는다
//
// 느슨해진 것이 아니다. 요청은 **어느 쪽이든 막힌다**(계정은 429, 주소는 403) —
// 되돌리기 어려운 쪽(주소 잠금)만 공격에 가까운 쪽에 남겼다. 10/21 에 입력 스캔에서
// 한 판단과 같은 결이다: 막는 것은 늘 하고, **벌은 되풀이하는 쪽에만.**
//
// 계정 몫은 사다리의 첫 칸과 같은 숫자로 둔다 — 두 곳에 따로 적으면 어긋난다.
const ACCOUNT_RATE_PER_MIN = 200;

const RATE_STEPS = [
  { count: 500, hours: 168 },
  { count: 300, hours: 24 },
  { count: 200, hours: 1 },
];
const LOGIN_FAIL_STEPS = [
  { count: 20, hours: 168 },
  { count: 10, hours: 24 },
  { count: 7, hours: 1 },
];
const NOT_FOUND_STEP = { count: 30, hours: 72 };
// 위조 토큰 — 서명이 틀린(만료가 아니라) 토큰이 한 주소에서 이만큼 쌓이면 막는다.
// 만료는 정상이라 안 센다(auth 가 갈라준다). 서명 위조는 정상 사용에서 안 난다 —
// 열쇠가 바뀐 직후 잠깐 몰릴 수 있어 문턱은 넉넉히 두고 잠금은 1시간(되돌기 쉽게).
const TOKEN_FORGE_STEP = { count: 30, hours: 1 };
// 봇 잠금 시간은 **걷었다** (2026-10-22). UA 로 주소를 잠그지 않기로 했고,
// 쓰이지 않는 숫자를 남겨두면 「세 시간 잠근다」고 믿게 된다 (이 앱에서 두 번 겪었다)
const INPUT_SUSPEND_DAYS = 3;
const SUSPEND_TO_BAN = 2;
// ── 「경고가 쌓이면 잠근다」는 **걷었다** ── (2026-10-22)
//
// `WARN_TO_LOCK = { count: 10, hours: 168 }` 과 그것을 쌓는 `executeLevel1` 이
// 있었다. **그런데 `executeLevel1` 을 부르는 자리가 앱에 한 곳도 없었다.**
// 그래서 경고는 한 번도 쌓이지 않았고 `threats.level1` 은 늘 0 이었다.
//
// 그런데 **관리자 화면은 그 규칙을 말하고 있었다** — 「경고가 10번 쌓이면 그 주소를
// 이레 잠근다」. 그리고 「경고」 칸에 늘 0 을 그렸다. 10/21 에 보안 보고서에서
// 고친 것과 같은 꼴이다: **없는 방어를 적어두면 있다고 믿고 판단하게 된다.**
//
// 되살리지 않는다. 벌이 **주소를 이레 잠그는 것**인데, 그것은 오늘 봇 판정에서
// 걷어낸 것과 같은 결이다 — **한 주소 뒤에는 여럿이 있다.** 링크 미리보기 봇이
// 열 번 지나가면 그 와이파이가 이레 막힌다.
//
// 지키는 일은 **행동을 보는 사다리**가 한다 — 속도(분당) · 없는 주소 훑기 ·
// 로그인 실패 · 토큰 위조. 그 넷은 실제로 돌고 숫자도 화면과 같다.
const suspensionCounts = new Map(); // userId → count
const aiLogs = [];                  // max 500

let totalRequests = 0;
let blockedRequests = 0;
let threats = { level2: 0, level3: 0, level4: 0 };

// ── XSS 패턴 ──
const XSS_PATTERNS = [
  /<script/i, /<\/script/i, /onerror\s*=/i, /onload\s*=/i,
  /javascript:/i, /eval\s*\(/i, /document\.cookie/i,
  /window\.location/i, /innerHTML/i, /<iframe/i, /<svg\s+onload/i,
  /document\.write/i, /\.fromCharCode/i, /alert\s*\(/i,
  /\bon(?:click|focus|blur|mouse\w+|key\w+|change|submit|error|load|unload)\s*=/i,
  /expression\s*\(/i,
  /url\s*\(\s*javascript/i,
  /data:\s*text\/html/i,
];

// ── 인젝션 패턴 ──
//
// **이 앱에는 SQL 도 MongoDB 도 없다.** 저장소는 JSON 파일 하나다(`blackiron.json`).
// 그런데 여기 있던 열두 개 중 열은 SQL 과 몽고를 노린 것이었다 —
// `' OR ` · `; DROP ` · `UNION SELECT` · `$ne` · `$gt` · `$regex` · `$where` · `{ $` ·
// 그리고 SQL 주석 `--`.
//
// 없는 데이터베이스를 노리는 공격은 막을 것이 없고, 남는 것은 **오탐뿐이다.**
// 특히 `/--\s*$/m` 은 **줄 끝이 `--` 인 모든 줄**에 걸린다. 제보를 이렇게 적으면
//
//     안 되는 화면: 기록
//     ---
//     재현 절차
//
// 가운데 줄에서 걸린다. 우리가 「재현 절차를 줄로 나눠 적어달라」고 해놓고,
// 구분선을 그은 사람을 **영구 정지**시키는 셈이었다.
//
// 남긴 둘은 이 앱에 실제로 있는 것이다 — 자바스크립트 프로토타입 오염.
const INJECTION_PATTERNS = [
  /__proto__/i, /constructor\s*\[/i,
];

// ── 봇 User-Agent 패턴 ──
const BOT_PATTERNS = [
  /bot/i, /crawler/i, /spider/i, /curl/i, /wget/i,
  /python-requests/i, /scrapy/i, /httpclient/i, /phantom/i,
];

// ── AI 사유 생성 ──
//
// **여기 적히는 말이 사용자에게 그대로 간다.** 그런데 일곱 자리가
// 「즉시 계정이 삭제되었습니다. 복구할 수 없습니다」라고 통보하고 있었다.
//
// 8/21 과 8/24 에 자동 판정에서 계정 삭제를 떼어냈다 — LEVEL 4 는 이제
// **영구 정지 + 로그인 차단**이고 데이터는 그대로 남긴다 (executeLevel4 주석 참고).
// 동작은 바꿨는데 **사람에게 하는 말을 안 바꿨다.** 지우지도 않고서 지웠다고
// 통보하면, 되돌릴 수 있는 사람도 포기하고 떠난다.
// **막아둔 길을 가리키지 않는다** (2026-10-24). 여기 「고객센터 제보함으로
// 알려주세요」라고 적혀 있었는데, 영구 정지된 사람은 **제보를 보낼 수 없다**
// (`POST /reports` 도 403 이다). 그리고 영구 정지에는 「풀린 뒤」가 없다 —
// 남은 길은 앱 밖의 연락처뿐이고, 그 주소는 **화면이 들고 있다**
// (`frontend/src/data/contact.js`. 서버에 또 적으면 바뀌는 날 어긋난다).
const L4_NOTE = '로그인이 영구히 막혔습니다. **적어두신 운동 기록은 지우지 않았습니다** — 잘못 걸렸다고 생각되시면 아래 연락처로 알려주세요. 확인해서 되돌립니다.';
function generateAiReason(level, triggerType, details) {
  const reasons = {
    xss: {
      title: 'XSS(크로스 사이트 스크립팅) 공격 시도',
      detail: `요청 데이터에서 악성 스크립트 패턴이 감지되었습니다. 패턴: ${details || 'N/A'}. 이는 다른 사용자의 브라우저에서 악성 코드를 실행하려는 시도로 판단됩니다.`,
      verdict: `서비스 보안을 위협하는 행위로 판단했습니다. ${L4_NOTE}`,
    },
    injection: {
      title: 'SQL/NoSQL 인젝션 공격 시도',
      detail: `요청에서 데이터베이스 조작을 시도하는 패턴이 감지되었습니다. 패턴: ${details || 'N/A'}. 데이터베이스에 무단 접근하거나 데이터를 탈취하려는 시도로 판단됩니다.`,
      verdict: L4_NOTE,
    },
    token_forge: {
      title: 'JWT 토큰 위조 시도',
      detail: `유효하지 않은 서명의 JWT 토큰이 ${details || '다수'} 감지되었습니다. 다른 사용자의 계정에 무단 접근하려는 시도로 판단됩니다.`,
      verdict: L4_NOTE,
    },
    unauthorized_access: {
      title: '다른 사용자 데이터 무단 접근 시도',
      detail: '본인 소유가 아닌 데이터에 접근하거나 수정/삭제를 시도했습니다. 이는 개인정보 침해에 해당합니다.',
      verdict: L4_NOTE,
    },
    admin_access: {
      title: '관리자 API 무단 접근 시도',
      detail: '관리자 권한이 없는 상태에서 관리자 전용 API에 접근을 시도했습니다.',
      verdict: L4_NOTE,
    },
    bypass: {
      title: '정지 우회 시도',
      detail: '계정 정지 상태에서 다른 계정 또는 방법으로 서비스에 접근을 시도했습니다.',
      verdict: L4_NOTE,
    },
    rate_limit: {
      title: '비정상적인 대량 요청',
      detail: `1분 내 ${details || 'N/A'}회의 요청이 감지되었습니다. 자동화된 도구를 사용한 공격으로 판단됩니다.`,
      verdict: level === 4 ? L4_NOTE : `${details}간 정지되었습니다.`,
    },
    scan_attack: {
      title: 'API 스캔 공격',
      detail: `존재하지 않는 API 엔드포인트에 대한 반복적인 접근이 감지되었습니다 (${details || 'N/A'}회/분). 시스템 취약점을 탐색하려는 시도로 판단됩니다.`,
      verdict: '3일간 정지되었습니다.',
    },
    spam: {
      title: '스팸 데이터 대량 생성',
      detail: `1분 내 ${details || 'N/A'}건의 데이터가 생성되었습니다. 서비스 방해를 목적으로 한 스팸으로 판단됩니다.`,
      verdict: '7일간 정지되었습니다. 적어두신 기록은 그대로 있습니다.',
    },
    bot: {
      title: '봇/크롤러 접근 감지',
      detail: `자동화된 도구(${details || 'N/A'})를 사용한 접근이 감지되었습니다.`,
      verdict: '3일간 정지되었습니다.',
    },
    accumulated: {
      title: '누적 위반에 의한 영구 정지',
      detail: `이전 정지 ${details || 'N/A'}회 누적으로 영구 정지 기준에 도달했습니다.`,
      verdict: L4_NOTE,
    },
    login_lock: {
      title: '로그인 실패 횟수 초과',
      detail: `연속 ${details || 'N/A'}회 로그인에 실패했습니다.`,
      verdict: '계정 보호를 위해 일시적으로 잠겼습니다.',
    },
  };

  const r = reasons[triggerType] || { title: '보안 정책 위반', detail: details || '', verdict: '조치가 취해졌습니다.' };
  return `[AI Guard 판정]\n위협 레벨: LEVEL ${level}\n사유: ${r.title}\n상세: ${r.detail}\n판정: ${r.verdict}\n시각: ${new Date().toISOString()}`;
}

// ── 로그 ──
function addLog(type, message, ip, userId) {
  aiLogs.push({ type, message, ip, userId: userId || null, timestamp: new Date().toISOString() });
  if (aiLogs.length > 500) aiLogs.shift();
}

addLog('system', 'AI Guard v2 (제로 톨러런스) 활성화', null);

// ── LEVEL 4: 영구 정지 ──
//
// 예전에는 여기서 계정과 모든 데이터를 지웠다(deleteUserCompletely). 자동 판정이
// 틀렸을 때 되돌릴 방법이 전혀 없는 동작이다 — 몇 년치 운동 기록이 통째로 사라진다.
// 8/21 에 욕설 경로에서 이 함수를 떼어낸 것과 같은 이유로, 자동 경로에서는 지우지 않는다.
//
// 지우는 것은 관리자가 화면에서 확인하고 직접 한다. 막는 것(영구 정지 + 차단)은
// 자동으로 하되, 없애는 것은 사람이 한다.
function executeLevel4(userId, ip, triggerType, details) {
  threats.level4++;
  const aiReason = generateAiReason(4, triggerType, details);
  addLog('CRITICAL', `LEVEL 4 — ${triggerType}: 영구 정지 (userId=${userId})`, ip, userId);

  // 관리자는 자동 처벌 대상이 아니다.
  // 관리자가 잠기면 자기 정지를 자기가 못 풀어 서비스가 통째로 멎는다
  const user = db.findUserById(userId);
  if (user?.role === 'admin') {
    addLog('ALERT', `LEVEL 4 대상이 관리자라 건너뜀 (userId=${userId})`, ip, userId);
    return aiReason;
  }

  // 정지 기록
  db.createSuspension(userId, 4, triggerType, aiReason, 'permanent');

  // 로그인 자체를 막는다. 데이터는 남긴다 — 오판이면 되돌려야 한다
  if (user) db.banUser(userId);

  // 블랙리스트.
  // IP 대역(/24)까지 자동으로 막지 않는다 — 통신사 NAT 뒤에 있는 사람들이
  // 통째로 걸린다. 대역 차단이 필요하면 관리자가 보고 직접 넣는다
  // **누구 때문에 넣은 줄인지 적는다** (2026-10-22). 안 적어두면 나중에 그 사람을
  // 풀어주려 해도 **어느 주소가 그 사람 것인지 알 길이 없다** —
  // 영구 정지는 되돌릴 수 있어야 하는 자리다(이 함수 머리글)
  if (user?.email) db.addBlacklist('email', user.email, aiReason, userId);
  if (ip) db.addBlacklist('ip', ip, aiReason, userId);

  // 정지 횟수 기록
  suspensionCounts.set(userId, (suspensionCounts.get(userId) || 0) + 1);

  // IP 영구 차단
  block(ip, Infinity, 4, aiReason);

  return aiReason;
}

// ── LEVEL 3: 정지 ──
function executeLevel3(userId, ip, triggerType, details, days) {
  threats.level3++;
  const aiReason = generateAiReason(3, triggerType, details);

  // 관리자는 자동 처벌 대상이 아니다 (LEVEL 4 와 같은 이유)
  if (db.findUserById(userId)?.role === 'admin') {
    addLog('ALERT', `LEVEL 3 대상이 관리자라 건너뜀 (userId=${userId})`, ip, userId);
    return aiReason;
  }

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  addLog('WARNING', `LEVEL 3 — ${triggerType}: ${days}일 정지 (userId=${userId})`, ip, userId);

  db.createSuspension(userId, 3, triggerType, aiReason, expiresAt);

  // 정지 횟수 누적 체크
  const count = (suspensionCounts.get(userId) || 0) + 1;
  suspensionCounts.set(userId, count);

  // 정지가 쌓이면 영구 정지
  if (count >= SUSPEND_TO_BAN) {
    return executeLevel4(userId, ip, 'accumulated', `${count}회`);
  }

  // IP 차단 (정지 기간만큼)
  block(ip, Date.now() + days * 24 * 60 * 60 * 1000, 3, aiReason);

  return aiReason;
}

// ── LEVEL 2: 잠금 ──
function executeLevel2(ip, triggerType, details, hours) {
  threats.level2++;
  const until = Date.now() + hours * 60 * 60 * 1000;
  const aiReason = generateAiReason(2, triggerType, details);
  addLog('ALERT', `LEVEL 2 — ${triggerType}: ${hours}시간 잠금`, ip);

  block(ip, until, 2, aiReason);
  return aiReason;
}

// LEVEL 1(경고)은 **없다** — 부르는 자리가 한 곳도 없었다 (위 머리글).
// 죽은 길을 남겨두면 다음 사람이 「이 앱은 경고를 쌓는다」고 읽는다

// 입력 스캔에 걸린 횟수. 첫 번은 막고 경고만, 되풀이하면 올린다.
// 사람을 알면 사람 단위로, 모르면 IP 단위로 센다
const inputHits = new Map();
const inputHitsByIp = new Map();

// 이 요청이 누구인지.
//
// **가드는 라우트보다 먼저 돈다.** 그래서 여기서는 `req.userId` 가 아직 없다 —
// 그것을 채우는 `middleware/auth` 는 라우트 안에서 돈다. 예전 코드는 `req.userId` 를
// 보고 갈래를 나눴는데, 그 값이 늘 없어서 **로그인한 사람 갈래가 통째로 죽어 있었다.**
// 걸린 사람이 누구든 전부 IP 를 막는 쪽으로 갔다.
//
// 여기서는 토큰만 풀어 본다. 정지·차단 확인은 `middleware/auth` 가 한다 —
// 이쪽은 「누구인가」만 알면 된다. 못 풀면 모르는 사람으로 친다.
function userIdOf(req) {
  try {
    const token = req.cookies?.sb_access || req.headers.authorization?.split(' ')[1];
    if (!token || token.length > 2000 || !process.env.JWT_SECRET) return null;
    const decoded = jwt().verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    return decoded?.userId || null;
  } catch {
    return null;
  }
}

// ── 프로토타입 오염 패턴 ──
const PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * 입력 스캔에서 **빼는 자리** (2026-10-21 — 아래 미들웨어의 머리글에 까닭을 적었다).
 *
 *   `true`      그 길은 통째로 안 본다
 *   [칸 이름…]  그 칸만 빼고 나머지는 본다
 *
 * **여기 넣는 기준은 「우리가 적어달라고 한 글인가」와 「실행될 자리가 있나」 둘이다.**
 * 저장할 때 글자를 다듬고(`utils/sanitize.js`) 화면이 글자로만 그리는 칸만 넣는다.
 */
const SCAN_SKIP = {
  // 앱이 **자동으로** 보낸다. 내용은 정의상 코드 글자(메시지 · 스택)다.
  // 길이가 잘려 있고(300/600자) 1분 5건으로 막혀 있다 (`routes/clientErrors.js`)
  '/api/client-error': true,
  // 사람이 **버그를 적는** 칸. 스택을 붙여넣으라고 우리가 권했다
  '/api/reports': ['title', 'body'],
};

/**
 * 스캔할 몸통 사본. 통째로 면제면 `null` 을 준다.
 *
 * **원본을 건드리지 않는다** — 라우트가 그 값을 그대로 저장한다.
 */
function skipScanFields(path, body) {
  const rule = SCAN_SKIP[path];
  if (rule === true) return null;
  if (!Array.isArray(rule) || !body || typeof body !== 'object' || Array.isArray(body)) {
    return body;
  }
  const copy = {};
  for (const [k, v] of Object.entries(body)) {
    if (!rule.includes(k)) copy[k] = v;
  }
  return copy;
}

/**
 * 면제한 칸에 뭐가 걸렸는지 **적어만 둔다** (2026-10-21).
 *
 * 막지도 세지도 않는다 — 까닭은 아래 미들웨어 머리글에. 그래도 **아는 것은 공짜**고,
 * 조용히 흘리면 정말로 공격이 들어와도 우리가 모른다. 관리자 화면의 로그에 남는다.
 */
function logSkippedScan(req, ip) {
  const rule = SCAN_SKIP[req.path];
  if (!Array.isArray(rule) || !req.body || typeof req.body !== 'object') return;
  for (const k of rule) {
    const v = req.body[k];
    if (typeof v !== 'string' || !v) continue;
    const hit = scanInput(v, 0);
    if (hit) {
      addLog('INFO', `면제한 칸에 ${hit.type} 모양이 있었다 (막지 않음): ${req.path} · ${k}`, ip);
      return;
    }
  }
}

// ── 입력 스캔 (XSS/인젝션/프로토타입오염) ──
function scanInput(obj, depth) {
  if (depth > 5) return null;
  if (typeof obj === 'string') {
    for (const p of XSS_PATTERNS) {
      if (p.test(obj)) return { type: 'xss', pattern: p.toString() };
    }
    for (const p of INJECTION_PATTERNS) {
      if (p.test(obj)) return { type: 'injection', pattern: p.toString() };
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, val] of Object.entries(obj)) {
      // 프로토타입 오염 감지
      if (PROTO_KEYS.has(key)) return { type: 'injection', pattern: `prototype pollution: ${key}` };
      const result = scanInput(val, (depth || 0) + 1);
      if (result) return result;
    }
  }
  return null;
}

// ── 스팸 체크 ──
function checkSpam(userId) {
  const now = Date.now();
  if (!spamCounts.has(userId)) {
    spamCounts.set(userId, { count: 1, firstCreate: now });
    return false;
  }
  const record = spamCounts.get(userId);
  if (now - record.firstCreate > 60000) {
    spamCounts.set(userId, { count: 1, firstCreate: now });
    return false;
  }
  record.count++;
  return record.count >= SPAM_PER_MINUTE;
}

// ── 로그인 실패 ──
function recordLoginFailure(ip) {
  const now = Date.now();

  if (!loginFailures.has(ip)) {
    loginFailures.set(ip, { count: 1, lastFailure: now });
  } else {
    const record = loginFailures.get(ip);
    if (now - record.lastFailure > 60 * 60 * 1000) { // 1시간 리셋
      loginFailures.set(ip, { count: 1, lastFailure: now });
    } else {
      record.count++;
      record.lastFailure = now;
    }
  }

  const record = loginFailures.get(ip);
  for (const step of LOGIN_FAIL_STEPS) {
    if (record.count >= step.count) {
      executeLevel2(ip, 'login_lock', `${step.count}회`, step.hours);
      // 제일 센 둘은 세던 것을 지운다 — 다음에 또 걸리면 처음부터 센다.
      // 제일 낮은 단은 남겨둬야 그 위로 올라갈 수 있다
      if (step !== LOGIN_FAIL_STEPS[LOGIN_FAIL_STEPS.length - 1]) loginFailures.delete(ip);
      break;
    }
  }
}

// ── 위조 토큰 (2026-09-29, 자체 침투에서 되살렸다) ──
//
// 여태 `token_forge` 는 **AI 사유 문구에만 있고 세는 데가 없었다** — 위조 토큰을
// 아무리 던져도 그 주소는 안 막혔다(규칙이 죽어 있었다). 서명이 틀린 토큰은
// 정상 사용에서 나오지 않는다 — 남의 계정으로 들어가려고 토큰을 지어내는 것이다.
//
// **만료는 안 센다.** 그건 오래 켜둔 화면에서 늘 나는 일이라 `auth` 가 갈라
// 이쪽으로 안 보낸다(`TokenExpiredError` 는 제외). 세는 것은 서명 위조·깨진 토큰뿐이다.
function recordTokenForgery(ip) {
  if (!ip || ip === 'unknown' || SELF_IPS.includes(ip)) return;
  const now = Date.now();
  const rec = tokenForgeries.get(ip);
  if (!rec || now - rec.first > 60 * 60 * 1000) {
    limitedSet(tokenForgeries, ip, { count: 1, first: now });
    return;
  }
  rec.count += 1;
  if (rec.count >= TOKEN_FORGE_STEP.count) {
    executeLevel2(ip, 'token_forge', `${rec.count}회`, TOKEN_FORGE_STEP.hours);
    tokenForgeries.delete(ip);
  }
}

// ── 요청 속도 체크 ──
/**
 * 1분 창에 몇 번 왔나.
 *
 * `key` 는 계정이면 `u:<id>`, 아니면 주소다. **계정은 잠그지 않고** 넘쳤다고만
 * 알려준다(부르는 쪽이 429 를 준다). 주소는 여태처럼 사다리대로 잠근다.
 */
function checkRequestRate(key, isAccount) {
  const now = Date.now();
  if (!requestCounts.has(key)) {
    limitedSet(requestCounts, key, { count: 1, firstRequest: now });
    return false;
  }
  const record = requestCounts.get(key);
  if (now - record.firstRequest > 60000) {
    requestCounts.set(key, { count: 1, firstRequest: now });
    return false;
  }
  record.count++;

  // 계정 몫 — 잠그지 않는다. 이 분이 지나면 저절로 풀린다
  if (isAccount) return record.count >= ACCOUNT_RATE_PER_MIN;

  // 위에서부터 본다 — 제일 센 것에 먼저 걸리게
  for (const step of RATE_STEPS) {
    if (record.count >= step.count) {
      executeLevel2(key, 'rate_limit', `${record.count}회`, step.hours);
      break;
    }
  }
  return false;
}

// ── 404 체크 ──
function checkNotFound(ip) {
  const now = Date.now();
  if (!notFoundCounts.has(ip)) {
    notFoundCounts.set(ip, { count: 1, firstHit: now });
  } else {
    const record = notFoundCounts.get(ip);
    if (now - record.firstHit > 60000) {
      notFoundCounts.set(ip, { count: 1, firstHit: now });
    } else {
      record.count++;
    }
  }
  const record = notFoundCounts.get(ip);
  if (record.count >= NOT_FOUND_STEP.count) {
    executeLevel2(ip, 'scan_attack', `${record.count}회/분`, NOT_FOUND_STEP.hours);
    notFoundCounts.delete(ip);
  }
}

// ── 자동 정리 ──
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, info] of blockedIPs.entries()) {
    if (info.until !== Infinity && now >= info.until) {
      blockedIPs.delete(ip);
      addLog('system', '차단 만료 해제', ip);
    }
  }
  // 메모리 정리
  for (const [ip, r] of requestCounts.entries()) {
    if (now - r.firstRequest > 120000) requestCounts.delete(ip);
  }
  for (const [ip, r] of loginFailures.entries()) {
    if (now - r.lastFailure > 3600000) loginFailures.delete(ip);
  }
  for (const [ip, r] of notFoundCounts.entries()) {
    if (now - r.firstHit > 120000) notFoundCounts.delete(ip);
  }
  for (const [ip, r] of tokenForgeries.entries()) {
    if (now - r.first > 3600000) tokenForgeries.delete(ip);
  }
  for (const [uid, r] of spamCounts.entries()) {
    if (now - r.firstCreate > 120000) spamCounts.delete(uid);
  }
}, 5 * 60 * 1000);
if (cleanup.unref) cleanup.unref();

// ── 메인 미들웨어 ──
function aiGuardMiddleware(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  totalRequests++;

  // 헬스체크와 정적 파일은 아무것도 안 본다
  if (req.path === '/api/health') return next();
  // 정적 파일 / SPA 경로는 보안 검사 스킵 (API만 검사)
  // — favicon, /assets/*, /icons/*, .js/.css/.png 등 → API 외 경로는 통과
  if (!req.path.startsWith('/api/')) return next();

  // ── 세는 열쇠를 **맨 앞에서** 붙인다 ── (2026-10-22)
  //
  // 로그인했으면 계정, 아니면 주소다. 뒤에 서는 전역 제한기가 이 값을 쓴다
  // (`index.js`). **화이트리스트보다 먼저** 붙이는 까닭이 있다 — 로컬에서 먼저
  // 돌아나가면 개발에서는 열쇠가 안 붙어 **주소로 세고**, 운영에서만 계정으로
  // 센다. 그러면 여기서 보는 것과 배포본이 다르게 움직인다.
  // 토큰은 여기서 한 번만 풀고 아래에서 돌려 쓴다 (두 번 풀 이유가 없다).
  const who = userIdOf(req);
  req.rateKey = who ? 'u:' + who : null;

  // ── 관리자는 **주소 잠금 바깥**에 둔다 ── (2026-10-22)
  //
  // 자동 처벌에서 관리자를 빼는 규칙은 이미 있다(`executeLevel3` · `executeLevel4` —
  // 「자기 정지를 자기가 못 풀어서 서비스가 잠긴다」). 그런데 **주소 잠금에는 그
  // 규칙이 없었다.** 그리고 주소 잠금은 **토큰을 보기 전에** 걸러지므로,
  // 관리자가 한 번 걸리면 **푸는 길(`POST /security/ai-unblock`)에도 닿지 못한다.**
  //
  // 오늘 실제로 당했다 — 운영에 `curl` 로 읽기 한 번 했다가 봇으로 판정돼 집 주소가
  // 72시간 잠겼고, 관리자 화면에 들어갈 길이 그 자리에서 사라졌다. 램만이면 다시
  // 뜰 때 풀리는데 **파일(DB)에도 적히므로** 배포를 다시 해도 되살아난다.
  //
  // 관리자 토큰을 들고 온 요청은 막지 않는다. 훔친 토큰이라면 그 계정이 이미
  // 넘어간 것이고, 그때 막아야 하는 것은 주소가 아니라 그 계정이다.
  let isAdminReq = false;
  if (who) {
    try { isAdminReq = db.findUserById(who)?.role === 'admin'; } catch { /* DB 를 못 읽으면 보통 사람으로 본다 */ }
  }

  // localhost 는 여기서부터 안 본다 (검사·개발 도구가 제 제한에 걸리지 않게)
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();

  // 블랙리스트 체크 (가입 시)
  if (req.path === '/api/auth/register' && req.method === 'POST') {
    const email = req.body?.email;
    const ua = req.get('user-agent') || '';
    if (db.isBlacklisted(email, ip, ua)) {
      blockedRequests++;
      return res.status(403).json({ error: '서비스를 이용할 수 없습니다.' });
    }
  }

  // IP 차단 체크 — **관리자는 지나간다** (위 「주소 잠금 바깥」)
  if (blockedIPs.has(ip) && !isAdminReq) {
    const info = blockedIPs.get(ip);
    if (info.until === Infinity || Date.now() < info.until) {
      blockedRequests++;
      const response = { error: '접근이 차단되었습니다.', level: info.level };
      if (info.until !== Infinity) response.blockedUntil = new Date(info.until).toISOString();
      if (info.level === 4) response.message = '보안 정책 위반으로 영구 차단되었습니다.';
      else response.message = 'AI Guard에 의해 일시 차단되었습니다.';
      return res.status(403).json(response);
    }
    // **지우기 전에 파일을 한 번 더 본다.** 램이 파일보다 약할 수 있어서다 —
    // 램의 60분이 지났다고 파일의 영구 차단까지 지우면 안 된다
    let persisted = null;
    try { persisted = db.findBlock(ip); } catch { /* 파일을 못 읽으면 램만 본다 */ }
    if (persisted) {
      // 파일 쪽이 아직 살아 있다 — 그 값으로 램을 되돌리고 계속 막는다
      const until2 = persisted.until === 'forever' ? Infinity : new Date(persisted.until).getTime();
      limitedSet(blockedIPs, ip, { until: until2, level: persisted.level, reason: persisted.reason });
      blockedRequests++;
      return res.status(403).json({
        error: '접근이 차단되었습니다.',
        level: persisted.level,
        message: persisted.level === 4 ? '보안 정책 위반으로 영구 차단되었습니다.' : 'AI Guard에 의해 일시 차단되었습니다.',
        ...(persisted.until === 'forever' ? {} : { blockedUntil: persisted.until }),
      });
    }
    blockedIPs.delete(ip);
    try { db.unblockIp(ip); } catch { /* 파일이 안 지워져도 램에서는 풀렸다 */ }
  }

  // ── 봇 판정은 **그 요청만** 막는다 ── (2026-10-22 에 72시간 잠금을 뗐다)
  //
  // 여태 UA 하나로 **그 주소를 72시간 잠갔다.** 그런데 UA 는 증거가 아니라 **힌트**다 —
  //   · 꾸며내기가 한 줄이다 (막으려는 쪽은 아무 때나 `Mozilla` 를 적는다)
  //   · 그리고 **실수로 걸리기가 너무 쉽다** — `curl` 한 번, 회사 망의 점검 도구,
  //     링크 미리보기 봇, 누군가의 파이썬 한 줄이면 걸린다
  //   · 오늘 고친 자리와 같은 결이다: **한 주소 뒤에는 여럿이 있다.** 통신사 NAT ·
  //     헬스장 와이파이에서 한 사람의 `curl` 이 **사흘 동안 그 자리의 모두를** 막는다
  //
  // 지키려는 것은 「훑고 다니는 자동 접근을 막는 것」이고, 그것은 **요청을 막으면**
  // 이뤄진다. 72시간 잠금은 보호를 더 해주지 않고 **곁에 있는 사람만** 상하게 한다.
  // 진짜로 두드리면 속도 사다리와 404 사다리가 잡는다 — 그쪽은 **행동**을 본다.
  const ua = req.get('user-agent') || '';
  if (BOT_PATTERNS.some(p => p.test(ua)) && !ua.includes('Mozilla') && !ua.includes('Render') && !ua.includes('UptimeRobot') && !ua.includes('HealthCheck')) {
    blockedRequests++;
    // 기록은 남긴다 — 사람이 「이 주소가 뭘 하고 있나」를 볼 수 있어야 한다
    addLog('INFO', `자동화된 접근을 막았습니다 (잠그지는 않습니다): ${ua.slice(0, 80)}`, ip);
    return res.status(403).json({ error: '자동화된 접근이 차단되었습니다.' });
  }

  // ── 요청 속도 ──
  //
  // 로그인한 사람은 **계정별로** 센다. 토큰은 여기서 한 번만 풀고(`req.rateKey`),
  // 뒤에 서는 전역 제한기도 같은 열쇠를 쓴다 — 두 번 풀 이유가 없고, 두 곳에서
  // 따로 셈하면 어긋난다 (`index.js` 의 전역 제한을 보라)
  const tooFast = checkRequestRate(req.rateKey || ip, Boolean(who));
  // 방금 사다리에 걸려 잠겼을 수 있다 — **여기도 관리자는 지나간다**
  // (위의 「주소 잠금 바깥」. 이 줄을 빼먹어서 관리자가 그대로 막혔다)
  if (blockedIPs.has(ip) && !isAdminReq) {
    blockedRequests++;
    return res.status(403).json({ error: '비정상적인 요청으로 차단되었습니다.' });
  }
  if (tooFast) {
    // 계정 몫이 넘쳤다 — **그 계정만** 잠깐 쉰다. 주소는 건드리지 않는다.
    // 남은 초를 알려준다(화면이 그만큼 기다리고 다시 보낼 수 있게)
    blockedRequests++;
    const rec = requestCounts.get(req.rateKey);
    const left = Math.max(1, Math.ceil((60000 - (Date.now() - (rec?.firstRequest || 0))) / 1000));
    addLog('INFO', `계정 요청이 잦다 — ${rec?.count}회/분 (userId=${who}). 주소는 잠그지 않는다`, ip, who);
    res.set('Retry-After', String(left));
    return res.status(429).json({
      error: '요청이 너무 잦아요. 잠시 뒤에 다시 해주세요',
      retryAfter: left,
    });
  }

  // ── **우리가 적어달라고 한 글은 스캔하지 않는다** ── (2026-10-21)
  //
  // 돌려보고 찾았다. 이 스캔에 **앱이 스스로 보내는 글**과 **버그를 알려주는 글**이
  // 걸리고 있었다 —
  //
  //     BLOCK 403  화면 오류 — "Cannot set properties of null (setting 'innerHTML')"
  //     BLOCK 403  화면 오류 — "document.write is not a function"
  //     BLOCK 403  화면 오류 — 스택에 "at eval (…)"
  //     BLOCK 403  제보 — 본문에 "…(reading 'innerHTML')" 을 붙여넣음
  //
  // **흰 화면 보고(`/api/client-error`)는 앱이 자동으로 보낸다.** 사람은 아무것도
  // 안 쳤는데 막혔고, 그러면 **흰 화면이 났다는 사실조차 서버에 안 남는다** — 그
  // 기능이 있는 이유가 바로 그것인데(`routes/clientErrors.js` 머리글). 게다가
  // 로그인한 사람이면 **두 번째 흰 화면에 3일 정지**, 그 정지가 둘 쌓이면 영구 정지다.
  // 사람이 한 일이 없는데.
  //
  // **제보도 우리가 권한 일이다.** 에러 경계가 「무슨 일인지 보기 … 제보에 붙여주시면
  // 우리가 찾기 쉽다」고 직접 적어놓고, 붙여넣으면 막았다. 아래의 사다리 주석이
  // 「버그를 알려주러 온 사람을 영구히 잠그는 것이 된다」고 적어둔 그 자리인데,
  // **막는 것 자체**는 그대로여서 제보를 아예 못 보냈다.
  //
  // ── 받아도 되는 까닭 ──
  //
  // 저장할 때 `sanitize`·`sanitizeMultiline` 이 `< > " ' & \`` 를 지우고,
  // 관리자 화면은 `{r.body}` 로 **글자로만** 그린다(이 앱에 `dangerouslySetInnerHTML`
  // 은 한 곳도 없다 — 검사가 본다). **실행될 자리가 없다.** 위험이 없는 곳을 막으면
  // 남는 것은 오탐뿐이다. CSRF 를 `/api/client-error` 에 면제해 둔 것과 같은 판단이다.
  //
  // **면제는 칸 단위다.** 제보의 `meta`·`device` 같은 나머지 칸은 그대로 본다.
  const scanBody = skipScanFields(req.path, req.body);
  if (scanBody === null) {
    // 통째로 면제되는 길 — 404 감지만 걸고 넘긴다
    res.on('finish', () => { if (res.statusCode === 404) checkNotFound(ip); });
    return next();
  }
  // **면제한 칸은 보기는 본다 — 막지도 세지도 않는다.** 조용히 흘리면 정말로
  // 공격이 들어와도 우리가 모른다. 막지 않는 까닭은 위에 적었고, 아는 것은 공짜다
  logSkippedScan(req, ip);

  // XSS/인젝션 스캔 (body + query + params + URL 디코딩)
  const allInput = { ...scanBody, ...req.query, ...req.params };
  // URL 인코딩 우회 방지: 디코딩된 값도 스캔
  try {
    const decoded = decodeURIComponent(req.originalUrl);
    if (decoded !== req.originalUrl) allInput._decodedUrl = decoded;
  } catch {}
  let threat = scanInput(allInput, 0);
  // ── 깊이 우회를 막는다 (2026-09-29, 자체 침투에서 잡았다) ──
  //
  // `scanInput` 은 DoS 를 막으려 **5단에서 멈춘다** — 그런데 멈추면 `null`(안전)을
  // 돌려줘서, `{a:{b:{c:{d:{e:{f:'<script>'}}}}}}` 처럼 여섯 단으로 감싸면 XSS 가
  // 그대로 지나쳤다(정책에 「XSS 를 막는다」고 적어놓고 얕은 것만 막고 있었다).
  //
  // 몸통을 **문자열로 펴서 한 번 더 훑는다.** req.body 는 BODY_LIMIT 로 크기가 묶여
  // 있어 이 스캔은 폭탄이 안 된다(깊이가 아무리 깊어도 글자 수만큼만 본다).
  // 프로토타입 오염 키는 `express.json` 의 reviver 가 파싱 때 이미 모든 깊이에서
  // 걷어내므로 여기서 다시 안 본다 — XSS 문자열만 훑으면 된다.
  if (!threat && scanBody && typeof scanBody === 'object') {
    try {
      const flat = JSON.stringify(scanBody);
      for (const pat of XSS_PATTERNS) {
        if (pat.test(flat)) { threat = { type: 'xss', pattern: pat.toString() }; break; }
      }
    } catch { /* 직렬화가 안 되면 구조 스캔 결과를 믿는다 */ }
  }
  if (threat) {
    // 로그인한 사람이면 사다리를 탄다.
    //
    // 예전에는 **첫 번에 영구 정지**였다. 그런데 걸리는 자리 중에는 사람이 그냥 쓸 만한
    // 것도 있다 — 「이 글자를 넣으면 화면이 깨져요: <script>」 라고 적은 제보가 그렇다.
    // **버그를 알려주러 온 사람을 영구히 잠그는** 것이 된다.
    //
    // 욕설에서 이미 같은 판단을 했다(`utils/abusePolicy.js`) — 처음에는 막고 경고만,
    // 되풀이하면 그때 올린다. 요청은 **어느 쪽이든 막힌다.** 실제로 지키는 것은 그쪽이고,
    // 정지는 되풀이하는 사람에게만 쓴다.
    //
    // 횟수는 메모리에 센다. 서버가 다시 뜨면 초회로 돌아가는데, 그래도 요청은 늘 막히므로
    // 보호에는 구멍이 없다 — 되돌릴 수 없는 처벌만 늦게 간다. 이 방향의 오차가 맞다.
    const userId = who;       // 위에서 한 번 푼 것을 쓴다
    if (userId) {
      const hits = (inputHits.get(userId) || 0) + 1;
      limitedSet(inputHits, userId, hits);
      addLog('WARNING', `입력 스캔 ${hits}회 — ${threat.type} (userId=${userId})`, ip, userId);

      if (hits === 1) {
        return res.status(403).json({
          error: '보안 정책 위반이 감지되었습니다.',
          message: '보낼 수 없는 글자가 들어 있어 막았습니다. 계정은 그대로입니다 — 그 부분을 빼고 다시 보내주세요. 되풀이되면 정지될 수 있습니다.',
        });
      }

      const reason = executeLevel3(userId, ip, threat.type, threat.pattern, INPUT_SUSPEND_DAYS);
      return res.status(403).json({
        error: '보안 정책 위반이 감지되었습니다.',
        // **막아둔 길을 가리키지 않는다** (2026-10-24) — 정지되면 제보도 403 이다.
        // 기간이 있는 정지라 「풀린 뒤에」가 할 수 있는 말이다 (`abusePolicy` 와 같은 말)
        message: `되풀이되어 계정이 ${INPUT_SUSPEND_DAYS}일간 정지되었습니다. 기록은 지우지 않습니다 — 잘못 걸렸다면 **풀린 뒤에** 고객센터 제보함으로 알려주세요.`,
        reason: reason,
      });
    }

    // 누구인지 모르면 IP 로 센다.
    //
    // 예전에는 **첫 번에 그 IP 를 7일** 막았다. 이 앱에서 IP 는 사람 하나가 아니다 —
    // 통신사 NAT 뒤에서는 수만 명이 같은 주소로 나온다. 한 사람이 제보에 `<script>` 를
    // 붙여넣으면 그 뒤의 모두가 일주일 동안 앱을 못 쓴다. 같은 파일의 LEVEL 4 주석이
    // 대역 차단을 스스로 금지해 둔 것과 같은 이유다.
    //
    // 요청은 어느 쪽이든 막힌다. 막는 시간만 되풀이한 만큼 올린다.
    const ipHits = (inputHitsByIp.get(ip) || 0) + 1;
    limitedSet(inputHitsByIp, ip, ipHits);
    addLog('WARNING', `입력 스캔 ${ipHits}회 — ${threat.type} (비로그인)`, ip);

    if (ipHits >= 5) executeLevel2(ip, threat.type, threat.pattern, 168);       // 7일
    else if (ipHits >= 3) executeLevel2(ip, threat.type, threat.pattern, 24);
    else if (ipHits >= 2) executeLevel2(ip, threat.type, threat.pattern, 1);

    // **무엇을 하면 되는지 적는다.** 여태 이 말 하나였다 — 그 말로는 고칠 수가 없다.
    // 로그인한 사람에게는 위에서 이미 그렇게 말하고 있었다
    return res.status(403).json({
      error: '보낼 수 없는 글자가 들어 있어 막았습니다.',
      message: '스크립트로 읽힐 수 있는 글자가 있어요. 그 부분을 빼고 다시 보내주세요.',
    });
  }

  // 404 감지
  res.on('finish', () => {
    if (res.statusCode === 404) checkNotFound(ip);
  });

  next();
}

// ── 스팸 체크 미들웨어 (POST 라우트에서 사용) ──
function spamCheck(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
  if (req.userId && req.method === 'POST') {
    if (checkSpam(req.userId)) {
      // 정지를 걸지 않는다. 너무 빠른 것과 나쁜 뜻으로 하는 것은 다르고,
      // 이 판정만으로 사람을 일주일 막아 세우기에는 근거가 약하다.
      // 잠깐 되돌려 보내고 기록만 남긴다 — 진짜 공격은 IP 차단과 rate limit 이 잡는다
      const count = spamCounts.get(req.userId)?.count || SPAM_PER_MINUTE;
      addLog('INFO', `요청이 너무 빠름: ${count}건/분 (userId=${req.userId})`, ip, req.userId);
      return res.status(429).json({
        error: '조금 빠릅니다. 잠시 뒤에 다시 해주세요',
        retryAfterSec: 60,
      });
    }
  }
  next();
}

// ── 「계정 정지 체크 미들웨어」는 **걷었다** ── (2026-10-22)
//
// `suspensionCheck` 가 있었는데 **아무도 안 썼다**(마운트하는 자리가 없다).
// 그리고 그것은 `middleware/auth.js` 가 이미 하는 판단의 **두 번째 벌**이었다 —
// 토큰을 풀 때 `is_banned` 과 정지를 보고 403 을 준다.
//
// 두 벌이면 **반드시 어긋난다.** 실제로 어긋나 있었다: `auth.js` 는 **관리자를
// 정지에서 빼는데**(「자기 정지를 자기가 못 풀어 서비스가 멎는다」) 이쪽에는 그
// 규칙이 없었다. 누군가 이것을 마운트하는 날 **관리자가 자기 앱에서 쫓겨난다.**

// 사람이 읽는 시간. 「168시간」은 아무도 7일로 안 읽는다
const hoursText = (h) => (h >= 24 ? `${Math.round(h / 24)}일` : `${h}시간`);

/**
 * 지금 실제로 도는 자동 규칙. **화면은 이걸 받아서 그린다.**
 *
 * 손으로 적어두면 코드가 바뀔 때 화면만 옛 숫자로 남는다 — 실제로 그랬다.
 * 여기 있는 값은 전부 위의 상수에서 나온다. 새 규칙을 넣으면 이 목록에도 적는다.
 */
function policy() {
  return [
    {
      title: '너무 잦은 요청',
      detail: `로그인한 사람은 **계정별로** 센다 — 1분에 ${ACCOUNT_RATE_PER_MIN}회를 넘으면 `
        + `그 계정에만 잠깐 기다리라고 한다(주소는 잠그지 않는다 — 한 와이파이에 여럿이 있다). `
        + `로그인 안 한 요청은 주소별로 세어 1분에 ${RATE_STEPS.map((s) => s.count).join(' · ')}회를 `
        + `넘으면 그 주소를 ${RATE_STEPS.map((s) => hoursText(s.hours)).join(' · ')} 잠근다`,
    },
    {
      title: '로그인 실패가 쌓이는 주소',
      detail: `1시간 안에 ${LOGIN_FAIL_STEPS.map((s) => s.count).join(' · ')}회 틀리면 `
        + `${LOGIN_FAIL_STEPS.map((s) => hoursText(s.hours)).join(' · ')} 잠근다`,
    },
    {
      title: '없는 주소를 계속 두드리기',
      detail: `1분에 ${NOT_FOUND_STEP.count}회를 넘으면 ${hoursText(NOT_FOUND_STEP.hours)} 잠근다 (훑고 다니는 것)`,
    },
    {
      title: '위조 토큰',
      detail: `서명이 틀린 로그인 토큰을 1시간에 ${TOKEN_FORGE_STEP.count}회 넘게 던지면 `
        + `${hoursText(TOKEN_FORGE_STEP.hours)} 잠근다 (만료된 토큰은 정상이라 안 센다)`,
    },
    {
      title: '봇 · 크롤러',
      detail: '사람 브라우저가 아닌 것으로 보이면 **그 요청을 막는다**. '
        + '주소를 잠그지는 않는다 — UA 는 꾸며내기 쉽고, 한 주소 뒤에는 여럿이 있다. '
        + '진짜로 두드리면 속도 · 없는 주소 사다리가 잡는다',
    },
    {
      title: '보낼 수 없는 글자 (XSS · 프로토타입 오염)',
      detail: `요청은 언제나 막는다. **첫 번은 막고 알려만 주고**, 되풀이하면 `
        + `${INPUT_SUSPEND_DAYS}일 정지한다. SQL · 몽고 패턴은 이 앱에 그런 DB 가 없어 안 본다`,
    },
    {
      title: '기록을 몰아서 만들기',
      detail: `1분에 ${SPAM_PER_MINUTE}건을 넘으면 막는다 (운동을 몰아 적는 사람이 걸리지 않게 넉넉히 뒀다)`,
    },
    {
      title: '정지가 쌓이면',
      detail: `${SUSPEND_TO_BAN}번 정지되면 영구 정지한다 — **계정과 기록은 지우지 않는다**`,
    },
    {
      title: '자동으로 하지 않는 것',
      detail: '계정과 기록을 지우는 일 · IP 대역(/24) 통째로 막기 · 관리자 처벌. '
        + '지우는 것은 「보안 관리」에서 사람이 확인하고 한다',
    },
  ];
}

// ── 내보내기 ──
module.exports = aiGuardMiddleware;
module.exports.spamCheck = spamCheck;
module.exports.recordLoginFailure = recordLoginFailure;
module.exports.recordTokenForgery = recordTokenForgery;
module.exports.executeLevel4 = executeLevel4;
module.exports.executeLevel3 = executeLevel3;

module.exports.getAiLogs = () => [...aiLogs];
module.exports.getBlockedIPs = () => {
  const result = {};
  for (const [ip, info] of blockedIPs.entries()) {
    result[ip] = { until: info.until === Infinity ? 'permanent' : new Date(info.until).toISOString(), level: info.level };
  }
  return result;
};
module.exports.getStats = () => ({
  totalRequests, blockedRequests, threats,
  suspiciousIPs: [...blockedIPs.keys()],
  activeLocks: blockedIPs.size,
  requestTracking: requestCounts.size,
  loginFailureTracking: loginFailures.size,
  spamTracking: spamCounts.size,
});
module.exports.getSuspiciousIPs = () => [...blockedIPs.keys()];
// 손으로 풀 때는 **파일에서도** 지운다. 램에서만 지우면 다음에 서버가 뜰 때 되살아난다
module.exports.unblockIP = (ip) => {
  const inRam = blockedIPs.delete(ip);
  let inFile = false;
  // **푼 것도 곧바로 쓴다.** 막을 때만 flush 하고 풀 때는 0.5초 미루고 있었다 —
  // 그 사이에 프로세스가 내려가면 「차단이 해제되었어요」라고 말해놓고 다시 뜰 때 되살아난다
  try { inFile = db.unblockIp(ip); db.flushNow(); } catch { /* 파일이 없으면 램만 */ }
  const r = inRam || inFile;
  if (r) addLog('system', '수동 차단 해제', ip);
  return r;
};
// 보안 검사(POST /api/security/scan)가 **실제로 쓰는 판정**을 불러 쓴다.
// 검사 쪽에 패턴을 다시 적어두면 어긋난다 — 10/21 에 고친 「보고서가 고치기 전의
// 버그를 적던 것」과 같은 결이다. 여기 한 자리만 보면 된다
module.exports.inspect = (obj) => scanInput(obj, 0);
module.exports.hydrateBlocks = hydrateBlocks;
// 보안 라우트도 같은 판정을 쓴다 — 두 곳에 적어두면 반드시 어긋난다
module.exports.isPrivateIp = isPrivateIp;
module.exports.policy = policy;
module.exports.THRESHOLDS = { RATE_STEPS, ACCOUNT_RATE_PER_MIN, LOGIN_FAIL_STEPS, NOT_FOUND_STEP, TOKEN_FORGE_STEP, INPUT_SUSPEND_DAYS, SUSPEND_TO_BAN, SPAM_PER_MINUTE };

// 로그인 유지 토큰이 두 곳에서 쓰였다 — 사람이 봐야 하는 일이라 기록에 남긴다.
// **여기서 IP 를 막지는 않는다.** 다시 온 쪽이 주인일 수도 있어서다
// (공격자가 먼저 쓰고, 주인의 갱신이 두 번째로 도착하는 것이 오히려 흔하다)
module.exports.noteRefreshReuse = (userId, ip, email) => {
  addLog('CRITICAL', `로그인 유지 토큰이 두 번 쓰였습니다 — ${email || 'id=' + userId} 의 로그인을 전부 끊었습니다`, ip, userId);
};
module.exports.manualBlock = (ip, minutes) => { const until = Date.now() + minutes * 60000; block(ip, until, 2, '관리자 수동 차단'); return new Date(until).toISOString(); };
