// 알림을 언제 보낼지 정하는 부분을 한 번에 돌린다.
//
//   npm run check   (backend/)
//
// 이 로직은 바깥과 아무 상관이 없다 — 시간과 설정만 받아서 보낼지 말지를 답한다.
// 그래서 그대로 돌려볼 수 있는데, 그동안은 고칠 때마다 임시 파일을 만들고 지웠다.
//
// 여기서 보는 것은 두 가지다.
//   1. **시간대** — 서버는 UTC 로 돌고 사람은 자기 시간대로 산다. 저녁 7시는 그 사람의 7시다
//   2. **몇 번 보내나** — 한 번 보낼 것을 날마다 보내면 알림 자체를 꺼버린다
const {
  decide, localDateOf, localTimeOf, localDayOf, daysBetween, STREAK_GAP,
} = require('../src/utils/reminderSchedule');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 한국은 UTC 보다 9시간 앞이라 getTimezoneOffset() 이 -540 이다
const KST = -540;
const at = (iso) => new Date(iso).getTime();

console.log('── 시간대 (서버는 UTC, 사람은 자기 시간) ──');
// UTC 로 8/26 22:00 은 한국에서 8/27 07:00 이다 — 날짜도 요일도 넘어간다
ok('UTC 22:00 → 한국 날짜', localDateOf(at('2026-08-26T22:00:00Z'), KST), '2026-08-27');
ok('UTC 22:00 → 한국 시각', localTimeOf(at('2026-08-26T22:00:00Z'), KST), '07:00');
ok('UTC 22:00(수) → 한국 요일(목=4)', localDayOf(at('2026-08-26T22:00:00Z'), KST), 4);
ok('시간대를 안 주면 UTC 그대로', localTimeOf(at('2026-08-27T10:30:00Z'), 0), '10:30');
ok('날 수 세기', daysBetween('2026-08-24', '2026-08-27'), 3);
ok('없는 날짜는 null', daysBetween(null, '2026-08-27'), null);

// 한국 시각 19:00 = UTC 10:00
const SEVEN_PM = '2026-08-27T10:00:00Z';   // 목요일
const base = { enabled: true, time: '19:00', tzOffset: KST, days: [4], streakGuard: false };

console.log('\n── 정한 요일 ──');
ok('그 요일 그 시각이면 보낸다', decide(base, at(SEVEN_PM), '2026-08-20').send, true);
ok('시각이 다르면 안 보낸다', decide(base, at('2026-08-27T09:00:00Z'), '2026-08-20').reason, 'not-time');
ok('요일이 다르면 안 보낸다', decide(base, at('2026-08-28T10:00:00Z'), '2026-08-20').reason, 'not-a-day');
ok('꺼져 있으면 안 보낸다', decide({ ...base, enabled: false }, at(SEVEN_PM), null).reason, 'off');
ok('오늘 이미 운동했으면 안 보낸다', decide(base, at(SEVEN_PM), '2026-08-27').reason, 'done-today');
ok('오늘 이미 보냈으면 안 보낸다',
  decide({ ...base, last_sent_date: '2026-08-27' }, at(SEVEN_PM), '2026-08-20').reason, 'already');

console.log('\n── 오래 쉬었을 때 (한 번만 가야 한다) ──');
// 정한 요일이 아닌 날. 마지막 운동은 8/24 라 8/27 이면 사흘째다
const guard = { ...base, days: [1], streakGuard: true };
ok('사흘 지나면 보낸다', decide(guard, at(SEVEN_PM), '2026-08-24').reason, 'streak');
ok('며칠 쉬었는지 같이 준다', decide(guard, at(SEVEN_PM), '2026-08-24').gap, STREAK_GAP);
ok('이틀은 아직 아니다', decide(guard, at(SEVEN_PM), '2026-08-25').reason, 'not-a-day');
ok('운동한 적이 없으면 안 보낸다', decide(guard, at(SEVEN_PM), null).reason, 'not-a-day');
ok('꺼두면 안 보낸다', decide({ ...guard, streakGuard: false }, at(SEVEN_PM), '2026-08-24').reason, 'not-a-day');

// 여기가 고친 자리다. 예전에는 쉬는 동안 날마다 갔다
const nudged = { ...guard, last_streak_workout: '2026-08-24' };
ok('같은 쉼에 두 번 안 보낸다', decide(nudged, at(SEVEN_PM), '2026-08-24').reason, 'streak-already');
ok('나흘째에도 안 보낸다', decide(nudged, at('2026-08-28T10:00:00Z'), '2026-08-24').reason, 'streak-already');
ok('열흘째에도 안 보낸다', decide(nudged, at('2026-09-03T10:00:00Z'), '2026-08-24').reason, 'streak-already');
// 다시 운동하고 또 사흘 쉬면 그때는 간다
ok('다시 운동한 뒤 또 사흘 쉬면 보낸다',
  decide(nudged, at('2026-09-10T10:00:00Z'), '2026-09-07').reason, 'streak');
ok('보낼 때 어느 쉼인지 적어 보낸다',
  decide(nudged, at('2026-09-10T10:00:00Z'), '2026-09-07').streakFor, '2026-09-07');

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
