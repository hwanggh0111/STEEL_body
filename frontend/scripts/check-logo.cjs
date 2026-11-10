// **로고가 한 벌인가** (2026-11-10).
//
//   npm run logo     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 주인이 새 엠블럼을 주고 안 열다섯 중 「세로 잠금」을 골라 UI 로 옮겼다.
// 화면 쪽은 `Logo.jsx` 하나를 고치면 끝이지만 **로고는 화면에만 있는 것이 아니다** —
// 파비콘 · 앱 아이콘 · 애플 아이콘 · 공유 카드 · 알림 아이콘이 **각자 파일**이다.
//
// 오늘 공유 카드를 열어보니 **옛 로고(가는 링에 봉 하나 · Black Iron 세리프)**가
// 그대로 그려져 있었다. 화면만 바꿨으면 **링크 미리보기만 옛 로고**가 될 참이었다.
// 오늘 아침에 고친 「이름이 두 벌」과 **같은 류**다 — 같은 것을 여러 파일에 따로
// 두면 어느 순간 한쪽만 바뀐다.
//
// ── 무엇을 보는가 ──
//
// ⑴ 화면이 **한 자리**에서 로고를 받는가 — `Logo.jsx` 말고 다른 데서 마크를 그리지 않는가
// ⑵ 마크 그림이 **있고 비례가 맞는가**(404 × 373). 정사각으로 넣으면 눌린다
// ⑶ `index.html` · `manifest.json` 이 가리키는 아이콘 파일이 **실재하는가**
//    (옛 `icon.svg` 를 지웠으므로 가리키는 쪽이 남아 있으면 404 가 된다)
// ⑷ 아이콘·공유카드가 **옛 로고 시절 것이 아닌가** — 파일이 바뀌었는지 크기로 본다
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
// 주석을 뗀 알맹이 — 머리글에 적어둔 말이 자를 통과시키면 안 된다
const codeOf = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
// ★ HTML 주석도 떼야 한다. 첫 판이 **내가 `index.html` 주석에 적어둔
// 「`icon.svg` 는 지웠다」는 말**을 잡아 거짓 FAIL 을 냈다 — 코드가 아니라 자를 고쳤다.
// 오늘 `npm run brand` 에서도 같은 자리를 밟았다(옛 이름을 설명하는 줄을 잡았다)
const markupOf = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

/** PNG 머리에서 폭·높이를 읽는다 (IHDR 은 늘 같은 자리에 있다) */
function pngSize(rel) {
  const b = fs.readFileSync(path.join(ROOT, rel));
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

console.log('── 화면이 한 자리에서 받는가 ──');
{
  const logo = codeOf(read('src/components/Logo.jsx'));
  ok('마크 그림을 들인다', /\/images\/mark\.png/.test(logo), true);
  ok('비례를 상수로 둔다 (정사각이 아니다)', /MARK_RATIO\s*=\s*373\s*\/\s*404/.test(logo), true);
  ok('작은 자리 선을 적어뒀다', /MARK_MIN/.test(logo) && /LOCKUP_MIN/.test(logo), true);
  ok('세로 잠금 갈래가 있다', /'stack'/.test(logo), true);
  ok('설명 줄 기본값이 한국어다', /subtitle = '적은 것을 몸으로'/.test(logo), true);

  // ★ **다른 데서 마크를 또 그리면 안 된다** — 두 벌이 되는 첫걸음이 그것이다
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) walk(rel, out);
      else if (/\.jsx?$/.test(e.name)) out.push(rel);
    }
    return out;
  };
  const others = [];
  for (const f of walk('src')) {
    if (f.endsWith('components/Logo.jsx')) continue;
    const s = codeOf(read(f));
    if (/\/images\/mark\.png/.test(s)) others.push(f);
  }
  ok('★ 마크를 그리는 자리가 Logo.jsx 하나다', others, []);
}

console.log('');
console.log('── 마크 그림 ──');
{
  ok('파일이 있다', exists('public/images/mark.png'), true);
  const s = exists('public/images/mark.png') ? pngSize('public/images/mark.png') : null;
  ok('크기가 404 × 373 이다 (빈 자리를 뗀 테두리 상자)', s, { w: 404, h: 373 });
}

console.log('');
console.log('── 가리키는 아이콘이 실재하는가 ──');
{
  const html = markupOf(read('index.html'));
  const refs = [...html.matchAll(/href="(\/icons\/[^"]+)"/g)].map((m) => m[1]);
  const mani = JSON.parse(read('public/manifest.json'));
  for (const i of mani.icons) refs.push(i.src);
  // 공유 카드는 주소로 적혀 있다 — 파일 이름만 떼어 본다
  const og = /og:image"\s+content="[^"]*?(\/images\/[^"]+)"/.exec(html);
  if (og) refs.push(og[1]);

  const 없는것 = [...new Set(refs)].filter((r) => !exists('public' + r));
  ok('★ 가리키는 파일이 전부 있다', 없는것, []);
  ok('  옛 icon.svg 를 더 안 가리킨다', /icon\.svg/.test(html + JSON.stringify(mani)), false);
  ok('  그 파일도 지웠다', exists('public/icons/icon.svg'), false);
}

console.log('');
console.log('── 아이콘이 새 마크로 다시 떠 있는가 ──');
{
  // 옛 아이콘은 선그림이라 가볍다. 새 마크는 음영이 있어 그보다 무겁다 —
  // 크기로 보는 것은 거칠지만, **안 바꾸고 넘어간 파일**은 이 선에서 걸린다
  const must = [
    ['public/icons/icon-512.png', 512],
    ['public/icons/icon-192.png', 192],
    ['public/icons/icon-32.png', 32],
    ['public/icons/apple-touch-icon-180.png', 180],
  ];
  for (const [rel, side] of must) {
    ok(path.basename(rel) + ' 가 ' + side + '×' + side + ' 다', pngSize(rel), { w: side, h: side });
  }
  const card = pngSize('public/images/share-card.png');
  ok('공유 카드가 1024 × 500 이다', card, { w: 1024, h: 500 });
  // ★ 옛 카드는 27,958바이트였다. 새 카드는 음영이 있어 그보다 크다
  const bytes = fs.statSync(path.join(ROOT, 'public/images/share-card.png')).size;
  ok('  옛 카드(27,958바이트) 그대로가 아니다', bytes !== 27958, true);
  console.log('     지금 ' + bytes.toLocaleString() + '바이트');
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
