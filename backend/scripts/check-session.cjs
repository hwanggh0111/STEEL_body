// 루틴 진행표가 **한 것과 넘긴 것을 가르는가** (2026-10-27)
//
//   npm run session     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 진행표는 칸마다 셋 중 하나다 — `todo` · `done` · `skip`. 그런데 서버가 보내는
// 수는 **「지나간 칸」 하나뿐**이었다(`done` = 한 것 + 넘긴 것). 진행 막대는 그게
// 맞지만, 홈의 「진행 중」 카드가 그 수에 **「완료」**를 붙여 적고 있었다 —
// 여덟 중 셋을 건너뛰면 **「8 / 8 완료」**다.
//
// 「운동」 화면은 같은 칸을 **줄을 그어 「건너뜀」**이라고 적는다. **두 화면이
// 같은 것을 다르게 말하고 있었다.** 10/26 에 홈트에서 정한 선과 같은 자리다 —
// 넘긴 것은 「한 것」이 아니다.
//
// 눈으로 잡기 어려운 까닭: 건너뛰는 사람이 드물고, 건너뛴 그 순간에는 화면이
// 바로 다음 칸으로 넘어간다. 홈으로 돌아와야 보이고, 그때는 숫자가 그럴듯하다.
//
// **진짜 서버를 띄워 진짜로 두드린다** — 가입 → 루틴 → 시작 → 하나 하고 하나 넘김.
const { spawn } = require('child_process');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const PORT = 4311;
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
    DB_FILE: path.join(__dirname, '.check-session.json'),
    PHOTOS_FILE: path.join(__dirname, '.check-session.photos.json'),
    RATE_LIMIT_GLOBAL_MAX: '100000',
    // 서른두 자가 넘어야 서버가 뜬다 (`index.js` 가 그 자리에서 멈춘다)
    JWT_SECRET: 'check-session-secret-0123456789-abcdefghijklmnop',
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

  const email = `sess${Date.now() % 100000}@check.local`;
  try {
    // 가입은 **메일로 받은 번호**를 같이 보내야 통과한다. 검사용으로 번호를
    // 응답에 실어 달라고 한다(`DEV_ECHO_CODE`) — `smoke` 가 쓰는 그 길이다
    const sent = await call('POST', '/auth/send-code', { email });
    ok('인증번호를 받았다', sent.status, 200);
    const code = sent.data?.code;
    if (!code) throw new Error('번호를 못 받았다 (SMTP 가 켜져 있으면 메일로만 간다)');

    const reg = await call('POST', '/auth/register', {
      email, password: 'check12345', nickname: '진행표검사', username: `sess${Date.now() % 100000}`, code,
    });
    token = reg.data?.token || '';
    ok('들어갔다', [reg.status, !!token], [201, true]);
    if (!token) throw new Error('토큰을 못 받았다 — ' + JSON.stringify(reg.data).slice(0, 120));

    // 루틴 넷
    const made = await call('POST', '/my-routines', {
      name: '진행표 검사',
      exercises: [
        { name: '벤치프레스', sets: '3세트', reps: '10회' },
        { name: '스쿼트', sets: '3세트', reps: '10회' },
        { name: '데드리프트', sets: '3세트', reps: '8회' },
        { name: '풀업', sets: '3세트', reps: '8회' },
      ],
    });
    ok('루틴을 만들었다', made.status, 201);
    const routineId = made.data?.routine?.id ?? made.data?.id;

    const started = await call('POST', '/routine-session', { routineId });
    ok('진행표를 시작했다', started.status, 201);
    ok('  넷 다 아직 안 했다', [started.data.session.done, started.data.session.completed,
      started.data.session.skipped, started.data.session.total], [0, 0, 0, 4]);

    // 첫째는 **한다**
    const a = await call('PATCH', '/routine-session', { index: 0, state: 'done' });
    ok('하나 했다', [a.data.session.done, a.data.session.completed, a.data.session.skipped], [1, 1, 0]);

    // 둘째 · 셋째는 **넘긴다**
    await call('PATCH', '/routine-session', { index: 1, state: 'skip' });
    const c = await call('PATCH', '/routine-session', { index: 2, state: 'skip' });
    console.log('');
    ok('지나간 칸은 셋', c.data.session.done, 3);
    ok('  그중 **한 것은 하나**', c.data.session.completed, 1);
    ok('  **넘긴 것은 둘**', c.data.session.skipped, 2);
    ok('  다음 칸은 넷째', c.data.session.current, 3);

    // 홈 카드가 적는 글자 — 「4 / 4 완료」가 아니라 「1 / 4 완료 · 2 건너뜀」이어야 한다
    const s = c.data.session;
    ok('홈 카드가 적을 글자', `${s.completed} / ${s.total} 완료 · ${s.skipped} 건너뜀`,
      '1 / 4 완료 · 2 건너뜀');

    // 마지막을 넘기면 끝난다 — **다 넘겨도 끝은 끝이다**
    const end = await call('PATCH', '/routine-session', { index: 3, state: 'skip' });
    ok('마지막까지 지나가면 끝난다', [end.data.finished, end.data.session], [true, null]);
    ok('  끝낸 진행표는 남지 않는다', (await call('GET', '/routine-session')).data.session, null);

    // 치운다
    await call('DELETE', `/my-routines/${routineId}`);
    await call('POST', '/auth/delete', { password: 'check12345' });
  } catch (e) {
    bad += 1;
    console.log('FAIL 돌리다 터졌다 →', e.message);
  }

  stop();
  // 검사용 파일을 치운다
  for (const f of ['.check-session.json', '.check-session.photos.json']) {
    try { require('fs').unlinkSync(path.join(__dirname, f)); } catch { /* 없으면 그만 */ }
  }
  console.log(bad === 0 ? '\n전부 통과' : `\n${bad}건 실패`);
  process.exit(bad === 0 ? 0 : 1);
})();
