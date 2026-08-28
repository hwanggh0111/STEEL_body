// 앱 한 바퀴. 사람이 실제로 하는 순서 그대로 서버를 두들긴다.
//
//   cd backend && npm start          (다른 창에서 서버를 띄워두고)
//   cd backend && npm run smoke
//
// `npm run check` 는 서버 없이 도는 순수 계산을 본다. 이쪽은 **서버가 실제로 답하는지**를
// 본다 — 가입 · 인바디 · 루틴 · 진행표 · 기록 · 측정 · 내보내기 · 제보 · 알림.
// 화면을 하나씩 눌러보기 전에 이걸 먼저 돌리면, 안 되는 것이 화면 문제인지 서버 문제인지
// 바로 갈린다.
//
// **검사 계정을 하나 만들고, 끝나면 지운다.** 지우는 것은 DB 파일을 직접 손대는 방식이라
// 로컬에서만 된다 — 배포된 곳을 두들기려면 `SMOKE_BASE` 를 바꾸고 `--keep` 을 준다
// (그때는 만든 계정이 남으니 관리자 화면에서 지운다).
const fs = require('fs');
const path = require('path');

const BASE = process.env.SMOKE_BASE || 'http://localhost:4000/api';
const KEEP = process.argv.includes('--keep');
const DB_PATH = path.join(__dirname, '../steelbody.json');

// 같은 계정이 겹치지 않게. 다시 돌릴 때마다 새로 만들어진다
const TAG = 'smoke' + (Math.floor(Date.now() / 1000) % 100000);
const EMAIL = `${TAG}@smoke.local`;

let CK = '';
let CSRF = '';
let TOKEN = '';

async function call(method, urlPath, body) {
  const res = await fetch(BASE + urlPath, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(CK ? { Cookie: CK } : {}),
      ...(CSRF ? { 'X-CSRF-Token': CSRF } : {}),
      ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookies = res.headers.getSetCookie();
  if (setCookies.length) {
    CK = setCookies.map(c => c.split(';')[0]).join('; ');
    const m = /sb_csrf=([^;]+)/.exec(CK);
    if (m) CSRF = m[1];
  }
  let data = null;
  try { data = await res.json(); } catch { /* CSV 처럼 JSON 이 아닌 답 */ }
  return { status: res.status, data };
}

let bad = 0;
function step(label, got, want) {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + String(got).padEnd(5) + label
    + (pass ? '' : ` (기대: ${want})`));
}

// 다 돌고 나면 만든 것을 걷어낸다. 서버는 바뀐 것을 500ms 뒤에 파일로 흘리므로
// 조금 기다렸다 지운다 — 안 그러면 지운 뒤에 서버가 되살려 쓴다
function cleanup() {
  if (KEEP) {
    console.log(`\n남겨둠 — 만든 계정: ${EMAIL} (관리자 화면에서 지우세요)`);
    return;
  }
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const me = db.users.find(u => u.email === EMAIL);
    if (!me) return;
    const id = me.id;
    for (const key of Object.keys(db)) {
      if (!Array.isArray(db[key])) continue;
      db[key] = db[key].filter(row => {
        if (!row || typeof row !== 'object') return true;
        if (row.email === EMAIL) return false;
        const uid = row.user_id ?? row.userId;
        return !(uid !== undefined && uid === id);
      });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

    // **지웠다고 믿지 않는다.** 서버는 DB 를 램에 들고 있다가 나중에 파일로 흘린다.
    // 이 검사는 서버가 떠 있어야 돌아가므로, 지운 직후에 서버가 옛 내용을 덮어쓰면
    // 계정이 되살아난다. 실제로 그렇게 몇 개가 쌓였다.
    //
    // 그래서 잠깐 뒤에 다시 읽어보고, 살아 있으면 그렇다고 말한다.
    // 「지웠습니다」라고 해놓고 안 지워지는 것이 제일 나쁘다.
    setTimeout(() => {
      let back = false;
      try {
        back = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')).users.some(u => u.email === EMAIL);
      } catch { /* 못 읽으면 아래에서 안내한다 */ }
      console.log('');
      if (back) {
        console.log(`검사 계정 ${EMAIL} 이 서버 쪽에서 되살아났습니다.`);
        console.log('서버를 내리고 `npm run smoke:clean` 을 돌리면 한 번에 지워집니다.');
      } else {
        console.log(`검사 계정 ${EMAIL} 과 그 기록을 지웠습니다.`);
      }
    }, 1200);
  } catch (err) {
    console.log(`\n검사 계정을 못 지웠습니다 (${err.message}). ${EMAIL} 을 직접 지워주세요.`);
  }
}

// 쌓인 검사 계정을 한 번에 지운다 (`npm run smoke:clean`). **서버를 내리고 쓴다.**
function cleanAll() {
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const ids = new Set(db.users.filter(u => String(u.email || '').endsWith('@smoke.local')).map(u => u.id));
    if (ids.size === 0) { console.log('쌓인 검사 계정이 없습니다.'); return; }
    for (const key of Object.keys(db)) {
      if (!Array.isArray(db[key])) continue;
      db[key] = db[key].filter(row => {
        if (!row || typeof row !== 'object') return true;
        if (String(row.email || '').endsWith('@smoke.local')) return false;
        const uid = row.user_id ?? row.userId;
        return !(uid !== undefined && ids.has(uid));
      });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    console.log(`검사 계정 ${ids.size}개와 그 기록을 지웠습니다.`);
  } catch (err) {
    console.log(`못 지웠습니다 (${err.message}).`);
  }
}

(async () => {
  if (process.argv.includes('--clean-all')) { cleanAll(); return; }
  console.log(`두들길 곳: ${BASE}\n`);

  console.log('── 가입하고 들어온다 ──');
  const reg = await call('POST', '/auth/register',
    { email: EMAIL, password: 'smoke1234', nickname: '한바퀴', username: TAG });
  TOKEN = reg.data?.token || '';
  step('가입', reg.status, 201);
  if (!TOKEN) {
    console.log('토큰을 못 받아 여기서 멈춥니다:', JSON.stringify(reg.data));
    process.exit(1);
  }
  step('내 정보', (await call('GET', '/auth/me')).status, 200);
  step('성별 고르기', (await call('PUT', '/auth/sex', { sex: 'male' })).status, 200);

  console.log('\n── 인바디를 적는다 ──');
  const ib = await call('POST', '/inbody',
    { date: '2026-08-27', height: 175, weight: 72, fat_pct: 18, muscle_kg: 33 });
  step('인바디 저장', ib.status, 201);
  step('  키가 있으면 BMI 를 계산한다', ib.data?.bmi, 23.5);

  console.log('\n── 루틴을 짜고 그대로 한다 ──');
  const rt = await call('POST', '/my-routines', {
    name: '가슴 등',
    exercises: [
      { name: '벤치프레스', sets: '4세트', reps: '10회' },
      { name: '랫풀다운', sets: '3세트', reps: '12회' },
    ],
  });
  step('루틴 만들기', rt.status, 201);
  const ss = await call('POST', '/routine-session', { routineId: rt.data?.id });
  step('루틴 시작', ss.status, 201);
  step('  첫 칸이 벤치프레스', ss.data?.session?.items?.[0]?.name, '벤치프레스');
  step("  '4세트' 에서 숫자만 뽑았다", ss.data?.session?.items?.[0]?.sets, 4);

  console.log('\n── 기록한다 ──');
  step('벤치프레스 저장',
    (await call('POST', '/workouts', { date: '2026-08-27', exercise: '벤치프레스', weight: 60, sets: 4, reps: 10 })).status, 201);
  const p1 = await call('PATCH', '/routine-session', { index: 0, state: 'done' });
  step('진행표 한 칸', p1.status, 200);
  step('  다음 칸으로 갔다', p1.data?.session?.current, 1);
  step('랫풀다운 저장',
    (await call('POST', '/workouts', { date: '2026-08-27', exercise: '랫풀다운', weight: 50, sets: 3, reps: 12 })).status, 201);
  const p2 = await call('PATCH', '/routine-session', { index: 1, state: 'done' });
  step('진행표 끝', p2.status, 200);
  step('  다 했다고 알려준다', p2.data?.finished, true);

  console.log('\n── 막아야 할 것은 막는지 ──');
  step('운동명 공백만',
    (await call('POST', '/workouts', { date: '2026-08-27', exercise: '   ', weight: 60, sets: 3, reps: 10 })).status, 400);
  step('2.5세트',
    (await call('POST', '/workouts', { date: '2026-08-27', exercise: '벤치', weight: 60, sets: 2.5, reps: 10 })).status, 400);
  step('음수 무게',
    (await call('POST', '/workouts', { date: '2026-08-27', exercise: '벤치', weight: -50, sets: 3, reps: 10 })).status, 400);
  step('루틴명 공백만',
    (await call('POST', '/my-routines', { name: '  ', exercises: [{ name: '벤치' }] })).status, 400);
  step('닉네임이 배열 (500 이 나던 자리)',
    (await call('PUT', '/auth/nickname', { nickname: ['a'] })).status, 400);

  console.log('\n── 측정하고 꺼내 본다 ──');
  step('측정 저장',
    (await call('POST', '/measures', { date: '2026-08-27', type: 'bodySize', data: { chest: 100, waist: 80 } })).status, 201);
  for (const [label, urlPath, wantRows] of [
    ['운동', '/export/workouts', 2],
    ['인바디', '/export/inbody', 1],
    ['측정', '/export/measures', 2],
  ]) {
    const res = await fetch(BASE + urlPath, { headers: { Authorization: 'Bearer ' + TOKEN, Cookie: CK } });
    const text = await res.text();
    const rows = text.trim().split('\n').length - 1; // 머리글 한 줄 뺀다
    step(`${label} 내보내기`, res.status, 200);
    step('  줄 수', rows, wantRows);
  }

  console.log('\n── 고객센터 ──');
  // 구분선을 일부러 넣는다. 예전에는 이 줄 때문에 영구 정지될 수 있었다
  step('제보 (구분선 --- 포함)',
    (await call('POST', '/reports', { kind: 'bug', title: '한 바퀴 돌아봤습니다', body: '화면: 기록\n---\n잘 됩니다' })).status, 201);
  step('별점', (await call('POST', '/ratings', { score: 5 })).status, 201);

  console.log('\n── 알림 ──');
  step('요일과 시각 정하기',
    (await call('PUT', '/reminders', { enabled: true, days: [1, 3, 5], time: '19:00', tzOffset: -540, streakGuard: true })).status, 200);
  step('끄기', (await call('PUT', '/reminders', { enabled: false })).status, 200);


  // ── 화면이 기대하는 모양대로 오는가 ──
  //
  // 이 앱에서 세 번 나온 종류다. 서버가 배열을 주는데 화면이 객체로 받으면,
  // 로그가 100건 와도 늘 「없습니다」 이고 숫자는 전부 0 이다. **에러도 안 나고
  // 빌드도 통과한다** — 화면이 조용히 아무 말도 안 할 뿐이라 눈으로만 잡힌다.
  //
  // 그래서 사람 대신 여기서 본다. 배열인가 · 객체인가 · 화면이 읽는 칸이 있는가.
  // 관리자만 볼 수 있는 것은 이 계정으로 못 부른다 — 거기는 403 이 맞는지만 본다.
  console.log('');
  console.log('── 화면이 기대하는 모양대로 오는가 ──');

  const shapeOf = (v) => (Array.isArray(v) ? '배열' : v === null ? 'null' : typeof v);

  // [부르는 곳, 길, 기대하는 모양, 화면이 읽는 칸들]
  const SHAPES = [
    ['운동 기록 (workoutStore)',     '/workouts',        '배열', []],
    ['인바디 (inbodyStore)',         '/inbody',          '배열', []],
    ['측정 (MeasurePage)',           '/measures',        '배열', []],
    ['내 루틴 (홈 · 루틴)',          '/my-routines',     '배열', []],
    ['사진 (머리 · 비교)',           '/photos',          '배열', []],
    ['제보함 (reportStore)',         '/reports',         '배열', []],
    ['점검 (MaintenanceScreen)',     '/maintenance',     '배열', []],
    ['추천 루틴 · 머신 (RoutinePage)', '/routines/머신',  'object', ['가슴']],
    ['추천 루틴 · 맨몸',               '/routines/맨몸',  'object', ['가슴']],
    ['추천 루틴 · 홈트',               '/routines/홈트',  'object', ['전신']],
    ['소셜 (SocialLoginButtons)',    '/oauth/providers', 'object', ['google']],
    ['진행표 (routineSessionStore)', '/routine-session', 'object', ['session']],
    ['알림 (RemindersPage)',         '/reminders',       'object', ['settings', 'vapidPublicKey', 'devices']],
    ['별점 (Satisfaction)',          '/ratings/me',      'object', ['score']],
  ];

  for (const [label, urlPath, want, keys] of SHAPES) {
    const res = await call('GET', urlPath);
    step(label, res.status, 200);
    step('  ' + want + ' 로 온다', shapeOf(res.data), want);
    for (const k of keys) {
      step('  ' + k + ' 칸이 있다', res.data && k in res.data, true);
    }
  }

  // 관리자 것은 이 계정으로 못 본다. 뚫려 있으면 그게 사고다
  for (const [label, urlPath] of [
    ['보안 대시보드', '/security/dashboard'], ['사람 목록', '/security/users'],
    ['보안 기록', '/security/logs'], ['제보 전체', '/reports/all'],
    ['못 찾은 말', '/faq-gaps'], ['만족도 통계', '/ratings/stats'],
  ]) {
    step(label + ' 은 관리자만', (await call('GET', urlPath)).status, 403);
  }
  console.log('\n' + (bad ? bad + '건 실패' : '한 바퀴 전부 통과'));
  await new Promise(r => setTimeout(r, 700));
  cleanup();
  process.exit(bad ? 1 : 0);
})();
