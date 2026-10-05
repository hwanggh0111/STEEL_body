// 안드로이드 그림 중에서 **똑같은 것 한 벌**을 치운다 (2026-10-05).
//
//   npm run trim        (`npm run android:icons` 뒤에 자동으로 돈다)
//
// ── 왜 ──
//
// `capacitor-assets` 는 스플래시를 **낮용과 밤용 두 벌**로 만든다. 그런데 이 앱은
// **다크 테마 하나뿐**이라(globals.css) 밤 배경색을 낮과 같은 `#12100c` 로 줬고,
// 그래서 나온 13장이 낮 것과 **md5 까지 똑같았다.** 순수 중복 512KB 다.
//
// 릴리스 APK 1.56MB → 1.25MB, 번들 1.82MB → 1.56MB 로 줄었다.
//
// 안드로이드는 `-night-` 폴더가 없으면 그냥 기본 폴더를 쓴다. 다크 모드에서도
// 같은 그림이 나오고, 그게 원래 의도였다.
//
// ── 왜 스크립트로 두나 ──
//
// 손으로 지우면 **`npm run android:icons` 를 한 번만 돌려도 그대로 되살아난다.**
// 아이콘을 다시 만드는 날은 보통 아이콘만 보지 res 폴더를 세지 않는다.
//
// **같은 파일일 때만 지운다.** 언젠가 라이트 테마를 들이면 두 그림이 달라지고,
// 그때는 이 스크립트가 아무것도 안 한다 — 다른 그림을 지우면 밤에 흰 화면이 뜬다.

import { readdirSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const RES = resolve('android/app/src/main/res');

if (!existsSync(RES)) {
  console.log('[trim] android/ 가 없습니다 — 건너뜁니다');
  process.exit(0);
}

const md5 = (p) => createHash('md5').update(readFileSync(p)).digest('hex');

/** `drawable-port-night-xxhdpi` → `drawable-port-xxhdpi` */
const dayName = (night) => night.replace('-night-', '-').replace(/-night$/, '');

let freed = 0;
const removed = [];
const kept = [];

for (const dir of readdirSync(RES)) {
  if (!dir.includes('night')) continue;
  const nightDir = join(RES, dir);
  if (!statSync(nightDir).isDirectory()) continue;

  const dayDir = join(RES, dayName(dir));
  if (!existsSync(dayDir)) { kept.push(`${dir} (낮 폴더가 없다)`); continue; }

  const files = readdirSync(nightDir);
  // 한 장이라도 다르면 **그 폴더는 통째로 둔다** — 반만 지우면 더 헷갈린다
  const allSame = files.length > 0 && files.every((f) => {
    const d = join(dayDir, f);
    return existsSync(d) && md5(join(nightDir, f)) === md5(d);
  });

  if (!allSame) { kept.push(`${dir} (그림이 다르다)`); continue; }

  for (const f of files) freed += statSync(join(nightDir, f)).size;
  rmSync(nightDir, { recursive: true, force: true });
  removed.push(dir);
}

if (removed.length) {
  console.log(`[trim] 낮 것과 똑같은 밤 폴더 ${removed.length}개 지움 · ${(freed / 1024).toFixed(0)}KB`);
} else {
  console.log('[trim] 지울 중복 없음');
}
for (const k of kept) console.log(`[trim] 남김 — ${k}`);
