// **루틴의 운동 줄이 글자로 와도 버리지 않는가** (2026-11-11).
//
//   npm run routinerow     (진짜 서버를 띄우므로 `npm run check` 에서는 건너뛴다)
//
// ── 왜 이 자가 생겼나 ──
//
// 루틴 줄은 꾸러미(`{ name, sets, reps }`)인데 **글자 하나**(`'벤치프레스'`)로 담긴
// 옛 줄이 데이터 모양에 들어 있다. 화면이 네 자리에서 그렇게 다룬다 — 읽는 자리
// 셋(`RoutinePage.jsx` 의 `:167`·`:350`·`:850`)과 고치는 폼에 얹을 때 꾸러미로 바꿔주는
// 자리 하나(`:166` 의 `editRoutine`). 그 읽기는 **2026-04-15 최초 판본부터** 있다.
//
// 그런데 `routes/myRoutines.js` 는 `typeof ex === 'object'` 만 통과시켜 **글자 줄을
// 조용히 버렸다.** 고치는 화면은 `editRoutine` 이 먼저 바꿔 보내므로 멀쩡했는데,
// **되돌리기는 그 자리를 지나지 않는다** — `data/undoRow.js` 의 `routinePayload` 는
// 「되살린 루틴이 원래와 다른 루틴이 되면 안 된다」며 담긴 모양 그대로 보낸다.
// 그래서 글자 줄이 있는 옛 루틴을 고치거나 지운 뒤 되돌리면 **그 줄이 빠진 루틴**이
// 되살아나고, 전부 글자였으면 400 이 나서 「되살리지 못했어요」가 뜬다.
//
// **닿는다고 단정하지 않는다** — 로컬 기록부(`blackiron.json`)에는 글자 줄이 0이고
// 운영 기록부는 볼 수가 없다. 다만 화면 네 자리가 그 모양을 다루고 있는 한, **서버와
// 화면 중 하나는 틀렸다.** 담긴 것을 버리는 쪽이 아니라 받는 쪽이 맞다 — 지우는 것은
// 사람이 적은 것이다.
//
// 이 자는 **진짜 서버에 한 바퀴 돌려** 글자 줄이 살아 돌아오는지 보고, 화면 쪽
// 정규화가 그대로 있는지도 같이 센다(한쪽만 지우는 날을 막는다).
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRONT = path.resolve(ROOT, '..', 'frontend');
const TMP = path.join(os.tmpdir(), `check-routinerow-${process.pid}.json`);
let PORT = 4780;
let BASE = '';
let child = null;

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = () => { try { fs.unlinkSync(TMP); } catch { /* 없으면 됐다 */ } };

function startServer() {
  child = spawn(process.execPath, [path.join(ROOT, 'src', 'index.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_FILE: TMP, NODE_ENV: 'test', DEV_ECHO_CODE: '1' },
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
  for (let p = 4780; p <= 4799; p += 1) {
    try { await fetch(`http://127.0.0.1:${p}/api/health`, { signal: AbortSignal.timeout(400) }); } catch { return p; }
  }
  return 0;
}

const IP = '198.51.100.91';
let TOKEN = '';
async function call(method, url, body) {
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': IP };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(BASE + url, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* 몸통 없는 답도 있다 */ }
  return { status: res.status, body: json };
}
/** 돌아온 루틴에서 운동 이름만 뽑는다 — 화면이 읽는 그 규칙으로 */
const names = (ex) => (Array.isArray(ex) ? ex : []).map((e) => (typeof e === 'string' ? e : e?.name));

(async () => {
  console.log('── 루틴의 운동 줄이 글자로 와도 버리지 않는가 ──');

  // ── 먼저 글자로 본다 — 서버와 화면이 같은 모양을 다루고 있는가 ──
  {
    const srv = fs.readFileSync(path.join(ROOT, 'src/routes/myRoutines.js'), 'utf8');
    ok('서버가 글자 줄을 꾸러미로 바꾼다 (`asRow`)', /typeof ex === 'string'/.test(srv), true);
    const rp = fs.readFileSync(path.join(FRONT, 'src/pages/RoutinePage.jsx'), 'utf8');
    const 화면 = (rp.match(/typeof ex === 'string'|typeof e === 'string'/g) || []).length;
    ok('  화면도 글자 줄을 다루는 자리가 그대로다', 화면 >= 3, true);
    console.log('       화면 ' + 화면 + '자리 — 한쪽만 지우면 서버와 화면의 가정이 갈린다');
    const ur = fs.readFileSync(path.join(FRONT, 'src/data/undoRow.js'), 'utf8');
    ok('  되돌리기는 모양을 안 바꾼다 (그래서 서버가 받아야 한다)',
      /routinePayload[\s\S]{0,400}exercises/.test(ur), true);
  }

  console.log('');
  PORT = await pickPort();
  if (!PORT) { console.log('FAIL 빈 포트를 못 찾았습니다'); process.exit(1); }
  BASE = `http://127.0.0.1:${PORT}/api`;
  startServer();
  if (!await waitUp()) { console.log('FAIL 서버가 안 떴습니다'); await stopServer(); clean(); process.exit(1); }

  // 계정 하나 (`check-cardio-api` 와 같은 자리)
  const email = `routinerow${Date.now()}@odd.local`;
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': IP };
  const sent = await fetch(`${BASE}/auth/send-code`, { method: 'POST', headers, body: JSON.stringify({ email }) });
  const code = (await sent.json())?.code;
  if (!code) {
    console.log('FAIL 인증번호를 못 받았습니다 — `DEV_ECHO_CODE=1` 로 띄워야 합니다');
    await stopServer(); clean(); process.exit(1);
  }
  const reg = await fetch(`${BASE}/auth/register`, {
    method: 'POST', headers,
    body: JSON.stringify({ email, password: 'routine12345678', nickname: '루틴줄시험', username: `rrow${Date.now()}`, code }),
  });
  TOKEN = (await reg.json()).token;
  if (!TOKEN) { console.log('FAIL 토큰을 못 받았습니다'); await stopServer(); clean(); process.exit(1); }

  console.log('── 담았다 되살리는 한 바퀴 ──');

  // ⑴ 글자와 꾸러미가 섞인 줄 — **하나도 빠지지 않아야 한다**
  {
    const r = await call('POST', '/my-routines', {
      name: '옛 루틴',
      exercises: ['벤치프레스', '스쿼트', { name: '데드리프트', sets: 3, reps: 8 }],
    });
    ok('섞인 줄을 받는다', r.status, 201);
    ok('  ★ 세 줄이 다 남았다', names(r.body?.exercises), ['벤치프레스', '스쿼트', '데드리프트']);
  }

  // ⑵ **전부 글자인 루틴** — 되돌리기가 가장 잘 걸리는 모양이다
  let onlyId = null;
  {
    const r = await call('POST', '/my-routines', { name: '전부 글자', exercises: ['풀업', '딥스'] });
    ok('전부 글자인 루틴도 받는다 (400 이 아니다)', r.status, 201);
    ok('  두 줄이 다 남았다', names(r.body?.exercises), ['풀업', '딥스']);
    onlyId = r.body?.id ?? null;
  }

  // ⑶ 고치기도 같다 — 되돌리기는 `PUT` 으로도 돈다(고친 값 되돌리기)
  if (onlyId) {
    const r = await call('PUT', `/my-routines/${onlyId}`, { name: '전부 글자', exercises: ['풀업', '친업', '딥스'] });
    ok('고치기도 글자 줄을 받는다', r.status, 200);
    ok('  세 줄이 다 남았다', names(r.body?.exercises), ['풀업', '친업', '딥스']);
  }

  // ⑷ **버릴 것은 그대로 버린다** — 이름이 없는 줄은 받을 수 없다(서버가 400 으로 막는다)
  {
    const r = await call('POST', '/my-routines', { name: '빈 줄', exercises: ['', '   '] });
    ok('이름이 빈 글자는 받지 않는다', r.status, 400);
  }

  // ⑸ 목록으로 다시 받아도 그대로인가 — 담은 뒤 읽는 길까지
  {
    const r = await call('GET', '/my-routines');
    const 전부글자 = (r.body || []).find((x) => x.name === '전부 글자');
    ok('다시 받아도 그대로다', names(전부글자?.exercises), ['풀업', '친업', '딥스']);
  }

  await stopServer();
  clean();
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
})().catch(async (e) => {
  console.log('FAIL 터졌습니다 → ' + String(e && e.message || e).slice(0, 200));
  await stopServer();
  clean();
  process.exit(1);
});
