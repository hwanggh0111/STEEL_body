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

// ── **같은 운동인지 견주는 식은 이 앱에 하나다** ── (2026-11-27)
//
// `data/flatName.js` 가 그 하나다. **기구 세팅만 글자 그대로 견주고 있었다** —
// 「벤치 프레스」로 적어둔 시트 번호가 다음에 「벤치프레스」로 들어가면 **사라졌다.**
// 쉬는 시간과 원판은 그 둘을 한 운동으로 기억하고 있는데 세팅만 없으니, 사람 눈에는
// **안 적어둔 것**으로 보인다. 운동 이름은 홈 · 검색 · 루틴에서 자유 글자로 들어온다.
import { sameName } from './flatName';

/**
 * 같은 운동인가. **세팅을 찾는 자리는 다 이것으로 견준다** (화면 · 스토어 · 베끼기).
 * 서버도 같은 식으로 한 줄을 지킨다(`db.js` 의 `sameExercise`).
 */
// ★ **식을 베끼지 않고 뿌리의 손을 부른다** (2026-11-27 · 정석) — 글자까지 같은
//   식이 두 벌이면 한쪽만 고쳐지는 날이 온다(이 파일 머리글이 경계하는 그 꼴이다).
//   이름은 `sameExercise` 로 둔다 — 서버의 짝(`db.js` 의 같은 이름)과 `check-gymkey`
//   가 그 이름으로 둘을 견준다
export const sameExercise = (a, b) => sameName(a, b);

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

// `summaryOf`(한 줄 요약)는 **걷었다** (2026-10-24) — 부르는 자리가 0 이었다.
// 기구 세팅 화면은 `filledSlots` 로 **칸을 따로따로** 그린다(값만 굵게 하려고).
// 글귀가 두 벌이면 다듬는 날 한쪽만 바뀐다

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
  return (allSettings || []).find((s) => sameExercise(s.exercise, name) && s.gym !== gym) || null;
}

/**
 * 지금 헬스장의 그 운동 세팅. **스토어도 이것을 부른다**(`store/gymStore.js`) —
 * 식이 두 벌이면 한쪽만 고치는 날이 오고, 그러면 카드와 적는 칸이 서로 다른 줄을 본다.
 *
 * 헬스장 이름은 **글자 그대로** 견준다 — 그것은 사람이 붙인 장소 이름이고, 서버가
 * 다듬어 담은 그 글자를 화면이 그대로 들고 있다(`gymStore` 의 「서버가 담은 이름을
 * 쓴다」 머리글). 운동 이름만 눕혀 견준다.
 */
export function settingIn(settings, gym, exercise) {
  const name = String(exercise || '').trim();
  const place = String(gym || '').trim();
  if (!name || !place) return null;
  return (settings || []).find((s) => s?.gym === place && sameExercise(s?.exercise, name)) || null;
}
