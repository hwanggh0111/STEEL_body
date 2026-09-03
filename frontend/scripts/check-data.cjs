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
const path = require('path');

const NL = String.fromCharCode(10);

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

// 알림 소리 — **고를 수 있게 만든 것**(2026-09-02, 제보로 들어온 것이다).
// 소리 파일을 두지 않고 그 자리에서 만들기 때문에, 정말 다른 소리가 나는지는
// **울려봐야** 안다. 브라우저 대신 가짜 오디오를 세워 무엇을 예약하는지 읽는다.
console.log('\n── 알림 소리 (고르기 · 크기) ──');
const fakeAudio = () => {
  const made = [];
  const param = () => { const e = []; return {
    events: e,
    setValueAtTime: (v, t) => e.push(['set', v, t]),
    linearRampToValueAtTime: (v, t) => e.push(['lin', v, t]),
    exponentialRampToValueAtTime: (v, t) => e.push(['exp', v, t]),
  }; };
  class Ctx {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createOscillator() {
      const o = { type: 'sine', frequency: { value: 0 }, connect: (x) => x,
        start: (t) => { o.at = t; }, stop: () => {} };
      made.push(o);
      return o;
    }
    createGain() { const g = { gain: param(), connect: (x) => x }; made[made.length - 1].g = g; return g; }
  }
  global.window = { AudioContext: Ctx };
  return made;
};
let played = fakeAudio();
const alert = bundle('src/data/alertSound.js', '.t20.cjs');

// 이름만 보고는 어떤 소리인지 아무도 모른다 — 설명을 화면에 그대로 적는다
ok('소리가 넷이다', alert.TONES.length, 4);
ok('소리마다 이름과 설명이 있다',
  alert.TONES.filter((t) => !t.name || !t.desc).map((t) => t.id), []);
ok('id 가 안 겹친다', new Set(alert.TONES.map((t) => t.id)).size, 4);
ok('크기는 셋이고 작을수록 작다',
  alert.VOLUMES.map((v) => v.gain), [0.35, 0.7, 1]);

// **준비하기 전에는 안 운다.** 브라우저가 사람이 안 누른 소리를 막기 때문에,
// 여기서 소리를 내려고 하면 그냥 조용히 실패해야 한다 (터지면 안 된다)
ok('준비 전에는 조용히 넘어간다', alert.playTone('ding', 'mid'), false);
alert.primeAudio();

const ring = (tone, vol) => { played.length = 0; alert.playTone(tone, vol); return played.slice(); };
for (const t of alert.TONES) {
  // 조사는 앱이 쓰는 그 사전으로 붙인다. **낫표를 씌운 채로 넘기면 안 된다** —
  // 마지막 글자가 「」 라 받침을 못 본다 (「종」는 이 된다). 이름만 넘기고 낫표는 밖에서
  const eun = josa.eun(t.name).slice(t.name.length);
  ok(`「${t.name}」${eun} ${t.notes.length}알을 울린다`, ring(t.id, 'mid').length, t.notes.length);
}
// 비슷한 소리를 넷 두면 고르는 일이 짐이 된다 — 넷이 서로 달라야 한다
const shapes = alert.TONES.map((t) => ring(t.id, 'mid').map((o) => `${o.type}:${o.frequency.value}`).join(','));
ok('소리 넷이 서로 다르다', new Set(shapes).size, 4);

// 크기는 **실제로 소리에 반영돼야 한다.** 목록의 숫자만 바꾸고 소리에 안 넣으면
// 눌러도 아무 차이가 없다 — 사람은 자기 폰이 이상한 줄 안다
const peak = (arr) => arr[0].g.gain.events[1][1];
ok('「작게」가 「크게」보다 작다', peak(ring('bell', 'low')) < peak(ring('bell', 'high')), true);
ok('크기가 목록의 숫자 그대로 들어간다',
  Number((peak(ring('bell', 'low')) / peak(ring('bell', 'high'))).toFixed(3)), 0.35);
// 소리 하나를 나중에 빼도 안 터져야 한다 — 없는 이름은 기본 소리로 운다
ok('없는 이름이 와도 운다 (기본 소리)', ring('없는소리', 'mid').length, alert.TONES[0].notes.length);
delete global.window;

// **소리를 내는 자리가 셋이다** — 휴식 띠 · 홈트 · 측정 스톱워치.
// 한 곳만 빠뜨리면 그 화면만 옛 소리로 운다. 아무도 안 터지고 소리만 다르다
for (const [name, file, want] of [
  ['휴식 띠', 'src/components/RestBar.jsx', /beepDone\(\{ sound, vibrate, tone, volume \}\)/],
  ['홈트', 'src/pages/HomeworkoutPage.jsx', /alertRef\.current = \{ sound, vibrate, tone, volume \}/],
  ['측정 스톱워치', 'src/components/measure/StopwatchSection.jsx', /alertPrefs\(\)/],
]) {
  ok(`${name}도 고른 소리로 운다`, want.test(fs.readFileSync(file, 'utf-8')), true);
}

const rt = fs.readFileSync('src/components/RestTimer.jsx', 'utf-8');
ok('화면이 소리 넷과 크기 셋을 다 그린다', /TONES\.map/.test(rt) && /VOLUMES\.map/.test(rt), true);
// 눌러서 들어보지 않고 이름만 보고 고르라고 하면 아무도 안 고른다
ok('고르면 그 자리에서 들려준다', /previewTone\(/.test(rt), true);
ok('고른 소리의 설명을 적어준다', /\.desc\}/.test(rt), true);
// 열쇠 이름은 옛 앱 이름 그대로 둔다 — 바꾸면 쓰던 사람의 설정이 사라진다
ok('설정 열쇠를 앱 이름 따라 안 바꿨다',
  /steelbody_rest_tone/.test(fs.readFileSync('src/store/restTimerStore.js', 'utf-8')), true);

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

// 주석을 뺀 소스. 「예전에는 빨강으로 칠했다」 같은 기록까지 잡으면 왜 걷었는지를 못 적는다.
//
// **`/*` 앞에 공백이나 `{` 가 있을 때만 주석으로 본다.** 안 그러면
// `accept="image/*"` 의 `/*` 가 주석 시작으로 읽혀서, 거기부터 다음 `*/` 까지
// **코드 4천 자가 통째로 사라진다.** 비교 화면에서 실제로 그랬다 (2026-09-02).
const stripNotes = (src) => src
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .split(NL)
  .filter((l) => !/^\s*\/\//.test(l))
  .join(NL);

console.log('\n── 지운 것이 되살아나지 않는가 ──');
// **서버 삭제 실패를 삼키면 이 기기에서만 지워진다.** 다음에 앱을 열면 서버에서 받아와
// 그대로 되살아난다 — 지운 줄 알았는데 그대로인 것은 **몸 사진**에서 특히 나쁘다.
// 비교 화면(전 · 후 사진)에서 고쳤던 것과 같은 자리가 **프로필 사진에 남아 있었다**
// (2026-09-02 에 찾아 고쳤다).
const layout = stripNotes(fs.readFileSync('src/components/Layout.jsx', 'utf-8'));
ok('프로필 사진 삭제 실패를 안 삼킨다',
  /photos\/profile'\)\s*\.catch\(\(\) => \{\}\)/.test(layout), false);
ok('실패하면 되살아난다고 말해준다', /다시 열면 되살아납니다/.test(layout), true);
const cmpPage2 = stripNotes(fs.readFileSync('src/pages/ComparePage.jsx', 'utf-8'));
ok('비교 화면도 그렇게 말한다', /다시 열면 되살아납니다/.test(cmpPage2), true);
// 두 번 눌렀거나 다른 기기에서 이미 뺐으면 404 다. 그때 되돌리면 방금 뺀 것이
// 눈앞에서 되살아난다
const hist2 = stripNotes(fs.readFileSync('src/pages/HistoryPage.jsx', 'utf-8'));
ok('없어서 못 지운 것은 실패로 안 친다', /err\.response\?\.status === 404/.test(hist2), true);

console.log('\n── 달력에 「할 것」 담기 (2026-09-02) ──');
// 달력은 되짚는 자리이기만 한 게 아니다. **「이번 주에 언제 갈까」를 정하는 자리**이기도
// 한데, 앞날을 눌러도 「이 날은 쉬셨네요」만 나왔다 — 아직 오지도 않은 날인데.
const pl = bundle('src/data/plans.js', '.t27.cjs');

const PLANS = [
  { id: 1, date: '2026-09-01', name: '가슴+삼두' },
  { id: 2, date: '2026-09-05', name: '하체' },
  { id: 3, date: '2026-09-05', name: '코어' },
];
const TODAY = '2026-09-02';
const DID = { '2026-09-01': [{ id: 9 }] };

ok('날짜별로 묶는다', Object.keys(pl.plansByDate(PLANS)).length, 2);
ok('같은 날 여럿을 다 담는다', pl.plansByDate(PLANS)['2026-09-05'].length, 2);

// **「했는지」를 계획에 적어두지 않는다.** 기록이 곧 답이다 —
// 따로 적어두면 기록을 지웠을 때 계획만 「했음」으로 남는다
ok('그날 기록이 있으면 한 것이다', pl.planState('2026-09-01', TODAY, DID['2026-09-01']), 'done');
ok('오늘과 앞날은 할 것이다',
  [pl.planState(TODAY, TODAY, []), pl.planState('2026-09-05', TODAY, [])], ['todo', 'todo']);
// 못 한 날을 조용히 지우면 왜 못 했는지가 아무 데도 안 남는다
ok('지난 날인데 기록이 없으면 못 한 것이다', pl.planState('2026-08-30', TODAY, []), 'missed');

ok('가까운 것부터 준다', pl.upcoming(PLANS, TODAY, DID, 3).map((x) => x.id), [2, 3]);
// 이미 한 날은 「다음에 할 것」이 아니다
ok('한 날은 다음 것에서 뺀다', pl.upcoming(PLANS, TODAY, DID, 3).some((x) => x.id === 1), false);
ok('못 한 것을 센다', pl.missedCount(PLANS, TODAY, {}), 1);
ok('한 날은 못 한 것으로 안 센다', pl.missedCount(PLANS, TODAY, DID), 0);

ok('날짜를 사람 말로 적는다', pl.dayLabel('2026-09-05'), '9월 5일');
ok('며칠 남았는지 적는다',
  [pl.untilLabel(TODAY, TODAY), pl.untilLabel('2026-09-03', TODAY), pl.untilLabel('2026-09-05', TODAY)],
  ['오늘', '내일', '3일 뒤']);
ok('지난 날은 며칠 전인지 적는다', pl.untilLabel('2026-09-01', TODAY), '어제');

const cal = stripNotes(fs.readFileSync('src/components/MonthCalendar.jsx', 'utf-8'));
// 한 날도 할 날도 금색이라 **색으로만 가르면 구별이 안 된다**
ok('한 날은 실선, 할 날은 점선으로 가른다', /dashed/.test(cal), true);
ok('할 것이 있는 날에 개수를 적는다', /planned/.test(cal), true);
// 못 한 날을 빨강으로 두면 달력을 열 때마다 혼나는 기분이 된다
ok('못 한 날을 위험색으로 칠하지 않는다', /var\(--danger\)/.test(cal), false);

const hist = stripNotes(fs.readFileSync('src/pages/HistoryPage.jsx', 'utf-8'));
// **한 것과 할 것을 섞지 않는다** — 섞으면 「이 달에 몇 일 나왔나」에 아직 하지도
// 않은 날이 같이 세어진다
ok('계획을 기록과 따로 받아온다', /client\.get\('\/plans'\)/.test(hist), true);
ok('달력 아래를 늘 폼으로 채우지 않는다', /selectedDate \? \(/.test(hist), true);
// **홈에도 오늘 할 것이 보여야 한다.** 달력에 담아뒀는데 그날 홈에 오면 아무 데도
// 안 보였다 — 정해둔 사람에게 「루틴을 고르세요」는 이미 한 일을 또 시키는 것이다
const todayCard = stripNotes(fs.readFileSync('src/components/home/TodayCard.jsx', 'utf-8'));
const planBranch = todayCard.indexOf('todayPlans.length > 0');
const routineBranch = todayCard.indexOf('myRoutines.length > 0');
const sessionBranch = todayCard.indexOf('if (session)');
ok('홈이 오늘 담아둔 것으로 갈라진다', planBranch >= 0, true);
// 순서가 곧 우선순위다 — 담아둔 것이 「아무 루틴이나 고르세요」보다 앞이다
ok('담아둔 것이 만들어둔 루틴보다 앞이다',
  planBranch >= 0 && routineBranch >= 0 && planBranch < routineBranch, true);
// 하던 루틴이 있으면 그것이 먼저다 (이어서 하기)
ok('하던 루틴이 제일 앞이다',
  sessionBranch >= 0 && sessionBranch < planBranch, true);
// 루틴을 담아뒀는데 그 사이에 루틴을 지웠을 수 있다 — 시작할 것이 없으면 기록하는 길로
ok('지운 루틴을 담아뒀어도 안 터진다', /routine \? '시작 ›' : '기록 ›'/.test(todayCard), true);
const homePage = stripNotes(fs.readFileSync('src/pages/HomePage.jsx', 'utf-8'));
ok('홈이 오늘 것만 골라 넘긴다', /p\.date === today/.test(homePage), true);

const dayPlan = stripNotes(fs.readFileSync('src/components/DayPlan.jsx', 'utf-8'));
// 「월요일 가슴+삼두」를 그날에 걸어두는 것이 제일 흔한 쓰임이다
ok('내 루틴을 통째로 걸 수 있다', /kind: 'routine'/.test(dayPlan), true);
ok('운동 하나만 담을 수도 있다', /kind: 'exercise'/.test(dayPlan), true);
// 달력에서 날짜를 고른 다음 기록 화면에서 날짜를 또 고르게 하지 않는다
ok('그 날짜를 들고 기록 화면으로 간다', /state: \{ date \}/.test(dayPlan), true);
const wp2 = stripNotes(fs.readFileSync('src/pages/WorkoutPage.jsx', 'utf-8'));
ok('기록 화면이 들고 온 날짜를 쓴다', /location\.state\?\.date/.test(wp2), true);
// 들고 온 날짜를 자정 넘김 처리가 오늘로 덮으면 그 날짜로 못 적는다
ok('들고 온 날짜를 자정 넘김이 안 덮는다', /useRef\(!!location\.state\?\.date\)/.test(wp2), true);

console.log('\n── 루틴 (2026-09-02 에 다시 짰다) ──');
// 한 화면에 **두 화면**이 있었다 — 「나만의 루틴」(목록 + 만들기 폼 + 고치기)과
// 「운동 루틴 추천」(갈래 4 × 부위 5~6). 내 루틴을 시작하려는 사람이 만들기 폼과
// 추천 스물몇 칸을 지나쳐야 했다.
const rtPage = stripNotes(fs.readFileSync('src/pages/RoutinePage.jsx', 'utf-8'));

ok('두 갈래를 탭으로 갈랐다', /TABS/.test(rtPage) && /tab === 'mine'/.test(rtPage) && /tab === 'pick'/.test(rtPage), true);
// 처음 온 사람에게 「루틴 없음」만 보여주고 끝내면 그 다음에 무엇을 할지가 화면에 없다
ok('루틴이 없으면 추천 쪽을 편다', /setTab\('pick'\)/.test(rtPage), true);
// 한 번만 옮기고 그 뒤로는 사람이 고른 탭을 지킨다
ok('탭을 딱 한 번만 옮긴다', /movedRef/.test(rtPage), true);
// 추천을 보다가도 하던 것으로 돌아갈 수 있어야 한다
ok('하던 루틴은 탭과 무관하게 맨 위에 둔다', /하던 루틴/.test(rtPage), true);

// **갈래가 넷인 이유가 이름에 없다.** 「맨몸」과 「홈트」가 뭐가 다른지 이름으로는 모른다
const notes = [...rtPage.matchAll(/'(머신|맨몸|홈트|기능성)':\s*'/g)].map((m) => m[1]);
ok('갈래 넷에 설명이 다 있다', ['머신', '맨몸', '홈트', '기능성'].filter((t) => !notes.includes(t)), []);
// 「특수부대」만 붙여놓고 끝내면 공식 프로그램인 줄 안다
ok('기능성이 공식 프로그램이 아니라고 적는다', /공식 프로그램은 아닙니다/.test(rtPage), true);

// 부위 이름만 있으면 뭐가 들었는지 보려고 하나씩 다 눌러봐야 한다
ok('부위 단추에 개수를 적는다', /const n = \(routines\[p\] \|\| \[\]\)\.length/.test(rtPage), true);

// **갈래를 왔다 갔다 할 때마다 서버를 다시 쳤다.** 그리고 추천을 안 보고 있어도 받았다
ok('갈래마다 한 번만 받아둔다', /cacheRef\.current\[type\]/.test(rtPage), true);
// 받아둔 것을 state 로 들면, 받아오는 사이에 사람이 고른 부위가 도로 처음으로 튄다
ok('받아둔 것은 화면 값이 아니라 ref 로 든다', /const cacheRef = useRef/.test(rtPage), true);
ok('추천을 볼 때만 받아온다', /if \(tab !== 'pick'\) return;/.test(rtPage), true);

// 갈래 이름은 서버의 routines.js 와 글자까지 같아야 한다 — 다르면 그 칸만 조용히 빈다
const routineSrc2 = fs.readFileSync('../backend/src/routes/routines.js', 'utf-8');
ok('갈래 넷이 서버에 다 있다',
  ['머신', '맨몸', '홈트', '기능성'].filter((t) => !routineSrc2.includes(`${t}: {`)), []);

console.log('\n── 제보함 목록 (2026-09-02 에 다시 짰다) ──');
// 사람이 제보함에 **두 번째로** 오는 이유는 하나다 — 답이 왔나 보려고.
// 그런데 답이 어느 것에 달렸는지 목록에서 안 보여서, 여섯 장을 다 눌러봐야 했다.
const rv = bundle('src/pages/support/reportView.js', '.t26.cjs');

const REP = [
  { id: 3, status: 'checking', reply: '고쳤습니다', reply_at: '2026-09-02T10:00:00Z' },
  { id: 2, status: 'done', reply: '안 사라집니다', reply_at: '2026-08-20T10:00:00Z' },
  { id: 1, status: 'received' },
];
const SEEN = '2026-08-25T00:00:00Z';

// **상태와 답변은 다른 것이다.** 「확인중」인데 답이 달린 제보가 실제로 있다 —
// 상태 배지만 보고는 답이 온 줄 모른다
ok('상태가 「확인중」이어도 답은 답이다', rv.hasReply(REP[0]), true);
ok('답이 없으면 없다고 한다', rv.hasReply(REP[2]), false);
ok('마지막으로 본 뒤에 온 답만 새 답이다',
  [rv.isNewReply(REP[0], SEEN), rv.isNewReply(REP[1], SEEN)], [true, false]);
ok('안 본 답이 몇 건인지 센다', rv.newReplyCount(REP, SEEN), 1);
// 한 번도 안 본 사람에게는 답이 다 새 것이다
ok('처음 온 사람에게는 답이 다 새 것이다', rv.newReplyCount(REP, ''), 2);

// **안 본 답이 맨 위다.** 예전에는 무조건 id 역순이라 답이 달린 옛 제보가 아래에 묻혔다
ok('안 본 답을 맨 위로 올린다', rv.sortReports(REP, SEEN).map((r) => r.id), [3, 2, 1]);
// **더 최근에 보낸 제보보다도 위다.** 답을 보러 온 사람이 제일 먼저 볼 것이 그것이다
ok('안 본 답이 더 새 제보보다도 위다',
  rv.sortReports([{ id: 9, status: 'received' }, REP[0]], SEEN).map((r) => r.id), [3, 9]);

// 거르는 말은 사람의 말로. 「접수」와 「확인중」의 차이는 제보한 사람에게 아무 뜻이 없다
ok('거름망이 셋이다', rv.FILTERS.map((f) => f.key), ['all', 'answered', 'waiting']);
ok('거름망마다 몇 건인지 센다',
  [rv.filterCounts(REP).all, rv.filterCounts(REP).answered, rv.filterCounts(REP).waiting], [3, 2, 1]);
ok('「답변 옴」으로 거르면 답 있는 것만', rv.viewReports(REP, 'answered', SEEN).map((r) => r.id), [3, 2]);
ok('「기다리는 중」으로 거르면 답 없는 것만', rv.viewReports(REP, 'waiting', SEEN).map((r) => r.id), [1]);

// **825줄 한 파일이었다.** 목록 한 줄을 고치려고 폼 400줄을 지나쳐야 했다
const boxLines = fs.readFileSync('src/pages/support/ReportBox.jsx', 'utf-8').split(NL).length;
ok('제보함이 한 파일에 몰려 있지 않다 (825줄 → 절반 아래로)', boxLines < 450, true);
for (const f of ['reportMeta.js', 'reportView.js', 'ReportList.jsx', 'AskFirst.jsx']) {
  ok(`${f} 로 나눴다`, fs.existsSync('src/pages/support/' + f), true);
}

const list = stripNotes(fs.readFileSync('src/pages/support/ReportList.jsx', 'utf-8'));
// 답이 어느 것에 왔는지 펼치지 않고도 보여야 한다
ok('목록에 답변 표시를 그린다', /답변 옴/.test(list) && /새 답변/.test(list), true);
ok('접힌 채로도 답의 첫 줄을 보여준다', /String\(item\.reply\)\.split/.test(list), true);
// 고객센터가 제보함을 펼치는 순간 「본 시각」을 올린다 — 다시 읽으면 전부 읽은 것이 된다
ok('본 시각을 처음 한 번만 읽는다', /useState\(\(\) => readLS\(SEEN_REPLY_KEY\)/.test(list), true);
// 관리자의 말(접수 · 보류)을 사람에게 그대로 내놓지 않는다
ok('상태 넷을 탭으로 내놓지 않는다', /'보류'|status === filter/.test(list), false);

console.log('\n── 측정 도구 (2026-09-02 에 다시 짰다) ──');
// 전신 사이즈 · 체력 테스트 · 유연성은 **적기만 하고 달라진 것을 안 말했다.**
// 푸시업 30개를 적으면 목록에 쌓일 뿐, 늘었는지 줄었는지는 위아래를 번갈아 보며
// 사람이 직접 빼야 했다. 체력 테스트는 원래 늘려고 재는 것이다.
const mc = bundle('src/data/measureChange.js', '.t25.cjs');

const rows = [
  { id: 3, date: '2026-09-01', data: { pushup: '34', run_1km: '300' } },
  { id: 2, date: '2026-08-25', data: { pushup: '30', run_1km: '312' } },
  { id: 1, date: '2026-08-01', data: { pushup: '31' } },
];
const push = mc.changeOf(rows, 'pushup');
ok('지난번과 견준다', [push.prev, push.last, push.diff], [30, 34, 4]);
ok('며칠 만인지 센다', push.days, 7);
// 한 번만 적었으면 견줄 것이 없다. 0 으로 치면 「34개 늘었다」가 된다
ok('한 번만 적었으면 견주지 않는다', mc.changeOf([rows[0]], 'pushup').prev, null);
// 적은 적이 없으면 화면은 아무 줄도 안 그린다
ok('안 적은 항목은 null 을 준다', mc.changeOf(rows, 'plank'), null);
// 빈 칸으로 저장한 기록이 최신인 척하면 안 된다
// 아침에 재고 저녁에 또 재면 날짜가 같다. 들어온 차례대로 두면 「지난번」이 뒤집힌다
ok('같은 날 두 번 재면 나중에 적은 것이 최신이다',
  mc.changeOf([
    { id: 5, date: '2026-09-01', data: { pushup: '31' } },
    { id: 6, date: '2026-09-01', data: { pushup: '35' } },
    { id: 4, date: '2026-08-20', data: { pushup: '28' } },
  ], 'pushup').last, 35);
ok('빈 값은 적은 것으로 치지 않는다',
  mc.changeOf([{ id: 4, date: '2026-09-02', data: { pushup: '' } }, ...rows], 'pushup').last, 34);

// **최고 기록은 체력 테스트에서만 말한다.** 몸(사이즈 · 유연성)에는 등급을 안 매긴다
ok('최고 기록을 찾는다', mc.bestOf(rows, 'pushup', 'up').value, 34);
// 1km 달리기는 작을수록 잘한 것이다. 큰 값을 최고로 뽑으면 거꾸로 말하게 된다
ok('작을수록 좋은 것은 작은 값이 최고다', mc.bestOf(rows, 'run_1km', 'down').value, 300);

// 1km 를 초로만 받고 있었다 — 안내 숫자가 300(=5분)이었다.
// 사람은 스톱워치를 「5분 12초」로 읽지 312로 읽지 않는다
ok('초를 분:초로 읽어준다', mc.mmss(312), '5:12');
ok('한 자리 초에 0 을 붙인다', mc.mmss(305), '5:05');
ok('분 · 초를 초로 되돌린다', mc.toSeconds('5', '12'), 312);
ok('둘 다 비었으면 안 적은 것이다 (0초로 저장하지 않는다)', mc.toSeconds('', ''), null);
ok('분만 적어도 된다', mc.toSeconds('5', ''), 300);

ok('「그대로」를 말해준다', mc.diffLabel(0, 'cm'), '그대로');
ok('늘어난 것에 + 를 붙인다', mc.diffLabel(2, 'cm'), '+2cm');
ok('열흘은 날로, 3주는 주로 읽는다', [mc.sinceLabel(10), mc.sinceLabel(21)], ['10일 만에', '3주 만에']);

const fit = stripNotes(fs.readFileSync('src/components/measure/FitnessTestSection.jsx', 'utf-8'));
const size = stripNotes(fs.readFileSync('src/components/measure/BodySizeSection.jsx', 'utf-8'));
const flex = stripNotes(fs.readFileSync('src/components/measure/FlexibilitySection.jsx', 'utf-8'));

// 적는 자리에서 지난 값을 보여준다 — 저장하고 나서야 견줄 수 있으면 늦다
for (const [name, src] of [['체력 테스트', fit], ['전신 사이즈', size], ['유연성', flex]]) {
  ok(`${josa.i(name)} 지난 값을 적는 자리에서 보여준다`, /지난번 \{/.test(src), true);
}
// 몸에는 등급을 안 매긴다 — 사이즈 · 유연성은 방향만 칠하는 부품 하나를 같이 쓴다
ok('몸 쪽 둘이 같은 부품을 쓴다',
  /ChangeSummary/.test(size) && /ChangeSummary/.test(flex), true);
const summary = stripNotes(fs.readFileSync('src/components/measure/ChangeSummary.jsx', 'utf-8'));
ok('몸에는 좋고 나쁨을 안 매긴다고 적어둔다', /좋고 나쁨을 매기지 않습니다/.test(summary), true);
ok('몸 쪽에 위험색을 안 쓴다', /var\(--danger\)|var\(--success\)/.test(summary), false);
// 체력이 준 날에 경고색을 주면 다음에 안 적게 된다
ok('체력 테스트도 빨강을 안 쓴다', /var\(--danger\)/.test(fit), false);
// 1km 만 시간이다
ok('1km 를 분 · 초 두 칸으로 받는다', /runMin/.test(fit) && /runSec/.test(fit), true);
ok('저장은 그대로 초로 한다 (옛 기록과 같은 모양)', /toSeconds\(runMin, runSec\)/.test(fit), true);

console.log('\n── 관리자 「보안 관리」 (2026-09-02 에 다시 짰다) ──');
// 앱에서 두 번째로 큰 화면인데 한 번도 다시 안 본 화면이었다.
const sec = stripNotes(fs.readFileSync('src/components/SecurityPanel.jsx', 'utf-8'));
const secApi = fs.readFileSync('../backend/src/routes/security.js', 'utf-8');

// **적어두고 아무도 안 부르는 길이 있었다.** 화면 안의 표(actionMap)에는 `revoke-admin`
// 이 있는데 그것을 부르는 단추가 없었다 — 관리자 권한을 잘못 준 순간 화면에서는
// 되돌릴 방법이 없었다. 서버에는 그 길이 멀쩡히 열려 있었다
const mapped = [...sec.matchAll(/'([a-z-]+)':\s*'([a-z-]+)',/g)].map((m) => m[1]);
const called = [...sec.matchAll(/handleAction\([^,]+,\s*'([a-z-]+)'\)/g)].map((m) => m[1]);
ok('적어둔 길을 화면이 다 쓴다',
  mapped.filter((a) => !called.includes(a)), []);
ok('관리자를 내리는 길이 화면에 있다',
  called.includes('revoke-admin') && /onClick=\{\(\) => revokeAdmin\(/.test(sec), true);

// 화면이 부르는 자리가 서버에 없으면 눌러도 404 다. 아무도 안 터지고 토스트만 뜬다
const endpoints = [...sec.matchAll(/'([a-z-]+)':\s*'([a-z-]+)',/g)].map((m) => m[2]);
ok('화면이 부르는 자리가 서버에 다 있다',
  endpoints.filter((e) => !secApi.includes(`'/${e}/:id'`)), []);

// **여섯 칸짜리 표를 카드로 바꿨다.** 폰에서 가로로 밀렸고, 막기 · 지우기 · 관리자
// 부여가 화면 밖 오른쪽 끝에 있었다. 8/31 에 측정에서 걷어낸 그 문제다
ok('사람 목록이 옆으로 밀리는 표가 아니다', /<table/.test(sec), false);
// 관리자에게 「막기」를 누르면 서버가 거절한다 — 못 하는 것을 눌러보게 두지 않는다
ok('막기는 일반 사람에게만 그린다', /user\.role === 'user'/.test(sec), true);
// 관리자 권한은 주는 것도 내리는 것도 되돌리기 어렵다. 한 번 묻는다
ok('관리자 권한은 한 번 묻고 준다', /confirmDialog\(/.test(sec), true);
// 자기 관리자 권한은 서버가 못 내리게 한다. 화면도 그 단추를 안 그린다
ok('내 권한을 내리는 단추는 안 그린다', /isMe\(user\)/.test(sec), true);
// 접어두면 열어보기 전에는 위험한 것이 있는지 모른다
ok('접힌 서버 설정에 걸린 개수를 적는다', /dangerN|warnN/.test(sec), true);
// 역할이 admin · blocked · user 라고 영문 그대로 찍히고 있었다
ok('역할을 우리말로 적는다', /ROLE_LABEL/.test(sec), true);
// 옆 화면(해킹 보안)과 무엇이 다른지 안 적으면 어느 쪽에서 풀어야 할지 모른다
ok('해킹 보안과 무엇이 다른지 적어둔다', /해킹 보안/.test(sec), true);

console.log('\n── 부위로 찾기 (2026-09-02 에 고쳤다) ──');
// **「등」과 「팔」 단추가 아무것도 못 찾고 있었다.** 단추가 검색창에 그 글자를 넣는
// 식이었는데, 사전 검색은 한 글자로는 안 찾는다(거의 다 걸려서 도움이 안 된다).
// 「등」 · 「팔」이 한 글자다. **아무도 안 터지고 그 두 단추만 조용히 빈 화면을 줬다.**
const dictP = bundle('src/data/exerciseDict.js', '.t24.cjs');

ok('부위가 일곱이다', dictP.PARTS.length, 7);
// 한 부위라도 비면 그 단추는 늘 빈 화면을 준다
ok('부위마다 운동이 있다',
  dictP.PARTS.filter((n) => dictP.byCategory(n).length === 0), []);
// 여기서 터진 자리다 — 한 글자짜리 부위
ok('한 글자 부위도 찾는다 (등 · 팔)',
  [dictP.searchExercises('등', 99).length > 0, dictP.searchExercises('팔', 99).length > 0],
  [true, true]);
// 사전에 운동을 더할 때 갈래를 새로 만들면 그 운동만 어느 부위에도 안 들어간다
ok('사전의 모든 운동이 어느 부위에 든다',
  dictP.EXERCISE_DICT.filter((e) => !dictP.partOf(e)).map((e) => e.ko), []);

// **글자를 찾은 것이지 부위를 찾은 것이 아니었다.** 설명(desc)에 그 글자가 있으면
// 걸려서, 「가슴」에 고블릿 스쿼트(「덤벨을 가슴 앞에 들고」)가, 「어깨」에 데드행이 떴다
const inPart = (part, ko) => dictP.byCategory(part).some((e) => e.ko === ko);
ok('설명에 「가슴」이 있다고 가슴 운동이 되지 않는다', inPart('가슴', '고블릿 스쿼트'), false);
ok('설명에 「어깨」가 있다고 어깨 운동이 되지 않는다', inPart('어깨', '데드행'), false);
// 있어야 할 자리에는 있어야 한다
ok('고블릿 스쿼트는 하체다', inPart('하체', '고블릿 스쿼트'), true);
ok('데드행은 등이다', inPart('등', '데드행'), true);
ok('풀업 · 랫풀다운은 등이다', inPart('등', '풀업') && inPart('등', '랫풀다운'), true);
ok('컬 · 삼두 · 딥스는 팔이다',
  inPart('팔', '바벨컬') && inPart('팔', '스컬크러셔') && inPart('팔', '딥스'), true);

// 단추를 손으로 적어두면 사전에 부위를 하나 더 만들었을 때 이 자리만 옛 목록으로 남는다.
// 「등」 · 「팔」이 안 나오던 것도 단추와 사전이 따로 놀아서 생긴 일이다
const finderSrc = stripNotes(fs.readFileSync('src/components/ExerciseFinder.jsx', 'utf-8'));
ok('부위 단추를 사전에서 가져온다', /PARTS\.map\(/.test(finderSrc), true);

// 「같은 갈래 보기」는 2026-09-02 에 걷어냈다. 검색이 갈래 이름까지 보기 때문에
// 「벤치프레스」를 찾으면 인클라인 · 디클라인이 **이미 목록에 다 나온다** —
// 펼쳐도 방금 본 것을 다시 보여줄 뿐이었고, 카드마다 단추가 둘이라 정작
// 「자세 보기」가 어느 것인지 한 번 더 읽어야 했다
ok('갈래 펼치기를 걷어냈다', /같은 갈래 보기|siblingsOf/.test(finderSrc), false);
// 걷어낸 근거가 실제로 맞는지 본다 — 갈래 이름으로 찾으면 그 갈래가 다 나와야 한다
const benchAll = dictP.EXERCISE_DICT.filter((e) => e.group === '벤치프레스').map((e) => e.ko);
const benchHit = dictP.searchExercises('벤치프레스', 30).map((e) => e.ko);
ok('갈래 이름으로 찾으면 그 갈래가 다 나온다',
  benchAll.filter((n) => !benchHit.includes(n)), []);

console.log('\n── 자세 설명 (2026-09-02) ──');
// 사전의 한 줄(`desc`)은 「그게 무슨 운동인가」이지 「어떻게 하는가」가 아니다.
// 「손 모아 다이아몬드. 삼두 + 가슴 안쪽」을 읽고 처음 하는 사람이 그 자세를 잡을 수는 없다.
const form = bundle('src/data/exerciseForm.js', '.t22.cjs');
const dictAll = bundle('src/data/exerciseDict.js', '.t23.cjs').EXERCISE_DICT;

// **하나만 빠져도 그 운동에서만 단추가 사라진다.** 아무도 안 터지고, 그 운동을 찾은
// 사람만 「왜 이건 자세가 없지」 하게 된다
ok('사전에 있는 운동 전부에 자세 설명이 있다',
  dictAll.filter((e) => !form.formOf(e.ko)).map((e) => e.ko), []);
ok('사전에 없는 이름을 적어두지 않았다',
  Object.keys(form.FORM).filter((k) => !dictAll.some((e) => e.ko === k)), []);
ok('사전과 개수가 같다', form.FORM_COUNT, dictAll.length);

// 순서가 두 줄이면 자세가 안 잡힌다. 그리고 **다치는 자리는 반드시 적는다**
ok('순서가 세 줄 이상이다',
  Object.entries(form.FORM).filter(([, v]) => (v.steps || []).length < 3).map(([k]) => k), []);
ok('조심할 것이 다 적혀 있다',
  Object.entries(form.FORM).filter(([, v]) => !v.careful).map(([k]) => k), []);

// 괄호 안은 같은 동작을 어디서 하느냐일 뿐이다 — 자세 설명은 하나만 둔다
ok('괄호가 붙은 이름도 찾는다 (좌 · 의자 · 식탁 아래)',
  !!form.formOf('사이드 플랭크 힙 딥 (좌)') && !!form.formOf('인버티드 로우 (식탁 아래)'), true);
// 외부 DB 에서 온 이름에는 자세 설명이 없다. 그때 화면은 단추를 아예 안 그린다
ok('사전에 없는 이름은 null 을 준다 (안 터진다)', form.formOf('없는운동'), null);

// 집에서 하는 앱이다. **뛰는 동작의 조심할 것에는 층간소음이 적혀 있어야 한다** —
// 프로그램 설명에만 적어두면 검색으로 그 운동만 찾아온 사람은 못 본다
const loudMoves = ['버피', '크로스 잭', '하이니 스프린트', '점프 스쿼트', '점핑잭'];
ok('뛰는 동작에는 밤 이야기가 붙어 있다',
  loudMoves.filter((n) => !/밤|소리|아파트|아래층/.test(form.formOf(n).careful || '')), []);

const finder = stripNotes(fs.readFileSync('src/components/ExerciseFinder.jsx', 'utf-8'));
ok('화면이 자세 설명을 가져다 쓴다', /formOf\(/.test(finder), true);
// 늘 펼쳐두면 목록에서 운동을 못 고른다 — 눌러서 본다
ok('눌러서 펼치는 단추가 있다', /자세 보기/.test(finder) && /자세 접기/.test(finder), true);
// 순서가 있는 것이라 번호를 매긴다. 이 자리에서는 번호가 장식이 아니다
ok('순서를 번호 매긴 목록으로 그린다', /<ol/.test(finder), true);
// 조심할 것을 순서에 섞어두면 다치는 자리가 묻힌다
ok('조심할 것을 따로 세운다', /조심할 것/.test(finder), true);

console.log('\n── 비교 (2026-09-02 에 다시 짠 화면) ──');
// **눈으로 봐서는 틀린 것을 못 잡는 화면이다** — 과거와 현재를 거꾸로 골라도
// 그래프는 멀쩡히 그려지고 숫자만 조용히 반대로 말한다. 그래서 계산을 떼어내 돌려본다.
const cmp = bundle('src/data/compare.js', '.t21.cjs');

// 인바디 기록은 최신이 앞이다(0번이 제일 최근) — **과거일수록 인덱스가 크다**
ok('과거 → 현재로 골랐으면 그대로', [cmp.orderPick(5, 0).before, cmp.orderPick(5, 0).after], [5, 0]);
// 5kg 뺀 사람의 화면에 「체중 5kg 증가」가 뜨던 자리다. 막지 않고 앞뒤를 맞춘다
ok('거꾸로 골랐으면 바로잡는다', [cmp.orderPick(0, 5).before, cmp.orderPick(0, 5).after], [5, 0]);
ok('바로잡았다고 말해준다 (조용히 바꾸면 사람이 잘못 본 줄 안다)', cmp.orderPick(0, 5).swapped, true);
ok('같은 날을 두 번 고른 것을 안다', cmp.orderPick(3, 3).same, true);

// 3kg 을 2주에 뺀 것과 반년에 뺀 것은 다른 이야기인데, 얼마 만인지가 아무 데도 없었다
ok('며칠 사이인지 센다', cmp.daysBetween('2026-06-10', '2026-09-02'), 84);
ok('못 읽는 날짜는 null (화면이 그 줄을 안 그린다)', cmp.daysBetween('', '2026-09-02'), null);
ok('84일은 날로 읽는다', cmp.spanLabel(84), '84일 사이');
ok('석 달이 넘으면 달로 읽는다', cmp.spanLabel(120), '4개월 사이 (120일)');

// **좋고 나쁨을 매기지 않는다.** 8/25 에 그렇게 정했는데 이 화면의 「종합 평가」만
// 그 뒤로도 등급을 매기고 있었다 — 체중이 늘면 주황(주의), 체지방이 늘면 빨강(위험).
// 벌크업 중인 사람에게 「체중 증가」를 경고색으로 줬다
const B = { date: '2026-06-10', weight: 78, muscle_kg: 30, fat_pct: 22, water_l: 38, bmi: 25.1 };
const A = { date: '2026-09-02', weight: 73, muscle_kg: 33, fat_pct: 16, water_l: 38, bmi: 23.5 };
const ch = cmp.changes(B, A);
ok('다섯 가지를 견준다', ch.length, 5);
ok('무엇이 어느 쪽으로 갔는지만 준다 (좋고 나쁨 없음)',
  Object.keys(ch[0]).filter((k) => /good|bad|reverse|score|grade/.test(k)), []);
ok('줄어든 것은 -1, 늘어난 것은 +1',
  [ch.find((c) => c.key === 'weight').dir, ch.find((c) => c.key === 'muscle_kg').dir], [-1, 1]);
ok('안 달라진 것은 0 (「그대로」)', cmp.diffLabel(ch.find((c) => c.key === 'water_l')), '그대로');
ok('늘어난 것에 + 를 붙인다', cmp.diffLabel(ch.find((c) => c.key === 'muscle_kg')), '+3.0kg');
// 한쪽에만 있는 값은 견줄 수가 없다 — 빼고 그린다 (0 으로 치면 「30kg 감소」가 된다)
ok('한쪽에 없는 값은 견주지 않는다', cmp.changes(B, { ...A, muscle_kg: null }).length, 4);
ok('기록이 하나면 아무것도 안 준다', cmp.changes(null, A), []);

const cmpPage = stripNotes(fs.readFileSync('src/pages/ComparePage.jsx', 'utf-8'));
// 「종합 평가」가 쓰던 색이다. 방향만 칠하기로 했으므로 이 셋이 다시 나오면 안 된다
ok('몸에 등급을 매기는 색을 안 쓴다',
  /var\(--success\)|var\(--danger\)/.test(cmpPage), false);
ok('앞뒤를 바로잡고 나서 그린다', /orderPick\(/.test(cmpPage), true);
ok('얼마 만인지 적는다', /spanLabel\(/.test(cmpPage), true);
// 사진에는 날짜가 없어서 반년 전 사진을 놓고 「많이 달라졌다」고 보게 된다
ok('사진에 언제 올린 것인지 적는다', /updated_at/.test(cmpPage), true);
// 0부터 시작하는 한 눈금에 체중(73)과 체지방(16)을 같이 세우던 그림
ok('묶음 막대를 안 쓴다', /charts\/Bars/.test(cmpPage), false);
ok('막대 파일도 지웠다', fs.existsSync('src/components/charts/Bars.jsx'), false);

console.log('\n── 자주 묻는 것 (고객센터 · 제보함이 같이 본다) ──');
// 개수를 못박으면 항목을 늘릴 때마다 여기부터 고쳐야 한다. 줄어든 것만 잡는다
ok('항목이 줄지 않았다', faq.FAQ.length >= 15, true);
ok('topic 이 겹치지 않는다', new Set(faq.FAQ.map(f => f.topic)).size, faq.FAQ.length);
const firstFaq = (q) => (faq.matchFaq(q)[0] || {}).topic || null;
for (const [q, want] of [
  ['푸시', '알림'], ['탈퇴', '계정 삭제'], ['비번', '비밀번호'], ['csv', '내보내기'],
  ['등급', '인바디 판정'], ['점검', '점검'], ['구글', '소셜 로그인'],
  // 9/2 에 「홈트레이닝」을 「기능성운동」으로 바꿨다. **옛 이름으로도 찾혀야 한다** —
  // 이름을 바꿔도 사람은 한동안 옛 이름으로 찾고, 못 찾으면 화면이 없어진 줄 안다
  ['홈트', '기능성운동'], ['기능성운동', '기능성운동'],
  ['날아갔', '기록 보관'], ['차단', '정지'],
  // 9/2 에 항목을 하나 늘렸다. **「소리」와 「알림」이 서로 걸려드는 자리다** —
  // 운동 알림(푸시)과 휴식 타이머 소리는 다른 이야기인데 말이 겹친다
  ['소리크기', '휴식 타이머 소리'], ['볼륨', '휴식 타이머 소리'], ['소리', '휴식 타이머 소리'],
  ['알림', '알림'],
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

// 묶음 막대(`charts/Bars.jsx`)는 2026-09-02 에 걷어냈다. 비교 화면 하나가 쓰고 있었는데,
// 0부터 시작하는 한 눈금에 체중(73)과 체지방(16)을 같이 세워서, 사람이 보러 온 1.5%
// 변화가 픽셀 두어 개로 뭉개졌다. 쓰는 화면이 없어져서 파일도 같이 지웠다.

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
  for (const [name, svg] of [['오각형', draw(Radar, { data: REAL, series: TWO, width: W })]]) {
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
               'src/pages/support/SupportPage.jsx', 'src/pages/support/reportMeta.js',
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
// 2026-09-02 에 제보함을 넷으로 나눴다 — 갈래와 말은 `reportMeta.js` 가 들고 있다
const K2 = kindIcon('src/pages/support/reportMeta.js');
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
console.log('── 기록 화면에서 운동을 찾을 수 있는가 ──');
// 기록 화면의 운동명 칸은 **내가 전에 적은 이름만** 찾고 있었다. 처음 쓰는 사람은
// 후보가 하나도 없었고, 초성('ㅂㅊㅍㄹㅅ')이나 부위('가슴')로는 아무것도 안 나왔다.
// 그 기능은 「운동 검색」 화면에만 있어서, 기록하다 이름이 생각 안 나면 화면을
// 나갔다 들어와야 했다 — 적으려던 것을 도중에 끊는 셈이다.
const dictMod = bundle('src/data/exerciseDict.js', '.t19.cjs');
const found = (q) => dictMod.searchExercises(q, 8).map((e) => e.ko);

ok('이름으로 찾는다', found('벤치프레스').includes('벤치프레스'), true);
ok('초성으로 찾는다 (ㅂㅊㅍㄹㅅ)', found('ㅂㅊㅍㄹㅅ').includes('벤치프레스'), true);
ok('영문으로 찾는다 (squat)', found('squat').includes('스쿼트'), true);
ok('부위로 찾는다 (가슴)', found('가슴').length > 0, true);
// 홈트·루틴에서 쓰는 이름도 여기서 찾혀야 한다 — 9/1 에 사전에 넣은 것들이다
ok('오늘 넣은 운동도 찾힌다 (노르딕 컬)', found('노르딕').includes('노르딕 컬'), true);
ok('한 글자로는 안 찾는다 (거의 다 걸려서 도움이 안 된다)', found('스').length, 0);

const wp = fs.readFileSync('src/pages/WorkoutPage.jsx', 'utf-8');
ok('기록 화면이 사전을 쓴다', /searchExercises/.test(wp), true);
// 내가 전에 한 것이 위에 와야 한다 — 무게·횟수가 저절로 채워지는 것들이다
ok('전에 한 것을 먼저 보여준다', wp.indexOf('mine: true') < wp.indexOf('fromDict'), true);
ok('사전에서 온 것은 설명을 같이 보여준다', wp.includes('s.desc &&'), true);
ok('뭘로 찾을 수 있는지 적어준다', wp.includes('이름 · 초성 · 부위로 찾을 수 있어요'), true);
// **그 줄이 운동명 칸 밑에 있어야 한다.** 9/1 에는 「다음 운동」 카드 안에 들어가 있었다 —
// 그 카드에는 운동명 칸이 아예 없다(무게·횟수·횟수뿐이다). 찾을 것이 없는 자리에서
// 찾는 법을 알려주고, 정작 찾는 칸 밑에는 아무 말이 없었다. 빌드도 검사도 통과했다.
ok('그 줄이 운동명 칸 밑에 있다', wp.indexOf('t.searchHint') > wp.indexOf('ref={exerciseInputRef}'), true);
// 후보가 뜰 때 줄을 지우면 밑의 무게·횟수 칸이 위로 튄다 — 감추기만 한다
ok('후보가 뜨면 감춘다 (지우지 않는다)', /visibility: suggestions\.length > 0/.test(wp), true);

console.log('');
console.log('── 앱 이름이 한 이름인가 ──');
// 2026-09-01 에 STEEL BODY → IRONLOG 로 바꿨다. 이름은 **여섯 자리**에 흩어져 있다 —
// 로고 · 탭 제목 · 설치 이름(manifest) · 아이폰 홈 화면 이름 · 알림 제목 · 내보내기 파일.
// 하나만 빠뜨리면 **거기만 옛 이름으로 남는다.** 폰 홈 화면에 옛 이름으로 깔리거나,
// 알림만 다른 앱에서 온 것처럼 뜬다. 아무도 안 터져서 눈으로만 잡힌다.
const APP_NAME = 'BLACK IRON';
const html = fs.readFileSync('index.html', 'utf-8');
const manifest = JSON.parse(fs.readFileSync('public/manifest.json', 'utf-8'));
const sw = fs.readFileSync('public/sw.js', 'utf-8');
const logo = fs.readFileSync('src/components/Logo.jsx', 'utf-8');

ok('탭 제목', (html.match(/<title>([^<]+)<\/title>/) || [])[1], APP_NAME);
ok('설치 이름', manifest.name, APP_NAME);
ok('홈 화면에 붙는 짧은 이름', manifest.short_name, APP_NAME);
ok('아이폰 홈 화면 이름',
  (html.match(/apple-mobile-web-app-title" content="([^"]+)"/) || [])[1], APP_NAME);
ok('알림 제목', sw.includes(`payload.title || '${APP_NAME}'`), true);
// 로고는 첫 글자만 세리프로 따로 그린다 — 두 조각을 이으면 이름이 나와야 한다
const parts = [...logo.matchAll(/>(Black Iron)</g)].map((m) => m[1]);
// 두 낱말을 굵기와 자간으로 갈라 그린다 — 이으면 이름이 나와야 한다
// 로고는 소문자로 적고(「Black Iron」) 설치 이름은 대문자다(「BLACK IRON」) —
// 같은 이름이어야 한다. 대소문자만 맞춰서 견준다
ok('로고에 적힌 것이 앱 이름과 같다', parts.join(' ').toUpperCase(), APP_NAME);
// **딱딱함은 각에서 온다.** 전부 대문자 · 넓은 자간 · 가르는 직선을 안 쓴다
ok('로고를 전부 대문자로 적지 않는다', /Black Iron/.test(logo), true);
ok('낱말 사이에 선을 안 긋는다', /width: 1, height: cap/.test(logo), false);
// **두 낱말이 달라야 한다.** 같은 크기·같은 자간이면 그냥 긴 글자다
// **번쩍이게 만드는 셋을 안 쓴다** — 금색 그라데이션 · 글자 그림자 · 굵기 대비.
// 화면에서 금속을 흉내 내면 대개 싸 보인다. 한 색 · 가는 선 · 넓은 자간으로 간다
ok('글자에 그라데이션을 안 쓴다', /backgroundClip: 'text'/.test(logo), false);
ok('글자에 그림자를 안 쓴다', /textShadow/.test(logo), false);
// 소문자에 자간을 벌리면 글자가 흩어진다. 값은 손볼 수 있으니 **넓지 않은지**만 본다
const wordSpacing = Number((logo.match(/letterSpacing: cap \* (0\.[0-9]+)/) || [])[1]);
ok('소문자라 자간을 좁게 둔다', wordSpacing > 0 && wordSpacing <= 0.03, true);
// 마크는 선 하나 굵기. 획이 많아지면 작은 자리에서 뭉친다
// 마크는 **링 하나 + 봉 하나**. 각진 도형을 안 쓴다 — 원은 어느 크기로 줄여도 안 뭉갠다
// **마크 함수 안만 센다.** 파일 전체를 세면 싸인 획의 path 까지 걸린다 —
// 실제로 그렇게 짰다가 FAIL 이 났다
const markBody = logo.slice(logo.indexOf('export function LogoMark'), logo.indexOf('export function LogoWord'));
ok('마크가 링 하나 + 봉 하나다',
  [(markBody.match(/<circle/g) || []).length, (markBody.match(/<path/g) || []).length], [1, 1]);
// 싸인 획 — 자로 그은 선이 아니라 **면으로 그린 획**이다 (가운데가 굵고 끝이 가늘다)
ok('밑줄은 곧은 선이 아니라 그은 획이다',
  /function Flourish/.test(logo) && /fill="currentColor"/.test(logo), true);
ok('글자를 흘려 쓴다 (싸인 결)', /fontStyle: 'italic'/.test(logo), true);
// 브라우저에 남는 열쇠는 **바꾸지 않는다** — 바꾸면 쓰던 사람의 설정과 사진이 사라진다
const keys = fs.readFileSync('src/data/localKeys.js', 'utf-8');
ok('브라우저 열쇠는 그대로 둔다', /ironlog_profile_photo/.test(keys), true);
// 홈 화면에 깔리는 그림은 **앱 안의 마크와 같아야 한다.** 다르면 깔고 나서 다른 앱처럼 보인다.
// 앱 아이콘은 512 격자, 로고는 24 격자라 좌표는 다르지만 **모양(마름모+봉+판)** 은 같다
const icon = fs.readFileSync('public/icons/icon.svg', 'utf-8');
// 로고만 우아하고 그 옆 글자가 표지판이면, 로고가 혼자 논다.
// 스플래시의 표어가 딱 그 자리였다 — 전부 대문자에 자간 3 이었다
const splash = fs.readFileSync('src/components/SplashScreen.jsx', 'utf-8');
ok('스플래시 표어를 전부 대문자로 찍지 않는다', /textTransform: 'uppercase'/.test(splash), false);
ok('표어도 로고와 같은 글자체다', /Playfair Display/.test(splash), true);
// 사람이 이 앱을 처음 보는 자리에서는 로고를 한 벌 다 편다 (부제까지)
const login = fs.readFileSync('src/pages/LoginPage.jsx', 'utf-8');
ok('로그인 화면이 부제를 지우지 않는다', /variant="stack" subtitle=""/.test(login), false);

ok('앱 아이콘도 링 하나 + 봉 하나다 (로고와 같은 모양)',
  [(icon.match(/<circle/g) || []).length, (icon.match(/<path/g) || []).length, / H\d/.test(icon)],
  [1, 1, true]);
// 금색은 한 색으로 납작하게. 아이콘에서도 그라데이션을 안 쓴다
ok('아이콘 금색에 그라데이션을 안 쓴다', icon.includes('stroke="url(#'), false);

// **시안에 실제로 쓰는 자리가 다 있어야 한다.** 9/1 에 이름표가 앱과 어긋나 있었고
// (「로그인 · 스플래시 (34)」인데 앱은 26 · 48 이었다), 그걸 고치면서도 **홈 화면 머리와
// 점검 화면은 시안에 아예 없었다.** 시안에 없는 자리는 아무도 안 보고 지나간다 —
// 홈 화면 머리는 매일 오는 사람이 제일 자주 보는 로고다.
const sheetSrc = fs.readFileSync('scripts/logo-sheet.cjs', 'utf-8');
const logoCaps = new Set();
const jsxFiles = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) jsxFiles(full, out);
    else if (e.name.endsWith('.jsx') && e.name !== 'Logo.jsx') out.push(full);
  }
  return out;
};
for (const f of jsxFiles('src')) {
  const src = fs.readFileSync(f, 'utf-8');
  // `cap={phase >= 2 ? 32 : 48}` 처럼 두 크기를 한 줄에 쓰는 자리가 있어 숫자를 다 긁는다
  for (const m of src.matchAll(/<Logo(?:Mark|Word)?\b[\s\S]{0,300}?(?:cap|size)=\{([^}]*)\}/g)) {
    // 삼항(`phase >= 2 ? 32 : 48`)은 물음표 앞이 조건이라 숫자를 긁으면 2 가 딸려온다
    const val = m[1].includes('?') ? m[1].slice(m[1].indexOf('?')) : m[1];
    for (const n of val.match(/\d+/g) || []) logoCaps.add(Number(n));
  }
}
const capsMissing = [...logoCaps].sort((a, b) => a - b)
  .filter((n) => !new RegExp('(^|[^0-9.])' + n + '([^0-9.]|$)').test(sheetSrc));
ok('앱에서 쓰는 로고 크기가 시안에 다 있다', capsMissing, []);


console.log('');
console.log('── 이모지를 다 걷어냈는가 (남의 그림을 안 쓴다) ──');
// 이모지 그림은 애플 · 구글 · 삼성이 각각 그린 **그 회사 것**이고, 폰마다 다르게 나온다 —
// 검정+금으로 맞춰놓은 화면에 파란 종이 뜨고 노란 집이 뜬다.
// 8/31 에 길찾기 · 홈 · 미션 · 고객센터를 걷었고, 9/1 에 나머지 아홉 자리를 걷었다.
//
// **✕ · ✎ · ★ · ☆ · ✓ · ⚠ 는 그대로 둔다.** 이건 벤더가 그린 그림이 아니라 글자다 —
// 앱 글꼴로 그려지고 글자색을 따라온다. 이모지와 성격이 다르다
const VENDOR_EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
// `stripNotes` 를 그대로 쓴다. 여기에도 같은 구멍이 있었다 —
// `accept="image/*"` 에 걸려 비교 화면의 코드 4천 자를 건너뛰고 있었다
// (그 안에 이모지가 있었어도 못 잡았다)
const codeOf = stripNotes;

const srcFiles = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (/\.(jsx?|cjs)$/.test(name)) srcFiles.push(full);
  }
})('src');
ok('앱 코드에 이모지가 없다',
  srcFiles.filter((f) => VENDOR_EMOJI.test(codeOf(fs.readFileSync(f, 'utf-8'))))
    .map((f) => f.replace(/\\/g, '/')), []);
// 옛 이름이 코드에 남아 있으면 거기만 딴 앱이 된다 (주석의 기록은 뺀다 —
// 「예전 이름은 STEEL BODY 였다」까지 잡으면 왜 바꿨는지를 못 적는다)
const oldName = srcFiles.concat(['index.html', 'public/manifest.json', 'public/sw.js', 'vite.config.js'])
  .filter((f) => fs.existsSync(f))
  .filter((f) => /STEEL BODY|steelbody-|steel-body|IRONLOG|ironlog-/.test(codeOf(fs.readFileSync(f, 'utf-8'))))
  .map((f) => f.split(/[\\/]/).pop());
ok('코드에 옛 이름이 안 남았다', oldName, []);

// 이름이 틀리면 **조용히 빈 칸**이 된다 (NavIcon 은 모르는 이름에 null 을 준다).
// 아무도 안 터지고 아이콘 자리만 비므로 눈으로만 잡힌다
const iconNames = new Set(nav.NAV_ICONS);
const pickIcons = (src) => [...codeOf(src).matchAll(/icon: '([^']+)'/g)].map((m) => m[1]);
const iconUsers = [
  'src/components/home/HomeSearch.jsx',
  'src/pages/AdminPage.jsx',
  'src/pages/support/introData.js',
  'src/components/admin/MaintAdmin.jsx',
  'src/components/MaintenanceScreen.jsx',
  'src/components/AiAdminPanel.jsx',
  'src/pages/support/SupportPage.jsx',
  'src/components/TabBar.jsx',
];
const unknown = [];
for (const f of iconUsers) {
  for (const n of pickIcons(fs.readFileSync(f, 'utf-8'))) {
    if (!iconNames.has(n)) unknown.push(f.split('/').pop() + ': ' + n);
  }
}
ok('적어둔 아이콘 이름이 전부 실제로 그려진다', unknown, []);

// 적어만 두고 화면이 안 그리면 없는 것과 같다 —
// 고객센터 소개의 아이콘이 딱 그랬다 (9/1 까지 아무 데서도 안 그려지고 있었다)
const drawsIcon = (f) => /<NavIcon\s+name=/.test(fs.readFileSync(f, 'utf-8'));
ok('아이콘을 적어둔 화면이 그것을 실제로 그린다',
  iconUsers.filter((f) => /\.jsx$/.test(f)).filter((f) => !drawsIcon(f)), []);
// **쓰면서 안 들여오면 화면이 열자마자 죽는다.**
// 9/1 에 이모지를 걷다가 두 화면(AI 관리자 · 루틴)에서 실제로 그랬다 —
// `<NavIcon>` 은 넣고 `import` 를 빠뜨렸다. **빌드는 통과한다** (번들러는 전역일 수도
// 있다고 보고 넘어간다) 그리고 검사도 「그린다」만 보고 있어서 같이 놓쳤다.
// 그 화면을 열어야만 `ReferenceError` 로 터진다
const usesIcon = srcFiles.filter((f) => /<NavIcon\s/.test(fs.readFileSync(f, 'utf-8')));
const short = (f) => f.split(/[\\/]/).pop();
ok('NavIcon 을 쓰는 화면은 전부 들여온다',
  usesIcon.filter((f) => !/import NavIcon from/.test(fs.readFileSync(f, 'utf-8'))).map(short), []);
// 다른 이름에서도 같은 일이 난다 — 자주 쓰는 것 몇 개를 같이 본다
const COMMON = ['client', 'toast', 'useNavigate'];
const missing = [];
for (const f of srcFiles) {
  const src = fs.readFileSync(f, 'utf-8');
  const body = src.replace(/^import[^;]*;$/gm, '');
  for (const name of COMMON) {
    const used = new RegExp('\\b' + name + '\\s*\\(').test(body);
    const imported = new RegExp('import[^;]*\\b' + name + '\\b[^;]*;').test(src);
    // 그 이름을 **자기가 만든 파일**은 들여올 필요가 없다 (client.js · Toast.jsx)
    const defines = new RegExp('(const|let|function|class)\\s+' + name + '\\b').test(src);
    if (used && !imported && !defines) missing.push(short(f) + ': ' + name);
  }
}
ok('쓰는데 안 들여온 이름이 없다', missing, []);

ok('고객센터 소개가 아이콘을 그린다',
  /<NavIcon name=\{f\.icon\}/.test(fs.readFileSync('src/pages/support/SupportPage.jsx', 'utf-8')), true);

// 같은 자리로 가는 길은 같은 그림이어야 한다 — 두 번 익히게 하지 않는다.
// 더보기(TabBar) · 홈 검색 · 고객센터 소개 셋이 같은 화면을 가리킨다
const grab = (src, re) => {
  const out = {};
  for (const m of codeOf(src).matchAll(re)) out[m[1]] = m[2] || m[3];
  return out;
};
const tabbarSrc = fs.readFileSync('src/components/TabBar.jsx', 'utf-8');
const homeSearchSrc = fs.readFileSync('src/components/home/HomeSearch.jsx', 'utf-8');
const introSrc = fs.readFileSync('src/pages/support/introData.js', 'utf-8');
const byPath = (src) => {
  const out = {};
  for (const m of codeOf(src).matchAll(/path: '([^']+)'[^}]*?icon: '([^']+)'/g)) {
    if (!out[m[1]]) out[m[1]] = m[2];
  }
  return out;
};
const T = byPath(tabbarSrc), H = byPath(homeSearchSrc), I = byPath(introSrc);
const shared = Object.keys(T).filter((p2) => H[p2] || I[p2]);
ok('같은 자리로 가는 길은 세 화면이 같은 그림을 쓴다',
  shared.filter((p2) => (H[p2] && H[p2] !== T[p2]) || (I[p2] && I[p2] !== T[p2])), []);

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
// **두 곳이 같은 목록이면 하나는 있을 이유가 없다.**
//
// 9/3 까지 홈트의 「기능성(특수부대식)」은 추천 루틴의 「기능성」 스무 가지에서 열둘을
// 그대로 뽑아 쓰고 있었고, **이 검사가 그것을 지키고 있었다** — 「루틴에 없는 운동을
// 넣지 마라」로 맞춰봤다. 두 화면을 다 본 사람에게는 같은 것이 두 군데 있는 것으로
// 보인다. 실제로 그렇게 물어보셨다.
//
// 그래서 뒤집는다. 두 곳은 **역할로 갈린다** —
//   루틴 : 배낭 · 문틀바 · 체력검정. 세트 · 횟수로 적어두고 **기록하는** 목록
//   홈트 : 준비물 없이 켜서 **따라 하는** 10분 한 판
// 그러면 운동도 갈려야 한다. 하나라도 겹치면 여기서 잡는다
const routineSrc = fs.readFileSync('../backend/src/routes/routines.js', 'utf-8');
const funcSection = routineSrc.slice(routineSrc.indexOf('기능성: {'));
const routineNames = [...funcSection.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
ok('루틴의 기능성이 스무 가지다', routineNames.length, 20);
ok('홈트의 기능성이 루틴의 기능성과 한 개도 겹치지 않는다',
  func.filter((e) => routineNames.includes(e.name)).map((e) => e.name), []);
// 준비물이 없다는 것이 이 판의 정체다. 배낭·문틀바가 들어오면 루틴 쪽과 다시 섞인다
ok('홈트의 기능성은 준비물이 없다 (맨몸만)', home.gearOf('기능성(특수부대식)'), []);
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
// 준비물이 없다는 것과, 추천 루틴 쪽과 무엇이 다른지를 **화면에서** 말해야 한다.
// 코드 주석에만 적어두면 앱을 쓰는 사람은 여전히 둘을 구별하지 못한다
ok('설명에 준비물이 없다고 적었다', /준비물이 하나도 없|매트 하나면/.test(funcNote), true);
ok('설명에 추천 루틴과 무엇이 다른지 적었다',
  /추천 루틴/.test(funcNote) && /다른 운동/.test(funcNote), true);
ok('설명에 공식 프로그램이 아니라고 적었다', /공식 프로그램은 아닙니다/.test(funcNote), true);
ok('설명에 공식 프로그램이 아니라고 적었다', /공식 프로그램/.test(funcNote), true);
ok('뛰는 동작이 있으면 밤에 어떻게 할지 적었다', jumpy.length === 0 || /밤/.test(funcNote), true);
// 어떤 순서로 가는 판인지 안 적으면 그냥 열두 개 목록이다
ok('설명에 어떤 순서로 가는지 적혀 있다', /순서/.test(funcNote), true);
ok('타바타에도 뭐가 다른지 한 줄 있다', (home.PROGRAM_NOTES['유산소 타바타'] || []).length > 0, true);
// 적어만 두고 화면이 안 그리면 아무도 못 본다
const page = fs.readFileSync('src/pages/HomeworkoutPage.jsx', 'utf-8');
ok('화면이 설명 줄을 그린다', page.includes('PROGRAM_NOTES[name]'), true);

// ── 고르기 전에 알아야 하는 둘 — 준비물 · 층간소음 (2026-09-02) ──
//
// 화면 머리가 **「장비 없이 집에서 할 수 있는 운동 프로그램」**이라고 적고 있었다.
// **사실이 아니었다** — 의자 · 식탁 · 수건 · 배낭 · 문틀바를 쓴다. 집에 있는 것으로
// 대신하게 해둔 것이지 아무것도 안 쓰는 것이 아니다. 「장비 없이」를 보고 들어온
// 사람이 배낭 파머스 워크 앞에서 멈춘다. **아무도 안 터지고 사람만 멈춘다.**
// 주석은 뺀다 — 「「장비 없이」라고 적으면 안 된다」는 왜 그런지 남긴 기록이다
ok('머리에 「장비 없이」라고 적지 않는다', /장비 없이/.test(codeOf(page)), false);

// 준비물은 **운동 이름에서 뽑는다.** 손으로 적어두면 운동을 갈아끼울 때 한쪽만 고친다
for (const [name, want] of [
  ['코어 강화', []],
  ['유산소 타바타', []],
  // 9/3 부터 여기도 맨몸이다. **준비물이 없다는 것이 이 판의 정체**가 됐다 —
  // 배낭 · 문틀바 쪽은 추천 루틴의 기능성이 맡는다 (그래서 둘이 안 겹친다).
  // 예전 검사는 여기서 「배낭과 문틀바를 쓴다」를 지키고 있었다
  ['기능성(특수부대식)', []],
]) ok(`${name}은 맨몸만 쓴다`, home.gearOf(name), want);

// **이름에 물건이 적혀 있는데 준비물에서 빠지면** 그 프로그램만 「맨몸만」이라고 거짓말한다
const GEAR_WORDS = [['의자', /의자/], ['식탁', /식탁/], ['수건', /수건/], ['배낭', /배낭/]];
const missedGear = [];
for (const n of homeNames) {
  const listed = home.gearOf(n).join(' ');
  for (const [word, re] of GEAR_WORDS) {
    if (home.PROGRAMS[n].some((e) => re.test(e.name)) && !listed.includes(word)) missedGear.push(`${n}/${word}`);
  }
}
ok('이름에 적힌 물건이 준비물에서 빠지지 않는다', missedGear, []);

// 층간소음 — **이름으로 짐작하면 틀린다.** 「스프롤」은 버피처럼 생겼지만 점프가 없어
// 소리가 안 나고(그러라고 넣은 것이다), 「하프 버피」도 점프를 뺀 판이다
ok('스프롤 · 하프 버피를 뛰는 것으로 세지 않는다',
  home.LOUD.filter((n) => /스프롤|하프 버피/.test(n)), []);
ok('전신 초급은 밤에도 그대로 켤 수 있다', home.loudOf('전신 초급'), []);
ok('타바타에서 뛰는 것은 크로스 잭 하나뿐이다', home.loudOf('유산소 타바타'), ['크로스 잭']);
// 뛰는 것이 있는 프로그램은 밤에 어떻게 하라는 말이 설명에 있어야 한다
const noNightNote = homeNames.filter((n) => home.loudOf(n).length > 0
  && !/밤/.test((home.PROGRAM_NOTES[n] || []).join(' ')));
ok('뛰는 것이 있으면 밤에 어떻게 할지 적혀 있다', noNightNote, []);

// 좁히는 단추가 늘 빈 화면을 주면 안 된다
ok('「밤에도 조용한 것」에 남는 것이 있다', homeNames.some((n) => home.loudOf(n).length === 0), true);
ok('「준비물 없는 것」에 남는 것이 있다', homeNames.some((n) => home.gearOf(n).length === 0), true);

// 적어만 두고 화면이 안 그리면 아무도 못 본다. **펼치기 전에** 보여야 한다 —
// 배낭이 없는 사람이 시작하고 세 번째 운동에서 알게 되면 늦다
ok('화면이 준비물과 밤 이야기를 카드에 그린다',
  /gearOf\(/.test(page) && /loudOf\(/.test(page) && /준비물/.test(page), true);
ok('화면에 좁히는 단추 둘이 있다',
  /onlyQuiet/.test(page) && /onlyBare/.test(page), true);
// 좁혀서 아무것도 안 남으면 고장으로 읽힌다 — 되돌릴 길을 같이 준다
ok('아무것도 안 남으면 조건 지우는 길을 준다', /조건 지우기/.test(page), true);
// 홈트는 이어서 하는 물건이다. 지난번에 한 것을 맨 위에 둔다
ok('지난번에 한 것을 적어둔다', /steelbody_home_last/.test(page), true);
ok('열쇠를 앱 이름 따라 안 바꿨다', /blackiron_home/.test(page), false);

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

// ── 화면 이름이 한 이름인가 (2026-09-02, 홈트레이닝 → 기능성운동) ──
//
// **이름은 길찾기 넷에 흩어져 있다** — 더보기 · 홈 바로가기 · 홈 검색 · 고객센터 소개.
// 여기에 화면 제목 · 제보함의 화면 목록 · 자주 묻는 것까지 일곱 자리다.
// 하나만 빠뜨리면 **거기만 옛 이름으로 남는다.** 아무도 안 터진다 —
// 같은 화면이 자리마다 다른 이름으로 불릴 뿐이다 (9/1 에 앱 이름에서 겪었다).
const HOME_NAME = '기능성운동';
const nameSpots = [
  ['화면 제목', 'src/pages/HomeworkoutPage.jsx'],
  ['더보기', 'src/components/TabBar.jsx'],
  ['홈 바로가기', 'src/pages/HomePage.jsx'],
  ['홈 검색', 'src/components/home/HomeSearch.jsx'],
  ['고객센터 소개', 'src/pages/support/introData.js'],
  ['제보함의 화면 목록', 'src/pages/support/reportMeta.js'],
  ['자주 묻는 것', 'src/pages/support/faq.js'],
];
for (const [where, file] of nameSpots) {
  const src = codeOf(fs.readFileSync(file, 'utf-8'));
  ok(`${josa.i(where)} 새 이름을 쓴다`, src.includes(HOME_NAME), true);
}
// 옛 이름이 화면에 남아 있으면 안 된다. **찾는 말(keywords)은 뺀다** —
// 거기 있는 「홈트」는 옛 이름으로도 찾게 하려고 일부러 둔 것이다
const stripKeywords = (src) => src.replace(/keywords: \[[^\]]*\]/g, '');
const oldLeft = nameSpots.filter(([, file]) =>
  /홈트레이닝/.test(stripKeywords(codeOf(fs.readFileSync(file, 'utf-8'))).replace(/옛 홈트레이닝/g, '')));
ok('옛 이름이 화면에 남아 있지 않다', oldLeft.map(([w]) => w), []);
// 루틴의 갈래 「홈트」는 **그대로 둔다** — 추천 루틴을 나누는 말이지 이 화면 이름이 아니다
ok('루틴 갈래는 건드리지 않았다',
  /'홈트'/.test(fs.readFileSync('src/pages/RoutinePage.jsx', 'utf-8')), true);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
