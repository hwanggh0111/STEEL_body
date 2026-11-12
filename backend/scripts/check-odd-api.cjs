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
      VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '',
      // 번호를 응답에 실어 달라고 한다 — 까닭은 `check-shield.cjs` 의 같은 줄에 적어뒀다.
      // SMTP 열쇠가 있는 컴퓨터에서는 이게 없으면 검사가 첫 줄에서 멈춘다
      DEV_ECHO_CODE: '1',
      // **계정별 분당 100 을 연다** (2026-11-12). 이 검사는 한 계정으로 수백 번 두들긴다 —
      // 손잡이를 안 열었을 때 **331 번이 429 로 돌아왔고** 라우터에 닿지도 못한 채
      // 「500 없음」으로 통과했다(401 에서 한 번 밟은 그 모양이다). 운영에는 없는 값이다
      // (`config/security.js` 의 `RATE_LIMIT_GLOBAL_MAX`)
      RATE_LIMIT_GLOBAL_MAX: '1000000' },
      // **`TRUST_PROXY` 는 일부러 안 준다.** 주면 요청이 「바깥」이 되어 계정별 셈
      // (aiGuard 분당 200 · spamCheck 분당 60)이 켜지고 그쪽에서 또 429 가 난다. 안 주면
      // 서버가 `X-Forwarded-For` 를 안 믿어 **모든 요청이 127.0.0.1** 이다 — 아래
      // `nextIp()` 는 그래서 주소를 실제로 바꾸지 못한다. 길마다 따로 선 좁은 제한
      // (아이디 확인 · 비밀번호 찾기 · 바꾸기 — 열 번)은 `pound` 의 `cap` 으로 맞춘다
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
//
// `cap` — **그 길에 따로 선 제한이 좁을 때** 그 수만큼만 보낸다 (2026-11-12). 다 보내면
// 열한 번째부터 429 로 돌아오고, 그것을 「500 없음」으로 세면 안 가본 것을 통과로
// 적는 것이다. 몸통은 고르게 골라서 칸마다 이상한 값이 골고루 들어가게 한다
async function pound(name, method, url, token, fields, cap = 0) {
  currentIp = nextIp();   // 자리마다 새 주소로 — 앞에서 막힌 것이 따라오면 안 된다
  const fails = [];
  let all = [];
  for (const odd of ODD) {
    const v = '__v' in odd ? odd.__v : undefined;
    // 칸마다 이상한 값을 하나씩 넣어본다 (나머지는 비운다)
    all.push(...(fields.length ? fields.map((f) => ({ [f]: v })) : [odd]));
  }
  const total = all.length;
  if (cap && all.length > cap) {
    const step = all.length / cap;
    all = Array.from({ length: cap }, (_, i) => all[Math.floor(i * step)]);
  }
  {
    for (const body of all) {
      const status = await call(method, url, body, token);
      if (status >= 500) fails.push(`${JSON.stringify(body).slice(0, 60)} → ${status}`);
      // 토큰을 들고 갔는데 401 이면 라우터에 못 닿은 것이다 — 시험이 헛돈다
      if (token && status === 401) fails.push('401 — 라우터에 닿지 못했습니다');
      if (status === 429) fails.push('429 — 막혀서 라우터에 닿지 못했습니다');
    }
  }
  const pass = fails.length === 0;
  if (!pass) bad += 1;
  const part = all.length < total ? ` (${total} 중 ${all.length} — 그 길의 제한이 그만큼이다)` : '';
  console.log((pass ? 'OK   ' : 'FAIL ') + name + (pass ? ' → 500 없음' + part : ' → ' + fails.slice(0, 3).join(' · ')));
}

(async () => {
  PORT = await pickPort();
  if (!PORT) { console.log('FAIL 빈 포트를 못 찾았습니다'); process.exit(1); }
  BASE = `http://127.0.0.1:${PORT}/api`;
  startServer();
  if (!await waitUp()) { console.log('FAIL 서버가 안 떴습니다'); await stopServer(); process.exit(1); }

  // **계정을 먼저 만든다.** 두들기고 나서 만들면 그 주소가 이미 막혀 있다.
  //
  // ── 가입은 **번호**를 같이 보내야 한다 ── (2026-10-07 에 고쳤다)
  //
  // 2026-10-02 에 가입에 메일 인증번호를 붙였다. 그때 smoke · seed · probe 는
  // 같이 고쳤는데 **이 검사와 `check-shield` 는 빠졌다.** 그래서 **그날부터 오늘까지
  // 이 검사는 첫 줄에서 멈춰 있었다** — 「이상한 값으로 두들겨도 500 이 안 난다」를
  // 닷새 동안 아무도 안 보고 있었다는 뜻이다.
  //
  // 다행히 이쪽은 **큰 소리로 멈추게** 돼 있었다(아래 `if (!token)`). 조용히
  // 통과하던 `check-shield` 보다는 나았다 — **멈추는 검사가 거짓으로 통과하는
  // 검사보다 낫다.**
  //
  // 내 컴퓨터에서는 SMTP 열쇠가 없거나 `DEV_ECHO_CODE=1` 일 때 번호가 응답에 실려 온다.
  const email = `odd${Date.now()}@odd.local`;
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.5' };
  const sent = await fetch(`${BASE}/auth/send-code`, {
    method: 'POST', headers, body: JSON.stringify({ email }),
  });
  const code = (await sent.json())?.code;
  if (!code) {
    console.log('FAIL 인증번호를 못 받았습니다 — DEV_ECHO_CODE=1 로 띄우거나 SMTP 를 빼고 보십시오');
    await stopServer();
    clean();
    process.exit(1);
  }
  const reg = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password: 'odd12345678', nickname: '이상값시험', username: `o${Date.now()}`, code }),
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
  await pound('아이디 중복 확인', 'POST', '/auth/check-username', null, ['username'], 10);
  await pound('비밀번호 찾기', 'POST', '/auth/reset-password', null, ['email', 'code', 'password'], 10);

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
  await pound('비밀번호 바꾸기', 'PUT', '/auth/password', token, ['currentPassword', 'newPassword'], 10);
  await pound('못 찾은 말', 'POST', '/faq-gaps', token, ['term']);

  // ── **나머지 칸은 멀쩡하고 한 칸만 이상할 때** ── (2026-11-12)
  //
  // 위는 이상한 칸 **하나만** 보내고 나머지를 비운다. 그러면 대개 앞의 「필수에요」
  // 검사에서 돌아가서 **그 칸을 실제로 읽는 줄까지 못 간다.** 그 자리에 둘이 숨어 있었다 —
  //
  //   · `{"toString":1}` 을 숫자 칸에 → `Number(그것)` 이 TypeError → **500** (일곱 자리)
  //   · 날짜에 `["2026-11-01"]` → 정규식은 지나고 `.split` 에서 → **500** (운동 기록 둘)
  //
  // 그래서 **제대로 된 몸통을 깔고** 칸을 하나씩 바꿔 본다. 고치기(PUT)도 여기서 본다
  console.log('');
  console.log('── 다른 칸은 멀쩡할 때 한 칸만 이상하면 ──');
  const made = async (url, body) => {
    const r = await fetch(BASE + url, {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Forwarded-For': currentIp },
    });
    return (await r.json().catch(() => ({})))?.id;
  };
  const wid = await made('/workouts', { date: '2026-11-01', exercise: '벤치', weight: 60, sets: 3, reps: 10 });
  const iid = await made('/inbody', { date: '2026-11-01', height: 175, weight: 70, fat_pct: 15, muscle_kg: 33 });
  const rid = await made('/my-routines', { name: '시험', exercises: [{ name: '벤치', sets: 3, reps: 10 }] });
  if (!wid || !iid || !rid) {
    console.log('FAIL 깔 줄을 못 만들었습니다 — 아래를 돌려도 뜻이 없습니다');
    bad += 1;
  } else {
    const ODD_ON_BASE = [{ toString: 1 }, { valueOf: 1 }, ['2026-11-01'], ['x'], [], {}, null, true];
    const poundOn = async (name, method, url, base) => {
      currentIp = nextIp();
      const fails = [];
      for (const k of Object.keys(base)) {
        for (const v of ODD_ON_BASE) {
          const status = await call(method, url, { ...base, [k]: v }, token);
          if (status >= 500) fails.push(`${k}=${JSON.stringify(v)} → ${status}`);
          if (status === 401 || status === 429) fails.push(`${status} — 라우터에 닿지 못했습니다`);
        }
      }
      if (fails.length) bad += 1;
      console.log((fails.length ? 'FAIL ' : 'OK   ') + name + (fails.length ? ' → ' + fails.slice(0, 3).join(' · ') : ' → 500 없음'));
    };
    await poundOn('운동 기록', 'POST', '/workouts', { date: '2026-11-02', exercise: '스쿼트', weight: 80, sets: 3, reps: 5 });
    await poundOn('유산소 기록', 'POST', '/workouts', { date: '2026-11-02', exercise: '런닝', minutes: 30, distanceKm: 5 });
    await poundOn('운동 고치기', 'PUT', `/workouts/${wid}`, { date: '2026-11-01', exercise: '벤치', weight: 62, sets: 3, reps: 10 });
    await poundOn('인바디', 'POST', '/inbody', { date: '2026-11-03', height: 175, weight: 70, fat_pct: 15, muscle_kg: 33 });
    await poundOn('인바디 고치기', 'PUT', `/inbody/${iid}`, { date: '2026-11-01', height: 175, weight: 71, fat_pct: 15, muscle_kg: 33 });
    await poundOn('목표', 'PUT', '/goals', { weeklyTarget: 3, weightTarget: 70, weightStart: 75 });
    await poundOn('별점', 'POST', '/ratings', { score: 5, comment: '좋아' });
    await poundOn('루틴 진행표', 'POST', '/routine-session', { routineId: rid });
    await poundOn('루틴 진행표 고치기', 'PATCH', '/routine-session', { index: 0, state: 'done', setsDone: 1 });
  }

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
