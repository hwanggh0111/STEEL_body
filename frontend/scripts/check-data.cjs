// 여러 화면이 같이 쓰는 계산을 한 번에 돌린다.
//
//   npm run check
//
// 이 앱에는 테스트 틀이 없다. 그동안 「로직만 떼어 node 로 돌리기」로 확인해 왔는데,
// 그때마다 임시 파일을 만들고 지웠다 — 같은 것을 다음 사람이 또 짜야 한다.
// 화면 여럿이 **같은 계산 한 곳**을 보게 만들어 놓은 자리들이라 특히 그렇다:
// 볼륨 하나를 고치면 홈 · 기록 · 인바디가 같이 바뀌고, BMI 눈금 하나를 고치면
// 네 화면이 같이 바뀐다.
//
// 오늘 `volumeOf` 를 내보내 홈·기록·인바디가 같이 쓰게 했고, `trainingIn` 을 새로 넣었고,
// BMI 눈금을 네 화면이 한 곳에서 보게 했다. 한 곳을 고치면 여러 화면이 같이 바뀌므로
// 여기서 한 번에 확인한다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const weekly = bundle('src/data/weeklyReport.js', '.t1.cjs');
const ranges = bundle('src/data/bodyRanges.js', '.t2.cjs');
const pr = bundle('src/data/personalRecord.js', '.t3.cjs');
const change = bundle('src/data/bodyChange.js', '.t4.cjs');
const part = bundle('src/data/bodyPart.js', '.t5.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 볼륨 (홈 · 기록 · 인바디가 같이 쓴다) ──');
ok('무게 있는 것만 센다', weekly.volumeOf([
  { weight: '60kg', sets: 4, reps: 10 },
  { weight: '맨몸', sets: 3, reps: 20 },
]), { kg: 2400, bodyweightSets: 3 });
ok('무게가 자유 입력이어도 첫 숫자를 읽는다', weekly.volumeOf([{ weight: '20kg 양쪽', sets: 2, reps: 10 }]), { kg: 400, bodyweightSets: 0 });
ok('빈 목록', weekly.volumeOf([]), { kg: 0, bodyweightSets: 0 });

console.log('\n── BMI 눈금 (인바디 폼 · 목록 카드 · 비교 · 신체 분석이 같이 본다) ──');
const bmiLabel = (v) => ranges.positionOn(ranges.scaleFor('bmi'), v).band.label;
ok('18.0 → 낮음', bmiLabel(18.0), '낮음');
ok('22.4 → 일반적인 범위', bmiLabel(22.4), '일반적인 범위');
ok('24.0 → 다소 높음', bmiLabel(24.0), '다소 높음');
ok('31.0 → 높음', bmiLabel(31.0), '높음');
ok('「비만」이라는 말이 눈금에 없다', JSON.stringify(ranges.scaleFor('bmi').bands).includes('비만'), false);

console.log('\n── 여성 체지방 22% (8/25 에 고친 핵심) ──');
const fatF = ranges.positionOn(ranges.scaleFor('fat_pct', 'female'), 22).band.label;
ok('여성 22% → 일반적인 범위', fatF, '일반적인 범위');
ok('성별 안 고르면 눈금이 없다', ranges.scaleFor('fat_pct', null), null);

console.log('\n── 최고 기록 ──');
ok('1RM 환산 (70kg 12회 > 80kg 5회)', pr.estimate1RM(70, 12) > pr.estimate1RM(80, 5), true);
ok('맨몸은 무게로 안 센다', pr.strengthOf({ exercise: '푸시업', weight: '맨몸', sets: 3, reps: 30 }).kind, 'bodyweight');

console.log('\n── 그동안 운동은 (인바디 시안 C) ──');
const workouts = {
  '2026-06-01': [{ exercise: '벤치프레스', weight: '60', sets: 4, reps: 10 }],
  '2026-07-01': [{ exercise: '푸시업', weight: '맨몸', sets: 3, reps: 20 }],
  '2026-09-01': [{ exercise: '스쿼트', weight: '100', sets: 5, reps: 5 }],
};
const t = change.trainingIn(workouts, '2026-06-01', '2026-08-01');
ok('기간 밖(9/1)은 안 센다', t.count, 2);
ok('맨몸은 볼륨에서 빠진다', t.volumeKg, 2400);
ok('기록 없는 기간은 null', change.trainingIn(workouts, '2026-01-01', '2026-02-01'), null);

console.log('\n── 부위 (홈 · 히스토리 · 주간 요약이 같이 쓴다) ──');
ok('벤치프레스 → 가슴', part.bodyPartOf('벤치프레스'), '가슴');
ok('모르는 것 → 기타', part.bodyPartOf('아무거나'), '기타');

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
