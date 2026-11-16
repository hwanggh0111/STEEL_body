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
const { execFileSync } = require('child_process');

// 한글이 없는 글꼴들. 이것만 적고 끝내면 한글이 떨어진다
const LATIN_ONLY = ['Bebas Neue', 'Barlow', 'Playfair Display'];
// 한글을 받는 글꼴. 라틴 글꼴 뒤 어딘가에 이 중 하나가 있어야 한다
// **BI Sans KR 이다** (2026-11-13) — 잘라서 내주면서 OFL 5절대로 이름을 바꿨다
// (IBM Plex 의 예약 이름은 "Plex" 다). 옛 이름도 남겨 둔다 — 어딘가 남아 있으면
// 그 줄은 **오지 않는 글꼴**을 가리키는 것이니 잡아야 한다
const KOREAN = ['BI Sans KR', 'Nanum Myeongjo'];

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

/** 폴더 아래 **모든** 파일. 위의 `walk` 는 src 전용이라 확장자를 가린다 */
function walkAll(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkAll(full, out);
    else out.push(full);
  }
  return out;
}

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
// **10/20 에 명조는 아예 우리 것이 됐다** — 쓰는 글자 467자만 잘라 **58.7KB**
// (`npm run serif`). 구글에 안 가니 미루는 코드(`lateFonts.js`)도 걷어냈다.
// 그래서 첫 화면에서 받는 한글은 **468.4KB** 다 — 구글에서 받던 1,203.6KB 의 39%.
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
  // ── **구글에서 한 자도 안 받는다** ── (2026-11-13, 주인 지시)
  //
  // 여기에 「주소가 세 군데다 · 셋이 같다 · 한글은 굵기 셋만」이 있었다. 이제 구글
  // 주소가 **하나도 없다** — 넷을 잘라 우리 주소에서 내준다(`npm run sans`).
  // 재본 값: 구글 CSS 한 장이 **gzip 40.3KB** 였고, 그것은 글꼴 한 자도 안 그리고
  // 치르는 값이었다. 우리 CSS 는 `unicode-range` 가 붙어 br 2.7KB → 8.2KB 가 됐다.
  // **−34.8KB** 다. 집 두 곳(googleapis → gstatic) 왕복도 사라졌다.
  //
  // 이 자리는 **글꼴을 하나 더 쓰고 싶을 때 조용히 되돌아간다.** `&family=…` 한 줄을
  // 더하는 일은 쉽고 그 값은 폰에서만 치른다. 그래서 못을 박는다.
  say('구글 글꼴 주소가 하나도 없다', urls.length, 0);
  say('  구글 글꼴 집도 안 찾아둔다 (preconnect · dns-prefetch)',
    /fonts\.(googleapis|gstatic)\.com/.test(html), false);

  const genPath = path.join(__dirname, '..', 'src', 'styles', 'fonts.gen.css');
  const gen = fs.existsSync(genPath) ? fs.readFileSync(genPath, 'utf-8') : '';
  say('잘라둔 본문 글꼴이 있다 (npm run sans)', gen.length > 0, true);
  const gcss = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf-8');
  say('  globals.css 가 그것을 들여온다', /@import '\.\/fonts\.gen\.css';/.test(gcss), true);

  // 적힌 벌이 전부 **파일로 있는가** — 하나라도 없으면 그 굵기만 기기 글꼴이 된다
  const faces = [...gen.matchAll(/url\('\.\.\/assets\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
  const fontDir = path.join(__dirname, '..', 'src', 'assets', 'fonts');
  say('  적힌 벌이 다 파일로 있다',
    faces.filter((f) => !fs.existsSync(path.join(fontDir, f))), []);
  // **옛 이름이 남으면 그 줄은 오지 않는 글꼴을 가리킨다** (2026-11-13)
  say('  옛 이름(IBM Plex Sans KR)이 남아 있지 않다',
    walk(ROOT).filter((f) => /IBM Plex Sans KR/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(path.join(__dirname, '..'), f).split(path.sep).join('/')), []);
  say('  한글은 굵기 셋이다 (400 · 600 · 700)',
    [...new Set(faces.map((f) => (/^plex-kr-(\d+)\.woff2$/.exec(f) || [])[1])
      .filter(Boolean))].sort(), ['400', '600', '700']);

  // ── ★ **나머지 한글을 조각으로 갈랐다** ── (2026-11-16, 벼림 · 자는 정석)
  //
  // 전에는 나머지 한글이 굵기마다 **한 장(347KB)** 이었다. 앱 글자 1,067자 밖의
  // 음절 **하나**만 쳐도(운동 이름 · 메모 · 별명이 전부 그 길이다) 347KB 를 통째로
  // 받았다. 이제 **조각 21개/굵기**로 갈라 한 조각 평균 25.5KB 를 받는다.
  //
  // 조각이 늘어나며 **자가 봐야 하는 것도 늘었다** —
  //
  //   ① **차례** — 조각 벌이 앱 벌보다 **먼저** 와야 한다. 같은 집안·같은 굵기에서
  //      둘이 한 글자를 다 덮으면 **나중에 적은 것이 이긴다**(CSS Fonts 4 §4.5).
  //      뒤집히면 앱이 그리는 글자가 큰 조각에서 와서 **첫 화면이 조각을 받는다** —
  //      화면은 멀쩡해 보이고 눈으로는 영영 안 보인다
  //   ② **빈틈 0** — `AC00`~`D7A3` 을 조각들이 빈틈없이 덮는가. 한 글자라도 안
  //      걸리면 **그 글자만** 기기 글꼴로 떨어진다. 조각 스물한 개의 경계를 눈으로
  //      볼 길은 없다
  //   ③ **한글 밖으로 안 나간다** — 넓히면 라틴까지 거기서 온다(옛 자의 뜻)
  //
  // **수를 글자로 박지 않는다.** 조각 수는 `gen-sans.mjs` 의 `REST_CHUNK_CHARS` 에
  // 따라 변한다 — CSS 에서 센다 (11/16 에 옛 자가 「3개」로 박아둬서 FAIL 넷을 냈다)

  // CSS 를 **벌 단위로** 끊어 읽는다 — 차례가 뜻을 가지므로 순서를 지킨다
  const 벌들 = [...gen.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)].map((m, i) => {
    const b = m[1];
    const 파일 = (/url\('\.\.\/assets\/fonts\/([^']+)'\)/.exec(b) || [])[1] || null;
    const 굵기 = (/font-weight:\s*(\d+)/.exec(b) || [])[1] || null;
    const 범위 = [...b.matchAll(/U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?/g)]
      .map((r) => [parseInt(r[1], 16), parseInt(r[2] || r[1], 16)]);
    return { i, 파일, 굵기, 범위, swap: /font-display:\s*swap/.test(b) };
  });
  const 조각 = 벌들.filter((f) => /^plex-kr-rest-\d+(?:-\d+)?\.woff2$/.test(f.파일 || ''));
  const 앱벌 = 벌들.filter((f) => /^plex-kr-\d+\.woff2$/.test(f.파일 || ''));
  const 굵기들 = [...new Set(앱벌.map((f) => f.굵기))].sort();
  say('  한글 굵기마다 조각이 있다', 굵기들.filter((w) => !조각.some((f) => f.굵기 === w)), []);

  for (const w of 굵기들) {
    const r = 조각.filter((f) => f.굵기 === w);
    const a = 앱벌.filter((f) => f.굵기 === w);
    // ① 차례 — **마지막 조각**이 **첫 앱 벌**보다 앞이어야 한다
    const 마지막조각 = r.length ? Math.max(...r.map((f) => f.i)) : -1;
    const 첫앱벌 = a.length ? Math.min(...a.map((f) => f.i)) : -1;
    say('  ' + w + ' — 조각 벌이 앱 벌보다 먼저다 (조각 ' + r.length + '벌)',
      r.length > 0 && a.length > 0 && 마지막조각 < 첫앱벌, true);

    // ② 빈틈 0 — 조각들의 범위를 이어 붙여 AC00~D7A3 을 **전부** 덮는지 본다.
    // 덮지 못한 자리를 **글자 수로** 적는다 — 「몇 자가 기기 글꼴로 떨어지나」다
    const 칸 = r.flatMap((f) => f.범위).sort((x, y) => x[0] - y[0]);
    const 빈틈 = [];
    let 자리 = 0xAC00;
    for (const [from, to] of 칸) {
      if (from > 자리) 빈틈.push([자리, Math.min(from - 1, 0xD7A3)]);
      자리 = Math.max(자리, to + 1);
    }
    if (자리 <= 0xD7A3) 빈틈.push([자리, 0xD7A3]);
    const 빠진글자수 = 빈틈.reduce((n, [from, to]) => n + (to - from + 1), 0);
    say('  ' + w + ' — 음절 11,172자에 빈틈이 없다', 빠진글자수, 0);
    if (빠진글자수) {
      console.log('       빈 자리: ' + 빈틈.slice(0, 4)
        .map(([from, to]) => 'U+' + from.toString(16).toUpperCase() + '-' + to.toString(16).toUpperCase()).join(' '));
    }

    // ③ 한글 밖으로 안 나간다
    const 넘은것 = r.filter((f) => f.범위.some(([from, to]) => from < 0xAC00 || to > 0xD7A3))
      .map((f) => f.파일);
    say('  ' + w + ' — 조각이 한글 자리 밖으로 안 나간다', 넘은것, []);
  }

  // ── **이긴 벌이 그 글자를 실제로 드는가** ── `--깊게` 로만 돈다
  //
  // 위의 셋은 **CSS 가 적은 말**을 본다. 이것은 **woff2 안을 열어** 본다 —
  // CSS 차례대로 마지막에 걸린 벌을 고르고, 그 파일의 `cmap` 에 그 음절이 있는지.
  // 이것이 거꾸로면 글자가 **더 큰 조각에서 온다**(첫 화면이 조각을 받는 그 꼴).
  // 음절 11,172 × 굵기 셋이라 몇 초 걸린다 — 그래서 갈래로 뺀다. CSS 만 읽는
  // 「빈틈 0」은 **매번** 선다
  if (process.argv.includes('--깊게') || process.argv.includes('--deep')) {
    console.log('');
    console.log('── 이긴 벌이 그 글자를 드는가 (--깊게) ──');
    const 쓸벌 = [...조각, ...앱벌];
    const py = [
      'import json,sys',
      'from fontTools.ttLib import TTFont',
      'out={}',
      'for f in sys.argv[1:]:',
      '    t=TTFont(f)',
      '    out[f.replace(chr(92),"/").split("/")[-1]]=sorted(t.getBestCmap().keys())',
      'print(json.dumps(out))',
    ].join('\n');
    let cmap = null;
    try {
      cmap = JSON.parse(execFileSync('python',
        ['-c', py, ...쓸벌.map((f) => path.join(fontDir, f.파일))],
        { encoding: 'utf-8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }));
    } catch { cmap = null; }
    if (!cmap) {
      console.log('건너뜀 woff2 를 열 손이 없다 (python fontTools — 생성기가 쓰는 그 손이다)');
    } else {
      const 가진것 = {};
      Object.entries(cmap).forEach(([f, cps]) => { 가진것[f] = new Set(cps); });
      for (const w of 굵기들) {
        const 줄 = 쓸벌.filter((f) => f.굵기 === w).sort((a, b) => a.i - b.i);
        const 안드는것 = [];
        for (let cp = 0xAC00; cp <= 0xD7A3; cp += 1) {
          let 이긴것 = null;
          // **나중에 적힌 것이 이긴다** — 앞에서 뒤로 훑으며 덮어쓴다
          for (const f of 줄) if (f.범위.some(([a, b]) => cp >= a && cp <= b)) 이긴것 = f;
          if (!이긴것) { 안드는것.push(cp); continue; }
          if (!가진것[이긴것.파일]?.has(cp)) 안드는것.push(cp);
        }
        say('  ' + w + ' — 이긴 벌이 그 음절을 든다 (안 드는 글자 수)', 안드는것.length, 0);
        if (안드는것.length) {
          console.log('       ' + 안드는것.slice(0, 8).map((cp) => String.fromCodePoint(cp)).join(' '));
        }
      }
    }
  }

  say('  오는 동안에도 글이 보인다 (font-display: swap)',
    (gen.match(/font-display: swap/g) || []).length, faces.length);

  // ── **개발 화면도 같은 글꼴을 부르는가** ── (2026-11-13, 정석 · 맵시)
  //
  // 11/13 에 한글 글꼴을 `BI Sans KR` 로 개명하면서 `src` 194 자리는 갈았는데
  // **`dev/` 아래가 남았다.** 처음에 「69 자리가 깨졌다」고 적었는데 **반만 맞았다** —
  // 가르는 선은 **폴더가 아니라 「누가 글꼴을 받아오나」** 다(맵시가 바로잡았다).
  //
  //   앱 화면에 얹히는 CSS   `src/**` · `dev/skin/**`
  //        앱이 내주는 이름을 불러야 한다. 옛 이름만 있으면 **그 줄은 오지 않는
  //        글꼴을 가리킨다** — 겉꼴을 켠 앱 화면에서 한글이 기기 글꼴로 떨어진다
  //   제 `<link>` 로 받는 독립 페이지   `dev/sian/**` · `dev/ui/**`
  //        구글에서 직접 받으니 옛 이름이 **살아 있다** — 통과다.
  //        대신 **`<link>` 가 아예 없으면 FAIL** 한다. 지금 열한 장은 다 있지만
  //        다음에 한 장 더 만들 때 빠지면 그때는 진짜로 한글이 떨어진다
  console.log('');
  console.log('── 개발 화면의 글꼴 ──');
  const devDir = path.join(__dirname, '..', 'dev');
  // **길을 빗금으로 맞춰 둔다** — 윈도는 역빗금이라 길로 가르는 자가 조용히 0건이 된다
  const rel = (f) => path.relative(path.join(__dirname, '..'), f).split(path.sep).join('/');
  const devFiles = fs.existsSync(devDir)
    ? walkAll(devDir).filter((f) => /\.(css|html)$/.test(rel(f))) : [];

  // ⑴ 앱 화면에 얹히는 꼴 — 새 이름을 불러야 한다
  //
  // **파일 전체가 아니라 `font-family` 줄만 본다.** 처음에 파일 전체에서 찾게 짰다가
  // 되돌려 보고 알았다 — 머리글 주석에 「`BI Sans KR` 로 개명했다」라고 적어둔 것이
  // 걸려서, **정작 줄은 옛 이름뿐인데 통과**했다. 자가 보는 것은 주석이 아니라 줄이다.
  const 얹히는것 = devFiles.filter((f) => rel(f).startsWith('dev/skin/'));
  const 옛이름줄 = [];
  얹히는것.forEach((f) => {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (!/font-family/i.test(line)) return;
      if (!/IBM Plex Sans KR/.test(line)) return;
      if (/BI Sans KR/.test(line)) return;
      옛이름줄.push(rel(f) + ':' + (i + 1));
    });
  });
  say('겉꼴은 앱이 내주는 이름을 부른다 (dev/skin)', 옛이름줄, []);

  // ⑵ 독립 페이지 — 제 글꼴을 제가 받아와야 한다
  //
  // **`font-family` 가 적혔는지로 가르지 않는다.** 그것도 되돌려 보고 알았다 —
  // 시안 대부분은 글꼴을 `_s.css` 에서 받아 제 장에는 `font-family` 가 한 줄도 없다.
  // 그래서 「글꼴을 적은 장만 본다」로 두면 **`<link>` 를 빼먹어도 안 걸린다.**
  // 이 폴더의 장은 전부 **제 발로 서는 장**이다 — 그러니 전부 제 `<link>` 가 있어야 한다.
  const 독립 = devFiles.filter((f) => /^dev\/(sian|ui)\/.*\.html$/.test(rel(f)));
  say('시안은 제 글꼴을 제가 받아온다 (<link> 가 있다)',
    독립.filter((f) => !/fonts\.googleapis\.com/.test(fs.readFileSync(f, 'utf8'))).map(rel), []);
  console.log('     겉꼴 ' + 얹히는것.length + '장 · 독립 시안 ' + 독립.length + '장');

  console.log('');
  console.log('── 명조는 우리 것이다 ── (2026-10-20)');
  //
  // 쓰는 글자가 닫혀 있어서(열 자리의 첫 줄 · 고정 문구 + 숫자 + 사전 운동 이름 +
  // 부위 이름) **잘라서 우리 주소에서 내준다.** 그러면 구글 왕복이 없고, 같은
  // 출신이라 **서비스 워커가 담는다** — 지하 헬스장에서도 온다.
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf-8');
  const woff = path.join(__dirname, '..', 'src', 'assets', 'fonts', 'bi-myeongjo.woff2');
  say('잘라둔 글꼴이 있다', fs.existsSync(woff), true);
  const size = fs.existsSync(woff) ? fs.statSync(woff).size : 0;
  // 100KB 를 넘으면 자르는 규칙이 느슨해진 것이다 (구글에서 받던 236.6KB 로 가는 길)
  say('  100KB 아래다', size > 0 && size < 100 * 1024, true);
  // **src 에서 가리킨다** — 비테가 해시를 박아 /assets/ 로 내보내야 서비스 워커가
  // 캐시를 먼저 본다(public/ 에 두면 이름이 그대로라 네트워크를 먼저 친다, 2026-10-20)
  say('  CSS 가 그것을 가리킨다', /src: url\('\.\.\/assets\/fonts\/bi-myeongjo\.woff2'\) format\('woff2'\)/.test(css), true);
  // **woff 로 되돌아가지 않게 못을 박는다** (2026-11-13) — 같은 글자로 15.1KB 더 받는다
  say('  옛 woff 는 남아 있지 않다',
    fs.existsSync(path.join(__dirname, '..', 'src', 'assets', 'fonts', 'bi-myeongjo.woff')), false);
  say('  오는 동안에도 글이 보인다 (font-display: swap)',
    /@font-face[\s\S]{0,400}?font-display: swap/.test(css), true);
  // OFL 5절 — 고친 판(= 잘라낸 판)은 예약된 이름(Nanum)을 쓸 수 없다
  say('  이름이 Nanum 이 아니다 (OFL 예약 이름)', /font-family: 'BI Myeongjo'/.test(css), true);
  say('  라이선스를 같이 내준다',
    fs.existsSync(path.join(__dirname, '..', 'public', 'fonts', 'OFL.txt')), true);
  // **잘라서 내주는 글꼴은 전부 라이선스를 같이 내준다** (2026-11-13) — OFL 이 요구한다.
  // 11/13 에 본문 글꼴 넷이 우리 것이 됐으니 그 셋도 여기 있어야 한다
  say('  본문 글꼴 라이선스도 같이 내준다',
    ['OFL-IBM-Plex-Sans-KR.txt', 'OFL-Barlow.txt', 'OFL-Bebas-Neue.txt']
      .filter((f) => !fs.existsSync(path.join(__dirname, '..', 'public', 'fonts', f))), []);
  // 명조가 아직 안 왔을 때도 한글이 보여야 한다 — `.serif-display` 의 폴백
  say('  오기 전에도 세리프로 보인다', /\.serif-display[\s\S]{0,300}serif;/.test(css), true);
  // 미루는 코드는 걷어냈다. 되살아나면 글꼴을 **두 번** 받는다
  say('  미루는 코드가 없다 (lateFonts)',
    fs.existsSync(path.join(__dirname, '..', 'src', 'data', 'lateFonts.js')), false);

  // ── 담은 글자와 화면이 어긋나지 않는가 ──
  //
  // **여기가 이 길의 값을 치르는 자리다.** 잘라둔 글꼴에 없는 글자를 명조 줄에
  // 적으면 그 글자만 기기 글꼴로 떨어져 **한 줄 안에서 글꼴이 섞인다.** 그리고
  // 그것은 그 화면을 폰에서 열어봐야 눈에 띈다 — 그래서 검사가 센다.
  const { collect, FILES } = require('./serifGlyphs.cjs');
  const charsFile = path.join(__dirname, 'bi-myeongjo-chars.txt');
  // **다듬지 않는다** — 담은 글자를 차례대로 적어둬서 **빈칸이 첫 글자**다.
  // trim 을 쓰면 그 빈칸이 날아가 「빈칸이 빠졌다」고 영영 실패한다.
  // 그래서 줄바꿈만 골라 뺀다 (글자 코드 31 아래)
  const raw = fs.existsSync(charsFile) ? fs.readFileSync(charsFile, 'utf8') : '';
  const have = new Set([...raw].filter((ch) => ch.charCodeAt(0) > 31));
  const want = collect(path.join(__dirname, '..'));
  const missing = [...new Set(want.text.split(''))].filter((ch) => !have.has(ch));
  say('잘라둔 글꼴에 쓰는 글자가 다 있다 (없으면 npm run serif)', missing.slice(0, 12), []);

  // 명조를 그리는 파일이 세는 목록에 다 들어 있나 — 빠진 파일이 명조를 쓰면
  // 그 화면 글자가 섞인다. `.serif-display` 를 쓰는 파일을 찾아 견준다
  // **글자를 그리는 자리만** 센다 — 주석에 `.serif-display` 를 적은 파일까지 세면
  // (`main.jsx` 가 그렇다) 세는 목록이 쓸데없이 길어진다
  const users = walk(ROOT)
    .filter((f) => /className=["'`][^"'`]*serif-display/.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(path.join(__dirname, '..'), f).split(path.sep).join('/'))
    .filter((f) => !f.endsWith('.css'));
  say('  명조를 쓰는 파일이 세는 목록에 다 있다',
    users.filter((f) => !FILES.includes(f)), []);
}


if (bad.length === 0 && fontBad === 0) {
  // 몇 자리를 지키고 있는지도 말해준다 — 0 을 통과시키는 검사는 검사가 아니다
  let guarded = 0;
  for (const file of walk(ROOT)) {
    const txt = fs.readFileSync(file, 'utf8');
    guarded += (txt.match(/BI Sans KR/g) || []).length;
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
  console.log(`    → '${b.latin}' 뒤에 'BI Sans KR' 을 넣으세요`);
  console.log(`       (글이 영문으로 박힌 자리면 윗줄에 「${OPT_OUT}」 이라고 적으세요)`);
  console.log('');
}
console.log("고치는 법: \"'Bebas Neue', sans-serif\" → \"'Bebas Neue', 'BI Sans KR', sans-serif\"");
process.exit(1);
