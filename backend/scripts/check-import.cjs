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
console.log('── 내보낸 그대로 다시 읽히나 ── (2026-10-21)');
//
// 돌려보고 찾았다. 엑셀이 `=` 로 시작하는 칸을 수식으로 읽어서 **내보낼 때 앞에
// 작은따옴표를 붙인다**(`utils/csv.js`). 그런데 **가져올 때 떼지 않았다** —
//
//     "-5도 인클라인"  →  내보냄 "'-5도 인클라인"  →  다시 읽음 "'-5도 인클라인"
//
// 기기를 바꿔 들여온 사람의 운동명이 딴 이름이 됐다. 같은 운동이 두 이름으로 갈라져서
// 최고 기록 · 몸 지도 · 「지난번」이 그 줄을 다른 운동으로 센다.
//
// **내보내기와 가져오기가 서로 다른 글자를 쓰기 시작하는 바로 그 자리다** — 이 파일의
// 머리글이 지키겠다고 적어둔 것. 그래서 여기서 한 바퀴 돌려 못 박는다.
const { csvCell } = require('../src/utils/csv');
const trip = (v) => rows.parseCsv('날짜,운동명\n2026-10-21,' + csvCell(v) + '\n')[1][1];

ok('수식으로 읽히는 이름이 그대로 돌아온다', trip('=HYPERLINK("http://x","눌러")'), '=HYPERLINK("http://x","눌러")');
ok('  + 로 시작하는 이름', trip('+스쿼트'), '+스쿼트');
ok('  @ 로 시작하는 이름', trip('@아침운동'), '@아침운동');
ok('  - 로 시작하는 이름', trip('-5도 인클라인'), '-5도 인클라인');
ok('  = 로 시작하는 무게', trip('=1+1'), '=1+1');
ok('음수는 애초에 안 붙인다 (엑셀에서 합계가 돼야 한다)', [csvCell('-5'), trip('-5')], ['"-5"', '-5']);
ok('  소수 음수도', trip('-5.5'), '-5.5');
ok('평범한 이름은 건드리지 않는다', [trip('벤치프레스'), trip('벤치 프레스, 와이드'), trip('케이블 "플라이"')],
  ['벤치프레스', '벤치 프레스, 와이드', '케이블 "플라이"']);
// **사람이 적은 따옴표는 뗐으면 안 된다.** 뒤 글자가 우리가 막으려던 꼴일 때만 뗀다
ok("사람이 쓴 '벤치' 는 그대로 남는다", rows.parseCsv("날짜,운동명\n2026-10-21,\"'벤치'\"\n")[1][1], "'벤치'");
ok("  '맨몸' 도 그대로", rows.parseCsv("날짜,운동명\n2026-10-21,\"'맨몸\"\n")[1][1], "'맨몸");
// 줄로 읽는 데까지 가봐야 진짜 왕복이다
const tripRow = rows.readWorkouts(
  '날짜,운동명,무게,세트,횟수\n' + TODAY + ',' + csvCell('-5도 인클라인') + ',' + csvCell('=1+1') + ',4,8\n',
);
ok('줄까지 읽어도 이름이 그대로다', [tripRow.rows[0].exercise, tripRow.rows[0].weight], ['-5도 인클라인', '=1+1']);

console.log('');
console.log('── 화면에 적힌 이름표와 같은가 ── (2026-10-21)');
//
// `measureLabels.js` 머리글이 못 박아둔 것: 「화면에 적힌 이름 그대로 내보낸다」 ·
// 「두 벌로 두면 항목 하나를 더할 때 한쪽만 고쳐지고, 그러면 **내보낸 파일을 그 앱이
// 다시 못 읽는다**」. 그런데 이름표는 **화면 쪽에도 한 벌 더 있다**
// (`components/measure/*Section.jsx` 의 `SIZE_FIELDS` · `FLEX_FIELDS` · `FITNESS_TESTS`).
//
// 지금은 둘이 맞다. 어긋나는 날 알 길이 없어서 여기서 센다 — 화면에 칸을 하나 더하면
// 이 검사가 먼저 걸린다.
{
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'measure');
  const seen = [];
  for (const f of fs.readdirSync(dir).filter((n) => /Section\.jsx$/.test(n))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf-8');
    const re = /\{\s*key:\s*'([a-z0-9_]+)'\s*,\s*label:\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(src))) seen.push({ file: f, key: m[1], label: m[2] });
  }
  ok('화면에서 이름표 달린 칸을 찾았다', seen.length > 0, true);
  ok('이름표 표에 없는 칸이 없다',
    seen.filter((s2) => !FIELD_LABEL[s2.key]).map((s2) => `${s2.file} ${s2.key}`), []);
  ok('  적힌 말이 서로 같다',
    seen.filter((s2) => FIELD_LABEL[s2.key] && FIELD_LABEL[s2.key] !== s2.label)
      .map((s2) => `${s2.key}: 화면「${s2.label}」 ≠ 표「${FIELD_LABEL[s2.key]}」`), []);

  // 종류 여섯은 **한 곳에서만** 적는다 — 라우트가 표를 받아 쓰고 있나
  const mr = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'measures.js'), 'utf-8');
  ok('받는 종류를 손으로 또 적지 않는다', /VALID_TYPES = Object\.keys\(MEASURE_LABEL\)/.test(mr), true);
  // 이름표가 겹치면 거꾸로 읽는 표(`flip`)가 한쪽을 잃는다 — 그 칸이 딴 칸으로 들어간다
  const dupe = (o) => {
    const at2 = {}; const out = [];
    for (const [k, v] of Object.entries(o)) { if (at2[v]) out.push(`${v}: ${at2[v]} / ${k}`); at2[v] = k; }
    return out;
  };
  ok('이름표가 겹치지 않는다 (겹치면 거꾸로 읽을 때 한쪽을 잃는다)', dupe(FIELD_LABEL), []);
  ok('  종류 이름표도', dupe(MEASURE_LABEL), []);
}

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
// ── 같은 날 같은 종류가 여러 줄일 때 ── (2026-09-18 에 고쳤다)
//
// 아침·저녁 둘레, 스톱워치 두 판. 여태 (날짜 · 종류)로만 묶어서 그 둘이
// **있지도 않던 한 줄로 합쳐졌다** — 가슴은 아침 것, 허리는 저녁 것.
// 지우는 것보다 나쁘다: 없던 값을 만들어낸다.
const twoNew = `날짜,종류,번호,항목,값
${TODAY},전신 사이즈,1,가슴둘레,100
${TODAY},전신 사이즈,1,허리둘레,80
${TODAY},전신 사이즈,2,가슴둘레,101
${TODAY},전신 사이즈,2,허리둘레,81
`;
const t2 = rows.readMeasures(twoNew);
ok('번호로 두 줄을 가른다', t2.rows.length, 2);
ok('  값이 섞이지 않는다', t2.rows.map((r) => r.data),
  [{ chest: 100, waist: 80 }, { chest: 101, waist: 81 }]);

// **옛 파일에는 「번호」 칸이 없다.** 그때는 같은 항목이 다시 나오면 다음 줄로 본다 —
// 한 줄에 같은 항목이 두 번 나올 일은 없으니, 다시 나온 것은 다음 줄이라는 뜻이다
const twoOld = `날짜,종류,항목,값
${TODAY},전신 사이즈,가슴둘레,100
${TODAY},전신 사이즈,허리둘레,80
${TODAY},전신 사이즈,가슴둘레,101
${TODAY},전신 사이즈,허리둘레,81
`;
const t3 = rows.readMeasures(twoOld);
ok('번호가 없는 옛 파일도 가른다', t3.rows.length, 2);
ok('  값이 섞이지 않는다', t3.rows.map((r) => r.data),
  [{ chest: 100, waist: 80 }, { chest: 101, waist: 81 }]);
// 한 줄짜리는 그대로 한 줄이다
ok('  한 줄은 한 줄로 둔다',
  rows.readMeasures(`날짜,종류,항목,값
${TODAY},1RM,운동,벤치프레스
${TODAY},1RM,예상 1RM,95`).rows.length, 1);

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
// 측정 열쇠는 **값까지 본다** — 안 그러면 같은 날 두 번 잰 사람의 둘째 줄이
// 「이미 있다」로 건너뛰어져 되돌릴 때 사라진다
ok('값이 다르면 다른 줄이다',
  rows.measureKey({ date: TODAY, type: 'bodySize', data: { chest: 100 } })
  === rows.measureKey({ date: TODAY, type: 'bodySize', data: { chest: 101 } }), false);
ok('  값이 같으면 같은 줄이다 (파일에 그 이상이 안 적혀 있다)',
  rows.measureKey({ date: TODAY, type: 'bodySize', data: { chest: 100, waist: 80 } })
  === rows.measureKey({ date: TODAY, type: 'bodySize', data: { waist: 80, chest: 100 } }), true);
ok('  값이 없어도 안 터진다', typeof rows.measureKey({ date: TODAY, type: 'oneRM' }), 'string');

console.log('');
console.log('── 손으로 적는 길과 **같은 자**를 쓰는가 ── (2026-10-22)');
// 같은 기록이 들어오는 길이 둘이다 — `POST /workouts` 와 파일로 넣는 이 길.
// 그런데 자가 두 벌이어서 **파일로만 들어오는 줄**이 있었다:
//
//   손으로   '-50' → 400 「무게 값이 올바르지 않아요」
//   파일로   '-50' → **그대로 저장**  (볼륨을 세는 쪽은 부호를 못 본다)
//   파일로   '<<<>>>' → 새니타이즈하면 빈 이름인데 **이름 없이 저장**
//
// 이제 둘이 `utils/workoutFields.js` 하나를 쓴다.
{
  const fields = require('../src/utils/workoutFields');
  const path = require('path');
  const head = '날짜,운동명,무게,세트,횟수';
  const read = (line) => rows.readWorkouts(head + '\n' + line);

  const neg = read(`${TODAY},벤치프레스,-50,3,10`);
  ok('음수 무게는 안 들어온다', neg.rows.length, 0);
  ok('  몇째 줄이 왜인지 말한다', neg.bad[0] && neg.bad[0].why, '무게는 음수일 수 없어요');
  ok('  줄 수도 말한다', neg.bad[0] && neg.bad[0].line, 2);

  const blank = read(`${TODAY},<<<>>>,60,3,10`);
  ok('새니타이즈하면 빈 이름도 안 들어온다', blank.rows.length, 0);
  ok('  이름이 비었다고 말한다', blank.bad[0] && blank.bad[0].why, '운동명이 비어 있어요');

  // 멀쩡한 줄은 그대로 들어온다 (막는 것만 막는다)
  const good = read(`${TODAY},데드리프트, 100kg ,5,5`);
  ok('쓸 수 있는 줄은 들어온다', good.rows.length, 1);
  ok('  무게의 앞뒤 공백은 다듬는다', good.rows[0] && good.rows[0].weight, '100kg');
  const bare = read(`${TODAY},런지,,3,12`);
  ok('빈 무게는 맨몸이다 (화면과 같다)', bare.rows[0] && bare.rows[0].weight, '맨몸');

  // **자가 한 곳에 있는가** — 두 곳에 적어두면 반드시 어긋난다
  const route = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'workouts.js'), 'utf-8');
  ok('저장하는 길이 그 자를 받아 쓴다', /require\('\.\.\/utils\/workoutFields'\)/.test(route), true);
  ok('  제 손으로 다시 적지 않는다', /function normalizeWeight/.test(route), false);
  const csvSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'csvRows.js'), 'utf-8');
  ok('읽는 쪽도 그 자를 받아 쓴다', /require\('\.\/workoutFields'\)/.test(csvSrc), true);
  const imp = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'importData.js'), 'utf-8');
  ok('가져오는 라우트는 뒤에서 또 다듬지 않는다', /cleanName\(/.test(imp), false);

  // 자 자체도 본다
  ok('자: 음수를 막는다', fields.normalizeWeight('-50').ok, false);
  ok('  빈 칸은 맨몸', fields.normalizeWeight('').value, '맨몸');
  ok('  숫자로 와도 받는다', fields.normalizeWeight(60).value, '60');
  ok('  객체는 못 받는다', fields.normalizeWeight({}).ok, false);
  ok('자: 빈 이름은 null', fields.cleanExerciseName('<<<>>>'), null);
  ok('  긴 이름은 null (100자 넘음)', fields.cleanExerciseName('가'.repeat(101)), null);
}
console.log('');
console.log(bad ? bad + '건 실패' : '전부 통과');
process.exit(bad ? 1 : 0);
