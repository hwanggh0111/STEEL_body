// 뜰 때 **식은 것을 걷는가** (2026-10-13)
//
//   npm run sweep     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 청소는 다섯 가지다 — 만료된 refresh token · 지날 때가 지난 차단 · 식은 로그인
// 실패 · 다 쓴 인증번호 · 유예가 끝난 계정.
//
// 그런데 **계정 하나만 뜰 때 돌았고**, 나머지 넷은 30분 타이머에만 걸려 있었다.
// 이 앱이 사는 곳(Render 무료 판)은 **15분만 놀면 잠든다.** 30분 타이머가 울리려면
// 서버가 30분을 내리 깨어 있어야 하는데, 그러려면 15분 안에 계속 사람이 와야 한다.
// 배포하면 또 새로 뜬다. 그러니까 **저 넷은 배포본에서 거의 한 번도 안 돌았다.**
//
// 눈으로는 확인할 수 없는 자리다 — 30분을 기다려야 하고, 기다리는 동안 잠들면
// 영영 안 울린다. 그래서 **값으로 본다.**
//
// ── 어떻게 보나 ──
//
// 식은 값을 심은 임시 DB 로 서버를 띄우고, 몇 초 뒤에 그 파일을 다시 읽는다.
// 30분을 기다리지 않고도 「뜰 때 걷혔는가」를 알 수 있다 — 걷혔다면 뜰 때 건 것이다.

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TMP = path.join(os.tmpdir(), `check-sweep-${process.pid}.json`);
const PORT = 4219;

const 하루 = 24 * 60 * 60 * 1000;
const now = Date.now();
const 아주전 = new Date(now - 40 * 하루).toISOString();

// ── 식은 값을 심는다 ──
//
// 날짜만 지난 것들이다. 살아 있는 값도 한 줄씩 같이 두어 **그것까지 걷어가지는
// 않는지**를 본다 — 다 지우는 코드도 이 검사를 통과하면 안 된다.
const seed = {
  _nextId: { users: 100 },
  users: [
    // 유예가 끝난 계정 (30일 지남)
    { id: 51, username: 'gone51', email: 'gone51@sweep.local', password: 'x', delete_due_at: new Date(now - 10 * 하루).toISOString() },
    // 아직 유예 안에 있는 계정 (3일 전에 예약 → 27일 남음)
    { id: 52, username: 'keep52', email: 'keep52@sweep.local', password: 'x', delete_due_at: new Date(now + 27 * 하루).toISOString() },
    // 평범한 계정
    { id: 53, username: 'live53', email: 'live53@sweep.local', password: 'x' },
  ],
  refreshTokens: [
    // **`token` 이 아니라 `token_hash` 다.** 처음에 `token` 으로 심었더니 살아 있는
    // 줄까지 사라져서 코드를 의심했다 — `dropLegacyRefreshTokens` 가 `token_hash` 가
    // 없는 줄을 「못 알아보는 옛 줄」로 보고 버린 것이었다 (그게 맞는 일이다)
    { token_hash: 'deadhash', user_id: 53, expires_at: 아주전 },
    { token_hash: 'alivehash', user_id: 53, expires_at: new Date(now + 7 * 하루).toISOString() },
  ],
  verifyCodes: [
    { email: 'cold@sweep.local', code: '111111', createdAt: 아주전, expiresAt: 아주전 },
  ],
  loginFails: [
    { ip: '10.0.0.1', count: 3, last: now - 3 * 하루 },
    { ip: '10.0.0.2', count: 1, last: now },
  ],
  blocks: [
    { ip: '10.0.0.9', until: new Date(now - 하루).toISOString(), reason: '식은 차단' },
  ],
  workouts: [], inbody: [], measures: [], myRoutines: [], notices: [], photos: [],
  suspensions: [], blacklist: [], reports: [], abuseLogs: [], ratings: [],
  reminders: [], pushSubs: [], routineSessions: [], plans: [], clientErrors: [],
  notes: [], goals: [], gymSettings: [], faqGaps: [],
};

// **심은 값이 DB 가 보는 이름인지 먼저 본다.** 처음에 `deleteAt` · `expiresAt` 으로
// 심었다가 둘 다 어긋났다 — 실제 이름은 `delete_due_at` · `expires_at` 이다.
// 이름이 틀리면 「살아 있는 줄까지 걷혔다」로 보여서 **코드를 의심하게 된다.**
// 그래서 이 검사가 보는 이름을 코드에서 직접 확인한다
const dbSrc = fs.readFileSync(path.join(ROOT, 'src/db.js'), 'utf8');
for (const 이름 of ['delete_due_at', 'expires_at', 'token_hash']) {
  if (!dbSrc.includes(이름)) {
    console.log(`FAIL db.js 에 ${이름} 가 없다 — 이 검사가 심는 이름이 낡았다`);
    process.exit(1);
  }
}

fs.writeFileSync(TMP, JSON.stringify(seed), 'utf8');

let fail = 0;
const ok = (label, got, want) => {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (!good) fail += 1;
  console.log(`${good ? 'OK  ' : 'FAIL'} ${label} -> ${JSON.stringify(got)}${good ? '' : ` (기대: ${JSON.stringify(want)})`}`);
};

function waitHealth(child) {
  return new Promise((done, nope) => {
    const guard = setTimeout(() => { clearInterval(poll); nope(new Error('20초 안에 안 떴다')); }, 20000);
    const poll = setInterval(() => {
      http.get({ host: 'localhost', port: PORT, path: '/api/health' }, (r) => {
        r.resume();
        if (r.statusCode === 200) { clearInterval(poll); clearTimeout(guard); done(); }
      }).on('error', () => { /* 아직 */ });
    }, 50);
    child.on('exit', (code) => { clearInterval(poll); clearTimeout(guard); nope(new Error('서버가 죽었다 (code ' + code + ')')); });
  });
}

(async () => {
  console.log('── 뜰 때 식은 것을 걷는가 ──');
  // `DATABASE_URL` 을 지운다 — 있으면 `DB_FILE` 이 있어도 그쪽으로 간다 (boot.cjs 와 같다)
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_FILE: TMP, DATABASE_URL: '', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});

  try {
    await waitHealth(child);
    // 뜨는 시간에 얹지 않으려고 2.5초 뒤에 걷는다 — 그보다 넉넉히 기다린다.
    // **30분이 아니라 몇 초 안에** 걷혀야 한다는 것이 이 검사의 요점이다
    await new Promise((r) => setTimeout(r, 5000));

    const after = JSON.parse(fs.readFileSync(TMP, 'utf8'));
    const ids = (after.users || []).map((u) => u.id).sort((a, b) => a - b);

    ok('  만료된 refresh token 을 걷었다', (after.refreshTokens || []).map((t) => t.token_hash), ['alivehash']);
    ok('  다 쓴 인증번호를 걷었다', (after.verifyCodes || []).length, 0);
    ok('  지날 때가 지난 차단을 걷었다', (after.blocks || []).length, 0);
    ok('  식은 로그인 실패 줄을 걷었다', (after.loginFails || []).map((f) => f.ip), ['10.0.0.2']);
    ok('  유예가 끝난 계정을 지웠다', ids.includes(51), false);
    ok('  아직 유예 안인 계정은 그대로다', ids.includes(52), true);
    ok('  평범한 계정은 그대로다', ids.includes(53), true);
  } catch (e) {
    fail += 1;
    console.log('FAIL 서버를 못 띄웠다 ->', e.message);
  } finally {
    child.kill();
    try { fs.unlinkSync(TMP); } catch { /* 지워져 있으면 그만 */ }
  }

  console.log('');
  if (fail) {
    console.log(`${fail}건이 안 걷혔습니다 — 30분 타이머만 믿으면 안 됩니다 (15분이면 잠듭니다).`);
    process.exit(1);
  }
  console.log('뜰 때 다섯을 다 걷습니다');
})();
