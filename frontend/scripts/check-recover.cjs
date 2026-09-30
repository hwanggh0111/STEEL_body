// 회복 시간 — 숨이 가라앉는 데 몇 초 걸리나 (2026-09-30).
//
//   npm run recover     (npm run check 에도 들어 있다)
//
// 계획은 `docs/BREATH-RECOVER-2026-09-30.md`.
//
// **화면으로는 확인할 수가 없는 자리다.** 한 줄을 눈으로 보려면 마이크를 켜고 실제로
// 숨이 차야 하고, 「지난 번보다 빨라졌어요」를 보려면 **다른 날에 같은 동작을 또** 해야
// 한다. 그래서 여기서 값으로 본다 — 계산 쪽은 마이크도 화면도 아예 안 만진다.
//
// 지키는지 보는 것: 처음 스친 `calm` 로 적지 않는다(버텨야 인정) · 적는 값은 **처음
// 가라앉은 시각**이다 · 못 들은 것(`null`)을 가라앉은 것으로 안 친다 · 못 쟀으면 까닭을
// 적는다 · 빈 것을 0 으로 안 적는다 · 견줄 상대는 **같은 판·동작·길이**의 지난 번이고
// **오늘 것은 안 쓴다** · 3초 안쪽은 「거의 같아요」.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const R = bundle('src/data/breathRecover.js', '.r1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const META = { program: '기능성(특수부대식)', exercise: '버피', duration: 40 };
/** 상태를 차례로 먹인다. steps 는 [[state, 몇 ms 째], …] */
const run = (steps, meta = META) => {
  let st = R.startRecover(0, meta);
  steps.forEach(([state, at]) => { st = R.recoverTick(st, state, at); });
  return st;
};

console.log('── 가라앉았다고 인정하는 때 ──');

// 25초에 처음 가라앉고, 2초를 버텼다 → **25초**다 (27초가 아니다)
ok('버티면 인정한다', run([
  ['high', 5000], ['mid', 15000], ['calm', 25000], ['calm', 26000], ['calm', 27000],
]).seconds, 25);

// 스쳤다 다시 올라오면 **처음부터 다시 센다.** 이것이 없으면 실제보다 늘 빠르게 적힌다
ok('스친 것은 안 센다', run([
  ['calm', 10000], ['high', 10500], ['mid', 20000], ['calm', 30000], ['calm', 32000],
]).seconds, 30);
ok('  아직 버티는 중이면 안 적는다', run([['calm', 10000], ['calm', 11000]]).seconds, null);
ok('  1.9초는 모자라다', run([['calm', 10000], ['calm', 11900]]).seconds, null);

// 시끄러운 방에서는 `breathState` 가 `null` 을 준다. 그걸 가라앉은 것으로 치면
// **0초**가 적힌다 — 가장 나쁜 거짓말이 된다
ok('못 들은 것은 가라앉은 것이 아니다', run([
  [null, 1000], [null, 5000], [null, 9000],
]).seconds, null);

console.log('\n── 못 쟀을 때 ──');
const cut = R.endRecover(run([['high', 5000], ['mid', 9000]]));
ok('쉬는 시간이 먼저 끝나면 까닭을 적는다', cut.why, 'cut');
ok('  초는 비워둔다 (0 이 아니다)', cut.seconds, null);
ok('  사람이 읽을 말이 있다', R.recoverWhy('cut'), '가라앉기 전에 다음으로 넘어갔어요');
ok('3분을 넘기면 안 적는다', run([['high', 190000]]).why, 'toolong');
ok('  이미 잰 칸은 안 건드린다',
  R.endRecover(run([['calm', 3000], ['calm', 6000]])).why, null);
ok('  잰 뒤에 더 먹여도 안 바뀐다',
  R.recoverTick(run([['calm', 3000], ['calm', 6000]]), 'high', 50000).seconds, 3);

console.log('\n── 견줄 열쇠 ──');
ok('판·동작·길이 셋이다', R.recoverKey('기능성(특수부대식)', '버피', 40), '기능성(특수부대식)::버피::40');
// 40초 버피 뒤와 20초 버피 뒤는 같은 것이 아니다
ok('  길이가 다르면 딴 열쇠다',
  R.recoverKey('A', '버피', 40) === R.recoverKey('A', '버피', 20), false);
ok('  이름이 없으면 열쇠가 없다', R.recoverKey('A', '', 40), null);
ok('  길이가 없으면 열쇠가 없다', R.recoverKey('A', '버피', null), null);

console.log('\n── 이력 ──');
const KEY = R.recoverKey('기능성(특수부대식)', '버피', 40);
const day = (date, seconds) => ({ ...META, key: KEY, date, seconds, duration: 40, exercise: '버피' });
let log = [];
log = R.pushRecover(log, day('2026-09-20', 33));
log = R.pushRecover(log, day('2026-09-25', 30));
ok('쌓인다', log.length, 2);
// 소리도, 언제 몇이었는지도 안 남긴다
ok('  남기는 것은 다섯 가지뿐', Object.keys(log[0]).sort(), ['date', 'duration', 'exercise', 'key', 'seconds']);
ok('못 잰 칸은 안 쌓는다', R.pushRecover(log, day('2026-09-26', null)).length, 2);
// 같은 날 같은 동작을 두 번 하면 **둘 다 쌓는다** (뒤로 갈수록 느려지는 것도 읽을 거리다)
const twice = R.pushRecover(R.pushRecover([], day('2026-09-30', 28)), day('2026-09-30', 35));
ok('같은 날 두 번도 둘 다 쌓는다', twice.length, 2);

console.log('\n── 견주기 ──');
ok('같은 열쇠의 지난 번을 고른다', R.pickRecoverPrev(log, KEY, '2026-09-30')?.seconds, 30);
// 오늘 것을 쓰면 「체력이 늘었나」가 아니라 「판이 뒤로 갈수록 힘든가」가 된다
ok('  오늘 것은 안 쓴다',
  R.pickRecoverPrev(R.pushRecover(log, day('2026-09-30', 20)), KEY, '2026-09-30')?.seconds, 30);
ok('  딴 열쇠는 안 준다', R.pickRecoverPrev(log, R.recoverKey('A', '스쿼트', 40), '2026-09-30'), null);
ok('  견줄 것이 없으면 null', R.pickRecoverPrev([], KEY, '2026-09-30'), null);
ok('여태 몇 번 쟀나', R.recoverCount(log, KEY), 2);

console.log('\n── 한 줄로 옮기기 ──');
const prev = { seconds: 33 };
ok('빨라지면 그렇게 적는다',
  /8초 빨라졌어요 \(33 → 25초\)/.test(R.recoverLine({ seconds: 25, why: null }, prev).text), true);
ok('  더 걸리면 그렇게 적는다',
  /7초 더 걸렸어요 \(33 → 40초\)/.test(R.recoverLine({ seconds: 40, why: null }, prev).text), true);
// 3초를 「빨라졌어요」로 적으면 사람은 없는 변화를 믿는다
ok('3초 안쪽은 거의 같다', /거의 같아요/.test(R.recoverLine({ seconds: 30, why: null }, prev).text), true);
ok('  4초는 말한다', /빨라졌어요/.test(R.recoverLine({ seconds: 29, why: null }, prev).text), true);
ok('첫 번은 견줄 것이 없다고 적는다',
  /아직 견줄 것이 없어요/.test(R.recoverLine({ seconds: 25, why: null }, null).text), true);
ok('  그 줄은 단정이 아니다', R.recoverLine({ seconds: 25, why: null }, null).sure, false);
ok('  견줄 것이 있으면 단정한다', R.recoverLine({ seconds: 25, why: null }, prev).sure, true);
ok('근거는 「숨」이다', R.recoverLine({ seconds: 25, why: null }, prev).basis, '숨');
ok('못 쟀으면 까닭만 적는다', R.recoverLine({ seconds: null, why: 'cut' }, prev).text,
  '가라앉기 전에 다음으로 넘어갔어요');
ok('  까닭도 없으면 아무 말도 안 한다', R.recoverLine({ seconds: null, why: null }, prev), null);

// **점수 · 등급 · 또래를 안 쓴다** (8/25 · 9/19 에 정한 말투)
const words = [
  R.recoverLine({ seconds: 25, why: null }, prev).text,
  R.recoverLine({ seconds: 40, why: null }, prev).text,
  R.recoverLine({ seconds: 25, why: null }, null).text,
].join(' ');
ok('점수를 안 매긴다', /점|등급|정상|또래|평균보다/.test(words), false);
ok('  나무라지 않는다', /부족|나쁨|문제/.test(words), false);

console.log('\n── 「지금 재보기」 ──');
// 재보기는 **판에서 동작을 하고 잰 것이 아니다.** 안 쌓고 안 견준다
ok('잰 초를 적는다', R.tryLine({ seconds: 25, why: null }), '숨이 가라앉는 데 25초 걸렸어요. 재보기라 안 쌓아둡니다.');
ok('  안 쌓는다고 밝힌다', /안 쌓아둡니다/.test(R.tryLine({ seconds: 25, why: null })), true);
// 「0초 걸렸어요」는 틀린 말은 아니지만 읽히지 않는다
ok('이미 가라앉아 있었으면 그렇게 적는다',
  /숨이 찬 뒤에 눌러보세요/.test(R.tryLine({ seconds: 0, why: null })), true);
ok('  3초까지 그렇게 본다', /숨이 찬 뒤에/.test(R.tryLine({ seconds: 3, why: null })), true);
ok('  4초는 잰 것으로 적는다', /4초 걸렸어요/.test(R.tryLine({ seconds: 4, why: null })), true);
ok('못 쟀으면 까닭을 적는다', R.tryLine({ seconds: null, why: 'toolong' }), '너무 오래 걸려서 안 적었어요');
ok('  없으면 아무 말도 안 한다', R.tryLine(null), null);

console.log('\n── 판 하나의 결산 ──');
const rows = [
  { ...day('2026-09-30', 25), key: KEY },
  { ...day('2026-09-30', 51), key: R.recoverKey('기능성(특수부대식)', '점프스쿼트', 30) },
  { ...day('2026-09-30', null), key: KEY },        // 못 잰 칸
];
const sum = R.recoverSummary(rows, log, '2026-09-30');
ok('잰 칸만 센다', sum.count, 2);
ok('  가장 오래 걸린 것', sum.slowest.seconds, 51);
ok('  견줄 수 있었던 칸', sum.compared, 1);
ok('  빨라진 칸', sum.faster, 1);
ok('  더 걸린 칸', sum.slower, 0);
ok('한 줄로 적는다', /2칸 쟀어요.*1칸이 지난 번보다 빨라졌어요/.test(R.summaryLine(sum)), true);
ok('견줄 것이 하나도 없으면 센 것만 말한다',
  /다음에 같은 동작을 하면/.test(R.summaryLine(R.recoverSummary(rows, [], '2026-09-30'))), true);
ok('잰 칸이 없으면 결산이 없다', R.recoverSummary([], log, '2026-09-30'), null);
ok('  그 줄도 없다', R.summaryLine(null), null);

console.log('');
console.log('── 「회복」 갈래가 그릴 묶음 ──');
const K2 = R.recoverKey('기능성(특수부대식)', '점프스쿼트', 30);
const many = [
  { date: '2026-09-20', key: KEY, exercise: '버피', duration: 40, seconds: 40 },
  { date: '2026-09-25', key: KEY, exercise: '버피', duration: 40, seconds: 33 },
  { date: '2026-09-28', key: K2, exercise: '점프스쿼트', duration: 30, seconds: 22 },
  { date: '2026-09-30', key: KEY, exercise: '버피', duration: 40, seconds: 25 },
];
const groups = R.recoverGroups(many);
ok('동작별로 묶는다', groups.length, 2);
ok('  최근에 잰 것이 위다', groups[0].exercise, '버피');
ok('  몇 번 쟀나', groups[0].count, 3);
ok('  마지막 것', groups[0].last.seconds, 25);
// **그 앞의 것**과 견준다 (처음이 아니다 — 40초가 아니라 33초와 견줘야 한다)
ok('  견주는 것은 그 앞의 것', groups[0].prev.seconds, 33);
ok('  빨라진 만큼', groups[0].delta, -8);
// 한 번만 잰 것은 견줄 것이 없다. **0 으로 두지 않는다**
ok('한 번만 쟀으면 견줄 것이 없다', groups[1].delta, null);
ok('  그 줄도 그렇게 적는다', /아직 한 번만 쟀어요/.test(R.groupLine(groups[1])), true);
ok('빨라진 것을 적는다', /8초 빨라요/.test(R.groupLine(groups[0])), true);
ok('  3초 안쪽은 거의 같다고 적는다', /거의 같아요/.test(R.groupLine({
  last: { seconds: 31 }, prev: { seconds: 33 }, delta: -2,
})), true);
ok('못 잰 칸은 묶음에 안 든다',
  R.recoverGroups([...many, { date: '2026-09-30', key: KEY, seconds: null }]).length, 2);
ok('  그 칸이 마지막이 되지도 않는다',
  R.recoverGroups([...many, { date: '2026-09-30', key: KEY, seconds: null }])[0].last.seconds, 25);
ok('쌓인 것이 없으면 빈 목록', R.recoverGroups([]), []);
// 여기도 점수를 안 매긴다
const gWords = [R.groupLine(groups[0]), R.groupLine(groups[1])].join(' ');
ok('점수 · 등급 · 최고 기록을 안 쓴다', /점|등급|최고|평균|정상/.test(gWords), false);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('모두 통과');
