// 방어막 시험 — **진짜 서버를 띄워서 실제로 막히는지 본다.**
//
//   npm run shield
//
// `check-security.cjs` 는 방어막의 **계산**을 본다(차단이 파일에 남는가, 무차별 대입
// 카운터를 무엇으로 세는가). 그것만으로는 **요청이 실제로 되돌려 보내지는지** 알 수 없다.
// 8/27 에 이 앱은 그것 때문에 한 번 크게 당했다 — `app.use(aiGuard)` 가 `express.json()`
// 보다 먼저라 **`req.body` 가 늘 `undefined`** 였고, 입력 검사가 통째로 죽어 있었다.
// 코드는 멀쩡했고 로그도 정상이었고 화면도 안 터졌다. **막지만 않았다.**
//
// 그래서 여기서는 **다른 프로세스로 서버를 띄우고 진짜 HTTP 를 쏜다.**
//   · 진짜 DB 는 안 건드린다 (`DB_FILE` 로 임시 파일) · 진짜 포트도 안 쓴다
//   · 마지막에 **서버를 내렸다 다시 띄워** 차단이 남아 있는지 본다
//
// ── 여기서 제일 먼저 걸린 것 (2026-09-02) ──
//
// **로컬에서 쏘면 방어막이 통째로 건너뛴다.** `aiGuard` 는 맨 앞에서
// `127.0.0.1 · ::1` 를 화이트리스트로 흘려보낸다(개발과 헬스체크 때문에 일부러 그렇다).
// 그래서 처음 짠 시험은 **일곱 번 넘게 틀려도 안 막혔고**, 그게 「방어막이 뚫렸다」가
// 아니라 **「시험이 방어막에 닿지도 못했다」**였다. 모르고 지나갈 뻔했다.
//
// 서버는 `trust proxy` 를 켜두었으므로(Render 뒤에 있다), **`X-Forwarded-For` 로
// 바깥 주소인 척**하면 진짜 사람이 치는 것과 같은 길로 들어간다. 시험마다 주소를
// 따로 쓴다 — 하나를 막았다고 다음 시험이 같이 막히면 안 된다.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TMP = path.join(ROOT, '.check-shield.json');
// 포트는 **비어 있는 자리를 찾아 쓴다.**
//
// 처음에는 4599 로 못박아 뒀는데, 앞 시험이 남긴 서버가 그 자리에 살아 있으면
// 새로 띄운 것은 조용히 죽고(EADDRINUSE) **시험은 남의 서버와 이야기한다.**
// 그 서버는 이미 지워진 옛 DB 를 들고 있어서, 막은 것이 파일에 안 적힌 것처럼 보인다.
// 실제로 그렇게 30분을 헤맸다 — 방어막이 아니라 시험이 고장 나 있었다.
let PORT = 4599;
let BASE = '';

// 시험마다 다른 「바깥 주소」. 203.0.113.0/24 는 문서용으로 잡아둔 대역이라
// 실제로 누구의 주소도 아니다
const IP = {
  login: '203.0.113.11',
  notFound: '203.0.113.22',
  clean: '203.0.113.44',
};

const clean = () => {
  for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
};
clean();

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let child = null;

function startServer() {
  child = spawn(process.execPath, [path.join(ROOT, 'src', 'index.js')], {
    cwd: ROOT,
    env: {
      ...process.env, PORT: String(PORT), DB_FILE: TMP, NODE_ENV: 'test',
      VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { if (process.env.SHIELD_DEBUG) process.stdout.write('[서버] ' + d); });
  child.stderr.on('data', (d) => { if (process.env.SHIELD_DEBUG) process.stderr.write('[서버] ' + d); });
}

async function waitUp(timeoutMs = 15000) {
  const until = Date.now() + timeoutMs;
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

/** 요청 하나. `ip` 를 주면 그 주소에서 온 것처럼 보낸다 */
async function call(method, url, { body, token, ip } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ip) headers['X-Forwarded-For'] = ip;
  let res;
  try {
    res = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    return { status: 0, data: { error: e.message } };
  }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

/** 아무도 안 쓰는 포트를 찾는다. 응답이 오면 남의 서버다 — 그 자리는 안 쓴다 */
async function pickPort() {
  for (let p = 4599; p <= 4620; p += 1) {
    try {
      await fetch(`http://127.0.0.1:${p}/api/health`, { signal: AbortSignal.timeout(400) });
    } catch {
      return p;   // 아무도 안 받는다 = 빈 자리
    }
  }
  return 0;
}

(async () => {
  PORT = await pickPort();
  if (!PORT) { console.log('FAIL 빈 포트를 못 찾았습니다 (앞 시험의 서버가 남아 있습니다)'); process.exit(1); }
  BASE = `http://127.0.0.1:${PORT}/api`;
  startServer();
  if (!await waitUp()) { console.log('FAIL 서버가 안 떴습니다'); await stopServer(); process.exit(1); }

  console.log('── 시험이 방어막에 닿는가 ──');
  // **이걸 먼저 본다.** 안 닿으면 아래 시험은 전부 「안 막혔다」가 아니라
  // 「닿지도 못했다」가 된다 — 실제로 처음에 그렇게 헛돌았다
  const reach = await call('GET', '/health', { ip: IP.clean });
  ok('바깥 주소인 척할 수 있다 (trust proxy)', reach.status, 200);

  console.log('');
  console.log('── 로그인 없이 열리면 안 되는 자리 ──');
  for (const [name, url] of [
    ['보안 대시보드', '/security/dashboard'],
    ['사람 목록', '/security/users'],
    ['보안 기록', '/security/logs'],
    ['제보 전체', '/reports/all'],
  ]) {
    const r = await call('GET', url, { ip: IP.clean });
    ok(`${name} 은 그냥 못 연다`, r.status === 401 || r.status === 403, true);
  }

  console.log('');
  console.log('── 입력 검사가 살아 있는가 ──');
  // 8/27 에 죽어 있던 자리다. `req.body` 가 늘 undefined 라, 주소창으로 보낸 `<script>` 는
  // 잡히는데 제보 · 운동명 · 닉네임으로 보낸 것은 아무것도 안 잡혔다
  const email = `shield${Date.now()}@shield.local`;
  const reg = await call('POST', '/auth/register', {
    body: { email, password: 'shield12345', nickname: '방어막시험', username: `s${Date.now()}` },
    ip: IP.clean,
  });
  ok('시험 계정을 만든다', reg.status === 200 || reg.status === 201, true);
  const token = reg.data?.token;
  ok('토큰을 받는다', !!token, true);

  await call('POST', '/workouts', {
    body: { exercise: '<script>alert(1)</script>', weight: '60', sets: '3', reps: '10', date: '2026-09-02' },
    token, ip: IP.clean,
  });
  // **첫 번은 경고만 하고 받아준다** (9/1 에 그렇게 정했다 — 오탐으로 사람을 막지 않으려고).
  // 그래서 「거절했는가」가 아니라 **「그대로 저장됐는가」**를 본다. 태그가 남으면
  // 그 이름이 목록 · 그래프 · 관리자 화면에 그대로 실려 나간다
  const saved = await call('GET', '/workouts', { token, ip: IP.clean });
  const names = Array.isArray(saved.data) ? saved.data.map((w) => String(w.exercise || '')) : [];
  ok('스크립트 태그가 그대로 저장되지 않는다', names.some((n) => /<script/i.test(n)), false);

  console.log('');
  console.log('── 무차별 대입: 일곱 번 넘게 틀리면 ──');
  // 문턱은 7 · 10 · 20 회다 (`aiGuard` 의 LOGIN_FAIL_STEPS)
  const codes = [];
  for (let i = 1; i <= 8; i += 1) {
    const r = await call('POST', '/auth/login', { body: { email, password: 'wrong-password' }, ip: IP.login });
    codes.push(r.status);
  }
  // **잠겨도 401 을 준다.** 있는 계정만 429 가 되면 그 차이가 「이 아이디는 있다」는
  // 답이 된다 — 계정이 있는지 없는지를 알려주지 않으려고 일부러 같은 답을 준다
  ok('틀린 비밀번호에 계정 있음을 알려주지 않는다', codes.every((c) => c === 401 || c === 403), true);
  // **막혔는지는 맞는 비밀번호로 본다.** 안 막혔으면 여기서 200 이 나온다
  const after = await call('POST', '/auth/login', { body: { email, password: 'shield12345' }, ip: IP.login });
  ok('일곱 번 넘게 틀린 주소는 맞는 비밀번호도 안 통한다', after.status !== 200, true);
  // 그 주소만 막혀야 한다 — 아니면 한 사람이 온 서비스를 잠글 수 있다
  const elsewhere = await call('POST', '/auth/login', { body: { email, password: 'shield12345' }, ip: IP.clean });
  ok('막힌 것은 그 주소뿐이다 (딴 사람은 그대로 들어간다)', elsewhere.status, 200);

  console.log('');
  console.log('── 없는 주소를 두들기면 ──');
  // 취약점 스캐너는 없는 주소를 훑는다. 문턱은 30회다 (NOT_FOUND_STEP)
  let blockedAt = 0;
  for (let i = 1; i <= 34; i += 1) {
    const r = await call('GET', `/no-such-place-${i}`, { ip: IP.notFound });
    if (!blockedAt && r.status === 403) blockedAt = i;
  }
  ok('서른 번 넘게 두들기면 막는다', blockedAt > 0, true);
  // **`/api/health` 로는 확인할 수 없다.** 방어막이 헬스체크를 맨 앞에서 흘려보낸다 —
  // 막힌 주소도 그 자리는 열린다 (Render 가 살아 있는지 볼 때 쓰는 자리다)
  const stillBlocked = await call('GET', '/routines/머신', { ip: IP.notFound });
  ok('막힌 주소는 멀쩡한 자리도 못 연다', stillBlocked.status, 403);

  console.log('');
  console.log('── 차단이 서버 재시작을 넘어 남는가 ──');
  // Render 무료 플랜은 15분만 놀아도 프로세스를 내린다.
  // 차단이 램에만 있으면 **기다리면 풀린다**는 뜻이다
  await sleep(1200);   // DB 는 500ms 마다 몰아 쓴다
  const onDisk = fs.existsSync(TMP) ? JSON.parse(fs.readFileSync(TMP, 'utf-8')) : {};
  const blocked = (onDisk.blocks || []).map((b) => b.ip);
  ok('막은 주소가 파일에 적혔다', blocked.includes(IP.notFound), true);

  await stopServer();
  startServer();
  ok('서버가 다시 떴다', await waitUp(), true);
  const afterRestart = await call('GET', '/routines/머신', { ip: IP.notFound });
  ok('다시 떠도 막힌 채로 남는다', afterRestart.status, 403);
  // 안 막힌 주소까지 같이 막혀 있으면 그건 차단이 아니라 고장이다
  const innocent = await call('GET', '/routines/머신', { ip: IP.clean });
  ok('안 막힌 주소는 그대로 열린다', innocent.status, 200);

  await stopServer();
  clean();

  console.log('');
  console.log(bad ? `${bad}건 실패` : '방어막 전부 통과');
  process.exit(bad ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await stopServer();
  clean();
  process.exit(1);
});
