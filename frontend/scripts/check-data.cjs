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
const josa = bundle('src/data/particle.js', '.t8.cjs');
// 휴식 타이머는 localStorage 를 읽는다. node 에는 없으니 빈 것으로 세워준다
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const rest = bundle('src/store/restTimerStore.js', '.t9.cjs');
const chart = bundle('src/data/chartColors.js', '.t10.cjs');
// 그래프 컴포넌트는 실제로 **그려봐야** 확인된다. react 는 밖에 둔다 —
// 번들 안에 같이 넣으면 react 사본이 둘이 되어 훅이 안 붙는다
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const bundleJsx = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out,
    platform: 'node', external: ['react', 'react-dom'], jsx: 'automatic' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};
const draw = (C, props) => renderToStaticMarkup(React.createElement(C, props));
const lineMod = bundleJsx('src/components/charts/LineChart.jsx', '.t12.cjs');
const Line = lineMod.default;
const Bars = bundleJsx('src/components/charts/Bars.jsx', '.t13.cjs').default;
const Donut = bundleJsx('src/components/charts/Donut.jsx', '.t14.cjs').default;
const Radar = bundleJsx('src/components/charts/Radar.jsx', '.t15.cjs').default;

const axis = bundle('src/components/charts/useWidth.js', '.t11.cjs');

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
// 조사. 앞 글자에 받침이 있느냐로 갈린다 — 「등이」 · 「하체가」
// 휴식 타이머. 「시작할 때는 막는데 눌러서 늘리면 되는」 자리가 있었다
console.log('\n── 휴식 타이머 ──');
const timer = rest.useRestTimerStore.getState();
timer.start(90, '벤치프레스');
ok('90초로 시작', rest.useRestTimerStore.getState().runSec, 90);
rest.useRestTimerStore.getState().add(30);
ok('+30초는 도는 것도 같이 늘린다', rest.useRestTimerStore.getState().runSec, 120);
for (let n = 0; n < 30; n += 1) rest.useRestTimerStore.getState().add(30);
ok('아무리 눌러도 최대치를 안 넘는다', rest.useRestTimerStore.getState().runSec, rest.MAX_SEC);
rest.useRestTimerStore.getState().stop();
ok('그만두면 비워진다', rest.useRestTimerStore.getState().runSec, 0);
rest.useRestTimerStore.getState().start(9999);
ok('시작할 때도 최대치에서 자른다', rest.useRestTimerStore.getState().runSec, rest.MAX_SEC);
rest.useRestTimerStore.getState().stop();
ok('남은 시간 표기', rest.formatLeft(90 * 1000), '1:30');
ok('0 이하는 0:00', rest.formatLeft(-5), '0:00');

console.log('\n── 조사 (주간 요약 · 히스토리 · 루틴이 같이 쓴다) ──');
for (const [word, want] of [['등', '등이'], ['하체', '하체가'], ['가슴', '가슴이'], ['어깨', '어깨가']]) {
  ok(word, josa.i(word), want);
}
for (const [word, want] of [['스쿼트', '스쿼트를'], ['풀업', '풀업을'], ['바벨 컬', '바벨 컬을']]) {
  ok(word, josa.eul(word), want);
}
// 숫자로 끝나면 읽는 소리로 본다 — 100 은 '백'(받침 ㄱ), 3 은 '삼'(받침 ㅁ)
ok('숫자로 끝나는 것', josa.eul('스쿼트 100'), '스쿼트 100을');
ok('영문으로 끝나는 것', josa.eul('bench row'), 'bench row를');
// 둘을 나열하면 뒤엣것에 맞춘다
ok('나열은 뒤에 맞춘다', josa.i('하체 · 등'), '하체 · 등이');

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
// 계정 삭제는 8/31 에 앱 안에 길이 생겼다. 답이 옛말로 남아 있으면 「제보함에
// 남겨주시면 지워드립니다」로 보내놓고 정작 제보함에는 그 갈래가 없다
const delA = (faq.FAQ.find(f => f.topic === '계정 삭제') || {}).a || '';
ok('계정 삭제 답이 앱 안의 길을 알려준다', /내 계정/.test(delA) && /계정 삭제/.test(delA), true);
ok('계정 삭제 답에 30일과 되살리기가 적혀 있다', /30일/.test(delA) && /되살/.test(delA), true);
ok('계정 삭제 답에 옛말(제보함으로 받는다)이 남아 있지 않다',
  /직접 지우는 길이 없|제보함에 남겨주시면 확인하고 지워/.test(delA), false);

// 제보함은 앞의 여섯 개만 단추로 내놓는다. 다 늘어놓으면 제보하러 온 사람의 길을 막는다
ok('단추로 내놓는 여섯 개에 답이 다 있다', faq.FAQ.slice(0, 6).every(f => f.topic && f.a), true);

console.log('\n── 색 대비 (globals.css 토큰) ──');
// 색은 눈으로 보면 「예쁘다」로 끝나서, 안 보이는 글자를 그냥 지나친다.
// 금을 밝게 하면 그 위의 흰 글자가, 검정을 밝게 하면 흐린 글자가 먼저 죽는다.
const css = fs.readFileSync('src/styles/globals.css', 'utf8');
const token = (n) => (css.match(new RegExp('--' + n + ':\\s*(#[0-9a-fA-F]{6})')) || [])[1];
const lum = (h) => {
  const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const atLeast = (name, a, b, want) => {
  const got = contrast(a, b);
  ok(name + ' (' + got.toFixed(1) + ':1)', got >= want, true);
};
const BG = token('bg-primary'), CARD = token('bg-secondary');
atLeast('본문이 배경 위에서', BG, token('text-primary'), 7);
atLeast('둘째 글자가 배경 위에서', BG, token('text-secondary'), 4.5);
atLeast('흐린 글자가 카드 위에서', CARD, token('text-muted'), 3);
atLeast('금이 배경 위에서', BG, token('accent'), 4.5);
atLeast('금이 카드 위에서', CARD, token('accent'), 4.5);
// 통째로 칠한 단추 — 글자가 바탕을 따라가야 한다
atLeast('금 단추 위의 글자', token('accent'), token('on-accent'), 4.5);
atLeast('빨간 단추 위의 흰 글자', token('danger-strong'), '#ffffff', 4.5);
for (const st of ['success', 'warning', 'danger', 'info']) {
  atLeast(st + ' — 배경 위에서', BG, token(st), 4.5);
}

// 그래프는 토큰을 못 쓴다 (recharts 가 색을 SVG 속성으로 내보내는데 속성 안에서는
// var() 가 치환되지 않는다). chartColors.js 에 같은 값을 손으로 적어두므로,
// 토큰만 고치고 여기를 잊으면 그래프만 옛 색으로 남는다.
const PAIRS = [['accent', 'accent'], ['success', 'muscle'], ['danger', 'fat'],
               ['info', 'water'], ['text-muted', 'muted'], ['text-secondary', 'text2'],
               ['text-primary', 'text'], ['bg-secondary', 'card'], ['border', 'border']];
for (const [t, c] of PAIRS) {
  ok('그래프의 ' + c + ' 가 --' + t + ' 와 같다', chart.CHART[c], token(t));
}


console.log('');
console.log('── 그래프 눈금 (직접 그리는 축) ──');
// 최소~최대를 그냥 3등분하면 「71.33」 같은 눈금이 나온다. 사람이 읽는 숫자로 끊는다.
// 그래프는 눈으로 보면 「그려졌네」로 끝나서, 눈금이 이상해도 그냥 지나친다
const sc = (a, b) => axis.niceScale(a, b).values;
ok('70.4~74.6 은 2 씩 네 칸', sc(70.4, 74.6), [70, 72, 74, 76]);
ok('0~100 은 25 씩', sc(0, 100), [0, 25, 50, 75, 100]);
ok('값이 하나뿐이면 위아래로 벌린다', sc(72, 72), [71, 72, 73]);
ok('소수도 깔끔하게', sc(17.2, 18.9), [17, 17.5, 18, 18.5, 19]);
ok('눈금이 늘 최소보다 아래에서 시작한다', axis.niceScale(70.4, 74.6).min <= 70.4, true);
ok('눈금이 늘 최대보다 위에서 끝난다', axis.niceScale(70.4, 74.6).max >= 74.6, true);
ok('12.0 은 12 로 적는다', axis.fmt(12.0), '12');
ok('12.34 는 12.3 으로', axis.fmt(12.34), '12.3');
ok('없는 값은 - 로', axis.fmt(null), '-');

console.log('');
console.log('── 그래프를 그려본다 (recharts 를 걷어내고 직접 그린 넷) ──');
// 8/28 에 recharts 를 걷어내고 네 개를 직접 그렸다. 그때는 「브라우저로만 확인된다」고
// 적어뒀는데, 그리는 쪽은 화면 없이도 돌려볼 수 있다 — 훅은 첫 판에서 폭 기본값(320)을
// 쓰고 useEffect 는 안 돈다. 여기서 SVG 를 받아, 눈으로 볼 것을 글자로 본다.
//
// 이 그래프들이 조용히 죽는 방식은 둘이다. (1) 색이 안 먹어서 축 글씨가 검정이 된다
// — 8/28 에 실제로 그랬다. (2) 안 잰 날을 이어 그려서 잰 것처럼 보여준다.
const GOLD = '#eeb77d', MUTED = '#7a7160', RED = '#d96a5c', GREEN = '#7fb069', BLUE = '#7fa8d9';
const TWO = [{ key: 'before', label: '과거', color: MUTED }, { key: 'after', label: '현재', color: GOLD }];

// 08-18 은 체지방·골격근을 안 쟀다 (체중만 쟀다)
const TREND = [
  { date: '08-14', weight: 72.6, fat: 18.4, muscle: 33.1 },
  { date: '08-18', weight: 72.0, fat: null, muscle: null },
  { date: '08-22', weight: 71.6, fat: 17.9, muscle: 33.4 },
  { date: '08-26', weight: 71.2, fat: 17.5, muscle: 33.6 },
];
const line = draw(Line, { data: TREND, xKey: 'date', unit: '%',
  series: [{ key: 'fat', label: '체지방', color: RED }, { key: 'muscle', label: '골격근', color: GREEN }] });

ok('꺾은선 — 축의 날짜가 찍힌다', ['08-14', '08-18', '08-22', '08-26'].every(d => line.includes('>' + d + '<')), true);
// 「하나라도 muted 면 통과」로 두면 눈금 글씨만 검정이 돼도 날짜 글씨가 대신 채워준다.
// 글자 하나하나가 토큰 색인지 본다 — 8/28 에 죽은 자리가 정확히 여기다
const INK = [MUTED, '#aaa28e', '#eae4d6'];
const fills = [...line.matchAll(/<text[^>]*fill="([^"]+)"/g)].map(m => m[1]);
ok('꺾은선 — 글자가 아홉 개 찍힌다 (눈금 다섯 · 날짜 넷)', fills.length, 9);
ok('꺾은선 — 글자 색이 전부 토큰이다 (8/28 에 축이 검정이라 안 보였다)',
  fills.filter(f => !INK.includes(f)), []);
ok('꺾은선 — 줄마다 선을 하나씩', (line.match(/<path/g) || []).length, 2);
// 안 잰 날에서 붓을 뗀다. 이어 그렸으면 M 이 줄마다 하나뿐이다
ok('꺾은선 — 안 잰 날에서 선이 끊긴다', (line.match(/ M(?=\d)/g) || []).length >= 2, true);
ok('꺾은선 — 두 줄이면 범례가 붙는다', line.includes('체지방') && line.includes('골격근'), true);
ok('꺾은선 — 잰 값이 없으면 빈 칸을 준다 (안 터진다)',
  draw(Line, { data: [], xKey: 'date', series: [{ key: 'weight', label: '체중', color: GOLD }] }).includes('<svg'), false);

const bars = draw(Bars, { data: [{ name: '체중', before: 72.6, after: 71.2 },
                                 { name: '체지방', before: 18.4, after: 17.5 }], series: TWO });
// 막대는 0 에서 시작해야 길이가 값을 말한다. 71.2 와 72.6 을 70 에서 자르면 두 배 차이로 보인다
ok('막대 — 눈금이 0 에서 시작한다', bars.includes('>0<'), true);
const FEET = [...bars.matchAll(/<rect x="[\d.]+" y="([\d.]+)"[^>]*height="([\d.]+)"/g)]
  .map(m => Number(m[1]) + Number(m[2])).filter(v => v > 100);
ok('막대 — 막대 밑동이 모두 같은 줄에 있다', new Set(FEET.map(v => v.toFixed(1))).size, 1);
ok('막대 — 칸 이름이 찍힌다', bars.includes('>체중<') && bars.includes('>체지방<'), true);

const donut = draw(Donut, { total: 71.2, data: [
  { name: '골격근', value: 33.6, color: GREEN }, { name: '체지방', value: 12.5, color: RED },
  { name: '체수분', value: 20.1, color: BLUE }, { name: '기타', value: 5.0, color: MUTED }] });
ok('도넛 — 조각이 넷', (donut.match(/<path/g) || []).length, 4);
ok('도넛 — 가운데에 합이 적혀 있다', donut.includes('>71.2<') && donut.includes('>kg<'), true);
// 조각이 하나면 시작점과 끝점이 같아 호(arc)로는 못 그린다. 반원 둘로 나눠 그린다
ok('도넛 — 조각이 하나여도 원이 된다',
  (draw(Donut, { data: [{ name: '골격근', value: 33.6, color: GREEN }] }).match(/<path/g) || []).length, 2);

const radar = draw(Radar, { data: [
  { subject: '체중', before: 72.6, after: 71.2 }, { subject: '체지방', before: 18.4, after: 17.5 },
  { subject: 'BMI', before: 23.1, after: 22.6 }, { subject: '골격근', before: 33.1, after: 33.6 },
  { subject: '체수분', before: 19.8, after: 20.1 }], series: TWO });
ok('오각형 — 축 이름 다섯이 다 적힌다',
  ['체중', '체지방', 'BMI', '골격근', '체수분'].every(n => radar.includes('>' + n + '<')), true);
ok('오각형 — 축마다 「과거 → 현재」', radar.includes('72.6 → 71.2'), true);
ok('오각형 — 두 겹으로 그린다', (radar.match(/fill-opacity="0.28"/g) || []).length, 2);
// 축마다 눈금이 다른 그림이라, 그 말을 안 적으면 모양을 그대로 믿게 된다
ok('오각형 — 「축마다 눈금이 따로」 한 줄이 붙어 있다', radar.includes('축마다 눈금이 따로'), true);
ok('오각형 — 축이 셋보다 적으면 안 그린다',
  draw(Radar, { data: [{ subject: '체중', before: 1, after: 2 }], series: TWO }).includes('<svg'), false);


console.log('');
console.log('── 폭이 바뀌면 달라지는 것 (여태 브라우저로만 봤다) ──');
// 8/31 에 그래프 넷을 화면 없이 그려봤지만, **폭이 진짜로 바뀌어야 나오는 셋**은
// 남겨뒀다 — 글자 겹침 · 짚었을 때의 말풍선 · 폰에서 날짜 건너뛰기.
//
// 폭은 훅의 기본값이라 프로퍼티(`width`)로 넣어줄 수 있고, 겹침과 잘림은 그린 SVG 의
// `<text>` 를 긁어 **자리를 재면** 나온다. 글자 폭은 글꼴을 봐야 정확하지만, 한글 한 자를
// 글자크기만큼 · 영문과 숫자를 0.56 배로 잡으면 겹침을 잡기에는 넉넉하다.
const glyph = (ch, f) => {
  if (ch === ' ') return f * 0.28;
  const c = ch.codePointAt(0);
  if ((c > 0x1100 && c < 0xd800) || (c > 0xff00 && c < 0xffef)) return f;   // 한글·한자
  if ('·—→'.includes(ch)) return f * 0.9;
  return f * 0.56;
};
const textW = (str, f) => [...str].reduce((a, ch) => a + glyph(ch, f), 0);
// 그린 글자마다 「어디서 어디까지 차지하는가」
const boxes = (svg) => [...svg.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)].map(m => {
  const at = {};
  for (const a of m[1].matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) at[a[1]] = a[2];
  const f = Number(at['font-size'] || 10), x = Number(at.x), wid = textW(m[2], f);
  const anchor = at['text-anchor'] || 'start';
  const x0 = anchor === 'middle' ? x - wid / 2 : anchor === 'end' ? x - wid : x;
  return { t: m[2], x0, x1: x0 + wid, y: Number(at.y), f };
});
const overlaps = (svg) => {
  const b = boxes(svg), out = [];
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
    // 같은 줄에 있고(글자 높이 안쪽) 가로가 겹치면 사람 눈에도 겹쳐 보인다
    if (Math.abs(b[i].y - b[j].y) < Math.max(b[i].f, b[j].f) * 0.9
      && b[i].x0 < b[j].x1 - 0.5 && b[j].x0 < b[i].x1 - 0.5) out.push(b[i].t + '↔' + b[j].t);
  }
  return out;
};
const outside = (svg, W) => boxes(svg).filter(b => b.x0 < -0.5 || b.x1 > W + 0.5).map(b => b.t);

// 폰(320 · 375 · 430)부터 PC(900)까지. 날짜 수는 나흘치부터 석 달치까지
const WIDTHS = [320, 375, 430, 900];
const days = (n) => Array.from({ length: n }, (_, i) =>
  ({ date: '08-' + String((i % 28) + 1).padStart(2, '0'), weight: 70 + (i % 5) * 0.4 }));
// 비교 화면이 실제로 넘기는 다섯 칸 (이름이 길어지면 여기서 걸린다)
const REAL = [{ name: '체중(kg)', subject: '체중' }, { name: '골격근(kg)', subject: '골격근' },
              { name: '체지방(%)', subject: '체지방' }, { name: 'BMI', subject: 'BMI' },
              { name: '체수분(L)', subject: '체수분' }].map(x => ({ ...x, before: 72.6, after: 71.2 }));

let hit = [], clipped = [];
for (const W of WIDTHS) {
  for (const n of [4, 14, 30, 90]) {
    const svg = draw(Line, { data: days(n), xKey: 'date', unit: 'kg', width: W,
      series: [{ key: 'weight', label: '체중', color: GOLD }] });
    hit = hit.concat(overlaps(svg).map(t => '꺾은선 ' + W + '/' + n + ' ' + t));
    clipped = clipped.concat(outside(svg, W).map(t => '꺾은선 ' + W + '/' + n + ' ' + t));
  }
  for (const [name, svg] of [['막대', draw(Bars, { data: REAL, series: TWO, width: W })],
                             ['오각형', draw(Radar, { data: REAL, series: TWO, width: W })]]) {
    hit = hit.concat(overlaps(svg).map(t => name + ' ' + W + ' ' + t));
    clipped = clipped.concat(outside(svg, W).map(t => name + ' ' + W + ' ' + t));
  }
}
ok('폭 넷 × 날짜 넷 — 글자가 서로 겹치지 않는다', hit, []);
// 마지막 날짜는 오른쪽 끝에 있다. 가운데 맞춤이면 절반이 잘려 나간다
ok('폭 넷 — 글자가 그래프 밖으로 나가지 않는다 (잘려 보인다)', clipped, []);

// 날짜 건너뛰기 — 폰에서는 성기게, PC 에서는 촘촘하게
const marks = (n, innerW) => axis.labelIndices(n, innerW);
ok('폰(320) 에서 석 달치는 여섯 칸만 적는다', marks(90, 276).length, 6);
ok('PC(900) 에서 같은 석 달치는 더 촘촘하다', marks(90, 856).length >= 15, true);
// 마지막 날이 안 적히면 그래프가 어디서 끝났는지 모른다
ok('마지막 날은 폭과 상관없이 늘 적는다',
  WIDTHS.every(W => [4, 14, 30, 90].every(n => marks(n, W - 44).includes(n - 1))), true);
ok('첫 날도 늘 적는다', marks(30, 276)[0], 0);
// 마지막을 끼워 넣느라 바로 앞과 붙던 것 — 8/31 에 실제로 겹쳤다
ok('마지막과 그 앞이 한 칸 차이로 붙지 않는다',
  marks(14, 331).slice(-2).reduce((a, b) => b - a) >= 2, true);
ok('날짜가 셋뿐이면 다 적는다', marks(3, 276), [0, 1, 2]);
ok('날짜가 하나여도 안 터진다', marks(1, 276), [0]);

// 짚기 — 짚는 것은 화면이 있어야 하지만, 짚은 자리를 몇 번째로 셈하는지는 여기서 본다
const P = (rel, count) => axis.pickIndex(rel, 276, count);
ok('왼쪽 끝을 짚으면 첫 칸', P(0, 10), 0);
ok('오른쪽 끝을 짚으면 마지막 칸', P(276, 10), 9);
// 손가락은 그래프 밖까지 미끄러진다. -1 이나 10 이 나오면 말풍선이 빈 칸을 읽는다
ok('왼쪽 밖으로 미끄러져도 첫 칸에 붙는다', P(-80, 10), 0);
ok('오른쪽 밖으로 미끄러져도 마지막 칸에 붙는다', P(400, 10), 9);
ok('가운데를 짚으면 가운데 칸', P(138, 9), 4);
ok('칸이 하나뿐이면 늘 0 (0 으로 나누지 않는다)', P(138, 1), 0);

// 말풍선에 뭐라고 적히는가
const HROWS = [{ date: '08-14', fat: 18.4, muscle: 33.1 }, { date: '08-18', fat: null, muscle: 33.4 }];
const HSER = [{ key: 'fat', label: '체지방' }, { key: 'muscle', label: '골격근' }];
ok('짚기 전에는 줄 이름만 적는다', lineMod.hoverText(HROWS, null, HSER, 'date', '%'), '체지방 · 골격근');
ok('짚으면 그 날짜의 값을 적는다',
  lineMod.hoverText(HROWS, 0, HSER, 'date', '%'), '08-14 — 체지방 18.4% · 골격근 33.1%');
ok('안 잰 값은 - 로 적는다 (0 이라고 하지 않는다)',
  lineMod.hoverText(HROWS, 1, HSER, 'date', '%'), '08-18 — 체지방 -% · 골격근 33.4%');
ok('줄이 하나뿐이면 짚기 전에는 빈 줄', lineMod.hoverText(HROWS, null, [HSER[0]], 'date', '%'), '');
ok('없는 칸을 짚어도 안 터진다', lineMod.hoverText(HROWS, 9, HSER, 'date', '%'), '체지방 · 골격근');


console.log('');
console.log('── 길찾기 아이콘 (이모지를 걷어내고 직접 그린 것) ──');
// 이모지 그림은 폰 만든 회사 것이라 걷어내고 SVG 로 직접 그렸다. 이름으로 고르는
// 방식이라 **이름을 잘못 적으면 조용히 빈 칸**이 된다 — 아이콘만 사라지고 아무도 안 터진다
const nav = bundleJsx('src/components/NavIcon.jsx', '.t16.cjs');
// 길찾기 · 홈의 「바로 가기」 · 미션이 같은 서랍에서 꺼내 쓴다
const FILES = ['src/components/TabBar.jsx', 'src/pages/HomePage.jsx', 'src/components/MissionSystem.jsx',
               'src/pages/support/SupportPage.jsx', 'src/pages/support/ReportBox.jsx',
               'src/components/admin/ReportAdmin.jsx'];
const src = Object.fromEntries(FILES.map(f => [f, fs.readFileSync(f, 'utf-8')]));
const used = FILES.flatMap(f => [...src[f].matchAll(/icon: '([a-z]+)'/g)].map(m => m[1]));
ok('여섯 화면이 아이콘 마흔을 쓴다', used.length, 40);
ok('쓰는 이름이 전부 그려져 있다 (틀리면 빈 칸이 된다)',
  used.filter(n => !nav.NAV_ICONS.includes(n)), []);
// 이모지는 폰마다 그림이 다르다. 하나라도 남으면 그 자리만 딴 그림이 된다
ok('여섯 화면에 이모지가 남아 있지 않다',
  FILES.filter(f => /[\u{1F300}-\u{1FAFF}\u{2B50}\u{2705}]/u.test(src[f])), []);
// 같은 자리로 가는 길은 홈에서도 길찾기에서도 같은 그림이어야 한다
const iconFor = (file, path) => (src[file].match(new RegExp("icon: '([a-z]+)'[^\n]*'" + path + "'")) ||
  src[file].match(new RegExp("path: '" + path + "'[^\n]*icon: '([a-z]+)'")) || [])[1];
ok('홈의 「바로 가기」가 길찾기와 같은 그림을 쓴다',
  ['/homeworkout', '/search', '/measure', '/history', '/reminders', '/support']
    .filter(p => iconFor('src/pages/HomePage.jsx', p) !== iconFor('src/components/TabBar.jsx', p)), []);
// 버그 · 문의 · 건의는 고객센터 · 제보함 · 관리자 셋이 같은 그림을 써야 한다 —
// 사람이 「버그」로 낸 것을 관리자가 딴 그림으로 보면 같은 것인지 한 번 더 생각해야 한다
// 세 화면이 적는 모양이 조금씩 다르다 (kind: 'bug' · key: 'bug' · bug: {) — 낱말로 찾는다
const kindIcon = (file) => Object.fromEntries(
  [...src[file].matchAll(/\b(bug|ask|idea)\b[^\n]*icon: '([a-z]+)'/g)].map(m => [m[1], m[2]]));
const K1 = kindIcon('src/pages/support/SupportPage.jsx');
const K2 = kindIcon('src/pages/support/ReportBox.jsx');
const K3 = kindIcon('src/components/admin/ReportAdmin.jsx');
ok('제보 갈래 셋이 세 화면에서 같은 그림이다',
  ['bug', 'ask', 'idea'].filter(k => !(K1[k] && K1[k] === K2[k] && K2[k] === K3[k])), []);
// 색을 속성에 박아두면 고른 자리에서 금색이 안 된다 (그래프에서 8/28 에 겪은 것과 같은 종류)
const one = renderToStaticMarkup(React.createElement(nav.default, { name: 'home' }));
ok('아이콘이 실제로 그려진다', one.startsWith('<svg') && one.includes('<path'), true);
ok('선 색을 글자색에서 받는다 (고르면 금색)', one.includes('stroke="currentColor"'), true);
ok('없는 이름은 빈 칸을 준다 (안 터진다)',
  renderToStaticMarkup(React.createElement(nav.default, { name: '없는것' })), '');


console.log('');
console.log('── 루틴 갈래 단추가 화면 안에 들어오는가 ──');
// 8/31 에 「기능성」이 넷째로 붙으면서 단추 줄이 320 · 360px 폰에서 넘쳤다.
// 옆으로 밀어 보게 두면 거기 뭐가 더 있는지 알 길이 없다 — 줄을 바꾸게 고쳤다.
// 다섯째를 넣으면 여기서 다시 걸린다
const routinePage = fs.readFileSync('src/pages/RoutinePage.jsx', 'utf-8');
const types = [...(routinePage.match(/\{\[([^\]]*)\]\.map\(\(t\)/) || [])[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
ok('갈래 단추가 넷이다', types, ['머신', '맨몸', '홈트', '기능성']);
// btn-secondary — 14px · 자간 1.5 · 좌우 여백 20 · 테두리 1
const btnW = (s) => [...s].reduce((a, c) => a + (c.charCodeAt(0) > 0x1100 ? 14 : 8) + 1.5, 0) + 42;
const rowW = types.reduce((a, t) => a + btnW(t), 0) + 8 * (types.length - 1);
ok('한 줄에 다 안 들어간다 (그래서 줄을 바꿔야 한다)', rowW > 320 - 40, true);
const typeRow = routinePage.slice(routinePage.indexOf("{['머신'") - 260, routinePage.indexOf("{['머신'"));
ok('넘치는 줄이라 줄바꿈으로 받는다', /flexWrap: 'wrap'/.test(typeRow), true);
ok('옆으로 밀어 보게 두지 않는다 (숨은 단추가 생긴다)', /overflowX/.test(typeRow), false);

console.log('');
console.log('── 홈트 프로그램 (기능성(특수부대식)은 근력부터 유산소로) ──');
// 프로그램 표를 화면에서 빼 `data/homeworkoutPrograms.js` 로 옮겼다 — 화면 안에 두면
// 여기서 읽으려고 react-router 까지 끌고 와야 한다.
const home = bundle('src/data/homeworkoutPrograms.js', '.t17.cjs');
const homeNames = Object.keys(home.PROGRAMS);
ok('프로그램이 여섯이다', homeNames,
  ['전신 초급', '상체 집중', '하체 집중', '코어 강화', '유산소 타바타', '기능성(특수부대식)']);
// 마지막 운동 뒤에는 화면이 휴식을 넣지 않는다. rest 를 적어두면 그 숫자만 목록에 뜨고
// 실제로는 안 쉬는, 말과 다른 자리가 된다
ok('마지막 운동은 쉬는 시간이 0 이다',
  homeNames.filter((n) => home.PROGRAMS[n][home.PROGRAMS[n].length - 1].rest !== 0), []);
ok('모든 운동에 이름 · 초 · 쉬는 초가 있다',
  homeNames.flatMap((n) => home.PROGRAMS[n]).filter((e) => !e.name || !(e.duration > 0) || !(e.rest >= 0)), []);

// 여섯 판이 서로 다른 운동을 한다 — 같은 것을 나눠 쓰면 판을 여섯 두는 뜻이 없다.
// 괄호 안((좌) · (의자) · (식탁 아래))은 같은 동작을 어디서 하느냐일 뿐이라 떼고 센다
const base = (n) => n.replace(/\s*\([^)]*\)/g, '').trim();
const dup = [];
homeNames.forEach((a, i) => homeNames.slice(i + 1).forEach((b) => {
  const A = new Set(home.PROGRAMS[a].map((e) => base(e.name)));
  home.PROGRAMS[b].forEach((e) => { if (A.has(base(e.name))) dup.push(a + ' · ' + b + ' : ' + base(e.name)); });
}));
ok('프로그램끼리 같은 운동을 나눠 쓰지 않는다', dup, []);
ok('기능성 말고는 여덟 개씩이다',
  homeNames.filter((n) => n !== '기능성(특수부대식)' && home.PROGRAMS[n].length !== 8), []);
// 홈트에서 본 이름을 검색창에 치면 나와야 한다. 사전에 없으면 **조용히 빈손**이다 —
// 아무도 안 터지고, 화면은 「없습니다」만 말한다.
// 기능성 열둘은 사전이 아니라 추천 루틴에서 온 이름이라 그쪽도 같이 본다
const dict = bundle('src/data/exerciseDict.js', '.t18.cjs');
const known = new Set(dict.EXERCISE_DICT.map((e) => base(e.ko)));
const routineSrcAll = fs.readFileSync('../backend/src/routes/routines.js', 'utf-8');
[...routineSrcAll.matchAll(/name: '([^']+)'/g)].forEach((m) => known.add(base(m[1])));
ok('홈트 운동이 전부 사전이나 루틴에 있다 (검색에서 찾힌다)',
  [...new Set(homeNames.flatMap((n) => home.PROGRAMS[n].map((e) => base(e.name))))]
    .filter((n) => !known.has(n)), []);
// 설명은 하나만 비어도 그 판만 아무 말 없이 시작한다 — 대체 동작과 층간소음이 거기 있다
ok('여섯 판 모두 한 줄 설명이 있다',
  homeNames.filter((n) => !(home.PROGRAM_NOTES[n] || []).length), []);

const func = home.PROGRAMS['기능성(특수부대식)'];
ok('기능성(특수부대식)은 열두 개다', func.length, 12);
// 「근력부터 유산소같은거」 — 앞은 오래 버티며 힘을 쓰고, 뒤로 갈수록 짧고 빠르다.
// 순서가 뒤집히면 프로그램의 뜻이 사라진다 (그냥 섞인 타바타가 된다)
const half = func.length / 2;
const avgSec = (list) => list.reduce((a, e) => a + e.duration, 0) / list.length;
ok('앞 절반이 뒤 절반보다 오래 버틴다 (근력 → 유산소)', avgSec(func.slice(0, half)) > avgSec(func.slice(half)), true);
ok('앞 여섯은 30초보다 짧지 않다', func.slice(0, half).filter((e) => e.duration < 30), []);
ok('쉬는 시간이 뒤로 갈수록 길어지지 않는다',
  func.slice(1, -1).filter((e, i) => e.rest > func[i].rest), []);
// 홈트의 「기능성(특수부대식)」은 **추천 루틴의 「기능성」과 같은 운동**을 시간 재는 판으로
// 옮긴 것이다. 루틴 쪽에서 이름을 고치면 여기만 옛 이름으로 남는데, 아무도 안 터진다 —
// 두 화면이 같은 동작을 다른 이름으로 부르게 될 뿐이다
const routineSrc = fs.readFileSync('../backend/src/routes/routines.js', 'utf-8');
const funcSection = routineSrc.slice(routineSrc.indexOf('기능성: {'));
const routineNames = [...funcSection.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
ok('루틴의 기능성이 스무 가지다', routineNames.length, 20);
ok('홈트의 기능성이 루틴에 없는 운동을 넣지 않았다',
  func.filter((e) => !routineNames.includes(e.name)).map((e) => e.name), []);
// 그렇다고 다른 프로그램을 통째로 베낀 것이면 프로그램을 하나 더 둘 이유가 없다
const elsewhere = homeNames.filter((n) => n !== '기능성(특수부대식)')
  .flatMap((n) => home.PROGRAMS[n].map((e) => e.name));
ok('다른 프로그램과 겹치는 운동이 절반을 넘지 않는다',
  func.filter((e) => elsewhere.includes(e.name)).length < half, true);
// 집에서 하는 앱이다. 뛰는 동작을 넣었으면 밤에 어떻게 하라는 말이 있어야 한다
const jumpy = func.filter((e) => /점프|점핑|버피|하이니|터크|스케이터/.test(e.name)).map((e) => e.name);
ok('뛰는 동작은 뒤쪽에만 둔다', jumpy.every((n) => func.findIndex((e) => e.name === n) >= half), true);
ok('기능성(특수부대식)은 약 10분이다',
  Math.round(func.reduce((a, e) => a + e.duration + e.rest, 0) / 60), 10);
// 집에서 하는 앱이다. 뛰라고만 하고 층간소음을 안 적으면 밤에는 못 한다.
// 문틀바 같은 장비도 없다는 전제라 대체를 같이 적는다
const funcNote = (home.PROGRAM_NOTES['기능성(특수부대식)'] || []).join(' ');
ok('설명에 밤(층간소음) 이야기가 있다', /밤/.test(funcNote), true);
ok('설명에 배낭 무게를 어떻게 만드는지 있다', /배낭/.test(funcNote) && /kg/.test(funcNote), true);
ok('설명에 문틀바가 없을 때의 대체가 있다', /수건/.test(funcNote), true);
ok('설명에 루틴의 기능성에서 온 것이라고 적었다', /추천 루틴|기능성/.test(funcNote), true);
ok('설명에 공식 프로그램이 아니라고 적었다', /공식 프로그램/.test(funcNote), true);
ok('뛰는 동작이 있으면 밤에 어떻게 할지 적었다', jumpy.length === 0 || /밤/.test(funcNote), true);
// 어떤 순서로 가는 판인지 안 적으면 그냥 열두 개 목록이다
ok('설명에 어떤 순서로 가는지 적혀 있다', /순서/.test(funcNote), true);
ok('타바타에도 뭐가 다른지 한 줄 있다', (home.PROGRAM_NOTES['유산소 타바타'] || []).length > 0, true);
// 적어만 두고 화면이 안 그리면 아무도 못 본다
const page = fs.readFileSync('src/pages/HomeworkoutPage.jsx', 'utf-8');
ok('화면이 설명 줄을 그린다', page.includes('PROGRAM_NOTES[name]'), true);

// 운동마다 **어떻게 하는지**가 있어야 한다. 이름만 있으면 「스캡 푸시업」에서 멈춘다
ok('마흔여덟 개 운동에 전부 설명이 있다',
  homeNames.flatMap((n) => home.PROGRAMS[n].map((e) => e.name)).filter((n) => !home.descOf(n)), []);
ok('괄호가 붙은 이름도 설명을 찾는다 (좌 · 의자 · 식탁 아래)',
  home.descOf('사이드 플랭크 힙 딥 (좌)') === home.descOf('사이드 플랭크 힙 딥'), true);
ok('사전에 없는 이름은 빈 줄을 준다 (안 터진다)', home.descOf('없는운동'), '');
ok('화면이 그 설명을 그린다', page.includes('descOf('), true);
// 쉬는 20초 동안 다음이 뭔지 모르면 그 시간이 준비하는 시간이 못 된다
ok('쉬는 화면이 다음 운동을 알려준다', /다음/.test(page) && page.includes('descOf(nextEx.name)'), true);
// 플랭크를 하는 사람은 바닥을 보고 있다 — 화면을 봐야만 알 수 있으면 안 된다
ok('단계가 바뀔 때 소리 · 진동으로 알린다', page.includes('beepDone('), true);
ok('소리는 사람이 누른 순간에 준비한다 (브라우저가 막는다)', page.includes('primeAudio()'), true);
// 40초 플랭크 중에 화면이 꺼지면 남은 시간도 다음도 못 본다
ok('운동하는 동안 화면을 안 재운다', page.includes("wakeLock.request('screen')"), true);
ok('오늘 안 되는 운동은 건너뛸 수 있다', page.includes('skipStep'), true);
ok('완료 화면에 이모지를 안 쓴다', /💪|🎉|🔥/.test(page), false);

// 더보기의 「기능성(특수부대식)」은 홈트의 한 프로그램으로 바로 간다 (`?p=이름`).
// 이름이 한 글자만 달라도 조용히 목록만 열린다 — 아무도 안 터지고 바로가기만 죽는다
const tabbar = fs.readFileSync('src/components/TabBar.jsx', 'utf-8');
const shortcuts = [...tabbar.matchAll(/param: '([^']+)'/g)].map((m) => m[1]);
ok('더보기에 바로가기가 하나 있다', shortcuts, ['기능성(특수부대식)']);
ok('바로가기 이름이 프로그램 표에 있다', shortcuts.filter((n) => !home.PROGRAMS[n]), []);
// 단추에 적히는 말은 프로그램 이름과 **다를 수 있다** — 「기능성(특수부대식)」을 그대로
// 적으면 폰에서 화면 밖으로 나간다. 넉 줄 그리드라 한 칸이 320px 폰에서 80px 이고,
// 라벨은 줄바꿈을 안 한다(nowrap). 11px · 자간 1 로 어림잡아 재본다
const moreLabels = [...tabbar.matchAll(/label: '([^']+)'/g)].map((m) => m[1])
  .filter((l) => !['홈', '기록', '인바디', '루틴', '더보기'].includes(l));
const labelW = (s) => [...s].reduce((a, c) => a + (c.charCodeAt(0) > 0x1100 ? 11 : 6.2) + 1, 0);
ok('더보기 라벨이 폰 한 칸(320px ÷ 4)에 들어간다',
  moreLabels.filter((l) => labelW(l) > 320 / 4 - 8), []);
// 물음표 뒤를 안 보면 홈트레이닝과 특수부대식 두 줄이 같이 켜진다
ok('지금 어느 줄로 왔는지 물음표 뒤까지 본다', /location\.search/.test(tabbar), true);
ok('화면이 물음표 뒤를 읽는다', page.includes("params.get('p')"), true);
ok('없는 이름이 와도 목록만 연다', page.includes('!PROGRAMS[wanted]'), true);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
