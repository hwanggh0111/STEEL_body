// 말도 안 되는 것을 모든 길에 넣어본다 (2026-09-18).
//
//   npm run probe
//
// **찾는 것은 「말없이 터진 것」이다.** 400·401·403·404·429 는 서버가 「안 된다」고
// 말한 것이라 제 일을 한 것이고, **제 말로 이유를 적은 503 도 그렇다**
// (알림 열쇠가 없을 때의 「아직 알림을 보낼 수 없어요」가 그것이다).
// 남는 것이 진짜다 — 아무도 예상 못 한 곳에서 터진 자리. 그 자리는 대개 사람이
// 평범하게 쓰다가도 밟는다 (빈 몸통 · 글자 대신 숫자 · 배열 · 아주 긴 글자).
//
// **전역 제한을 열고 돌린다** — 안 열면 절반이 429 로 막혀서 「500 없음」이 아무것도
// 말해주지 않는다:  RATE_LIMIT_GLOBAL_MAX=100000 npm run probe
//
// **진짜 DB 를 안 건드린다.** 임시 파일로 서버를 따로 띄우고 끝나면 지운다.
// 검사가 아니라 훑는 도구다 — `npm run check` 에 안 넣는다 (서버를 띄우고 수백 번 두드린다).
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const PORT = 4111;
const TMP = path.join(__dirname, '.probe.json');
const BASE = `http://127.0.0.1:${PORT}/api`;
const clean = () => {
  for (const f of [TMP, TMP.replace(/\.json$/, '.photos.json')]) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* 이미 없으면 그만 */ }
  }
};
clean();

// 서버를 따로 띄운다. 전역 제한(분당 100)에 걸리면 429 가 쏟아져 훑는 뜻이 없어지므로
// **제한을 크게 열어둔 채** 띄운다 — 여기서 보는 것은 제한이 아니라 터지는 자리다
const child = spawn(process.execPath, [path.join(__dirname, '../src/index.js')], {
  env: {
    ...process.env,
    PORT: String(PORT),
    DB_FILE: TMP,
    NODE_ENV: 'development',
    RATE_LIMIT_GLOBAL_MAX: '100000',
    JWT_SECRET: process.env.JWT_SECRET || 'probe-secret-probe-secret-probe-secret',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverSaid = '';
child.stdout.on('data', (d) => { serverSaid += d.toString(); });
child.stderr.on('data', (d) => { serverSaid += d.toString(); });

const req = (method, p, { body, token, cookie, headers } = {}) => new Promise((res) => {
  const data = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
  const r = http.request({
    host: '127.0.0.1', port: PORT,
    // 한글이 든 주소도 두드린다 — 그대로 넘기면 http 모듈이 먼저 터진다
    path: encodeURI('/api' + p),
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(headers || {}),
    },
  }, (rr) => {
    let buf = '';
    rr.on('data', (c) => { buf += c; });
    rr.on('end', () => res({ status: rr.statusCode, body: buf.slice(0, 300), cookies: rr.headers['set-cookie'] || [] }));
  });
  r.on('error', () => res({ status: 0, body: 'connect failed', cookies: [] }));
  if (data) r.write(data);
  r.end();
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 넣어볼 것들. **사람이 실수로 만들 수 있는 것부터** 둔다
const NASTY = [
  undefined,                                   // 몸통 없음
  {},                                          // 빈 몸통
  { date: 1, exercise: 2, sets: 'x', reps: [] },
  { date: null, exercise: null },
  { date: '2026-13-45', exercise: { a: 1 } },
  { exercise: 'ㄱ'.repeat(5000), sets: 1e9, reps: -5 },
  { date: '2026-09-18', exercise: ['배열'], weight: { }, sets: 1.5, reps: '3' },
  { kind: 123, csv: 456 },
  { type: ['x'], data: 'glue' },
  '깨진 글자',                                  // JSON 이 아닌 몸통
];

// **이것들은 따로 맨 끝에 넣는다.** AI 가드가 이런 몸통을 보면 그 주소를 막아버려서,
// 같이 섞으면 그 뒤의 두드림이 전부 403 이 되고 훑는 뜻이 없어진다 —
// 막는 것이 제 일을 하는 것이므로 가드를 끄지 않고, 순서만 뒤로 둔다
const GUARDED = [
  { nickname: { $ne: null } },                 // 몽고 흉내 (이 DB 는 파일이지만 모양은 본다)
  { __proto__: { admin: true }, date: '2026-09-18' },
  { exercise: '<script>alert(1)</script>', date: '2026-09-18', sets: 1, reps: 1 },
];

/**
 * 이 답이 「말없이 터진 것」인가.
 *
 * 5xx 라도 **제 말로 이유를 적어 보냈으면** 서버가 판단해서 답한 것이다 —
 * 알림 열쇠가 없을 때의 503 이 그렇다. 그것까지 터진 것으로 세면 도구가 늑대를 부른다.
 */
const blewUp = (r) => {
  if (r.status < 500) return false;
  if (r.status === 503) {
    try { return !JSON.parse(r.body)?.error; } catch { return true; }
  }
  return true;
};

let bad = 0;
let hit = 0;
const found = [];
// 몸통이 없을 수도 있다 — 적는 자리에서 터지면 훑기가 거기서 끝난다
const show = (b) => (b === undefined ? '(몸통 없음)' : JSON.stringify(b) ?? String(b)).slice(0, 80);
// **닿았는지도 세야 뜻이 있다.** 전부 403(CSRF)·401 로 문 앞에서 막혔으면
// 「500 없음」은 아무것도 말해주지 않는다
const tally = new Map();
const note = (s) => tally.set(s, (tally.get(s) || 0) + 1);
const samples = [];
async function shake(method, p, opts = {}) {
  for (const body of (method === 'GET' || method === 'DELETE' ? [undefined] : NASTY)) {
    const r = await req(method, p, { ...opts, body });
    hit += 1;
    note(r.status);
    if (process.env.PROBE_SHOW && r.status >= 400 && r.status < 500 && samples.length < 6) {
      samples.push(`${method} ${p} → ${r.status} ${r.body.slice(0, 90)}`);
    }
    if (blewUp(r)) {
      bad += 1;
      found.push(`${method} ${p} ← ${show(body)} → ${r.status} ${r.body.slice(0, 120)}`);
    }
  }
}

(async () => {
  // 서버가 뜰 때까지 기다린다
  for (let i = 0; i < 60; i++) {
    const h = await req('GET', '/health');
    if (h.status === 200) break;
    await wait(250);
  }

  // 들어가 있는 사람으로도 두드린다 — 로그인 뒤에만 열리는 길이 대부분이다
  const email = `probe${Date.now()}@probe.local`;
  const reg = await req('POST', '/auth/register', {
    body: { email, password: 'probe1234', nickname: '탐침', username: 'probe' + Date.now().toString(36) },
  });
  let token = null;
  let cookie = '';
  try { token = JSON.parse(reg.body).token; } catch { /* 없으면 쿠키로 */ }
  cookie = (reg.cookies || []).map((c) => c.split(';')[0]).join('; ');
  const csrf = (reg.cookies || []).map((c) => c.split(';')[0]).find((c) => c.startsWith('sb_csrf='));
  const headers = csrf ? { 'X-CSRF-Token': csrf.split('=')[1] } : {};
  const asUser = { token, cookie, headers };

  console.log(`── 들어가서 두드린다 (가입: ${reg.status}) ──`);

  const PATHS = [
    ['POST', '/workouts'], ['PUT', '/workouts/1'], ['DELETE', '/workouts/abc'], ['GET', '/workouts/이상한날짜'],
    ['POST', '/inbody'], ['PUT', '/inbody/1'], ['DELETE', '/inbody/0'],
    ['POST', '/measures'], ['DELETE', '/measures/-1'],
    ['POST', '/my-routines'], ['PUT', '/my-routines/1'], ['DELETE', '/my-routines/x'],
    ['POST', '/notes'], ['PUT', '/notes/1'], ['DELETE', '/notes/1'],
    ['POST', '/plans'], ['DELETE', '/plans/1'],
    ['PUT', '/goals'], ['DELETE', '/goals'],
    ['PUT', '/gym-settings'], ['DELETE', '/gym-settings'], ['GET', '/gym-settings?gym=' + 'ㄱ'.repeat(300)],
    ['POST', '/import'],
    ['POST', '/reports'], ['DELETE', '/reports/1'],
    ['POST', '/ratings'], ['GET', '/ratings/me'],
    ['POST', '/photos'], ['DELETE', '/photos/이상한종류'],
    ['POST', '/reminders'], ['PUT', '/reminders'], ['POST', '/reminders/test'],
    ['POST', '/routine-session'], ['PUT', '/routine-session'], ['DELETE', '/routine-session'],
    ['POST', '/faq-gaps'],
    ['POST', '/client-error'],
    ['GET', '/export/workouts'], ['GET', '/export/inbody'], ['GET', '/export/measures'],
    ['PUT', '/auth/nickname'], ['PUT', '/auth/sex'], ['POST', '/auth/password'],
    ['POST', '/auth/login'], ['POST', '/auth/register'], ['POST', '/auth/send-code'],
    ['POST', '/auth/verify-code'], ['POST', '/auth/reset-password'],
    ['POST', '/auth/check-email'], ['POST', '/auth/check-username'],
    ['GET', '/maintenance'], ['PUT', '/maintenance'],
    ['GET', '/site-photos'], ['POST', '/site-photos'], ['PATCH', '/site-photos/1'], ['DELETE', '/site-photos/1'],
    ['GET', '/routines'], ['GET', '/routines/없는갈래'],
    ['GET', '/oauth/providers'], ['POST', '/oauth/google/code'],
  ];

  for (const [method, p] of PATHS) await shake(method, p, asUser);

  // 들어가지 않은 사람으로도 한 바퀴 — 401 이 나와야 하고, 터지면 안 된다
  console.log('── 안 들어간 사람으로도 두드린다 ──');
  for (const [method, p] of PATHS) await shake(method, p, {});

  // 가드를 건드리는 몸통 — 맨 끝에서 한 번씩만
  console.log('── 가드를 건드리는 몸통 (맨 끝에 따로) ──');
  for (const [method, p] of PATHS) {
    if (method === 'GET' || method === 'DELETE') continue;
    for (const body of GUARDED) {
      const r = await req(method, p, { ...asUser, body });
      hit += 1;
      note(r.status);
      if (blewUp(r)) {
        bad += 1;
        found.push(`${method} ${p} ← ${show(body)} → ${r.status} ${r.body.slice(0, 120)}`);
      }
    }
  }

  console.log('');
  console.log(`두드린 횟수 ${hit}`);
  if (samples.length) { console.log('보기:'); for (const x of samples) console.log('  ' + x); }
  console.log('답: ' + [...tally.entries()].sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}번`).join(' · '));
  if (found.length) {
    console.log(`**터진 자리 ${found.length}개** (500 이상)`);
    for (const f of found.slice(0, 40)) console.log('  ' + f);
  } else {
    console.log('터진 자리 없음 — 전부 「안 된다」로 답했다');
  }
  // 서버가 콘솔에 남긴 오류도 같이 본다 (응답은 500 이 아니어도 안에서 터진 자리)
  const cry = serverSaid.split('\n').filter((l) => /TypeError|ReferenceError|Unhandled|ERR_/.test(l));
  if (cry.length) {
    console.log('');
    console.log('서버가 콘솔에 남긴 것:');
    for (const l of cry.slice(0, 20)) console.log('  ' + l.trim().slice(0, 160));
  }

  child.kill();
  await wait(400);
  clean();
  process.exit(bad ? 1 : 0);
})();
