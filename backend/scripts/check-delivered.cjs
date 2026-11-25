// ── 마지막으로 **나간** 알림 ── (2026-11-25 · 벼림, 시안 1125 ② · 근호 검사)
//
//   npm run delivered   (backend/)
//
// `last_sent_date` 는 「보내려 한 날」이다(보내기 **전에** 적는다). 그 날짜를 화면에
// 「보냈다」로 보이면 서버가 못 보낸 날도 폰 탓으로 읽힌다. 그래서 한 대 이상
// **나간 뒤에만** `last_delivered_date` 를 적는다. 여기서 보는 것:
//
//   1. 나가면 적는다 · 기기 0대 / 전부 실패(n = 0)면 **안 적는다**
//   2. 적는 줄이 「보내기 전」 자리로 옮겨가면 **운다** (되돌려-FAIL 은 아래 `--되돌려`)
//   3. 사람이 PUT 으로 그 날짜를 적어 넣지 못한다 (`clean()` 이 받지 않는다)
//   4. 시험 알림(`POST /test`)은 이 날짜를 안 바꾼다
//   5. 화면은 날짜를 **이 기기 달력의 그 날**로 푼다 — UTC 자정으로 풀지 않는다
//
// 진짜 `tick()` 을 돌린다 — 손으로 흉내 낸 흐름을 보면 흐름이 바뀌는 날 자만 모른다.
// db 와 push 는 **같은 모듈 객체**의 함수만 잠깐 갈아 끼운다(파일 DB 는 안 건드린다).
const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const RUNNER = path.join(__dirname, '../src/utils/reminderRunner.js');
const REVERT = process.argv.includes('--되돌려');

// `--되돌려`: 적는 줄을 「보내기 전」 자리로 옮긴 판을 임시로 만들어 돌린다 → FAIL 이 보여야 한다
let runnerPath = RUNNER;
if (REVERT) {
  const src = fs.readFileSync(RUNNER, 'utf-8');
  const moved = src
    .replace(/\n\s*db\.markReminderDelivered\(r\.user_id, verdict\.localDate\);/, '')
    .replace(/db\.markReminderSent\(r\.user_id, verdict\.localDate\);/,
      'db.markReminderSent(r.user_id, verdict.localDate); db.markReminderDelivered(r.user_id, verdict.localDate);');
  runnerPath = path.join(path.dirname(RUNNER), '.reminderRunner.revert.cjs');
  fs.writeFileSync(runnerPath, moved);
  process.on('exit', () => { try { fs.unlinkSync(runnerPath); } catch { /* 이미 없다 */ } });
  console.log('── 되돌려: 적는 줄을 「보내기 전」으로 옮겼다 — 아래에 FAIL 이 있어야 한다 ──');
}

const db = require('../src/db');
const push = require('../src/utils/push');
const runner = require(runnerPath);

// 정한 시각 바로 그때 — 한국 8/27(목) 19:00 = UTC 10:00
const KST = -540;
const NOW = Date.parse('2026-08-27T10:00:00Z');
const row = () => ({
  user_id: 'u-delivered', enabled: true, days: [0, 1, 2, 3, 4, 5, 6], time: '19:00',
  tzOffset: KST, streakGuard: false, coldPart: false,
});

async function run(n) {
  const r = row();
  const marks = { sent: null, delivered: null };
  const keep = {
    getEnabledReminders: db.getEnabledReminders, getWorkouts: db.getWorkouts,
    markReminderSent: db.markReminderSent, markReminderDelivered: db.markReminderDelivered,
    markStreakNudged: db.markStreakNudged, sendToUser: push.sendToUser,
  };
  db.getEnabledReminders = () => [r];
  db.getWorkouts = () => [];
  db.markReminderSent = (_u, d) => { marks.sent = d; };
  db.markReminderDelivered = (_u, d) => { marks.delivered = d; };
  db.markStreakNudged = () => {};
  push.sendToUser = async () => n;
  try {
    await runner.tick(NOW);
  } finally {
    Object.assign(db, {
      getEnabledReminders: keep.getEnabledReminders, getWorkouts: keep.getWorkouts,
      markReminderSent: keep.markReminderSent, markReminderDelivered: keep.markReminderDelivered,
      markStreakNudged: keep.markStreakNudged,
    });
    push.sendToUser = keep.sendToUser;
  }
  return marks;
}

(async () => {
  console.log('── 나간 날은 나간 뒤에만 ──');
  const one = await run(1);
  ok('한 대라도 나가면 그 사람 날짜를 적는다', one.delivered, '2026-08-27');
  ok('  보내려 한 날도 그대로 적는다(두 번 안 가게)', one.sent, '2026-08-27');
  const zero = await run(0);
  ok('기기 0대 · 전부 실패면 나간 날을 안 적는다', zero.delivered, null);
  ok('  보내려 한 날은 그래도 적힌다 — 그래서 칸이 둘이다', zero.sent, '2026-08-27');

  console.log('── 사람이 적어 넣지 못한다 · 시험 알림은 안 바꾼다 ──');
  const routeSrc = fs.readFileSync(path.join(__dirname, '../src/routes/reminders.js'), 'utf-8');
  const cleanSrc = (routeSrc.match(/function clean\(body\) \{[\s\S]*?\n\}/) || [''])[0];
  ok('clean() 을 찾았다', cleanSrc.length > 0, true);
  ok('  clean() 이 나간 날을 받지 않는다', /last_delivered/.test(cleanSrc), false);
  const testSrc = (routeSrc.match(/router\.post\('\/test'[\s\S]*?\n\}\);/) || [''])[0];
  ok('시험 알림 길을 찾았다', testSrc.length > 0, true);
  ok('  시험 알림은 나간 날을 안 바꾼다', /markReminderDelivered|last_delivered/.test(testSrc), false);

  console.log('── 화면이 날짜를 푸는 법 ──');
  // 화면 파일을 통째로 띄울 수 없어서, 푸는 함수 둘을 **값으로** 떼어 돌린다(원본을 그 자리에서 읽는다)
  const page = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/RemindersPage.jsx'), 'utf-8');
  const wk = (page.match(/const WEEKDAY = (\[[^\]]+\]);/) || [])[1];
  const fn = (page.match(/function deliveredLabel\(date\) \{[\s\S]*?\n\}/) || [])[0];
  ok('화면의 날짜 풀기를 찾았다', !!(wk && fn), true);
  // eslint-disable-next-line no-new-func
  const label = (wk && fn) ? new Function(`const WEEKDAY = ${wk}; ${fn}; return deliveredLabel;`)() : () => 'x';
  ok('그 날의 요일로 적는다 (11/23 은 월요일)', label('2026-11-23'), '11월 23일 (월)');
  ok('  다음 날은 화요일', label('2026-11-24'), '11월 24일 (화)');
  ok('  없는 날은 안 그린다', label('2026-02-31'), null);
  ok('  모양이 아니면 안 그린다', label('2026-11-24T00:00:00Z'), null);
  ok('  칸이 없으면 안 그린다', label(undefined), null);
  ok('UTC 자정으로 풀지 않는다', /new Date\(\s*date\s*\)|new Date\(m\[0\]\)/.test(fn || ''), false);
  ok('「이 폰」이라고 단정하지 않는다', /한 대 이상/.test(page) && !/이 폰에 (안 )?왔/.test(page), true);

  console.log(bad === 0 ? '모두 통과' : bad + '곳 어긋남');
  process.exit(bad === 0 ? 0 : 1);
})();
