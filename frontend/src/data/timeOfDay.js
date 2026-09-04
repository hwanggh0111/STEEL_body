// 시각을 사람이 고르는 모양으로.
//
// 알림 시각은 서버에 `'19:00'` 로 담긴다(24시간). 그런데 **화면에서 그렇게 고르게
// 하면 안 된다** — 「저녁 7시에 알림」이라고 생각하는 사람에게 19 를 찾게 하는 것이고,
// `<input type="time">` 은 브라우저마다 생김새가 다르고 폰에서는 굴림판이 뜬다.
// 「오후 · 7시 · 0분」으로 고르게 한다.
//
// 담는 값(24시간)은 그대로 둔다. 서버 · 스케줄러 · 검사가 전부 그것을 쓴다.
// **바꾸는 것은 고르는 방법뿐이다.**
//
// 이 파일에는 화면이 없다. 값만 받아 값을 돌려준다 — `npm run check` 가 돌려본다.

const pad = (n) => String(n).padStart(2, '0');

export const AM = 'am';
export const PM = 'pm';

/**
 * `'19:00'` → `{ ampm: 'pm', hour12: 7, minute: 0 }`
 *
 * 못 읽는 값이면 null. 부르는 쪽이 기본값을 정한다 — 여기서 몰래 07:00 같은 것을
 * 만들어 돌려주면, 사람이 안 고른 시각이 저장된다.
 */
export function parse24(hhmm) {
  if (typeof hhmm !== 'string') return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const minute = Number(m[2]);
  // **자정과 정오가 함정이다.** 0시는 「오전 12시」고, 12시는 「오후 12시」다.
  // 0 을 12 로 안 바꾸면 화면에 「오전 0시」가 뜬다
  return {
    ampm: h < 12 ? AM : PM,
    hour12: h % 12 === 0 ? 12 : h % 12,
    minute,
  };
}

/**
 * `('pm', 7, 0)` → `'19:00'`
 *
 * 값이 이상하면 null. 이상한 것을 서버로 보내면 서버가 거절하는데, 그때 사람은
 * 자기가 무엇을 잘못했는지 모른다. 여기서 먼저 막는다.
 */
export function to24(ampm, hour12, minute) {
  const h12 = Number(hour12);
  const mm = Number(minute);
  if (!Number.isInteger(h12) || h12 < 1 || h12 > 12) return null;
  if (!Number.isInteger(mm) || mm < 0 || mm > 59) return null;
  if (ampm !== AM && ampm !== PM) return null;
  // 오전 12시 = 0시, 오후 12시 = 12시
  const base = h12 % 12;
  const h = ampm === PM ? base + 12 : base;
  return `${pad(h)}:${pad(mm)}`;
}

/** `'19:00'` → `'오후 7:00'`. 못 읽으면 받은 것을 그대로 돌려준다 */
export function label24(hhmm) {
  const p = parse24(hhmm);
  if (!p) return String(hhmm ?? '');
  return `${p.ampm === AM ? '오전' : '오후'} ${p.hour12}:${pad(p.minute)}`;
}

export const HOURS12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/**
 * 고를 수 있는 분. 5분 단위 열둘.
 *
 * **담겨 있는 값이 목록에 없으면 그것도 넣어준다.** 안 그러면 예전에 19:07 로
 * 정해둔 사람의 화면에서 분이 제멋대로 00 으로 보이고, 아무것도 안 만졌는데
 * 저장하면 시각이 바뀐다.
 */
export function minuteOptions(current) {
  const base = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const m = Number(current);
  if (!Number.isInteger(m) || m < 0 || m > 59 || base.includes(m)) return base;
  return [...base, m].sort((a, b) => a - b);
}
