import { useEffect, useRef } from 'react';

// ── **덮개를 열면 뒤가 그대로 밀렸다** ── (2026-11-16 · 맵시)
//
// 11/13 에 이 손이 자판을 가뒀는데 **스크롤은 안 가뒀다.** 전수로 세니 덮개 열하나
// 중 뒤를 가두는 것은 `AppLock` 하나였다. 나머지는 떠 있는 동안 손가락을 움직이면
// **뒤 화면이 밀리고**, 닫은 뒤 **엉뚱한 자리에 서 있다** — 긴 목록(기록 · 루틴 ·
// 설정) 위에서 확인 창을 띄우면 매번 일어난다.
//
// ── 가두는 법 ──
//
// `body` 의 `overflow` 만 끄면 **아이폰 사파리가 안 멈춘다**(고무줄처럼 튕기며
// 밀린다). `documentElement` 까지 끄고 `overscroll-behavior` 로 당겨서 새로고침과
// 튕김을 함께 끊는다. 스크롤 **자리는 건드리지 않는다** — `position: fixed` 로 몸통을
// 띄우는 흔한 수는 이 앱에서 더 위험하다(탭바 · 휴식 띠가 `position: fixed` 다).
//
// ── 겹쳐 뜰 때 ──
//
// 잠금 화면 위에 확인 창이 뜬다. 각자 열고 닫으면 **안쪽이 닫힐 때 바깥쪽이 아직
// 떠 있는데 가둠이 풀린다.** 그래서 **센다** — 처음 하나가 걸고 마지막 하나가 푼다.

let 가둔수 = 0;
let 되돌릴값 = null;

/**
 * 떠 있는 동안 **뒤 화면이 안 밀리게** 한다. 자판을 가둘 것까지 없는 덮개
 * (제 Esc·Tab 규칙을 이미 가진 것들 — `ConfirmModal` · `AppLock` 같은)는
 * 이것만 따로 쓴다. `useModalFocus` 는 이 손을 안에서 부른다.
 */
export function useScrollLock(open) {
  useEffect(() => {
    if (!open) return undefined;
    가둔수 += 1;
    if (가둔수 === 1) {
      const b = document.body.style;
      const h = document.documentElement.style;
      되돌릴값 = { 몸통: b.overflow, 뿌리: h.overflow, 튕김: b.overscrollBehavior };
      b.overflow = 'hidden';
      h.overflow = 'hidden';
      b.overscrollBehavior = 'none';
    }
    return () => {
      가둔수 -= 1;
      // 음수로 내려가면 **다음 덮개가 안 걸린다** (닫히는 순서가 어긋날 때)
      if (가둔수 < 0) 가둔수 = 0;
      if (가둔수 > 0 || !되돌릴값) return;
      const b = document.body.style;
      const h = document.documentElement.style;
      b.overflow = 되돌릴값.몸통;
      h.overflow = 되돌릴값.뿌리;
      b.overscrollBehavior = 되돌릴값.튕김;
      되돌릴값 = null;
    };
  }, [open]);
}

/**
 * 덮개가 떠 있는 동안 **자판을 그 안에 가둔다** (2026-11-13 · 맵시).
 *
 * ── 왜 생겼나 ──
 * 덮개 여섯을 세어 보니 **탭을 가두는 것은 `ConfirmModal` 하나뿐**이었고, 닫은 뒤
 * **포커스를 돌려주는 것은 하나도 없었다.** 그래서 이런 일이 난다 —
 *
 *   1. 비밀번호 바꾸기 덮개를 띄우고 탭을 누르면 포커스가 **뒤 화면**으로 샌다.
 *      그 자리에는 「계정 삭제」 같은 단추가 있다 — **보이지도 않는 것이 눌린다.**
 *   2. 덮개가 떠도 포커스는 몸통에 그대로라, 읽어주는 기계는 **덮개가 뜬 줄 모른다.**
 *      자판으로 쓰는 사람은 입력칸까지 탭을 몇 번이나 눌러야 한다.
 *   3. 닫고 나면 포커스가 `<body>` 로 떨어져 **있던 자리를 잃는다** — 목록 한가운데서
 *      덮개를 열었다 닫으면 처음부터 다시 내려와야 한다.
 *
 * 알림(`Toast`)은 11/11 에 이미 ⑵⑶ 을 고쳤다(`npm run keytap` 의 「닫힐 때 있던
 * 자리로 돌려준다」). 덮개만 안 돼 있었다 — **한 자리만 고쳐져 있던 것**이다.
 *
 * ── 쓰는 법 ──
 *     const boxRef = useRef(null);
 *     useModalFocus(boxRef, open, { onClose: () => setOpen(false) });
 *     return open ? <div ...><div ref={boxRef} role="dialog" aria-modal="true"> … </div></div> : null;
 *
 * `onClose` 를 안 주면 Esc 는 이 손이 안 받는다 — 이미 제 Esc 를 가진 덮개
 * (`ConfirmModal` 은 Enter 규칙까지 함께 본다)는 그쪽을 그대로 두라는 뜻이다.
 */
export function useModalFocus(boxRef, open, { onClose, initialFocus } = {}) {
  // 뒤 화면을 가두는 것도 같이 한다 — 덮개마다 따로 적으면 그중 하나는 꼭 빠진다
  useScrollLock(open);

  // 덮개를 열기 **직전에** 어디에 서 있었는지. 닫을 때 그 자리로 돌려준다
  const 왔던자리 = useRef(null);

  // ── **닫는 손은 들고만 있는다** ── (2026-11-23)
  //
  // 부르는 쪽은 거의 다 `onClose={() => …}` 처럼 **그릴 때마다 새 손**을 준다. 그것을
  // 아래 효과의 의존에 두었더니, 덮개 주인이 다시 그려질 때마다(입력칸에 한 글자 칠
  // 때마다) 효과가 정리 → 다시 돌았다 — 포커스가 **뒤 단추로 갔다가 첫 칸으로** 왔고,
  // 그 틈에 친 글자는 뒤 단추에 떨어지고, 아이폰은 자판이 닫혔다. 손은 늘 최신 것을
  // 쓰되 효과는 **열고 닫힐 때만** 돈다
  const 닫는손 = useRef(onClose);
  닫는손.current = onClose;
  const 첫칸 = useRef(initialFocus);
  첫칸.current = initialFocus;

  useEffect(() => {
    if (!open) return undefined;

    왔던자리.current = document.activeElement;

    // 첫 포커스 — 따로 가리키지 않으면 **상자 안의 첫 번째 닿는 것**이다.
    // 상자 자신에 주지 않는다. `tabIndex` 없는 `div` 에 포커스를 주면 읽어주는 기계가
    // 「그룹」이라고만 읽고 **무엇을 하는 자리인지 말하지 않는다**
    const t = setTimeout(() => {
      const 첫자리 = 첫칸.current?.current || 닿는것들(boxRef.current)[0];
      첫자리?.focus();
    }, 0);

    const onKey = (e) => {
      if (e.key === 'Escape' && 닫는손.current) { e.stopPropagation(); 닫는손.current(); return; }
      if (e.key !== 'Tab') return;

      const 것들 = 닿는것들(boxRef.current);
      if (것들.length === 0) return;

      const 처음 = 것들[0];
      const 마지막 = 것들[것들.length - 1];
      const 지금 = document.activeElement;

      // **상자 밖에 서 있으면 도로 끌고 온다.** 덮개가 뜨기 전에 잡고 있던 포커스가
      // 뒤 화면에 남아 있을 수 있다 — 그 상태로 탭을 누르면 뒤 화면을 돌아다닌다
      if (!boxRef.current?.contains(지금)) {
        e.preventDefault();
        (e.shiftKey ? 마지막 : 처음).focus();
        return;
      }
      if (!e.shiftKey && 지금 === 마지막) { e.preventDefault(); 처음.focus(); }
      else if (e.shiftKey && 지금 === 처음) { e.preventDefault(); 마지막.focus(); }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      // 돌려줄 자리가 화면에서 사라졌으면(그 줄을 지운 뒤 닫는 경우) 아무 데도 안 준다 —
      // 없어진 자리에 `focus()` 를 하면 브라우저가 `<body>` 로 떨어뜨리고 스크롤이 튄다
      const 돌아갈곳 = 왔던자리.current;
      if (돌아갈곳 && document.contains(돌아갈곳)) 돌아갈곳.focus();
    };
  }, [open, boxRef]);
}

/** 상자 안에서 자판으로 닿는 것들을 순서대로. 숨은 것 · 꺼진 것은 뺀다 */
function 닿는것들(상자) {
  if (!상자) return [];
  const 것들 = 상자.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),'
    + ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  // `offsetParent` 가 없으면 화면에 없는 것이다(`display:none` · 접힌 자리).
  // 숨은 것에 포커스를 주면 **커서가 사라진 것처럼 보인다**
  return Array.prototype.filter.call(것들, (el) => el.offsetParent !== null || el === document.activeElement);
}
