// 첫 화면에 얼마나 받나 (2026-09-22).
//
//   npm run weight     (npm run check 에도 들어 있다 — 빌드한 뒤에만 잰다)
//
// ── 왜 재나 ──
//
// 앱을 처음 여는 사람은 **아무것도 안 하고 기다린다.** 그 시간은 받는 양에 비례하고,
// 받는 양은 **아무도 안 볼 때 조용히 자란다** — 부품 하나를 `import` 로 붙이면
// 그날부터 모든 사람이 그것을 첫 화면에서 받는다.
//
// 9/22 에 껍데기(`Layout`)가 비밀번호 모달 · 계정 삭제 모달 · 계정 시트 · 사진 줄이는
// 코드까지 들고 있었다. 넷 다 **눌러야 열리는 것**인데 첫 화면에 얹혀 있었다.
// 늦게 받게 바꾸니 112KB → 98KB 로 줄었다(gzip 37.1 → 33.3KB).
//
// ── 여기서 보는 것 ──
//
// **첫 화면이 받는 세 덩어리**(vendor · index · state)의 gzip 합. 이것이 넘으면
// 「왜 늘었나」를 그때 보게 한다 — 늘리지 말라는 것이 아니라, **모르고 늘리지 말라**는 것이다.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIST = path.join(__dirname, '..', 'dist', 'assets');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

if (!fs.existsSync(DIST)) {
  console.log('dist 가 없습니다 — `npm run build` 를 먼저 하세요 (건너뜁니다)');
  process.exit(0);
}

const files = fs.readdirSync(DIST);
const gzipOf = (f) => zlib.gzipSync(fs.readFileSync(path.join(DIST, f))).length;

// 첫 화면이 받는 것: 껍데기(index) + 라이브러리(vendor) + 스토어(state).
// 화면들은 `lazy` 라 그때그때 받는다
const pick = (re) => files.filter((f) => re.test(f)).sort((a, b) => fs.statSync(path.join(DIST, b)).size - fs.statSync(path.join(DIST, a)).size)[0];
const idx = pick(/^index-.*\.js$/);
const vendor = pick(/^vendor-.*\.js$/);
const state = pick(/^state-.*\.js$/);

console.log('── 첫 화면이 받는 것 (gzip) ──');
const sizes = { index: gzipOf(idx), vendor: gzipOf(vendor), state: gzipOf(state) };
const totalKb = Math.round(((sizes.index + sizes.vendor + sizes.state) / 1024) * 10) / 10;
console.log(`   껍데기 ${(sizes.index / 1024).toFixed(1)}KB · 라이브러리 ${(sizes.vendor / 1024).toFixed(1)}KB · 스토어 ${(sizes.state / 1024).toFixed(1)}KB`);
console.log(`   합 ${totalKb}KB`);

// 9/22 에 잰 값은 103.5KB 다. 15% 여유를 두고 **120KB** 에서 걸린다 —
// 여유를 안 두면 한 줄 고칠 때마다 이 검사가 울고, 그러면 아무도 안 본다
const CAP_KB = 120;
ok(`첫 화면이 ${CAP_KB}KB 를 안 넘는다`, totalKb <= CAP_KB, true);

// ── 눌러야 열리는 것이 첫 화면에 얹혀 있나 ──
//
// 크기만 보면 **왜 늘었는지**를 모른다. 늘 같은 자리에서 늘어나므로 그 자리를 짚어둔다
console.log('── 눌러야 열리는 것은 늦게 받는다 ──');
const layout = fs.readFileSync(path.join(__dirname, '..', 'src/components/Layout.jsx'), 'utf-8');
for (const [name, mod] of [
  ['비밀번호 모달', 'PasswordChangeModal'],
  ['계정 삭제 모달', 'AccountDeleteModal'],
  ['계정 시트', 'AccountSheet'],
]) {
  ok(`${name} 은 열 때 받는다`, new RegExp(`lazy\\(\\(\\) => import\\('\\./${mod}'\\)\\)`).test(layout), true);
}
// 사진을 줄이는 코드는 캔버스를 다루는 덩어리다 — 사진을 한 번도 안 올리는 사람에게
// 첫 화면에서 받게 할 이유가 없다
ok('사진 줄이기는 고를 때 받는다', /await import\('\.\.\/data\/shrinkImage'\)/.test(layout), true);
ok('  첫 화면에서 안 받는다', /^import .*shrinkImage/m.test(layout), false);

console.log('');
console.log(bad ? bad + '건 어긋남' : '모두 통과');
process.exitCode = bad ? 1 : 0;
