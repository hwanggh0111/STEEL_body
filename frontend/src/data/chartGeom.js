// 그림 자리의 **셈**. 도넛의 조각 각도와 오각형의 점 자리를 여기서 센다 (2026-11-05).
//
// ── 왜 떼어냈나 ──
//
// **틀린 그림은 틀려 보이지 않는다.** 도넛은 무엇을 먹여도 꽉 찬 원이고, 오각형은
// 무엇을 먹여도 그럴듯한 별 모양이다. 11/04 에 체성분 도넛이 **체중을 넘게**
// 그리고 있던 것도 눈으로는 멀쩡했다 — 수를 손으로 더해봐야 드러났다.
// 그려지는 모양을 보는 대신 **각도와 좌표를 값으로 본다**: `npm run draw`.
//
// ── 손으로 더해보니 나온 것 셋 ──
//
// 1. **오각형이 단위를 안 적었다.** 표는 「22%」라고 적는데 바로 밑 그림은 「22」다.
//    체수분(L)과 체지방률(%)과 체중(kg)이 **다 단위 없이** 나란히 적혀 있었다 —
//    「체지방 22 → 16」을 kg 으로 읽으면 6kg 을 뺀 것이 된다. 단위를 받는다.
// 2. **좁은 폰에서 양옆 값이 잘렸다.** 그림이 「옆으로 나갈 자리(76px)를 빼놓는다」고
//    적어놓고, 바로 다음 줄의 `Math.max(40, …)` 이 그 자리를 다시 먹었다 —
//    폭이 232px 아래로 내려가면 반지름 최소값이 이겨서 라벨이 그림 밖으로 나갔다
//    (접은 폴더블 280px). 자리는 **글자 길이로** 재고, 그래도 좁으면 값을 그물 밑에
//    모은다.
// 3. **값 하나가 숫자가 아니면 다각형이 통째로 사라졌다.** `?? 0` 은 `NaN` 을 못
//    걸러서(`NaN ?? 0` 은 `NaN` 이다) 좌표가 `"NaN,NaN"` 이 되고, SVG 는 그 점만
//    버리지 않고 **다각형 전체를 안 그린다.** 그물만 남은 그림에 사람은 「변화가
//    없구나」로 읽는다. 숫자가 아닌 축은 **빼고, 뺐다고 말한다.**
//
// 4. 도넛은 **아주 작은 조각이 사라졌다** — 사이를 벌리는 폭(0.03rad)보다 좁은
//    조각은 폭이 음수가 되어 0.001rad 로 눌렸다. 범례에는 「기타 0.1kg」이 적혀
//    있는데 그림에는 없다. 최소 폭을 준다.

export const TAU = Math.PI * 2;
export const TOP = -Math.PI / 2;        // 12시

/** 조각 사이를 벌리는 폭. 라디안 */
export const DONUT_GAP = 0.03;
/** 조각 하나가 **눈에 보이는** 최소 폭. 이보다 좁으면 있는 조각이 사라진다 */
export const DONUT_MIN = 0.02;

const numOf = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * 도넛 조각의 각도.
 *
 * 돌려주는 것 —
 *   slices  `[{ ...조각, from, to, span, widened }]` — 12시에서 시계방향.
 *           `from`·`to` 는 라디안, `widened` 는 최소 폭까지 늘려 그린 조각이다
 *   sum     조각 합 · `center` 가운데에 적을 수 ·
 *   over    조각 합이 가운데 수보다 **넘은** 양 (잘못 적은 값일 때 0 보다 크다)
 *   full    조각이 하나뿐이라 원 하나로 그린다
 *
 * 자리는 **참값 비율**로 잡는다 — 최소 폭으로 늘리는 것은 그리는 폭뿐이어서,
 * 아주 작은 조각이 이웃과 살짝 붙는다. 「있다고 적었는데 그림에 없다」보다 낫다.
 */
export function donutSlices(data, { total = null, gap = DONUT_GAP, min = DONUT_MIN } = {}) {
  const parts = (Array.isArray(data) ? data : [])
    .map((d) => (d ? { ...d, value: numOf(d.value) } : null))
    .filter((d) => d && d.value > 0);
  const sum = parts.reduce((s, d) => s + d.value, 0);
  const center = numOf(total) > 0 ? numOf(total) : sum;
  const over = sum > center ? Number((sum - center).toFixed(1)) : 0;
  if (!parts.length || !(sum > 0)) return { slices: [], parts: [], sum: 0, center: 0, over: 0, full: false, gap: 0 };

  // 조각 하나는 원 하나다 — 시작과 끝이 같은 점이라 호로는 못 그린다 (화면이 반원 둘로 나눈다)
  if (parts.length === 1) {
    return {
      slices: [{ ...parts[0], from: TOP, to: TOP + TAU, span: TAU, widened: false }],
      parts, sum, center, over, full: true, gap: 0,
    };
  }

  // 벌리는 폭은 **조각 수에 따라 줄인다** — 조각이 많으면 벌린 것만 더해 한 바퀴를 먹는다
  const g = Math.min(gap, TAU / (parts.length * 4));
  let a = TOP;
  const slices = parts.map((d) => {
    const share = (d.value / sum) * TAU;
    const from = a + g / 2;
    const want = share - g;
    const span = Math.max(min, want);
    a += share;
    return { ...d, from, to: from + span, span, widened: want < min };
  });
  return { slices, parts, sum, center, over, full: false, gap: g };
}

/** 조각 하나를 도넛 모양 path 로. 그리는 쪽과 자가 같은 것을 쓴다 */
export function arcPath(cx, cy, rOut, rIn, from, to) {
  const big = to - from > Math.PI ? 1 : 0;
  const p = (r, t) => [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  const [x1, y1] = p(rOut, from);
  const [x2, y2] = p(rOut, to);
  const [x3, y3] = p(rIn, to);
  const [x4, y4] = p(rIn, from);
  return `M${x1} ${y1} A${rOut} ${rOut} 0 ${big} 1 ${x2} ${y2} L${x3} ${y3} A${rIn} ${rIn} 0 ${big} 0 ${x4} ${y4} Z`;
}

// ── 오각형(두 시점 비교) ──────────────────────────────────

/** 한글은 글자 하나가 글자 크기만큼, 숫자·기호는 그 절반쯤 넓다 */
export function textWidth(s, px) {
  let w = 0;
  for (const ch of String(s ?? '')) w += /[가-힣ㄱ-ㆎ]/.test(ch) ? px : px * 0.55;
  return w;
}

const AXIS_FONT = 11;     // 축 이름
const VALUE_FONT = 9.5;   // 그 밑의 「과거 → 현재」
const LABEL_OUT = 18;     // 라벨은 그물 **밖** 이만큼에 적는다
const MIN_R = 24;         // 이보다 작으면 그물이 글자에 묻힌다

/**
 * 글자가 그림 밖으로 나가면 **안쪽으로 당긴다.**
 *
 * 자리를 넉넉히 잡아두는 것만으로는 안 된다 — 축 이름이 아주 길면(「체지방률(복부)」)
 * 잡아둔 자리를 넘는다. 넘칠 때는 그물에 조금 겹쳐도 **글자가 보이는 쪽**을 고른다.
 */
function fitX(x, w, anchor, box) {
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  const right = left + w;
  if (right > box) return x - (right - box);
  if (left < 0) return x - left;
  return x;
}

/** 12.0 → 12 · 12.34 → 12.3. 축과 표가 같은 규칙을 쓴다 (`useWidth.fmt` 와 같다) */
const fmt1 = (v) => (v == null || !Number.isFinite(Number(v)) ? '-' : String(Number(Number(v).toFixed(1))));

/**
 * 오각형의 점 자리.
 *
 * **축마다 눈금이 따로다** — 체중(kg) · 체지방(%) · BMI · 체수분(L) 을 한 눈금에
 * 올리면 kg 이 늘 바깥이고 %는 늘 안쪽이라 모양이 아무 말도 안 한다. 축마다
 * 「그 축에서 큰 쪽」을 바깥으로 잡아 **두 시점의 차이**만 보이게 한다.
 *
 * 돌려주는 것 —
 *   ok       그릴 수 있나 (숫자로 읽히는 축이 셋 이상)
 *   axes     `[{ subject, valueText, angle, lx, ly, anchor }]`
 *   points   `{ 계열키: [[x, y], …] }` — 다각형 점
 *   rings    그물 (25% 씩)
 *   tight    좁아서 값을 축 옆이 아니라 **그물 밑**에 모은다
 *   dropped  숫자로 안 읽혀서 **뺀** 축 이름들
 */
export function radarGeom(rows, series, { width = 320, height = 260 } = {}) {
  const keys = (Array.isArray(series) ? series : []).map((s) => s.key);
  const all = (Array.isArray(rows) ? rows : []).filter(Boolean);
  // **숫자가 아닌 축은 뺀다.** 남겨두면 좌표가 NaN 이 되어 다각형이 통째로 사라진다
  const axes0 = all.filter((row) => keys.length > 0 && keys.every((k) => numOf(row[k]) !== null));
  const dropped = all.filter((row) => !axes0.includes(row)).map((row) => String(row.subject ?? '?'));
  const cx = width / 2;
  const cy = height / 2;
  if (axes0.length < 3) return { ok: false, axes: [], points: {}, rings: [], dropped, cx, cy, r: 0, tight: false, valueFont: VALUE_FONT };

  const texts = axes0.map((row) => ({
    subject: String(row.subject ?? ''),
    // ★ **단위를 적는다.** 표가 「22%」라고 적는 수를 그림이 「22」라고 적고 있었다
    valueText: keys.map((k) => fmt1(row[k])).join(' → ') + String(row.unit ?? ''),
  }));
  const needSubject = Math.max(...texts.map((t) => textWidth(t.subject, AXIS_FONT)));
  const needValue = Math.max(...texts.map((t) => textWidth(t.valueText, VALUE_FONT)));

  // 옆으로 나갈 자리를 **글자 길이로** 잡는다 (예전에는 76px 로 박아뒀다).
  // ★ **라벨은 그물 밖 18px 자리에 적힌다** — 그만큼을 같이 빼놓지 않으면 자리를
  // 잡아놓고도 글자가 나간다 (처음 짤 때 내가 빠뜨렸다)
  const sideFor = (need) => Math.min(100, Math.max(24, need + LABEL_OUT + 4));
  let side = sideFor(Math.max(needSubject, needValue));
  let r = Math.min(cx - side, cy - 34);
  let tight = false;
  // 그래도 좁으면 **값을 그물 밑으로 모은다** — 축 옆에 두면 그림 밖으로 나간다
  if (r < 34) {
    tight = true;
    side = sideFor(needSubject);
    r = Math.min(cx - side, cy - 34);
  }
  r = Math.max(MIN_R, r);

  const angle = (i) => TOP + (TAU * i) / axes0.length;
  // 축마다 0 ~ (그 축의 큰 값 × 1.15). 값이 다 0 이거나 음수면 1 로 둔다
  const baseOf = (row) => {
    const m = Math.max(...keys.map((k) => numOf(row[k])));
    return m > 0 ? m * 1.15 : 1;
  };
  const at = (row, k, i) => {
    const t = Math.max(0, Math.min(1, numOf(row[k]) / baseOf(row)));
    return [cx + r * t * Math.cos(angle(i)), cy + r * t * Math.sin(angle(i))];
  };

  const points = {};
  keys.forEach((k) => { points[k] = axes0.map((row, i) => at(row, k, i)); });

  const axes = axes0.map((row, i) => {
    const t = angle(i);
    const anchor = Math.abs(Math.cos(t)) < 0.25 ? 'middle' : (Math.cos(t) > 0 ? 'start' : 'end');
    // 그 축에서 가장 긴 글자가 기준이다 (좁을 때는 값을 안 적으니 축 이름만)
    const widest = Math.max(
      textWidth(texts[i].subject, AXIS_FONT),
      tight ? 0 : textWidth(texts[i].valueText, VALUE_FONT),
    );
    const lx = fitX(cx + (r + LABEL_OUT) * Math.cos(t), widest, anchor, width);
    const ly = cy + (r + LABEL_OUT) * Math.sin(t);
    return {
      subject: texts[i].subject,
      valueText: texts[i].valueText,
      angle: t,
      width: Number(widest.toFixed(1)),
      anchor,
      lx, ly,
      x2: cx + r * Math.cos(t),
      y2: cy + r * Math.sin(t),
    };
  });

  const rings = [0.25, 0.5, 0.75, 1].map((k) => ({
    k,
    points: axes0.map((_, i) => [cx + r * k * Math.cos(angle(i)), cy + r * k * Math.sin(angle(i))]),
  }));

  return { ok: true, axes, points, rings, dropped, cx, cy, r, side, tight, valueFont: VALUE_FONT };
}

/** 점들을 SVG `points` 글자로. 좌표가 하나라도 숫자가 아니면 **안 그린다** */
export function pointsAttr(pts) {
  if (!Array.isArray(pts) || pts.length < 3) return null;
  if (pts.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return null;
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}
