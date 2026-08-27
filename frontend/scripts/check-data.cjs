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
const faq = bundle('src/pages/support/faq.js', '.t6.cjs');
const boundary = bundle('src/components/ErrorBoundary.jsx', '.t7.cjs');

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

// 자주 묻는 것은 고객센터와 제보함이 같이 본다. 항목을 늘릴 때마다 서로 걸려들기
// 쉽다 — 키워드가 겹치면 엉뚱한 답이 위로 온다. 그래서 여기서 한 번에 본다
// 주 연속. 이번 주가 아직 안 끝났다는 것을 아는지 본다 —
// 이번 주부터 세면 월요일마다 「10주 연속」이 0 으로 떨어졌다
// 배포 직후 옛 조각을 못 받아오는 것. 브라우저마다 말이 달라서, 실제로 나오는
// 문구들을 그대로 넣어 본다 — 못 알아보면 「앱이 바뀌었어요」 대신 오류 화면이 뜬다
console.log('\n── 오래된 조각 알아보기 (에러 경계) ──');
for (const [label, msg] of [
  ['크롬', 'Failed to fetch dynamically imported module: https://x/assets/HomePage-abc.js'],
  ['사파리', 'Importing a module script failed.'],
  ['파이어폭스', 'error loading dynamically imported module'],
  ['웹팩 시절', 'ChunkLoadError: Loading chunk 12 failed.'],
]) ok(label, boundary.isStaleChunk(new Error(msg)), true);
ok('그냥 앱 버그는 아니다', boundary.isStaleChunk(new TypeError("x.trim is not a function")), false);
ok('빈 것도 아니다', boundary.isStaleChunk(null), false);

console.log('\n── 주 연속 (홈 주간 요약) ──');
const tenWeeks = {};
{
  const base = new Date('2026-06-01T00:00:00'); // 월요일
  for (let i = 0; i < 10; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i * 7 + 2); // 매주 수요일
    tenWeeks[d.toISOString().slice(0, 10)] = [{ exercise: '벤치프레스', weight: 60, sets: 3, reps: 10 }];
  }
}
const streakAt = (day) => weekly.buildWeekly(tenWeeks, new Date(day + 'T00:00:00')).streak;
ok('기록한 그 주 안', streakAt('2026-08-05'), 10);
ok('다음 주 월요일 아침에도 그대로', streakAt('2026-08-10'), 10);
ok('그 주 일요일까지 그대로', streakAt('2026-08-16'), 10);
ok('한 주를 통째로 쉬면 끊긴다', streakAt('2026-08-17'), 0);
ok('기록이 아예 없으면 0', weekly.buildWeekly({}, new Date('2026-08-10T00:00:00')).streak, 0);

console.log('\n── 자주 묻는 것 (고객센터 · 제보함이 같이 본다) ──');
// 개수를 못박으면 항목을 늘릴 때마다 여기부터 고쳐야 한다. 줄어든 것만 잡는다
ok('항목이 줄지 않았다', faq.FAQ.length >= 15, true);
ok('topic 이 겹치지 않는다', new Set(faq.FAQ.map(f => f.topic)).size, faq.FAQ.length);
const firstFaq = (q) => (faq.matchFaq(q)[0] || {}).topic || null;
for (const [q, want] of [
  ['푸시', '알림'], ['탈퇴', '계정 삭제'], ['비번', '비밀번호'], ['csv', '내보내기'],
  ['등급', '인바디 판정'], ['홈트', '홈트'], ['점검', '점검'], ['구글', '소셜 로그인'],
  ['날아갔', '기록 보관'], ['차단', '정지'],
]) ok(q + ' → ' + want, firstFaq(q), want);
ok('한 글자로는 안 찾는다', faq.matchFaq('ㅇ'), []);

// 제보함은 앞의 여섯 개만 단추로 내놓는다. 다 늘어놓으면 제보하러 온 사람의 길을 막는다
ok('단추로 내놓는 여섯 개에 답이 다 있다', faq.FAQ.slice(0, 6).every(f => f.topic && f.a), true);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
