// APK 안에 실을 **껍데기만** 만든다 (2026-10-05).
//
//   npm run shell     (`npm run android` 가 cap sync 앞에서 부른다)
//
// ── 왜 ──
//
// 안드로이드 앱은 화면을 **APK 안에 싣지 않고 서버 주소를 연다**
// (`capacitor.config.ts` 머리글 — 로그인 쿠키가 `sameSite: strict` 라서다).
// 그러니 APK 안의 웹 자산 중 **실제로 쓰는 것은 `app-offline.html` 한 장**뿐이다 —
// 서버에 못 닿을 때 보여주는 화면이다.
//
// 그런데 `webDir: 'dist'` 라서 **빌드 결과 전체가 APK 에 들어갔다.** 9/15 에 만든
// APK 를 뜯어보니 `assets/public/` 아래에 파일 55개, 0.87MB 가 있었다 —
// AdminPage · FeedList · vendor 163KB 까지. 한 번도 안 읽히는 것들이고,
// 게다가 **그때 빌드본이 그대로 굳어 있다** (서버 화면은 그동안 수십 번 바뀌었다).
// 앱 안에 옛 화면이 한 벌 잠들어 있는 셈이라, 언젠가 둘 중 어느 것을 보고 있는지
// 헷갈릴 자리이기도 하다.
//
// 그래서 `webDir` 을 이 폴더로 돌린다. 들어가는 것은 두 장뿐이다.
//
// ── index.html 은 왜 두나 ──
//
// 서버 주소를 여니 이 파일은 **아무도 안 본다.** 그런데 cap 은 webDir 에
// index.html 이 있어야 한다고 본다. 비워두면 혹시 열렸을 때 흰 화면이 되므로,
// 같은 안내문을 넣어 둔다.
//
// **손으로 고치지 않는다.** 원본은 `public/app-offline.html` 이고 여기는 베낀 것이다.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve('public/app-offline.html');
const OUT = resolve('shell');

if (!existsSync(SRC)) {
  console.error(`[shell] ${SRC} 가 없습니다 — 껍데기를 만들 수 없어요`);
  process.exit(1);
}

const html = readFileSync(SRC, 'utf-8');

// 통째로 다시 만든다 — 예전에 넣었다 뺀 파일이 남아 APK 로 따라가지 않게
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

writeFileSync(resolve(OUT, 'app-offline.html'), html, 'utf-8');
writeFileSync(resolve(OUT, 'index.html'), html, 'utf-8');

const kb = (Buffer.byteLength(html, 'utf8') * 2 / 1024).toFixed(1);
console.log(`[shell] 2장 · ${kb}KB → shell/  (APK 에 실리는 전부)`);
