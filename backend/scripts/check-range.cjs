// **테두리가 진짜로 길에 꽂혀 있는가** (2026-10-31)
//
//   npm run range     (npm run check 가 찾아서 돈다)
//
// ── 왜 ──
//
// `npm run bounds` 는 거절하는 **자**를 떼어내 본다(`utils/setRange.js` ·
// `utils/measureRange.js`). 그 자가 맞아도 **길에 안 꽂혀 있으면 아무 일도
// 안 일어난다** — 10/28 에 「검사가 틀린 코드를 글자로 지킬 수 있다」고 적은
// 그 자리다. 그래서 여기서는 **진짜 서버를 띄워 진짜로 두드린다.**
//
// 두 자리를 본다 —
//
//   · **루틴의 세트 · 횟수** — 「999999세트」를 담으면 그 루틴을 시작한 운동
//     화면이 세트 단추를 **구십구만 개** 그린다(폰이 멈춘다)
//   · **측정 기록의 값** — 서버는 종류 · 날짜 · 10KB 만 보고 담았다. 허리둘레 0 에서
//     나온 `Infinity`(JSON 으로는 `null`)와 푸시업 999999 가 그대로 들어왔고,
//     그 값으로 화면이 그래프를 그리고 **말을 짓는다**
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
    DB_FILE: path.join(__dirname, '.check-range.json'),
    PHOTOS_FILE: path.join(__dirname, '.check-range.photos.json'),
    RATE_LIMIT_GLOBAL_MAX: '100000',
    // 서른두 자가 넘어야 서버가 뜬다 (`index.js` 가 그 자리에서 멈춘다)
    JWT_SECRET: 'check-range-secret-0123456789-abcdefghijklmnop',
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

    // ── 측정 기록의 값 ──
    console.log('');
    const m = (type, data) => call('POST', '/measures', { type, date: '2026-10-30', data });

    const neg = await m('bodySize', { chest: -95 });
    ok('가슴둘레 -95 는 400 으로 막는다', neg.status, 400);
    ok('  칸 이름을 사람 말로 적는다', /가슴둘레/.test(String(neg.data?.error)), true);

    ok('둘레 999999 도 막는다', (await m('bodySize', { chest: 999999 })).status, 400);
    ok('푸시업 999999 도 막는다', (await m('fitness', { pushup: 999999 })).status, 400);
    ok('1RM 99999kg 도 막는다', (await m('oneRM', { exercise: '벤치프레스', weight: 99999, reps: 5, orm: 112499 })).status, 400);
    // 0 으로 나눈 값. **JSON 을 지나면 `Infinity` 는 `null` 이 된다** —
    // 그래서 화면이 막는 것이 먼저이고, 서버는 **허리둘레 0** 에서 잡는다
    ok('허리둘레 0 을 막는다', (await m('shoulder', { shoulder: 45, waist: 0, ratio: null })).status, 400);

    // **멀쩡한 것은 들어가야 한다**
    const good = await m('bodySize', { chest: 95, waist: 78 });
    ok('멀쩡한 둘레는 201', good.status, 201);
    // **유연성은 음수가 뜻이 있다** — 손끝이 발끝에 못 닿으면 -10cm 다
    const flex = await m('flexibility', { sitreach: -12, squat_depth: 0 });
    ok('유연성 -12cm 는 들어간다', flex.status, 201);
    // 스톱워치는 수가 아닌 칸을 같이 보낸다 — 그것으로 막혀서는 안 된다
    const sw = await m('stopwatch', { time: 5000, formatted: '00:05.0', laps: ['00:02.0'] });
    ok('스톱워치의 글자 칸은 안 본다', sw.status, 201);

    for (const r of [good, flex, sw]) {
      if (r.data?.id) await call('DELETE', `/measures/${r.data.id}`);
    }

    // ── 목표: **담긴 값이 목표를 못 세우게 막지 않는가** ── (2026-10-31)
    //
    // 인바디는 체중 1~500kg 을 담는데 목표 쪽은 20~300 만 받았고, **시작값도
    // 같은 자로 쟀다.** 목표 화면은 처음 세울 때 그 사람의 최근 인바디 값을
    // **시작값으로 자동으로 실어 보낸다** — 그래서 체중을 7 로 잘못 적어둔 사람은
    // 「시작 체중을 확인해 주세요」로 **목표를 하나도 세울 수 없었다.**
    // 그 화면에는 체중 칸이 없다
    console.log('');
    const inb = await call('POST', '/inbody', { date: '2026-10-30', weight: 7, height: 170 });
    ok('인바디는 체중 7kg 을 담는다', inb.status, 201);
    const goal = await call('PUT', '/goals', { weeklyTarget: 3, weightTarget: 70, weightStart: 7 });
    ok('그 값이 시작값으로 와도 목표가 세워진다', goal.status, 200);
    ok('  주 3회가 담겼다', goal.data?.weeklyTarget, 3);
    // **목표값은 여전히 좁다** — 목표 7kg 을 앱이 거들 까닭이 없다
    const low = await call('PUT', '/goals', { weightTarget: 7 });
    ok('목표 체중 7kg 은 막는다', low.status, 400);
    ok('  까닭을 말한다', /20~300/.test(String(low.data?.error)), true);

    // ── 아이디: **세 길이 같은 말을 하는가** ── (2026-10-31)
    //
    // 같은 정규식이 중복 확인 · 가입 · 바꾸기에 따로 적혀 있었고 **거절 문구가
    // 셋 다 달랐다** — 하나는 특수문자를 안 적었다. 중복 확인에서 들은 말과
    // 가입에서 들은 말이 다르면, 사람은 무엇이 규칙인지 알 수 없다
    console.log('');
    const bad아이디 = '한글아이디';
    const dup = await call('POST', '/auth/check-username', { username: bad아이디 });
    const regBad = await call('POST', '/auth/register', {
      email: `x${Date.now() % 100000}@check.local`, password: 'check12345',
      nickname: '아이디검사', username: bad아이디, code: '000000',
    });
    const putBad = await call('PUT', '/auth/username', { username: bad아이디 });
    ok('셋 다 400 으로 막는다', [dup.status, regBad.status, putBad.status], [400, 400, 400]);
    ok('  거절하는 말이 셋 다 같다',
      [dup.data?.error, regBad.data?.error, putBad.data?.error].filter((m, i, a) => a.indexOf(m) === i).length, 1);
    ok('  어디까지 되는지 말한다', /4~20/.test(String(dup.data?.error)), true);
    // 짧은 것 · 쓸 수 없는 글자도 같은 자가 본다
    ok('3자는 막는다', (await call('POST', '/auth/check-username', { username: 'abc' })).status, 400);
    ok('21자는 막는다', (await call('POST', '/auth/check-username', { username: 'a'.repeat(21) })).status, 400);
    ok('멀쩡한 아이디는 통과', (await call('POST', '/auth/check-username', { username: 'good_id-01' })).status, 200);

    // ── 비밀번호: **세 길이 같은 말을 하는가** ── (2026-10-31)
    //
    // 가입 · 찾기 · 바꾸기가 길이와 글자 조합을 **각각 두 줄씩** 적고 있었다.
    // 다 같은 수였으니 틀린 데는 없었지만 **틀릴 자리가 여섯**이었다 —
    // 10/28 에 서버 셋을 묶으면서 화면 셋을 안 본 그 모양이다
    console.log('');
    const shortPw = await call('POST', '/auth/register', {
      email: `p${Date.now() % 100000}@check.local`, password: 'ab1',
      nickname: '비번검사', username: `pw${Date.now() % 100000}`, code: '000000',
    });
    ok('짧은 비밀번호는 400', shortPw.status, 400);
    ok('  8~100 을 말한다', /8~100/.test(String(shortPw.data?.error)), true);

    const lettersOnly = await call('PUT', '/auth/password', {
      currentPassword: 'check12345', newPassword: 'aaaaaaaaaa',
    });
    ok('숫자 없는 새 비밀번호는 400', lettersOnly.status, 400);
    ok('  영문+숫자를 말한다', /영문\+숫자/.test(String(lettersOnly.data?.error)), true);
    // **말머리가 자리마다 맞아야 한다** — 바꾸기는 「새 비밀번호는」이다
    ok('  바꾸기는 「새 비밀번호는」으로 말한다', /^새 비밀번호는/.test(String(lettersOnly.data?.error)), true);
    ok('  가입은 「비밀번호는」으로 말한다', /^비밀번호는/.test(String(shortPw.data?.error)), true);
    // 찾기도 같은 자를 든다 (번호가 틀려 거절되기 **전에** 비밀번호를 본다)
    const reset = await call('POST', '/auth/reset-password', {
      email: 'nobody@check.local', code: '000000', newPassword: 'aaaaaaaaaa',
    });
    ok('찾기도 숫자 없는 것을 막는다', [reset.status, /영문\+숫자/.test(String(reset.data?.error))], [400, true]);

    // ── 계획: **같은 날 같은 것을 두 번 담지 않는다** ── (2026-10-31)
    //
    // 서버는 막는다. 그런데 그 줄 위에 **「눌린 줄 모르고 또 누르는 자리다」**라고
    // 적어두고 **눌러야 알려줬다** — 달력의 루틴 이름표 넷이 나란히 있고 그중
    // 하나는 이미 담겨 있는데 겉모습이 똑같았다. 화면이 미리 흐리게 하고,
    // 서버는 그대로 막는다(두 자가 어긋날 수 있어 서버 말을 지우지 않는다)
    console.log('');
    const p1 = await call('POST', '/plans', { date: '2026-11-02', kind: 'exercise', name: '벤치프레스' });
    ok('계획을 담았다', p1.status, 201);
    const p2 = await call('POST', '/plans', { date: '2026-11-02', kind: 'exercise', name: '벤치프레스' });
    ok('같은 날 같은 것은 막는다', p2.status, 400);
    ok('  까닭을 말한다', /이미 담겨/.test(String(p2.data?.error)), true);
    // **다듬은 뒤의 이름으로 본다** — 공백만 다른 것은 같은 것이다
    const p3 = await call('POST', '/plans', { date: '2026-11-02', kind: 'exercise', name: '  벤치프레스  ' });
    ok('앞뒤 공백만 다른 것도 같은 것으로 본다', p3.status, 400);
    const p4 = await call('POST', '/plans', { date: '2026-11-03', kind: 'exercise', name: '벤치프레스' });
    ok('다른 날에는 담긴다', p4.status, 201);
    for (const r of [p1, p4]) if (r.data?.id) await call('DELETE', `/plans/${r.data.id}`);

    // 화면이 **미리** 흐리게 하는지 (글자로 본다 — 눌러보는 자리가 아니다)
    const daySheet = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'frontend', 'src', 'components', 'DaySheet.jsx'), 'utf8');
    ok('달력이 담긴 것을 미리 가린다', /담겼나\(r\.name\)/.test(daySheet), true);

    // ── 헬스장: **서버가 담은 이름을 화면이 쓰는가** ── (2026-10-31)
    //
    // 「지금 있는 곳」은 이 기기에만 있고 사람이 치는 글자다. 그런데 세팅을 담을 때
    // 그 이름이 서버로 가고, 서버는 **다듬어서** 담는다(가운데 공백 줄이기 ·
    // `<>"'&` 걷기). 화면이 날글을 든 채로 있으면 **칩 줄에 같은 곳이 둘로 보이고**
    // 「여기 세팅」이 빈다 — 10/28 에 루틴 이름에서 겪은 그 자리다
    console.log('');
    const gs = await call('PUT', '/gym-settings', { gym: '강남   점', exercise: '랫풀다운', seat: '3' });
    ok('세팅을 담았다', gs.status, 200);
    ok('  서버는 다듬은 이름을 돌려준다', gs.data?.gym, '강남 점');
    const gs2 = await call('PUT', '/gym-settings', { gym: '<집앞>', exercise: '벤치프레스', seat: '2' });
    ok('  꺾쇠도 걷어서 돌려준다', gs2.data?.gym, '집앞');
    // **화면이 그 이름을 쓰는가** (글자로 본다 — 스토어를 띄우는 자리가 아니다)
    const gymStore = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'frontend', 'src', 'store', 'gymStore.js'), 'utf8');
    ok('  화면이 돌려받은 이름으로 맞춘다', /data\.gym !== get\(\)\.gym/.test(gymStore), true);
    await call('DELETE', '/gym-settings', undefined);

    await call('DELETE', '/goals');
    if (inb.data?.id) await call('DELETE', `/inbody/${inb.data.id}`);

    await call('POST', '/auth/delete', { password: 'check12345' });
  } catch (e) {
    bad += 1;
    console.log('FAIL 돌리다 터졌다 →', e.message);
  }

  stop();
  for (const f of ['.check-range.json', '.check-range.photos.json']) {
    try { require('fs').unlinkSync(path.join(__dirname, f)); } catch { /* 없으면 그만 */ }
  }
  console.log('');
  console.log(bad === 0 ? '전부 통과' : bad + '건 실패');
  process.exit(bad === 0 ? 0 : 1);
})();
