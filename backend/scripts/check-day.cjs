// 날짜가 말이 되는 범위인가 (2026-09-18).
//
//   npm run day     (npm run check 에도 들어 있다)
//
// 라우트들은 여태 **모양만** 봤다 (`YYYY-MM-DD` · 달에 있는 날인가).
// 그래서 `1900-01-01` 도 `9999-12-31` 도 그대로 들어왔다. 주소로 장난친 것만이
// 아니다 — 날짜 칸은 `max` 를 걸어도 **연도를 직접 칠 수 있다**(2026 대신 1026).
//
// 한 번 들어간 줄은 되돌릴 자리가 마땅치 않다: 1년 벽과 달력이 그 줄을 찾아 옛날로
// 내려가고, 이어온 주는 **첫 기록의 주부터** 세는데 그 첫 기록이 1900년이 된다.
//
// 값으로 보는 검사다 — `utils/dayRange.js` 하나를 라우트 넷이 같이 쓴다.
const d = require('../src/utils/dayRange');
const fs = require('fs');
const path = require('path');

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

console.log('── 모양과 달력 ──');
ok('있는 날', d.isRealDate('2026-09-18'), true);
ok('  달에 없는 날은 안 받는다', d.isRealDate('2026-02-30'), false);
ok('  모양이 아니면 안 받는다', [d.isRealDate('20260918'), d.isRealDate('2026-9-1')], [false, false]);
ok('  글자가 아니어도 안 터진다', [d.isRealDate(null), d.isRealDate(20260918), d.isRealDate({})], [false, false, false]);

console.log('');
console.log('── 기록으로 받을 날 (운동 · 인바디 · 측정) ──');
ok('오늘', d.isRecordDay(day(0)), true);
ok('  어제 것을 오늘 적는 길은 열어둔다', d.isRecordDay(day(-1)), true);
// 지난 것은 넓게 받는다 — 옛 기록을 옮겨 적는 사람이 있다
ok('  10년 전도 받는다', d.isRecordDay(day(-3650)), true);
ok('  2000년 이전은 안 받는다', [d.isRecordDay('2000-01-01'), d.isRecordDay('1999-12-31')], [true, false]);
// 서버의 오늘과 사람의 오늘이 다를 수 있다 (시차 · 자정 무렵) — 하루만 넉넉하게
ok('앞날은 하루만 준다 (시차)', [d.isRecordDay(day(1)), d.isRecordDay(day(2))], [true, false]);
ok('  먼 앞날은 안 받는다', d.isRecordDay('9999-12-31'), false);

console.log('');
console.log('── 계획으로 받을 날 (달력의 「할 것」) ──');
// 계획은 앞날이 제자리다. 그래도 테두리는 있다
ok('내년도 담을 수 있다', d.isPlanDay(day(365)), true);
ok('  2년 넘게 앞은 안 받는다', [d.isPlanDay(day(730)), d.isPlanDay(day(740))], [true, false]);
ok('  9999년은 안 받는다', d.isPlanDay('9999-12-31'), false);
ok('  지난 날도 담을 수 있다 (어제 계획을 지우려면 보여야 한다)', d.isPlanDay(day(-3)), true);

console.log('');
console.log('── 라우트 넷이 그것을 쓰는가 ──');
// **한 곳에 둔다.** 라우트마다 손으로 적으면 한 곳만 고쳐지는 날이 온다
const read = (f) => fs.readFileSync(path.join(__dirname, '../src/routes/' + f), 'utf-8');
for (const [f, fn] of [['workouts.js', 'isRecordDay'], ['inbody.js', 'isRecordDay'],
                       ['measures.js', 'isRecordDay'], ['plans.js', 'isPlanDay']]) {
  const src = read(f);
  ok(`${f} 가 ${fn} 을 쓴다`, new RegExp(`${fn}\\(`).test(src) && /require\('\.\.\/utils\/dayRange'\)/.test(src), true);
}
// 모양만 보던 옛 검사가 남아 있으면 그쪽으로 빠져나간다
ok('측정은 모양만 보던 옛 검사를 안 쓴다',
  /\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(date\) \|\| isNaN/.test(read('measures.js')), false);

console.log('');
console.log('── 서버가 「오늘」을 만들 때 UTC 를 쓰지 않는가 ── (2026-09-19)');
//
// 서버는 UTC 로 돈다(Render 도 그렇다). `new Date().toISOString().slice(0,10)` 으로
// 오늘을 만들면 **한국 새벽 0~9시가 어제로 밀린다.** 9/19 에 두 자리가 그랬다 —
//
//   · 목표 시작일(`goals.js`) — 그 어제가 지난 주면 「이어온 주」를 지난 주부터 세고,
//     그 주엔 운동이 없으니 **목표를 세우는 순간 끊긴 것으로 보인다**
//   · 인바디 대체 날짜(`inbody.js`) — 체중 그래프의 점이 하루 왼쪽에 찍힌다
//
// `utils/seoulDay.js` 가 이 일을 하려고 있던 함수인데, 관리자 화면에서만 쓰고 있었다.
const { seoulDay } = require('../src/utils/seoulDay');

// 한국 새벽 세 시 — UTC 로는 아직 어제다. 여기서 갈린다
const dawnKST = Date.parse('2026-09-20T03:00:00+09:00');
ok('한국 새벽 3시의 「오늘」', seoulDay(dawnKST), '2026-09-20');
ok('  UTC 로 만들면 어제가 된다 (그래서 안 쓴다)', new Date(dawnKST).toISOString().slice(0, 10), '2026-09-19');
ok('한국 밤 11시의 「오늘」', seoulDay(Date.parse('2026-09-20T23:00:00+09:00')), '2026-09-20');
ok('한국 자정 직후의 「오늘」', seoulDay(Date.parse('2026-09-20T00:00:30+09:00')), '2026-09-20');
ok('한국 자정 직전은 어제다', seoulDay(Date.parse('2026-09-19T23:59:30+09:00')), '2026-09-19');

// 두 자리가 그 함수를 쓰는가
ok('목표 시작일이 서울 기준이다', /out\.started_at = seoulDay\(/.test(read('goals.js')), true);
ok('인바디 대체 날짜도 서울 기준이다', /seoulDay\(Date\.now\(\)\)/.test(read('inbody.js')), true);

// 코드에도 남지 않게 본다 — 라우트에서 UTC 로 오늘을 만드는 자리가 다시 생기면 잡는다.
// `new Date().toISOString()` 을 통째로 쓰는 것(시각)은 괜찮다 — **날짜만 자르는 것**이 문제다
const utcToday = [];
for (const f of fs.readdirSync(path.join(__dirname, '../src/routes'))) {
  if (!f.endsWith('.js')) continue;
  if (/new Date\(\)\.toISOString\(\)\s*\.(slice\(0,\s*10\)|split\('T'\)\[0\])/.test(read(f))) utcToday.push(f);
}
ok('라우트에서 UTC 로 오늘을 만드는 자리', utcToday, []);

console.log('');
console.log(bad ? bad + '건 실패' : '전부 통과');
process.exit(bad ? 1 : 0);
