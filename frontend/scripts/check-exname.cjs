// ── **고르는 목록에 같은 운동이 두 줄로 서지 않는가** ── (2026-11-27 · 맵시 · 벼림 넘김)
//
//   npm run exname     (npm run check 에도 들어 있다)
//
// 이 앱에서 운동 이름을 견주는 식은 `data/flatName.js` **하나**다. 그런데 기록 화면의
// 운동 필터만 이름을 **글자 그대로** 모았다 — 운동 이름은 홈 · 검색 · 루틴에서 **자유
// 글자**로 들어오니, 「벤치 프레스」와 「벤치프레스」를 둘 다 적은 사람에게는
//
//   · 고르는 칸에 **같은 운동이 두 줄**로 뜨고
//   · 어느 쪽을 골라도 그 글자와 똑같은 줄만 걸러져 **절반만** 보였다
//
// `check-samename` 은 **최고 기록**(`personalRecord.js`)을 본다. 이쪽은 **고르는 목록**이라
// 그 자의 과녁 밖이었다 — 같은 뿌리의 다른 자리다.
//
// ── 여기서 보는 것 ──
//
//   1. 변형 이름이 **한 줄로 묶인다**
//   2. 보일 이름은 **가장 많이 적은 꼴** (오타 한 번이 목록 이름을 못 바꾼다)
//   3. 같은 수면 **가장 최근 꼴** · 그래도 같으면 **글자 순**(같은 입력 → 같은 답)
//   4. 거를 때도 **눕혀** 견준다 — 다르게 적은 날이 빠지지 않는다
//   5. **다른 운동은 안 묶는다** — 「인클라인 벤치프레스」는 「벤치프레스」가 아니다
//   6. 화면이 **그 손을 쓴다** — 셈을 화면 안에 되돌려 두면 자가 떼어 돌릴 수 없다
//
// 되돌려-FAIL: `--되돌려` 를 주면 묶는 식을 **옛 꼴**(글자 그대로)로 돌린다
// → 1번이 두 줄로 뒤집혀 FAIL 이 보여야 한다
'use strict';
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const 손 = path.join(ROOT, 'src/data/exerciseNames.js');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : '  (기대: ' + JSON.stringify(want) + ')'));
};

// ── 되돌려: 눕히기 전으로 ───────────────────────────────────────────────────
const 되돌림 = process.argv.includes('--되돌려');
const 치울것 = [];
let 쓸손 = 손;
if (되돌림) {
  const src = fs.readFileSync(손, 'utf-8')
    .replace("      const 열쇠 = flatName(w && w.exercise);",
      "      const 열쇠 = String((w && w.exercise) || '').trim();");
  쓸손 = path.join(path.dirname(손), `.exerciseNames.revert.${process.pid}.js`);
  fs.writeFileSync(쓸손, src, 'utf-8');
  치울것.push(쓸손);
  console.log('── 되돌려: 묶는 식을 옛 꼴(글자 그대로)로 — 아래에 FAIL 이 있어야 한다 ──');
}
process.on('exit', () => { for (const f of 치울것) { try { fs.unlinkSync(f); } catch { /* 없다 */ } } });

const 짐 = path.join(ROOT, `.exname.${process.pid}.cjs`);
esbuild.buildSync({
  entryPoints: [쓸손], bundle: true, format: 'cjs', outfile: 짐,
  platform: 'node', logLevel: 'silent',
});
const N = require(path.resolve(짐));
fs.unlinkSync(짐);

const 줄 = (exercise) => ({ exercise, kg: 50, reps: 10 });

console.log('── 1. 변형 이름을 한 줄로 묶는다 ──');
ok('「벤치 프레스」 두 번 · 「벤치프레스」 한 번 → 한 줄', N.pickExerciseNames({
  '2026-11-01': [줄('벤치 프레스'), 줄('스쿼트')],
  '2026-11-02': [줄('벤치프레스'), 줄('벤치 프레스')],
}), ['벤치 프레스', '스쿼트']);

console.log('');
console.log('── 2. 보일 이름은 **가장 많이 적은 꼴** ──');
// ★ 사람이 보던 꼴 — 마지막 한 번을 오타로 적어도 목록 이름이 안 바뀐다
ok('많이 적은 쪽이 이긴다 (적게 적은 꼴이 더 최근이어도)', N.pickExerciseNames({
  '2026-11-01': [줄('벤치프레스'), 줄('벤치프레스'), 줄('벤치프레스')],
  '2026-11-20': [줄('벤 치프레스')],
}), ['벤치프레스']);
ok('  오타를 한 번 적어도 목록 이름이 그것으로 안 바뀐다', N.pickExerciseNames({
  '2026-11-01': [줄('데드리프트'), 줄('데드리프트')],
  '2026-11-25': [줄('데드리프트.')],
}), ['데드리프트']);

console.log('');
console.log('── 3. 같은 수면 최근 꼴 · 그래도 같으면 글자 순 ──');
ok('같은 수면 더 최근에 적은 꼴', N.pickExerciseNames({
  '2026-11-01': [줄('랫풀다운')],
  '2026-11-09': [줄('랫 풀다운')],
}), ['랫 풀다운']);
// 같은 입력이면 **늘 같은 답**이어야 한다 — 다시 그릴 때마다 이름이 바뀌면 안 된다
ok('  수도 날도 같으면 글자 순으로 못 박는다', N.pickExerciseNames({
  '2026-11-01': [줄('풀업'), 줄('풀 업')],
}), ['풀 업']);
ok('  같은 입력을 두 번 돌려도 같은 답', (() => {
  const 짐 = { '2026-11-01': [줄('풀업'), 줄('풀 업')] };
  return N.pickExerciseNames(짐)[0] === N.pickExerciseNames(짐)[0];
})(), true);

console.log('');
console.log('── 4. 거를 때도 눕혀 견준다 ──');
ok('고른 이름과 다르게 적은 줄도 걸러 나온다', [
  N.matchesExercise(줄('벤치프레스'), '벤치 프레스'),
  N.matchesExercise(줄('벤치 프레스'), '벤치프레스'),
  N.matchesExercise(줄('Bench Press'), '벤치프레스'),
], [true, true, false]);   // 한글·영문은 다른 글자다 (눕히기는 꼴만 걷는다)
ok('  고른 것이 없으면 다 통과한다 (전체 운동)', N.matchesExercise(줄('스쿼트'), ''), true);

console.log('');
console.log('── 5. 다른 운동은 안 묶는다 ──');
ok('「인클라인 벤치프레스」는 「벤치프레스」가 아니다', N.pickExerciseNames({
  '2026-11-01': [줄('벤치프레스'), 줄('인클라인 벤치프레스')],
}).length, 2);
ok('  빈 이름 · 공백만 적힌 줄은 목록에 안 선다', N.pickExerciseNames({
  '2026-11-01': [줄(''), 줄('   '), 줄(null), 줄('스쿼트')],
}), ['스쿼트']);

console.log('');
console.log('── 6. 화면이 그 손을 쓴다 ──');
// 셈을 화면 안으로 되돌려 두면 이 자가 **떼어 돌릴 것이 없어진다** — 그 되돌림을 막는다
{
  const 화면 = fs.readFileSync(path.join(ROOT, 'src/pages/HistoryPage.jsx'), 'utf-8');
  ok('기록 화면이 `pickExerciseNames` 를 부른다', /pickExerciseNames\(workouts\)/.test(화면), true);
  ok('  거르는 자리도 `matchesExercise` 를 부른다', /matchesExercise\(w,\s*filterExercise\)/.test(화면), true);
  ok('  글자 그대로 견주는 줄이 남아 있지 않다',
    /w\.exercise\s*===\s*filterExercise/.test(화면), false);
}

console.log('');
if (bad === 0) console.log('같은 운동이 한 줄로 섭니다');
else console.log(bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
