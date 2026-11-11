// **다음 한 걸음 · 지난 판** — 적는 자리가 지난 기록을 맞게 읽는가 (2026-11-05).
//
//   npm run nextstep     (npm run check 에도 들어 있다)
//
// ── 왜 자로 두나 ──
//
// 「같은 무게로 세 판 연속 채웠다」를 **눈으로 보려면 기록을 세 판 만들어야 한다.**
// 그것도 날짜를 바꿔가며. 화면에서 확인할 수 있는 셈이 아니다 — 목표·연속 주를
// `npm run goal` 로 보는 것과 같은 까닭이다.
//
// 그리고 이 셈은 **사람에게 수를 권한다.** 틀리면 「오늘 95kg 를 들어보세요」가 되고,
// 그 말을 믿고 바에 꽂는 사람이 있다. 권하는 자리는 값으로 못 박아둔다.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// `--root=<길>` 을 주면 그 **사본**을 본다 (되돌려-FAIL 은 사본에서 한다 — 트리를 셋이 쓴다)
const ROOT = (process.argv.find((a) => a.startsWith('--root=')) || '').slice(7) || '.';
const at = (rel) => path.join(ROOT, rel);

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

const L = bundle(at('src/data/lastSets.js'), '.lastsets.cjs');
const TODAY = '2026-11-05';

// 줄 하나. `t` 는 적은 시각(시:분) — 차례와 걸린 시간을 재는 데 쓴다
let seq = 0;
const row = (exercise, weight, sets, reps, { link = null, date = '2026-11-01', t = '19:00' } = {}) => ({
  id: (seq += 1), date, exercise, weight, sets, reps, link,
  created_at: `${date}T${t}:00.000Z`,
});
const days = (...rows) => {
  const out = {};
  for (const r of rows) (out[r.date] = out[r.date] || []).unshift(r);   // 목록은 최신이 위다
  return out;
};

console.log('── 세 판 연속 채웠다 → 올려볼 만하다 ──');
const three = days(
  row('벤치프레스', '80', 4, 8, { date: '2026-10-24' }),
  row('벤치프레스', '80', 4, 8, { date: '2026-10-28' }),
  row('벤치프레스', '80', 4, 8, { date: '2026-10-31' }),
);
const up = L.nextStep(three, '벤치프레스', TODAY);
// 올라온 칸을 모른다(무게가 다 같다) → 기본 2.5kg
ok('**올려볼 만하다고 말한다**', [up.kind, up.kg, up.reps, up.sets], ['up', 82.5, 8, 4]);
ok('  몇 판 채웠는지도 준다', [up.streak, up.step], [3, 2.5]);
ok('  무엇을 보고 셌는지 준다', [up.from.kg, up.from.reps, up.from.date], [80, 8, '2026-10-31']);

console.log('');
console.log('── 올라온 칸을 기록에서 배운다 ──');
// 70 → 72.5 → 75 로 올라온 사람이다. 그 사람의 칸은 2.5kg 이다
const ladder = days(
  row('스쿼트', '70', 5, 5, { date: '2026-10-06' }),
  row('스쿼트', '72.5', 5, 5, { date: '2026-10-13' }),
  row('스쿼트', '75', 5, 5, { date: '2026-10-20' }),
  row('스쿼트', '75', 5, 5, { date: '2026-10-27' }),
  row('스쿼트', '75', 5, 5, { date: '2026-11-03' }),
);
const l2 = L.nextStep(ladder, '스쿼트', TODAY);
ok('**배운 칸으로 올린다**', [l2.kind, l2.step, l2.kg], ['up', 2.5, 77.5]);
// 5kg 씩 올라온 사람에게 2.5 를 권하지 않는다
const by5 = days(
  row('데드리프트', '100', 3, 5, { date: '2026-10-06' }),
  row('데드리프트', '105', 3, 5, { date: '2026-10-13' }),
  row('데드리프트', '110', 3, 5, { date: '2026-10-20' }),
  row('데드리프트', '110', 3, 5, { date: '2026-10-27' }),
  row('데드리프트', '110', 3, 5, { date: '2026-11-03' }),
);
ok('  5kg 씩 올라온 사람에게는 5kg', [L.nextStep(by5, '데드리프트', TODAY).step, L.nextStep(by5, '데드리프트', TODAY).kg], [5, 115]);
// 20 → 40 은 칸이 아니라 **기구가 바뀐 것**이다. 그걸 칸으로 쓰면 두 배를 권한다
const jump = days(
  row('덤벨컬', '20', 3, 10, { date: '2026-10-06' }),
  row('덤벨컬', '40', 3, 10, { date: '2026-10-20' }),
  row('덤벨컬', '40', 3, 10, { date: '2026-10-27' }),
  row('덤벨컬', '40', 3, 10, { date: '2026-11-03' }),
);
ok('  크게 뛴 것은 칸으로 안 쓴다 (기구가 바뀐 것)', L.nextStep(jump, '덤벨컬', TODAY).step, 2.5);

console.log('');
console.log('── 못 채웠을 때는 올리지 않는다 ──');
const missed = days(
  row('벤치프레스', '80', 4, 8, { date: '2026-10-24' }),
  row('벤치프레스', '80', 4, 8, { date: '2026-10-28' }),
  row('벤치프레스', '80', 4, 6, { date: '2026-10-31' }),
);
const re = L.nextStep(missed, '벤치프레스', TODAY);
ok('**같은 무게로 다시 권한다**', [re.kind, re.kg, re.reps, re.target], ['retry', 80, 6, 8]);
// 두 판뿐이면 아직 올릴 자리가 아니다 — 몇 판 더인지 말해준다
const two = days(
  row('벤치프레스', '80', 4, 8, { date: '2026-10-28' }),
  row('벤치프레스', '80', 4, 8, { date: '2026-10-31' }),
);
ok('두 판이면 그대로 권한다', (() => { const x = L.nextStep(two, '벤치프레스', TODAY); return [x.kind, x.kg, x.streak, x.need]; })(), ['same', 80, 2, 1]);
// 한 판뿐 — 올라온 흐름이 없다
const one = days(row('랫풀다운', '55', 3, 12, { date: '2026-11-03' }));
ok('  한 판뿐이면 지난번과 같게', (() => { const x = L.nextStep(one, '랫풀다운', TODAY); return [x.kind, x.kg, x.streak]; })(), ['same', 55, 1]);
// 방금 올린 판 — 올린 지 한 판이니 또 올리지 않는다
const justUp = days(
  row('벤치프레스', '80', 4, 8, { date: '2026-10-24' }),
  row('벤치프레스', '80', 4, 8, { date: '2026-10-28' }),
  row('벤치프레스', '82.5', 4, 8, { date: '2026-10-31' }),
);
ok('  방금 올린 판에서 또 올리지 않는다', (() => { const x = L.nextStep(justUp, '벤치프레스', TODAY); return [x.kind, x.kg, x.streak]; })(), ['same', 82.5, 1]);

console.log('');
console.log('── 드롭세트 · 슈퍼세트 ──');
// 그날 80 → 65 → 52 로 내렸다. **드롭은 그 판에서 제일 가벼운 무게**다 —
// 대표 줄로 잡으면 「52kg 로 내려갔다」가 되어 다음에 들 무게가 거짓이 된다
const withDrop = days(
  row('벤치프레스', '80', 2, 8, { date: '2026-10-31', t: '19:00' }),
  row('벤치프레스', '65', 1, 6, { date: '2026-10-31', t: '19:12', link: 'drop' }),
  row('벤치프레스', '52', 1, 5, { date: '2026-10-31', t: '19:14', link: 'drop' }),
);
ok('**드롭 줄은 대표가 못 된다**', L.sessionsOf(withDrop, '벤치프레스', TODAY)[0].kg, 80);
// 드롭 줄만 있는 날 — 본세트를 다른 이름으로 적은 날이다. 셈에서 뺀다
const dropOnly = days(
  row('케이블플라이', '20', 1, 12, { date: '2026-10-31', link: 'drop' }),
  row('케이블플라이', '25', 3, 12, { date: '2026-10-24' }),
);
ok('  드롭만 있는 날은 셈에서 뺀다', L.sessionsOf(dropOnly, '케이블플라이', TODAY).map((s) => s.skipped), [true, false]);
ok('  그래서 지난 판은 그 앞 판을 본다', L.nextStep(dropOnly, '케이블플라이', TODAY).from.date, '2026-10-24');
// 슈퍼세트는 **제 무게로 한 멀쩡한 세트**다 — 가리지 않는다 (2026-10-05 의 교훈)
const sup = days(row('레터럴레이즈', '12', 4, 15, { date: '2026-11-03', link: 'super' }));
ok('슈퍼세트는 가리지 않는다', L.nextStep(sup, '레터럴레이즈', TODAY).from.kg, 12);

console.log('');
console.log('── 맨몸은 횟수로 권한다 ──');
const body = days(
  row('풀업', '맨몸', 4, 10, { date: '2026-10-24' }),
  row('풀업', '', 4, 10, { date: '2026-10-28' }),
  row('풀업', '맨몸', 4, 10, { date: '2026-10-31' }),
);
const b = L.nextStep(body, '풀업', TODAY);
ok('**한 회 더 권한다**', [b.kind, b.body, b.kg, b.reps], ['up', true, null, 11]);
const bodyMiss = days(
  row('풀업', '맨몸', 4, 10, { date: '2026-10-28' }),
  row('풀업', '맨몸', 4, 7, { date: '2026-10-31' }),
);
ok('  못 채웠으면 같은 횟수를 노린다', (() => { const x = L.nextStep(bodyMiss, '풀업', TODAY); return [x.kind, x.target]; })(), ['retry', 10]);

console.log('');
console.log('── 테두리 · 이상한 값 ──');
// 테두리에 닿았으면 **칸이 막아 세울 값을 권하지 않는다** (단추가 거짓이 된다)
const maxed = days(
  row('레그프레스', '999', 3, 10, { date: '2026-10-24' }),
  row('레그프레스', '999', 3, 10, { date: '2026-10-28' }),
  row('레그프레스', '999', 3, 10, { date: '2026-10-31' }),
);
ok('**테두리를 넘겨 권하지 않는다**', (() => { const x = L.nextStep(maxed, '레그프레스', TODAY); return [x.kind, x.kg, x.capped]; })(), ['same', 999, true]);
// 앞날에 적은 기록 — 아직 한 것이 아니다
const future = days(
  row('벤치프레스', '80', 4, 8, { date: '2026-10-31' }),
  row('벤치프레스', '200', 4, 8, { date: '2026-12-01' }),
);
ok('앞날 기록은 안 본다', L.nextStep(future, '벤치프레스', TODAY).from.kg, 80);
ok('기록이 없으면 안 권한다', L.nextStep({}, '벤치프레스', TODAY), null);
ok('  빈 이름·없는 것도 안 터진다',
  [L.nextStep(null, '', TODAY), L.nextStep({}, null, TODAY), L.sessionsOf(null, null).length], [null, null, 0]);
// 횟수를 못 읽는 줄 — 권할 수가 없다
ok('횟수를 못 읽으면 안 권한다', L.nextStep(days(row('벤치프레스', '80', 4, null, { date: '2026-10-31' })), '벤치프레스', TODAY), null);
// 무게 칸은 자유 입력이다 — 음수는 `parseWeight` 가 못 읽는 값으로 떨어뜨린다(맨몸 대접)
ok('음수 무게는 맨몸으로 떨어진다', L.sessionsOf(days(row('벤치프레스', '-50', 4, 8, { date: '2026-10-31' })), '벤치프레스', TODAY)[0].kg, null);
// 이름 앞뒤 공백 · 같은 이름 다른 운동
ok('이름의 앞뒤 공백은 같은 운동이다',
  L.sessionsOf(days(row(' 벤치프레스 ', '80', 4, 8, { date: '2026-10-31' })), '벤치프레스', TODAY).length, 1);

console.log('');
console.log('── 지난 판 (C안) ──');
const session = days(
  row('벤치프레스', '80', 1, 8, { date: '2026-10-31', t: '19:00' }),
  row('벤치프레스', '80', 1, 8, { date: '2026-10-31', t: '19:04' }),
  row('벤치프레스', '75', 1, 7, { date: '2026-10-31', t: '19:09' }),
  row('벤치프레스', '52', 1, 5, { date: '2026-10-31', t: '19:12', link: 'drop' }),
);
const ls = L.lastSession(session, '벤치프레스', TODAY);
// ★ **적은 차례로** 그린다 — 목록은 최신이 위라 그대로 그리면 세트가 거꾸로 읽힌다
ok('**적은 차례로 준다**', ls.lines.map((l) => l.weightText), ['80kg', '80kg', '75kg', '52kg']);
ok('  드롭 표시가 남는다', ls.lines.map((l) => l.link), [null, null, null, 'drop']);
ok('  세트 합', ls.totalSets, 4);
ok('  며칠 전인지 말한다', [ls.date, ls.days, ls.ago], ['2026-10-31', 5, '5일 전']);
// ★ 「세트 사이」라고 말하지 않는다 — 우리가 아는 것은 **줄을 적은 시각**뿐이다
ok('**첫 줄부터 마지막 줄까지를 잰다**', ls.span, '12분');
ok('  줄이 하나면 시간을 말하지 않는다',
  L.lastSession(days(row('벤치프레스', '80', 4, 8, { date: '2026-10-31' })), '벤치프레스', TODAY).span, null);
// 자유 입력은 **적힌 그대로** — 수만 꺼내면 「양쪽」이 사라져 한쪽 무게로 읽힌다
ok('「20kg 양쪽」은 적힌 그대로 보여준다',
  L.lastSession(days(row('덤벨프레스', '20kg 양쪽', 3, 10, { date: '2026-11-03' })), '덤벨프레스', TODAY)
    .lines.map((l) => [l.weightText, l.kg]), [['20kg 양쪽', 20]]);
ok('  맨몸은 맨몸이라고 적는다',
  L.lastSession(days(row('풀업', '', 4, 10, { date: '2026-11-03' })), '풀업', TODAY).lines[0].weightText, '맨몸');
ok('기록이 없으면 null', L.lastSession({}, '벤치프레스', TODAY), null);
// 시각을 못 읽는 줄(지하에서 적어 세운 줄)이 섞여도 차례가 무너지지 않는다
const noStamp = days(
  row('벤치프레스', '80', 1, 8, { date: '2026-11-03', t: '19:00' }),
  { id: 99, date: '2026-11-03', exercise: '벤치프레스', weight: '75', sets: 1, reps: 7, created_at: null },
);
ok('시각을 못 읽는 줄은 뒤에 둔다',
  L.lastSession(noStamp, '벤치프레스', TODAY).lines.map((l) => l.weightText), ['80kg', '75kg']);

console.log('');
console.log('── ★ 적고 있는 날은 셈에서 뺀다 ──');
// ★★ **오늘은 아직 안 끝났다.** 안 빼면 오늘 한 세트를 적자마자 「80kg 8회를 3판
//    채웠어요 — 올려볼 자리예요」가 **지금 적을 칸에** 뜬다 — 세트 사이에
//    「82.5kg 로 올리세요」로 읽힌다 (11/04 에 「안 끝난 주는 늘 꺾여 보인다」로
//    배운 그 모양이다)
const withToday = days(
  row('벤치프레스', '80', 4, 8, { date: '2026-10-28' }),
  row('벤치프레스', '80', 4, 8, { date: '2026-10-31' }),
  row('벤치프레스', '80', 1, 8, { date: TODAY }),      // 오늘 한 세트만 적었다
);
const wt = L.nextStep(withToday, '벤치프레스', TODAY, TODAY);
ok('**오늘 적은 줄을 완료로 세지 않는다**', [wt.kind, wt.streak, wt.need], ['same', 2, 1]);
// ★ 「지난 판」은 **지난 날**이다 — 오늘 것은 바로 아래 목록에 이미 있다
ok('**「지난 판」에 오늘이 안 뜬다**',
  (() => { const x = L.lastSession(withToday, '벤치프레스', TODAY, TODAY); return [x.date, x.ago]; })(),
  ['2026-10-31', '5일 전']);
// 지난 날짜에 적을 때는 **그 날 앞까지** 본다 (달력에서 어제 것을 적어 넣는 길)
ok('지난 날짜에 적으면 그 날 앞까지 본다',
  L.nextStep(withToday, '벤치프레스', TODAY, '2026-10-31').from.date, '2026-10-28');
// 날을 안 넘기면 오늘을 뺀다 (`writing` 이 없으면 `today` 로 본다)
ok('  날을 안 넘기면 오늘로 본다',
  L.nextStep(withToday, '벤치프레스', TODAY).from.date, '2026-10-31');
// 그 날 앞에 아무것도 없으면 권하지 않는다
ok('  그 앞에 판이 없으면 안 권한다',
  L.nextStep(days(row('벤치프레스', '80', 4, 8, { date: TODAY })), '벤치프레스', TODAY, TODAY), null);

console.log('');
console.log('── 왜 이 수인가 (화면이 그대로 적는 말) ──');
// ★ 말과 수는 **같이 틀린다** — 「세 판 채웠어요」라고 적으면서 두 판만 셌으면 거짓이다
ok('올릴 때', L.stepReason(up), '80kg 8회를 3판 채웠어요 — 한 칸(2.5kg) 올려볼 자리예요.');
ok('  배운 칸을 그대로 말한다', L.stepReason(L.nextStep(by5, '데드리프트', TODAY)), '110kg 5회를 3판 채웠어요 — 한 칸(5kg) 올려볼 자리예요.');
ok('못 채웠을 때', L.stepReason(re), '지난번 8회를 노렸는데 6회에서 멈췄어요 — 같은 무게로 한 번 더 어떨까요?');
ok('  맨몸이면 횟수로 말한다', L.stepReason(L.nextStep(bodyMiss, '풀업', TODAY)), '지난번 10회를 노렸는데 7회에서 멈췄어요 — 같은 횟수를 다시 노려볼까요?');
ok('두 판이면 몇 판 더인지', L.stepReason(L.nextStep(two, '벤치프레스', TODAY)), '80kg 8회를 2판 채웠어요 — 1판 더 채우면 올려볼 자리예요.');
ok('한 판뿐이면 그대로', L.stepReason(L.nextStep(one, '랫풀다운', TODAY)), '지난번 그대로예요 — 55kg 12회 (11/03).');
ok('테두리에 닿았으면 그렇게 말한다', L.stepReason(L.nextStep(maxed, '레그프레스', TODAY)),
  '999kg 10회를 3판 채웠어요 — 칸이 받는 가장 큰 값이라 더 올려 권하지 않아요.');
ok('  맨몸을 올릴 때', L.stepReason(b), '10회를 3판 채웠어요 — 한 회 올려볼 자리예요.');
ok('없는 것도 안 터진다', L.stepReason(null), '');

console.log('');
console.log('── 말하는 손 ──');
ok('며칠 전', [L.agoLabel(0), L.agoLabel(1), L.agoLabel(5), L.agoLabel(null)], ['오늘', '어제', '5일 전', '']);
ok('걸린 시간', [L.spanLabel(26 * 60000), L.spanLabel(65 * 60000), L.spanLabel(120 * 60000), L.spanLabel(20000)],
  ['26분', '1시간 5분', '2시간', null]);

console.log('');
console.log('── 「지난번」이 보는 날 ── (2026-11-09, 이 자리에서 잡은 버그 둘)');
// ★ **앞날 기록이 「지난번」이 되고 칸까지 채웠다.** 달력의 「적기」는 앞날을 막지
// 않는다 — 다음 주 월요일에 「벤치 100kg」을 적어두면 오늘 화면이 「지난번 100kg」을
// 적고 칸에도 100 이 들어갔다. 11/05 에 측정 · 인바디 · 앞날 목표에서 고친 그 모양이다
const FUT = {
  '2026-11-03': [{ exercise: '벤치프레스', weight: '80', sets: 3, reps: 8 }],
  '2026-11-16': [{ exercise: '벤치프레스', weight: '100', sets: 5, reps: 5 }],
};
ok('앞날 줄은 「지난번」이 아니다',
  (L.lastRecordOf(FUT, '벤치프레스', TODAY, TODAY) || {}).weight, '80');
ok('  날짜도 지난 것을 가리킨다',
  (L.lastRecordOf(FUT, '벤치프레스', TODAY, TODAY) || {}).date, '2026-11-03');
ok('  세트 수도 앞날에서 안 가져온다', L.plannedSetsOf(FUT, '벤치프레스', TODAY, TODAY, null), 3);
// ⑵ **지난 날짜에 적을 때 뒷날 것은 「지난번」이 아니라 다음번이다**
const BACK = {
  '2026-11-01': [{ exercise: '벤치프레스', weight: '75', sets: 3, reps: 8 }],
  '2026-11-03': [{ exercise: '벤치프레스', weight: '80', sets: 4, reps: 8 }],
};
ok('어제 것을 적을 때 오늘 줄을 안 집는다',
  (L.lastRecordOf(BACK, '벤치프레스', TODAY, '2026-11-02') || {}).weight, '75');
ok('  세트 수도 그 날까지만 본다', L.plannedSetsOf(BACK, '벤치프레스', TODAY, '2026-11-02', null), 3);
// ★ **그 날 것은 뺀다고 하지 않았다** — 한 세트 적고 둘째 세트를 적을 때 칸이
// 채워지는 것이 이 자리의 쓸모다 (`nextStep` 은 그 날을 빼지만 여기는 넣는다)
ok('그 날 적은 줄은 「지난번」으로 쓴다',
  (L.lastRecordOf(BACK, '벤치프레스', TODAY, '2026-11-03') || {}).weight, '80');
// 드롭세트는 그 판에서 제일 가벼운 무게다 — 다음에 들 무게가 아니다 (2026-10-05)
const DROP = {
  '2026-11-03': [
    { exercise: '벤치프레스', weight: '80', sets: 3, reps: 8 },
    { exercise: '벤치프레스', weight: '52', sets: 1, reps: 10, link: 'drop' },
  ],
};
ok('드롭 줄은 건너뛴다', (L.lastRecordOf(DROP, '벤치프레스', TODAY, TODAY) || {}).weight, '80');
ok('세트가 안 적힌 줄은 더 거슬러 간다',
  L.plannedSetsOf({
    '2026-11-01': [{ exercise: '벤치프레스', weight: '75', sets: 4, reps: 8 }],
    '2026-11-03': [{ exercise: '벤치프레스', minutes: 30 }],
  }, '벤치프레스', TODAY, TODAY, null), 4);
ok('기록이 없으면 루틴에 적힌 것', L.plannedSetsOf({}, '벤치프레스', TODAY, TODAY, 5), 5);
ok('  둘 다 없으면 모르는 것이다', L.plannedSetsOf({}, '벤치프레스', TODAY, TODAY, null), null);
ok('이상한 것을 줘도 안 터진다',
  [L.lastRecordOf(null, '', null, null), L.lastRecordOf({ x: null }, '벤치프레스', TODAY, TODAY),
    L.plannedSetsOf(null, '벤치프레스', TODAY, TODAY, 0)],
  [null, null, null]);

console.log('');
console.log('── ★ 뺀 판을 말해주는가 (2026-11-11) ──');
// 드롭 줄만 적은 날은 셈에서 뺀다(10/05 에 정했다). 그런데 **말을 안 했다** —
// 어제 드롭만 적은 사람은 「다음 한 걸음」이 그 전 판을 근거로 권하는데도
// 「어제 걸로 권했구나」로 읽는다. 수는 맞고 **무엇을 보고 권했는지가 거짓**이다
{
  const 드롭만 = days(
    row('벤치프레스', '80', 4, 8, { date: '2026-10-28' }),
    row('벤치프레스', '80', 4, 8, { date: '2026-10-31' }),
    row('벤치프레스', '60', 1, 12, { date: '2026-11-03', link: 'drop' }),
  );
  const st = L.nextStep(드롭만, '벤치프레스', TODAY);
  ok('**뺀 판의 날짜를 들고 온다**', st.skippedLast, '2026-11-03');
  ok('  근거는 그 전 판이다 (80kg)', [st.from.kg, st.from.date], [80, '2026-10-31']);
  // ★ **두 토막으로 준다** (꼴 쪽 요청 · 2026-11-11). 「왜 그 판을 안 봤나」와
  // 「무엇을 권하나」는 다른 말이다 — 한 문장으로 이으면 좁은 폰에서 넉 줄이 된다.
  // **화면에서 글자를 자르지 않는다**(말의 주인이 둘이 된다) — 셈이 토막을 둘로 준다
  ok('  뺀 판은 **따로** 말한다', L.stepExcluded(st), '11/03 판은 드롭세트 줄만 있어 근거에서 뺐어요');
  ok('  권하는 말에는 **안 섞인다**', /근거에서 뺐어요/.test(L.stepReason(st)), false);
  ok('  권하는 말은 그대로다', /2판 채웠어요/.test(L.stepReason(st)), true);

  // 멀쩡한 판이 가장 최근이면 **아무 말도 안 한다** — 늘 떠 있으면 아무도 안 읽는다
  const 멀쩡 = days(
    row('벤치프레스', '60', 1, 12, { date: '2026-10-28', link: 'drop' }),
    row('벤치프레스', '80', 4, 8, { date: '2026-10-31' }),
    row('벤치프레스', '80', 4, 8, { date: '2026-11-03' }),
  );
  const st2 = L.nextStep(멀쩡, '벤치프레스', TODAY);
  ok('최근 판이 멀쩡하면 말하지 않는다', st2.skippedLast, undefined);
  ok('  토막도 빈 글이다', L.stepExcluded(st2), '');
  ok('  권하는 말에도 없다', /근거에서 뺐어요/.test(L.stepReason(st2)), false);

  // 드롭 줄만 있고 그 앞에 아무것도 없으면 **권할 것이 없다**(여태 그랬다)
  const 드롭뿐 = days(row('벤치프레스', '60', 1, 12, { date: '2026-11-03', link: 'drop' }));
  ok('드롭 줄뿐이면 권하지 않는다', L.nextStep(드롭뿐, '벤치프레스', TODAY), null);
  ok('  권할 것이 없으면 줄도 없다', [L.stepReason(null), L.stepExcluded(null)], ['', '']);
}

console.log('');
console.log('── 화면이 그 셈만 쓰는가 ──');
const page = codeOf(fs.readFileSync(at('src/pages/TrainPage.jsx'), 'utf-8'));
ok('기록 화면이 셈 자리를 불러 쓴다', /nextStep\(|lastSession\(/.test(page), true);
// ★ 「지난번」도 그 자리를 쓴다 — 화면에서 또 세면 날짜 가리는 선이 둘이 된다
ok('  「지난번」도 셈 자리를 불러 쓴다', /lastRecordOf\(|plannedSetsOf\(/.test(page), true);
ok('  화면이 기록을 제자리에서 거슬러 가지 않는다',
  /Object\.keys\(workouts\)\.sort\(\)\.reverse\(\)/.test(page), false);
// 권하는 말은 **물음**이다 — 명령으로 적으면 등급을 매기는 꼴이 된다
ok('  권하는 것일 뿐이라고 적어둔다', /컨디션은 사람이 압니다|권하는 것일 뿐/.test(page), true);
// ★ 「세트 사이」라고 적지 않는다 (`pace.js` 가 못 박은 말이다)
ok('  「세트 사이」라고 적지 않는다', /세트 사이 (?:보통|휴식)/.test(page), false);

console.log('');
console.log('── 화면이 두 토막을 다 그리는가 ──');
// 토막을 갈라만 두고 화면이 하나만 그리면 **뺀 판을 말하는 기능이 조용히 사라진다**
ok('뺀 판 토막을 그린다', /stepExcluded\(step\)/.test(page), true);
ok('  없으면 그 칸을 안 그린다', /\{stepExcluded\(step\) && \(/.test(page), true);
ok('  권하는 말도 그대로 그린다', /\{stepReason\(step\)\}/.test(page), true);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
