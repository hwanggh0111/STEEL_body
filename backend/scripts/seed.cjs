// 화면을 눈으로 확인하려고 만드는 시연 계정.
//
//   cd backend && npm start          (다른 창에서 서버를 띄워두고)
//   cd backend && npm run seed       (만든다)
//   cd backend && npm run seed:clear (지운다)
//
// **왜 필요한가.** 갓 가입한 계정으로는 화면 절반이 빈칸이다 — 달력도, 그래프도,
// 주간 요약도, 최고 기록도, 연속 주도 쌓인 것이 있어야 보인다. 그 상태로는
// 「잘 나오는지」를 확인할 수가 없다.
//
// 석 달치를 넣는다. **아무렇게나 넣지 않는다** — 주 3~4회, 무게가 조금씩 늘고,
// 가끔 한 주를 통째로 쉬고, 부위가 골고루 섞이게. 그래야 화면이 실제로 하는 말을
// 볼 수 있다 (연속 주가 끊기는 자리, 최고 기록이 갱신되는 자리).
//
//   로그인: seed@demo.local / seed12345
const fs = require('fs');
const path = require('path');

const BASE = process.env.SEED_BASE || 'http://localhost:4000/api';
const CLEAR = process.argv.includes('--clear');
const DB_PATH = path.join(__dirname, '../steelbody.json');

const EMAIL = 'seed@demo.local';
const PASSWORD = 'seed12345';
const USERNAME = 'seeddemo';

// 오늘을 기준으로 거슬러 올라간다. 날짜를 박아두면 몇 달 뒤에 돌렸을 때
// 「석 달 전 기록」이 아니라 「작년 기록」이 되어 달력도 그래프도 안 보인다
const TODAY = new Date();
const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const daysAgo = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; };

// 이번 주 월요일. 앱이 한 주를 월요일에 시작하니 여기서도 그렇게 잡는다.
//
// 처음에는 그냥 「며칠 전」으로 날짜를 만들었다. 그랬더니 한 주를 쉬게 해뒀는데도
// **연속 주가 13주로 나왔다** — 「며칠 전」 묶음이 월요일 경계와 안 맞아서, 쉰다고 한
// 자리가 앞뒤 주로 흩어져 버린 것이다. 연속이 끊기는 자리를 보려고 넣은 것인데
// 그게 안 보이면 넣은 뜻이 없다.
function mondayOf(d) {
  const base = new Date(d);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  return base;
}
const THIS_MONDAY = mondayOf(TODAY);

// weeksAgo 주 전의 월요일에서 weekday(0=월 … 6=일) 만큼 지난 날
function dayOfWeek(weeksAgo, weekday) {
  const d = new Date(THIS_MONDAY);
  d.setDate(d.getDate() - weeksAgo * 7 + weekday);
  return d;
}

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
  try { data = await res.json(); } catch { /* CSV 등 */ }
  return { status: res.status, data };
}

// 서버는 사람 하나가 1분에 60건 넘게 만들면 막는다 (`aiGuard` 의 도배 방지).
// 석 달치를 한 번에 밀어 넣으면 당연히 걸린다 — **가드가 제대로 도는 것이다.**
// 그래서 걸리면 창이 새로 열릴 때까지 기다렸다 다시 넣는다. 이 때문에 몇 분 걸린다.
const SPAM_WINDOW_MS = 62 * 1000;
let waited = 0;

async function create(urlPath, body) {
  let r = await call('POST', urlPath, body);
  if (r.status === 429) {
    waited += 1;
    console.log(`  (도배 방지에 걸렸습니다 — ${SPAM_WINDOW_MS / 1000}초 기다렸다 다시 넣습니다. ${waited}번째)`);
    await new Promise(res => setTimeout(res, SPAM_WINDOW_MS));
    r = await call('POST', urlPath, body);
  }
  return r;
}

// 지우는 것은 DB 파일을 직접 손대는 방식이다. 그런데 **서버는 DB 를 통째로 램에 들고
// 있다가 나중에 파일로 흘린다.** 서버가 켜진 채로 지우면, 다음 저장 때 램에 있던
// 옛 내용이 파일을 덮어써서 지운 것이 되살아난다. 실제로 그랬다 —
// 지우고 다시 넣었더니 97건이 아니라 108건이 됐다.
//
// 그래서 서버가 떠 있으면 먼저 알려주고 멈춘다. 조용히 반만 지우는 것보다 낫다.
async function serverIsUp() {
  try {
    const res = await fetch(BASE + '/maintenance', { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function clear() {
  if (await serverIsUp()) {
    console.log('서버가 켜져 있습니다. 이대로 지우면 서버가 들고 있는 옛 내용이 되살립니다.');
    console.log('');
    console.log('  1. 서버를 내린다 (서버 창에서 Ctrl+C)');
    console.log('  2. npm run seed:clear');
    console.log('  3. npm start 로 다시 띄운다');
    process.exitCode = 1;
    return;
  }
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const me = db.users.find(u => u.email === EMAIL);
    if (!me) { console.log('시연 계정이 없습니다.'); return; }
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
    console.log(`시연 계정 ${EMAIL} 과 그 기록을 지웠습니다.`);
  } catch (err) {
    console.log(`못 지웠습니다 (${err.message}). ${EMAIL} 을 직접 지워주세요.`);
  }
}

// 주 3~4회. 12주 중 6주차는 통째로 쉰다 — 연속 주가 끊기는 자리를 눈으로 보려고
const WEEKS = 12;
const REST_WEEK = 6;
const DAYS_IN_WEEK = [0, 2, 4, 5]; // 월 수 금 토 (0=월). 주에 따라 3개나 4개를 쓴다

// 부위가 돌아가게. 같은 것만 넣으면 부위 그래프가 한 조각이 된다
const PLAN = [
  { part: '가슴', items: [['벤치프레스', 60], ['인클라인 덤벨프레스', 22], ['케이블 크로스오버', 15]] },
  { part: '등', items: [['랫풀다운', 50], ['시티드 로우', 45], ['풀업', null]] },
  { part: '하체', items: [['스쿼트', 80], ['레그프레스', 120], ['레그 컬', 35]] },
  { part: '어깨팔', items: [['숄더프레스', 30], ['사이드 레터럴 레이즈', 8], ['바벨 컬', 25]] },
];

async function seed() {
  console.log(`만드는 곳: ${BASE}`);
  console.log('석 달치를 넣습니다. 서버의 도배 방지(분당 60건)에 걸리면 기다렸다 이어 넣어서 몇 분 걸립니다.\n');

  let reg = await call('POST', '/auth/register',
    { email: EMAIL, password: PASSWORD, nickname: '시연', username: USERNAME });
  if (reg.status === 409) {
    console.log('이미 있는 계정입니다. 로그인해서 이어 넣습니다.');
    reg = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  }
  TOKEN = reg.data?.token || '';
  if (!TOKEN) {
    console.log('들어가지 못했습니다:', reg.status, JSON.stringify(reg.data));
    process.exit(1);
  }
  await call('PUT', '/auth/sex', { sex: 'male' });

  // **두 번 돌려도 두 배가 되지 않게.** 이미 있는 것은 건너뛴다 —
  // 지우기가 서버 캐시에 막혀 반만 지워진 상태에서 다시 돌리면 그대로 쌓인다
  const had = await call('GET', '/workouts');
  const already = new Set(
    (Array.isArray(had.data) ? had.data : []).map(w => `${w.date}|${w.exercise}`)
  );
  if (already.size) console.log(`이미 있는 기록 ${already.size}건은 건너뜁니다`);
  console.log('계정 준비 완료');

  // ── 운동 기록 ──
  let saved = 0;
  for (let w = 0; w < WEEKS; w += 1) {
    if (w === REST_WEEK) continue;                       // 이 주는 통째로 쉰다
    const daysThisWeek = DAYS_IN_WEEK.slice(0, w % 3 === 0 ? 4 : 3);
    for (let i = 0; i < daysThisWeek.length; i += 1) {
      // w=0 이 가장 오래된 주가 되게 거슬러 올라간다. 이번 주(w=WEEKS-1)까지 온다
      const date = dayKey(dayOfWeek(WEEKS - 1 - w, daysThisWeek[i]));
      // 아직 안 온 날은 넣지 않는다 — 이번 주의 남은 요일이 미래 기록이 되면 안 된다
      if (date > dayKey(TODAY)) continue;
      const plan = PLAN[(w + i) % PLAN.length];
      for (const [name, baseWeight] of plan.items) {
        // 주마다 조금씩 는다. 최고 기록이 갱신되는 자리가 생긴다
        const weight = baseWeight === null ? '맨몸' : baseWeight + Math.floor(w / 2) * 2.5;
        const reps = baseWeight === null ? 8 + (w % 5) : 10;
        if (already.has(`${date}|${name}`)) continue;
        const r = await create('/workouts', { date, exercise: name, weight, sets: 4, reps });
        if (r.status === 201) saved += 1;
        else if (saved === 0) console.log('  넣지 못했습니다:', r.status, JSON.stringify(r.data));
      }
    }
  }
  console.log(`운동 기록 ${saved}건 (${WEEKS}주치, ${REST_WEEK + 1}주차는 쉼)`);

  // ── 인바디 ── 2주에 한 번씩. 체중이 조금 줄고 근육이 조금 는다
  let ib = 0;
  for (let k = 0; k <= 6; k += 1) {
    const date = dayKey(daysAgo((6 - k) * 14));
    const r = await create('/inbody', {
      date,
      height: 175,
      weight: +(78 - k * 0.9).toFixed(1),
      fat_pct: +(22 - k * 0.8).toFixed(1),
      muscle_kg: +(31 + k * 0.5).toFixed(1),
      water_l: +(42 + k * 0.2).toFixed(1),
    });
    if (r.status === 201) ib += 1;
  }
  console.log(`인바디 ${ib}건`);

  // ── 측정 ── 종류별로 하나씩. 측정 화면의 칸이 다 차게
  const MEASURES = [
    ['bodySize', { chest: 102, waist: 84, hip: 98, arm_l: 35, arm_r: 35.5, thigh_l: 57, thigh_r: 57, calf: 38, neck: 39 }],
    ['oneRM', { exercise: '벤치프레스', weight: 80, reps: 5, orm: 90 }],
    ['fitness', { pushup: 42, pullup: 11, plank: 150, situp: 45 }],
    ['flexibility', { sitreach: -3, shoulder_l: 5, shoulder_r: 8 }],
    ['shoulder', { shoulder: 46, waist: 84, ratio: 1.55 }],
  ];
  let ms = 0;
  for (const [type, data] of MEASURES) {
    const r = await create('/measures', { date: dayKey(daysAgo(3)), type, data });
    if (r.status === 201) ms += 1;
  }
  console.log(`측정 ${ms}건`);

  // ── 루틴 ── 짜둔 것이 있어야 루틴 화면과 홈의 「이어서 하기」가 보인다
  let rt = 0;
  for (const plan of PLAN.slice(0, 3)) {
    const r = await create('/my-routines', {
      name: `${plan.part} 날`,
      exercises: plan.items.map(([name]) => ({ name, sets: '4세트', reps: '10회' })),
    });
    if (r.status === 201) rt += 1;
  }
  console.log(`루틴 ${rt}개`);

  // ── 제보 ── 관리자 화면에 손볼 것이 보이게. 답이 달린 것과 안 달린 것을 섞는다
  const REPORTS = [
    ['bug', '기록 화면에서 날짜가 안 바뀝니다', '화면: 기록\n---\n1. 날짜를 누른다\n2. 어제를 고른다\n3. 그대로다'],
    ['ask', '기기를 바꾸면 기록이 사라지나요', '폰을 바꾸려는데 걱정돼서요.'],
    ['idea', '휴식 타이머 소리를 고를 수 있으면 좋겠습니다', '지금 소리가 헬스장에서 잘 안 들립니다.'],
  ];
  let rp = 0;
  for (const [kind, title, body] of REPORTS) {
    const r = await create('/reports', { kind, title, body });
    if (r.status === 201) rp += 1;
  }
  console.log(`제보 ${rp}건`);

  await create('/ratings', { score: 4 });
  await call('PUT', '/reminders',
    { enabled: true, days: [1, 3, 5], time: '19:00', tzOffset: new Date().getTimezoneOffset(), streakGuard: true });

  console.log('\n──────────────────────────────');
  console.log(`  로그인: ${EMAIL} / ${PASSWORD}`);
  console.log('  지울 때: npm run seed:clear');
  console.log('──────────────────────────────');
}

(async () => {
  if (CLEAR) { await clear(); return; }
  await seed();
  await new Promise(r => setTimeout(r, 700));
})();
