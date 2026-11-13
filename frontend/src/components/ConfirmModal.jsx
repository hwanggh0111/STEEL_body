import { useState, useEffect, useCallback, useRef } from 'react';
import { enterChoice, focusKind } from '../data/askKeys';

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
    if (!state) return;
    // **한 번 닫은 것을 또 닫지 않는다** (2026-11-04).
    //
    // 두 번 닫히면 줄에서 **하나를 더 꺼내 버리고**, 꺼내진 그 물음은 영영 안 풀린다 —
    // 그것을 기다리던 `await` 가 그 자리에서 멎는다. 이 파일이 막으려고 쓴 그 일이다.
    // Enter 는 실제로 두 번 들어올 수 있었다(브라우저가 단추를 누르고 + 우리가 닫고)
    if (state.done) return;
    state.done = true;
    state.resolve(result);
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
      else if (e.key === 'Enter') {
        // ── **Enter 가 지우고 있었다** ── (2026-11-04)
        //
        // 위험한 물음이면 「취소」에 포커스를 주는데(아래 effect — 「실수 방지」),
        // 여기서는 포커스를 안 보고 `close(true)` 였다. 가리려고 둔 포커스가 아무
        // 일도 안 했다. 판단은 `data/askKeys.js` 에 두고 값으로 본다
        const where = focusKind(document.activeElement, confirmBtnRef.current, cancelBtnRef.current);
        const what = enterChoice(where, state.options.danger !== false);
        // 'browser' — 포커스가 우리 단추에 있다. 브라우저가 그것을 누른다(우리는 비킨다)
        if (what === 'confirm') close(true);
        else if (what === 'cancel') close(false);
      }
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
          // ── ★ **긴 알림이 작은 폰에서 잘리고 스크롤도 안 됐다** ── (2026-11-13)
          //
          // 설정 되돌리기 알림은 **541자 · 줄바꿈 19개**다(`SettingsPage.jsx` 의 그 자리 —
          // 「묶음 이름으로 뭉개지 않는다」로 스위치 이름을 다 적은 뒤 그만큼 길어졌다).
          // 14px · 줄높이 1.6 으로 재면 글만 490px, 제목 · 단추 · 여백까지 **670px** 다.
          // 그런데 이 상자에 `maxHeight` 도 `overflow` 도 없었다 — **세로 640 이하 기기
          // (iPhone SE 568 · 375×667)와 가로로 돌린 모든 폰에서 「되돌리기」 단추가 화면
          // 밖**이고, 덮개가 스크롤되지 않으니 **닿을 길이 없다.**
          //
          // `AccountDeleteModal:88` 이 이미 같은 손(`85vh` + `overflowY`)을 쓰고 있었다 —
          // **한 자리만 고쳐져 있었다.** 여기서는 거기서 한 걸음 더 간다: 상자째 스크롤하면
          // 단추도 같이 흘러가 **「확인이 어디 있지」**가 된다. 그래서 **글만 스크롤하고
          // 제목과 단추는 늘 제자리**에 둔다 (아래 `flex` + `minHeight: 0`).
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {options.title && (
          <h3 style={{
            fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif",
            fontSize: 20, letterSpacing: 2,
            color: 'var(--text-primary)', marginBottom: 10,
          }}>{options.title}</h3>
        )}
        {/* 줄바꿈을 그대로 살린다 — 「무엇을 합니다」와 「그러면 이렇게 됩니다」를
            한 줄로 이어붙이면 두 번째 문장을 안 읽는다 */}
        {/* `minHeight: 0` 이 없으면 flex 칸은 **안 줄어든다** — `overflowY` 를 적어둬도
            상자가 글 길이만큼 늘어나 스크롤이 안 생긴다 (flex 기본값이 `min-height:auto`) */}
        <p style={{
          fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6,
          whiteSpace: 'pre-line', overflowY: 'auto', minHeight: 0,
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            ref={cancelBtnRef}
            onClick={() => close(false)}
            style={{
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', padding: '10px 18px',
              fontSize: 13, borderRadius: 'var(--radius)', cursor: 'pointer',
              fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif", letterSpacing: 1.5,
            }}
          >{options.cancelText || '취소'}</button>
          <button
            ref={confirmBtnRef}
            onClick={() => close(true)}
            style={{
              background: danger ? 'var(--danger-strong)' : 'var(--accent)',
              border: 'none', color: danger ? '#fff' : 'var(--on-accent)', padding: '10px 18px',
              fontSize: 13, borderRadius: 'var(--radius)', cursor: 'pointer',
              fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif", letterSpacing: 1.5, fontWeight: 600,
            }}
          >{options.confirmText || '확인'}</button>
        </div>
      </div>
    </div>
  );
}
