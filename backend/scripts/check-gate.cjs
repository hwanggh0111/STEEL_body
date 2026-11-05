// **모든 길에 문이 걸려 있나** (2026-11-05).
//
//   npm run gate     (npm run check 가 찾아서 돈다)
//
// ── 왜 ──
//
// 라우트가 115개다. 그중 **로그인 없이 쓰는 길**은 손에 꼽히고(로그인 · 가입 ·
// 소셜 콜백 · 공개 목록) 나머지는 전부 `auth` 나 `adminAuth` 를 거쳐야 한다.
// 그런데 **문을 거는 방식이 두 가지**다 —
//
//     const auth = require('../middleware/auth');   router.get('/x', auth, …)
//     router.get('/me', require('../middleware/auth'), …)      ← 인라인
//
// 그래서 문이 걸렸는지 **눈으로 세는 것이 실제로 어렵다**. 오늘 내가 한 번 세다
// 틀렸다 — 인라인으로 걸린 길 여섯을 「문 없음」으로 읽었다. 사람이 그렇게 틀리면
// **빠진 문도 같은 모양으로 안 보인다.**
//
// 빠지면 증상이 없다는 것이 더 나쁘다 — 자기 자료만 보는 사람에게는 영영 멀쩡하고,
// **남의 자료를 받아가는 길**이 열린 것은 그 길을 찾는 사람만 안다.
// `check-owner` 는 `/:id` 를 받는 길의 **주인**을 보고, 여기는 **문 자체**를 본다.
//
// ── 길마다 둘 중 하나여야 한다 ──
//
//   1. **`auth` 또는 `adminAuth` 를 거친다** (위에서 받은 것이든 인라인이든)
//   2. **아래 목록에 까닭과 함께 적혀 있다** — 로그인 없이 쓰는 길이다
//
// ★ **쓰이지 않는 면제는 FAIL 한다** (`check-twins` 가 세운 그 선) — 길이 사라지거나
// 이름이 바뀌면 이 목록이 **덫**이 된다. 그리고 **잡은 수와 적힌 수를 맞춰본다**
// (`check-owner` 가 정규식이 샜던 그 자리에서 배운 것).
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'src', 'routes');

let bad = 0;
const ok = (label, pass, detail) => {
  if (!pass) bad += 1;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label}${detail ? ` → ${detail}` : ''}`);
};

/** 한 라우트 블록의 끝(괄호 짝이 맞는 자리). 길이로 자르지 않는다 (`check-owner` 와 같은 손) */
function blockOf(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    const c = src[i];
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return src.slice(start);
}

// **로그인 없이 쓰는 길** — 까닭과 함께 적는다.
//
// 「로그인 전에 쓰는 길」이 대부분이다. 그 길들은 **문을 걸 수가 없다** — 문을 열
// 열쇠를 받으러 오는 길이기 때문이다. 대신 다른 자들이 그쪽을 지킨다:
// `npm run join`(가입은 메일 주인에게만) · `npm run shield`(방어막) ·
// `npm run rate`(두들기기) · `npm run oauth`(소셜).
const 문없음 = {
  'auth POST /register': '가입 — 문을 열 열쇠를 받으러 오는 길이다 (`npm run join` 이 지킨다)',
  'auth POST /login': '로그인 — 같은 까닭 (`npm run rate` 가 두들기기를 본다)',
  'auth POST /logout': '로그아웃 — 쿠키를 비우는 길이다. 토큰이 이미 식었어도 비워야 한다',
  'auth POST /refresh': '로그인 유지 — 쿠키의 리프레시 토큰이 문 구실을 한다',
  'auth POST /send-code': '메일 인증번호 보내기 — 가입 전이다',
  'auth POST /verify-code': '그 번호가 맞나 — 가입 전이다. **계정을 만들지 않는다**',
  'auth POST /check-email': '이미 가입된 메일인가 — 가입 화면이 미리 묻는다',
  'auth POST /check-username': '쓸 수 있는 아이디인가 — 같은 까닭',
  'auth POST /reset-password': '비밀번호 찾기 — 메일 번호가 문 구실을 한다',
  'auth GET /mail-status': '이 서버가 메일을 보낼 수 있나 — 가입 화면이 먼저 묻는다 (열쇠는 안 나간다)',
  'oauth GET /providers': '어느 소셜이 켜져 있나 — 로그인 화면이 단추를 그릴 때 묻는다',
  'oauth GET /google': '소셜로 보내는 길 — 로그인 전이다',
  'oauth GET /google/callback': '소셜이 돌려보내는 길 — `state` 쿠키가 문 구실을 한다',
  'oauth GET /naver': '같은 까닭',
  'oauth GET /naver/callback': '같은 까닭',
  'oauth GET /instagram': '같은 까닭 (인스타는 10/09 에 접었다 — 길만 남아 있다)',
  'oauth GET /instagram/callback': '같은 까닭',
  'oauth GET /twitter': '같은 까닭',
  'oauth GET /twitter/callback': '같은 까닭',
  'oauth POST /email': '소셜로 들어온 사람이 메일을 확인하는 길 — 가입을 마치는 자리다',
  'maintenance GET /': '점검 중인가 — **로그인 화면도 물어야 한다** (문을 걸면 점검 중에 아무도 못 본다)',
  'routines GET /programs': '추천 프로그램 — 누구나 받는 목록이다 (사람 자료가 아니다)',
  'routines GET /:type': '기본 루틴 목록 — 같은 까닭 (`check-owner` 가 「누구나 본다」로 같이 본다)',
  'sitePhotos GET /': '홈페이지(`/site`)에 걸린 사진 — 로그인 전 화면이 쓴다',
  'clientErrors POST /': '화면이 터졌을 때 보내는 자리 — **로그인 전에도 터진다**. 받는 쪽은 한도를 걸어둔다',
};

const rows = [];
const declared = [];

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(DIR, file), 'utf8');
  const name = file.replace(/\.js$/, '');

  const re = /router\.(put|delete|patch|post|get)\(\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const [, method, route] = m;
    const key = `${name} ${method.toUpperCase()} ${route}`;
    declared.push(key);

    // 라우트 한 덩이에서 **손잡이(handler) 앞**까지가 미들웨어 자리다
    const block = blockOf(src, m.index + `router.${method}`.length);
    const head = block.slice(0, block.search(/\(\s*req\b|async\s*\(\s*req\b/) + 1 || 200);
    const admin = /adminAuth/.test(head);
    const authed = admin || /\bauth\b/.test(head) || /middleware\/auth/.test(head);
    rows.push({ key, name, method: method.toUpperCase(), route, admin, authed });
  }
}

console.log(`── 라우트 ${rows.length}개에 문이 걸려 있나 ──`);
console.log('');

const openRows = rows.filter((r) => !r.authed);
for (const r of openRows) {
  const why = 문없음[r.key];
  ok(`${r.name.padEnd(14)} ${r.method.padEnd(6)} ${r.route.padEnd(20)}`, !!why,
    why ? '로그인 없이 쓰는 길 (적어둔 까닭 있음)' : '**문이 없다 — 까닭도 안 적혀 있다**');
}
if (openRows.length === 0) console.log('     (문 없는 길이 없다)');

console.log('');
console.log('── 셈이 맞나 ──');
const gated = rows.filter((r) => r.authed).length;
const adminOnly = rows.filter((r) => r.admin).length;
console.log(`   문 있는 길 ${gated} · 그중 관리자 전용 ${adminOnly} · 로그인 없이 ${openRows.length}`);
// 잡은 수와 적힌 수가 같아야 한다 — 다르면 **정규식이 건너뛴 길**이 있고,
// 그 길은 검사받지 않은 채로 남는다 (`check-owner` 가 그렇게 샜던 자리다)
ok(`잡은 길 = 적힌 길 (${rows.length} / ${declared.length})`, rows.length === declared.length);
// **빈 손으로 통과하지 않는다** — 길을 하나도 못 찾았는데 「전부 통과」면 거짓이다
ok('재고 있는 길이 있다 (100개 이상)', rows.length >= 100, String(rows.length));
// 관리자 전용 길이 **한 자리에서** 걸리는가 — 보안 라우트는 전부 그래야 한다
const sec = rows.filter((r) => r.name === 'security');
ok(`보안 라우트는 전부 관리자 전용 (${sec.filter((r) => r.admin).length}/${sec.length})`,
  sec.length > 0 && sec.every((r) => r.admin));

console.log('');
// ★ **쓰이지 않는 면제는 걷는다** — 길이 사라지거나 이름이 바뀌면 이 목록이 덫이 된다
const stale = Object.keys(문없음).filter((k) => !rows.some((r) => r.key === k));
ok('없는 길을 가리키는 「문없음」', stale.length === 0, stale.join(' · ') || '없음');
// 면제에 적어뒀는데 **지금은 문이 걸린** 길도 걷는다 (문을 걸었으면 그 줄은 거짓이다)
const nowGated = Object.keys(문없음).filter((k) => rows.some((r) => r.key === k && r.authed));
ok('문이 걸렸는데 「문없음」에 남은 길', nowGated.length === 0, nowGated.join(' · ') || '없음');

console.log('\n' + (bad ? `${bad}건 실패` : '전부 통과'));
process.exit(bad ? 1 : 0);
