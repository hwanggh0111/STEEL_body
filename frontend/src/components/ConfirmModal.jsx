import { useState, useEffect, useCallback, useRef } from 'react';
import { enterChoice, focusKind } from '../data/askKeys';
import { useScrollLock } from '../data/useModalFocus';
import { LAYER } from '../data/layers';

let _showConfirm = null;
let _dismissConfirm = null;
const _pendingQueue = [];

// ── ★ **잠금이 뜨면 떠 있던 물음을 거둔다** ── (2026-11-17 · 정석)
//
// `AppLock` 이 부른다. 층을 올려 잠금이 확인창을 **덮게** 했지만, 덮은 창은
// **사라진 것이 아니다** — 포커스가 그 안에 남고 낭독기는 그것을 읽는다. 그리고
// 그 창에는 기록이 적혀 있다(`"{메모 앞머리}" 메모를 지울까요`). 잠금이 가리려는
// 것이 그것이므로 **닫는다.**
//
// 잠금이 **제가 띄운** 것(`options.잠금위`)은 남긴다 — 「네 자리를 잊으셨나요」다.
// 줄에 서 있던 것도 **취소로 풀어준다**: 안 풀면 그것을 기다리는 `await` 가 영영
// 멎고(이 파일이 막으려고 쓴 그 일이다), 풀지 않고 두면 잠금을 푼 뒤 **묻지도
// 않은 물음이 갑자기** 뜬다. 잠금이 걸릴 만큼 손을 놓았으면 **취소가 맞는 답**이다.
export function dismissConfirm() { if (_dismissConfirm) _dismissConfirm(); }

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
    // ── ★ **마운트 직후 처리가 줄을 지키지 않았다** ── (2026-11-26 · 정석, 근호 11/25 의심 목록)
    //
    // 여태 `setState(next)` 였다 — 바로 위에서 「덮어쓰지 않고 줄을 세운다」로 고친
    // 그 자리를 **이 두 줄이 비껴갔다.** 물음이 떠 있는 채로 이 손이 또 돌면
    // (개발의 StrictMode 는 effect 를 두 번 돌리고, 운영에서도 **줄에 둘 이상 쌓인
    // 채 다시 마운트**되면 같은 일이 난다) 앞 물음이 화면에서 사라지고
    // **그 promise 가 영영 안 풀린다** — 그것을 기다리던 `await` 가 그 자리에서 멈춘다
    // (지우기 확인 · 나가기 확인이 거기 걸려 있다).
    //
    // **같은 `show` 를 쓴다.** 이미 떠 있으면 그 손이 줄에 되돌려 놓는다 — 잃는 줄이 없다
    if (_pendingQueue.length > 0) {
      const next = _pendingQueue.shift();
      show(next);
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

  // 떠 있는 동안 **뒤 화면이 안 밀리게** 한다 (2026-11-16 · 맵시).
  // 자판 규칙은 이 파일이 이미 제 것을 가지고 있다(Enter 가 무엇을 누를지까지 본다)
  // — 그래서 `useModalFocus` 가 아니라 가둠만 가져온다
  useScrollLock(!!state);

  // 바깥(`AppLock`)이 거둘 수 있게 걸어둔다 — 위 `dismissConfirm` 머리글 참고.
  // `state` 가 바뀔 때마다 다시 거는 것은 그 값을 보고 가려야 하기 때문이다
  useEffect(() => {
    const 거두기 = () => {
      const 풀기 = (it) => { if (it && !it.done) { it.done = true; it.resolve(false); } };
      if (state && !state.options?.잠금위) 풀기(state);
      // 줄에 선 것은 잠금 것만 남긴다
      const 남길것 = [];
      while (_pendingQueue.length) {
        const it = _pendingQueue.shift();
        if (it.options?.잠금위) 남길것.push(it); else 풀기(it);
      }
      _pendingQueue.push(...남길것);
      setState((prev) => {
        if (prev && prev.options?.잠금위) return prev;      // 잠금 것은 그대로
        return _pendingQueue.length ? _pendingQueue.shift() : null;
      });
    };
    _dismissConfirm = 거두기;
    return () => { if (_dismissConfirm === 거두기) _dismissConfirm = null; };
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      // ── **Esc 한 번에 아래 층까지 닫혔다** ── (2026-11-24 · 정석 2차)
      //
      // 11/23 이 같은 꼴을 `AccountSheet`(사진 메뉴) · `Layout`(띄운 사진 ↔ 서랍)에서
      // 고쳤는데, **앱에서 가장 많이 쓰는 확인창**이 남아 있었다. 서랍 → 계정 시트 →
      // 「프로필 사진을 삭제할까요?」(`Layout:503`)에서 Esc 를 누르면 확인창만이 아니라
      // **서랍까지 같이 닫혔다** — 묻는 말에 답하려다 자리를 잃는다.
      //
      // `stopPropagation` 만으로는 늦다. 아래 층들은 `document` 에서 듣고, 거품
      // 차례에서는 `document` 가 `window` 보다 **먼저** 온다(11/23 에 `AccountSheet` 가
      // 밟은 그 자리). 그래서 **잡는 차례(capture)로 듣고** 거기서 멈춘다
      if (e.key === 'Escape') { e.stopPropagation(); close(false); }
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
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
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
        // 잠금이 띄운 물음만 잠금 위다 — 나머지는 잠금이 덮는다 (`data/layers.js`)
        zIndex: state.options?.잠금위 ? LAYER.잠금확인창 : LAYER.확인창, padding: 16,
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
          /* 폰 주소창이 접히면 `100vh` 가 화면보다 커서 **덮개 밑이 잘린다**
             (`globals.css` 의 `.page-wrapper` 가 적어둔 그 규칙이다 · 2026-11-16).
             **인라인 꼴에는 두 줄 되돌림을 적을 수 없다** — 한 칸에 한 값이다.
             `dvh` 를 모르는 브라우저는 이 줄을 버려 높이 제한이 아예 없어지는데,
             그쪽은 2022년 이전 판이고 지금 잘리는 쪽은 **쓰는 사람의 폰 전부**다 */
          maxHeight: 'calc(100dvh - 32px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {options.title && (
          <h3 style={{
            fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif",
            fontSize: 18, letterSpacing: 2,
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
              border: 'none', color: danger ? 'var(--on-danger)' : 'var(--on-accent)', padding: '10px 18px',
              fontSize: 13, borderRadius: 'var(--radius)', cursor: 'pointer',
              fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif", letterSpacing: 1.5, fontWeight: 600,
            }}
          >{options.confirmText || '확인'}</button>
        </div>
      </div>
    </div>
  );
}
