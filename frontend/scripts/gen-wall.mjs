// 홈페이지의 **1년 벽 미리보기**를 미리 계산해 둔다 (2026-10-20).
//
//   npm run wall      (`npm run dev` · `npm run build` 앞에서 저절로 돈다)
//
// ── 왜 뽑아두나 ──
//
// 미리보기는 **앱의 계산**을 쓴다(`data/yearWall.js` 의 `buildYear`) — 각인 깊이를
// 가르는 규칙이 바뀌면 미리보기도 같이 바뀌어야 하니까. 그런데 그 계산을 **화면에서**
// 부르면 그 조각이 공개 홈페이지 첫 화면에 딸려 온다. 재보니 —
//
//     yearWall 0.8KB + weeklyReport 1.1KB + personalRecord 0.7KB + bodyPart 4.6KB
//     = **7.2KB(gzip)** · /site 첫 화면이 7.3KB → 15.1KB 로 두 배가 됐다
//
// `bodyPart` 가 4.6KB 인 까닭은 운동 이름을 부위로 옮기는 표가 거기 있어서다 —
// **예시 열두 판을 그리려고** 그 표를 받는 셈이다. 오늘 아침에 운동 사전 10.2KB 를
// 첫 화면에서 떼어낸 것과 똑같은 모양이다.
//
// 그래서 **빌드할 때 한 번 계산해서 숫자만 적어둔다.** 화면이 받는 것은 0.2KB 다.
// 규칙이 바뀌면 다음 빌드에서 다시 계산되고, 어긋나면 `npm run nav` 가 잡는다
// (`feedList.json` 을 뽑아두는 것과 같은 방식이다 — 10/6).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

// **묶어서 불러온다.** 앱 파일들은 확장자 없이 서로를 들여오는데(비테는 받는다)
// 노드 ESM 은 거기서 ERR_MODULE_NOT_FOUND 로 죽는다. 검사들이 쓰는 그 손이다
// (`check-heat.cjs` 등) — 앱 파일에 확장자를 달러 가지 않는다.
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), `gen-wall-${process.pid}.cjs`);
esbuild.buildSync({ entryPoints: ['src/data/yearWall.js'], bundle: true, format: 'cjs', outfile: tmp, platform: 'node' });
const { buildYear } = require(tmp);
fs.unlinkSync(tmp);

const OUT = path.resolve('src/data/sitePlates.json');
const YEAR = 2026;

// 예시 한 해. **무작위를 쓰지 않는다** — 다시 뽑을 때마다 벽이 바뀌면 그림이 아니라
// 소음이고, 뽑아둔 파일도 매번 달라져 커밋이 더러워진다.
//
// 모양은 **사람이 실제로 하는 꼴**로 둔다 — 주 3~4회 · 달 초에 사흘 이어서 ·
// 봄에 가장 무겁게 · 7월은 쉬고 · 10월까지만(지금이 10월이라는 뜻이다).
//
// 칸 이름은 **`weight`** 다. `kg` 로 적었다가 합계가 0 이 나와 **판 열둘이 전부 같은
// 깊이**였다 — `volumeOf` 가 보는 칸은 `weight` 다(`data/weeklyReport.js`).
function sampleYear(year) {
  const out = {};
  for (let m = 0; m < 10; m += 1) {
    if (m === 6) continue;                       // 7월은 쉰 달
    const days = m === 2 || m === 3 ? [2, 4, 6, 9, 11, 13, 16, 18, 20, 23, 25, 27]
      : m === 9 ? [1, 3, 6, 8, 10, 13, 15]       // 10월은 아직 중간
        // 달 초에 사흘 이어서 한다 — 그래야 「가장 길게 이어진 것」이 1일이 아니다
        : [2, 3, 4, 7, 9, 12, 14, 17, 19, 22, 24, 27];
    const base = m === 2 || m === 3 ? 92 : m === 7 ? 62 : 70 + m * 2;
    days.forEach((d, i) => {
      const date = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      out[date] = [{ weight: String(base + (i % 3) * 5), reps: 8 + (i % 2) * 2, sets: 4 }];
    });
  }
  return out;
}

const wall = buildYear(sampleYear(YEAR), YEAR);
const maxKg = Math.max(...wall.months.map((m) => m.kg), 1);

// 판마다 **깊이 하나**(0~1)만 적는다. 높이와 진하기로 바꾸는 일은 화면이 한다 —
// 그림의 결은 화면 쪽 일이고, 여기서 정할 것은 「그 달이 얼마나 무거웠나」뿐이다
const data = {
  note: '뽑아 적은 파일이다 — 손으로 고치지 않는다 (scripts/gen-wall.mjs)',
  year: YEAR,
  days: wall.total.days,
  longest: wall.total.longest,
  plates: wall.months.map((m) => Math.round((m.kg / maxKg) * 1000) / 1000),
};

const text = `${JSON.stringify(data, null, 2)}\n`;
const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
if (before !== text) fs.writeFileSync(OUT, text);
console.log(`[wall] ${YEAR}년 · ${data.days}일 · 가장 길게 ${data.longest}일 · 판 ${data.plates.filter((p) => p > 0).length}장 → src/data/sitePlates.json`);
