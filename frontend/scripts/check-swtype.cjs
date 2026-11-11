// **서비스워커가 받은 것의 종류를 보고 담는가** (2026-11-11).
//
//   npm run swtype       (npm run check 에도 들어 있다)
//
// ── 왜 자로 두나 ──
//
// 서비스워커는 **사람의 폰 안에 남는다.** 한 번 잘못 담으면 그 사람은 다음 배포까지
// 흰 화면을 본다 — 11/11 에 정석이 올린 그 길이다: 없는 조각이 `index.html` 을
// 200 으로 받고(서버 쪽은 같은 날 404 로 끊었다), 해시 박힌 이름은 **캐시 우선**이라
// 그 HTML 이 `.js` 주소로 담기면 **새로고침으로도 회복이 안 된다.**
//
// 그런데 서비스워커는 브라우저 안에서만 돌아 자로 부르기가 어렵다. 그래서
// **`sw.js` 에서 판단하는 함수(`bodyFits`)만 잘라내 그 자리에서 돌린다** —
// 쓰이는 코드 그대로를 보는 것이고, 꼴만 베껴 본 것이 아니다.
//
// 그리고 **그 함수를 실제로 부르는지**까지 본다(아래 「부르는 자리」) — 함수만
// 멀쩡하고 아무도 안 부르면 그것이 바로 「조용히 없는 기능」이다.
const fs = require('fs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const SRC = fs.readFileSync('public/sw.js', 'utf-8');
const code = SRC
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');

// ── 그 두 조각을 잘라낸다 (표 + 함수) ──
const table = /const BODY_TYPE = \{[\s\S]*?\n\};/.exec(code);
const fn = /function bodyFits\(pathname, res\) \{[\s\S]*?\n\}/.exec(code);
if (!table || !fn) {
  console.log('FAIL `sw.js` 에서 `BODY_TYPE` · `bodyFits` 를 못 찾았습니다 — 이름이 바뀌었으면 이 자도 고쳐야 합니다');
  process.exit(1);
}
// eslint-disable-next-line no-new-func
const bodyFits = new Function(`${table[0]}\n${fn[0]}\nreturn bodyFits;`)();

/** 응답 흉내 — 서비스워커가 보는 것은 `headers.get('content-type')` 하나다 */
const res = (type) => ({ headers: { get: (k) => (k.toLowerCase() === 'content-type' && type !== null ? type : null) } });

console.log('── ★ 스크립트 자리에 온 HTML 을 담지 않는다 ──');
ok('**없는 조각이 받은 HTML** → 안 담는다',
  bodyFits('/assets/index-OLDOLD12.js', res('text/html; charset=utf-8')), false);
ok('  스타일 자리의 HTML 도', bodyFits('/assets/style-a1b2c3d4.css', res('text/html')), false);
ok('  글자꼴 자리의 HTML 도', bodyFits('/assets/font-a1b2c3d4.woff2', res('text/html')), false);
ok('  그림 자리의 HTML 도', bodyFits('/icons/icon-192.png', res('text/html')), false);
ok('  JSON 자리의 HTML 도', bodyFits('/feed-detail.json', res('text/html')), false);

console.log('');
console.log('── 제 종류로 온 것은 그대로 담는다 ──');
ok('조각', bodyFits('/assets/index-DkeTsJR5.js', res('application/javascript')), true);
ok('  `text/javascript` 도 같은 것이다', bodyFits('/assets/i-DkeTsJR5.js', res('text/javascript; charset=utf-8')), true);
ok('  스타일', bodyFits('/assets/i-DkeTsJR5.css', res('text/css')), true);
ok('  글자꼴', bodyFits('/assets/i-DkeTsJR5.woff2', res('font/woff2')), true);
ok('  그림', bodyFits('/icons/icon-192.png', res('image/png')), true);
ok('  svg', bodyFits('/images/mark.svg', res('image/svg+xml')), true);
ok('  json', bodyFits('/manifest.json', res('application/manifest+json')), true);
ok('  wasm', bodyFits('/wasm/vision.wasm', res('application/wasm')), true);

console.log('');
console.log('── 화면 문서와 모르는 것은 건드리지 않는다 ──');
// 확장자가 없는 주소는 **화면**이다. 여기서 false 를 내면 **앱 자체가 캐시에 안 들어간다**
ok('화면 주소는 통과시킨다', [bodyFits('/', res('text/html')), bodyFits('/home', res('text/html')),
  bodyFits('/support/notices', res('text/html'))], [true, true, true]);
ok('  모르는 확장자는 통과시킨다 (우리가 정할 일이 아니다)',
  bodyFits('/files/report.xyz', res('application/octet-stream')), true);
// ★ **종류를 안 적어 보낸 것은 막지 않는다.** 나는 처음에 막는 쪽으로 적었고,
// 그러자 **먼저 서 있던 자(`npm run sw`)가 잡았다** — 그 자의 흉내 응답에는
// 머리글이 아예 없어서 조각이 두 번째부터도 네트워크를 탔다. 막아서 얻는 것도
// 없다: 이 결함은 `text/html` 이 **분명히 적혀서** 생긴 것이다
ok('  종류를 안 적어 보낸 응답은 막지 않는다', bodyFits('/assets/i-DkeTsJR5.js', res(null)), true);
ok('    머리글이 아예 없는 응답도 (옛 자의 흉내가 그렇다)',
  bodyFits('/assets/i-DkeTsJR5.js', { status: 200 }), true);
ok('  응답이 없으면 담지 않는다', bodyFits('/assets/i-DkeTsJR5.js', null), false);

console.log('');
console.log('── ★ 부르는 자리가 있는가 (함수만 멀쩡하면 뜻이 없다) ──');
// 해시 박힌 조각 갈래 — **담을 때와 읽을 때** 둘 다 봐야 한다
const hashBranch = /if \(sameOrigin && \/\\\/assets[\s\S]*?\n  \}/.exec(code);
ok('해시 조각 갈래를 찾았다', !!hashBranch, true);
if (hashBranch) {
  const b = hashBranch[0];
  ok('  담기 전에 본다', /res\.status === 200 && res\.type === 'basic'\s*&& bodyFits\(/.test(b), true);
  ok('  ★ **담아둔 것도 읽을 때 본다**', /hit && !bodyFits\(/.test(b), true);
  ok('    어긋난 것은 버린다', /caches\.open\(CACHE_NAME\)\.then\(\(c\) => c\.delete\(req\)\)/.test(b), true);
}
ok('나머지 길도 담기 전에 본다',
  /sameOrigin && response\.status === 200 && response\.type === 'basic'\s*&& bodyFits\(url\.pathname, response\)/.test(code), true);
ok('  부르는 자리가 셋이다 (담기 · 읽기 · 나머지 길)', (code.match(/bodyFits\(/g) || []).length - 1, 3);

console.log('');
console.log('── 옛 캐시는 배포마다 버려진다 (이미 담아버린 사람이 낫는 길) ──');
// `CACHE_NAME` 은 빌드가 타임스탬프로 바꿔 끼운다 → 배포마다 이름이 달라지고,
// `activate` 가 다른 이름을 전부 지운다. 그 둘이 **같이** 있어야 회복이 된다
ok('이름을 빌드가 바꿔 끼운다', /__SW_VERSION__/.test(code), true);
ok('  다른 이름의 캐시를 지운다', /cacheNames[\s\S]{0,200}filter\(\(name\) => name !== CACHE_NAME\)[\s\S]{0,80}caches\.delete\(name\)/.test(code), true);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
