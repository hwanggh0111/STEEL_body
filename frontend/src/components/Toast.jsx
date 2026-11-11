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

// ── **마지막에 손을 쓴 것이 자판인가 손가락인가** ── (2026-11-11)
//
// 되돌리기 단추로 **포커스를 옮겨야 하는가**를 가리는 데 쓴다. 옮기는 것이 늘 옳지는
// 않다 — 손가락으로 지운 사람의 포커스를 빼앗으면 적던 자리를 잃는다(지우는 길이
// **적는 화면** 안에 있다). 자판으로 지운 사람은 사정이 거꾸로다: 알림이 DOM 끝에
// 붙어 있어서 **탭으로 거기까지 가는 동안 8초가 지난다.**
//
// 그래서 **자판으로 지웠을 때만** 옮기고, 알림이 닫힐 때 **있던 자리로 돌려준다.**
let lastInput = 'pointer';
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => { lastInput = 'key'; }, true);
  window.addEventListener('pointerdown', () => { lastInput = 'pointer'; }, true);
}

export default function Toast() {
  const [message, setMessage] = useState('');
  const [type, setType] = useState('success');
  const [visible, setVisible] = useState(false);
  const [action, setAction] = useState(null);
  const timerRef = useRef(null);
  const btnRef = useRef(null);
  // 포커스를 옮기기 전에 **어디에 있었는지**를 들고 있는다
  const cameFromRef = useRef(null);

  useEffect(() => {
    const fn = (msg, t = 'success', act = null) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      setType(t);
      setAction(act && typeof act.run === 'function' ? act : null);
      setVisible(true);
      cameFromRef.current = lastInput === 'key' ? document.activeElement : null;
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

  // **자판으로 한 일이면** 되돌리기 단추에 포커스를 준다 (위 머리글)
  useEffect(() => {
    if (!visible || !action || !btnRef.current) return;
    if (!cameFromRef.current) return;
    btnRef.current.focus();
  }, [visible, action]);

  // 알림이 닫힐 때 **있던 자리로 돌려준다** — 안 돌려주면 포커스가 `body` 로 떨어져
  // 다음 탭이 화면 맨 위에서 다시 시작한다
  useEffect(() => {
    if (visible) return;
    const back = cameFromRef.current;
    cameFromRef.current = null;
    if (back && document.contains(back) && typeof back.focus === 'function') back.focus();
  }, [visible]);

  if (!visible) return null;

  // 빨강은 통째로 칠하는 자리라 진한 쪽을 쓴다 — 밝은 --danger 에 흰 글자는 3.4:1 이다
  const bgColor = type === 'error' ? 'var(--danger-strong)' : type === 'warning' ? 'var(--warning)' : 'var(--accent)';
  const textColor = type === 'error' ? '#fff' : 'var(--on-accent)';

  // ── **낭독기에 알림이 아예 안 전해지고 있었다** ── (2026-11-11)
  //
  // 이 자리에 `aria-live` 도 `role` 도 없었다. 알림은 화면에 **그려지기만** 하니,
  // 눈으로 안 보는 사람에게는 「지웠어요」도 「되돌리기」도 전해지지 않았다.
  // 꾸밈이 빠진 것이 아니라 **기능이 통째로 안 닿은 것**이다 — 8초가 지나면 그 줄은
  // 되돌릴 수 없다(`data/undoRow.js` 의 `UNDO_MS`).
  //
  // **되돌리기가 붙은 알림만 `alert`(끼어드는 쪽)다.** 되돌리기는 **시간이 걸린 말**
  // 이라 읽고 있던 것을 끊어도 된다. 그냥 알림(「저장했어요」)은 `status` 로 두어
  // 하던 말이 끝난 뒤에 읽힌다 — 매번 끼어들면 쓰는 사람이 말을 못 듣는다.
  //
  // 글과 단추가 **한 자리 안에** 있어서 「삭제 완료! 되돌리기」로 같이 읽힌다.
  const live = action
    ? { role: 'alert', 'aria-live': 'assertive' }
    : { role: 'status', 'aria-live': 'polite' };

  if (!action) {
    return (
      <div className="toast" {...live} style={{ background: bgColor, color: textColor }}>{message}</div>
    );
  }
  // 단추는 **칠한 바탕 위**에 얹히므로 테두리와 글자를 바탕색(`--on-accent`) 쪽으로
  // 잡는다 — 금 위의 흰 글자는 1.8:1 이다 (`docs/design-system.md`)
  return (
    <div
      className="toast toast-action"
      {...live}
      style={{
        background: bgColor, color: textColor,
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <span>{message}</span>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          setVisible(false);
          try { action.run(); } catch { /* 되돌리기가 터져도 알림은 닫힌다 */ }
        }}
        style={{
          background: 'transparent', border: `1px solid ${textColor}`, color: textColor,
          borderRadius: 'var(--radius)', padding: '7px 13px', fontSize: 12.5,
          fontWeight: 600, cursor: 'pointer', flex: 'none', whiteSpace: 'nowrap',
          fontFamily: 'inherit', letterSpacing: 'inherit',
        }}
      >{action.label}</button>
    </div>
  );
}
