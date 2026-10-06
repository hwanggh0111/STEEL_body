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

  console.log('\n' + (bad ? `${bad}건 실패` : '전부 통과'));
  process.exit(bad ? 1 : 0);
})();
