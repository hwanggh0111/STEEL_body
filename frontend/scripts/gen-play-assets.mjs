// 플레이스토어 **등록정보**에 올리는 그림 두 장을 만든다 (2026-10-09).
//
//   node scripts/gen-play-assets.mjs     →  assets/play/
//
// 콘솔이 요구하는 규격이고 둘 다 **없으면 출시 단추가 안 눌린다.**
//
//   icon-512.png            512×512   투명 안 됨 (32비트 PNG)
//   feature-1024x500.png   1024×500   투명 안 됨. 스토어 맨 위에 걸린다
//
// 그림은 `gen-app-icons.mjs` 의 마크(링 + 봉)와 **같은 숫자**를 쓴다 — 앱 아이콘과
// 스토어 그림이 다르면 같은 앱으로 안 읽힌다. 마크를 바꾸면 양쪽을 같이 고칠 것.
//
// 글자체는 `Logo.jsx` 가 적어둔 사슬의 **대비책**(Times New Roman 흘림)으로 앉는다 —
// Playfair Display 는 구글 폰트에서 받아 쓰는 것이라 이 자리(sharp)에는 없다.
// 세리프 흘림이라는 결은 같다.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const GOLD = '#eeb77d';
const PLATE = '#12100c';
const OUT = path.resolve('assets/play');

// 링 + 봉. 512 격자에 그려 두고 바깥에서 옮긴다 (gen-app-icons.mjs 와 같은 숫자)
const mark = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <circle cx="256" cy="256" r="196" fill="none" stroke="${GOLD}" stroke-width="23"/>
    <path d="M34 256 H478" stroke="${GOLD}" stroke-width="23" stroke-linecap="round"/>
  </g>`;

fs.mkdirSync(OUT, { recursive: true });

// ── 1. 스토어 아이콘 512 ──
// 적응형이 아니라 **네모 한 장**이다 (스토어가 알아서 둥글린다). 앱의 `icon-only` 와 같은 0.8
const icon = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">`
  + `<rect width="512" height="512" fill="${PLATE}"/>${mark(0.8)}</svg>`
);

// ── 2. 상단 그래픽 1024×500 ──
// 왼쪽에 마크, 오른쪽에 이름과 한 줄. **가운데를 비워 두지 않는다** — 스토어는 이 그림
// 위에 아무것도 안 얹으니 안전구역을 걱정할 자리가 없다
const feature = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <rect width="1024" height="500" fill="${PLATE}"/>
  <g transform="translate(96 122) scale(0.5)">${mark(0.8)}</g>
  <text x="420" y="232" fill="${GOLD}"
        font-family="Times New Roman, Georgia, serif" font-style="italic" font-size="104">Black Iron</text>
  <path d="M422 268 H840" stroke="${GOLD}" stroke-width="2" opacity="0.5"/>
  <text x="422" y="322" fill="#b9b1a4"
        font-family="Malgun Gothic, Arial, sans-serif" font-size="34">한 세트부터 적는 운동기록</text>
</svg>`);

const jobs = [
  ['icon-512.png', icon, 512, 512],
  ['feature-1024x500.png', feature, 1024, 500],
];

for (const [name, input, w, h] of jobs) {
  await sharp(input, { density: Math.ceil((72 * w) / 1024) * 4 })
    .resize(w, h)
    // 스토어는 **투명을 받지 않는다** — 민색을 뒤에 깐다
    .flatten({ background: PLATE })
    .png()
    .toFile(path.join(OUT, name));
  console.log(`[play] ${name} ${w}×${h}`);
}
