// 어느 주소가 어느 조각을 쓰는지 적어둔다 (2026-10-15)
//
//   npm run build 가 vite 뒤에 부른다 → dist/route-chunks.json
//
// ── 왜 ──
//
// 화면은 주소마다 따로 받는다(`lazy(() => import(...))`). 그래서 첫 화면이 뜨는 순서가
// 이렇게 된다 —
//
//   ① index.html 받는다
//   ② index.js · vendor · state · css 를 받는다   (index.html 에 적혀 있다)
//   ③ **그것을 실행한 뒤에야** 「/site 면 SiteHome 을 받아야 하네」를 알고 요청한다
//
// ③ 이 **왕복 한 번**이다. 배포본에 재보니 깨어 있을 때 한 왕복이 **180~200ms** 다
// (서울 → 오레곤). 첫 화면에서 그 시간 동안 아무것도 더 안 받는다.
//
// 그래서 그 주소로 들어온 사람에게는 **미리 적어 보낸다** —
// `<link rel="modulepreload" href="/assets/SiteHome-xxx.js">`. 브라우저가 HTML 을
// 읽는 그 자리에서 받기 시작하므로, ③ 의 왕복이 ② 와 겹친다.
//
// ── `Link:` 머리로 하지 않은 까닭 ──
//
// 서버가 머리만 붙이면 화면을 안 건드려서 깔끔한데, **모듈에는 안 맞다.**
// 모듈은 늘 CORS 모양으로 받는데 `Link: rel=preload; as=script` 는 그 모양이 달라서
// **같은 파일을 두 번 받을 수 있다.** `rel=modulepreload` 는 머리로는 안 먹는다
// (HTML 안에서만 쓴다). 두 번 받으면 고치려던 것보다 나빠진다.
//
// 그래서 **주소마다 HTML 을 빌드할 때 만들어 둔다.** 열여덟 줄을 붙여도 공짜다 —
// 미리 압축까지 해두고(`precompress.mjs` 가 뒤에 돈다) 서버는 집어 주기만 한다.
// `index.html` 은 그대로 남아 나머지 주소를 맡는다.
//
// ── 어떻게 ──
//
// vite 가 적어주는 manifest 를 읽는다. 그 안에 조각마다 **같이 필요한 조각**까지
// 적혀 있어서(`imports`), 그걸 따라가면 그 화면이 쓰는 것이 전부 나온다.

import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const MANIFEST = path.join(DIST, '.vite', 'manifest.json');

// 미리 알려줄 주소. **첫 화면이 될 수 있는 것만** 적는다 —
// 앱 안에서 옮겨 다닐 때는 이미 받아둔 조각이라 알려줄 것이 없다.
//
// 로그인 밖 넷(사람이 처음 닿는 자리) + 아래 탭 넷(앱을 열면 여기부터)
const ROUTES = {
  '/site': 'src/pages/SiteHome.jsx',
  '/login': 'src/pages/LoginPage.jsx',
  '/register': 'src/pages/RegisterPage.jsx',
  '/privacy': 'src/pages/PrivacyPage.jsx',
  '/home': 'src/pages/HomePage.jsx',
  '/train': 'src/pages/TrainPage.jsx',
  '/history': 'src/pages/HistoryPage.jsx',
  '/body': 'src/pages/BodyPage.jsx',
};

if (!fs.existsSync(MANIFEST)) {
  console.error('[route-chunks] manifest 가 없습니다 — vite.config.js 의 build.manifest 를 켜야 합니다');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));

/** 그 조각과 **같이 필요한 조각**을 따라간다 (중복 없이) */
function filesFor(key, seen = new Set()) {
  const entry = manifest[key];
  if (!entry || seen.has(key)) return [];
  seen.add(key);
  const out = ['/' + entry.file];
  for (const css of entry.css || []) out.push('/' + css);
  for (const dep of entry.imports || []) {
    // `index.html` 에 이미 적혀 있는 것(vendor · state · 엔트리)은 빼야 한다 —
    // 두 번 알려주면 브라우저가 같은 것을 두 번 받을 수 있다
    if (SHIPPED.has(dep)) continue;
    out.push(...filesFor(dep, seen));
  }
  return out;
}

// index.html 이 이미 적어 보내는 것들
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf-8');
const inHtml = new Set([...html.matchAll(/\/assets\/[A-Za-z0-9._-]+/g)].map((m) => m[0]));
const SHIPPED = new Set(
  Object.keys(manifest).filter((k) => inHtml.has('/' + manifest[k].file)),
);

/**
 * 그 화면의 manifest 열쇠를 찾는다.
 *
 * 보통은 소스 경로가 그대로 열쇠다(`src/pages/SiteHome.jsx`). 그런데 **여러 곳에서
 * 쓰이는 화면**은 vite 가 공용 조각으로 빼고 열쇠를 `_BodyPage-DTVnqJ0S.js` 로 적는다
 * — 소스 경로로는 못 찾는다. 그때는 파일 이름으로 찾는다.
 */
function keyFor(src) {
  if (manifest[src]) return src;
  const name = path.basename(src, path.extname(src));          // BodyPage
  const hit = Object.keys(manifest).find((k) => {
    const f = path.basename(manifest[k].file);
    return f.startsWith(name + '-') && f.endsWith('.js');
  });
  return hit || null;
}

const map = {};
let missing = 0;
for (const [route, src] of Object.entries(ROUTES)) {
  const key = keyFor(src);
  if (!key) {
    // **조용히 넘기지 않는다.** 파일 이름이 바뀌면 그 주소만 느려지는데,
    // 느려지는 것은 눈에 안 띈다
    console.error(`[route-chunks] manifest 에 ${src} 가 없습니다 (${route}) — 파일이 옮겨졌나요?`);
    missing += 1;
    continue;
  }
  const files = [...new Set(filesFor(key))].filter((f) => !inHtml.has(f));
  if (files.length) map[route] = files;
}

if (missing) process.exit(1);

// ── 주소마다 HTML 한 장 ──
//
// `index.html` 을 베껴 `</head>` 앞에 `modulepreload` 줄을 끼운다. 이름은 주소에서
// 딴다(`/support/notices` → `support__notices.html`) — 폴더를 만들지 않으려고
// 구분자를 바꿔 적는다. 서버가 같은 규칙으로 찾는다.
const OUT = path.join(DIST, 'route-html');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

export const fileFor = (route) => route.replace(/^\//, '').replace(/\//g, '__') + '.html';

let wrote = 0;
for (const [route, files] of Object.entries(map)) {
  const links = files
    .map((f) => `    <link rel="modulepreload" href="${f}" />`)
    .join('\n');
  const out = html.replace('</head>', `${links}\n  </head>`);
  if (out === html) {
    console.error('[route-chunks] index.html 에 </head> 가 없습니다 — 끼울 자리를 못 찾았습니다');
    process.exit(1);
  }
  fs.writeFileSync(path.join(OUT, fileFor(route)), out, 'utf-8');
  wrote += 1;
}

// 서버가 어느 주소에 그 HTML 이 있는지 알아야 한다. 파일을 훑어도 되지만,
// **적어두면 서버가 뜰 때 디스크를 덜 읽는다**(뜨는 시간은 깰 때마다 치르는 값이다)
fs.writeFileSync(
  path.join(DIST, 'route-chunks.json'),
  JSON.stringify({ routes: Object.keys(map), chunks: map }, null, 2),
  'utf-8',
);

const counts = Object.entries(map).map(([r, f]) => `${r} ${f.length}`).join(' · ');
console.log(`[route-chunks] 주소 ${wrote}개에 미리 받을 조각을 적어 넣었습니다 — ${counts}`);
