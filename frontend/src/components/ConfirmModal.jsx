import { useState, useEffect, useCallback, useRef } from 'react';

let _showConfirm = null;
const _pendingQueue = [];

// 사용: const ok = await confirmDialog('삭제할까요?', { danger: true }); if (ok) { ... }
export function confirmDialog(message, options = {}) {
  return new Promise((resolve) => {
    const item = { message, options, resolve };
    if (_showConfirm) {
      _showConfirm(item);
    } else {
      // 호스트 미마운트 시 큐에 보관 — 마운트되면 바로 처리됨
      _pendingQueue.push(item);
    }
  });
}

export default function ConfirmModalHost() {
  const [state, setState] = useState(null);
  const cancelBtnRef = useRef(null);
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    // 이미 열려 있으면 덮어쓰지 않고 줄을 세운다.
    //
    // 예전에는 그냥 setState(next) 였다. 그러면 앞의 물음이 화면에서 사라지면서
    // 그 promise 가 영영 안 풀린다 — 그것을 기다리던 await 가 그 자리에서 멈춘다.
    const show = (next) => setState(prev => {
      if (prev) { _pendingQueue.push(next); return prev; }
      return next;
    });
    _showConfirm = show;
    // 마운트 직후 큐에 쌓인 요청 처리
    if (_pendingQueue.length > 0) {
      const next = _pendingQueue.shift();
      setState(next);
    }
    // Toast 와 같은 이유로, 내가 걸어둔 것일 때만 치운다
    return () => { if (_showConfirm === show) _showConfirm = null; };
  }, []);

  const close = useCallback((result) => {
    if (state) state.resolve(result);
    // 다음 큐 항목 처리
    if (_pendingQueue.length > 0) {
      setState(_pendingQueue.shift());
    } else {
      setState(null);
    }
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      else if (e.key === 'Enter') close(true);
      else if (e.key === 'Tab') {
        // 단순 포커스 트랩: 확인/취소 두 버튼 사이만 순환
        e.preventDefault();
        const active = document.activeElement;
        if (active === confirmBtnRef.current) cancelBtnRef.current?.focus();
        else confirmBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, close]);

  // 위험 동작이면 취소 버튼에 autoFocus (실수 방지), 아니면 확인 버튼
  useEffect(() => {
    if (!state) return;
    const danger = state.options.danger !== false;
    const target = danger ? cancelBtnRef.current : confirmBtnRef.current;
    target?.focus();
  }, [state]);

  if (!state) return null;
  const { message, options } = state;
  const danger = options.danger !== false;

  return (
    <div
      onClick={() => close(false)}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99998, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          maxWidth: 360,
          width: '100%',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        }}
      >
        {options.title && (
          <h3 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 20, letterSpacing: 2,
            color: 'var(--text-primary)', marginBottom: 10,
          }}>{options.title}</h3>
        )}
        {/* 줄바꿈을 그대로 살린다 — 「무엇을 합니다」와 「그러면 이렇게 됩니다」를
            한 줄로 이어붙이면 두 번째 문장을 안 읽는다 */}
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            ref={cancelBtnRef}
            onClick={() => close(false)}
            style={{
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', padding: '10px 18px',
              fontSize: 13, borderRadius: 'var(--radius)', cursor: 'pointer',
              fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1.5,
            }}
          >{options.cancelText || '취소'}</button>
          <button
            ref={confirmBtnRef}
            onClick={() => close(true)}
            style={{
              background: danger ? 'var(--danger-strong)' : 'var(--accent)',
              border: 'none', color: danger ? '#fff' : 'var(--on-accent)', padding: '10px 18px',
              fontSize: 13, borderRadius: 'var(--radius)', cursor: 'pointer',
              fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1.5, fontWeight: 600,
            }}
          >{options.confirmText || '확인'}</button>
        </div>
      </div>
    </div>
  );
}
