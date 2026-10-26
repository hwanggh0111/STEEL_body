// 기능성운동 판을 기록으로 남길 때 (2026-10-06).
//
//   npm run hwsave     (npm run check 에도 들어 있다)
//
// ── 무엇이 잘못돼 있었나 ──
//
// 판을 끝내고 「운동 기록에 남기기」를 누르면 **부위별로 줄 여럿**이 저장된다
// (`toRecords`). 그 저장이 이렇게 돼 있었다 —
//
//     try {
//       for (const r of rows) await addWorkout(r);
//       …
//     } catch {
//       toast('기록을 못 올렸어요. 직접 적어주세요');
//     }
//
// **터진 것이 세 번째 줄이면 앞의 둘은 이미 올라가 있다.** 그런데 화면은
// 「못 올렸어요」라고 하고 기록 화면으로 보낸다 — 그 말을 믿고 직접 적으면
// **앞의 둘이 두 번 쌓인다.** 「못 올렸다」가 사실이 아니었다.
//
// 신호가 없는 것은 터지지 않는다(`workoutStore` 가 줄에 담아둔다). 여기서 터지는
// 것은 서버가 「그렇게는 안 받는다」고 답한 것이고 다시 보내도 마찬가지다 —
// 그러니 **무엇이 올라갔고 무엇이 안 올라갔는지** 말하는 것이 할 수 있는 전부다.
//
// ── 화면으로 확인할 수 없는 자리다 ──
//
// 서버가 **가운데 줄만** 거절하게 만들려면 손으로는 거의 못 한다. 그래서 여기서
// 값으로 본다 — `toRecords` 가 주는 줄로 그 셈을 그대로 돌려본다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const hw = bundle('src/data/homeworkoutParts.js', '.hwparts.cjs');
// **판을 지어내지 않는다.** 부위는 판에 적혀 있고(`main` · `sub`), 내가 이름을
// 지어 쓰면 `partsOf` 가 아무 부위도 못 찾아 줄이 0개가 된다 — 처음에
// 「푸시업 · 스쿼트 · 플랭크」로 썼다가 그렇게 빈 손으로 통과할 뻔했다
const prog = bundle('src/data/homeworkoutPrograms.js', '.hwprog.cjs');

let bad = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label} → ${JSON.stringify(got)}${pass ? '' : ` (기대: ${JSON.stringify(want)})`}`);
};

// **앱에 들어 있는 첫 판을 그대로 쓴다.** 부위가 둘 이상으로 갈리는 판을 고른다 —
// 한 부위만 나오면 「가운데 줄이 거절되면」을 볼 수가 없다
const NAME = Object.keys(prog.PROGRAMS).find((k) => {
  const r = hw.toRecords(prog.PROGRAMS[k], prog.PROGRAMS[k].length, k);
  return r.length >= 2;
});
const LIST = prog.PROGRAMS[NAME];

console.log('── 판 하나가 몇 줄로 쌓이나 ── (' + NAME + ')');
const rows = hw.toRecords(LIST, LIST.length, NAME);
ok('부위별로 갈린다', rows.length >= 2, true);
ok('  이름에 판 이름이 붙는다', rows.every((r) => r.exercise.startsWith(NAME + ' · ')), true);
ok('  맨몸이라 무게가 비어 있다', rows.every((r) => r.weight === ''), true);

// ── 화면이 하는 셈을 그대로 돌린다 ──
//
// 서버가 **가운데 줄 하나만** 거절한다고 치고, 올라간 줄과 못 올라간 줄을
// 갈라 세는지 본다
async function run(rejectIdx) {
  const add = async (r) => { if (r.exercise === rows[rejectIdx]?.exercise) throw new Error('400'); };
  const failed = [];
  for (const r of rows) { try { await add(r); } catch { failed.push(r); } }
  const saved = rows.length - failed.length;
  return { saved, failed };
}

(async () => {
  console.log('');
  console.log('── 가운데 줄이 거절되면 ──');
  const mid = await run(1);
  ok('앞의 줄은 올라간 것으로 센다', mid.saved, rows.length - 1);
  ok('  못 올라간 줄만 따로 센다', mid.failed.length, 1);
  // **올라간 것을 기록 화면에 들려 보내면 그것을 또 적게 된다**
  ok('  기록 화면에 들려 보낼 것은 못 올라간 줄이다',
    mid.failed[0].exercise, rows[1].exercise);
  ok('  올라간 줄을 들려 보내지 않는다',
    mid.failed[0].exercise === rows[0].exercise, false);

  console.log('');
  console.log('── 다 올라가면 ──');
  const all = await run(-1);
  ok('못 올라간 줄이 없다', all.failed.length, 0);
  ok('  올라간 줄이 전부다', all.saved, rows.length);

  console.log('');
  console.log('── 화면이 그렇게 적혀 있나 ──');
  const page = fs.readFileSync('src/pages/HomeworkoutPage.jsx', 'utf8');
  // for 를 try 로 통째로 감싸면 **부분 저장을 못 센다**
  ok('줄마다 따로 받아낸다 (failed 를 센다)', /const failed = \[\]/.test(page), true);
  ok('  몇 줄 올라갔는지 센다', /const saved = rows\.length - failed\.length/.test(page), true);
  ok('  못 올라간 부위 이름을 말한다', /안 올라갔어요/.test(page), true);
  ok('  못 올라간 줄을 들려 보낸다', /exercise: failed\[0\]\.exercise/.test(page), true);

  // 줄마다 목록 전체를 다시 받으면 왕복이 두 배다 (부위 다섯이면 조회 다섯)
  ok('줄마다 목록을 다시 안 받는다', /\{ refetch: false \}/.test(page), true);
  ok('  마지막에 한 번 받는다', /if \(saved > 0\) await fetchAll\(true\)/.test(page), true);
  const store = fs.readFileSync('src/store/workoutStore.js', 'utf8');
  ok('  끄는 길이 스토어에 있다', /addWorkout: async \(workout, \{ refetch = true \} = \{\}\)/.test(store), true);
  // **기본값은 켜져 있어야 한다** — 혼자 쓰는 자리에서 끄면 최고 기록이 잘못 뜬다
  ok('  기본값은 켜져 있다', /refetch = true/.test(store), true);

console.log('\n── **한 것만 세는가** ── (2026-10-26)');
//
// 「넘기기」는 **오늘 안 되는 동작**을 지나가는 단추다(노르딕 컬 · 월 핸드스탠드 홀드).
// 그런데 셈이 화면 안에 네 벌로 흩어져 있었고 — 몸 그림 · 움직인 시간 · 진행 막대 ·
// **기록 줄** — 기록 쪽만 틀렸다. 두 가지가 같이 나왔다:
//
//   · **넘긴 동작이 한 것으로 적혔다.** 하지 않은 운동이 서버와 몸 지도에 남고,
//     그 지도가 「오늘 뭘 하지」를 고른다
//   · **쉬는 중에 멈추고 적으면 방금 끝낸 동작이 빠졌다**(`currentIdx` 를 그대로 썼다).
//     첫 동작 뒤 휴식에서 멈추면 「여기까지 기록하기」가 **꺼져 있었다**(0 < 1)
const L = prog.PROGRAMS[NAME];
const at = (o) => hw.doneList(L, o).length;
ok('운동 중이면 지나온 것까지', at({ idx: 3, rest: false }), 3);
ok('  **쉬는 중이면 방금 끝낸 것까지**', at({ idx: 3, rest: true }), 4);
ok('  첫 동작 뒤 휴식이면 하나는 센다 (단추가 켜진다)', at({ idx: 0, rest: true }), 1);
ok('  아직 아무것도 안 했으면 0', at({ idx: 0, rest: false }), 0);
ok('  끝냈으면 전부', at({ done: true }), L.length);
ok('넘긴 동작은 뺀다', at({ idx: 5, rest: false, skipped: [1, 3] }), 3);
ok('  끝까지 갔어도 뺀다', at({ done: true, skipped: [0] }), L.length - 1);
ok('  아직 안 간 번호를 넘겼다고 해도 안 흔들린다', at({ idx: 2, rest: false, skipped: [7] }), 2);
ok('  Set 으로 줘도 같다', at({ idx: 5, rest: false, skipped: new Set([1, 3]) }), 3);
ok('이상한 값에도 안 터진다',
  [hw.doneList(null, {}).length, hw.doneList(L, undefined).length,
    at({ idx: -5, rest: true }), at({ idx: 999, rest: false })],
  [0, 0, 0, L.length]);

// **기록 줄도 그것을 쓴다** — 넘긴 동작의 부위가 줄에 섞이면 안 된다
{
  const all = hw.toRecords(L, L.length, NAME);
  const skipFirst = hw.doneList(L, { done: true, skipped: [0] });
  const less = hw.toRecords(skipFirst, skipFirst.length, NAME);
  const sum = (rs) => rs.reduce((n, r) => n + r.sets, 0);
  ok('넘긴 한 동작만큼 세트가 줄어든다', sum(all) - sum(less), hw.partsOf(L[0]).main.length);
}

console.log('\n── 화면이 그 자를 쓰는가 ──');
{
  const page = fs.readFileSync('src/pages/HomeworkoutPage.jsx', 'utf-8');
  ok('셈을 값 쪽에서 가져온다', /doneList\(exercises, \{/.test(page), true);
  ok('  몸 그림 · 기록 · 시간이 같은 것을 쓴다',
    [/buildPump\(doneRows, doneRows\.length\)/.test(page),
      /goRecord\(doneRows\)/.test(page),
      /doneRows\.reduce\(\(sum, e\) => sum \+ e\.duration, 0\)/.test(page)], [true, true, true]);
  ok('  「여기까지 기록하기」가 그 수로 켜진다', /disabled=\{doneRows\.length < 1\}/.test(page), true);
  ok('  옛 셈(currentIdx 로 기록)이 남아 있지 않다', /goRecord\(currentIdx\)/.test(page), false);

  // **사람이 넘긴 것과 시계가 끝난 것을 가린다** — 안 가리면 쉬는 중에 「넘기기」를
  // 눌렀을 때 숨이 차 있으면 **쉬는 시간이 늘어난다**(넘기려고 누른 단추가 반대로 간다)
  ok('넘긴 것인지 시계가 끝난 것인지 가린다', /const advance = \(bySkip = false\)/.test(page), true);
  ok('  넘겼으면 쉬는 시간을 안 늘린다', /if \(!bySkip && rest && breath\.on/.test(page), true);
  ok('  넘긴 동작을 적어둔다', /if \(bySkip && !rest\) skippedRef/.test(page), true);
  ok('  넘긴 동작의 숨 최고치는 안 적는다', /if \(!bySkip && !rest && breath\.on/.test(page), true);
  ok('  「넘기기」가 그 길로 부른다', /advance\(true\);/.test(page), true);
  // 주석에는 그 글자가 **까닭으로** 남아 있다 — 세미콜론까지 봐서 코드만 센다
  ok('  「더 안 줘도 돼요」도 (99 로 속이지 않는다)',
    [/onSkip=\{\(\) => advanceRef\.current\(true\)\}/.test(page), /setExtraGiven\(99\);/.test(page)],
    [true, false]);

  // **판을 새로 시작하면 지난 판의 것을 들고 가지 않는다** — 숨 최고치는 칸 번호로
  // 묶여 있어서, 여덟 개짜리 뒤에 다섯 개짜리를 돌리면 앞 판의 여섯째가 끝 화면에 올라왔다
  ok('새 판은 지난 판의 숨 최고치를 버린다', /peaksRef\.current = \[\];/.test(page), true);
  ok('  넘긴 동작도 같이 버린다', /skippedRef\.current = new Set\(\);/.test(page), true);
}

  console.log('');
  console.log('── **「부위별 몇 줄로 적혀요」가 사실인가** ── (2026-10-26)');
  //
  // 끝 화면이 「아래를 누르면 **부위별 N줄**로 적히고 몸 지도에도 쌓여요」라고
  // 미리 적어준다. 그런데 그 N 을 **「건드린 부위」**(`touched`)로 세고 있었다 —
  // 적히는 줄은 **주로 쓴 부위만**이다(`toRecords` 는 `main` 만 센다. 곁들여 쓴 것까지
  // 적으면 베어 크롤 한 번으로 하체까지 한 것이 된다고 그 파일에 적어뒀다).
  //
  // 그래서 **아홉 판 중 여덟이 어긋났다** — 「코어 강화」는 5줄이라 적고 2줄,
  // 「전신 초급」은 6줄이라 적고 4줄. 누르기 전에 한 약속이 지켜지지 않는다.
  {
    const wrong = Object.entries(prog.PROGRAMS).filter(([n, exs]) => {
      const pump = hw.buildPump(exs, exs.length);
      return pump.touched.length !== hw.toRecords(exs, exs.length, n).length;
    }).map(([n]) => n);
    // 데이터가 그런 꼴이라는 것을 못 박아둔다 — 이것이 0 이면 아래 검사가 뜻이 없다
    ok('건드린 부위와 적히는 줄은 **원래 다르다** (곁들인 곳은 안 적는다)', wrong.length >= 5, true);

    const page = fs.readFileSync('src/pages/HomeworkoutPage.jsx', 'utf-8');
    ok('화면은 **적는 그 함수**에 물어본다', /부위별 \{recordRows\.length\}줄/.test(page), true);
    ok('  건드린 부위로 세지 않는다', /부위별 \{donePump\.touched\.length\}줄/.test(page), false);
    ok('  그 줄은 한 동작만 넘긴다 (`doneRows`)',
      /const recordRows = toRecords\(doneRows, doneRows\.length, selected\)/.test(page), true);
  }

  console.log('\n' + (bad ? `${bad}건 실패` : '전부 통과'));
  process.exit(bad ? 1 : 0);
})();
