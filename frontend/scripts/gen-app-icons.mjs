// 안드로이드 앱 아이콘 · 첫 화면 그림을 `public/icons/icon.svg` 와 같은 그림으로 만든다.
//
//   node scripts/gen-app-icons.mjs && npx capacitor-assets generate --android
//
// 링 · 봉을 SVG 에서 손으로 옮겨 적었다. 아이콘을 바꾸면 여기 숫자도 같이 바꿀 것.
//
// **적응형 아이콘은 가운데 66% 만 안전하다.** 폰마다 동그라미 · 물방울 · 둥근 네모로 잘라서,
// 웹 아이콘 그대로(봉이 폭의 91%) 넣으면 봉 양끝이 잘린다. 그래서 전경은 0.68 로 줄인다
// (봉 끝까지 62%).
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const GOLD = '#eeb77d';
const PLATE = '#12100c';
const OUT = path.resolve('assets');

const mark = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <circle cx="256" cy="256" r="196" fill="none" stroke="${GOLD}" stroke-width="23"/>
    <path d="M34 256 H478" stroke="${GOLD}" stroke-width="23" stroke-linecap="round"/>
  </g>`;

const svg = (body, bg) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg ? `<rect width="512" height="512" fill="${bg}"/>` : ''}${body}</svg>`
);

fs.mkdirSync(OUT, { recursive: true });

const jobs = [
  // 적응형 전경 (투명) · 배경 (민색)
  ['icon-foreground.png', 1024, svg(mark(0.68))],
  ['icon-background.png', 1024, svg('', PLATE)],
  // 적응형을 못 쓰는 옛 폰용 — 네모 전체. 런처가 알아서 둥글린다
  ['icon-only.png', 1024, svg(mark(0.8), PLATE)],
  // 첫 화면 — 가운데에 작게. 앱은 늘 어두운 바탕이라 둘이 같다
  ['splash.png', 2732, svg(mark(0.3), PLATE)],
  ['splash-dark.png', 2732, svg(mark(0.3), PLATE)],
];

for (const [name, size, input] of jobs) {
  await sharp(input, { density: Math.ceil((72 * size) / 512) })
    .resize(size, size)
    .png()
    .toFile(path.join(OUT, name));
  console.log(`[icons] ${name} ${size}px`);
}
