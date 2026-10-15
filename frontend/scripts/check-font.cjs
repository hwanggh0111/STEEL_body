// 한글이 기기 기본 글꼴로 떨어지는 자리를 잡는다 (2026-10-06).
//
// **여기가 조용히 되돌아가는 자리다.** 앱 본문은 여태
// `font-family: 'Barlow', sans-serif` 였는데 **Barlow 에는 한글이 한 자도 없다.**
// 그래서 글자의 거의 전부가 기기 기본 글꼴로 떨어졌고(윈도우 맑은 고딕 ·
// 안드로이드 Roboto 대체 · 아이폰 Apple SD Gothic), **기기마다 다른 앱으로
// 보였다.** 검정과 금색은 골라뒀는데 글자는 고른 것이 아니었다.
//
// 10/6 에 171 자리를 한 번에 고쳤다. 그런데 글꼴 스택은 **새 화면을 짤 때마다
// 손으로 적는 줄**이다 — 다음에 누가 `fontFamily: "'Bebas Neue', sans-serif"` 를
// 한 줄 적으면 그 화면의 한글만 혼자 기기 기본으로 떨어진다. 그러면 화면 하나가
// 다른 글꼴로 보이는데, **그게 눈에 띄려면 그 화면을 폰에서 열어봐야 한다.**
//
// 그래서 못을 박는다. 라틴 글꼴 뒤에 한글 글꼴이 없으면 실패한다.
const fs = require('fs');
const path = require('path');

// 한글이 없는 글꼴들. 이것만 적고 끝내면 한글이 떨어진다
const LATIN_ONLY = ['Bebas Neue', 'Barlow', 'Playfair Display'];
// 한글을 받는 글꼴. 라틴 글꼴 뒤 어딘가에 이 중 하나가 있어야 한다
const KOREAN = ['IBM Plex Sans KR', 'Nanum Myeongjo'];

const ROOT = path.join(__dirname, '..', 'src');
const EXT = new Set(['.jsx', '.js', '.css']);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name))) out.push(full);
  }
  return out;
}

// 글자가 **영문으로 박혀 있는 자리**는 예외다 — 로고(`blackiron`)와 스플래시
// 표어가 그렇다. 거기에 한글 글꼴을 붙여도 쓰이는 일이 없다.
//
// **예외를 이 파일에 적지 않는다.** 여기에 파일 이름을 적어두면 그 자리를 고치는
// 사람은 예외인 줄을 모른다. 그 줄 **바로 위에 `라틴 전용` 이라고 적게** 한다 —
// 왜 예외인지가 고치는 사람 눈앞에 있다.
const OPT_OUT = '라틴 전용';

const bad = [];
let allowed = 0;

for (const file of walk(ROOT)) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // 글꼴을 적은 줄만 본다
    if (!/font-family|fontFamily/i.test(line)) return;
    const latin = LATIN_ONLY.find((f) => line.includes(f));
    if (!latin) return;
    if (KOREAN.some((f) => line.includes(f))) return;
    // 그 줄이나 바로 윗줄에 적어둔 예외
    if (line.includes(OPT_OUT) || (i > 0 && lines[i - 1].includes(OPT_OUT))) {
      allowed += 1;
      return;
    }
    bad.push({
      file: path.relative(path.join(__dirname, '..'), file).split(path.sep).join('/'),
      line: i + 1,
      latin,
      text: line.trim().slice(0, 100),
    });
  });
}

console.log('── 한글이 떨어지는 자리가 있나 ──');


// ── 첫 화면에서 받는 글꼴이 다시 불어나지 않았는가 ── (2026-10-15)
let fontBad = 0;
//
// 재봤더니 **첫 화면에서 한글 글꼴 1,203.6KB** 를 받고 있었다 — 앱 첫 짐(JS 81.3KB)의
// 열네 배다. 굵기 하나에 150~165KB 고, 명조는 **화면 넷의 첫 줄 한 줄**에 쓰면서
// 236.6KB 였다.
//
// 줄여서 **646.5KB (−557.1KB · 46%)** 가 됐다 —
//   · 한글 굵기 다섯 → 셋 (300·500 을 뺐다. 그 자리는 가장 가까운 굵기로 그려진다)
//   · 명조는 **첫 화면에서 빼고** 뜬 뒤(idle)에 받는다 (`data/lateFonts.js`)
//
// 이 자리는 **글꼴을 하나 더 쓰고 싶을 때 조용히 되돌아간다.** `index.html` 에
// `&family=…` 한 줄을 더하는 일은 쉽고, 그 값은 **폰에서만 치른다.**
// 그래서 못을 박는다.
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');
  const urls = [...html.matchAll(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/g)].map((m) => m[0]);

  const say = (name, got, want) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (!pass) fontBad += 1;
    console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
      + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
  };

  console.log('\n── 첫 화면에서 받는 글꼴 ──');
  say('글꼴 주소가 세 군데다 (preload · stylesheet · noscript)', urls.length, 3);
  // 세 줄이 어긋나면 하나는 옛 목록을 받는다
  say('세 줄이 모두 같다', new Set(urls).size, 1);
  const url = urls[0] || '';
  say('한글은 굵기 셋만 받는다', /IBM\+Plex\+Sans\+KR:wght@400;600;700/.test(url), true);
  say('한글 굵기 300·500 은 안 받는다 (한 굵기가 150KB 다)',
    /IBM\+Plex\+Sans\+KR:wght@[^&]*\b(300|500)\b/.test(url), false);
  say('명조는 첫 화면에서 안 받는다 (236.6KB · 네 줄에 쓴다)', /Nanum/.test(url), false);
  say('명조를 나중에 받는 길이 있다',
    fs.existsSync(path.join(__dirname, '..', 'src', 'data', 'lateFonts.js')), true);
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.jsx'), 'utf-8');
  say('앱이 뜬 뒤 그 길을 부른다', /loadLateFonts\(\)/.test(main), true);
  // 명조가 아직 안 왔을 때도 한글이 보여야 한다 — `.serif-display` 의 폴백
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf-8');
  say('명조가 오기 전에도 세리프로 보인다', /\.serif-display[\s\S]{0,160}serif;/.test(css), true);
}


if (bad.length === 0 && fontBad === 0) {
  // 몇 자리를 지키고 있는지도 말해준다 — 0 을 통과시키는 검사는 검사가 아니다
  let guarded = 0;
  for (const file of walk(ROOT)) {
    const txt = fs.readFileSync(file, 'utf8');
    guarded += (txt.match(/IBM Plex Sans KR/g) || []).length;
  }
  console.log(`OK   라틴 글꼴 뒤에 한글 글꼴이 다 있다 → ${guarded} 자리`);
  console.log(`OK   글이 영문으로 박혀 예외로 적어둔 자리 → ${allowed} 자리`);
  console.log('');
  console.log('전부 통과');
  process.exit(0);
}

if (fontBad) console.log(`실패   첫 화면에서 받는 글꼴이 ${fontBad}건 어긋납니다`);
 if (bad.length === 0) process.exit(1);
console.log(`실패   ${bad.length} 자리에서 한글이 기기 기본 글꼴로 떨어집니다`);
console.log('');
for (const b of bad) {
  console.log(`  ${b.file}:${b.line}`);
  console.log(`    ${b.text}`);
  console.log(`    → '${b.latin}' 뒤에 'IBM Plex Sans KR' 을 넣으세요`);
  console.log(`       (글이 영문으로 박힌 자리면 윗줄에 「${OPT_OUT}」 이라고 적으세요)`);
  console.log('');
}
console.log("고치는 법: \"'Bebas Neue', sans-serif\" → \"'Bebas Neue', 'IBM Plex Sans KR', sans-serif\"");
process.exit(1);
