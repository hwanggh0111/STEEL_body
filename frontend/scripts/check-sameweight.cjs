// 같은 무게 최다 횟수 (2026-11-12, 시안 1112 B) — `src/data/sameWeight.js`
//
//   node scripts/check-sameweight.cjs
//
// 「80kg 으로 가장 많이 했어요 · 10회」가 **떠야 할 때만** 뜨는가.
// 첫 기록 · 드롭 · 맨몸 · 앞날 · 같은 횟수에서는 안 떠야 한다
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};
const { sameWeightBest } = bundle('src/data/sameWeight.js', '.sw1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const TODAY = '2026-11-12';
const W = {
  '2026-10-14': [{ exercise: '벤치프레스', weight: '80', sets: 3, reps: 8 }],
  '2026-10-21': [
    { exercise: '벤치프레스', weight: '80', sets: 3, reps: 9 },
    { exercise: '벤치프레스', weight: '60', sets: 1, reps: 15, link: 'drop' },
  ],
  '2026-11-01': [{ exercise: '벤치프레스', weight: '100', sets: 1, reps: 3 }],
  '2026-11-20': [{ exercise: '벤치프레스', weight: '80', sets: 1, reps: 20 }],   // 앞날
  '2026-11-05': [{ exercise: '푸시업', weight: '맨몸', sets: 3, reps: 20 }],
};
const at = (row) => sameWeightBest(W, row, TODAY);

ok('전보다 많으면 뜬다', at({ exercise: '벤치프레스', weight: 80, reps: 10 }),
  { exercise: '벤치프레스', kg: 80, reps: 10, prevReps: 9, prevDate: '2026-10-21' });
ok('  앞날 20회는 안 센다', at({ exercise: '벤치프레스', weight: 80, reps: 10 })?.prevReps, 9);
ok('같은 횟수면 안 뜬다', at({ exercise: '벤치프레스', weight: 80, reps: 9 }), null);
ok('적으면 안 뜬다', at({ exercise: '벤치프레스', weight: 80, reps: 5 }), null);
ok('**그 무게로 처음이면 안 뜬다**', at({ exercise: '벤치프레스', weight: 82.5, reps: 10 }), null);
ok('kg 은 숫자로 견준다 (「80.0」)', at({ exercise: '벤치프레스', weight: '80.0', reps: 10 })?.prevReps, 9);
ok('이름 앞뒤 공백은 같은 운동', at({ exercise: ' 벤치프레스 ', weight: 80, reps: 10 })?.prevReps, 9);
ok('드롭 줄은 안 띄운다', at({ exercise: '벤치프레스', weight: 80, reps: 10, link: 'drop' }), null);
ok('  견줄 때도 드롭 줄은 뺀다 (60kg 15회는 드롭)', at({ exercise: '벤치프레스', weight: 60, reps: 16 }), null);
ok('맨몸은 안 띄운다 (최고 기록 띠가 횟수로 센다)', at({ exercise: '푸시업', weight: '맨몸', reps: 25 }), null);
ok('무게 0 은 안 띄운다', at({ exercise: '벤치프레스', weight: 0, reps: 30 }), null);
ok('기록이 없으면 안 띄운다', sameWeightBest({}, { exercise: '벤치프레스', weight: 80, reps: 10 }, TODAY), null);
ok('같은 횟수가 둘이면 가까운 날', sameWeightBest({
  '2026-10-01': [{ exercise: '스쿼트', weight: '100', reps: 5 }],
  '2026-11-01': [{ exercise: '스쿼트', weight: '100', reps: 5 }],
}, { exercise: '스쿼트', weight: 100, reps: 6 }, TODAY)?.prevDate, '2026-11-01');

// 화면이 이어 붙인 자리 — 최고 기록 띠가 안 뜰 때만 · 오늘만 · 알림을 켠 사람만
{
  const page = fs.readFileSync('src/pages/TrainPage.jsx', 'utf-8');
  ok('운동 화면이 최고 기록이 없을 때만 부른다', /prBanner && !pr\?\.prev && isToday && !asCardio/.test(page), true);
  ok('  고치기 · 고르기에서 지운다', (page.match(/setSameBest\(null\)/g) || []).length >= 2, true);
  ok('  두 띠를 낭독기가 읽는 자리에 둔다', /role="status" aria-live="polite">\s*<PersonalRecordBanner[\s\S]{0,200}?<SameWeightBanner/.test(page), true);
  const banner = fs.readFileSync('src/components/SameWeightBanner.jsx', 'utf-8');
  ok('말이 정한 대로다 (「이 무게로는 처음」이 아니다)', /kg 으로 가장 많이 했어요 · \{best\.reps\}회/.test(banner) && !/처음이에요/.test(banner), true);
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
