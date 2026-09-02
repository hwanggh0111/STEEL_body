// 이상한 것을 보내도 서버가 안 터지는가.
//
//   npm run odd
//
// **500 이 나오면 그건 막은 것이 아니라 터진 것이다.** 400 은 「그렇게는 안 받는다」는
// 답이고, 500 은 「우리가 안 막아뒀다」는 뜻이다. 로그에는 스택이 찍히고 사람에게는
// 「서버에 문제가 생겼어요」만 간다 — 무엇이 잘못됐는지 아무도 모른다.
//
// 8/27 에 **닉네임에 배열을 보내면 500 이 나던 자리**가 실제로 있었다. 그때는 스모크에
// 그 한 줄을 넣어 막았는데, 같은 종류가 다른 칸에도 있는지는 안 봤다.
// 여기서는 **쓰는 자리마다 말도 안 되는 몸통을 다 넣어본다.**
//
// 진짜 DB 도 진짜 포트도 안 건드린다 (`check-shield.cjs` 와 같은 방식).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TMP = path.join(ROOT, '.check-odd.json');
let PORT = 4700;
let BASE = '';

const clean = () => {
  for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
};
clean();

let bad = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let child = null;

function startServer() {
  child = spawn(process.execPath, [path.join(ROOT, 'src', 'index.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_FILE: TMP, NODE_ENV: 'test',
      VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
}
async function waitUp(ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { if ((await fetch(`${BASE}/health`)).ok) return true; } catch { /* 아직 */ }
    await sleep(200);
  }
  return false;
}
function stopServer() {
  if (!child) return Promise.resolve();
  const done = new Promise((r) => child.once('exit', r));
  child.kill();
  child = null;
  return done;
}
async function pickPort() {
  for (let p = 4700; p <= 4720; p += 1) {
    try { await fetch(`http://127.0.0.1:${p}/api/health`, { signal: AbortSignal.timeout(400) }); } catch { return p; }
  }
  return 0;
}

// 두들기는 자리마다 다른 「바깥 주소」를 쓴다.
//
// **처음에는 하나로 썼다가 시험이 통째로 헛돌았다** — 회원가입 · 로그인을 백 번
// 두들기면 그 주소의 로그인 제한(15분에 20회)이 차서, 그다음에 만들려던 시험 계정이
// 429 로 막혔다. 토큰이 없으니 나머지 열네 자리는 **전부 401 만 받고** 라우터에는
// 닿지도 못한 채 「500 없음」으로 통과했다. 안 터진 게 아니라 안 가본 것이었다.
let ipSeq = 0;
const nextIp = () => `198.51.100.${(ipSeq += 1) % 200 + 10}`;
let currentIp = nextIp();

async function call(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  // 바깥에서 온 것처럼 보내야 방어막을 지나 라우터까지 간다 (로컬은 통째로 건너뛴다)
  headers['X-Forwarded-For'] = currentIp;
  try {
    const res = await fetch(BASE + url, { method, headers, body: JSON.stringify(body) });
    return res.status;
  } catch (e) {
    return 0;
  }
}

// 말도 안 되는 값들. 배열 · 객체 · 아주 긴 글자 · 프로토타입 오염까지
const ODD = [
  {},
  { __proto__: { admin: true } },
  ...[null, 0, -1, 1e308, [], ['x'], { a: 1 }, true, 'x'.repeat(300)]
    .map((v) => ({ __v: v })),
];

/** 그 자리에 이상한 몸통을 다 넣어본다. 500 이 하나라도 나오면 잡는다 */
async function pound(name, method, url, token, fields) {
  currentIp = nextIp();   // 자리마다 새 주소로 — 앞에서 막힌 것이 따라오면 안 된다
  const fails = [];
  for (const odd of ODD) {
    const v = '__v' in odd ? odd.__v : undefined;
    // 칸마다 이상한 값을 하나씩 넣어본다 (나머지는 비운다)
    const bodies = fields.length
      ? fields.map((f) => ({ [f]: v }))
      : [odd];
    for (const body of bodies) {
      const status = await call(method, url, body, token);
      if (status >= 500) fails.push(`${JSON.stringify(body).slice(0, 60)} → ${status}`);
      // 토큰을 들고 갔는데 401 이면 라우터에 못 닿은 것이다 — 시험이 헛돈다
      if (token && status === 401) fails.push('401 — 라우터에 닿지 못했습니다');
    }
  }
  const pass = fails.length === 0;
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + (pass ? ' → 500 없음' : ' → ' + fails.slice(0, 3).join(' · ')));
}

(async () => {
  PORT = await pickPort();
  if (!PORT) { console.log('FAIL 빈 포트를 못 찾았습니다'); process.exit(1); }
  BASE = `http://127.0.0.1:${PORT}/api`;
  startServer();
  if (!await waitUp()) { console.log('FAIL 서버가 안 떴습니다'); await stopServer(); process.exit(1); }

  // **계정을 먼저 만든다.** 두들기고 나서 만들면 그 주소가 이미 막혀 있다
  const email = `odd${Date.now()}@odd.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.5' },
    body: JSON.stringify({ email, password: 'odd12345678', nickname: '이상값시험', username: `o${Date.now()}` }),
  });
  const token = (await reg.json()).token;
  if (!token) {
    // **토큰이 없으면 아래는 전부 401 이라 라우터에 닿지도 못한다.**
    // 그걸 「500 없음」으로 통과시키면 시험이 거짓말을 한다
    console.log(`FAIL 시험 계정을 못 만들었습니다 (${reg.status}) — 아래를 돌려도 뜻이 없습니다`);
    await stopServer();
    clean();
    process.exit(1);
  }

  console.log('── 로그인 전에 이상한 것을 보내면 ──');
  await pound('회원가입', 'POST', '/auth/register', null, ['email', 'password', 'nickname', 'username']);
  await pound('로그인', 'POST', '/auth/login', null, ['email', 'password']);
  await pound('아이디 중복 확인', 'POST', '/auth/check-username', null, ['username']);
  await pound('비밀번호 찾기', 'POST', '/auth/reset-password', null, ['email', 'code', 'password']);

  console.log('');
  console.log('── 로그인한 뒤 쓰는 자리마다 ──');
  await pound('운동 기록', 'POST', '/workouts', token, ['date', 'exercise', 'weight', 'sets', 'reps']);
  await pound('인바디', 'POST', '/inbody', token, ['date', 'weight', 'fat_pct', 'muscle_kg']);
  await pound('측정', 'POST', '/measures', token, ['type', 'date', 'data']);
  await pound('내 루틴', 'POST', '/my-routines', token, ['name', 'exercises']);
  await pound('달력 계획', 'POST', '/plans', token, ['date', 'kind', 'name', 'routineId']);
  await pound('제보', 'POST', '/reports', token, ['kind', 'title', 'body', 'meta', 'device']);
  await pound('알림 설정', 'PUT', '/reminders', token, ['days', 'hour', 'minute', 'enabled']);
  await pound('별점', 'POST', '/ratings', token, ['score', 'comment']);
  await pound('루틴 진행표', 'POST', '/routine-session', token, ['routineId']);
  await pound('사진', 'POST', '/photos', token, ['type', 'data']);
  await pound('닉네임', 'PUT', '/auth/nickname', token, ['nickname']);
  await pound('성별', 'PUT', '/auth/sex', token, ['sex']);
  await pound('비밀번호 바꾸기', 'PUT', '/auth/password', token, ['currentPassword', 'newPassword']);
  await pound('못 찾은 말', 'POST', '/faq-gaps', token, ['term']);

  await stopServer();
  clean();
  console.log('');
  console.log(bad ? `${bad}군데에서 500 이 납니다` : '이상한 것을 보내도 500 은 안 납니다');
  process.exit(bad ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await stopServer();
  clean();
  process.exit(1);
});
