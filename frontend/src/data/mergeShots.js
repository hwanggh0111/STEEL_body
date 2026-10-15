// 전·후를 **한 장으로** 합친다 (2026-10-15)
//
// ── 왜 한 장인가 ──
//
// 두 장을 따로 보내면 받는 사람 화면에서 **차례가 섞이고**, 어느 것이 과거인지 모른다.
// 그리고 보내는 사람 쪽에서도 「파일 두 개」를 고르는 걸음이 하나 더 생긴다.
// 변한 것을 보여주는 일에서 **두 장은 한 장보다 약하다** — 나란히 놓여야 변화가 보인다.
//
// ── 무엇을 적나 ──
//
// 사진 둘, 그 위에 `과거 / 현재`, 날짜, 그리고 **달라진 값 한 줄**(있으면).
// 그 이상은 안 적는다. 남에게 보내는 그림이라 **몸무게·체지방을 함부로 박으면 안 된다** —
// 부르는 쪽이 넘긴 것만 적는다.
//
// 글꼴은 **기기 글꼴**을 쓴다. 앱 글꼴(Bebas·Barlow)은 웹폰트라, 캔버스에 그릴 때
// 아직 안 받아졌으면 **조용히 다른 글꼴로 그려진다.** 그림은 되돌릴 수 없으니
// 처음부터 확실한 것을 쓴다.

/** `data:` 주소를 그림으로 읽는다. 망가졌으면 null */
function loadImage(dataUrl) {
  return new Promise((done) => {
    if (!dataUrl) { done(null); return; }
    const img = new Image();
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = dataUrl;
  });
}

/** 글자 그리기 — 어두운 사진 위에서도 읽히게 그림자를 깐다 */
function label(ctx, text, x, y, { size = 26, weight = 600, align = 'left', color = '#fff' } = {}) {
  ctx.font = `${weight} ${size}px -apple-system, "Segoe UI", "Noto Sans KR", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * 전·후 한 장을 만든다.
 *
 * @param {object} o
 * @param {string} o.before      `data:` 주소
 * @param {string} o.after       `data:` 주소
 * @param {string} [o.beforeAt]  과거 사진 날짜 (YYYY-MM-DD…)
 * @param {string} [o.afterAt]   현재 사진 날짜
 * @param {string} [o.caption]   아래에 적을 한 줄 (예: `넉 달 만에 −6.2kg`)
 * @returns {Promise<string|null>} `data:image/jpeg` 또는 null (둘 다 없을 때)
 */
export async function mergeBeforeAfter({ before, after, beforeAt, afterAt, caption } = {}) {
  const [a, b] = await Promise.all([loadImage(before), loadImage(after)]);
  if (!a && !b) return null;

  // 한 장만 있으면 그 한 장으로 만든다 — 「없는 쪽」을 빈 칸으로 보내지 않는다
  const shots = [
    a ? { img: a, tag: '과거', at: beforeAt } : null,
    b ? { img: b, tag: '현재', at: afterAt } : null,
  ].filter(Boolean);

  // 칸 크기는 **첫 사진의 비율**을 따른다. 세로 사진이 대부분이라 3:4 를 기본으로 둔다
  const CELL_W = 900;
  const first = shots[0].img;
  const ratio = first.naturalHeight / first.naturalWidth || 4 / 3;
  const CELL_H = Math.round(CELL_W * Math.min(Math.max(ratio, 1), 1.8));   // 너무 길면 자른다

  const GAP = 10;
  const BAR = caption ? 96 : 0;                 // 아래 글씨줄
  const W = CELL_W * shots.length + GAP * (shots.length - 1);
  const H = CELL_H + BAR;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 바탕 — 앱과 같은 금빛 검정
  ctx.fillStyle = '#12100c';
  ctx.fillRect(0, 0, W, H);

  shots.forEach((s, i) => {
    const x = i * (CELL_W + GAP);

    // **꽉 차게 넣고 넘치는 쪽을 자른다**(cover). 비율을 억지로 맞추면 사람이 늘어난다 —
    // 몸을 보여주는 그림에서 그건 거짓이 된다
    const iw = s.img.naturalWidth;
    const ih = s.img.naturalHeight;
    const scale = Math.max(CELL_W / iw, CELL_H / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, 0, CELL_W, CELL_H);
    ctx.clip();
    ctx.drawImage(s.img, x + (CELL_W - dw) / 2, (CELL_H - dh) / 2, dw, dh);

    // 글자가 사진에 묻히지 않게 위쪽만 살짝 어둡게
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, CELL_W, 160);
    ctx.restore();

    label(ctx, s.tag, x + 28, 56, { size: 34, weight: 700, color: '#eeb77d' });
    if (s.at && /^\d{4}-\d{2}-\d{2}/.test(s.at)) {
      label(ctx, s.at.slice(0, 10).replace(/-/g, '. '), x + 28, 92, { size: 24, weight: 500, color: 'rgba(255,255,255,0.82)' });
    }
  });

  if (caption) {
    label(ctx, caption, W / 2, CELL_H + 60, { size: 36, weight: 700, align: 'center', color: '#eae4d6' });
  }

  // 0.88 — 더 낮추면 몸의 결이 뭉개진다. 900px 두 장이면 1MB 안쪽이다
  return canvas.toDataURL('image/jpeg', 0.88);
}
