// 로고를 화면 없이 그려서 한 장으로 뽑는다.
//
//   node scripts/logo-sheet.cjs   →  .design/logo-blackiron.html
//
// 브라우저를 띄우지 않고 `react-dom/server` 로 그린다 — 8/31 에 그래프를 그렇게 봤다.
// 로고에서 눈으로 볼 것은 **글꼴이 어떻게 앉는가**뿐이라, 크게 뽑아 놓고 보면 된다.
//
// 지금 쓰는 것(A) 말고 **다른 글자체 두 벌(B · C)** 도 같이 그린다. 말로 「고급스럽게」를
// 주고받는 것보다 나란히 놓고 고르는 편이 빠르다. 고른 것을 Logo.jsx 에 옮기면 된다.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const FE = path.join(__dirname, '..');
const OUT_JS = path.join(FE, '.logo-sheet.cjs');

esbuild.buildSync({
  entryPoints: [path.join(FE, 'src/components/Logo.jsx')],
  bundle: true,
  format: 'cjs',
  outfile: OUT_JS,
  external: ['react', 'react-dom'],
  loader: { '.js': 'jsx', '.jsx': 'jsx' },
  jsx: 'automatic',
  logLevel: 'silent',
});

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Logo = require(OUT_JS);

const draw = (props) => renderToStaticMarkup(React.createElement(Logo.default, props));

// 지금 쓰는 것 — 여러 크기로
const sizes = [
  ['머리 · 탭바 (19)', { cap: 19, variant: 'row' }],
  ['머리 크게 (28)', { cap: 28, variant: 'row' }],
  ['로그인 · 스플래시 (34)', { cap: 34, variant: 'stack' }],
  ['크게 (56)', { cap: 56, variant: 'stack' }],
  ['글자만 (40)', { cap: 40, variant: 'word' }],
];

// 마크는 SVG 라 그대로 뽑아 쓴다 (B · C 판에도 같은 마크를 붙인다)
const markOnly = draw({ cap: 34, variant: 'mark' });

// 글자체만 바꾼 판 — 마크는 그대로. 고를 때 헷갈리지 않게 한 가지만 바꾼다.
//
// 「딱딱하다」는 말을 듣고 다시 짰다. 딱딱함은 **각**에서 온다 —
// 전부 대문자 · 넓은 자간 · 각진 도형 · 가르는 직선. 우아함은 그 반대에 있다:
// 소문자 · 세리프의 굵기 대비 · 좁은 자간 · 곡선.
const wordVariants = [
  ['A · 지금 쓰는 것 — Playfair 400, 「Black Iron」',
   "font-family:'Playfair Display',serif;font-weight:400;letter-spacing:.02em", 'Black Iron'],
  ['B · 같은 글자체 이탤릭 — 더 흘려 쓴 결',
   "font-family:'Playfair Display',serif;font-style:italic;font-weight:400;letter-spacing:.01em", 'Black Iron'],
  ['C · 세리프 · 조금 굵게 (500) — 작은 자리에서 또렷하다',
   "font-family:'Playfair Display',serif;font-weight:500;letter-spacing:.02em", 'Black Iron'],
  ['D · 전부 대문자로 돌아간 판 — 앞에 쓰던 것 (비교용)',
   "font-family:'Barlow',sans-serif;font-weight:300;letter-spacing:.42em", 'BLACK IRON'],
];

const wordHtml = (css, size, text) => `
  <span style="${css};font-size:${size}px;color:var(--accent);white-space:nowrap">${text}</span>`;

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8" />
<title>BLACK IRON 로고</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400&family=Playfair+Display:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet" />
<style>
  :root {
    --accent: #eeb77d; --accent-hover: #f6d4ab; --accent-low: #b98a55;
    --bg: #0d0d0d; --panel: #141414; --border: #262626; --muted: #8a8a8a;
  }
  body { margin: 0; background: var(--bg); color: #e8e8e8; font-family: 'Barlow', system-ui, sans-serif; font-weight: 300; padding: 44px 24px 90px; }
  h1 { font-family: 'Barlow', sans-serif; font-weight: 300; letter-spacing: .34em; color: var(--accent); font-size: 17px; margin: 0 0 10px; }
  p.lead { color: var(--muted); font-size: 13px; line-height: 1.8; margin: 0 0 30px; max-width: 640px; }
  h2 { font-size: 11px; letter-spacing: .22em; color: var(--muted); text-transform: uppercase; margin: 34px 0 12px; font-weight: 400; }
  .row { border: 1px solid var(--border); background: var(--panel); border-radius: 12px; padding: 30px; margin-bottom: 12px; }
  .cap { color: var(--muted); font-size: 11px; letter-spacing: .16em; margin-bottom: 20px; }
  .light { background: #efeae2; }
  .light .cap { color: #6b6257; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 760px) { .pair { grid-template-columns: 1fr; } }
  .small { display: flex; align-items: center; gap: 28px; flex-wrap: wrap; }
  .splash-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (max-width: 900px) { .splash-row { grid-template-columns: 1fr; } }
  .splash { background: #0a0a0a; display: flex; flex-direction: column; align-items: center;
            justify-content: center; min-height: 300px; position: relative; overflow: hidden; }
  .splash .cap { position: absolute; top: 14px; left: 16px; }
  .splash .glow { position: absolute; width: 300px; height: 300px; border-radius: 50%;
                  background: radial-gradient(circle, rgba(238,183,125,0.15) 0%, transparent 70%); }
  .tagline { font-family: 'Playfair Display', serif; font-style: italic; color: var(--muted);
             margin-top: 12px; text-align: center; }
</style></head>
<body>
  <h1>BLACK IRON</h1>
  <p class="lead">브라우저 없이 그려서 뽑은 것입니다. 로고에서 눈으로 볼 것은 <b>글꼴이 어떻게 앉는가</b>뿐입니다.<br />
  먼저 <b>번쩍임</b>(금색 그라데이션 · 글자 그림자)을 걷어냈고, 그다음 <b>딱딱함</b>을 걷어냈습니다.<br />
  딱딱함은 각에서 옵니다 — 전부 대문자 · 넓은 자간 · 각진 도형 · 가르는 직선.
  그래서 <b>소문자 · 세리프 · 좁은 자간 · 링</b>으로 갔습니다.<br />
  아래 <b>A~D</b> 는 글자만 바꾼 판입니다. <b>D 가 조금 전까지 쓰던 것</b>이니 나란히 놓고 보세요.</p>

  <h2>지금 쓰는 것</h2>
  ${sizes.map(([label, props]) => `
  <div class="pair">
    <div class="row"><div class="cap">${label}</div>${draw(props)}</div>
    <div class="row light"><div class="cap">${label} · 밝은 바탕</div>${draw(props)}</div>
  </div>`).join('')}

  <h2>메인으로 넘어가기 전 화면 (스플래시)</h2>
  <p class="lead" style="margin-top:-6px">앱을 켤 때마다 보는 <b>유일하게 큰 로고</b>입니다.
  실제 화면처럼 <b>검은 바탕에 금빛 글로우</b>를 깔고 표어까지 같이 그렸습니다.
  가운데가 <b>지금 쓰는 크기(48)</b> 이고, 좌우는 견줘 보시라고 뒀습니다.</p>
  <div class="splash-row">
    ${[['앞에 쓰던 크기 (40)', 40], ['지금 (48)', 48], ['더 크게 (56)', 56]].map(([label, c]) => `
    <div class="row splash">
      <div class="cap">${label}</div>
      <div class="glow"></div>
      <div style="position:relative">${draw({ cap: c, variant: 'stack', subtitle: '' })}
        <div class="tagline" style="font-size:${Math.round(c * 0.30)}px">Forge your body · Break your limits</div>
      </div>
    </div>`).join('')}
  </div>

  <h2>넘어가는 동안 · 홈으로 돌아올 때</h2>
  <div class="pair">
    <div class="row"><div class="cap">넘어가는 동안 (32)</div>${draw({ cap: 32, variant: 'stack', subtitle: '' })}</div>
    <div class="row"><div class="cap">홈으로 돌아올 때 · 미니 (28)</div>${draw({ cap: 28, variant: 'row' })}</div>
  </div>

  <h2>글자체만 바꿔본 것 (마크는 그대로)</h2>
  ${wordVariants.map(([label, css, text]) => `
  <div class="row">
    <div class="cap">${label}</div>
    <div class="small">
      ${markOnly}
      ${wordHtml(css, 34, text)}
    </div>
    <div style="margin-top:22px">${wordHtml(css, 18, text)}</div>
  </div>`).join('')}

  <h2>홈 화면에 깔리는 크기 (아이콘)</h2>
  <div class="row">
    <div class="cap">48 · 60 · 96 · 192px</div>
    <div class="small">
      ${[48, 60, 96, 192].map((n) => `<img src="./icon.svg" width="${n}" height="${n}" alt="" />`).join('')}
    </div>
  </div>
</body></html>`;

const outDir = path.join(FE, '..', '.design');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'logo-blackiron.html'), html, 'utf-8');
// 아이콘을 옆에 같이 둔다 — 시안을 주소로 띄울 때(`.design` 을 뿌리로 서버를 열 때)
// 바깥 폴더는 못 읽는다
fs.copyFileSync(path.join(FE, 'public/icons/icon.svg'), path.join(outDir, 'icon.svg'));
fs.unlinkSync(OUT_JS);
console.log('뽑았습니다 → .design/logo-blackiron.html');
