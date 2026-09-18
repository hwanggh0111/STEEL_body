// 식은 부위 알림 (2026-09-17).
//
//   npm run cold     (npm run check 에도 들어 있다)
//
// **눈으로는 확인할 수 없는 자리다.** 알림은 앱이 닫혀 있을 때, 정한 시각에,
// 푸시 열쇠(VAPID)가 있어야 한 번 나간다 — 한 번 보려면 며칠이 걸린다.
// 그래서 값으로 본다.
//
// ── 두 벌인 것을 맞춰본다 ──
//
// 부위를 알아내는 일은 **화면에도 서버에도** 있다. 화면은 ESM, 서버는 CommonJS 라
// 한 파일로 못 묶는다. 그래서 그래프 색과 같은 방법을 쓴다
// (`chartColors.js`: 같은 값을 손으로 맞춰 두고 검사가 비교한다).
//
// **여기서 양쪽에 같은 운동 이름을 넣어 답을 맞춰본다.** 한쪽에만 낱말을 더하면
// 그 자리에서 걸린다.
const path = require('path');
const fs = require('fs');

const back = require('../src/utils/bodyPart');
const { messageOf } = require('../src/utils/reminderSchedule');

// 화면 쪽 것을 묶어서 불러온다 (ESM → CJS).
//
// **esbuild 를 서버 쪽 의존성으로 더하지 않는다.** 검사 하나 때문에 배포되는 서버의
// 짐을 늘릴 이유가 없다 — 화면 쪽에 이미 있으니 그것을 빌려 쓴다.
// 없으면(화면 쪽 설치 전이면) **맞춰보기만 건너뛴다** — 나머지 검사는 그대로 돈다.
function loadFront() {
  const FRONT = path.join(__dirname, '../../frontend');
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const esbuild = require(path.join(FRONT, 'node_modules/esbuild'));
    const OUT = path.join(__dirname, '..', '.cold.cjs');
    esbuild.buildSync({
      entryPoints: [path.join(FRONT, 'src/data/bodyPart.js')],
      bundle: true, format: 'cjs', outfile: OUT, platform: 'node',
    });
    const mod = require(OUT);
    fs.unlinkSync(OUT);
    return mod;
  } catch (err) {
    console.log('(화면 쪽을 못 불러와 맞춰보기는 건너뜁니다 — ' + err.message.split('\n')[0] + ')');
    return null;
  }
}
const front = loadFront();

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 화면과 서버가 같은 답을 하는가 ──');
const NAMES = [
  '벤치프레스', '인클라인 덤벨프레스', '푸시업', '팔굽혀펴기', '체스트플라이', '펙덱',
  '스쿼트', '레그프레스', '런지', '힙쓰러스트', '카프레이즈', '불가리안 스플릿스쿼트',
  '데드리프트', '랫풀다운', '바벨로우', '풀업', '친업', '시티드로우', '슈퍼맨',
  '숄더프레스', '사이드 레터럴 레이즈', '오버헤드프레스', '슈러그', '업라이트로우', '파이크 푸시업',
  '바이셉컬', '트라이셉 푸시다운', '해머컬', '딥스', '클로즈그립 벤치프레스',
  '플랭크', '크런치', '레그레이즈', '러시안 트위스트', '데드버그', '버피',
  'Bench Press', 'PULL UP', 'lat pulldown', '  스쿼트  ', '요가', '스트레칭', '',
];
if (front) {
  const mismatch = NAMES.filter((n) => back.bodyPartOf(n) !== front.bodyPartOf(n))
    .map((n) => `${n}: 서버=${back.bodyPartOf(n)} 화면=${front.bodyPartOf(n)}`);
  ok(`운동 이름 ${NAMES.length}개가 양쪽에서 같다`, mismatch, []);
}
// 겹치는 말이 있어서 순서가 중요하다 — 몇 개는 답까지 박아둔다
ok('  클로즈그립 벤치프레스는 팔이다', back.bodyPartOf('클로즈그립 벤치프레스'), '팔');
ok('  파이크 푸시업은 어깨다', back.bodyPartOf('파이크 푸시업'), '어깨');
ok('  레그레이즈는 코어다 (어깨의 「레이즈」보다 먼저)', back.bodyPartOf('레그레이즈'), '코어');
ok('  데드버그는 코어다 (등의 「데드」보다 먼저)', back.bodyPartOf('데드버그'), '코어');
ok('  못 맞히면 기타 (억지로 안 밀어 넣는다)', back.bodyPartOf('요가'), '기타');

console.log('');
console.log('── 무엇이 식었나 ──');
const W = (rows) => rows.map(([date, exercise]) => ({ date, exercise }));
const TODAY = '2026-09-24';

// 가슴은 오늘, 하체는 3일 전, 등은 9일 전 → 등이 제일 식었다
const ROWS = W([
  ['2026-09-24', '벤치프레스'],
  ['2026-09-21', '스쿼트'],
  ['2026-09-15', '랫풀다운'],
  ['2026-09-20', '숄더프레스'],
  ['2026-09-22', '바이셉컬'],
  ['2026-09-19', '플랭크'],
]);
const cold = back.coldestPart(ROWS, TODAY);
ok('제일 오래 안 건드린 부위', [cold.part, cold.days], ['등', 9]);
ok('  마지막으로 한 날도 같이 준다', cold.date, '2026-09-15');

// 앞날에 적어둔 것으로 부위가 달아오르면 알림이 거짓말을 한다
ok('앞날 기록은 안 센다',
  back.coldestPart(W([...ROWS.map(r => [r.date, r.exercise]), ['2026-09-30', '랫풀다운']]), TODAY).days, 9);
// 어디를 칠할지 모르는 것을 부위로 세면 안 된다
ok('기타는 부위로 안 센다', back.coldestPart(W([['2026-09-24', '요가']]), TODAY), null);
ok('기록이 없으면 null', back.coldestPart([], TODAY), null);

console.log('');
console.log('── 알림에 실을 만한가 ──');
// 사흘은 쉬는 것이지 식은 것이 아니다
ok('엿새부터 싣는다', back.coldPartFor(W([['2026-09-18', '랫풀다운'], ['2026-09-24', '벤치프레스']]), TODAY).part, '등');
ok('  닷새면 안 싣는다', back.coldPartFor(W([['2026-09-19', '랫풀다운'], ['2026-09-24', '벤치프레스']]), TODAY), null);
// **고루 하고 있는 사람에게 굳이 한 곳을 짚으면 그 말이 틀린 말이 된다**
ok('고루 하고 있으면 안 싣는다', back.coldPartFor(W([
  ['2026-09-24', '벤치프레스'], ['2026-09-23', '랫풀다운'], ['2026-09-22', '스쿼트'],
  ['2026-09-21', '숄더프레스'], ['2026-09-20', '바이셉컬'], ['2026-09-24', '플랭크'],
]), TODAY), null);
// 이제 막 시작한 사람에게 「등을 한 번도 안 했어요」는 나무라는 말이다
ok('한 번도 안 한 부위는 안 싣는다 (가슴만 한 사람)',
  back.coldPartFor(W([['2026-09-24', '벤치프레스']]), TODAY), null);
// **안 하는 부위가 있다고 알림이 영영 안 나가면 안 된다** — 코어·팔을 따로 안 하는
// 사람에게도 12일째 식은 하체는 짚어줘야 한다 (검사가 잡아준 자리다)
ok('안 하는 부위가 있어도 하는 것 중에서 고른다',
  back.coldPartFor(W([['2026-09-24', '벤치프레스'], ['2026-09-12', '스쿼트']]), TODAY).part, '하체');
ok('  며칠인지도 맞다',
  back.coldPartFor(W([['2026-09-24', '벤치프레스'], ['2026-09-12', '스쿼트']]), TODAY).days, 12);
ok('기록이 아예 없어도 안 터진다', back.coldPartFor(null, TODAY), null);

console.log('');
console.log('── 알림에 적히는 말 ──');
const m1 = messageOf('scheduled', null, { part: '등', days: 9 });
ok('식은 부위를 말한다', m1.title, '등이(가) 9일째 식었어요');
// **지어내지 않는다** — 「회복됐어요」는 우리가 모르는 것이다
ok('  회복됐다고 안 한다', /회복/.test(m1.title + m1.body), false);
ok('  어디로 갈지 표시가 붙는다', m1.cold, '등');
// 못 찾으면 원래 하던 말을 한다 — 억지로 부위를 만들지 않는다
ok('못 찾으면 원래 말', messageOf('scheduled', null, null).title, '오늘 운동하는 날이에요');
ok('  그때는 표시가 없다', messageOf('scheduled', null, null).cold, undefined);
// 「오래 쉬고 계세요」는 이미 할 말이 분명하다. 한 알림이 두 가지를 말하면 안 된다
ok('오래 쉰 알림에는 안 붙는다', messageOf('streak', 12, { part: '등', days: 40 }).title, '오래 쉬고 계세요');

console.log('');
console.log('── 화면이 보내는 것을 서버가 받는가 ──');
const route = fs.readFileSync(path.join(__dirname, '../src/routes/reminders.js'), 'utf-8');
ok('설정에 coldPart 가 있다', /coldPart: true/.test(route), true);
ok('  화면이 껐다 켤 수 있다', /body\?\.coldPart === 'boolean'/.test(route), true);
const runner = fs.readFileSync(path.join(__dirname, '../src/utils/reminderRunner.js'), 'utf-8');
// 껐는데도 훑으면 공짜가 아니다 (사람마다 기록 전부를 본다)
ok('꺼두면 안 찾는다', /r\.coldPart !== false/.test(runner), true);
// 「등이 식었어요」를 눌렀는데 기록 화면이 열리면 말과 자리가 어긋난다
ok('식은 부위를 말했으면 몸 지도로 데려간다', /msg\.cold \? '\/map'/.test(runner), true);
// 부위를 안 말했으면 **새 「운동」 탭**이다. `/workout` 은 2026-09-18 에 길찾기에서
// 걷은 옛 화면이라, 알림을 누른 사람이 탭바에 아무 칸도 안 켜진 화면에 서게 된다.
// 확인하는 알림(`POST /reminders/test`)도 같은 자리로 보낸다
const remRoute = fs.readFileSync(path.join(__dirname, '../src/routes/reminders.js'), 'utf-8');
ok('  아니면 새 「운동」 탭으로 데려간다', /: '\/train'/.test(runner), true);
ok('  옛 화면으로 안 보낸다', /'\/workout'/.test(runner) || /'\/workout'/.test(remRoute), false);
ok('  확인 알림도 같은 자리다', /url: '\/train'/.test(remRoute), true);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
