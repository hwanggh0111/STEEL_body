// 묻는 창에서 **키를 누르면 무엇이 되는가** (2026-11-04).
//
// ── 무엇이 틀렸나 ──
//
// `ConfirmModal` 은 위험한 물음(지우기)이면 **「취소」에 포커스를 준다** — 주석에
// 「실수 방지」라고 적혀 있다. 그런데 키를 보는 자리는 이렇게 생겼었다.
//
//     else if (e.key === 'Enter') close(true);    // ← 포커스를 안 본다
//
// **그래서 Enter 가 지웠다.** 취소에 포커스를 줘놓고도 Enter 한 번에 승인됐다 —
// 「무엇을 지울까요」가 뜬 순간 손가락이 Enter 에 머물러 있으면 그대로 지워진다.
// 기록을 적다 Enter 로 저장하는 화면이 여럿이라(검색의 첫 결과 이동 · 폼 저장) 그
// 손가락은 실제로 Enter 위에 있다. **가리려고 둔 포커스가 아무 일도 안 하고 있었다.**
//
// 그리고 한 가지가 더 숨어 있었다. 포커스가 우리 단추에 있으면 **브라우저가 Enter 로
// 그 단추를 누른다.** 그 위에 우리가 또 닫으면 **한 번 누른 것이 두 번 닫는다** —
// 물음이 줄 서 있을 때(`_pendingQueue`) 두 번째 닫기가 줄에서 하나를 더 꺼내 버리고,
// 꺼내진 그 물음은 **영영 안 풀린다**(그것을 기다리던 `await` 가 그 자리에서 멎는다).
// 이 파일이 막으려고 쓴 바로 그 일이다.
//
// ── 왜 판단만 따로 두나 ──
//
// `data/appLock.js` 와 같은 자리다 — 「얼마나 비워두면 잠그나」를 스토어에서 떼어
// 값으로 보게 해둔 그것. 키를 누르는 일은 화면으로 확인하기 어렵다(폰에는 키보드가
// 없고, PC 로 열어 눌러봐야 한 번에 하나씩이다). 판단을 떼어 값으로 본다.

/**
 * Enter 를 눌렀다 — 무엇을 할까.
 *
 * @param focus   지금 포커스가 어디 있나: 'confirm' · 'cancel' · 그 밖(null 등)
 * @param danger  위험한 물음인가 (지우기 · 되돌릴 수 없는 것)
 * @returns 'browser' 면 **우리는 아무것도 안 한다** (브라우저가 그 단추를 누른다),
 *          'confirm' · 'cancel' 이면 그쪽으로 닫는다
 */
export function enterChoice(focus, danger) {
  // 우리 단추에 포커스가 있으면 브라우저가 그것을 누른다. 우리가 또 닫으면 두 번이다
  if (focus === 'confirm' || focus === 'cancel') return 'browser';
  // 어디에도 없으면(포커스를 못 줬거나 바깥을 눌렀다) **안전한 쪽**으로 닫는다.
  // 위험한 물음에서 Enter 가 승인이 되면, 안 읽고 누른 한 번이 기록을 지운다
  return danger ? 'cancel' : 'confirm';
}

/** 지금 포커스가 우리 단추 중 어디인가. DOM 을 아는 쪽은 화면이고, 판단은 위에 있다 */
export function focusKind(active, confirmEl, cancelEl) {
  if (active && active === confirmEl) return 'confirm';
  if (active && active === cancelEl) return 'cancel';
  return null;
}

/**
 * Escape 는 늘 취소다 — 위험하든 아니든.
 *
 * 따로 적어두는 까닭: 「알겠습니다」처럼 **단추가 하나뿐인 것처럼 쓰는 물음**도
 * 있는데(가져오기에서 못 넣은 줄을 알릴 때), 그때도 Escape 로 닫혀야 한다.
 * 닫히는 것이 곧 「아니오」라서 아무 일도 안 일어난다
 */
export const ESCAPE_IS_CANCEL = true;
