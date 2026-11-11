import { useState, useEffect, useRef } from 'react';

let showToastFn = null;

/**
 * 한 줄 알림.
 *
 * ── `action` 은 **되돌릴 수 있을 때만** 준다 ── (2026-11-11)
 *
 * `{ label, run, ms }` — 알림 옆에 단추가 붙는다. 누르면 `run()` 을 부르고 알림이
 * 닫힌다. **되돌릴 것이 없으면 주지 않는다** — 눌러도 아무 일이 없는 단추는 거짓이다.
 * `ms` 를 주면 그만큼 떠 있는다(되돌리기는 4초보다 길어야 한다 · `data/undoRow.js`).
 */
export function toast(message, type = 'success', action = null) {
  if (showToastFn) showToastFn(message, type, action);
}

export default function Toast() {
  const [message, setMessage] = useState('');
  const [type, setType] = useState('success');
  const [visible, setVisible] = useState(false);
  const [action, setAction] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const fn = (msg, t = 'success', act = null) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      setType(t);
      setAction(act && typeof act.run === 'function' ? act : null);
      setVisible(true);
      timerRef.current = setTimeout(() => setVisible(false), (act && act.ms) || 4000);
    };
    showToastFn = fn;
    return () => {
      // 내가 걸어둔 것일 때만 치운다.
      // 그냥 null 로 밀면, 이 컴포넌트가 두 번 마운트됐다가 하나가 빠질 때
      // 남아 있는 쪽까지 벙어리가 된다 — 알림이 통째로 안 뜬다.
      if (showToastFn === fn) showToastFn = null;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!visible) return null;

  // 빨강은 통째로 칠하는 자리라 진한 쪽을 쓴다 — 밝은 --danger 에 흰 글자는 3.4:1 이다
  const bgColor = type === 'error' ? 'var(--danger-strong)' : type === 'warning' ? 'var(--warning)' : 'var(--accent)';
  const textColor = type === 'error' ? '#fff' : 'var(--on-accent)';

  if (!action) {
    return <div className="toast" style={{ background: bgColor, color: textColor }}>{message}</div>;
  }
  // 단추는 **칠한 바탕 위**에 얹히므로 테두리와 글자를 바탕색(`--on-accent`) 쪽으로
  // 잡는다 — 금 위의 흰 글자는 1.8:1 이다 (`docs/design-system.md`)
  return (
    <div
      className="toast"
      style={{
        background: bgColor, color: textColor,
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          setVisible(false);
          try { action.run(); } catch { /* 되돌리기가 터져도 알림은 닫힌다 */ }
        }}
        style={{
          background: 'transparent', border: `1px solid ${textColor}`, color: textColor,
          borderRadius: 'var(--radius)', padding: '3px 10px', fontSize: 12.5,
          fontWeight: 600, cursor: 'pointer', flex: 'none', whiteSpace: 'nowrap',
        }}
      >{action.label}</button>
    </div>
  );
}
