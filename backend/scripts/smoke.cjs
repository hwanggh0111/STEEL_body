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

// **전체 속도 제한(1분 100번)에 걸리면 풀릴 때까지 기다렸다 한 번 더 부른다.**
//
// 한 바퀴가 100번을 넘어서면서(2026-09-14, 커뮤니티 공감·신고 검사를 더하고) 뒤쪽
// 검사가 전부 429 로 FAIL 이 났다. 앱이 틀린 게 아니라 검사가 너무 빨랐다.
// 서버 제한을 검사 때문에 풀지는 않는다 — 검사가 기다린다.
// 로그인 제한(15분)처럼 오래 걸리는 것은 기다리지 않는다. 그건 진짜 실패로 보여야 한다
async function call(method, urlPath, body, retried = false) {
  const res = await rawCall(method, urlPath, body);
  if (res.status === 429 && !retried) {
    const reset = Number(res.reset);
    if (Number.isFinite(reset) && reset > 0 && reset <= 65) {
      console.log(`  (속도 제한 — ${reset}초 기다렸다 다시 부릅니다)`);
      await new Promise(r => setTimeout(r, (reset + 1) * 1000));
      return call(method, urlPath, body, true);
    }
  }
  return { status: res.status, data: res.data };
}

async function rawCall(method, urlPath, body) {
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
  return { status: res.status, data, reset: res.headers.get('ratelimit-reset') };
}

// CSRF 회귀용 — 쿠키는 실어 로그인한 채로, X-CSRF-Token 만 일부러 뺀다.
// 남의 페이지가 로그인된 사용자를 시켜 보내는 요청을 흉내 낸다 (2026-09-15).
async function noCsrfCall(method, urlPath, body) {
  const res = await fetch(BASE + urlPath, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(CK ? { Cookie: CK } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
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

  // CSRF — 로그인 뒤 상태변경(닉네임·성별)은 토큰이 없으면 막혀야 한다.
  // 예전에 `/api/auth/` 전체를 CSRF 에서 빼두는 바람에 여기가 뚫려 있었다 (2026-09-15 침투 테스트).
  step('CSRF 없이 닉네임 변경은 막힌다', (await noCsrfCall('PUT', '/auth/nickname', { nickname: '침투' })).status, 403);
  step('CSRF 없이 성별 변경은 막힌다', (await noCsrfCall('PUT', '/auth/sex', { sex: 'female' })).status, 403);

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
  step('  세트 체크는 0 에서 시작한다', ss.data?.session?.items?.[0]?.setsDone, 0);

  // ── 세트마다 체크 (2026-09-14) ──
  // 칸을 넘기는 것은 기록 저장이다. 세트 체크만으로 넘어가면 기록 없이 끝난 운동이 생긴다
  const c2 = await call('PATCH', '/routine-session', { index: 0, setsDone: 2 });
  step('세트 둘을 체크한다', c2.status, 200);
  step('  두 세트가 남는다', c2.data?.session?.items?.[0]?.setsDone, 2);
  step('  칸은 안 넘어간다', c2.data?.session?.current, 0);
  step('  새로 불러와도 남아 있다',
    (await call('GET', '/routine-session')).data?.session?.items?.[0]?.setsDone, 2);
  step('세트 수가 음수면 안 받는다',
    (await call('PATCH', '/routine-session', { index: 0, setsDone: -1 })).status, 400);
  step('세트 수가 글이면 안 받는다',
    (await call('PATCH', '/routine-session', { index: 0, setsDone: '3' })).status, 400);
  step('상태도 세트도 없으면 안 받는다',
    (await call('PATCH', '/routine-session', { index: 0 })).status, 400);
  step('없는 칸의 세트는 409',
    (await call('PATCH', '/routine-session', { index: 99, setsDone: 1 })).status, 409);

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

  // ── 목표 ── (2026-09-17 에 붙였다)
  //
  // 한 사람당 한 줄이다. 세우고 · 고치고 · **둘 중 하나만 남기고** · 접는 데까지 본다 —
  // 접는 길이 없으면 한번 세운 수에 갇힌다.
  console.log('\n── 목표를 세우고 접는다 ──');
  step('아직 없으면 null (404 가 아니다)',
    JSON.stringify((await call('GET', '/goals')).data), 'null');
  const g1 = await call('PUT', '/goals', { weeklyTarget: 4, weightTarget: 75, weightStart: 80 });
  step('세운다', g1.status, 200);
  step('  시작한 날을 서버가 적어준다', /^\d{4}-\d{2}-\d{2}$/.test(g1.data?.startedAt || ''), true);
  step('주 8회는 없다', (await call('PUT', '/goals', { weeklyTarget: 8 })).status, 400);
  step('말이 안 되는 체중도 안 받는다', (await call('PUT', '/goals', { weightTarget: 5 })).status, 400);
  // 하나만 쫓는 사람이 있다. `null` 은 **지우라는 뜻**이라 그대로 받는다
  const g2 = await call('PUT', '/goals', { weightTarget: null });
  step('체중만 비운다', [g2.data?.weightTarget, g2.data?.weeklyTarget], [null, 4]);
  // 주 횟수를 낮췄다고 그동안 이어온 주가 없던 일이 되면 안 된다
  const g3 = await call('PUT', '/goals', { weeklyTarget: 3 });
  step('  고쳐도 시작한 날은 안 바뀐다', g3.data?.startedAt, g1.data?.startedAt);
  step('접는다', (await call('DELETE', '/goals')).status, 200);
  step('  두 번 접으면 없다고 한다', (await call('DELETE', '/goals')).status, 404);
  step('  접은 뒤에는 다시 null', JSON.stringify((await call('GET', '/goals')).data), 'null');

  // ── 기구 세팅 ── (2026-09-18 에 붙였다. 9/17 에 만들었는데 한 바퀴에 없었다)
  //
  // 열쇠가 (사람 · 헬스장 · 운동) 셋이다. **헬스장마다 따로**인 것이 이 기능의 전부라,
  // 그게 정말 갈라지는지 · 빈 칸으로 만든 줄이 안 남는지 · 테두리가 있는지를 본다.
  console.log('\n── 기구 세팅 ──');
  const put = (body) => call('PUT', '/gym-settings', body);
  step('적는다', (await put({ gym: '집앞', exercise: '랫풀다운', seat: '4', grip: '넓게' })).status, 200);
  const gs1 = await call('GET', '/gym-settings?gym=집앞');
  step('  그 헬스장 것만 준다', gs1.data?.settings?.length, 1);
  step('  다니는 곳 목록도 같이 준다', gs1.data?.gyms?.[0]?.name, '집앞');
  // 강남점 세팅을 집 앞에서 그대로 쓰면 **틀린 값을 믿고 맞추는 셈**이다
  await put({ gym: '강남점', exercise: '랫풀다운', seat: '7' });
  const gs2 = await call('GET', '/gym-settings?gym=집앞');
  step('헬스장마다 갈라진다', [gs2.data?.settings?.length, gs2.data?.settings?.[0]?.seat], [1, '4']);
  step('  내 세팅 전부는 둘이다', (await call('GET', '/gym-settings')).data?.settings?.length, 2);
  // 어느 칸도 없는 줄은 만들지 않는다 — 다음에 그 운동을 열면 빈 카드가 뜬다
  step('빈 세팅은 안 만든다', (await put({ gym: '집앞', exercise: '레그컬' })).status, 400);
  // 있던 것을 다 비운 것은 **지우겠다는 뜻**이다
  step('다 비우면 지운다',
    (await put({ gym: '강남점', exercise: '랫풀다운', seat: null })).data?.removed, true);
  step('  지운 뒤에는 없다', (await call('GET', '/gym-settings?gym=강남점')).data?.settings?.length, 0);
  step('어느 헬스장인지 없으면 안 받는다', (await put({ exercise: '랫풀다운', seat: '4' })).status, 400);
  // **곳 수에도 테두리를 둔다** (2026-09-18). 한 곳당 60개만 막고 곳 수는 안 막으면
  // 이름을 바꿔가며 끝없이 쌓을 수 있다 — 파일 하나를 통째로 쓰는 DB 라 모두의 비용이 된다
  for (let i = 1; i <= 11; i++) await put({ gym: '테두리' + i, exercise: '스쿼트', seat: '1' });
  step('헬스장 열두 곳까지만', (await put({ gym: '열세번째', exercise: '스쿼트', seat: '1' })).status, 400);
  step('  이미 다니는 곳에는 더 적을 수 있다',
    (await put({ gym: '집앞', exercise: '레그프레스', seat: '2' })).status, 200);

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

  // ── 챙겨 나갔다 다시 들고 들어오기 ── (2026-09-18)
  //
  // 내보내기는 있는데 되돌릴 길이 없었다 — 기기를 바꾸거나 계정을 새로 만들면 파일이
  // 있어도 못 넣었다. 여기서 보는 것은 한 가지다: **내보낸 것을 이 앱이 다시 읽는가.**
  // 값으로는 `npm run import` 가 보고, 여기서는 진짜로 한 바퀴 돌려본다.
  console.log('\n── 내보낸 것을 다시 넣는다 ──');
  const getCsv = async (what) => {
    const res = await fetch(BASE + '/export/' + what, { headers: { Authorization: 'Bearer ' + TOKEN, Cookie: CK } });
    return res.text();
  };
  const countRows = (csv) => csv.trim().split('\n').length - 1;   // 머리글 한 줄 뺀다

  const wCsv = await getCsv('workouts');
  const wBefore = countRows(wCsv);
  // 1) 있는 것을 그대로 다시 넣는다 — **한 줄도 늘어나면 안 된다**
  const again = await call('POST', '/import', { kind: 'workouts', csv: wCsv });
  step('있는 것을 다시 넣으면', again.status, 200);
  step('  한 줄도 안 늘어난다', [again.data?.added, again.data?.skipped], [0, wBefore]);
  step('  기록 수도 그대로', countRows(await getCsv('workouts')), wBefore);

  // 2) 없는 줄이 섞인 파일 — 새 줄만 들어가고, 걸린 줄은 몇째 줄인지 말한다
  const mixed = '날짜,운동명,무게,세트,횟수\n'
    + '2026-08-20,가져온운동,55,4,10\n'      // 새 줄
    + '1900-01-01,옛날운동,55,4,10\n'        // 날짜가 이상하다
    + '2026-08-21,,55,4,10\n';              // 운동명이 없다
  const mix = await call('POST', '/import', { kind: 'workouts', csv: mixed });
  step('새 줄만 넣고 나머지는 이유를 말한다', [mix.data?.added, mix.data?.failed], [1, 2]);
  step('  몇째 줄인지 말한다', mix.data?.reasons?.[0]?.line, 3);
  step('  넣은 줄이 진짜로 있다', countRows(await getCsv('workouts')), wBefore + 1);

  // 3) 인바디 · 측정도 같은 짝이 있다
  const iCsv = await getCsv('inbody');
  const iAgain = await call('POST', '/import', { kind: 'inbody', csv: iCsv });
  step('인바디도 다시 넣어도 안 늘어난다', [iAgain.data?.added, iAgain.data?.skipped], [0, countRows(iCsv)]);
  const mCsv = await getCsv('measures');
  const mAgain = await call('POST', '/import', { kind: 'measures', csv: mCsv });
  step('측정도 다시 넣어도 안 늘어난다', mAgain.data?.added, 0);
  step('  측정 줄 수도 그대로', countRows(await getCsv('measures')), countRows(mCsv));

  // 4) 막아야 할 것
  step('무엇을 넣는지 없으면 안 받는다', (await call('POST', '/import', { csv: 'a,b' })).status, 400);
  step('빈 파일은 안 받는다', (await call('POST', '/import', { kind: 'workouts', csv: '   ' })).status, 400);
  // **왜 하나도 못 읽었는지 말한다.** 「0건」만 돌려주면 파일이 잘못된 것인지 앱이 못 읽는
  // 것인지 알 수가 없다
  const noHead = await call('POST', '/import', { kind: 'workouts', csv: '가,나\n1,2' });
  step('머리글이 없으면 무엇이 없는지 말한다', /날짜/.test(noHead.data?.error || ''), true);

  // ── 날짜 테두리 ── (2026-09-18)
  //
  // 여태 **모양만** 봤다. 그래서 `1900-01-01` 도 `9999-12-31` 도 들어왔고, 한 번 들어간
  // 줄은 1년 벽 · 달력 · 이어온 주에 계속 남는다 (이어온 주는 첫 기록의 주부터 센다).
  console.log('\n── 말이 안 되는 날짜는 안 받는다 ──');
  const badDay = (date) => call('POST', '/workouts', { date, exercise: '테두리', sets: 3, reps: 10, weight: 40 });
  step('1900년', (await badDay('1900-01-01')).status, 400);
  step('9999년', (await badDay('9999-12-31')).status, 400);
  step('달에 없는 날', (await badDay('2026-02-30')).status, 400);
  // 어제 것을 오늘 적는 길은 열어둔다 — 이 앱이 일부러 낸 길이다
  step('어제는 받는다',
    (await badDay(new Date(Date.now() - 86400000).toISOString().slice(0, 10))).status, 201);
  // 계획은 앞날이 제자리다 (달력의 「할 것」)
  step('계획은 앞날도 받는다',
    (await call('POST', '/plans', {
      date: new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10),
      kind: 'exercise', name: '스쿼트',
    })).status, 201);
  step('  그래도 9999년은 안 받는다',
    (await call('POST', '/plans', { date: '9999-01-01', kind: 'exercise', name: '스쿼트' })).status, 400);

  // 오프라인 줄에서 올라온 것은 한 번만 만든다 (2026-09-15).
  // 지하에서 적은 세트를 올리다 답이 끊겨 다시 보내도 서버에 둘로 남으면 안 된다.
  // (개수를 세는 위 내보내기 검사 뒤에 둔다 — 여기서 만든 것이 그 수를 흔들지 않게.)
  console.log('\n── 오프라인 재전송이 중복을 안 만드는지 ──');
  const idemKey = 'local-smoke-' + TAG;
  const mkEx = '멱등테스트' + TAG;
  await call('POST', '/workouts', { date: '2026-08-28', exercise: mkEx, weight: 40, sets: 3, reps: 12, clientKey: idemKey });
  await call('POST', '/workouts', { date: '2026-08-28', exercise: mkEx, weight: 40, sets: 3, reps: 12, clientKey: idemKey });
  const listA = await call('GET', '/workouts');
  const countCK = Object.values(listA.data || {}).flat().filter(w => w.exercise === mkEx).length;
  step('같은 줄을 두 번 올려도 하나만 남는다', countCK, 1);
  // 반대로 clientKey 가 없으면(온라인 저장) 두 번은 두 개다 — 일부러 두 번 적을 수 있다
  const onEx = '온라인테스트' + TAG;
  await call('POST', '/workouts', { date: '2026-08-28', exercise: onEx, weight: 40, sets: 3, reps: 12 });
  await call('POST', '/workouts', { date: '2026-08-28', exercise: onEx, weight: 40, sets: 3, reps: 12 });
  const listB = await call('GET', '/workouts');
  const countOn = Object.values(listB.data || {}).flat().filter(w => w.exercise === onEx).length;
  step('키 없이 두 번은 둘이다 (온라인 의도)', countOn, 2);

  console.log('\n── 고객센터 ──');
  // 구분선을 일부러 넣는다. 예전에는 이 줄 때문에 영구 정지될 수 있었다
  step('제보 (구분선 --- 포함)',
    (await call('POST', '/reports', { kind: 'bug', title: '한 바퀴 돌아봤습니다', body: '화면: 기록\n---\n잘 됩니다' })).status, 201);
  step('별점', (await call('POST', '/ratings', { score: 5 })).status, 201);

  // 커뮤니티 한 바퀴는 **기능과 함께 걷었다** (2026-09-16).
  // 글 · 댓글 · 공감 · 신고가 앱에서 없어졌다.

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
