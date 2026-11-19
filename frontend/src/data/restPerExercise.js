// **운동마다 쉬는 시간이 다르다** (2026-11-19 · 시안 1119 ②)
//
// ── 왜 생겼나 ──
//
// 휴식 길이는 **기기에 하나**였다(`REST_KEYS.duration`). 스쿼트에 3분을 맞춰두면
// **컬에서도 3분을 기다린다** — 그래서 사람이 매번 다시 돌리고, 그러느라 자동 시작을 끈다.
//
// ── 어디에 두나 ──
//
// **기기에 둔다**(서버 0줄). 휴식 길이·소리·진동과 같은 결이다 — 「그 기기에서 어떻게
// 쓰는지에 대한 취향이라 사람이 바뀌어도 남긴다」(`localKeys.js` 의 `REST_KEYS` 머리글).
// 열쇠 이름은 **`localKeys.js` 한 곳에** 있다 — 그 파일이 생긴 까닭이 그것이다.
//
// ── ★ 권하지 않는다. 사실만 적는다 ──
//
// 평소 쉬는 시간은 **이미 재고 있다** — 결산의 「늘어졌나」가 기록 사이 간격으로 센다
// (`data/pace.js`). 그 값을 **「3분 쉬세요」로 바꾸면 코치 노릇**이 되고, 그건 11/18 에
// ⑥ 마무리 스트레칭이 반려된 그 선이다. 그래서 이 파일은 **사람이 고른 것만** 담고,
// 평소 값은 화면이 **칸 아래 사실 한 줄**로 둔다.
//
// ── 이름을 어떻게 맞추나 ──
//
// 운동 이름은 자유 입력이다 — 「벤치프레스」 · 「벤치 프레스」 · 「Benchpress」가 다 온다.
// 그래서 `plateMath.js` 가 쓰는 것과 **같은 꼴**로 눕혀 열쇠를 만든다(공백·기호·대소문자를
// 지운다). 사전 별명까지 묶지는 않는다 — 별명은 **검색용이고 이름이 아니다**
// (`exerciseDict.js` 의 선 · 11/03). 「인클라인 벤치프레스」와 「벤치프레스」는 쉬는 시간이
// 다를 수 있으니 **따로 기억하는 쪽이 맞다.**
import { readLS, saveLS } from './safeStorage';
import { REST_PER_EXERCISE_KEY } from './localKeys';

/** 눕힌 이름. `plateMath.js` 의 `flat` 과 **같은 식**이다 (양쪽이 갈리면 열쇠가 안 맞는다) */
const flat = (s) => String(s || '').toLowerCase().replace(/[\s.,!?~·・\-_'"()]/g, '');

/** 고를 수 있는 길이. 휴식 타이머의 테두리(10초~10분) 안이다 */
export const CHOICES = [60, 90, 180, 300];

/** 몇 개까지 기억하나. 운동 이름은 자유 입력이라 **끝없이 늘 수 있다** */
export const MAX_REMEMBERED = 60;

const 읽은표 = () => {
  const raw = readLS(REST_PER_EXERCISE_KEY);
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    // **모양을 믿지 않는다** — 사람이 콘솔로 고칠 수 있고, 옛 판이 다른 모양을 남겼을 수 있다
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      const n = Number(v);
      if (k && Number.isFinite(n) && n > 0) out[k] = Math.round(n);
    }
    return out;
  } catch { return {}; }
};

/**
 * 이 운동에 기억해 둔 쉬는 시간. 없으면 `null` —
 * **부르는 쪽이 기기 기본값으로 떨어진다**(0 을 돌려주면 「0초 휴식」이 된다).
 */
export function 기억한것(name) {
  const key = flat(name);
  if (!key) return null;
  const v = 읽은표()[key];
  return Number.isFinite(v) ? v : null;
}

/**
 * 이 운동에 기억한다. **같은 값을 다시 누르면 잊는다** — 「안 기억하기」 단추를
 * 따로 두지 않는다(여유 횟수 칸이 그렇게 생겼다).
 *
 * @returns 기억한 뒤의 값 (`null` 이면 잊은 것이다)
 */
export function 기억한다(name, sec) {
  const key = flat(name);
  if (!key) return null;
  const 표 = 읽은표();
  const n = Math.round(Number(sec) || 0);
  if (!n || 표[key] === n) {
    delete 표[key];
    saveLS(REST_PER_EXERCISE_KEY, JSON.stringify(표));
    return null;
  }
  // **끝없이 늘지 않게** 가장 오래된 것을 떨어뜨린다. 자유 입력 이름이라 오타마다 한 줄이
  // 쌓이고, 기기 저장은 한 사람 몫이 5MB 쯤이다
  const keys = Object.keys(표);
  if (!(key in 표) && keys.length >= MAX_REMEMBERED) delete 표[keys[0]];
  표[key] = n;
  saveLS(REST_PER_EXERCISE_KEY, JSON.stringify(표));
  return n;
}

/** 기억해 둔 것이 몇 개인가 (설정 화면이 「열두 운동에 기억해 뒀어요」로 적는다) */
export function 기억한수() {
  return Object.keys(읽은표()).length;
}

/** 전부 잊는다 (설정의 「되돌리기」가 부른다) */
export function 다잊는다() {
  saveLS(REST_PER_EXERCISE_KEY, JSON.stringify({}));
}
