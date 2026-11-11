// 날짜 키는 반드시 로컬 기준으로 만든다.
//
// toISOString() 은 UTC 로 바꾼 뒤 자르기 때문에 KST(+9)에서는 새벽 0시~8시 59분 사이에
// 하루 전 날짜가 나온다. 기록은 WorkoutPage 가 로컬 날짜로 저장하는데 홈이 UTC 로 조회하면,
// 새벽에 남긴 운동이 홈에서 사라지고 주간 표도 하루씩 밀린다.
//
// 같은 헬퍼가 여러 곳에 따로 있었다. 새로 쓰는 곳은 여기를 쓴다.
export function dateKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ── 시각을 **그 사람의 시계로** 적는다 (2026-10-27) ──
//
// 위와 **같은 함정**이다. 서버가 보내는 시각은 `new Date().toISOString()` —
// 끝에 `Z` 가 붙은 UTC 다. 그것을 글자로 잘라 쓰면(`iso.substring(11, 19)`)
// 한국에서는 **아홉 시간 전**이 화면에 적힌다.
//
// 실제로 그랬다 — 관리자의 「최근 보안 로그」가 방금 일어난 일을 오전 9시로 적고
// 있었고(저녁 6시였다), 같은 줄을 그리는 다른 관리자 화면(`AiAdminPanel`)은
// 맞게 적고 있었다. **두 화면이 같은 시각을 아홉 시간 다르게 말했다.**
//
// 그래서 여기 둔다 — 「같은 헬퍼가 여러 곳에 따로 있었다」는 위의 말과 같은 자리다.
// 깨진 값 · 없는 값은 `-` 다. **지어내지 않는다** (0 이나 지금으로 때우면 더 나쁘다).

const pad2 = (n) => String(n).padStart(2, '0');

/** 시:분:초. 로그 한 줄 앞에 붙이는 자리 — 날짜는 목록이 이미 말한다 */
export function clockOf(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '-';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/**
 * **서버가 보낸 한 시각의 날짜** (2026-10-27).
 *
 * 서버가 적는 시각은 `new Date().toISOString()` — UTC 다. 그것을 글자로 열 자 자르면
 * (`iso.slice(0, 10)`) 한국에서는 **자정부터 오전 9시까지가 하루 전**이 된다.
 * 서버에도 같은 일을 하는 자리가 있다(`backend/src/utils/seoulDay.js`) — 거기
 * 적혀 있는 까닭이 그것이다: 「그 사이에 가입한 사람이 관리자 화면의 『오늘 가입』에서
 * 빠졌다」.
 *
 * 앱 곳곳이 그 글자 자르기를 쓰고 있었다 — 제보가 어제로 묶이고, 정지 만료일과
 * 계정 삭제 마감일이 하루 빠르게 적히고, 내보내는 사진에 전날 날짜가 박혔다.
 *
 * **이미 날짜뿐인 글자는 그대로 돌려준다**(`'2026-10-27'`). 그것을 `Date` 로 읽으면
 * UTC 자정으로 보고, 한국보다 뒤진 시간대에서는 또 하루가 밀린다 — 날짜는 날짜로 둔다.
 */
export function dayOf(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (!v || Number.isNaN(d.getTime())) return '';
  return dateKey(d);
}

// ── **「2026년 11월 11일 수요일」을 적는 손** ── (2026-11-11)
//
// 홈 머리와 점검 예고 화면이 **각자** `toLocaleDateString('ko-KR', …)` 를 들고 있었다.
// 홈 쪽은 거기에 `new Date()` 를 바로 먹여서 두 가지가 어긋났다 —
//
//   1. **켜둔 채 밤을 넘기면 어제가 적혀 있다.** 아래 주간 달력과 「오늘」 카드는
//      `useToday` 를 보고 날이 바뀌면 따라가는데, **머리의 날짜만 안 따라갔다** —
//      같은 화면 위아래가 다른 날을 말한다 (`useToday` 머리글이 적어둔 그 자리다).
//   2. **시간대가 다른 데서는 하루가 밀린다.** 이 파일의 `dateKey` 는 그 사람의
//      로컬 날짜인데, 머리는 기기 시계를 또 따로 읽었다.
//
// 그래서 **날짜 키를 받아** 적는다 — 세는 자리와 적는 자리가 같은 날을 본다.
// 날짜뿐인 글자를 `new Date('2026-11-11')` 로 읽으면 UTC 자정이라 한국보다 뒤진
// 시간대에서 또 하루가 밀린다. **셋으로 쪼개 로컬 자정으로 만든다.**
const KO_LONG = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };

/**
 * 날짜 키(`2026-11-11`) → 「2026년 11월 11일 수요일」. 못 읽으면 받은 것을 그대로.
 *
 * ── **없는 날짜를 그럴듯한 날로 바꾸지 않는다** ── (2026-11-11, 정석)
 *
 * 꼴만 보고 통과시키면 `2026-13-40` 이 `new Date(2026, 12, 40)` 으로 **넘쳐서**
 * 「2027년 2월 9일 화요일」이 된다. 「못 읽으면 그대로」라고 적어두고 **가장 그럴듯한
 * 거짓말**을 하는 셈이다 — 이 앱에서 날짜는 곁가지가 아니라 뜻 그 자체다.
 * 여기로 합치기 전의 `MaintAdmin` 손은 `'T00:00:00'` 을 붙여 읽어서 그런 값에
 * **Invalid Date** 가 났고, 그래서 받은 글자를 그대로 보여줬다 — 그 성질을 지킨다.
 *
 * 그래서 **되짚어 본다** — 만든 날을 다시 키로 적어 받은 것과 같은지 본다.
 * 넘친 날짜는 키가 달라지므로 거기서 걸린다 (`2026-02-30` → `2026-03-02`).
 */
export function longDayOf(key) {
  const s = String(key || '');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime()) || dateKey(d) !== s) return s;
  return d.toLocaleDateString('ko-KR', KO_LONG);
}

/** 날짜와 시각. 「언제 검사했나」처럼 **날짜가 뜻이 있는** 자리에 쓴다 */
export function stampOf(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '-';
  return `${dateKey(d)} ${clockOf(iso)}`;
}

// ── **오늘까지만 센다** ── (2026-11-09)
//
// 「앞날 줄」을 세면 수가 부푼다. 서버는 날짜를 **하루 넉넉하게** 받고(시차 · 자정
// 무렵) 달력의 「적기」는 앞날을 막지 않으므로, **내일 날짜 줄이 실제로 들어온다.**
//
// 이 손을 여기 두는 까닭은 이 파일 머리글에 이미 적혀 있다 — 「같은 헬퍼가 여러
// 곳에 따로 있었다. 새로 쓰는 곳은 여기를 쓴다.」 지금 같은 일을 하는 자리가
// **세 벌**이다(`inbodyLatest.js` 의 `upto` · `weeklyReport.js` 의 `upto` ·
// `yearWall.js`). 전부 모듈 안에 숨어 있어서 넷째가 또 생긴다 — 그래서 새 것은
// 여기에 둔다.
//
// **목록은 이것으로 거르지 않는다.** 잘못 적은 앞날 줄을 사람이 찾아 고칠 자리가
// 목록뿐이다(11/05 에 정한 선). 거르는 것은 **세는 자리**다.
export function upToToday(keys, today) {
  if (!Array.isArray(keys)) return [];
  return today ? keys.filter((k) => typeof k === 'string' && k <= today) : keys;
}
