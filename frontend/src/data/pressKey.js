// **눌리는 칸을 자판으로도 누르게 하는 손** (2026-11-11)
//
// ── 왜 한 자리에 두나 ──
//
// 11/11 에 「`<div onClick>` 인데 자판으로 못 닿는 자리」 열아홉을 닫았다. 그러면서
// **같은 네 줄을 열다섯 번 베껴 적었다** —
//
//     onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); 무엇(); } }}
//
// 베낀 것은 조용히 어긋난다. 한 자리에서 `e.preventDefault()` 를 빼먹으면 Space 가
// **화면을 아래로 굴린다**(그 칸은 눌리지도 않는다). 그리고 이 앱은 이미 그 일을
// 겪었다 — 날짜를 거르는 손이 열세 벌이었고 둘이 다르게 답했다(11/11 아침).
//
// `Enter` 와 `Space` 둘인 까닭 — 읽어주는 기계는 `role="button"` 인 칸을 **단추로
// 알리고**, 쓰는 사람은 단추에서 그 둘을 누른다. 하나만 받으면 「눌렀는데 안 된다」가
// 된다. `Space` 는 기본 동작(스크롤)을 막아야 하고, `Enter` 는 막아도 잃을 것이 없다.

/**
 * `onKeyDown` 에 그대로 건다.
 *
 *     <div role="button" tabIndex={0} onClick={go} onKeyDown={onEnterSpace(go)}>
 *
 * 누름이 아닌 키는 **그대로 흘려보낸다** — Tab 으로 지나가고 Esc 로 창을 닫는 길을
 * 막지 않는다.
 */
export const onEnterSpace = (run) => (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  run(e);
};

export default onEnterSpace;
