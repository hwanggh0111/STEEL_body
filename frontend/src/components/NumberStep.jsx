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

import { useHoldRepeat } from '../data/useHoldRepeat';

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
  const bump = (dir) => {
    const now = num(value);
    // 비어 있으면 첫 ＋ 는 정해둔 자리에서 시작한다.
    // **− 는 비어 있을 때 아무 일도 안 한다** — 맨몸보다 가벼운 것은 없다
    if (now === null) {
      if (dir < 0) return false;
      onChange(tidy(startAt ?? step));
      return true;
    }
    const next = now + step * dir;
    if (next < min) {
      if (now === min) return false;        // 이미 바닥이다 — 꾹 누르기를 멈춘다
      onChange(tidy(min));
      return true;
    }
    if (next > max) {
      if (now === max) return false;
      onChange(tidy(max));
      return true;
    }
    onChange(tidy(next));
    return true;
  };

  const minus = useHoldRepeat(() => bump(-1));
  const plus = useHoldRepeat(() => bump(1));

  const btn = {
    flexShrink: 0, width: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--accent-dim)', border: '1px solid var(--border-hover)',
    borderRadius: 'var(--radius)', color: 'var(--accent)',
    fontSize: 19, lineHeight: 1, fontFamily: 'inherit', cursor: 'pointer',
    // 꾹 누르는 동안 글자가 잡히면 파랗게 선택된다
    userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation',
  };

  return (
    <div>
      {label && <label className="label" htmlFor={id}>{label}</label>}
      <div style={{ display: 'flex', gap: 5 }}>
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
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, textAlign: 'center' }}
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
