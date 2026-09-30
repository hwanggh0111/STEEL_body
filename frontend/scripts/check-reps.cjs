// 횟수 세기 — 관절이 오갈 때마다 하나 (2026-09-30).
//
//   npm run reps      (npm run check 에도 들어 있다)
//
// **화면으로는 확인할 수가 없는 자리다.** 한 번 보려면 카메라를 켜고 실제로 스쿼트를
// 해야 하고, 「떨림을 안 센다」를 보려면 문턱 근처에서 가만히 떨고 있어야 한다.
// 그래서 각도를 손으로 먹여서 본다 — 세는 쪽은 카메라도 모델도 아예 안 만진다.
//
// 지키는지 보는 것: 접혔다 펴져야 하나다 · 처음을 「펴짐」으로 두지 않는다(켜자마자 1이
// 되면 안 된다) · 못 본 것(`null`)을 0도로 안 읽는다 · 떨림을 안 센다(폭 · 시간) ·
// 버티는 운동과 모르는 운동을 가른다 · **자세를 평하지 않는다.**
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const R = bundle('src/data/repCount.js', '.rp1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

/** 각도를 차례로 먹인다. steps 는 [[각도, 몇 ms 째], …] */
const run = (steps, joint = 'knee') => {
  let st = R.startReps(joint);
  steps.forEach(([a, t]) => { st = R.repTick(st, a, t); });
  return st;
};

/** 스쿼트 한 번 (펴짐 → 접힘 → 펴짐). `t0` 부터 1초에 걸쳐. */
const oneRep = (t0) => [[170, t0], [140, t0 + 200], [95, t0 + 400], [90, t0 + 600], [140, t0 + 800], [170, t0 + 1000]];

console.log('── 접혔다 펴지면 하나 ──');
ok('한 번은 하나다', run(oneRep(0)).count, 1);
ok('  세 번은 셋이다', run([...oneRep(0), ...oneRep(1200), ...oneRep(2400)]).count, 3);

// **처음을 「펴짐」으로 두지 않는다.** 이미 앉아 있던 사람이 일어서는 것으로 1이 되면,
// 카메라를 켜자마자 숫자가 올라간다
ok('이미 접힌 채로 시작하면 그 펴기는 안 센다',
  run([[90, 0], [95, 200], [170, 800]]).count, 0);
ok('  그 뒤 한 번은 센다',
  run([[90, 0], [170, 800], ...oneRep(1000)]).count, 1);

console.log('\n── 떨림을 안 센다 ──');
// 문턱을 스치락말락 하는 자리에서 관절이 떨리면 가만히 있어도 숫자가 올라간다.
// **막는 것은 둘이다** — 문턱 사이의 55도, 그리고 하나와 다음 하나 사이의 600ms.
// (「이만큼은 움직여야」라는 규칙은 안 둔다 — 문턱 둘이 이미 그것을 요구한다)
ok('문턱 하나만 스치는 것은 안 센다', run([
  [170, 0], [120, 200], [170, 400], [120, 600], [170, 800],
]).count, 0);
ok('  접힘 쪽에서만 떨어도 안 센다', run([
  [90, 0], [99, 200], [95, 400], [90, 600],
]).count, 0);
ok('  하나를 센 뒤 너무 빠른 것은 안 센다', run([
  ...oneRep(0),                         // 1000ms 에 하나
  [90, 1100], [170, 1200],              // 100ms 뒤 — 안 센다
]).count, 1);
ok('  600ms 를 넘기면 센다', run([...oneRep(0), ...oneRep(1000)]).count, 2);

console.log('\n── 못 본 프레임 ──');
// 못 본 것을 0도로 읽으면 **안 보이는 순간마다 한 번씩** 세어진다
const missed = run([[170, 0], [null, 200], [null, 400], [170, 600]]);
ok('못 본 것은 안 센다', missed.count, 0);
ok('  못 본 것을 세어둔다', missed.missed, 2);
ok('  본 것도 세어둔다', missed.seen, 2);
ok('숫자가 아닌 것도 못 본 것이다', run([[170, 0], [NaN, 200]]).missed, 1);
ok('못 보는 사이의 것은 지어내지 않는다',
  run([[170, 0], [90, 600], [null, 700], [null, 800], [170, 1200]]).count, 1);

console.log('\n── 어느 관절을 보나 ──');
ok('스쿼트는 무릎', R.jointFor('스쿼트'), 'knee');
ok('  점프스쿼트도 무릎', R.jointFor('점프스쿼트'), 'knee');
ok('  푸시업은 팔꿈치', R.jointFor('푸시업'), 'elbow');
ok('  벤치프레스는 팔꿈치', R.jointFor('벤치프레스'), 'elbow');
ok('  띄어쓰기가 있어도 찾는다', R.jointFor('바벨 백 스쿼트'), 'knee');
// 버티는 것과 모르는 것은 **할 말이 다르다**
ok('플랭크는 버티는 것', R.jointFor('플랭크'), 'hold');
ok('  월싯도 버티는 것', R.jointFor('월싯'), 'hold');
ok('모르는 이름은 null', R.jointFor('무슨무슨운동'), null);
ok('빈 이름도 null', R.jointFor(''), null);
ok('버티는 것에 할 말이 있다', /버티는 운동은 셀 것이 없어요/.test(R.cannotCount('플랭크')), true);
ok('  모르는 것에 할 말도 있다', /아직 셀 수 없어요/.test(R.cannotCount('무슨무슨운동')), true);
ok('  셀 수 있으면 아무 말도 안 한다', R.cannotCount('스쿼트'), null);

console.log('\n── 각도 ──');
// 곧게 편 다리: 엉덩이 · 무릎 · 발목이 한 줄 → 180도
ok('한 줄이면 180도', R.angleAt({ x: 0.5, y: 0.3 }, { x: 0.5, y: 0.6 }, { x: 0.5, y: 0.9 }), 180);
ok('직각이면 90도', R.angleAt({ x: 0.5, y: 0.3 }, { x: 0.5, y: 0.6 }, { x: 0.8, y: 0.6 }), 90);
ok('점이 없으면 null', R.angleAt(null, { x: 0, y: 0 }, { x: 1, y: 1 }), null);
// 세로로 긴 화면에서 y 가 눌리면 각도도 눌린다 — 화면 비로 되돌린다
ok('세로로 긴 화면도 같은 각', R.angleAt(
  { x: 0.5, y: 0.15 }, { x: 0.5, y: 0.30 }, { x: 0.8, y: 0.30 }, 0.5), 90);

console.log('\n── 한 프레임에서 관절 각도 ──');
/** 33점을 만들고 몇 자리만 놓는다. 안 적은 곳은 안 보이는 것으로 둔다 */
const marks = (over, vis = 1) => {
  const m = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  Object.entries(over).forEach(([k, v]) => { m[R.LM[k]] = { x: v[0], y: v[1], visibility: v[2] ?? vis }; });
  return m;
};
const straight = marks({
  hipL: [0.45, 0.4], kneeL: [0.45, 0.65], ankleL: [0.45, 0.9],
  hipR: [0.55, 0.4], kneeR: [0.55, 0.65], ankleR: [0.55, 0.9],
});
ok('양쪽이 보이면 평균', R.jointAngle(straight, 'knee'), 180);
// 한쪽만 보일 때(옆에서 찍으면 흔하다) 그쪽으로 센다
const oneSide = marks({
  hipL: [0.45, 0.4], kneeL: [0.45, 0.65], ankleL: [0.45, 0.9],
  hipR: [0.55, 0.4, 0.1], kneeR: [0.55, 0.65, 0.1], ankleR: [0.55, 0.9, 0.1],
});
ok('  한쪽만 보이면 그쪽으로', R.jointAngle(oneSide, 'knee'), 180);
// **안 보이는 관절은 안 쓴다** — 모델은 가려진 자리도 지어낸다
ok('안 보이면 null', R.jointAngle(marks({}), 'knee'), null);
ok('  0 이 아니다 (0도는 완전히 접힌 것이다)', R.jointAngle(marks({}), 'knee') === 0, false);

console.log('\n── 말투 ──');
ok('못 보고 있으면 그 말을 먼저 한다', /화면에 다 안 들어와요/.test(
  R.repsLine({ joint: 'knee', count: 0, seen: 3, missed: 20 })), true);
ok('  아직 못 찾았으면 그렇게', /아직 몸을 못 찾았어요/.test(
  R.repsLine({ joint: 'knee', count: 0, seen: 0, missed: 0 })), true);
ok('  세고 있으면 숫자만', R.repsLine({ joint: 'knee', count: 7, seen: 40, missed: 1 }), '7번 셌어요.');
// **자세를 평하지 않는다.** 한 대의 폰이 알 수 있는 것이 아니다
const words = [
  R.repsLine({ joint: 'knee', count: 0, seen: 3, missed: 20 }),
  R.repsLine({ joint: 'knee', count: 0, seen: 5, missed: 0 }),
  R.repsLine({ joint: 'knee', count: 7, seen: 40, missed: 1 }),
].join(' ');
// 「무릎이 접혔다 펴지면」은 **하는 법**이라 괜찮다. 막는 것은 **평하는 말**이다
ok('자세를 평하지 않는다', /자세가|깊이가|잘못|틀렸|나쁨|나빠|부족|점수|등급/.test(words), false);

console.log('\n── 뚜껑 ──');
const many = [];
for (let i = 0; i < 250; i += 1) many.push(...oneRep(i * 1200));
ok('끝없이 세지 않는다', run(many).count, R.MAX_REPS);

// ── 화면이 그 규칙을 쓰는가 ── (2026-09-30)
//
// 계산이 「못 센다」고 해도 **화면이 안 물어보면** 소용이 없다. 플랭크 옆에
// 「세어줄까요」가 있으면 사람은 눌러보고 0 을 보게 된다 — 그게 이 앱이 9/29 에
// 셋이나 고친 「있는 척만 하던 것」이다. 그래서 코드를 본다.
const codeOf = (x) => x
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');
const train = codeOf(fs.readFileSync('src/pages/TrainPage.jsx', 'utf-8'));
const cam = codeOf(fs.readFileSync('src/components/RepCounter.jsx', 'utf-8'));

console.log('── 화면이 규칙을 쓰는가 ──');
ok('못 세는 운동에는 단추를 안 낸다', /picked && !cannotCount\(picked\)/.test(train), true);
ok('  고른 운동이 없으면 아예 안 연다', /countOpen && picked/.test(train), true);
// **저장은 사람이 누른다** — 목소리로 적기와 같은 규칙이다(세는 것도 틀릴 수 있다)
ok('세고 나서 칸만 채운다 (바로 저장하지 않는다)',
  /onDone=\{\(n\) => \{[\s\S]{0,160}setReps\(String\(n\)\)/.test(train), true);
ok('  0 이면 칸을 안 건드린다', /if \(n > 0\)/.test(train), true);
// 카메라를 켠 것은 **반드시 끈다.** 안 끄면 탭의 촬영 표시가 남는다
ok('화면을 떠나면 카메라를 끈다', /useEffect\(\(\) => \(\) => shutdown\(\), \[\]\)/.test(cam), true);
ok('  트랙을 멈춘다 (표시가 사라지게)', /getTracks\?\.\(\)\.forEach\(\(t\) => t\.stop\(\)\)/.test(cam), true);
ok('  녹화하지 않는다', /MediaRecorder/.test(cam), false);
// 셀 수 없는 운동이면 **카메라를 아예 안 연다**
ok('셀 수 없으면 카메라를 안 연다', /cannot \?/.test(cam), true);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('모두 통과');
