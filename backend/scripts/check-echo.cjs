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

// 지저분하게 적어본다 — 앞뒤 공백 · 가운데 겹공백 · 꺾쇠
const MESSY_NAME = '  월요일   가슴 ';
const MESSY_EX = ' 벤치 <b>프레스</b> ';
// 메모는 날짜마다 한 장이라 글을 바꿀 때마다 날짜도 바꾼다 (같은 날이면 고쳐진다)
const 오늘 = new Date().toISOString().slice(0, 10);

const app = express();
app.use(express.json());
app.use('/api/my-routines', require('../src/routes/myRoutines'));
app.use('/api/plans', require('../src/routes/plans'));
// 메모는 **사람이 글을 길게 적는 자리**다 — 꺾쇠·따옴표·&가 뜻을 지는 곳이다
app.use('/api/notes', require('../src/routes/notes'));

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
      exercises: [{ name: ' 랫 <i>풀다운</i> ', sets: 4, reps: 12 }],
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
    console.log('── 태그는 걷는가 ──');
    for (const [글, 남을것] of [['<b>어깨</b> 아픔', '어깨 아픔'],
                               ['<script>alert(1)</script>끝', '1)끝'],
                               ['<img src=x onerror=alert(1)>메모', '메모'],
                               ['<b>x</b>', 'x']]) {
      const r = await send('/notes', 'POST', { date: 오늘, body: 글 });
      ok(`  ${JSON.stringify(글)}`, r.body?.body, 남을것);
      ok('    태그 꼴이 안 남는다', /<\s*[/!?a-zA-Z]/.test(String(r.body?.body || '')), false);
    }
    // **글이 통째로 태그면 안 담는다** — 걷고 나면 남는 글자가 없다.
    // 겹쳐 쓴 꼴(`<<script>…`)도 고리를 돌려 다 걷으므로 여기로 떨어진다
    for (const 글 of ['<<script>alert(1)</script>', '<b></b>', '<div><span></span></div>']) {
      const r = await send('/notes', 'POST', { date: 오늘, body: 글 });
      ok(`  ${JSON.stringify(글)} 는 거절`, [r.status, r.body?.error], [400, '메모 내용을 적어주세요']);
    }
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
