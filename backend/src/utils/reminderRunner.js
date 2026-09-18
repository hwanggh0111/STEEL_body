const db = require('../db');
const push = require('./push');
const { decide, messageOf } = require('./reminderSchedule');
const { coldPartFor } = require('./bodyPart');

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
    // 이 쉼에는 보냈다고 적어둔다. 안 적으면 쉬는 동안 날마다 같은 알림이 간다
    if (verdict.reason === 'streak') db.markStreakNudged(r.user_id, verdict.streakFor);

    // ── 무엇이 식었는지 찾아 싣는다 ── (2026-09-17)
    //
    // **정한 요일 알림에만 붙인다.** 「오래 쉬고 계세요」는 이미 할 말이 분명하고,
    // 거기에 부위까지 얹으면 한 알림이 두 가지를 말한다.
    //
    // 켜두지 않았으면 안 찾는다 — 사람마다 기록 전부를 훑는 일이라 공짜가 아니다.
    // 못 찾으면(고루 하고 있거나 기록이 적으면) null 이고, 그러면 원래 하던 말을 한다
    let cold = null;
    if (verdict.reason === 'scheduled' && r.coldPart !== false) {
      try {
        cold = coldPartFor(db.getWorkouts(r.user_id), verdict.localDate);
      } catch (err) {
        // 부위를 못 찾았다고 알림을 통째로 거르지 않는다 — 원래 하던 말이라도 간다
        console.error('[reminder] 식은 부위를 못 찾음', err.message);
      }
    }

    const msg = messageOf(verdict.reason, verdict.gap, cold);
    // 식은 부위를 말했으면 **몸 지도로 데려간다.** 「등이 식었어요」를 누르면
    // 기록 화면이 열리는 것은 말과 자리가 어긋나는 것이다
    // 부위를 안 말했으면 **새 「운동」 탭**으로 보낸다 (2026-09-18).
    // 여태 `/workout` 으로 보냈는데 그것은 길찾기에서 걷은 옛 화면이다 —
    // 알림을 누른 사람이 탭바에 아무 칸도 안 켜진 화면에 서게 된다
    const url = msg.cold ? '/map' : '/train';
    const n = await push.sendToUser(r.user_id, { ...msg, url, tag: 'workout-reminder' });
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
