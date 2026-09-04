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

console.log('');
console.log('── 서울 기준 「오늘」 (관리자 화면의 숫자) ──');
// 서버는 UTC 로 돈다. 그대로 자르면 한국 시간 자정~오전 9시가 어제로 밀린다 —
// 그 사이에 가입한 사람이 「오늘 가입」에서 조용히 빠졌다
const { seoulDay } = require('../src/utils/seoulDay');
ok('한국 8/28 새벽 1시는 8/28', seoulDay('2026-08-27T16:00:00.000Z'), '2026-08-28');
ok('한국 8/28 밤 11시도 8/28', seoulDay('2026-08-28T14:00:00.000Z'), '2026-08-28');
ok('한국 8/28 자정 직전은 8/27', seoulDay('2026-08-27T14:59:00.000Z'), '2026-08-27');
ok('UTC 로 자르면 틀린다는 것', '2026-08-27T16:00:00.000Z'.slice(0, 10), '2026-08-27');
ok('없는 값은 빈 문자열', seoulDay(undefined), '');

console.log('\n── 남의 기기 알림을 끌 수 있었다 (2026-09-04) ──');
//
// 화면의 「이 기기 끄기」는 구독 주소를 서버로 보내 그 줄을 지운다. 그런데 지우는
// 갈래가 **주인을 안 봤다** — 주소만 맞으면 지웠다. 구독 주소를 아는 사람은
// 남의 기기 알림을 끌 수 있었고, 알림은 **조용히 안 오는 것**이라 당한 사람은
// 한참 뒤에야 안다.
//
// 주인을 안 보는 갈래(`deletePushSubByEndpoint`)는 **그대로 둔다** — 브라우저가
// 404/410 을 돌려준 죽은 구독을 서버가 스스로 걷는 자리다. 사람이 부르는 길만
// 주인을 보는 갈래로 옮겼다.
//
// 진짜 DB 는 건드리지 않는다 — DB_FILE 로 임시 파일을 가리킨 뒤 지운다.
{
  const fs = require('fs');
  const path = require('path');
  const TMP = path.join(__dirname, '..', '.check-reminder.json');
  for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  process.env.DB_FILE = TMP;
  const db = require('../src/db');

  const A = 1;   // 나
  const B = 2;   // 남
  const mine = 'https://push.example.com/aaa';
  const yours = 'https://push.example.com/bbb';
  db.savePushSub(A, { endpoint: mine, keys: { p256dh: 'x', auth: 'y' } });
  db.savePushSub(B, { endpoint: yours, keys: { p256dh: 'x', auth: 'y' } });

  ok('내 기기는 내가 끌 수 있다', db.deletePushSubOfUser(A, mine).changes, 1);
  ok('  목록에서 빠진다', db.getPushSubs(A).length, 0);

  ok('**남의 기기는 못 끈다**', db.deletePushSubOfUser(A, yours).changes, 0);
  ok('  남의 목록은 그대로다', db.getPushSubs(B).length, 1);

  ok('없는 주소를 지우려 해도 안 터진다', db.deletePushSubOfUser(A, '없는주소').changes, 0);

  // 죽은 구독을 걷는 쪽은 주인을 안 본다. **그래야 맞다** — 서버가 스스로 부른다
  ok('죽은 구독은 주인 없이 걷는다', db.deletePushSubByEndpoint(yours).changes, 1);
  ok('  걷히고 나면 없다', db.getPushSubs(B).length, 0);

  // 사람이 부르는 길이 주인을 보는 갈래를 쓰는가. 여기가 어긋나면 위 검사가 다 통과해도
  // 구멍은 그대로다
  const route = fs.readFileSync(path.join(__dirname, '..', 'src/routes/reminders.js'), 'utf-8');
  ok('화면이 부르는 길은 주인을 본다', /deletePushSubOfUser\(req\.userId/.test(route), true);
  ok('  주인 안 보는 갈래를 안 쓴다', /deletePushSubByEndpoint/.test(route), false);

  for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
