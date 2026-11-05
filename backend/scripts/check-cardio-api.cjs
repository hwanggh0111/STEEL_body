// **유산소 줄이 진짜 서버를 한 바퀴 도는가** (2026-11-05).
//
//   npm run cardioapi     (포트를 쓰므로 `npm run check` 에서는 건너뛴다)
//
// ── 왜 진짜 서버로 보나 ──
//
// 유산소 칸은 **길 전체를 지난다** — 받는 자리 · 담는 자리 · 돌려주는 자리(`slim`) ·
// 고치는 자리 · 내보내기 · 되읽기. 셈만 자로 봐도 **보내고 받는 사이에서 칸이
// 사라지면** 화면에는 「0분」이 뜬다. 그 자리는 진짜 HTTP 로만 드러난다.
//
// 이 앱에서 전에 똑같은 일이 있었다 — 10/31 에 「읽지도 않는 칸을 보내지 않는다」로
// `slim` 을 깎다가 `created_at` 을 뺐고, 그러면 속도를 재는 자(`data/pace.js`)가
// **조용히 없는 기능**이 됐다. 보내는 칸은 **보내보고** 확인한다.
//
// 진짜 DB 도 진짜 포트도 안 건드린다 (`check-odd-api.cjs` 와 같은 방식).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TMP = path.join(ROOT, '.check-cardioapi.json');
let PORT = 4740;
let BASE = '';

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
      VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '', DEV_ECHO_CODE: '1',
    },
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
  for (let p = 4740; p <= 4760; p += 1) {
    try { await fetch(`http://127.0.0.1:${p}/api/health`, { signal: AbortSignal.timeout(400) }); } catch { return p; }
  }
  return 0;
}

const IP = '198.51.100.77';
let TOKEN = '';
async function call(method, url, body) {
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': IP };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(BASE + url, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* 몸통이 없는 답도 있다 */ }
  return { status: res.status, body: json };
}

(async () => {
  PORT = await pickPort();
  if (!PORT) { console.log('FAIL 빈 포트를 못 찾았습니다'); process.exit(1); }
  BASE = `http://127.0.0.1:${PORT}/api`;
  startServer();
  if (!await waitUp()) { console.log('FAIL 서버가 안 떴습니다'); await stopServer(); clean(); process.exit(1); }

  // 계정을 만든다 (가입은 번호를 같이 보낸다 — `check-odd-api` 의 같은 자리 참고)
  const email = `cardio${Date.now()}@odd.local`;
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': IP };
  const sent = await fetch(`${BASE}/auth/send-code`, { method: 'POST', headers, body: JSON.stringify({ email }) });
  const code = (await sent.json())?.code;
  if (!code) {
    console.log('FAIL 인증번호를 못 받았습니다 — DEV_ECHO_CODE=1 로 띄우거나 SMTP 를 빼고 보십시오');
    await stopServer(); clean(); process.exit(1);
  }
  const reg = await fetch(`${BASE}/auth/register`, {
    method: 'POST', headers,
    body: JSON.stringify({ email, password: 'cardio12345678', nickname: '유산소시험', username: `c${Date.now()}`, code }),
  });
  TOKEN = (await reg.json()).token;
  if (!TOKEN) {
    // 토큰이 없으면 아래는 전부 401 이라 **라우터에 닿지도 못한다** — 거짓 통과를 막는다
    console.log(`FAIL 시험 계정을 못 만들었습니다 (${reg.status}) — 아래를 돌려도 뜻이 없습니다`);
    await stopServer(); clean(); process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);

  console.log('── 넣는다 ──');
  // ★ **세트 · 횟수를 안 보낸다.** 여태 그 둘이 필수라서 런닝머신을 적으려면
  //    「1세트 1회」를 지어내야 했다
  const a = await call('POST', '/workouts', { date: today, exercise: '런닝머신', minutes: 32, distance_km: 5.2 });
  ok('**세트 · 횟수 없이 받는다**', a.status, 201);
  ok('  돌려주는 줄에 시간 · 거리가 있다', [a.body?.workout?.minutes, a.body?.workout?.distance_km], [32, 5.2]);
  // 유산소 줄에는 세트 · 횟수를 **담지 않는다** (지어낸 「1세트 1회」가 그 거짓이다)
  ok('  세트 · 횟수는 담지 않는다', [a.body?.workout?.sets ?? null, a.body?.workout?.reps ?? null], [null, null]);

  const only = await call('POST', '/workouts', { date: today, exercise: '달리기', distance_km: 10 });
  ok('거리만 적어도 받는다', [only.status, only.body?.workout?.distance_km], [201, 10]);
  const onlyMin = await call('POST', '/workouts', { date: today, exercise: '줄넘기', minutes: 15 });
  ok('  시간만 적어도 받는다', [onlyMin.status, onlyMin.body?.workout?.minutes], [201, 15]);

  console.log('');
  console.log('── 거절할 것은 거절하고, 까닭을 말한다 ──');
  const z = await call('POST', '/workouts', { date: today, exercise: '런닝머신', minutes: 0 });
  ok('0 분은 거절한다', [z.status, z.body?.error], [400, '시간은 1 이상의 정수(분)로 적어주세요']);
  const big = await call('POST', '/workouts', { date: today, exercise: '런닝머신', minutes: 601 });
  ok('  테두리를 넘으면 그 수를 말해준다', [big.status, big.body?.error], [400, '시간은 600분 이하로 적어주세요']);
  const bigKm = await call('POST', '/workouts', { date: today, exercise: '달리기', distance_km: 501 });
  ok('  거리도', [bigKm.status, bigKm.body?.error], [400, '거리는 500km 이하로 적어주세요']);
  const half = await call('POST', '/workouts', { date: today, exercise: '런닝머신', minutes: 30.5 });
  ok('  30.5분은 안 받는다 (분이 가장 작은 칸이다)', half.status, 400);
  // **근력 줄은 그대로 세트 · 횟수가 필수다** — 유산소 칸을 만들면서 그 문이 열리면 안 된다
  const noSets = await call('POST', '/workouts', { date: today, exercise: '벤치프레스', weight: '80' });
  ok('**근력 줄은 세트 · 횟수가 그대로 필수다**',
    [noSets.status, noSets.body?.error], [400, '날짜, 운동명, 세트, 횟수는 필수에요']);

  console.log('');
  console.log('── 받아 읽는다 ──');
  const list = await call('GET', '/workouts');
  const rows = Array.isArray(list.body) ? list.body : [];
  const run = rows.find((w) => w.exercise === '런닝머신');
  // ★ `slim` 이 칸을 안 보내면 화면에는 **「0분」**이 뜬다 (10/31 의 `created_at` 과 같은 자리)
  ok('**목록에도 시간 · 거리가 실려 온다**', [run?.minutes, run?.distance_km], [32, 5.2]);
  ok('  속도를 재는 칸도 그대로 있다', typeof run?.created_at, 'string');
  const bench = rows.find((w) => w.exercise === '벤치프레스');
  ok('  근력 줄에는 그 칸이 없다', bench, undefined);

  console.log('');
  console.log('── 고친다 ──');
  const up = await call('PUT', `/workouts/${run.id}`, { date: today, exercise: '런닝머신', minutes: 40, distance_km: 6 });
  ok('유산소 줄을 고친다', [up.status, up.body?.workout?.minutes, up.body?.workout?.distance_km], [200, 40, 6]);
  // ★ **두 모양이 한 줄에 같이 남지 않는다** — 읽는 쪽마다 다른 것을 보고 다른 말을 한다
  const back = await call('PUT', `/workouts/${run.id}`, { date: today, exercise: '벤치프레스', weight: '80', sets: 4, reps: 8 });
  ok('**근력 줄로 되돌리면 시간 · 거리가 빠진다**',
    [back.body?.workout?.sets, back.body?.workout?.minutes ?? null, back.body?.workout?.distance_km ?? null], [4, null, null]);
  const again = await call('PUT', `/workouts/${run.id}`, { date: today, exercise: '런닝머신', minutes: 20 });
  ok('  유산소 줄로 다시 고치면 세트 · 횟수가 빠진다',
    [again.body?.workout?.minutes, again.body?.workout?.sets ?? null, again.body?.workout?.reps ?? null], [20, null, null]);

  console.log('');
  console.log('── 내보냈다 되읽는다 ──');
  const csvRes = await fetch(`${BASE}/export/workouts`, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'X-Forwarded-For': IP },
  });
  const csv = await csvRes.text();
  ok('내보내기에 칸 둘이 있다', /시간\(분\),거리\(km\)/.test(csv), true);
  ok('  유산소 줄의 수가 적혀 있다', /런닝머신[^\n]*,20,/.test(csv), true);
  // ★ **내보낸 것을 우리 손으로 거절하면** 「챙겨 나갈 수는 있는데 들고 들어올 수는
  //    없다」가 된다 — 되읽기를 둔 까닭이 그것이다
  const imp = await call('POST', '/import', { kind: 'workouts', csv });
  ok('**되읽으면 한 줄도 안 거절된다**', [imp.status, imp.body?.failed], [200, 0]);
  ok('  이미 있는 줄이라 건너뛴다 (두 벌이 안 쌓인다)', imp.body?.added, 0);

  await stopServer();
  clean();
  console.log('');
  if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
  console.log('유산소 한 바퀴 전부 통과');
})().catch(async (e) => {
  console.log('FAIL 터졌습니다 — ' + (e && e.message));
  await stopServer();
  clean();
  process.exit(1);
});
