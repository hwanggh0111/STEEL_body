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
    showToastFn = (msg, t = 'success') => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      setType(t);
      setVisible(true);
      timerRef.current = setTimeout(() => setVisible(false), 4000);
    };
    return () => { showToastFn = null; };
  }, []);

  if (!visible) return null;

  const bgColor = type === 'error' ? 'var(--danger)' : type === 'warning' ? 'var(--warning)' : 'var(--accent)';
  const textColor = type === 'error' ? '#fff' : '#000';

  return <div className="toast" style={{ background: bgColor, color: textColor }}>{message}</div>;
}
