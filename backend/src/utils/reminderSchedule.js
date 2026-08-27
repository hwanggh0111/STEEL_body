// 운동 알림 — 언제 보낼지 정하는 부분.
//
// 보내는 일(웹 푸시)과 갈라 뒀다. 이쪽은 바깥과 아무 상관이 없어서 그대로 돌려볼 수 있다.
//
// **시간대가 이 파일의 전부다.** 서버는 Render 에서 UTC 로 돈다. 사람은 자기 시간대로 산다.
// 저녁 7시에 보내라는 말은 **그 사람의** 저녁 7시다. 그래서 설정에 그 사람의
// UTC 차이(분)를 같이 담아두고, 보낼 때마다 그걸로 현지 시각을 만들어 본다.

// tzOffset 은 브라우저의 `new Date().getTimezoneOffset()` 값이다.
// 한국은 -540 (UTC 보다 9시간 앞).

/** 그 사람의 현지 시각. Date 객체지만 UTC 게터로 읽어야 한다. */
function localOf(nowMs, tzOffset) {
  return new Date(nowMs - (Number(tzOffset) || 0) * 60000);
}

function pad(n) { return String(n).padStart(2, '0'); }

/** 현지 기준 'YYYY-MM-DD'. */
function localDateOf(nowMs, tzOffset) {
  const d = localOf(nowMs, tzOffset);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 현지 기준 'HH:MM'. */
function localTimeOf(nowMs, tzOffset) {
  const d = localOf(nowMs, tzOffset);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** 현지 기준 요일 (0=일 … 6=토). 앱의 다른 곳과 같은 기준이다. */
function localDayOf(nowMs, tzOffset) {
  return localOf(nowMs, tzOffset).getUTCDay();
}

/** 'YYYY-MM-DD' 두 개 사이의 날 수. */
function daysBetween(a, b) {
  if (!a || !b) return null;
  const ms = new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : null;
}

const STREAK_GAP = 3;   // 마지막 운동에서 사흘이 지나면 한 번 알린다

/**
 * 지금 이 사람에게 보낼까.
 *
 * @param reminder   { enabled, days:[0..6], time:'HH:MM', tzOffset, streakGuard, last_sent_date }
 * @param nowMs      Date.now()
 * @param lastWorkoutDate 마지막으로 운동한 날 'YYYY-MM-DD' (없으면 null)
 * @returns { send, reason, localDate, gap }
 *          reason 은 'scheduled'(정한 요일) 또는 'streak'(오래 쉼)
 */
function decide(reminder, nowMs, lastWorkoutDate) {
  const localDate = localDateOf(nowMs, reminder?.tzOffset);
  const no = (why) => ({ send: false, reason: why, localDate, gap: null });

  if (!reminder?.enabled) return no('off');

  // 같은 날 두 번 보내지 않는다
  if (reminder.last_sent_date === localDate) return no('already');

  // 1분마다 보므로 분까지 맞아야 한다. 서버가 한 번 못 돌면 그날은 건너뛴다 —
  // 몇 시간 늦게 「오늘 운동하는 날이에요」가 오는 것보다 안 오는 게 낫다
  if (localTimeOf(nowMs, reminder.tzOffset) !== reminder.time) return no('not-time');

  const day = localDayOf(nowMs, reminder.tzOffset);
  const days = Array.isArray(reminder.days) ? reminder.days : [];
  const gap = daysBetween(lastWorkoutDate, localDate);

  // 정한 요일이면 보낸다. 단, 그날 이미 운동했으면 안 보낸다 —
  // 다 하고 나서 「오늘 운동하는 날이에요」는 도움이 안 된다
  if (days.includes(day)) {
    if (gap === 0) return no('done-today');
    return { send: true, reason: 'scheduled', localDate, gap };
  }

  // 정한 요일이 아니어도, 오래 쉬었으면 한 번 알린다.
  //
  // **정말 한 번이어야 한다.** 예전에는 `gap >= 3` 만 보고 보냈다. 그러면 쉬는 동안
  // 정한 요일이 아닌 날마다 — 날마다 — 「오래 쉬고 계세요」가 갔다. 앱을 접은 사람은
  // 영영 그 알림을 받는다. 그건 알림이 아니라 잔소리고, 알림 자체를 꺼버리게 만든다.
  //
  // 보낼 때 **그때의 마지막 운동 날짜**를 적어둔다. 같은 날짜면 이미 보낸 쉼이다.
  // 다시 운동하면 날짜가 바뀌므로, 또 사흘을 쉬면 그때 한 번 더 간다.
  if (reminder.streakGuard && gap !== null && gap >= STREAK_GAP) {
    if (reminder.last_streak_workout === lastWorkoutDate) return no('streak-already');
    return { send: true, reason: 'streak', localDate, gap, streakFor: lastWorkoutDate };
  }

  return no('not-a-day');
}

/** 알림에 실을 말. */
function messageOf(reason, gap) {
  if (reason === 'streak') {
    return {
      title: '오래 쉬고 계세요',
      body: `마지막 운동에서 ${gap}일이 지났어요. 한 세트라도 괜찮습니다.`,
    };
  }
  return {
    title: '오늘 운동하는 날이에요',
    body: '기록까지 남기면 이번 주 한 칸이 채워집니다.',
  };
}

module.exports = {
  decide, messageOf,
  localDateOf, localTimeOf, localDayOf, daysBetween,
  STREAK_GAP,
};
