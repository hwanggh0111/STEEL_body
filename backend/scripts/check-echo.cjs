// **담은 것을 되돌려 말하는가** (2026-10-28).
//
//   npm run echo      (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 서버는 사람이 적은 글자를 **그대로 담지 않는다** — 이름의 앞뒤 공백을 떼고,
// 가운데 겹친 공백을 한 칸으로 줄이고, **태그 꼴**을 걷어낸다(`cleanName`·`sanitize`).
// 그런데 「내 루틴」을 만드는 자리는 **번호만** 돌려줬다. 받은 화면은 돌려줄 글자가
// 없으니 **자기가 보낸 날글**을 목록에 얹었다 —
//
//   사람이 적은 것 : 「월요일   가슴」   목록에 보이는 것 : 「월요일   가슴」
//   서버에 담긴 것 : 「월요일 가슴」     새로고침한 뒤   : 「월요일 가슴」
//
// 고치기(`PUT`)는 더 억울한 자리였다 — 서버가 **담은 것을 돌려주고 있는데**
// (`result.record`) 화면이 응답을 통째로 버렸다. 10/26 에 다섯 번 밟은 그 모양이다
// (「서버는 할 말을 들고 있는데 그 말이 사람에게 안 닿는다」).
//
// ── 여기가 지키는 것 ──
//
// **진짜로 두드린다.** 글자를 보는 것으로는 「돌려준다고 적어놓고 딴 값을 돌려주는」
// 자리를 못 잡는다. 지저분한 글자를 보내고, **돌려준 것**과 **담긴 것**을 견준다.
//
// 운동 기록(`workouts`)은 이 목록에 없다 — 그쪽은 저장한 뒤 **목록을 다시 받아온다**
// (`workoutStore.fetchAll`). 돌려주는 것과 다시 받는 것 중 하나면 된다.
const path = require('path');
const TMP = path.join(__dirname, '..', '.check-echo.json');
process.env.DB_FILE = TMP;
process.env.JWT_SECRET = 'check-echo-' + 'x'.repeat(30);
process.env.NODE_ENV = 'test';

const db = require('../src/db');
// 나가는 길에 임시 DB 를 치운다 — `db.js` 의 exit 손이 되살리는 것까지 (2026-10-28)
require('./_tmpdb.cjs')(TMP);
const express = require('express');
const jwt = require('jsonwebtoken');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 지저분하게 적어본다 — 앞뒤 공백 · 가운데 겹공백.
//
// ★ **태그는 이제 이름 칸에서 거절된다** (2026-11-17, 주인 결정). 여기 `MESSY_EX` 가
// `' 벤치 <b>프레스</b> '` 였다 — 그 꼴은 태그를 걷어 담겼다. 그런데 같은 걷기가
// **사람이 적은 이름을 조용히 자르고 있었다**(「L<R 불균형」 → 「L」). 그래서 이름
// 칸은 **거절하고 까닭을 말한다**. 이 자리는 「다듬은 것을 그대로 돌려주는가」를
// 보는 자리라 **태그 없이** 지저분한 이름으로 본다 — 태그 거절은 아래에서 따로 본다.
const MESSY_NAME = '  월요일   가슴 ';
const MESSY_EX = ' 벤치   프레스 ';
// 메모는 날짜마다 한 장이라 글을 바꿀 때마다 날짜도 바꾼다 (같은 날이면 고쳐진다)
const 오늘 = new Date().toISOString().slice(0, 10);

const app = express();
app.use(express.json());
app.use('/api/my-routines', require('../src/routes/myRoutines'));
app.use('/api/plans', require('../src/routes/plans'));
// 메모는 **사람이 글을 길게 적는 자리**다 — 꺾쇠·따옴표·&가 뜻을 지는 곳이다
app.use('/api/notes', require('../src/routes/notes'));
// 운동 이름도 같은 선이다 — 이름이 조용히 잘리면 그 줄은 사전에 없는 이름이 되어
// 몸 지도에서 빠진다 (2026-11-17)
app.use('/api/workouts', require('../src/routes/workouts'));

db.createUser('echo@test.local', 'x', '나', 'echoman');
const me = db.findUserByEmail('echo@test.local');
const token = jwt.sign({ userId: me.id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '10m' });

const server = app.listen(0, run);

async function run() {
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
  const send = (p, method, body) => fetch(base + p, { method, headers: H, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json() }));

  try {
    console.log('── 내 루틴: 만들 때 ──');
    const made = await send('/my-routines', 'POST', {
      name: MESSY_NAME,
      exercises: [{ name: MESSY_EX, sets: 3, reps: 10 }],
    });
    ok('만들어진다', made.status, 201);
    const list1 = (await fetch(base + '/my-routines', { headers: H }).then((r) => r.json()));
    const kept = list1.find((r) => r.id === made.body.id);
    ok('  담긴 글자가 날글과 다르다', kept.name !== MESSY_NAME, true);
    // **여기가 핵심이다** — 돌려준 것이 담긴 것과 같아야, 화면이 그것을 얹을 수 있다
    ok('  돌려준 이름 = 담긴 이름', made.body.name, kept.name);
    ok('  돌려준 운동 이름 = 담긴 것', (made.body.exercises || [])[0]?.name, kept.exercises[0].name);

    console.log('');
    console.log('── 내 루틴: 고칠 때 ──');
    const put = await send('/my-routines/' + made.body.id, 'PUT', {
      name: '  화요일   등 ',
      // 태그는 이제 거절된다(아래에서 따로 본다) — 여기는 **다듬어 돌려주는가**를 본다
      exercises: [{ name: ' 랫   풀다운 ', sets: 4, reps: 12 }],
    });
    ok('고쳐진다', put.status, 200);
    const list2 = (await fetch(base + '/my-routines', { headers: H }).then((r) => r.json()));
    const kept2 = list2.find((r) => r.id === made.body.id);
    ok('  돌려준 이름 = 담긴 이름', put.body.name, kept2.name);
    ok('  돌려준 운동 이름 = 담긴 것', (put.body.exercises || [])[0]?.name, kept2.exercises[0].name);

    console.log('');
    console.log('── 계획: 만들 때 ──');
    const plan = await send('/plans', 'POST', { name: MESSY_NAME, date: '2026-10-28', kind: 'exercise' });
    ok('만들어진다', plan.status, 201);
    if (plan.status === 201) {
      const plans = (await fetch(base + '/plans', { headers: H }).then((r) => r.json()));
      const keptPlan = plans.find((p) => p.id === plan.body.id);
      ok('  돌려준 이름 = 담긴 이름', plan.body.name, keptPlan && keptPlan.name);
    }

    // ── **사람이 적은 글이 조용히 바뀌고 있었다** ── (2026-11-03)
    //
    // 새니타이즈가 `[<>"'&`]` 를 **글자째 지웠다.** 자르는 것보다 나쁘다 —
    // **뜻이 바뀐다**:
    //
    //   「무게 60>65」      → 「무게 6065」    숫자가 붙어 기록이 사라진다
    //   「벤치 60 -> 65」   → 「벤치 60 - 65」 올린 것이 뺄셈으로 보인다
    //   「허리 각도 < 45도」 → 「허리 각도 45도」 **반대로 읽힌다**
    //   「벤치 & 스쿼트」    → 「벤치 스쿼트」
    //
    // 그 값이 HTML 로 들어가는 자리는 **하나도 없다**(화면에 `dangerouslySetInnerHTML`
    // 이 없고, 메일은 이미 이스케이프하고, CSV 는 따옴표를 `""` 로 감싼다).
    // 그래서 **태그 꼴만** 걷는다. 양쪽을 다 본다 — 사람 글은 남고, 태그는 지워진다
    console.log('');
    console.log('── 사람이 적은 글이 그대로 남는가 ──');
    for (const 글 of ['무게 60>65', '벤치 60 -> 65 올렸다', '허리 각도 < 45도 유지',
                      '벤치 & 스쿼트', "don't stop", '"빅3" 날', '1<2<3']) {
      const r = await send('/notes', 'POST', { date: 오늘, body: 글 });
      ok(`  ${JSON.stringify(글)}`, r.body?.body, 글);
    }
    // ── ★ **메모의 태그는 걷지 않고 거절한다** ── (2026-11-17, 주인 결정)
    //
    // 여기는 「걷어서 남는 글자」를 기대하고 있었다 — `<b>어깨</b> 아픔` → 「어깨 아픔」.
    // 그 선으로는 **`L<R 불균형` 이 「L」로 조용히 잘려** 담겼다. 이름 칸은 11/17 에
    // 거절로 바뀌었는데 메모만 옛 선이라, 주인에게 갈래로 올려 **「이름 칸과 같게
    // 거절한다」**를 받았다.
    //
    // **대가를 알고 고른 것이다** — 걷어서 담던 넷도 이제 거절된다. 그 대신
    // **조용히 잘리는 일이 없어진다.** 아래 「사람이 적은 글」 묶음이 그대로 통과하는
    // 것이 짝이다(11/03 의 선) — 홀로 쓰인 꺾쇠는 지우지도 거절하지도 않는다.
    //
    // 까닭 글은 **베껴 적지 않는다** — 서버가 쓰는 그 자리에서 읽는다
    const { ANGLE_WHY: 꺾쇠까닭 } = require('../src/utils/sanitize');
    console.log('── 태그 모양은 거절하는가 ──');
    for (const 글 of ['<b>어깨</b> 아픔', '<script>alert(1)</script>끝',
                      '<img src=x onerror=alert(1)>메모', '<b>x</b>',
                      '<<script>alert(1)</script>', '<b></b>', '<div><span></span></div>']) {
      const r = await send('/notes', 'POST', { date: 오늘, body: 글 });
      ok(`  ${JSON.stringify(글)} 는 거절`, [r.status, r.body?.error], [400, 꺾쇠까닭]);
    }
    // ★ **띄어 쓴 꺾쇠는 담긴다** — 거절 문구가 가리키는 길이다. 이 줄이 없으면
    // 「전부 거절」로 조여도 자가 조용하다 (`check-angle` 이 식 쪽을 따로 본다)
    for (const 글 of ['L < R 불균형', '허리 각도 < 45도']) {
      const r = await send('/notes', 'POST', { date: 오늘, body: 글 });
      ok(`  ${JSON.stringify(글)} 는 그대로 담긴다`, r.body?.body, 글);
    }
    console.log('');
    console.log('── ★ 이름 칸의 태그는 거절하고 까닭을 말하는가 ── (2026-11-17)');
    //
    // 까닭 글은 **베껴 적지 않는다** — 서버가 쓰는 그 자리에서 읽는다
    // (베끼면 글을 다듬는 날 자만 옛 글을 본다)
    const ANGLE_WHY = 꺾쇠까닭;
    for (const [길, 몸] of [
      ['/my-routines', { name: '<b>월요일</b>', exercises: [{ name: '벤치프레스', sets: 3, reps: 10 }] }],
      ['/my-routines', { name: '월요일', exercises: [{ name: 'L<R 불균형', sets: 3, reps: 10 }] }],
      ['/plans', { name: 'L<R 불균형', date: '2026-10-29', kind: 'exercise' }],
    ]) {
      const r = await send(길, 'POST', 몸);
      ok(`  ${길} ${JSON.stringify(몸.name || 몸.exercise)}`, [r.status, r.body?.error], [400, ANGLE_WHY]);
    }
    // ── 운동 기록은 **사람 UA 로** 두드린다 ──
    // `POST /workouts` 에는 `spamCheck` 가 걸려 있어 도구 UA 를 막는다
    // (`check-range.cjs` 가 같은 까닭으로 UA 를 달고 있다)
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';
    const 기록 = (몸) => fetch(base + '/workouts', {
      method: 'POST', headers: { ...H, 'User-Agent': UA }, body: JSON.stringify(몸),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    const 잘릴것 = await 기록({ date: 오늘, exercise: 'L<R 불균형', weight: '60', sets: 3, reps: 10 });
    ok('  /workouts "L<R 불균형"', [잘릴것.status, 잘릴것.body?.error], [400, ANGLE_WHY]);
    // **사람이 적은 꺾쇠는 그대로 담긴다** — 띄어 쓰거나 숫자가 오는 꼴
    const 꺾 = await 기록({ date: 오늘, exercise: '벤치 60>65', weight: '60', sets: 3, reps: 10 });
    ok('  「벤치 60>65」는 담긴다',
      [꺾.status, 꺾.body?.workout?.exercise || 꺾.body?.exercise], [201, '벤치 60>65']);

  } catch (err) {
    bad += 1;
    console.error(err);
  } finally {
    server.close();
    db.flushNow();
    setTimeout(() => {
      console.log('');
      console.log(bad === 0 ? '모두 통과' : bad + '건 FAIL');
      process.exit(bad === 0 ? 0 : 1);
    }, 200);
  }
}
