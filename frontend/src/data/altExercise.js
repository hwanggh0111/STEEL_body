// **내 짐에 없는 것 — 같은 부위로 바꿔 준다** (2026-11-19 · 시안 1119 ③)
//
// ── 왜 생겼나 ──
//
// 기구 쪽에 있는 것은 **조절값**뿐이었다 — 시트 · 발판 · 그립(`data/gymSetting.js`).
// **「그 짐에 무엇이 없나」는 아무 데도 없었다.** 그래서 루틴에 적어둔 레그 익스텐션이
// 그 헬스장에 없으면, 그 자리에서 폰으로 「허벅지 앞 운동」을 검색한다.
//
// ── ★ 코치 노릇을 안 한다 ──
//
// 「같은 부위 · 당신 짐에 없다고 적지 않은 것」만 **늘어놓는다.** 고르는 것은 사람이다.
// **횟수 · 무게 · 몇 세트는 말하지 않는다** — 11/18 에 ⑥ 마무리 스트레칭이 반려된 그
// 선이다(「어느 것을 몇 초 하라는 것은 코치 노릇이고 다치는 자리다」).
//
// ── 새 자료를 만들지 않는다 ──
//
// 부위 · 기구는 **사전**(`exerciseDict.js` 의 `part` · `gear`)에서 읽고, 차례는 **그 사람의
// 기록**에서 많이 한 순으로 받는다(`liftTrend.liftNames` — 통계가 쓰는 그 손이다).
// 셈을 새로 만들면 두 벌이 되고, 두 벌이 되면 한쪽만 고쳐지는 날이 온다.
//
// ── 「없다」는 **짐마다 다르고 기기에 둔다** ──
//
// 강남점에 레그 익스텐션이 없다는 것은 **그 헬스장 이야기**다. 바 무게(`barKg`)를 기기에
// 두는 것과 **같은 까닭**이다 — 「그 헬스장에 어떤 바가 있나」라서 기기의 것으로 뒀다
// (`localKeys.js:100`). 서버 칸을 늘리지 않는다.
import { readLS, saveLS } from './safeStorage';
import { GYM_MISSING_KEY } from './localKeys';
import { EXERCISE_DICT, partOf } from './exerciseDict';
import { liftNames } from './liftTrend';

// 눕히는 식은 **한 자리에서 온다** (2026-11-19 · 정석 2차)
import { flatName as flat } from './flatName';

/** 한 짐에 몇 개까지 적어 두나. 끝없이 늘지 않게 */
export const MAX_MISSING = 80;

/** 몇 개를 보여주나. 열 줄이 넘으면 **고르는 것이 일**이 된다 */
export const SHOW = 5;

const 표읽기 = () => {
  const raw = readLS(GYM_MISSING_KEY);
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    const out = {};
    // **모양을 믿지 않는다** — 옛 판이 다른 모양을 남겼을 수 있고 사람이 콘솔로 고칠 수 있다
    for (const [gym, list] of Object.entries(o)) {
      if (Array.isArray(list)) out[gym] = list.filter((x) => typeof x === 'string' && x.trim());
    }
    return out;
  } catch { return {}; }
};

/** 이 짐에 없다고 적어둔 것들 (적은 그대로의 이름) */
export function 없는것(gym) {
  const key = String(gym || '').trim();
  if (!key) return [];
  return 표읽기()[key] || [];
}

/** 이 짐에 이 운동이 없다고 적혀 있나 */
export function 없다고적혔나(gym, name) {
  const f = flat(name);
  if (!f) return false;
  return 없는것(gym).some((x) => flat(x) === f);
}

/**
 * 없다고 적는다. **같은 것을 다시 부르면 지운다**(있게 됐다는 뜻이다) —
 * 「다시 생겼어요」 단추를 따로 두지 않는다.
 *
 * @returns 적힌 뒤의 상태 (`true` 면 없는 것으로 적혔다)
 */
export function 없다고적는다(gym, name) {
  const key = String(gym || '').trim();
  const 이름 = String(name || '').trim();
  if (!key || !이름) return false;
  const 표 = 표읽기();
  const list = 표[key] || [];
  const f = flat(이름);
  const 있던자리 = list.findIndex((x) => flat(x) === f);
  if (있던자리 >= 0) list.splice(있던자리, 1);
  else if (list.length < MAX_MISSING) list.push(이름);
  표[key] = list;
  saveLS(GYM_MISSING_KEY, JSON.stringify(표));
  return 있던자리 < 0;
}

/**
 * 이 운동을 못 할 때 **같은 부위로 할 수 있는 것들.**
 *
 * @param name     지금 하려던 운동
 * @param gym      지금 있는 곳 (없다고 적어둔 것을 거른다)
 * @param workouts 내 기록 (많이 한 순으로 세운다) — 없으면 사전 차례 그대로
 * @param today    오늘 (앞날 기록을 셈에서 뺀다 · 앱이 쓰는 그 자리에서 받는다)
 *
 * @returns [{ 이름, 부위, 기구 }] — **빈 배열이면 화면은 아무것도 안 그린다**
 */
export function 대체후보(name, { gym = '', workouts = null, today = null } = {}) {
  const 부위 = partOf(name);
  // 부위를 모르는 이름(사람이 지어 적은 것)에는 **아무것도 권하지 않는다** —
  // 모르면서 비슷한 것을 내놓으면 그게 지어내는 것이다
  if (!부위) return [];
  const 나 = flat(name);
  const 많이한순 = workouts ? liftNames(workouts, today, 60, { metric: 'any' }) : [];
  const 순위 = new Map(많이한순.map((x, i) => [flat(typeof x === 'string' ? x : x?.name), i]));

  return EXERCISE_DICT
    .filter((e) => e.part === 부위)
    .filter((e) => flat(e.ko) !== 나)
    // **없다고 적어둔 것은 뺀다** — 이 기능의 전부가 그것이다
    .filter((e) => !없다고적혔나(gym, e.ko))
    .sort((a, b) => {
      const ra = 순위.has(flat(a.ko)) ? 순위.get(flat(a.ko)) : Infinity;
      const rb = 순위.has(flat(b.ko)) ? 순위.get(flat(b.ko)) : Infinity;
      if (ra !== rb) return ra - rb;          // 내가 많이 한 것이 위
      return a.ko.localeCompare(b.ko, 'ko');  // 그 뒤는 이름 차례 (판마다 바뀌지 않게)
    })
    .slice(0, SHOW)
    .map((e) => ({
      이름: e.ko,
      부위: e.part,
      // ── ★ **`none` 은 「덤벨 · 머신」이 아니다** ── (2026-11-19 · 정석 2차)
      //
      // 바로 위 줄이 「사전이 비워 둔 것은 **모름**이다 · **지어내서 적지 않는다**」라고
      // 적어두고, 식은 `none` 을 **「덤벨 · 머신」으로 단정**하고 있었다. 사전의 `gear` 는
      // 두 가지뿐이다(`bar` 28개 · `none` 182개) — `none` 은 「바가 아니다」일 뿐이고
      // 그 안에 **맨몸이 잔뜩** 있다: 푸시업 · 풀업 · 핸드스탠드 푸시업 · 플로어프레스 ….
      //
      // 그래서 **이 화면이 거짓을 말했다.** 「짐에 없는 것을 피하려고」 쓰는 자리인데
      // 맨몸 운동에 「덤벨 · 머신」이라고 적으면, 덤벨이 없는 사람은 **할 수 있는 것을
      // 거른다** — 기능의 뜻과 반대로 돈다.
      //
      // 적을 수 있는 것만 적는다 — `bar` 만 「바벨」이고 나머지는 **안 적는다**(모름).
      // 사전이 기구를 더 잘게 나누는 날(`dumbbell` · `machine` · `body`) 그때 늘린다.
      기구: e.gear === 'bar' ? '바벨' : '',
    }));
}
