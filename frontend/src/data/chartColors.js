// 그래프에 쓰는 색.
//
// **여기만 값을 직접 적는다.** 다른 곳은 전부 globals.css 의 토큰(var(--accent) …)을
// 쓰지만 그래프는 못 쓴다 — recharts 는 색을 SVG 속성으로 내보내고
// (`<text fill="...">` · `<path stroke="...">`), SVG 속성 안에서는 var() 가
// 치환되지 않는다. 값이 통째로 무시되면서 글씨는 검정, 선은 아예 안 그려진다.
// 화면은 아무 말도 안 하고 그래프만 조용히 비어 보인다.
//
// 그래서 토큰과 **같은 값을 손으로 맞춰 둔다.** 어긋나면 `npm run check` 가 잡는다.
export const CHART = {
  accent: '#eeb77d',   // --accent      체중 · 지금 값
  muscle: '#7fb069',   // --success     골격근
  fat:    '#d96a5c',   // --danger      체지방
  water:  '#7fa8d9',   // --info        체수분
  muted:  '#7a7160',   // --text-muted  축 글씨 · 기타 · 지난 값
  text2:  '#aaa28e',   // --text-secondary  범례 · 항목 이름
  text:   '#eae4d6',   // --text-primary
  card:   '#1b1712',   // --bg-secondary  말풍선 바탕
  border: '#332b1e',   // --border
};

// 축 글씨 · 말풍선 — 그래프 넷이 같이 쓴다
export const AXIS_TICK = { fill: CHART.muted, fontSize: 11 };
export const TOOLTIP_STYLE = {
  background: CHART.card,
  border: `1px solid ${CHART.border}`,
  color: CHART.text,
  fontSize: 13,
};
