// 목표가 기대는 계산 (2026-09-17).
//
//   npm run goal     (npm run check 에도 들어 있다)
//
//   data/goal.js   이번 주 진행 · 이어온 주 · 체중 진행 · 언제 닿나
//
// **화면으로는 확인할 수 없는 계산이다.** 연속 주를 눈으로 보려면 몇 달치 기록을
// 실제로 적어야 하고, 「이대로면 11월 초」는 28일치 체중이 있어야 한 번 뜬다.
// 그래서 여기서 값으로 본다.
//
// 세 화면(홈 한 줄 · 홈 목표 카드 · 목표 화면)이 **같은 함수**를 본다.
// 여기가 통과하면 셋이 같은 수를 말한다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const g = bundle('src/data/goal.js', '.g1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const one = [{ exercise: '벤치프레스', weight: '80', sets: 5, reps: 8 }];

// 2026-09-14 는 월요일, 09-18 은 금요일, 09-20 은 일요일이다.
//
//   이번 주 (9/14~9/20)  월 · 수 · 금 → 3일
//   지난주   (9/7~9/13)   월 · 수 · 금 · 일 → 4일
//   그 전주  (8/31~9/6)   월 · 수 · 금 · 일 → 4일
//   그 앞주  (8/24~8/30)  월만 → 1일
const W = {
  '2026-09-14': one, '2026-09-16': one, '2026-09-18': one,
  '2026-09-07': one, '2026-09-09': one, '2026-09-11': one, '2026-09-13': one,
  '2026-08-31': one, '2026-09-02': one, '2026-09-04': one, '2026-09-06': one,
  '2026-08-24': one,
};
const TODAY = '2026-09-18';

// ───────────────────────────────────────────
console.log('── 이번 주 진행 ──');
const p4 = g.weekProgress(W, { weeklyTarget: 4 }, TODAY);
ok('이번 주에 한 날을 센다', p4.done, 3);
ok('  몇 번 남았나', p4.left, 1);
ok('  아직 채우지 않았다', p4.met, false);
ok('  고리는 3/4', p4.ratio, 0.75);
// 오늘을 **넣어서** 센다 — 오늘 아직 안 했어도 오늘 하면 된다 (금 · 토 · 일 = 3일)
ok('  남은 날에 오늘이 들어간다', p4.remainDays, 3);

const p3 = g.weekProgress(W, { weeklyTarget: 3 }, TODAY);
ok('목표와 같으면 채운 것이다', [p3.met, p3.over], [true, 0]);
const p2 = g.weekProgress(W, { weeklyTarget: 2 }, TODAY);
ok('넘긴 것은 넘겼다고 센다', p2.over, 1);
// 고리가 두 바퀴 돌면 몇 바퀴인지 못 읽는다
ok('  그래도 고리는 한 바퀴에서 멈춘다', p2.ratio, 1);

ok('주 횟수 목표가 없으면 안 그린다', g.weekProgress(W, { weightTarget: 75 }, TODAY), null);
ok('목표 자체가 없어도 안 터진다', g.weekProgress(W, null, TODAY), null);
ok('기록이 하나도 없어도 안 터진다', g.weekProgress({}, { weeklyTarget: 4 }, TODAY).done, 0);

console.log('');
console.log('── 이번 주를 한 줄로 ──');
ok('한 번 남으면 그렇게 말한다', g.weekLine(p4), '한 번만 더 하면 이번 주를 채웁니다');
ok('채웠으면 채웠다고', g.weekLine(p3), '이번 주 목표를 채웠습니다');
ok('넘겼으면 넘겼다고', g.weekLine(p2), '이번 주 목표를 1번 넘겼습니다');
// **못 채울 것 같다고 미리 말하지 않는다.** 금요일에 「이번 주는 틀렸습니다」를
// 읽으면 토요일에 안 나간다
ok('남은 날보다 많이 남아도 나무라지 않는다',
  g.weekLine(g.weekProgress(W, { weeklyTarget: 7 }, TODAY)), '이번 주 3번 했습니다');
ok('한 번도 안 했으면 「아직」', g.weekLine(g.weekProgress({}, { weeklyTarget: 4 }, TODAY)), '이번 주는 아직입니다');

console.log('');
console.log('── 이어온 주 ──');
const s4 = g.weekStreak(W, { weeklyTarget: 4 }, TODAY);
// 이번 주는 3/4 이라 아직 못 채웠다. 그래도 **끊지 않는다** — 수요일마다
// 「연속 0주」가 뜨면 그때까지 이어온 열 주가 매주 사라지는 셈이다
ok('이번 주가 아직 모자란 것으로는 안 끊는다', s4.current, 2);
// 진행 중인 주는 최고 기록에 안 넣는다 (일요일에 못 채우면 없던 기록이 남는다)
ok('  가장 길었던 것에도 안 넣는다', s4.best, 2);

const s3 = g.weekStreak(W, { weeklyTarget: 3 }, TODAY);
ok('이번 주를 채웠으면 같이 센다', s3.current, 3);
ok('  최고 기록에도 들어간다', s3.best, 3);
// 8/24 주는 1일이라 목표 미달 — 거기서 끊긴다
ok('못 채운 주에서 끊긴다', g.weekStreak(W, { weeklyTarget: 1 }, TODAY).current, 4);
ok('기록이 없으면 0', g.weekStreak({}, { weeklyTarget: 3 }, TODAY), { current: 0, best: 0, weeks: 0 });

const hist = g.weekHistory(W, { weeklyTarget: 4 }, TODAY, 5);
ok('최근 다섯 주를 준다', hist.length, 5);
ok('  맨 끝이 이번 주다', [hist[4].current, hist[4].done], [true, 3]);
ok('  맨 앞이 가장 오래된 주다', hist[0].monday, '2026-08-17');
ok('  채운 주를 표시한다', hist.map(w => w.met), [false, false, true, true, false]);

console.log('');
console.log('── 체중 목표 ──');
const R = (rows) => rows.map(([date, weight]) => ({ date, weight }));
// 80 에서 시작해 75 를 목표로, 지금 78 — 5kg 중 2kg 왔다
const b1 = g.weightProgress(R([['2026-09-18', 78]]), { weightTarget: 75, weightStart: 80 });
ok('지금 값은 마지막 기록이다', b1.now, 78);
ok('  줄이는 목표인 것을 안다', b1.dir, 'down');
ok('  남은 거리', b1.left, 3);
ok('  진행률은 시작에서 얼마나 왔나', b1.ratio, 0.4);

const b2 = g.weightProgress(R([['2026-09-18', 74]]), { weightTarget: 75, weightStart: 80 });
ok('지나쳤으면 닿은 것이다', [b2.reached, b2.ratio], [true, 1]);
// 「-1kg 남음」은 읽을 수가 없다
ok('  남은 거리를 음수로 안 적는다', b2.left, 0);

const b3 = g.weightProgress(R([['2026-09-18', 82]]), { weightTarget: 75, weightStart: 80 });
ok('멀어졌으면 진행률은 0', b3.ratio, 0);
ok('  멀어진 것을 안다', b3.away, true);

const b4 = g.weightProgress(R([['2026-09-18', 70]]), { weightTarget: 75, weightStart: 68 });
ok('늘리는 목표도 된다', [b4.dir, b4.ratio], ['up', 0.2857142857142857]);

ok('체중 기록이 없으면 지어내지 않는다',
  [g.weightProgress([], { weightTarget: 75 }).now, g.weightProgress([], { weightTarget: 75 }).ratio], [null, 0]);
ok('체중 목표가 없으면 안 그린다', g.weightProgress(R([['2026-09-18', 78]]), { weeklyTarget: 4 }), null);
// 시작점을 안 박아둔 옛 목표 — 진행률이 0에서 시작하지만 **틀린 수를 보여주지는 않는다**
ok('시작 체중이 없으면 지금을 시작으로 친다',
  g.weightProgress(R([['2026-09-18', 78]]), { weightTarget: 75 }).start, 78);

console.log('');
console.log('── 이대로면 언제 닿나 ──');
// 8/25 에 82, 9/18 에 78 — 24일에 4kg 내려왔다. 75 까지 3kg 남았으니 18일 뒤
const ETA = R([['2026-08-25', 82], ['2026-09-05', 80], ['2026-09-18', 78]]);
const e1 = g.weightEta(ETA, { weightTarget: 75, weightStart: 82 }, TODAY);
ok('며칠 남았나', e1.days, 18);
ok('  날짜를 콕 집지 않는다', e1.label, '10월 초');
ok('  요즘 흐름도 같이 말한다', e1.perWeek, -1.2);

// **모르면 말하지 않는다.** 지어낸 수를 한 번 보여주면 그 뒤의 모든 수를 못 믿게 된다
ok('기록이 하나뿐이면 말하지 않는다',
  g.weightEta(R([['2026-09-18', 78]]), { weightTarget: 75, weightStart: 82 }, TODAY), null);
ok('흐름이 목표와 반대면 말하지 않는다',
  g.weightEta(R([['2026-08-25', 76], ['2026-09-18', 78]]), { weightTarget: 75, weightStart: 82 }, TODAY), null);
// 「2028년 3월에 닿습니다」는 격려가 아니다
ok('너무 멀면 말하지 않는다',
  g.weightEta(R([['2026-08-25', 78.1], ['2026-09-18', 78]]), { weightTarget: 60, weightStart: 82 }, TODAY), null);
ok('이미 닿았으면 말할 것이 없다',
  g.weightEta(R([['2026-08-25', 80], ['2026-09-18', 74]]), { weightTarget: 75, weightStart: 82 }, TODAY), null);
// 28일 밖의 기록은 요즘 흐름이 아니다
ok('옛 기록만 있으면 말하지 않는다',
  g.weightEta(R([['2026-05-01', 90], ['2026-05-20', 85]]), { weightTarget: 75, weightStart: 82 }, TODAY), null);

console.log('');
console.log('── 홈에 거는 한 줄 ──');
// 홈은 한 가지만 말한다 — 둘 다 쫓고 있어도 한 줄에는 하나만 나온다
ok('주 횟수가 먼저다',
  g.goalLine(W, R([['2026-09-18', 78]]), { weeklyTarget: 4, weightTarget: 75, weightStart: 80 }, TODAY),
  '한 번만 더 하면 이번 주를 채웁니다');
ok('주 횟수 목표가 없으면 체중을 말한다',
  g.goalLine(W, R([['2026-09-18', 78]]), { weightTarget: 75, weightStart: 80 }, TODAY),
  '목표까지 3kg 남았습니다');
ok('목표가 없으면 빈 줄', g.goalLine(W, [], null, TODAY), '');

console.log('');
console.log('── 목표가 있는가 ──');
ok('둘 다 비면 없는 것이다', g.hasGoal({ weeklyTarget: null, weightTarget: null }), false);
ok('하나만 있어도 있는 것이다', g.hasGoal({ weeklyTarget: 4, weightTarget: null }), true);
ok('null 도 안 터진다', g.hasGoal(null), false);

console.log('');
console.log('── 쫓기 시작한 날을 덮어쓰지 않는가 ── (2026-09-18)');
//
// 화면이 고칠 때도 `startedAt: today` 를 같이 보내고 있었다. 서버는 「이미 있으면
// 안 건드린다」인데 그건 **화면이 안 보낼 때**의 이야기다 — 보내면 덮인다.
// 아직 어느 화면도 이 값을 안 적으니 **눈에 안 보이는 채로 계속 틀려간다.**
//
// 값으로는 확인할 수 없는 자리(서버에 보내는 몸통이다)라 코드를 본다
const page = fs.readFileSync('src/pages/GoalPage.jsx', 'utf-8')
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');
ok('고칠 때는 안 보낸다', /startedAt: today \}/.test(page), false);
ok('  처음 세울 때만 보낸다', /if \(!goal\?\.startedAt\) payload\.startedAt = today;/.test(page), true);

console.log('');
console.log('── 약속하기 전의 주는 평가하지 않는다 ── (2026-09-19)');
//
// 9/19 에 화면을 보다가 찾았다. **목표를 오늘 세웠는데 「0주 연속」**이 떠 있었고,
// 막대 두 칸은 채워진 것처럼 보였다. 값은 「맞았지만」 규칙이 틀렸다 —
// `weekStreak` 이 **첫 운동 기록**의 주부터 셌다. 그래서 목표를 세우는 순간 지난 주들이
// 주 N회 기준으로 심사된다. 3년치 기록이 있는 사람은 3년이 통째로 심사된다.
// 약속하기 전의 주는 지킨 것도 어긴 것도 아니다.
//
// 위의 `W` 는 이번 주를 이미 채운 자료라 차이가 안 드러난다. **이번 주가 모자란**
// 자료로 본다 — 그래야 「과거를 끌어오는가」가 값으로 갈린다.
//
//   그 전주 (8/31~9/6)  3일 → 채움
//   지난주  (9/7~9/13)  3일 → 채움
//   이번 주 (9/14~)     2일 → 아직
const W2 = {
  '2026-08-31': one, '2026-09-02': one, '2026-09-04': one,
  '2026-09-07': one, '2026-09-09': one, '2026-09-11': one,
  '2026-09-14': one, '2026-09-16': one,
};
const G3 = { weeklyTarget: 3 };
const fri = '2026-09-18';

// 오래전부터 쫓고 있었으면 — 이번 주는 아직이라 건너뛰고 지난 두 주를 센다
ok('오래전부터 쫓고 있었으면 두 주가 이어져 있다',
  g.weekStreak(W2, { ...G3, startedAt: '2026-08-01' }, fri).current, 2);
// **오늘 세웠으면 그 두 주는 남의 주다.** 예전 규칙이면 여기서도 2 가 나왔다
ok('  이번 주에 세웠으면 과거를 끌어오지 않는다',
  g.weekStreak(W2, { ...G3, startedAt: '2026-09-14' }, fri).current, 0);
ok('  「가장 길게」도 끌어오지 않는다',
  g.weekStreak(W2, { ...G3, startedAt: '2026-09-14' }, fri).best, 0);
ok('  세운 뒤로 몇 주째인지도 한 주다',
  g.weekStreak(W2, { ...G3, startedAt: '2026-09-14' }, fri).weeks, 1);
// 지난주에 세웠으면 그 주는 센다 (채웠으므로 이어진다)
ok('지난주에 세웠으면 그 한 주는 이어진다',
  g.weekStreak(W2, { ...G3, startedAt: '2026-09-07' }, fri).current, 1);
// **옛 목표(시작일이 없는 것)는 예전 그대로다.** 값이 없다고 화면이 비면 안 된다
ok('시작일이 없으면 예전처럼 첫 기록부터 센다', g.weekStreak(W2, G3, fri).current, 2);
// 목표가 먼저고 기록이 나중이면 — 둘 중 **늦은 쪽**(첫 기록)부터다
ok('  목표가 기록보다 앞서면 기록부터 센다',
  g.weekStreak(W2, { ...G3, startedAt: '2020-01-01' }, fri).current, 2);
// 손으로 앞날을 보내도 안 터진다 (span 이 0 이하가 되면 안 된다)
ok('  시작일이 앞날이어도 안 터진다',
  typeof g.weekStreak(W2, { ...G3, startedAt: '2099-01-01' }, fri).current, 'number');

console.log('');
console.log('── 막대가 세 가지를 갈라서 말하는가 ──');
const histNew = g.weekHistory(W2, { ...G3, startedAt: '2026-09-07' }, fri, 5);
ok('다섯 주를 준다', histNew.length, 5);
ok('  목표 전 주는 before 로 표시한다', histNew.map((w) => w.before), [true, true, true, false, false]);
// 목표 전 주는 「못 채운 주」가 아니다 — 높이(ratio)도 0 이라 낮은 선으로 그려진다
ok('  목표 전 주는 채웠다고도 못 채웠다고도 안 한다',
  histNew.filter((w) => w.before).map((w) => [w.met, w.ratio]), [[false, 0], [false, 0], [false, 0]]);
ok('  목표 뒤의 주는 그대로 센다', histNew.filter((w) => !w.before).map((w) => [w.done, w.met]), [[3, true], [2, false]]);
ok('  맨 오른쪽이 이번 주다', histNew[histNew.length - 1].current, true);
// 시작일이 없으면 before 가 하나도 없다 (옛 목표)
ok('시작일이 없으면 목표 전 주도 없다', g.weekHistory(W2, G3, fri, 5).some((w) => w.before), false);

console.log('');
console.log('── 화면이 셋을 다른 모양으로 그리는가 ──');
// 색만 다르면 어두운 바탕에서 안 갈린다 — 9/19 에 그것 때문에 「0주 연속인데 채워진
// 막대」를 봤다. 그래서 **모양**으로 가른다
const bars = fs.readFileSync('src/pages/GoalPage.jsx', 'utf-8');
ok('못 채운 주는 속을 비우고 테두리만', /border: '1px solid var\(--accent-low\)'/.test(bars), true);
ok('  채운 주는 꽉 찬 금이다', /background: 'var\(--accent\)', boxShadow/.test(bars), true);
ok('  목표 전 주는 낮은 선이다', /height: 4, background: 'var\(--bg-tertiary\)'/.test(bars), true);
ok('이번 주는 밑줄로 말한다 (탭바와 같은 언어)', /w\.current \? 'var\(--accent\)' : 'transparent'/.test(bars), true);
// 폰에는 마우스를 올릴 방법이 없다. 숫자를 눈에 보이게 적는다
ok('  몇 일 했는지 막대 아래에 적는다', /\{w\.before \? '·' : w\.done\}/.test(bars), true);

console.log('');
console.log('── 몸의 수 셋이 같은 셈을 쓰는가 ── (2026-10-06)');
//
// 체중 하나였던 것이 체중 · 체지방률 · 골격근량 셋이 됐다. 셋이 **같은 함수**를
// 쓰는지, 그리고 그 함수가 칸 이름만 바꿔 같은 답을 주는지 값으로 본다 —
// 셋을 따로 적으면 「지나쳤을 때 남은 거리를 0 으로 둔다」 같은 판단이 갈린다.
const REC = [
  // 인바디 목록은 **최신이 앞**이다 (앱의 다른 화면들과 같은 가정)
  { date: '2026-10-05', weight: 72, fat_pct: 18, muscle_kg: 34 },
  { date: '2026-09-01', weight: 78, fat_pct: 24, muscle_kg: 31 },
];
const GM = {
  weightTarget: 70, weightStart: 78,
  fatTarget: 15, fatStart: 24,
  muscleTarget: 36, muscleStart: 31,
};

const mp = (field, target, start) => g.measureProgress(REC, { field, target, start });

ok('체중 — 78 → 72, 목표 70', [mp('weight', 70, 78).left, Math.round(mp('weight', 70, 78).ratio * 100)], [2, 75]);
ok('  체지방률 — 24 → 18, 목표 15', [mp('fat_pct', 15, 24).left, Math.round(mp('fat_pct', 15, 24).ratio * 100)], [3, 67]);
ok('  골격근량 — 31 → 34, 목표 36 (늘리는 쪽)', [mp('muscle_kg', 36, 31).left, Math.round(mp('muscle_kg', 36, 31).ratio * 100)], [2, 60]);

// 방향을 정해두지 않는다 — 체지방률을 올리는 사람도 있다
ok('올리는 목표도 같은 셈이다', mp('fat_pct', 30, 24).dir, 'up');
ok('  내리는 목표', mp('fat_pct', 15, 24).dir, 'down');

// 지나쳤으면 남은 거리는 0 이다. **음수를 「-0.4% 남음」으로 적으면 읽을 수가 없다**
ok('지나치면 남은 거리는 0', [mp('fat_pct', 20, 24).left, mp('fat_pct', 20, 24).reached], [0, true]);
ok('  진행률도 1 을 안 넘는다', mp('fat_pct', 20, 24).ratio, 1);

// 쫓지 않는 값은 null 이다 — 화면이 그 줄을 안 그린다
ok('목표가 없으면 null', mp('fat_pct', null, null), null);
// 인바디에 그 칸이 비어 있는 사람. **목표는 있는데 값이 없다**고 말해야 한다
ok('값이 없으면 now 가 null', mp('fat_pct', 15, 24) && mp('water_l', 15, null).now, null);

// 껍데기 셋이 같은 함수를 쓰는가
ok('weightProgress 가 같은 답을 준다', g.weightProgress(REC, GM).left, mp('weight', 70, 78).left);
ok('  fatProgress', g.fatProgress(REC, GM).left, mp('fat_pct', 15, 24).left);
ok('  muscleProgress', g.muscleProgress(REC, GM).left, mp('muscle_kg', 36, 31).left);

console.log('');
console.log('── 목표가 넷 중 하나만 있어도 목표인가 ──');
// 여기를 안 늘리면 체지방률만 정한 사람에게 앱이 「목표가 없다」고 한다 —
// 저장은 됐는데 홈 카드도 안 뜨고 목표 화면이 세우기 폼으로 돌아간다
ok('주 횟수만', g.hasGoal({ weeklyTarget: 4 }), true);
ok('  체중만', g.hasGoal({ weightTarget: 70 }), true);
ok('  체지방률만', g.hasGoal({ fatTarget: 15 }), true);
ok('  골격근량만', g.hasGoal({ muscleTarget: 36 }), true);
ok('다 비면 목표가 아니다', g.hasGoal({}), false);

console.log('');
console.log('── 화면이 셋을 한 자리에 적는가 ──');
// 폼의 칸 · 저장할 때 박는 시작값 · 그려주는 줄이 전부 MEASURES 를 돈다.
// 세 자리에 따로 적으면 넷째 값을 더하는 날 한 곳이 빠진다
// 위에서 `bars` 로 이미 읽은 파일이다. 이름을 또 만들지 않는다
ok('MEASURES 한 자리에 셋이 있다', (bars.match(/targetKey: '/g) || []).length, 3);
ok('  폼이 그것을 돈다', /MEASURES\.map\(\(m\) =>/.test(bars), true);
ok('  시작값도 그것을 돈다', /for \(const m of MEASURES\)/.test(bars), true);
ok('  다 비었는지도 그것으로 본다', /MEASURES\.every\(\(m\) => patch\[m\.targetKey\] == null\)/.test(bars), true);
// 「이대로면 언제」는 체중만 말한다 — 체지방률은 물 마신 것에도 흔들린다
ok('언제 닿을지는 체중만 말한다', /m\.key === 'weight' && eta/.test(bars), true);

// 홈 카드도 셋을 안다. 안 고치면 체지방률만 쫓는 사람은 홈에서 아무것도 못 본다
const card = fs.readFileSync('src/components/home/GoalCard.jsx', 'utf-8');
ok('홈 카드가 체중 말고도 그린다', /fatTarget/.test(card) && /muscleTarget/.test(card), true);
ok('  글자가 체중으로 박혀 있지 않다', /\{body\.label\}/.test(card), true);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
