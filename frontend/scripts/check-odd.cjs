// 이상한 값이 와도 안 터지는가 — **흰 화면 막기.**
//
//   npm run odd
//
// 이 앱은 **서버가 준 모양을 화면이 다르게 읽는 일로 세 번 당했다**
// (8/24 `/security/dashboard` · 8/26 `/security/logs` · 8/28 응답 모양 다섯).
// 배열이 올 자리에 객체가 오면 `.filter` 가 없어서 그 자리에서 터지고, 터지면 흰 화면이다.
//
// 그래서 화면이 쓰는 계산에 **말도 안 되는 값을 다 넣어본다** — undefined · null · 숫자 ·
// 문자열 · 빈 객체 · `[null]` 같은 것들. 빈 목록으로 보고 그리면 화면은 「없습니다」를
// 보여준다. 그것과 아무것도 안 보여주는 것은 다르다.
//
// 2026-09-02 에 처음 돌렸을 때 **51군데에서 터졌다.**
const esbuild = require('esbuild');
const fs = require('fs');
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const load = (file, out) => {
  esbuild.buildSync({ entryPoints: [file], bundle: true, format: 'cjs', outfile: out, platform: 'node',
    define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const WEIRD = [undefined, null, '', 0, -1, NaN, [], {}, 'abc', '   ', [null], [{}], [{ date: null }]];
let hits = 0;

function tryAll(label, fn, argsList) {
  for (const args of argsList) {
    try { fn(...args); } catch (e) {
      hits += 1;
      console.log(`터짐  ${label}(${args.map(a => JSON.stringify(a)).join(', ')}) → ${e.message}`);
    }
  }
}

const plans = load('src/data/plans.js', '.f1.cjs');
tryAll('plansByDate', plans.plansByDate, WEIRD.map(w => [w]));
tryAll('planState', plans.planState, WEIRD.flatMap(a => WEIRD.map(b => [a, b, []])));
tryAll('upcoming', plans.upcoming, WEIRD.map(w => [w, '2026-09-02', {}]));
tryAll('missedCount', plans.missedCount, WEIRD.map(w => [w, '2026-09-02', {}]));
tryAll('dayLabel', plans.dayLabel, WEIRD.map(w => [w]));
tryAll('untilLabel', plans.untilLabel, WEIRD.map(w => [w, '2026-09-02']));

const mc = load('src/data/measureChange.js', '.f2.cjs');
tryAll('changeOf', mc.changeOf, WEIRD.map(w => [w, 'pushup']));
tryAll('bestOf', mc.bestOf, WEIRD.map(w => [w, 'pushup', 'up']));
tryAll('diffLabel', mc.diffLabel, WEIRD.map(w => [w, 'kg']));
tryAll('sinceLabel', mc.sinceLabel, WEIRD.map(w => [w]));
tryAll('mmss', mc.mmss, WEIRD.map(w => [w]));
tryAll('toSeconds', mc.toSeconds, WEIRD.flatMap(a => WEIRD.map(b => [a, b])));

const cmp = load('src/data/compare.js', '.f3.cjs');
tryAll('orderPick', cmp.orderPick, WEIRD.flatMap(a => WEIRD.map(b => [a, b])));
tryAll('daysBetween', cmp.daysBetween, WEIRD.flatMap(a => WEIRD.map(b => [a, b])));
tryAll('spanLabel', cmp.spanLabel, WEIRD.map(w => [w]));
tryAll('changes', cmp.changes, WEIRD.flatMap(a => WEIRD.map(b => [a, b])));
tryAll('diffLabel', cmp.diffLabel, WEIRD.map(w => [w]));

const rv = load('src/pages/support/reportView.js', '.f4.cjs');
tryAll('hasReply', rv.hasReply, WEIRD.map(w => [w]));
tryAll('isNewReply', rv.isNewReply, WEIRD.flatMap(a => WEIRD.map(b => [a, b])));
tryAll('viewReports', rv.viewReports, WEIRD.map(w => [w, 'all', '']));
tryAll('filterCounts', rv.filterCounts, WEIRD.map(w => [w]));
tryAll('newReplyCount', rv.newReplyCount, WEIRD.map(w => [w, '']));
tryAll('sortReports', rv.sortReports, WEIRD.map(w => [w, '']));

const form = load('src/data/exerciseForm.js', '.f5.cjs');
tryAll('formOf', form.formOf, WEIRD.map(w => [w]));

const dict = load('src/data/exerciseDict.js', '.f6.cjs');
tryAll('searchExercises', dict.searchExercises, WEIRD.map(w => [w]));
tryAll('byCategory', dict.byCategory, WEIRD.map(w => [w]));
tryAll('partOf', dict.partOf, WEIRD.map(w => [w]));
tryAll('isPart', dict.isPart, WEIRD.map(w => [w]));
tryAll('koreanNameOf', dict.koreanNameOf, WEIRD.map(w => [w]));
tryAll('translateQuery', dict.translateQuery, WEIRD.map(w => [w]));

const hw = load('src/data/homeworkoutPrograms.js', '.f7.cjs');
tryAll('descOf', hw.descOf, WEIRD.map(w => [w]));
tryAll('gearOf', hw.gearOf, WEIRD.map(w => [w]));
tryAll('loudOf', hw.loudOf, WEIRD.map(w => [w]));

const mg = load('src/data/monthGrid.js', '.f8.cjs');
tryAll('monthGrid', mg.monthGrid, WEIRD.flatMap(a => WEIRD.map(b => [a, b])));
tryAll('monthSummary', mg.monthSummary, WEIRD.map(w => [w, 2026, 9]));
tryAll('monthsWithRecords', mg.monthsWithRecords, WEIRD.map(w => [w]));
tryAll('partOfDay', mg.partOfDay, WEIRD.map(w => [w]));
tryAll('shiftMonth', mg.shiftMonth, WEIRD.map(w => [w, 1]));

console.log('');
console.log(hits ? hits + '군데에서 터집니다' : '이상한 값에도 안 터집니다');
process.exit(hits ? 1 : 0);
