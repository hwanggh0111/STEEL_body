// 숫자를 **자판 없이** 넣는 칸 (2026-10-15)
//
// ── 왜 ──
//
// 세트를 적을 때 칸을 누르면 자판이 올라오고, 그것이 **화면 아래 1/3** 을 먹는다 —
// 저장 단추 · 원판 안내 · 아래 탭바가 그 뒤로 들어간다. 숫자 하나 바꾸려고
// `누르고 → 지우고 → 치고 → 내린다` 를 세트마다 한다.
//
// ± 를 붙이면 한 번에 끝난다. **칸은 그대로 둔다** — 이상한 값(0.5kg 단위, 세 자리
// 횟수)을 적어야 할 때가 있고, 그때는 눌러서 치면 된다. 자판을 **막는 게 아니라
// 안 부르게** 하는 것이다.
//
// ── 값은 글자로 다룬다 ──
//
// 부르는 쪽(TrainPage)이 무게를 **글자**로 들고 있다. `''`(맨몸) · `'80'` · `'82.5'`.
// 숫자로 바꿔 돌려주면 `''` 가 `0` 이 되어 **「맨몸」이 「0kg」으로 바뀐다** —
// 그 둘은 다른 말이다. 그래서 들어온 모양 그대로 글자로 돌려준다.

import { useRef } from 'react';
import { useHoldRepeat } from '../data/useHoldRepeat';

// ── **이 칸이 제 바닥을 스스로 알린다** ── (2026-11-19 · 맵시)
//
// 11/19 에 좁은 폰에서 **적어둔 무게가 안 보이는 것**을 잡았다. 칸 셋이 나란히 서면
// 320px 폰에서 무게 칸이 89px 이고, 그중 **86px 을 ± 와 여백이 먼저 가져간다** —
// 글이 들어갈 자리가 **2.7px** 이었다(360 에서 18.1 · 390 에서 29.7 · 430 에서 45.1).
// 「100.5」가 드는 데 33.4px 이 드니 **430 아래 전부**에서 숫자가 잘렸다.
//
// 뿌리는 ± 가 아니다 — 320 에서 단추를 28 로 깎고 여백을 0 으로 해도 25.5px 라
// 「100.5」가 안 든다. **깎기는 390 만 겨우 살리는 임시방편**이고(11/18 에 42→36 이
// 그것이었다) 글자를 150% 로 쓰면 다시 무너진다. 길은 **자리가 모자라면 줄을
// 쪼개는 것**이고, 그러려면 쓰는 쪽이 **한 칸의 바닥**을 알아야 한다.
//
// 그 바닥을 **여기서 센다.** 부르는 쪽에 `88` 같은 수를 적게 두면, ± 단추 폭을
// 바꾸는 날 그 수만 옛 값으로 남는다(11/17 의 「규칙을 베껴 적지 않고 읽는다」).
// 글자 자리는 `ch` 로 둔다 — **브라우저가 그 글꼴의 `0` 폭으로 재는 단위**라
// 짐작한 px 가 없고, 폰에서 글자를 150% 로 쓰면 바닥도 같이 자란다.
const BTN_W = 36;    // ± 단추 폭. 11/18 에 42 에서 내렸다
const GAP = 4;       // 단추와 칸 사이
const PAD_X = 2;     // 칸 좌우 여백 — `.input` 의 14 를 인라인으로 덮어 글 자리로 돌린다
const BORDER = 2;    // 칸 좌우 테두리 1+1 (`box-sizing: border-box`)

/** ± 와 여백이 먼저 가져가는 폭. 글은 이것을 뺀 나머지에 든다 */
export const STEP_CHROME = BTN_W * 2 + GAP * 2 + PAD_X * 2 + BORDER;

/**
 * **글자 `chars` 자가 드는 칸의 바닥.** `flexBasis` 에 그대로 넣는다 —
 * 자리가 이보다 좁아지면 flex 가 줄을 바꾼다 (폭을 숫자로 가르지 않는다).
 *
 *   stepFloor(5)  → 「100.5」가 드는 바닥
 */
export const stepFloor = (chars) => `calc(${chars}ch + ${STEP_CHROME}px)`;

/** ± 가 없는 맨 칸(`.input`)의 바닥 — 좌우 여백 14+14 와 테두리만 뺀다 */
export const plainFloor = (chars) => `calc(${chars}ch + ${14 * 2 + BORDER}px)`;

/**
 * **몇 자가 드는 칸인가** — 자릿수도 **상한에서 센다.**
 *
 * `stepFloor(5)` 처럼 손으로 적으면 상한을 올리는 날(횟수 1000 → 10000) 바닥만 옛
 * 수로 남는다. 그래서 `data/limits.js` 의 그 상한을 넣는다 —
 *
 *   담을자릿수(WEIGHT_KG_MAX, 1) → 999 세 자 + 소수점 + 한 자리 = 5  (「999.5」)
 *   담을자릿수(REPS_MAX)         → 1000 네 자                      = 4  (「1000」)
 *
 * @param {number} max   그 칸이 받는 가장 큰 값 (`data/limits.js`)
 * @param {number} [소수] 소수 자리 수 — 2.5·0.5 단위면 1
 */
export const 담을자릿수 = (max, 소수 = 0) => String(max).length + (소수 ? 1 + 소수 : 0);

/** 글자 → 수. 비었거나 이상하면 null (0 과 구별해야 한다) */
function num(v) {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 1.25 + 2.5 = 3.75 같은 자리에서 0.1 이 붙는 것을 막는다 */
function tidy(n) {
  return String(Number(n.toFixed(2)));
}

export default function NumberStep({
  id,
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  /** 비었을 때 ＋ 를 누르면 여기서 시작한다 (무게는 `step`, 횟수는 1) */
  startAt,
  /** 칸 안에 흐리게 적을 말 (무게 칸의 「맨몸」) */
  placeholder,
  inputMode = 'decimal',
}) {
  // ── 꾹 누르는 동안은 **방금 올린 값**을 봐야 한다 ──
  //
  // props 를 그대로 보면 안 된다. 꾹 누르면 간격이 40ms 까지 짧아지는데 React 는
  // state 를 **다음 그림에서** 반영한다 — 아직 안 그려졌으면 같은 값을 다시 읽어
  // **올라가다 멈춘 것처럼** 보인다.
  //
  // 그래서 올린 값을 여기 적어두고 이어서 센다. 다만 **새로 누를 때마다 바깥 값을
  // 다시 읽는다**(`isRepeat` 가 false 인 순간) — 그 사이에 지난 기록 미리 채우기 ·
  // 드롭세트 · 직접 치기로 값이 바뀌었을 수 있고, 그때는 그쪽이 맞다.
  // 「바깥 값이 내가 적어둔 것과 다르면 바깥을 따른다」로 했다가, 연달아 두 번
  // 누르면 **첫 번째 그림이 도착할 때 둘째가 지워지는** 자리를 만들었다.
  const mine = useRef(null);
  const set = (v) => { mine.current = v; onChange(v); };

  const bump = (dir, isRepeat) => {
    const base = isRepeat && mine.current !== null ? mine.current : value;
    const now = num(base);
    // 비어 있으면 첫 ＋ 는 정해둔 자리에서 시작한다.
    // **− 는 비어 있을 때 아무 일도 안 한다** — 맨몸보다 가벼운 것은 없다
    if (now === null) {
      if (dir < 0) return false;
      set(tidy(startAt ?? step));
      return true;
    }
    const next = now + step * dir;
    if (next < min) {
      if (now === min) return false;        // 이미 바닥이다 — 꾹 누르기를 멈춘다
      set(tidy(min));
      return true;
    }
    if (next > max) {
      if (now === max) return false;
      set(tidy(max));
      return true;
    }
    set(tidy(next));
    return true;
  };

  const minus = useHoldRepeat((isRepeat) => bump(-1, isRepeat));
  const plus = useHoldRepeat((isRepeat) => bump(1, isRepeat));

  const btn = {
    // 폭은 위의 `BTN_W` 다 (2026-11-18 · 정석 → 2026-11-19 · 맵시가 상수로 끌어올림).
    // 42 일 때 390px 폰의 기록 화면에서 칸 셋이 나란하면 무게 칸 글 자리가 **0px** 이
    // 됐다 — 72.5 를 넣어도 빈 칸으로 보였다. 높이는 폰에서 전역 규칙이 44 로 키운다
    flexShrink: 0, width: BTN_W, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--accent-dim)', border: '1px solid var(--border-hover)',
    borderRadius: 'var(--radius)', color: 'var(--accent)',
    fontSize: 19, lineHeight: 1, fontFamily: 'inherit', cursor: 'pointer',
    // 꾹 누르는 동안 글자가 잡히면 파랗게 선택된다
    userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation',
  };

  return (
    <div>
      {label && <label className="label" htmlFor={id}>{label}</label>}
      <div style={{ display: 'flex', gap: GAP }}>
        <button
          type="button"
          aria-label={`${label || ''} ${step} 줄이기`}
          style={btn}
          {...minus}
        >−</button>
        <input
          id={id}
          className="input"
          inputMode={inputMode}
          value={value}
          // 직접 치면 적어둔 값은 버린다 — 사람이 친 것이 맞다
          onChange={(e) => { mine.current = null; onChange(e.target.value); }}
          placeholder={placeholder}
          // 가운데 맞춘 숫자 칸이라 옆 여백(`.input` 의 14)이 할 일이 없다 — 글 자리로 돌린다
          style={{ flex: 1, minWidth: 0, textAlign: 'center', paddingLeft: PAD_X, paddingRight: PAD_X }}
        />
        <button
          type="button"
          aria-label={`${label || ''} ${step} 늘리기`}
          style={btn}
          {...plus}
        >＋</button>
      </div>
    </div>
  );
}
