// 기구 세팅 — 화면이 쓰는 값들.
//
// 기구 앞에서 **매번 다시 맞춘다.** 시트 몇 번, 발판 몇 칸, 그립 어디.
// 한두 번 틀리게 맞춘 뒤에야 몸이 기억해내고, 그 사이에 세트 한두 개를 버린다.
//
// **헬스장마다 따로다.** 기구가 다르면 시트 번호도 다르다 — 강남점 세팅을 집 앞
// 헬스장에서 그대로 쓰면 틀린 값을 믿고 맞추는 셈이라 아예 없느니만 못하다.
//
// 계산이랄 것은 별로 없지만 **한 곳에 모아둔다** — 카드 · 적는 칸 · 목록 셋이
// 같은 이름과 같은 후보를 써야 한다. 흩어두면 카드는 「그립」인데 적는 칸은 「손잡이」가 된다.

/** 서버가 받는 칸 셋. 기구마다 조절하는 것이 달라 **다 비워둘 수 있다** */
export const SLOTS = [
  { key: 'seat', label: '시트', hint: '등받이 · 좌석 번호' },
  { key: 'foot', label: '발판', hint: '발 받침 칸' },
  { key: 'grip', label: '그립', hint: '손잡이 위치' },
];

/** 숫자 칸에 미리 놓는 후보. 고르면 한 번에 끝난다 — 자판을 안 올린다 */
export const NUMBERS = ['1', '2', '3', '4', '5', '6'];
/** 그립은 숫자가 아니다 */
export const GRIPS = ['넓게', '보통', '좁게', '역'];

/** 한 칸에 들어갈 수 있는 길이. 길어지면 그건 메모지 세팅이 아니다 */
export const SLOT_MAX = 12;
export const NOTE_MAX = 120;
export const GYM_MAX = 20;

/** 적어둔 것이 있나. 네 칸이 다 비면 없는 것이다 */
export function hasSetting(s) {
  return !!s && !!(s.seat || s.foot || s.grip || s.note);
}

/**
 * 카드에 그릴 칸들 — **적은 것만** 준다.
 *
 * 시트만 있는 기구에서 빈 「발판」 칸을 그리면, 적어야 하는데 안 적은 것처럼 보인다.
 */
export function filledSlots(s) {
  if (!s) return [];
  return SLOTS.filter((slot) => s[slot.key]).map((slot) => ({ ...slot, value: s[slot.key] }));
}

/** 목록 한 줄에 적는 한 줄 요약 — 「시트 4 · 발판 2 · 넓게」 */
export function summaryOf(s) {
  const parts = filledSlots(s).map((f) => (f.key === 'grip' ? f.value : `${f.label} ${f.value}`));
  if (parts.length > 0) return parts.join(' · ');
  return s?.note ? '한마디만 적음' : '';
}

/**
 * 보내기 전에 다듬는다.
 *
 * **빈 칸은 `null` 로 보낸다** — 서버에서 `null` 은 「지우라」는 뜻이다.
 * 빈 문자열을 보내면 「안 바꿈」과 구별이 안 되어, 한 번 적은 칸을 비울 길이 없어진다.
 */
export function toPayload(gym, exercise, form) {
  const cut = (v, max) => {
    const t = String(v ?? '').trim().slice(0, max);
    return t === '' ? null : t;
  };
  return {
    gym: cut(gym, GYM_MAX),
    exercise: String(exercise ?? '').trim(),
    seat: cut(form?.seat, SLOT_MAX),
    foot: cut(form?.foot, SLOT_MAX),
    grip: cut(form?.grip, SLOT_MAX),
    note: cut(form?.note, NOTE_MAX),
  };
}

/** 지금 화면에서 고른 헬스장이 받아온 목록에 있나 (없으면 「처음 오는 곳」이다) */
export function isKnownGym(gyms, gym) {
  const name = String(gym || '').trim();
  if (!name) return false;
  return (gyms || []).some((g) => g?.name === name);
}

/**
 * 다른 헬스장에 같은 운동 세팅이 있나 — 「강남점 것 그대로 쓰기」에 쓴다.
 *
 * 처음 오는 곳에서 맨땅부터 적게 하면 대개 안 적는다. 베껴놓고 한 칸만 고치는 쪽이 낫다.
 */
export function copyableFrom(allSettings, gym, exercise) {
  const name = String(exercise || '').trim();
  if (!name) return null;
  return (allSettings || []).find((s) => s.exercise === name && s.gym !== gym) || null;
}
