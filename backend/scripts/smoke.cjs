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
const DB_PATH = path.join(__dirname, '../blackiron.json');

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
// 파일에서 그 계정과 그 사람 것을 지운다. 지웠으면 true
function wipeFromFile() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const me = db.users.find(u => u.email === EMAIL);
  if (!me) return false;
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
  return true;
}

const stillThere = () => {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')).users.some(u => u.email === EMAIL);
  } catch { return false; }
};

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// **지웠다고 믿지 않는다.** 서버는 DB 를 램에 들고 있다가 500ms 뒤에 파일로 흘린다.
// 이 검사는 서버가 떠 있어야 돌아가므로, 지운 직후에 서버가 옛 내용을 덮어쓰면
// **계정이 되살아난다.**
//
// 예전에는 한 번 지우고 1.2초 뒤에 살아 있으면 「되살아났습니다」라고 말하고 끝냈다.
// 말은 정직했지만 계정은 그대로 남았다 — 8/31 과 9/1 것 둘이 그렇게 쌓였고,
// 그 계정들이 낸 제보가 **관리자 화면의 「손볼 제보」 숫자로 남아 있었다.**
// 검사가 남긴 것이 운영 화면의 할 일로 보이면 안 된다.
//
// 이제 되살아나면 **다시 지운다.** 서버는 마지막 요청 뒤로는 더 쓸 것이 없어서
// 두 번째나 세 번째에는 붙는다. 세 번 해도 안 되면 그때 사람에게 말한다
async function cleanup() {
  if (KEEP) {
    console.log(`\n남겨둠 — 만든 계정: ${EMAIL} (관리자 화면에서 지우세요)`);
    return;
  }
  try {
    if (!wipeFromFile()) return;
    for (let i = 0; i < 3; i++) {
      await wait(900);
      if (!stillThere()) {
        console.log(`\n검사 계정 ${EMAIL} 과 그 기록을 지웠습니다.`);
        return;
      }
      wipeFromFile();
    }
    await wait(900);
    if (stillThere()) {
      console.log(`\n검사 계정 ${EMAIL} 이 서버 쪽에서 자꾸 되살아납니다.`);
      console.log('서버를 내리고 `npm run smoke:clean` 을 돌리면 한 번에 지워집니다.');
    } else {
      console.log(`\n검사 계정 ${EMAIL} 과 그 기록을 지웠습니다.`);
    }
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

  console.log('\n── 달력에 할 것을 담는다 ──');
  // 한 것과 할 것은 다른 이야기다. 계획은 따로 저장한다
  const pl1 = await call('POST', '/plans', { date: '2026-12-24', kind: 'routine', name: '가슴 등', routineId: rt.data?.id });
  step('루틴을 그날에 건다', pl1.status, 201);
  const pl2 = await call('POST', '/plans', { date: '2026-12-24', kind: 'exercise', name: '데드리프트' });
  step('운동 하나도 담는다', pl2.status, 201);
  const plList = await call('GET', '/plans');
  step('내 계획을 받아온다', plList.status, 200);
  step('  두 개가 들어 있다', (plList.data || []).filter(p => p.date === '2026-12-24').length, 2);
  // 눌린 줄 모르고 또 누르는 자리다
  step('같은 날 같은 것은 두 번 안 담긴다',
    (await call('POST', '/plans', { date: '2026-12-24', kind: 'exercise', name: '데드리프트' })).status, 400);
  step('이름이 공백만이면 안 담긴다',
    (await call('POST', '/plans', { date: '2026-12-24', kind: 'exercise', name: '   ' })).status, 400);
  step('날짜 모양이 아니면 안 담긴다',
    (await call('POST', '/plans', { date: '내일', kind: 'exercise', name: '스쿼트' })).status, 400);
  // 남의 루틴 번호를 적어 보내면 그 이름이 붙는다
  step('없는 루틴은 못 건다',
    (await call('POST', '/plans', { date: '2026-12-25', kind: 'routine', name: '남의 루틴', routineId: 999999 })).status, 400);
  step('담은 것을 뺀다', (await call('DELETE', '/plans/' + pl2.data?.id)).status, 200);
  step('  빼고 나면 하나만 남는다',
    ((await call('GET', '/plans')).data || []).filter(p => p.date === '2026-12-24').length, 1);
  step('없는 것을 빼면 404', (await call('DELETE', '/plans/999999')).status, 404);

  console.log('\n── 루틴 메모를 적는다 ──');
  // 루틴이 되기 전 단계. 떠오르는 대로 적어두고, 다 짜였을 때 루틴으로 만든다.
  // 메모를 읽어 루틴으로 옮기는 일은 화면이 한다(`data/routineNote.js`, `npm run note`) —
  // 여기서는 적고 · 고치고 · 지우는 것만 본다
  const nt = await call('POST', '/notes', { body: '월요일 가슴 · 삼두\n벤치프레스 5x10\n딥스 3세트' });
  step('메모를 적는다', nt.status, 201);
  step('  적은 그대로 돌아온다', String(nt.data?.body || '').split('\n').length, 3);
  step('빈 메모는 안 받는다', (await call('POST', '/notes', { body: '   ' })).status, 400);
  step('글자가 아니면 안 받는다', (await call('POST', '/notes', { body: ['배열'] })).status, 400);
  const ntList = await call('GET', '/notes');
  step('내 메모를 받아온다', Array.isArray(ntList.data), true);
  step('  방금 적은 것이 있다', (ntList.data || []).some(n => n.id === nt.data?.id), true);
  const ntEdit = await call('PUT', '/notes/' + nt.data?.id, { body: '화요일 등\n랫풀다운 4x12' });
  step('고친다', ntEdit.status, 200);
  step('  고친 시각이 바뀐다', ntEdit.data?.updated_at !== nt.data?.updated_at, true);
  step('없는 메모는 못 고친다', (await call('PUT', '/notes/999999', { body: 'x' })).status, 404);
  step('메모를 지운다', (await call('DELETE', '/notes/' + nt.data?.id)).status, 200);
  step('없는 것을 지우면 404', (await call('DELETE', '/notes/999999')).status, 404);

  // 달력의 그날 메모 — 같은 길(`/notes`)에 **날짜가 붙은** 것이다.
  // 루틴 메모장과 목록이 섞이면 안 된다 (섞이면 짜다 만 루틴 사이에 「출장이라 쉼」이 낀다)
  const dn = await call('POST', '/notes', { date: '2027-03-05', body: '어깨가 안 좋아 가볍게' });
  step('달력에 그날 메모를 적는다', dn.status, 201);
  step('  날짜가 붙어서 돌아온다', dn.data?.date, '2027-03-05');
  const dn2 = await call('POST', '/notes', { date: '2027-03-05', body: '고쳐 적음' });
  step('같은 날 또 보내면 고친다 (하루 한 장)', dn2.status, 200);
  step('  장수가 늘지 않는다', dn2.data?.id, dn.data?.id);
  await call('POST', '/notes', { date: '2027-04-02', body: '다음 달 것' });
  const march = await call('GET', '/notes?month=2027-03');
  step('보고 있는 달만 받아온다', (march.data || []).length, 1);
  step('루틴 메모 목록에 달력 것이 안 섞인다',
    ((await call('GET', '/notes')).data || []).filter(n => n.date).length, 0);
  step('날짜 모양이 아니면 안 받는다',
    (await call('POST', '/notes', { date: '내일', body: 'x' })).status, 400);
  step('달 모양이 아니면 안 받는다', (await call('GET', '/notes?month=3월')).status, 400);
  step('그날 메모를 지운다', (await call('DELETE', '/notes/' + dn.data?.id)).status, 200);

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

  // **엉뚱한 말을 하지 않는다** (2026-09-04).
  //
  // 예전에는 모르는 값을 조용히 버리고, 남은 게 없으면 「바꿀 값이 없어요」라고 했다.
  // 그래서 시간 칸을 비우면(브라우저가 빈 문자열을 보낸다) 시각을 고치려던 사람에게
  // 「바꿀 값이 없어요」가 떴다 — 무엇을 고쳐야 할지 알 수 없는 말이다.
  const badTime = await call('PUT', '/reminders', { time: '', tzOffset: -540 });
  step('시각이 빈 값이면 시각 이야기를 한다', badTime.status, 400);
  step('  「바꿀 값이 없어요」가 아니다', badTime.data?.error, '시각을 19:00 처럼 적어주세요');
  const badTime2 = await call('PUT', '/reminders', { time: '25:00' });
  step('없는 시각도 같다', badTime2.data?.error, '시각을 19:00 처럼 적어주세요');
  const badDays = await call('PUT', '/reminders', { days: '월수금' });
  step('요일 모양이 틀리면 요일 이야기를 한다', badDays.data?.error, '요일은 0~6 사이 숫자 목록으로 주세요');
  // 시간대만 와도 저장한다 — **보낼 시각을 그 사람 시간대로 재는 값**이라
  // 여행을 가서 시간대가 바뀌면 그것만 와도 갱신돼야 한다
  step('시간대만 와도 저장한다', (await call('PUT', '/reminders', { tzOffset: -540 })).status, 200);
  const nothing = await call('PUT', '/reminders', {});
  step('진짜 아무것도 없으면 그렇다고 한다', nothing.data?.error, '바꿀 값이 없어요');
  step('  값을 되돌려 놓는다',
    (await call('PUT', '/reminders', { time: '19:00' })).status, 200);

  // 없는 기기를 끄려 해도 실패가 아니다 — 두 번 눌렀거나 이미 빠진 기기다.
  // **남의 것이어서 못 지운 것도 여기로 온다** (있고 없고를 알려주지 않는다)
  const gone = await call('DELETE', '/reminders/subscribe', { endpoint: 'https://push.example.com/없는것' });
  step('없는 기기를 끄려 해도 200', gone.status, 200);
  step('  지운 것은 없다', gone.data?.removed, 0);


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
  // ── 계정 삭제 ──
  //
  // **맨 뒤에 둔다.** 예약하는 순간 이 계정은 잠기고 토큰이 걷힌다 —
  // 앞에 두면 그 뒤의 모든 검사가 401 이 된다.
  console.log('\n── 계정을 지운다 (30일 유예) ──');
  step('비밀번호가 틀리면 안 지운다',
    (await call('POST', '/auth/delete', { password: 'wrong-one-9999' })).status, 401);
  const del = await call('POST', '/auth/delete', { password: 'smoke1234' });
  step('삭제 예약', del.status, 200);
  const days = del.data?.delete_due_at
    ? Math.round((new Date(del.data.delete_due_at) - Date.now()) / 86400000) : null;
  step('  30일 뒤로 날이 잡힌다', days, 30);
  // 잠갔다면서 그 기기에서 계속 쓰이면 잠근 것이 아니다
  step('  예약하면 그 자리에서 잠긴다', (await call('GET', '/auth/me')).status, 401);
  // 다시 로그인하면 되살아나야 한다. 이게 30일을 두는 이유 전부다
  const back = await call('POST', '/auth/login', { email: EMAIL, password: 'smoke1234' });
  step('다시 로그인하면 되살아난다', back.status, 200);
  step('  되살아났다고 알려준다', back.data?.restored, true);
  TOKEN = back.data?.token || TOKEN;
  step('  되살아난 계정으로 다시 쓸 수 있다', (await call('GET', '/auth/me')).status, 200);

  console.log('\n' + (bad ? bad + '건 실패' : '한 바퀴 전부 통과'));
  await new Promise(r => setTimeout(r, 700));
  await cleanup();
  process.exit(bad ? 1 : 0);
})();
