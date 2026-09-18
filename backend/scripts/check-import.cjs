// 가져오기 (복원) — 2026-09-18.
//
//   npm run import     (npm run check 에도 들어 있다)
//
// 내보내기는 있는데 되돌릴 길이 없었다. 기기를 바꾸거나 계정을 새로 만들면 내려받아 둔
// 파일이 있어도 못 넣는다. 이 DB 는 파일 하나라 날아갈 위험도 남아 있다.
//
// **여기가 지키는 것은 「내보낸 것을 그 앱이 다시 읽을 수 있는가」다.**
// 내보내기와 가져오기가 서로 다른 글자를 쓰기 시작하면, 그걸 아는 방법은
// 진짜로 잃어버린 날 넣어보는 것뿐이다 — 그때는 늦다.
const rows = require('../src/utils/csvRows');
const { MEASURE_LABEL, FIELD_LABEL, MEASURE_TYPE_OF, FIELD_KEY_OF } = require('../src/utils/measureLabels');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const day = (n) => {
  const t = new Date();
  t.setDate(t.getDate() + n);
  return t.toISOString().slice(0, 10);
};
const TODAY = day(0);

console.log('── 칸 쪼개기 ──');
// 한글 엑셀을 위해 우리가 붙인 BOM 을 걷는다
ok('BOM 을 걷는다', rows.parseCsv('﻿a,b\n1,2')[0], ['a', 'b']);
ok('따옴표 안의 쉼표는 글자다', rows.parseCsv('a,"1,2",c')[0], ['a', '1,2', 'c']);
ok('  두 겹 따옴표는 하나다', rows.parseCsv('a,"그는 ""아니""라고",c')[0], ['a', '그는 "아니"라고', 'c']);
ok('  따옴표 안의 줄바꿈도 글자다', rows.parseCsv('a,"한 줄\n두 줄",c').length, 1);
ok('엑셀의 \\r\\n 을 받는다', rows.parseCsv('a,b\r\n1,2\r\n').length, 2);
ok('  파일 끝의 빈 줄은 버린다', rows.parseCsv('a,b\n1,2\n\n\n').length, 2);
ok('빈 값도 안 터진다', [rows.parseCsv('').length, rows.parseCsv(null).length], [0, 0]);

console.log('');
console.log('── 운동 ──');
const wCsv = `﻿날짜,운동명,무게,세트,횟수
${TODAY},벤치프레스,80,5,8
${TODAY},"랫풀다운, 와이드",60,4,12
${TODAY},푸시업,맨몸,3,20
`;
const w = rows.readWorkouts(wCsv);
ok('세 줄을 읽는다', w.rows.length, 3);
ok('  쉼표가 든 이름도 온전하다', w.rows[1].exercise, '랫풀다운, 와이드');
ok('  맨몸도 그대로', w.rows[2].weight, '맨몸');
ok('  걸린 줄은 없다', w.bad, []);
// **무게 칸은 비워도 된다** — 화면이 그럴 때 맨몸으로 저장한다
ok('무게가 비면 맨몸으로 본다', rows.readWorkouts(`날짜,운동명,무게,세트,횟수\n${TODAY},풀업,,3,10`).rows[0].weight, '맨몸');

// **한 줄이 안 되는 것 때문에 나머지를 버리지 않는다** — 되돌리려고 넣는 파일이다
const wMix = rows.readWorkouts(`날짜,운동명,무게,세트,횟수
1900-01-01,벤치프레스,80,5,8
${TODAY},,80,5,8
${TODAY},스쿼트,100,0,5
${TODAY},데드리프트,140,3,5
`);
ok('걸린 줄만 버리고 나머지는 넣는다', [wMix.rows.length, wMix.bad.length], [1, 3]);
ok('  몇째 줄인지 말한다 (머리글이 1줄)', wMix.bad.map((b) => b.line), [2, 3, 4]);
ok('  1900년은 안 받는다', /날짜/.test(wMix.bad[0].why), true);
ok('  0세트는 안 받는다', /정수/.test(wMix.bad[2].why), true);

// 엑셀에서 열 순서를 바꿔놓고 넣는 사람이 있다 — 자리를 숫자로 박아두면
// 무게 칸에 세트 수가 들어간다
const wSwap = rows.readWorkouts(`운동명,횟수,세트,무게,날짜\n벤치프레스,8,5,80,${TODAY}`);
ok('머리글을 보고 자리를 찾는다', wSwap.rows[0], { date: TODAY, exercise: '벤치프레스', weight: '80', sets: 5, reps: 8 });
ok('머리글이 없으면 무엇이 없는지 말한다', /날짜/.test(rows.readWorkouts('a,b\n1,2').bad[0].why), true);

console.log('');
console.log('── 인바디 ──');
const iCsv = `﻿날짜,키(cm),체중(kg),체지방률(%),골격근량(kg),체수분(L),BMI
${TODAY},178,78.4,15.2,36.1,45.2,24.7
${day(-30)},,80,,,,
`;
const i = rows.readInbody(iCsv);
ok('두 줄을 읽는다', i.rows.length, 2);
ok('  체중만 있어도 받는다', [i.rows[1].weight, i.rows[1].height], [80, null]);
// **BMI 는 다시 센다** — 파일에 적힌 값을 믿으면 키를 고쳐 넣은 파일에서 어긋난다
ok('BMI 를 다시 센다', i.rows[0].bmi, 24.7);
ok('  키가 없으면 BMI 도 없다', i.rows[1].bmi, null);
const iBad = rows.readInbody(`날짜,체중(kg),체지방률(%)\n${TODAY},600,15\n${TODAY},70,140\n${TODAY},,15`);
ok('범위를 벗어난 값은 안 받는다', iBad.rows.length, 0);
ok('  왜인지 말한다', iBad.bad.length, 3);

console.log('');
console.log('── 측정 (한 줄에 한 항목으로 길게 편 것) ──');
const mCsv = `﻿날짜,종류,항목,값
${TODAY},전신 사이즈,가슴둘레,100
${TODAY},전신 사이즈,허리둘레,80
${TODAY},1RM,운동,벤치프레스
${TODAY},1RM,예상 1RM,95
${day(-7)},스톱워치,랩,"[1200,2400]"
`;
const m = rows.readMeasures(mCsv);
ok('(날짜 · 종류)로 다시 묶는다', m.rows.length, 3);
const size = m.rows.find((r) => r.type === 'bodySize');
ok('  이름표를 열쇠로 되돌린다', size.data, { chest: 100, waist: 80 });
const orm = m.rows.find((r) => r.type === 'oneRM');
ok('  글자는 글자로, 숫자는 숫자로', [orm.data.exercise, orm.data.orm], ['벤치프레스', 95]);
const sw = m.rows.find((r) => r.type === 'stopwatch');
ok('  JSON 으로 내보낸 것은 되돌린다', sw.data.laps, [1200, 2400]);
ok('모르는 종류는 지어내지 않는다',
  rows.readMeasures(`날짜,종류,항목,값\n${TODAY},아무거나,가슴둘레,100`).rows.length, 0);

console.log('');
console.log('── 내보내기와 가져오기가 같은 표를 쓰는가 ──');
// **두 벌로 두면 항목 하나를 더할 때 한쪽만 고쳐진다.** 그러면 내보낸 파일을
// 그 앱이 다시 못 읽고, 그걸 아는 방법은 진짜로 잃어버린 날 넣어보는 것뿐이다
const fs = require('fs');
const exportSrc = fs.readFileSync(require('path').join(__dirname, '../src/routes/export.js'), 'utf-8');
ok('내보내기가 공용 이름표를 가져온다', /require\('\.\.\/utils\/measureLabels'\)/.test(exportSrc), true);
ok('  제 손으로 다시 적지 않는다', /const MEASURE_LABEL = \{/.test(exportSrc), false);
ok('이름표가 서로 거꾸로 맞는다',
  Object.entries(MEASURE_LABEL).every(([k, v]) => MEASURE_TYPE_OF[v] === k), true);
ok('  항목 이름표도 맞는다',
  Object.entries(FIELD_LABEL).every(([k, v]) => FIELD_KEY_OF[v] === k), true);
// 이름표가 겹치면 거꾸로 읽을 때 하나가 먹힌다 (「어깨」가 종류이면서 항목이다 —
// 그 둘은 표가 달라서 괜찮지만, 같은 표 안에서 겹치면 안 된다)
ok('  한 표 안에서 이름이 겹치지 않는다',
  [new Set(Object.values(MEASURE_LABEL)).size, new Set(Object.values(FIELD_LABEL)).size],
  [Object.keys(MEASURE_LABEL).length, Object.keys(FIELD_LABEL).length]);

console.log('');
console.log('── 다시 넣어도 안 늘어나는가 (열쇠) ──');
// 같은 파일을 두 번 넣는 일은 반드시 일어난다 — 넣었는지 기억이 안 나서, 또는 끊겨서
const a = { date: TODAY, exercise: '벤치프레스', weight: '80', sets: 5, reps: 8 };
ok('같은 줄은 같은 열쇠다', rows.workoutKey(a), rows.workoutKey({ ...a }));
ok('  무게가 다르면 다른 줄이다', rows.workoutKey(a) === rows.workoutKey({ ...a, weight: '82.5' }), false);
ok('  앞뒤 공백은 같은 줄로 본다', rows.workoutKey(a), rows.workoutKey({ ...a, exercise: ' 벤치프레스 ' }));
ok('인바디는 값이 다 같아야 같은 줄이다',
  rows.inbodyKey({ date: TODAY, weight: 78 }) === rows.inbodyKey({ date: TODAY, weight: 79 }), false);
// 측정은 (날짜 · 종류) 하나에 한 줄이다
ok('측정은 날짜와 종류로 센다',
  rows.measureKey({ date: TODAY, type: 'bodySize' }), `${TODAY}|bodySize`);

console.log('');
console.log(bad ? bad + '건 실패' : '전부 통과');
process.exit(bad ? 1 : 0);
