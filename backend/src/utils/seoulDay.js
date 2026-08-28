// 서울 기준 날짜(YYYY-MM-DD).
//
// 서버는 UTC 로 돈다(Render 도 그렇다). 그런데 이 앱을 보는 사람은 한국에 있다.
// `new Date().toISOString().slice(0,10)` 으로 「오늘」을 만들면 한국 시간
// 자정부터 오전 9시까지가 어제로 밀린다 — 그 사이에 가입한 사람이
// 관리자 화면의 「오늘 가입」에서 빠졌다.
//
// 알림은 사람마다 tzOffset 을 받아 쓴다(utils/reminderSchedule.js).
// 이쪽은 관리자 한 사람이 보는 숫자라 서울로 고정한다.
const KST = 9 * 60 * 60000;

function seoulDay(t) {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + KST).toISOString().slice(0, 10);
}

module.exports = { seoulDay };
