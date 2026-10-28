// 관리자 보안 화면이 **서버가 하는 말을 다 하는가 · 시각을 맞게 적는가** (2026-10-27)
//
//   npm run secview     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 둘을 본다.
//
// **① 시각.** 서버가 보내는 시각은 `new Date().toISOString()` — 끝에 `Z` 가 붙은
// UTC 다. 그것을 글자로 자르면(`iso.substring(11, 19)`) 한국에서는 **아홉 시간 전**이
// 적힌다. 실제로 「자동 보안 검사」의 최근 보안 로그가 그랬다 — 저녁 6시에 일어난
// 일이 오전 9시로 적혔고, **같은 로그를 그리는 AI 관리자 화면은 맞게 적고 있었다.**
// 눈으로는 안 잡힌다: 숫자가 그럴듯해서 「그 시간에 뭐가 있었나」로 읽고 지나간다.
//
// **② 서버가 보내는데 화면이 안 읽는 칸.** 10/24 와 10/26 에 나온 버그 스물다섯 중
// 열여섯이 이 모양이었다 — **서버는 할 말을 들고 있는데 그 말이 사람에게 안 닿는다.**
// 그래서 `/security/report` 가 보내는 칸 이름을 **라우트 파일에서 뽑아** 화면이 그
// 이름을 읽는지 센다. 안 그리기로 정한 것은 **까닭과 함께 아래 목록에 적는다** —
// 새 칸이 서버에 생기면 둘 중 어디에도 없어서 이 검사가 FAIL 한다.
//
// ★ **주석을 걷고 센다** — 까닭을 주석에 적어두는 집이라, 글자만 세면 주석이 코드로
// 읽힌다 (10/26 에 두 번 밟았다).

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const yes = (name, cond, why) => {
  if (!cond) bad += 1;
  console.log((cond ? 'OK   ' : 'FAIL ') + name + (cond ? '' : ' — ' + why));
};

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const D = bundle('src/data/dateKey.js', '.seckey.cjs');

// 주석 · 문자열을 가리지 않고 걷으면 문자열 속 `//` 가 주석으로 읽힌다 — 한 글자씩 본다
function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      out += c; i += 1;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') { out += src[i]; i += 1; }
        if (i < src.length) { out += src[i]; i += 1; }
      }
      out += c; i += 1; continue;
    }
    out += c; i += 1;
  }
  return out;
}

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const SCAN = stripComments(read('src', 'components', 'admin', 'SecurityScan.jsx'));
const AI = stripComments(read('src', 'components', 'AiAdminPanel.jsx'));

// ──────────────────────────────────────────────────────────────
console.log('── 시각을 그 사람의 시계로 적는다 ──');

// 고정 시각 하나로 본다. **기대값을 손으로 적지 않는다** — 같은 Date API 로 뽑아
// 견준다(이 검사가 시간대를 지어내면 그것이 또 하나의 거짓이 된다)
const ISO = '2026-10-27T09:12:33.123Z';
const d = new Date(ISO);
const p2 = (x) => String(x).padStart(2, '0');
const wantClock = `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
ok('시:분:초', D.clockOf(ISO), wantClock);
ok('날짜까지', D.stampOf(ISO), `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${wantClock}`);

// **글자로 자른 것과 다른가** — 시간대가 UTC 가 아닌 곳에서는 반드시 달라야 한다
const cut = ISO.substring(11, 19);
if (d.getTimezoneOffset() === 0) {
  console.log('SKIP 이 기계가 UTC 라 「글자로 자른 것」과 구별이 안 된다');
} else {
  yes(`글자로 자른 ${cut} 와 다르다 (${D.clockOf(ISO)})`, D.clockOf(ISO) !== cut,
    'UTC 글자를 그대로 적고 있다 — 한국에서는 아홉 시간 전이다');
}

ok('없는 값', [D.clockOf(null), D.clockOf(''), D.clockOf(undefined)], ['-', '-', '-']);
ok('깨진 값', [D.clockOf('어제'), D.stampOf('{}')], ['-', '-']);

console.log('\n── 화면이 ISO 를 그대로 안 뿌린다 ──');
yes('주석이 걷혔다', !SCAN.includes('무엇이 잘못돼'), '주석 걷는 자리가 안 듣는다 — 아래 셈을 못 믿는다');
yes('글자로 자르지 않는다', !/substring\(11/.test(SCAN) && !/slice\(11/.test(SCAN),
  'UTC 글자를 잘라 쓰면 한국에서 아홉 시간 전이 적힌다');
yes('검사 시각을 옮겨 적는다', /stampOf\(result\.scannedAt\)/.test(SCAN),
  'ISO 글자가 그대로 화면에 뿌려진다');
yes('로그 시각을 옮겨 적는다', /clockOf\(log\.timestamp\)/.test(SCAN),
  'ISO 글자가 그대로 화면에 뿌려진다');
yes('시각 적는 자리가 한 곳이다', /const timeOf = stampOf/.test(AI),
  '두 관리자 화면이 따로 적으면 같은 시각을 다르게 말하는 날이 온다');

console.log('\n── 흰 화면이 안 되게 감싸고 읽는다 ──');
// 모양을 **확인하고** 받는지까지 본다. `const sum = result.summary` 로만 받으면
// 이름은 생겼지만 터지는 자리는 그대로다 (되돌려 보고 알았다)
yes('요약을 모양까지 확인하고 받는다', /typeof result\.summary === 'object'/.test(SCAN),
  '서버가 요약 자리에 글자나 없는 것을 주면 그 줄에서 터진다');
[
  ['result.summary.', 'const sum = '],
  ['report.server.', 'const srv = '],
  ['report.users.', 'const usr = '],
  ['report.threats.', 'const thr = '],
  ['report.auth.', 'const aut = '],
].forEach(([raw, guard]) => {
  yes(`${raw}* 를 바로 안 읽는다`, !SCAN.includes(raw) && SCAN.includes(guard),
    '서버가 다른 모양을 주면 그 줄에서 터져 관리자 화면이 통째로 흰 화면이 된다');
});
yes('results 를 배열로 확인하고 펼친다', /Array\.isArray\(result\?\.results\)/.test(SCAN),
  '[...undefined] 는 그 자리에서 터진다');
yes('defense 를 감싼다', /Object\.entries\(report\.defense \|\| \{\}\)/.test(SCAN),
  '같은 화면의 headers · recentLogs 는 이미 감쌌는데 여기만 안 감쌌다');

// ──────────────────────────────────────────────────────────────
// 서버가 보내는 칸을 **라우트에서 뽑아** 화면이 읽는지 센다
// ──────────────────────────────────────────────────────────────
console.log('\n── 서버가 보내는데 화면이 안 읽는 칸 ──');

// 「보안 현황」 화면 — 아래 `PANEL` 과 같은 것을 먼저 읽는다 (쓰는 자리가 둘이다)
const PANEL0 = stripComments(read('src', 'components', 'SecurityPanel.jsx'));

const ROUTE = stripComments(fs.readFileSync(
  path.join(__dirname, '..', '..', 'backend', 'src', 'routes', 'security.js'), 'utf8'));

// `/report` 의 응답 뭉치만 떼어낸다
const at = ROUTE.indexOf("router.get('/report'");
yes('/report 라우트를 찾았다', at >= 0, 'security.js 가 바뀌었다면 이 검사도 고쳐야 한다');
const body = ROUTE.slice(at, ROUTE.indexOf("router.get('/shield'", at));

// 뭉치 이름(`server: {`)과 그 안의 칸 이름을 들여쓰기로 가른다
const groups = {};
let cur = null;
body.split('\n').forEach((line) => {
  const g = line.match(/^ {4}(\w+): \{\s*$/);
  if (g) { cur = g[1]; groups[cur] = []; return; }
  if (/^ {4}\},?\s*$/.test(line)) { cur = null; return; }
  const k = line.match(/^ {6}(\w+):/);
  if (cur && k) groups[cur].push(k[1]);
});

// **안 그리기로 정한 것은 까닭과 함께 적는다.** 여기도 저기도 없는 이름이 나오면
// 서버에 새 칸이 생긴 것이고, 그때 이 검사가 FAIL 해서 알려준다
const SKIP = {
  'server.memory': '바이트 네 개(rss · heapTotal …)는 관리자가 보고 할 일이 없다. 모자라면 Render 쪽에서 본다',
  'auth.csrfProtection': '같은 말이 「방어 시스템」 목록에 이미 있다 (defense.csrfProtection)',
  'auth.cookieFlags': '쿠키 설정은 「방어 시스템」 목록에서 함께 읽는다',
};

// **통째로 그리는 뭉치**는 칸 이름이 화면에 안 적힌다 — `Object.entries` 로 돌려
// 서버가 보낸 것을 다 그리므로, 칸이 늘어도 저절로 따라온다. 그 자리는 **뭉치째**로 본다
const WHOLE = ['defense', 'headers'];
WHOLE.forEach((g) => {
  // 정규식으로 쓰면 `(` · `|` · `{` 가 다 뜻을 가져서 **엉뚱한 것에 맞는다** —
  // 글자 그대로 찾는다
  yes(`${g} 를 통째로 그린다`, SCAN.includes(`Object.entries(report.${g} || {})`),
    '서버가 보낸 것을 다 그리지 않거나 감싸지 않았다');
});

const unread = [];
Object.entries(groups).forEach(([g, keys]) => {
  if (WHOLE.includes(g)) return;
  keys.forEach((k) => {
    const full = `${g}.${k}`;
    if (SKIP[full]) return;
    // 화면이 그 이름을 어딘가에서 읽는가 (`srv.env` · `usr.banned` …)
    if (!new RegExp(`\\b${k}\\b`).test(SCAN)) unread.push(full);
  });
});
ok('서버가 보내는 칸을 화면이 다 읽는다', unread, []);
console.log(`     (뭉치 ${Object.keys(groups).length}개 · 칸 ${Object.values(groups).reduce((a, b) => a + b.length, 0)}개`
  + ` · 통째로 그리는 뭉치 ${WHOLE.length}개 · 안 그리기로 정한 칸 ${Object.keys(SKIP).length}개)`);
Object.entries(SKIP).forEach(([k, why]) => console.log(`     안 그린다: ${k} — ${why}`));

// ──────────────────────────────────────────────────────────────
// **`/dashboard` 쪽도 같이 본다** (2026-10-28)
// ──────────────────────────────────────────────────────────────
//
// 위의 셈은 `/report` **하나만** 보고 있었다. 그래서 `/dashboard` 가 보내는
// `jwt.refreshExpiry` 를 **화면이 한 번도 안 읽는 것**을 아무도 몰랐다 —
// 「보안 현황」은 「만료시간」 한 줄로 **접속 토큰만** 적었다. 접속이 15분이라
// 「안전」으로 보여도 **다시 받는 열쇠가 90일이면 훔친 쪽은 90일을 쓴다.**
// 관리자가 판단하는 자리에서 그 절반이 안 보이고 있었다 (10/27 ⑧ 과 같은 모양).
console.log('');
console.log('── 보안 현황이 보내는 칸을 화면이 다 읽는가 ──');
{
  const dAt = ROUTE.indexOf("router.get('/dashboard'");
  yes('/dashboard 라우트를 찾았다', dAt >= 0, 'security.js 가 바뀌었다면 이 검사도 고쳐야 한다');
  const dBody = ROUTE.slice(dAt, ROUTE.indexOf('\n});', dAt));
  // 뭉치 안의 칸 (`jwt: { expiry, refreshExpiry, algorithm }`)과 맨 위 칸을 같이 모은다
  const fields = [];
  let g = null;
  dBody.split('\n').forEach((line) => {
    const open = line.match(/^ {4}(\w+): \{\s*$/);
    if (open) { g = open[1]; return; }
    if (/^ {4}\},?\s*$/.test(line)) { g = null; return; }
    const inner = line.match(/^ {6}(\w+):/);
    if (g && inner) { fields.push(g + '.' + inner[1]); return; }
    const top = line.match(/^ {4}(\w+):/);
    if (!g && top) fields.push(top[1]);
  });

  // **안 그리기로 정한 것은 까닭과 함께 적는다**
  const DSKIP = {
    'rateLimit': '뭉치째 `Object.entries` 로 돌려 다 그린다 (칸이 늘어도 따라온다)',
    'cors': '`cors.origins` 를 그린다 — 뭉치 이름은 화면에 안 적힌다',
    'helmet': '`helmet.enabled` 로 등급을 낸다',
    'jwt': '아래 세 칸으로 갈라 그린다',
    // **점검 보고서가 이미 그린다** — 「다시 받기 7d · 암호 12회」(`SecurityScan`).
    // 현황은 등급을 내는 자리이고 **라운드 수는 등급에 안 쓴다**(알고리즘으로 낸다).
    // 같은 값을 두 자리에 두는 것은 이 앱이 하는 일이지만(설정함의 앱 잠금처럼),
    // 여기 더하면 **등급과 상관없는 숫자가 등급 옆에** 붙는다
    'bcryptRounds': '보안 점검 화면이 그린다 (「암호 12회」). 등급에는 안 쓰는 값이다',
  };
  const miss = [];
  fields.forEach((f) => {
    if (DSKIP[f]) return;
    const leaf = f.split('.').pop();
    if (!new RegExp('\\b' + leaf + '\\b').test(PANEL0)) miss.push(f);
  });
  ok('서버가 보내는 칸을 화면이 다 읽는다', miss, []);
  console.log('     (칸 ' + fields.length + '개 · 안 그리기로 정한 것 ' + Object.keys(DSKIP).length + '개)');
  Object.entries(DSKIP).forEach(([k, why]) => console.log('     안 그린다: ' + k + ' — ' + why));
}

// ──────────────────────────────────────────────────────────────
// 관리자가 **한 일을 말하는가** (2026-10-27)
// ──────────────────────────────────────────────────────────────
//
// 사람 목록의 다섯 동작(차단 · 차단 해제 · 영구 정지 풀기 · 관리자 주기 ·
// 관리자 내리기)이 **성공하면 아무 말도 안 했다.** 보낸 뒤 응답을 통째로 버리고
// 목록만 조용히 다시 그렸다 — 말은 실패에만 있었다.
//
// 서버는 할 말을 들고 있고(`message`), 영구 정지 풀기는 **숫자 셋**까지 보낸다
// (`lifted` · `blacklist` · `unlockedIps`). 확인 창은 「정지 기록 · 로그인 차단 ·
// 블랙리스트 · 주소 잠금을 한 번에 되돌립니다」라고 약속해놓고 **무엇이 몇 건
// 풀렸는지는 한 번도 말하지 않았다.** 10/24 · 10/26 에 고친 그 모양이다.
const PANEL = stripComments(read('src', 'components', 'SecurityPanel.jsx'));

console.log('\n── 관리자가 한 일을 말한다 ──');
yes('보낸 응답을 받아 든다', /const res = await client\.post\(`\/security\//.test(PANEL),
  '응답을 버리면 서버가 보낸 말이 사람에게 안 닿는다');
yes('성공했을 때도 말한다', /toast\(actionLine\(action, out\)\)/.test(PANEL),
  '성공이 조용하면 눌린 것인지 알 수 없다');
yes('서버가 보낸 말을 그대로 쓴다', /data\?\.message/.test(PANEL),
  '화면이 따로 적어두면 서버가 하는 일이 바뀔 때 여기만 옛 말로 남는다');
['lifted', 'blacklist', 'unlockedIps'].forEach((k) => {
  yes(`영구 정지 풀기가 ${k} 를 읽는다`, new RegExp('data\\?\\.' + k).test(PANEL),
    '서버가 세어 보내는데 화면이 안 읽는다');
});
yes('0 인 것은 안 적는다', /Number\(n\) > 0/.test(PANEL),
  '「가입 막음 0」은 아무것도 안 알려주면서 줄만 길게 만든다');
yes('한 일과 목록 받기를 가른다', /목록만 못 받아왔어요/.test(PANEL),
  '한 try 에 두면 차단은 됐는데 목록 받기가 실패했을 때 「처리하지 못했어요」라고 말한다');

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
