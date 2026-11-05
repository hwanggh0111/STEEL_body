// **유산소를 시간 · 거리로 적는다** — 그 셈이 맞는가 (2026-11-05).
//
//   npm run cardio     (npm run check 에도 들어 있다)
//
// ── 왜 자로 두나 ──
//
// 유산소 칸은 **앱 전체를 지난다** — 적는 칸 · 목록 줄 · 달력 · 몸 지도 · 운동 끝
// 결산 · 달 요약 · CSV 넣기와 빼기 · 지하에 세우는 줄. 한 자리만 빠뜨리면 그 자리에서
// **「0분」이나 빈 칸**이 뜨는데, 그것은 「안 했다」로 읽힌다.
//
// 그리고 이 셈은 **「무엇을 유산소로 볼 것인가」**를 정한다. 넓게 잡으면 버피 ·
// 케틀벨 스윙처럼 **세트 · 횟수가 맞는 운동**의 칸이 사라지고, 좁게 잡으면 런닝머신이
// 다시 「1세트 1회」로 돌아간다. 그 선을 글자로 지킨다.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const bundle = (entry, out) => {
  esbuild.buildSync({
    entryPoints: [entry], bundle: true, format: 'cjs', outfile: out,
    platform: 'node', logLevel: 'silent',
  });
  const m = require(path.resolve(out));
  fs.unlinkSync(out);
  return m;
};

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const C = bundle('src/data/cardio.js', '.cardio.cjs');
const H = bundle('src/data/bodyHeat.js', '.cardioheat.cjs');
const S = bundle('src/data/sessionSummary.js', '.cardiosum.cjs');
const TODAY = '2026-11-05';

const row = (exercise, extra = {}) => ({
  date: '2026-11-03', exercise, weight: '맨몸', sets: null, reps: null,
  created_at: '2026-11-03T19:00:00.000Z', ...extra,
});

console.log('── 어느 운동이 시간 · 거리로 적는 것인가 ──');
// **사전이 든다.** 「전신 · 유산소」로 묶으면 버피까지 들어와 그 칸이 사라진다
ok('유산소 기계 · 달리기 · 줄넘기', [
  C.isCardioName('런닝머신'), C.isCardioName('실내 자전거'), C.isCardioName('로잉머신'),
  C.isCardioName('스텝퍼'), C.isCardioName('일립티컬'), C.isCardioName('에어바이크'),
  C.isCardioName('스키에르그'), C.isCardioName('인클라인 워킹'),
  C.isCardioName('달리기'), C.isCardioName('줄넘기'),
], [true, true, true, true, true, true, true, true, true, true]);
// ★ **세트 · 횟수가 맞는 운동의 칸을 빼앗지 않는다**
ok('**버피 · 케틀벨 스윙 · 점핑잭은 아니다**', [
  C.isCardioName('버피'), C.isCardioName('케틀벨 스윙'), C.isCardioName('점핑잭'),
  C.isCardioName('하이니'), C.isCardioName('파머스 워크'), C.isCardioName('베어 크롤'),
], [false, false, false, false, false, false]);
ok('  근력 운동도 아니다', [
  C.isCardioName('벤치프레스'), C.isCardioName('스쿼트'), C.isCardioName('랫풀다운'),
], [false, false, false]);
// 사람은 제 손으로 적는다 — 별명 · 영어 · 품은 이름
ok('별명으로도 잡는다', [
  C.isCardioName('트레드밀'), C.isCardioName('러닝머신'), C.isCardioName('사이클'),
  C.isCardioName('자전거'), C.isCardioName('계단오르기'), C.isCardioName('조깅'),
], [true, true, true, true, true, true]);
ok('  영어로도', [C.isCardioName('treadmill'), C.isCardioName('rowing machine')], [true, true]);
ok('  품은 이름도 (「아침 달리기」)', [
  C.isCardioName('아침 달리기'), C.isCardioName('런닝머신 경사 10'), C.isCardioName('실내자전거'),
], [true, true, true]);
// ★ **짧은 이름이 남의 이름 안에 들어가는 것**을 조심한다
ok('「워킹런지」는 유산소가 아니다', C.isCardioName('워킹런지'), false);
ok('  빈 이름 · 없는 것', [C.isCardioName(''), C.isCardioName(null), C.isCardioName('   ')], [false, false, false]);
// 사전이 비면 이 자가 아무것도 안 잡는다 — 그것을 수로 본다
ok('사전에서 이름을 끌어온다 (열 운동 + 별명)', C.cardioNameCount() >= 25, true);

console.log('');
console.log('── 담긴 줄은 이름으로 판단하지 않는다 ──');
// ★★ 지어내 적어둔 옛 줄(「런닝머신 1세트 1회」)이 갑자기 유산소 줄로 읽히면
//    **없는 시간을 0분으로** 그린다. 그 줄은 옛 모양 그대로 둔다
ok('**시간 · 거리가 적힌 줄만 유산소 줄이다**', [
  C.isCardioRow(row('런닝머신', { minutes: 32 })),
  C.isCardioRow(row('런닝머신', { distance_km: 5.2 })),
  C.isCardioRow(row('런닝머신', { sets: 1, reps: 1 })),
  C.isCardioRow(row('벤치프레스', { weight: '80', sets: 4, reps: 8 })),
  C.isCardioRow(null),
], [true, true, false, false, false]);
// 0 은 적은 것이 아니다 (테두리가 1 부터다)
ok('0 분 · 0 km 은 없는 것으로 본다',
  C.isCardioRow(row('런닝머신', { minutes: 0, distance_km: 0 })), false);

console.log('');
console.log('── 사람 말로 ──');
ok('시간', [C.minuteLabel(32), C.minuteLabel(60), C.minuteLabel(95), C.minuteLabel(120), C.minuteLabel(null)],
  ['32분', '1시간', '1시간 35분', '2시간', null]);
ok('거리', [C.kmLabel(5.2), C.kmLabel(10), C.kmLabel(0.5), C.kmLabel(null)], ['5.2km', '10km', '0.5km', null]);
ok('한 줄', [
  C.cardioText(row('런닝머신', { minutes: 32, distance_km: 5.2 })),
  C.cardioText(row('줄넘기', { minutes: 15 })),
  C.cardioText(row('달리기', { distance_km: 10 })),
], ['32분 · 5.2km', '15분', '10km']);

console.log('');
console.log('── 얼마나 빨랐나 (나눗셈이다) ──');
ok('페이스', [C.paceLabel(31, 5), C.paceLabel(30, 5), C.paceLabel(50, 10)],
  ['6분 12초/km', '6분 00초/km', '5분 00초/km']);
// ★ 59.6초가 60초로 올라가면 **「6분 60초」**가 된다
ok('**60초로 올라가면 분을 올린다**', C.paceLabel(599, 66.6), '9분 00초/km');
// 한쪽만 적은 사람에게는 말하지 않는다 — 지어낼 수 없다
ok('하나만 있으면 말하지 않는다', [C.paceLabel(30, null), C.paceLabel(null, 5), C.paceLabel(30, 0)],
  [null, null, null]);
// 1km 에 한 시간이 넘으면 뜻이 없는 수다 (산책 · 재활)
ok('  너무 느리면 말하지 않는다', C.paceLabel(600, 1), null);
ok('  글자로 와도 숫자로 읽는다', C.paceLabel('31', '5'), '6분 12초/km');

console.log('');
console.log('── 최근 이레 ──');
const week = {
  '2026-11-05': [row('런닝머신', { date: '2026-11-05', minutes: 30, distance_km: 5 })],
  '2026-11-03': [row('실내 자전거', { date: '2026-11-03', minutes: 40 }),
    row('벤치프레스', { date: '2026-11-03', weight: '80', sets: 4, reps: 8 })],
  '2026-10-30': [row('달리기', { date: '2026-10-30', minutes: 25, distance_km: 4.2 })],
  '2026-10-20': [row('런닝머신', { date: '2026-10-20', minutes: 999 })],
  '2026-12-01': [row('런닝머신', { date: '2026-12-01', minutes: 60 })],
};
const sum = C.cardioSummary(week, TODAY);
// 11/05 · 11/03 · 10/30 이 창 안이다 (10/30 은 엿새 전). 10/20 은 밖, 12/01 은 앞날
ok('**최근 이레만 센다**', [sum.count, sum.minutes, sum.km], [3, 95, 9.2]);
ok('  이름도 모아둔다', sum.names, ['런닝머신', '실내 자전거', '달리기']);
ok('  한 줄로', C.summaryText(sum), '1시간 35분 · 9.2km');
ok('없으면 말하지 않는다', C.summaryText(C.cardioSummary({}, TODAY)), null);
// 앞날 기록이 섞여도 창 셈이 무너지지 않는다
ok('앞날은 안 센다', C.cardioSummary({ '2026-12-01': week['2026-12-01'] }, TODAY).count, 0);

console.log('');
console.log('── 몸 지도 ──');
const heat = H.buildHeat(week, TODAY);
// 유산소는 여섯 부위에 자리가 없다 — 그 사실은 그대로다
ok('부위 여섯에는 안 들어간다', heat.cardio.count >= 3, true);
// ★ **그런데 셀 곳은 생겼다** — 최근 이레 시간 · 거리
ok('**최근 이레 유산소를 센다**', [heat.cardio7.count, heat.cardio7.minutes, heat.cardio7.km], [3, 95, 9.2]);
// 지어내 적어둔 옛 줄과 **갈라 센다** — 화면이 그 둘에 할 말이 다르다
const mixed = {
  '2026-11-04': [row('런닝머신', { date: '2026-11-04', minutes: 30 }),
    row('런닝머신', { date: '2026-11-04', sets: 1, reps: 1 })],
};
const h2 = H.buildHeat(mixed, TODAY);
ok('**적은 것과 지어낸 것을 갈라 센다**', [h2.cardio.count, h2.cardio.logged], [2, 1]);
ok('  지어낸 줄은 시간에 안 든다', h2.cardio7.minutes, 30);

console.log('');
console.log('── 운동 끝 결산 ──');
const day = {
  '2026-11-05': [
    row('런닝머신', { date: '2026-11-05', minutes: 32, distance_km: 5.2 }),
    row('벤치프레스', { date: '2026-11-05', weight: '80', sets: 4, reps: 8 }),
  ],
};
const sm = S.buildSummary(day, TODAY, '');
ok('**유산소를 따로 센다 (무게와 안 섞는다)**', [sm.cardio.count, sm.cardio.minutes, sm.cardio.km], [1, 32, 5.2]);
ok('  든 무게는 근력 줄만', sm.kg, 80 * 4 * 8);
ok('  세트도 근력 줄만', sm.sets, 4);
ok('  목록의 유산소 줄에 표가 붙는다',
  sm.items.map((i) => [i.exercise, i.cardio, i.minutes]), [['런닝머신', true, 32], ['벤치프레스', false, null]]);
// ★★ 유산소만 한 날 — 든 무게도 세트도 0 이다. 화면이 **그때 시간을 세운다**
const onlyCardio = S.buildSummary(
  { '2026-11-05': [row('달리기', { date: '2026-11-05', minutes: 45, distance_km: 8 })] }, TODAY, '');
ok('**유산소만 한 날은 무게도 세트도 0 이다**', [onlyCardio.kg, onlyCardio.sets], [0, 0]);
ok('  그래서 시간을 들고 있어야 한다', onlyCardio.cardio.minutes, 45);

console.log('');
console.log('── 화면이 그 셈만 쓰는가 ──');
const page = codeOf(fs.readFileSync('src/pages/TrainPage.jsx', 'utf-8'));
ok('기록 화면이 이름으로 칸을 바꾼다', /isCardioName\(/.test(page), true);
ok('  시간 · 거리 칸이 있다', /label="시간 분"/.test(page) && /label="거리 km"/.test(page), true);
// **담긴 줄은 그 줄로 본다** — 둘을 섞으면 옛 줄이 「0분」으로 그려진다
ok('  목록 줄은 그 줄로 본다', /isCardioRow\(w\)/.test(page), true);
// 서버와 같은 테두리를 화면도 든다
ok('  테두리를 들고 말해준다', /MINUTES_MAX}분 이하로/.test(page) && /DISTANCE_KM_MAX}km 이하로/.test(page), true);
// 두 모양을 섞어 보내지 않는다 — 유산소 줄에 세트 · 횟수를 같이 담으면 셈이 갈린다
ok('  유산소 줄에 세트 · 횟수를 안 담는다', /distance_km: String\(distance\)/.test(page), true);

// ★ **고치기로 열면 시간 · 거리가 채워져야 한다** — 안 채우면 고치지도 못하고
// 왜인지도 모른다 (그대로 저장하면 「시간이나 거리를 적어주세요」가 뜬다)
ok('  고치기로 열면 시간 · 거리를 채운다', /setMinutes\(c\.minutes != null/.test(page), true);
// ★ **루틴의 세트 단추가 유산소에 뜨면 「1세트 1회」가 다시 들어온다**
ok('  루틴에서 유산소에는 세트 단추를 안 그린다', /\{cardio \? \(\s*<div[\s\S]{0,200}?유산소는 세트로 세지 않아요/.test(page), true);
ok('  「여기까지 기록」도 안 그린다', /canFinishEarly && !cardio/.test(page), true);
// ★ **유산소 뒤에 휴식 타이머를 켜지 않는다** — 휴식은 세트 사이의 것이다
ok('  유산소 뒤에 쉬라고 하지 않는다', /asCardio\s*\?\s*false/.test(page), true);

const finish = codeOf(fs.readFileSync('src/components/SessionFinish.jsx', 'utf-8'));
ok('결산이 유산소만 한 날 시간을 세운다', /bigCardio/.test(finish), true);
const map = codeOf(fs.readFileSync('src/components/BodyMap.jsx', 'utf-8'));
ok('몸 지도에 유산소 줄이 있다', /cardio7\.count > 0/.test(map), true);
// ★ **이제 참인 말을 한다** — 「이름을 고쳐 적으면」은 거짓이었다(어떻게 적어도 안 된다)
ok('  지어낸 줄에만 「고쳐 적으면」이라고 말한다', /시간 · 거리로 고쳐 적으면/.test(map), true);

console.log('');
console.log('── 서버와 같은 수인가 ──');
const back = require('../../backend/src/utils/cardioFields');
// **제 수를 들고 견준다** (양쪽에서 가져오면 같이 고치는 날 거짓 통과한다)
ok('서버 MINUTES_MAX', back.MINUTES_MAX, 600);
ok('서버 DISTANCE_KM_MAX', back.DISTANCE_KM_MAX, 500);
const limits = fs.readFileSync('src/data/limits.js', 'utf-8');
const numOf = (name) => {
  const m = new RegExp('export const ' + name + ' = (\\d+)').exec(limits);
  return m ? Number(m[1]) : null;
};
ok('화면 MINUTES_MAX', numOf('MINUTES_MAX'), back.MINUTES_MAX);
ok('화면 DISTANCE_KM_MAX', numOf('DISTANCE_KM_MAX'), back.DISTANCE_KM_MAX);

console.log('');
console.log('── 서버가 받는 자 ──');
ok('빈 값은 유산소 줄이 아니다', back.normalizeCardio('', '').cardio, false);
ok('  하나만 있어도 유산소 줄이다',
  [back.normalizeCardio(30, '').cardio, back.normalizeCardio('', 5).cardio], [true, true]);
ok('  0 · 음수 · 글자는 거절하고 까닭을 말한다', [
  back.normalizeCardio(0, '').ok, back.normalizeCardio(-5, '').ok,
  back.normalizeCardio('삼십', '').ok, back.normalizeCardio(30.5, '').ok,
], [false, false, false, false]);
ok('  테두리를 넘으면 그 수를 말해준다', [
  back.normalizeCardio(601, '').why, back.normalizeCardio('', 501).why,
], ['시간은 600분 이하로 적어주세요', '거리는 500km 이하로 적어주세요']);
ok('  거리는 10m 자리까지 담는다', back.normalizeCardio(30, 5.2345).distanceKm, 5.23);
ok('  담긴 줄도 같은 자로 본다', [
  back.isCardioRow({ minutes: 30 }), back.isCardioRow({ distance_km: 5 }),
  back.isCardioRow({ sets: 1, reps: 1 }), back.isCardioRow(null),
], [true, true, false, false]);

console.log('');
console.log('── CSV — 내보낸 것을 되읽을 수 있는가 ──');
const exp = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'src', 'routes', 'export.js'), 'utf-8');
ok('내보내기에 칸 둘이 있다', /시간\(분\),거리\(km\)/.test(exp), true);
const csvRows = require('../../backend/src/utils/csvRows');
const csv = '날짜,운동명,무게,세트,횟수,묶음,시간(분),거리(km)\n'
  + '2026-11-03,런닝머신,맨몸,,,,32,5.2\n'
  + '2026-11-03,벤치프레스,80,4,8,,,\n'
  + '2026-11-03,달리기,맨몸,,,,,10\n';
const parsed = csvRows.readWorkouts(csv);
ok('**유산소 줄을 거절하지 않는다**', parsed.bad, []);
ok('  시간 · 거리를 읽는다', parsed.rows.map((r) => [r.exercise, r.minutes ?? null, r.distanceKm ?? null]),
  [['런닝머신', 32, 5.2], ['벤치프레스', null, null], ['달리기', null, 10]]);
ok('  유산소 줄에는 세트 · 횟수가 없다', [parsed.rows[0].sets, parsed.rows[0].reps], [null, null]);
// 옛 파일(칸이 없는 것)도 그대로 읽힌다
const old = '날짜,운동명,무게,세트,횟수\n2026-11-03,벤치프레스,80,4,8\n';
const oldParsed = csvRows.readWorkouts(old);
ok('옛 파일도 그대로 읽힌다', [oldParsed.bad.length, oldParsed.rows.length], [0, 1]);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
