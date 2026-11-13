import { useEffect, useRef } from 'react';

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
  // 덮개를 열기 **직전에** 어디에 서 있었는지. 닫을 때 그 자리로 돌려준다
  const 왔던자리 = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    왔던자리.current = document.activeElement;

    // 첫 포커스 — 따로 가리키지 않으면 **상자 안의 첫 번째 닿는 것**이다.
    // 상자 자신에 주지 않는다. `tabIndex` 없는 `div` 에 포커스를 주면 읽어주는 기계가
    // 「그룹」이라고만 읽고 **무엇을 하는 자리인지 말하지 않는다**
    const t = setTimeout(() => {
      const 첫자리 = initialFocus?.current || 닿는것들(boxRef.current)[0];
      첫자리?.focus();
    }, 0);

    const onKey = (e) => {
      if (e.key === 'Escape' && onClose) { e.stopPropagation(); onClose(); return; }
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
  }, [open, boxRef, onClose, initialFocus]);
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
