// **루틴의 세트 · 횟수가 진짜로 막히는가** (2026-10-31)
//
//   npm run setrange     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 루틴 폼의 세트 · 회 칸에는 테두리가 하나도 없었고, 서버도 sets · reps 를 **아예
// 안 봤다** — `{ ...ex }` 로 받은 것을 그대로 담았다. 그래서 「999999세트」가 담겼고,
// 그 루틴을 시작하면 운동 화면이 세트 단추를 **구십구만 개** 그린다(폰이 멈춘다).
//
// `npm run bounds` 는 거절하는 **자**(`utils/setRange.js`)를 떼어내 본다. 그 자가
// 맞아도 **길에 안 꽂혀 있으면** 아무 일도 안 일어난다 — 10/28 에 「검사가 틀린
// 코드를 글자로 지킬 수 있다」고 적은 그 자리다. 그래서 여기서는 **진짜 서버를
// 띄워 진짜로 두드린다**: 999999 로 만들기 · 고치기 · 글로 적힌 것은 통과.
const { spawn } = require('child_process');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const PORT = 4313;
const BASE = `http://127.0.0.1:${PORT}/api`;
// 사람 UA 로 두드린다 — 가드가 도구를 막는다
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';

let token = '';
const call = async (method, p, body) => {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* 몸통이 없을 수 있다 */ }
  return { status: res.status, data };
};

(async () => {
  const env = {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'test',
    // 검사 계정이 제 기록을 만들고 지운다. 본 DB 를 안 건드리게 딴 파일을 쓴다
    DB_FILE: path.join(__dirname, '.check-setrange.json'),
    PHOTOS_FILE: path.join(__dirname, '.check-setrange.photos.json'),
    RATE_LIMIT_GLOBAL_MAX: '100000',
    // 서른두 자가 넘어야 서버가 뜬다 (`index.js` 가 그 자리에서 멈춘다)
    JWT_SECRET: 'check-setrange-secret-0123456789-abcdefghijklmnop',
    // 번호를 응답에 실어 달라고 한다 (`check-shield` 머리글에 까닭이 적혀 있다)
    DEV_ECHO_CODE: '1',
    VAPID_PUBLIC_KEY: '',
    VAPID_PRIVATE_KEY: '',
  };
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'index.js')], {
    cwd: path.join(__dirname, '..'),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  srv.stdout.on('data', (d) => { if (process.env.SESSION_DEBUG) process.stdout.write('[서버] ' + d); });
  srv.stderr.on('data', (d) => { if (process.env.SESSION_DEBUG) process.stderr.write('[서버] ' + d); });

  const stop = () => { try { srv.kill(); } catch { /* 이미 죽었다 */ } };
  process.on('exit', stop);

  // **떴는지는 두드려서 본다** — stdout 한 줄을 기다리면 그 줄이 바뀌는 날 멈춘다
  let up = false;
  for (let i = 0; i < 150 && !up; i += 1) {
    try { up = (await fetch(`${BASE}/health`)).ok; } catch { /* 아직 */ }
    if (!up) await new Promise((r) => setTimeout(r, 100));
  }
  if (!up) { console.log('FAIL 서버가 안 떴다'); stop(); process.exit(1); }

  const email = `rng${Date.now() % 100000}@check.local`;
  try {
    const sent = await call('POST', '/auth/send-code', { email });
    ok('인증번호를 받았다', sent.status, 200);
    const code = sent.data?.code;
    if (!code) throw new Error('번호를 못 받았다 (SMTP 가 켜져 있으면 메일로만 간다)');

    const reg = await call('POST', '/auth/register', {
      email, password: 'check12345', nickname: '테두리검사', username: `rng${Date.now() % 100000}`, code,
    });
    token = reg.data?.token || '';
    ok('들어갔다', [reg.status, !!token], [201, true]);
    if (!token) throw new Error('토큰을 못 받았다 — ' + JSON.stringify(reg.data).slice(0, 120));

    // ── 만들기 ──
    const big = await call('POST', '/my-routines', {
      name: '테두리 검사', exercises: [{ name: '벤치프레스', sets: '999999', reps: '10' }],
    });
    ok('999999세트는 400 으로 막는다', big.status, 400);
    ok('  어느 줄인지 말한다', /벤치프레스/.test(String(big.data?.error)), true);

    const zero = await call('POST', '/my-routines', {
      name: '테두리 검사', exercises: [{ name: '벤치프레스', sets: '0', reps: '10' }],
    });
    ok('0세트도 막는다', zero.status, 400);

    const manyReps = await call('POST', '/my-routines', {
      name: '테두리 검사', exercises: [{ name: '벤치프레스', sets: '3', reps: '1001' }],
    });
    ok('1001회도 막는다', manyReps.status, 400);

    // **글로 적힌 것은 통과해야 한다** — 추천 프로그램이 이렇게 적는다
    const made = await call('POST', '/my-routines', {
      name: '테두리 검사', exercises: [{ name: '벤치프레스', sets: '4세트', reps: '10~12회' }],
    });
    ok("'4세트' · '10~12회' 는 통과", made.status, 201);
    const id = made.data?.id;

    // ── 고치기도 같은 자를 드는가 ── (한쪽만 고치는 일이 이 앱의 단골이다)
    const put = await call('PUT', `/my-routines/${id}`, {
      exercises: [{ name: '스쿼트', sets: '999999', reps: '10' }],
    });
    ok('고치기도 999999세트를 막는다', put.status, 400);

    // ── 진행표로 넘어가는 수도 테두리 안인가 ──
    const started = await call('POST', '/routine-session', { routineId: id });
    ok('진행표를 시작했다', started.status, 201);
    ok('  담긴 세트 수는 4', started.data?.session?.items?.[0]?.sets, 4);
    ok('  담긴 횟수는 10', started.data?.session?.items?.[0]?.reps, 10);

    await call('DELETE', '/routine-session');
    await call('DELETE', `/my-routines/${id}`);
    await call('POST', '/auth/delete', { password: 'check12345' });
  } catch (e) {
    bad += 1;
    console.log('FAIL 돌리다 터졌다 →', e.message);
  }

  stop();
  for (const f of ['.check-setrange.json', '.check-setrange.photos.json']) {
    try { require('fs').unlinkSync(path.join(__dirname, f)); } catch { /* 없으면 그만 */ }
  }
  console.log('');
  console.log(bad === 0 ? '전부 통과' : bad + '건 실패');
  process.exit(bad === 0 ? 0 : 1);
})();
