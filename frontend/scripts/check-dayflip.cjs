// **날이 바뀌면 화면이 따라가는가** — 날짜를 「오늘 → 내일」로 세팅해 돌려 본다 (2026-11-17)
//
//   npm run dayflip     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 주인이 홈의 「이번 주 운동」을 집어 「**날짜 변경하는 게 잘 안 되던데**」라고 했다.
// 까닭이 둘 있었다 —
//
//   1. **`WeeklyReport` 는 날이 바뀌어도 어제를 말했다.** `buildWeekly(workouts)` 가
//      둘째 인자 없이 불려 **그 순간의 기기 시계**를 읽고, memo 는 `[workouts]` 만
//      봤다 — 즉 **기록이 바뀔 때만** 다시 셌다. 폰에 띄워둔 채 자정을 넘기면 위의
//      띠는 새 주로 넘어가는데(`useToday`) 바로 아래 「이번 주 요약」은 **지난 주**를
//      적고 있었다. 같은 화면 위아래가 다른 주를 말한다.
//   2. **홈의 띠는 주 경계를 또 다른 시계에서 받았다.** `mondayOf()` 가 인자 없이
//      불려 기기 시계를 읽는데, 그 띠의 「오늘」 테와 수(`isToday`·`weekDone`)는
//      `useToday` 의 `today` 를 본다 — 두 시계가 어긋나는 순간에 **칸은 이번 주인데
//      테는 어제**가 된다.
//
// 그리고 `useToday` 는 **1분 자**로만 자정을 넘겼다 — 23:59:40 에 자가 돌면 다음은
// 00:00:40 이다. 그 1분을 사람은 「안 바뀐다」로 읽는다.
//
// ── 무엇을 보는가 ──
//
//   ⑴ **불러서 견준다** — 같은 기록에 `today` 만 「오늘 → 내일」로 세팅해 먹이고,
//      띠 · 요약 · 목표가 **같은 주**를 말하는지, 주 경계에서 **같이 넘어가는지**
//      본다. 날짜를 글자로 받는 손들이므로 기기 시계를 건드리지 않고 돌 수 있다.
//   ⑵ **자리를 본다** — 화면이 그 손에 `today` 를 **실제로 넘기는지**. 넘기지 않으면
//      ⑴ 이 전부 통과해도 화면은 어제를 말한다 (그것이 이 건의 모양이었다).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const TMP = [];
function bundle(rel, out) {
  execFileSync(process.execPath, [
    path.join(ROOT, 'node_modules', 'esbuild', 'bin', 'esbuild'),
    path.join(ROOT, rel), '--bundle', '--format=cjs', '--platform=node',
    '--outfile=' + path.join(ROOT, out),
  ], { stdio: 'pipe' });
  TMP.push(out);
  return require(path.join(ROOT, out));
}
const clean = () => { for (const f of TMP) { try { fs.unlinkSync(path.join(ROOT, f)); } catch { /* 남아도 해롭지 않다 */ } } };

// ── 세팅: 일요일과 그 다음 날(월요일) ──
//
// **주 경계를 고른다.** 화요일 → 수요일로 넘기면 주가 그대로라 「따라갔는지」가
// 안 보인다 — 1월 1일처럼 **눈에 보이는 자리**로 세팅해야 자가 일을 한다.
const 일 = '2026-11-22';
const 월 = '2026-11-23';
// 그 주에 이틀(목·금), 다음 주에 하루(월) 적어둔 사람
const workouts = {
  '2026-11-19': [{ id: 1, exercise: '벤치프레스', weight: '60', sets: 3, reps: 8, date: '2026-11-19' }],
  '2026-11-20': [{ id: 2, exercise: '스쿼트', weight: '80', sets: 3, reps: 5, date: '2026-11-20' }],
  [월]: [{ id: 3, exercise: '데드리프트', weight: '100', sets: 1, reps: 5, date: 월 }],
};

let dateKey; let weekly; let goal;
try {
  dateKey = bundle('src/data/dateKey.js', '.df-datekey.cjs');
  weekly = bundle('src/data/weeklyReport.js', '.df-weekly.cjs');
  goal = bundle('src/data/goal.js', '.df-goal.cjs');
} catch (e) {
  console.log('FAIL 손을 묶지 못했다 → ' + String(e.message || e).slice(0, 200));
  clean();
  process.exit(1);
}

console.log('── 1. 날짜 키를 Date 로 되돌리는 손 (`atDay`) ──');
{
  ok('`atDay` 가 있다', typeof dateKey.atDay === 'function', true);
  const d = dateKey.atDay(일);
  ok('  받은 날을 그대로 돌려준다', d ? dateKey.dateKey(d) : null, 일);
  // **한낮**이다 — 자정으로 두면 서머타임이 자정에 시작하는 곳에서 하루가 밀린다
  ok('  한낮으로 만든다 (서머타임)', d ? d.getHours() : null, 12);
  // 없는 날짜를 그럴듯한 날로 바꾸지 않는다 (`longDayOf` 와 같은 선)
  ok('  넘치는 날짜는 null', dateKey.atDay('2026-02-30'), null);
  ok('  꼴이 아니면 null', [dateKey.atDay(''), dateKey.atDay('2026-11'), dateKey.atDay(null)], [null, null, null]);
}

console.log('');
console.log('── 2. 「오늘 → 내일」로 세팅하면 주가 같이 넘어가는가 ──');
{
  const 띠 = (today) => weekly.weekKeys(weekly.mondayOf(dateKey.atDay(today)));
  ok('일요일의 띠', [띠(일)[0], 띠(일)[6]], ['2026-11-16', '2026-11-22']);
  ok('  내일(월요일)로 세팅하면 띠가 넘어간다', [띠(월)[0], 띠(월)[6]], ['2026-11-23', '2026-11-29']);

  const 요약 = (today) => weekly.buildWeekly(workouts, dateKey.atDay(today));
  ok('일요일의 요약이 그 주를 말한다', [요약(일).from, 요약(일).to], ['2026-11-16', '2026-11-22']);
  ok('  내일로 세팅하면 요약도 넘어간다', [요약(월).from, 요약(월).to], ['2026-11-23', '2026-11-29']);

  // ★ **띠와 요약이 같은 주를 말한다** — 이 건의 모양이 바로 이것이 어긋난 것이었다
  ok('★ 띠와 요약이 같은 주다 (일요일)', [띠(일)[0], 띠(일)[6]], [요약(일).from, 요약(일).to]);
  ok('★ 띠와 요약이 같은 주다 (내일)', [띠(월)[0], 띠(월)[6]], [요약(월).from, 요약(월).to]);

  // 수도 따라간다 — 일요일엔 그 주 이틀, 월요일엔 새 주 하루
  ok('일요일에 센 날', 요약(일).daysDone, 2);
  ok('  내일로 세팅하면 새 주의 하루', 요약(월).daysDone, 1);
  ok('  지난주로 밀려난 이틀도 안다', 요약(월).prevDays, 2);

  // 목표 고리도 같은 주를 본다 (홈의 띠 위에 걸리는 줄)
  ok('목표가 본 이번 주 (일요일)', goal.weekProgress(workouts, { weeklyTarget: 3 }, 일).done, 2);
  ok('  내일로 세팅하면 목표도 새 주', goal.weekProgress(workouts, { weeklyTarget: 3 }, 월).done, 1);
}

console.log('');
console.log('── 3. 화면이 그 손에 `today` 를 **실제로 넘기는가** ──');
//
// ⑴ 이 다 통과해도 화면이 `today` 를 안 넘기면 아무 소용이 없다 — 이 건이 그랬다.
{
  // **주석 안의 것은 안 센다** — 이 집은 까닭을 길게 적고, 그 주석에 바로 옛 꼴
  // (`mondayOf()` · `buildWeekly(workouts)`)을 적어둔다. 줄 단위로 걷는다
  // (`check-isoday.cjs` 가 같은 까닭으로 그렇게 한다)
  const 코드만 = (p) => fs.readFileSync(p, 'utf8').split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const home = 코드만(path.join(ROOT, 'src', 'pages', 'HomePage.jsx'));
  const 띠줄 = (home.split('\n').find((l) => l.includes('const weekDates')) || '');
  ok('홈의 주간 띠가 `today` 에서 주를 만든다', /atDay\(today\)/.test(띠줄), true);
  // 인자 없는 `mondayOf()` 는 **또 다른 시계**다 — 화면에서는 쓰지 않는다
  ok('  화면이 시계를 따로 읽지 않는다 (`mondayOf()`)', /mondayOf\(\s*\)/.test(home), false);
  ok('  주간 요약에 `today` 를 넘긴다', /<WeeklyReport[^>]*today=\{today\}/.test(home), true);

  const rep = 코드만(path.join(ROOT, 'src', 'components', 'WeeklyReport.jsx'));
  ok('주간 요약이 `today` 를 받는다', /function WeeklyReport\(\{[^}]*today[^}]*\}\)/.test(rep), true);
  // memo 가 `today` 를 안 보면 **기록이 바뀔 때만** 다시 센다 (이 건의 뿌리)
  ok('  memo 가 `today` 를 본다', /useMemo\([\s\S]*?buildWeekly[\s\S]*?\[workouts, today\]\)/.test(rep), true);
  // 둘째 인자를 비워두면 **그 순간의 기기 시계**를 읽는다 (이 건의 뿌리)
  ok('  둘째 인자를 비워두지 않는다', /buildWeekly\(workouts\s*\)/.test(rep), false);
}

console.log('');
console.log('── 4. 자정을 **1분 뒤**가 아니라 그 자리에서 넘기는가 (`useToday`) ──');
{
  const src = fs.readFileSync(path.join(ROOT, 'src', 'data', 'useToday.js'), 'utf8');
  // 다음 자정에 한 번 깨우는 자 — 남은 시간을 **계산해서** 건다
  ok('다음 자정에 거는 자가 있다', /setTimeout\(/.test(src) && /getDate\(\) \+ 1/.test(src), true);
  // 돌아오는 길은 하나가 아니다 — 안드로이드 웹뷰 · 홈 화면 앱
  //
  // **`addEventListener` 를 본다** — 이름만 세면 거짓으로 통과한다. 거두는 줄
  // (`removeEventListener`)에도 같은 이름이 있어서, 거는 줄을 지워도 글자는 남는다
  // (되돌려 보다가 잡았다 — 그래서 **거는 줄과 거두는 줄을 따로** 본다)
  ok('  돌아온 것을 보는 손이 셋이다',
    ['visibilitychange', 'pageshow', 'focus'].filter((e) => !src.includes(`addEventListener('${e}', check)`)), []);
  ok('  셋을 떠날 때 다 거둔다',
    ['visibilitychange', 'pageshow', 'focus'].filter((e) => !src.includes(`removeEventListener('${e}', check)`)), []);
  // 1분 자도 **그대로 둔다** — 기기 시계를 손으로 바꾸거나 시간대가 달라지면
  // 자정 자는 못 잡는다 (그 자는 「우리가 아는 오늘」의 끝에 걸려 있다)
  ok('  1분 자가 그대로 있다', /setInterval\(check, 60 \* 1000\)/.test(src), true);
  // 걸어둔 것은 거둔다 — 화면을 떠난 뒤에도 깨면 없는 화면을 다시 그린다
  ok('  떠날 때 거둔다', /clearTimeout\(/.test(src) && /clearInterval\(/.test(src), true);
}

clean();
console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
