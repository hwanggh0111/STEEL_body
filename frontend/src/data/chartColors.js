// 그래프에 쓰는 색.
//
// **여기만 값을 직접 적는다.** 다른 곳은 전부 globals.css 의 토큰(var(--accent) …)을
// 쓰지만 그래프는 못 쓴다 — 색이 SVG **속성**으로 나가는데(`<text fill="...">` ·
// `<path stroke="...">`) 속성 안에서는 var() 가 치환되지 않는다. 값이 통째로
// 무시되면서 글씨는 검정, 선은 아예 안 그려진다. 화면은 아무 말도 안 하고
// 그래프만 조용히 비어 보인다. (2026-08-27 까지 실제로 그 상태였다)
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

// ── **「축 글씨 · 말풍선 — 그래프 넷이 같이 쓴다」를 걷었다** ── (2026-10-27)
//
// 그 두 뭉치(`AXIS_TICK` · `TOOLTIP_STYLE`)는 recharts 에게 넘기던 값이고,
// 8/28 에 recharts 를 걷고 직접 그리기 시작한 뒤로 **아무도 안 썼다.**
// 그런데 「넷이 같이 쓴다」는 말은 남아 있었고, 그래서 **값이 조용히 어긋났다** —
// 거기 적힌 축 글씨는 11이고 실제로 그려지는 것은 10이다.
//
// 지금 그리는 쪽(`components/charts/LineChart.jsx`)은 위의 `CHART` 를 그대로 읽고
// 크기는 제자리에서 적는다. **없는 것을 쓴다고 적어두지 않는다** — 그 말이 다음에
// 보는 사람을 틀린 자리로 보낸다.
