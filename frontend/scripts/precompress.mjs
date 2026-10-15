// 빌드한 것을 **미리 압축해 둔다** (2026-10-13)
//
// 여태 서버가 요청마다 압축했다. 그런데 Render 무료 판은 CPU 가 0.1 코어다 —
// 요청마다 압축하려면 품질을 낮게 쓸 수밖에 없고, 그래서 **브로틀리가 gzip 보다
// 오히려 컸다** (배포본에서 재봤다: vendor 가 br 52.60KB · gzip 51.75KB).
//
// 압축은 **빌드할 때 한 번** 하면 된다. 내용으로 이름을 지은 파일(`-a1b2c3d4.js`)은
// 영영 안 변하므로, 그 압축본도 영영 그대로다. 품질을 제일 높게 써도 값이 안 든다.
//
//   빌드할 때   br 품질 11 · gzip 9 로 한 번    (몇 초)
//   요청할 때   파일을 그냥 집어 준다            (0ms, CPU 0)
//
// 서버 쪽은 `backend/src/index.js` 의 `preCompressed` 가 받는다 — 브라우저가
// 받겠다고 한 것 중에 더 작은 쪽을 준다.
//
// 실행: npm run build 가 끝에서 자동으로 돈다.

import { promises as fs } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompress, gzip, constants } from 'node:zlib';
import { promisify } from 'node:util';

const br = promisify(brotliCompress);
const gz = promisify(gzip);

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, '../dist');

// 압축해서 이득이 있는 것만. 그림(png·jpg·webp)과 글꼴(woff2)은 이미 압축돼 있어
// 다시 압축하면 **커지거나 그대로**다 — 그런 파일에 두 벌을 더 두면 디스크만 먹는다
// **서버 쪽 목록(backend/src/index.js 의 PRECOMPRESS_EXT)과 맞춰둔다.**
// 한쪽에만 적으면 만들어 놓고 안 쓰거나, 쓰려는데 없다
const WORTH = new Set(['.js', '.css', '.html', '.svg', '.json', '.webmanifest', '.map', '.txt', '.xml']);

// 1KB 아래는 건드리지 않는다. 헤더 몇 줄 값어치도 안 되고, 압축하면 커지는 일도 있다
const MIN = 1024;

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

let n = 0;
let before = 0;
let afterBr = 0;
let afterGz = 0;

try {
  await fs.access(DIST);
} catch {
  console.log('[precompress] dist 가 없습니다 — 빌드를 먼저 합니다');
  process.exit(0);
}

for await (const file of walk(DIST)) {
  const ext = extname(file);
  if (!WORTH.has(ext)) continue;
  // 이미 만든 압축본은 건너뛴다 (두 번 돌려도 같은 결과여야 한다)
  if (file.endsWith('.br') || file.endsWith('.gz')) continue;
  const buf = await fs.readFile(file);
  if (buf.length < MIN) continue;

  const [b, g] = await Promise.all([
    br(buf, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11,
        [constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
      },
    }),
    gz(buf, { level: 9 }),
  ]);

  // 압축본이 원본보다 크면 안 쓴다 (작은 파일에서 생긴다)
  if (b.length < buf.length) await fs.writeFile(file + '.br', b);
  if (g.length < buf.length) await fs.writeFile(file + '.gz', g);

  n += 1;
  before += buf.length;
  afterBr += Math.min(b.length, buf.length);
  afterGz += Math.min(g.length, buf.length);
}

const kb = (x) => (x / 1024).toFixed(1) + 'KB';
console.log(
  `[precompress] ${n}개 · 원본 ${kb(before)} → br ${kb(afterBr)} · gzip ${kb(afterGz)}`
);
