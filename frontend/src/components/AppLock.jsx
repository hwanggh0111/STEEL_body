import { useEffect, useRef, useState } from 'react';
import { useLockStore } from '../store/lockStore';
import { useAuthStore } from '../store/authStore';
import { LogoMark } from './Logo';
import { PIN_LEN, MAX_TRIES } from '../data/appLock';
import { confirmDialog } from './ConfirmModal';

// 잠금 화면.
//
// **껍데기 밖에서 통째로 덮는다** — 탭바도 머리도 가려야 한다. 반쯤 가리면 그 틈으로
// 오늘 한 운동과 몸 사진 미리보기가 보인다.
//
// ── 자판을 직접 그린다 ──
//
// `<input type="number">` 를 쓰면 폰마다 다른 자판이 올라오고, 그 자판에는 붙여넣기 ·
// 자동완성 · 「완료」가 같이 온다. 네 자리를 치는 데 필요한 것은 숫자 열과 지우기뿐이다.
// 손가락 자리는 이 앱의 규칙대로 44px 을 넘긴다.
//
// ── 잊었을 때 ──
//
// **로그아웃으로 푼다.** 이건 기기의 가림막이지 서버 자물쇠가 아니다 — 로그아웃은
// 잠금이 가리려던 것(내 기록)을 이 기기에서 통째로 치우는 일이라, 그걸 할 수 있는
// 사람에게 잠금은 이미 뜻이 없다. 대신 **잠금 자체는 남긴다** — 기기의 것이다.

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '←'];

export default function AppLock() {
  const locked = useLockStore((s) => s.locked);
  const enabled = useLockStore((s) => s.enabled);
  const tryUnlock = useLockStore((s) => s.tryUnlock);
  const markHidden = useLockStore((s) => s.markHidden);
  const maybeLock = useLockStore((s) => s.maybeLock);
  const cooldown = useLockStore((s) => s.cooldown);
  const triesLeft = useLockStore((s) => s.triesLeft);
  const logout = useAuthStore((s) => s.logout);
  const loggedIn = useAuthStore((s) => s.isLoggedIn);
  const release = useLockStore((s) => s.release);

  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [left, setLeft] = useState(0);
  const busy = useRef(false);
  const boxRef = useRef(null);

  // 화면을 벗어났다 돌아오는 것을 본다. **`pagehide` 도 같이 듣는다** —
  // 폰에서는 앱을 밀어 없앨 때 `visibilitychange` 가 안 오는 경우가 있다
  useEffect(() => {
    const onHide = () => markHidden();
    const onVisible = () => {
      if (document.visibilityState === 'hidden') markHidden();
      else maybeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onHide);
    return () => {
      // **걷어내는 것을 빠뜨리면 화면을 옮길 때마다 하나씩 쌓인다** — 그러면
      // 돌아올 때마다 `maybeLock` 이 여러 번 돌고, 다음에 걸 잠금까지 미리 잠근다
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onHide);
    };
  }, [markHidden, maybeLock]);

  // 쉬는 시간이 남았으면 1초마다 줄여 보여준다 — 「왜 안 되지」로 두지 않는다
  useEffect(() => {
    if (!locked) return undefined;
    const tick = () => setLeft(cooldown());
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [locked, cooldown]);

  // 자판이 없는 자리(PC)를 위해 키보드도 받는다.
  //
  // ── 탭이 뒤로 새지 않게 한다 ── (2026-09-18)
  //
  // 이 화면은 위를 덮을 뿐이라 **뒤의 것들은 그대로 있다** — 탭을 누르면 초점이
  // 가려진 화면의 단추로 넘어가고, 거기서 엔터를 치면 **잠긴 앱이 일을 한다**
  // (게다가 읽어주는 도구는 가려진 글을 그대로 읽는다). 그래서 탭을 이 안에서 돌린다.
  useEffect(() => {
    if (!locked) return undefined;
    const onKey = (e) => {
      if (e.key === 'Tab') {
        const box = boxRef.current;
        if (!box) return;
        const able = [...box.querySelectorAll('button:not([disabled])')];
        if (able.length === 0) return;
        const first = able[0];
        const last = able[able.length - 1];
        const on = document.activeElement;
        // 이 안에 없거나 끝에 닿았으면 반대쪽으로 돌린다
        if (!box.contains(on)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
        if (!e.shiftKey && on === last) { e.preventDefault(); first.focus(); return; }
        if (e.shiftKey && on === first) { e.preventDefault(); last.focus(); }
        return;
      }
      if (e.key >= '0' && e.key <= '9') push(e.key);
      else if (e.key === 'Backspace') push('←');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, pin, left]);

  // 덮은 동안 뒤가 안 밀리게. **되돌리는 것을 빠뜨리면 풀고 나서도 화면이 안 내려간다**
  useEffect(() => {
    if (!locked || !enabled) return undefined;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    boxRef.current?.focus();
    return () => { document.body.style.overflow = before; };
  }, [locked, enabled]);

  // **로그인 화면은 안 덮는다.** 덮으면 나갈 길이 막힌다 —
  // 잊었을 때 푸는 길이 로그아웃인데, 로그아웃하면 이 화면이 로그인 화면을 덮고
  // 그 위에서는 아무것도 할 수 없다. 잠금이 가리려는 것은 **들어와 있는 사람의
  // 기록**이고, 로그인 전에는 가릴 것이 없다
  if (!enabled || !locked || !loggedIn) return null;

  async function push(k) {
    if (busy.current || left > 0) return;
    if (k === '←') { setPin((p) => p.slice(0, -1)); return; }
    if (!/^\d$/.test(k)) return;
    const next = (pin + k).slice(0, PIN_LEN);
    setPin(next);
    if (next.length < PIN_LEN) return;

    // **다 치면 저절로 맞춰본다** — 네 자리를 치고 「확인」을 또 누르게 하지 않는다
    busy.current = true;
    const ok = await tryUnlock(next);
    busy.current = false;
    if (ok) { setPin(''); return; }
    // 틀리면 흔들고 비운다. 무엇이 틀렸는지는 안 적는다(적을 것이 없다)
    setShake(true);
    setTimeout(() => setShake(false), 420);
    setPin('');
    setLeft(cooldown());
  }

  const forgot = async () => {
    const yes = await confirmDialog(
      `네 자리를 잊으셨으면 로그아웃으로 풉니다.

이 기기에서 기록을 치우고 로그인 화면으로 갑니다. 서버의 기록은 그대로이니
다시 로그인하시면 전부 돌아옵니다. 잠금은 그대로 걸려 있습니다.`,
      { title: '네 자리를 잊으셨나요', confirmText: '로그아웃', danger: true },
    );
    if (yes) {
      // **잠금도 같이 놓는다** — 안 놓으면 다시 로그인한 뒤에도 잠긴 채로 열려서,
      // 네 자리를 잊은 사람이 또 같은 자리에 선다. 잠금 자체(건 것)는 그대로 남는다
      release();
      logout();
    }
  };

  const secs = Math.ceil(left / 1000);

  return (
    <div
      ref={boxRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="앱 잠금"
      style={{
        outline: 'none',
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'var(--bg-primary)',
        backgroundImage: 'var(--bg-glow)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 26, padding: 24,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <LogoMark size={34} />
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
          {left > 0 ? `${secs}초 뒤에 다시 치실 수 있어요` : '네 자리를 쳐주세요'}
        </div>
      </div>

      {/* 친 만큼 점이 찬다. 숫자를 그대로 보여주지 않는다 — 어깨 너머가 있다 */}
      <div style={{
        display: 'flex', gap: 14,
        animation: shake ? 'lockShake 0.4s' : 'none',
      }}>
        {Array.from({ length: PIN_LEN }, (_, i) => (
          <span key={i} style={{
            width: 13, height: 13, borderRadius: '50%',
            background: i < pin.length ? 'var(--accent)' : 'transparent',
            border: `1px solid ${i < pin.length ? 'var(--accent)' : 'var(--border-hover)'}`,
            transition: 'background 0.12s ease',
          }} />
        ))}
      </div>

      {triesLeft() < MAX_TRIES && left === 0 && (
        <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: -14 }}>
          {triesLeft()}번 남았어요
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 12,
        opacity: left > 0 ? 0.4 : 1,
      }}>
        {KEYS.map((k, i) => (k === '' ? <span key={i} /> : (
          <button
            key={i}
            onClick={() => push(k)}
            disabled={left > 0}
            aria-label={k === '←' ? '지우기' : k}
            style={{
              height: 62, fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--text-primary)',
              cursor: left > 0 ? 'default' : 'pointer',
            }}
          >{k}</button>
        )))}
      </div>

      <button
        onClick={forgot}
        style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 8,
        }}
      >네 자리를 잊으셨나요</button>
    </div>
  );
}
