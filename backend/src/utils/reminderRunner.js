const db = require('../db');
const push = require('./push');
const { decide, messageOf } = require('./reminderSchedule');

// 운동 알림을 실제로 보내는 쪽.
//
// 1분마다 깨어나 「지금 보낼 사람」이 있는지 본다. 판단은 reminderSchedule 이 하고,
// 여기서는 마지막 운동 날짜를 찾아 넘겨주고 보내는 일만 한다.
//
// **알아둘 것 — Render 무료 요금제는 안 쓰면 잠든다.** 잠든 동안에는 이 타이머도 안 돈다.
// 그래서 정한 시각에 아무도 앱을 안 쓰고 있었다면 그날 알림은 안 나간다.
// 늦게라도 보내지 않는 것은 일부러다 — 밤 11시에 「오늘 운동하는 날이에요」는 도움이 안 된다.

const TICK_MS = 60 * 1000;

let timer = null;

function lastWorkoutDate(userId) {
  const rows = db.getWorkouts(userId) || [];
  let max = null;
  rows.forEach(w => {
    const d = w?.date;
    if (typeof d === 'string' && (!max || d > max)) max = d;
  });
  return max;
}

async function tick(nowMs = Date.now()) {
  let sent = 0;
  const rows = db.getEnabledReminders();
  for (const r of rows) {
    let verdict;
    try {
      verdict = decide(r, nowMs, lastWorkoutDate(r.user_id));
    } catch (err) {
      console.error('[reminder] 판단 실패', err.message);
      continue;
    }
    if (!verdict.send) continue;

    // **보냈다고 먼저 적는다.** 보내기가 오래 걸리는 사이에 다음 tick 이 돌면
    // 같은 사람에게 두 번 간다. 못 보내는 것보다 두 번 보내는 게 나쁘다
    db.markReminderSent(r.user_id, verdict.localDate);

    const msg = messageOf(verdict.reason, verdict.gap);
    const n = await push.sendToUser(r.user_id, { ...msg, url: '/workout', tag: 'workout-reminder' });
    if (n > 0) sent += 1;
  }
  return sent;
}

function start() {
  if (timer) return;
  if (!push.isReady()) {
    console.log('[reminder] VAPID 키가 없어 알림 스케줄러를 띄우지 않습니다');
    return;
  }
  timer = setInterval(() => {
    tick().catch(err => console.error('[reminder] tick 실패', err.message));
  }, TICK_MS);
  // 서버가 이것 때문에 안 꺼지면 안 된다
  if (timer.unref) timer.unref();
  console.log('[reminder] 운동 알림 스케줄러 시작 (1분마다)');
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick, lastWorkoutDate, TICK_MS };
