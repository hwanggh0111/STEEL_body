import { useState, useEffect, useRef } from 'react';

let showToastFn = null;

export function toast(message, type = 'success') {
  if (showToastFn) showToastFn(message, type);
}

export default function Toast() {
  const [message, setMessage] = useState('');
  const [type, setType] = useState('success');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const fn = (msg, t = 'success') => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      setType(t);
      setVisible(true);
      timerRef.current = setTimeout(() => setVisible(false), 4000);
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

  const bgColor = type === 'error' ? 'var(--danger)' : type === 'warning' ? 'var(--warning)' : 'var(--accent)';
  const textColor = type === 'error' ? '#fff' : '#000';

  return <div className="toast" style={{ background: bgColor, color: textColor }}>{message}</div>;
}
