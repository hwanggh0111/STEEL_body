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

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
