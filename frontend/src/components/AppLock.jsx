import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLockStore } from '../store/lockStore';
import { useAuthStore } from '../store/authStore';
import { LogoMark } from './Logo';
import { PIN_LEN, MAX_TRIES } from '../data/appLock';
// 지문·얼굴로 풀기 (2026-11-19 · 시안 1119 ⑤). 네 자리를 **대신하지 않고 얹힌다**
import { 켜졌나 as bioOn, 쓸수있나 as bioReady, 풀어본다 as bioTry } from '../data/lockBio';
import { confirmDialog, dismissConfirm } from './ConfirmModal';
import { useScrollLock } from '../data/useModalFocus';
import { LAYER } from '../data/layers';

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
  // 지문이 맞으면 **네 자리를 안 거치고 놓는다** — 맞혔을 때와 같은 자리다 (2026-11-19)
  const release = useLockStore((s) => s.release);
  const logout = useAuthStore((s) => s.logout);
  const loggedIn = useAuthStore((s) => s.isLoggedIn);

  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [left, setLeft] = useState(0);
  const busy = useRef(false);
  const boxRef = useRef(null);

  // ── 안 덮는 자리 ── (2026-09-18)
  //
  // 로그인 · 가입 · 홈페이지는 **로그인 없이 보는 자리**다. 쿠키가 남아 있으면
  // `isLoggedIn` 이 참이라, 홈페이지를 보러 온 사람에게 네 자리를 묻고 있었다 —
  // 거기에는 가릴 것이 없다. 로그인 화면을 덮으면 잊었을 때 나갈 길도 막힌다.
  const path = useLocation().pathname;
  const publicPlace = /^\/(login|register|site)(\/|$)/.test(path);

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
  //
  // 여기 있던 손을 **세는 한 벌로 옮겼다** (2026-11-16 · 맵시). 몸통만 끄고 있어서
  // 아이폰에서는 고무줄처럼 밀렸고, 더 나쁜 것은 **겹쳐 뜰 때**였다 — 잠금 위에
  // 확인 창(「네 자리를 잊으셨으면…」)이 뜨고 그것이 닫히면, 잠금이 아직 떠 있는데
  // 그 창의 되돌림이 가둠을 풀었다. 이제 처음 하나가 걸고 **마지막 하나가** 푼다
  useScrollLock(locked && enabled);

  useEffect(() => {
    if (!locked || !enabled) return undefined;
    boxRef.current?.focus();
    return undefined;
  }, [locked, enabled]);

  // ── ★ **잠기면 떠 있던 물음을 거둔다** ── (2026-11-17 · 정석)
  //
  // 11/17 에 층을 한 자리로 모으면서(`data/layers.js`) 확인창을 잠금 **위**에 뒀다.
  // 까닭은 맞다 — 위의 「네 자리를 잊으셨나요」가 눌려야 한다. 그런데 그러면
  // **아무 확인창이나** 잠금 위가 된다. 확인창을 띄운 채 폰을 내려놓으면 잠금 시간이
  // 지나 잠금이 뜨고, **그 창이 잠금 위에 그대로 남는다.**
  //
  // 그 창에는 기록이 적혀 있다 — `"{메모 앞머리}" 메모를 지울까요` ·
  // `{헬스장}의 {운동 이름} 세팅을 지울까요` · `{날짜} 메모를 지울까요`.
  // **이 화면이 가리려는 것이 바로 그것이다**(위 머리글: 「반쯤 가리면 그 틈으로
  // 오늘 한 운동과 몸 사진 미리보기가 보인다」). 글이 보이는 데 그치지 않고
  // **「지울까요」 단추가 살아 있어** 잠근 채로 기록을 지울 수 있었다.
  //
  // 층은 잠금이 그 둘(확인창 · 토스트)보다 위로 가게 고쳤다. 여기서 한 번 더
  // 거두는 까닭은 **덮은 창이 사라진 것이 아니기 때문**이다 — 포커스가 그 안에
  // 남고 낭독기는 그것을 읽는다. 제가 띄운 물음(`잠금위`)은 남는다
  useEffect(() => {
    if (locked && enabled) dismissConfirm();
  }, [locked, enabled]);

  // **로그인 화면은 안 덮는다.** 덮으면 나갈 길이 막힌다 —
  // 잊었을 때 푸는 길이 로그아웃인데, 로그아웃하면 이 화면이 로그인 화면을 덮고
  // 그 위에서는 아무것도 할 수 없다. 잠금이 가리려는 것은 **들어와 있는 사람의
  // 기록**이고, 로그인 전에는 가릴 것이 없다
  if (!enabled || !locked || !loggedIn || publicPlace) return null;

  // ── 지문 단추를 그릴까 ── (2026-11-19)
  //
  // **눌러도 아무 일이 안 나는 줄을 두지 않는다**(`healthLink` · 설정함의 「앱 잠금」과
  // 같은 규칙). 기기가 못 읽거나 안 켜 뒀으면 **아예 안 그린다**
  const [bioCan, setBioCan] = useState(false);
  useEffect(() => {
    let 살아있다 = true;
    (async () => {
      const yes = bioOn() && await bioReady();
      if (살아있다) setBioCan(yes);
    })();
    return () => { 살아있다 = false; };
  }, []);

  // 잠금이 떠 있는 동안 **한 번은 저절로 물어본다** — 지문을 켠 사람이 바라는 것은
  // 「열면 바로 지문」이지 「단추를 찾아 누르기」가 아니다. 거절하면 네 자리가 그대로 있다.
  // **다시 물어보지 않는다**(`물어봤다`) — 거절한 사람에게 계속 뜨면 그게 가로막이다
  const 물어봤다 = useRef(false);
  useEffect(() => {
    if (!bioCan || !locked || 물어봤다.current) return;
    물어봤다.current = true;
    (async () => { if (await bioTry()) release(); })();
  }, [bioCan, locked, release]);

  async function 지문으로() {
    if (busy.current) return;
    busy.current = true;
    const ok = await bioTry();
    busy.current = false;
    // 안 되면 **아무 말도 안 한다** — 네 자리 자판이 그대로 떠 있고, 그것이 다음 길이다
    if (ok) release();
  }

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
다시 로그인하시면 전부 돌아옵니다. **잠금도 함께 풀립니다** — 다시 걸고 싶으면
내 계정에서 새 네 자리를 정하시면 됩니다.`,
      // `잠금위`: 이 물음만 잠금 위에 그린다 (`data/layers.js` 의 `잠금확인창`).
      // 이것이 없으면 잠금이 제 물음까지 덮어 **누를 수 없다**
      { title: '네 자리를 잊으셨나요', confirmText: '로그아웃', danger: true, 잠금위: true },
    );
    if (yes) {
      // **건 것까지 잊는다** (2026-10-24). 여태 잠긴 것만 놓고 **건 것은 남겼다** —
      // 그래서 네 자리를 잊은 사람은 앱을 다시 열 때마다 또 잠겼고(설정에서 풀려면
      // 지금 네 자리를 맞혀야 한다) **푸는 길이 아예 없었다.** 이 창도 「잠금은
      // 그대로 걸려 있습니다」라고 적고 있었는데, 고객센터 답변은 「로그아웃으로
      // 풀 수 있다」였다. 지금은 `logout()` 이 `lockStore.forget()` 을 부른다
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
        position: 'fixed', inset: 0, zIndex: LAYER.잠금,
        background: 'var(--bg-primary)',
        backgroundImage: 'var(--bg-glow)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 26, padding: 24,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <LogoMark size={34} />
        {/* ── **초가 줄어들 때 문장이 좌우로 떨었다** (2026-11-16 · 맵시) ──
            이 줄은 Barlow(본문 기본 글꼴)로 그리는데 Barlow 숫자는 폭이
            350~565 로 **21.5% em** 벌어진다. 가운데 정렬이라 30 → 29 → 9 로
            줄어드는 동안 문장 전체가 매초 움직였다.
            ── **땜질을 걷었다** ── (2026-11-16)

            처음에는 수 칸에 `minWidth: '2ch'` 로 자리를 미리 비웠다. `tabular-nums`
            가 **그때는 안 듣는 줄**이었기 때문이다 — 11/13 에 글꼴을 자급하면서
            `layout_features = []` 로 `tnum` 까지 떼어내 열셋 전부 OpenType 기능이
            0개였다. `3d7106c` 로 되살렸고, 이제 `body` 한 줄이 모든 수를 고정폭으로
            세운다(`globals.css` 의 `font-variant-numeric`).

            `2ch` 를 남겨둘 까닭이 없다 — 자릿수를 사람이 미리 알아야 하고, 글꼴을
            바꾸면 `ch` 가 같이 움직인다. 글꼴 기능이 그 셋을 다 없앤다. */}
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
          {left > 0 ? (
            <>
              {secs}초 뒤에 다시 치실 수 있어요
            </>
          ) : '네 자리를 쳐주세요'}
        </div>
      </div>

      {/* 친 만큼 점이 찬다. 숫자를 그대로 보여주지 않는다 — 어깨 너머가 있다 */}
      <div style={{
        display: 'flex', gap: 14,
        animation: shake ? 'lockShake 0.4s' : 'none',
      }}>
        {Array.from({ length: PIN_LEN }, (_, i) => (
          <span key={i} style={{
            flexShrink: 0, width: 13, height: 13, borderRadius: '50%',
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
              // `height` 가 아니라 `minHeight` 다 — 폰에서 글자를 크게 쓰면
              // `fontSize: 24` 가 48 까지 자라는데, 높이를 묶어두면 **눌러야 하는
              // 숫자가 잘린다.** 잠금 화면은 숫자를 못 읽으면 앱에 못 들어온다
              // (2026-11-17 · 맵시). 기본 크기에서는 지금과 같은 62 다
              minHeight: 62, fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif", fontSize: 24, letterSpacing: 2,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--text-primary)',
              cursor: left > 0 ? 'default' : 'pointer',
            }}
          >{k}</button>
        )))}
      </div>

      {/* ── 지문·얼굴로 풀기 ── (2026-11-19 · 시안 1119 ⑤)
          네 자리는 **그대로 남는다** — 젖은 손 · 인식기 고장에 쓸 길이 없으면 안 된다.
          그래서 자판 아래에 **얹는다**(자판을 치우지 않는다) */}
      {bioCan && (
        <button
          onClick={지문으로}
          aria-label="지문으로 풀기"
          style={{
            width: 54, height: 54, borderRadius: '50%', margin: '18px auto 2px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--accent-dim)', border: '1px solid var(--accent)',
            color: 'var(--accent)', cursor: 'pointer',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M12 3.6c-4.6 0-8.4 3.8-8.4 8.4" />
            <path d="M20.4 12c0-4.6-3.8-8.4-8.4-8.4" />
            <path d="M6.6 14.4a5.4 5.4 0 0 1 10.8-2.4" />
            <path d="M9.6 17.4A2.4 2.4 0 0 1 14.4 15" />
            <path d="M12 20.4v-2.4" />
          </svg>
        </button>
      )}

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
