// 첫 화면이 다 뜬 **뒤에** 받는 글꼴 (2026-10-15)
//
// ── 재보니 한글 글꼴이 1,038KB 였다 ──
//
// 앱 첫 짐(JS 81.3KB)의 **12.8배**다. 구글이 한글을 조각 백여 개로 잘라 주고 쓰는
// 글자가 든 조각만 내려오는데, 그래도 그만큼이다. 굵기 하나에 150~165KB 다.
//
//   굵기 300  154.3KB      ← 7 자리에서 쓴다
//   굵기 400  151.2KB
//   굵기 500  166.2KB      ← 3 자리에서 쓴다
//   굵기 600  165.7KB
//   굵기 700  164.2KB
//   Nanum Myeongjo 236.6KB ← **네 줄**에 쓴다 (몸 지도 · 결산 · 기록의 벽 · 목표 카드)
//
// 굵기 300·500 은 뺐다(−320KB) — 그 자리의 한글은 가장 가까운 굵기로 그려진다.
// 라틴(Barlow)은 다섯 굵기를 그대로 둔다. 라틴은 조각 하나에 15~20KB 라 싸다.
//
// ── 명조는 왜 나중에 받나 ──
//
// 236.6KB 를 **첫 화면에서** 받고 있었다. 그런데 명조로 적는 것은 화면 넷의 **첫 줄
// 한 줄**뿐이다. 첫 화면(오늘)에는 아예 안 쓰인다 — 앱이 뜨는 동안 받을 이유가 없다.
//
// 그래서 **앱이 할 일을 다 한 뒤(idle)** 받는다. 그때까지 그 네 줄은 기기 명조로
// 보이고(`.serif-display` 의 `serif` 폴백), 받아지면 바뀐다. `display=swap` 이라
// 글이 안 보이는 순간은 없다.
//
// 아예 안 받는 쪽도 생각했는데, 그건 **디자인을 바꾸는 일**이라 따로 물어봐야 한다.
// 여기서 하는 것은 「같은 그림을 늦게 받는 것」뿐이다.

const SERIF = 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo&display=swap';

let done = false;

/** 한 번만 끼운다 — 두 번 부르면 같은 CSS 를 두 번 받는다 */
function inject(href) {
  if (done) return;
  done = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  // 받다가 막혀도 앱은 그대로 돈다 — 기기 명조로 보일 뿐이다
  link.onerror = () => { /* 그냥 둔다 */ };
  document.head.appendChild(link);
}

/**
 * 첫 화면이 뜬 뒤에 부른다 (`main.jsx`).
 *
 * `requestIdleCallback` 이 없는 브라우저(사파리 일부)에서는 타이머로 미룬다 —
 * 2초면 첫 화면은 이미 떠 있고, 사람이 그 네 줄에 닿기 전이다.
 */
export function loadLateFonts() {
  if (typeof document === 'undefined') return;
  const go = () => inject(SERIF);
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(go, { timeout: 3000 });
  } else {
    setTimeout(go, 2000);
  }
}
