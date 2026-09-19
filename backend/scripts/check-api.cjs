// **앱이 부르는 길과 서버가 가진 길이 맞는가** (2026-09-19).
//
//   npm run api      (npm run check 에도 들어 있다)
//
// 앱과 서버는 한 저장소에 있지만 **서로를 문자열로 부른다.** 그래서 어긋나도
// 빌드가 통과하고 검사도 통과한다 — 눌러봐야 안다. 두 방향 다 값이 있다:
//
//   · **앱이 부르는데 서버에 없는 길** — 그 단추는 404 다. 화면은 대개
//     「불러오지 못했어요」만 띄우므로, 쓰는 사람은 자기 인터넷을 의심한다
//   · **서버에 있는데 아무도 안 부르는 길** — 죽은 길이다. 9/19 에 둘 나왔다.
//     `GET /api/workouts/:date` 는 앱이 한 번도 안 불렀는데, 9/18 에 그 길의 DB 쪽을
//     3.28ms → 0.48ms 로 줄였다. **부르는 사람이 없는 길을 빠르게 만든 것이다.**
//     재기 전에 「누가 부르는가」를 먼저 봤어야 했다
//
// 죽은 길은 느린 것보다 나쁘다 — 아무도 안 쓰는 채로 **계속 열려 있다**(쓸 수 있는
// 문이 하나 더 있다는 뜻이다). 그래서 이 검사는 두 쪽을 다 본다.
const fs = require('fs');
const path = require('path');

const FRONT = path.join(__dirname, '..', '..', 'frontend', 'src');
const BACK = path.join(__dirname, '..', 'src');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const walk = (d, out = []) => {
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx?|cjs)$/.test(e.name)) out.push(p);
  }
  return out;
};

// `${id}` 처럼 값이 끼는 자리는 `:v` 로 바꿔 둔다. 문자열을 잇는 것(`'/reports/' + id`)은
// 뒤가 안 잡히므로 끝의 `/` 도 `:v` 로 본다 — 안 그러면 `/reports` 를 부른 것처럼 읽힌다
const normCall = (s) => s
  .replace(/\$\{[^}]*\}/g, ':v')
  .replace(/\/$/, '/:v')       // `'/reports/' + id` — 뒤가 안 잡히므로 값이 온다고 본다
  .replace(/\/+$/, '');
// 서버 쪽은 그대로 본다. `router.get('/')` 는 마운트 주소 그 자체다 —
// 여기에 위의 규칙을 쓰면 `GET /api/workouts` 가 `GET /api/workouts/:v` 로 읽힌다
// (처음에 하나로 묶었다가 검사가 통째로 어긋났다)
const normRoute = (s) => s.replace(/\/+$/, '');

// ── 앱이 부르는 것 ──
const calls = new Map();
for (const f of walk(FRONT)) {
  const src = fs.readFileSync(f, 'utf-8');
  for (const m of src.matchAll(/client\.(get|post|put|patch|delete)\s*\(\s*[`'"]([^`'"]+)[`'"]/g)) {
    const key = m[1].toUpperCase() + ' ' + normCall(m[2]);
    if (!calls.has(key)) calls.set(key, new Set());
    calls.get(key).add(path.basename(f));
  }
}

// ── 서버가 가진 것 ──
const idx = fs.readFileSync(path.join(BACK, 'index.js'), 'utf-8');
const mounts = [...idx.matchAll(/app\.use\(\s*['"]([^'"]+)['"]\s*,\s*require\(['"]\.\/routes\/([^'"]+)['"]\)/g)]
  .map((m) => ({ base: m[1], file: m[2] }));
const routes = new Set();
for (const mt of mounts) {
  const p = path.join(BACK, 'routes', mt.file.replace(/\.js$/, '') + '.js');
  if (!fs.existsSync(p)) continue;
  const rs = fs.readFileSync(p, 'utf-8');
  for (const m of rs.matchAll(/router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g)) {
    routes.add(m[1].toUpperCase() + ' ' + normRoute((mt.base + m[2]).replace('/api', '')));
  }
}

// **아무것도 못 읽었으면 그 자리에서 멈춘다.** 빈 목록을 보고 통과하는 검사가
// 제일 나쁘다 (`frontend/scripts/check-reach.cjs` 에서 한 번 겪었다)
if (calls.size < 40 || routes.size < 40 || mounts.length < 10) {
  console.log('FAIL 양쪽을 못 읽었다 (앱 ' + calls.size + '개 · 서버 ' + routes.size + '개 · 마운트 ' + mounts.length + '개)');
  process.exit(1);
}

/** 앱이 부른 것과 서버 길이 같은 자리인가 (`:id` 자리는 값으로 본다) */
const matchRoute = (call) => {
  const [verb, url] = call.split(' ');
  for (const r of routes) {
    const [rv, ru] = r.split(' ');
    if (rv !== verb) continue;
    const a = url.split('/');
    const b = ru.split('/');
    if (a.length !== b.length) continue;
    if (a.every((seg, i) => b[i].startsWith(':') || seg === ':v' || b[i] === seg)) return r;
  }
  return null;
};

console.log('앱이 부르는 길 ' + calls.size + '개 · 서버가 가진 길 ' + routes.size + '개');
console.log('');
console.log('── 앱이 부르는데 서버에 없는 길 ──');
const missing = [...calls].filter(([c]) => !matchRoute(c)).map(([c, w]) => c + ' ← ' + [...w].join(', '));
ok('없는 길을 부르는 자리', missing, []);

console.log('');
console.log('── 서버에 있는데 아무도 안 부르는 길 ──');
// 앱이 `client.*` 로 안 부르지만 **딴 길로 쓰이는 것들**은 뺀다:
//   · 소셜 로그인은 브라우저가 주소로 직접 간다 (`window.location`)
//   · 내보내기는 `fetch` 로 파일을 받는다 (`client` 는 JSON 용이다)
//   · 토큰 갱신은 `client` 안의 가로채기(interceptor)가 부른다 — 화면이 아니다
//   · 화면 오류 보내기는 `ErrorBoundary` 가 `fetch` 로 보낸다 (그때는 앱이 깨진 상태다)
//   · 헬스 체크는 Render 가 부른다
const BY_OTHER_MEANS = [
  /^GET \/oauth\//, /^POST \/oauth\/[a-z]+\/code$/,
  /^GET \/export\//,
  /^POST \/auth\/refresh$/, /^POST \/auth\/verify-code$/,
  /\/client-error/,
  /^GET \/health$/,
];
// **한 부름이 여러 길에 걸릴 수 있다.** 관리자 화면은 `/security/${action}/${id}` 처럼
// 하는 일까지 값으로 만들어 부른다 — 그 한 줄이 `make-admin` · `revoke-admin` ·
// `unblock-user` 셋을 다 쓴다. 첫 번째만 세면 나머지 둘이 「아무도 안 부르는 길」로 뜬다
const called = new Set();
for (const c of calls.keys()) {
  const [verb, url] = c.split(' ');
  for (const r of routes) {
    const [rv, ru] = r.split(' ');
    if (rv !== verb) continue;
    const a = url.split('/');
    const b = ru.split('/');
    if (a.length !== b.length) continue;
    if (a.every((seg, i) => b[i].startsWith(':') || seg === ':v' || b[i] === seg)) called.add(r);
  }
}
const orphans = [...routes]
  .filter((r) => !called.has(r))
  .filter((r) => !BY_OTHER_MEANS.some((re) => re.test(r)))
  .sort();
ok('아무도 안 부르는 길', orphans, []);

console.log('');
console.log('── 9/19 에 걷은 길이 다시 생기지 않았는가 ──');
const workouts = fs.readFileSync(path.join(BACK, 'routes', 'workouts.js'), 'utf-8');
ok('날짜별 조회가 없다', /router\.get\('\/:date'/.test(workouts), false);
ok('  DB 함수도 없다', /getWorkoutsByDate\s*\(userId/.test(fs.readFileSync(path.join(BACK, 'db.js'), 'utf-8')), false);
const routines = fs.readFileSync(path.join(BACK, 'routes', 'routines.js'), 'utf-8');
ok('추천 루틴 전체 목록이 없다', /router\.get\('\/',/.test(routines), false);
ok('  갈래별로는 그대로 있다', /router\.get\('\/:type'/.test(routines), true);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
