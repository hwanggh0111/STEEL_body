// 본문 글꼴을 **우리가 잘라서 내준다** (2026-11-13, 주인 지시).
//
//   npm run sans       ← 손으로 돌린다. 빌드에는 안 들어간다
//
// ── 왜 ──
//
// 10/20 에 명조는 우리 것이 됐는데(`gen-serif.mjs`) **본문 글꼴 넷은 그대로 구글에서**
// 받고 있었다. 11/13 에 재봤다 —
//
//     구글 CSS 한 장            **40.3KB (gzip)** · @font-face **303개**
//                               (IBM Plex Sans KR 혼자 282개)
//     한글 조각 하나             평균 9.8KB · 앱 글자가 건드리는 것이 굵기당 **54개**
//     집 두 곳에 왕복            fonts.googleapis.com → fonts.gstatic.com
//
// **CSS 40.3KB 는 글꼴 한 자도 안 그리고 치르는 값**이고, 첫 방문마다 치른다.
// 그런데 이 앱이 그리는 한글은 세어 보면 **1,066 음절**이다 — 잘라 보니 라틴·기호까지
// 합쳐 **59.9KB**(굵기 400)다. 구글에서 그만큼 그리려면 CSS 40.3KB + 조각 54개(약 530KB)다.
//
// ── 사람이 치는 글자는 닫혀 있지 않다 ──
//
// 명조는 쓰는 자리가 닫혀 있어서 467자로 끝났다. 본문은 다르다 — **운동 이름 · 메모 ·
// 별명**은 사람이 친다. 잘라낸 1,066자에 없는 음절이 오면 **그 글자만 기기 글꼴로
// 떨어져 한 줄 안에서 글꼴이 섞인다.** 그래서 두 벌로 나눈다 —
//
//     plex-kr-<굵기>.woff2        앱이 그리는 1,066자 + 라틴 · 기호   59.9 / 60.3 / 55.7KB
//     plex-kr-rest-<굵기>.woff2   나머지 한글 10,106자               347.3 / 343.1 / 283.1KB
//
// `unicode-range` 로 가른다. **나머지 벌을 먼저 적고 앱 벌을 뒤에 적는다** — 같은
// 집안 · 같은 굵기에서 두 줄이 한 글자를 다 덮으면 **나중에 적은 것이 이긴다**
// (CSS Fonts 4 §4.5). 그래서 앱 글자는 작은 벌로, 그 밖의 한글만 큰 벌로 간다.
// **나머지 벌은 그런 글자가 화면에 실제로 그려질 때만 받아진다.**
//
// 앱 글자 목록을 `unicode-range` 로 적는 값은 6,780자(br 로 1,525B)다. 굵기 셋이면
// br 로 4.5KB — 받는 쪽에서 40.3KB 를 안 받는 값에 댈 것이 못 된다.
//
// ── 라이선스 — **이름을 바꿔야 하는 것이 하나 있다** ──
//
// 셋 다 OFL 1.1 이다. 처음에 **글꼴 안 저작권 줄(name ID 0)** 만 읽고 「셋 다 예약된
// 이름(RFN)이 없다」고 적었는데 **틀렸다.** 권리를 주는 글은 글꼴 안이 아니라 같이
// 오는 `OFL.txt` 이고, 그 첫 줄이 이렇다 —
//
//     IBM Plex      Copyright (c) 2017 IBM Corp. **with Reserved Font Name "Plex"**
//     Barlow        Copyright 2017 The Barlow Project Authors         (RFN 없음)
//     Bebas Neue    Copyright (c) 2010 by Dharma Type.                (RFN 없음)
//
// **OFL 5절: 고친 판은 예약된 이름을 쓸 수 없다.** 글자를 잘라낸 것은 고친 판이다.
// 그래서 한글 글꼴은 이름을 **`BI Sans KR`** 로 바꿔 넣는다(명조를 `BI Myeongjo` 로
// 바꾼 것과 같은 자리다). Barlow · Bebas Neue 는 RFN 이 없어 이름을 그대로 쓴다.
//
// 저작권 · 라이선스 글귀는 글꼴 안에 그대로 두고(`name_IDs=['*']`),
// `public/fonts/OFL-*.txt` 로 셋 다 같이 내준다 — OFL 이 요구한다.
//
// ── 무엇이 필요한가 ──
//
//   pip install fonttools brotli
//
// 원본은 받아서 `node_modules/.cache` 에 둔다 (저장소에 2.8MB 짜리를 넣지 않는다).
// 잘라낸 것만 커밋한다.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CACHE = path.join(ROOT, 'node_modules', '.cache', 'fonts-src');
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'fonts');
const CSS_OUT = path.join(ROOT, 'src', 'styles', 'fonts.gen.css');
const RAW = 'https://raw.githubusercontent.com/google/fonts/main/ofl';
// **이름을 바꿔 넣는다** — IBM Plex 의 OFL 에 예약된 이름 "Plex" 가 있다 (위 머리글)
const KR_NAME = 'BI Sans KR';

// 받을 원본 — 집안마다 굵기별 파일이다
const SRC = [
  { file: 'IBMPlexSansKR-Regular.ttf', dir: 'ibmplexsanskr', fam: KR_NAME, w: 400, kr: true },
  { file: 'IBMPlexSansKR-SemiBold.ttf', dir: 'ibmplexsanskr', fam: KR_NAME, w: 600, kr: true },
  { file: 'IBMPlexSansKR-Bold.ttf', dir: 'ibmplexsanskr', fam: KR_NAME, w: 700, kr: true },
  { file: 'Barlow-Light.ttf', dir: 'barlow', fam: 'Barlow', w: 300 },
  { file: 'Barlow-Regular.ttf', dir: 'barlow', fam: 'Barlow', w: 400 },
  { file: 'Barlow-Medium.ttf', dir: 'barlow', fam: 'Barlow', w: 500 },
  { file: 'Barlow-SemiBold.ttf', dir: 'barlow', fam: 'Barlow', w: 600 },
  { file: 'Barlow-Bold.ttf', dir: 'barlow', fam: 'Barlow', w: 700 },
  { file: 'BebasNeue-Regular.ttf', dir: 'bebasneue', fam: 'Bebas Neue', w: 400 },
];

const kb = (n) => (n / 1024).toFixed(1) + 'KB';

// ── 앱이 그리는 글자를 센다 ──
//
// `src` 아래 글자를 전부 훑는다. 주석에만 있는 글자도 들어가지만 **빠뜨리는 쪽이
// 훨씬 나쁘다** — 빠진 글자는 그 글자만 기기 글꼴로 떨어진다. 1,066자에 몇십 자가
// 더 붙어도 woff2 에서 수백 바이트다.
function appChars() {
  const hangul = new Set();
  const other = new Set();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(jsx?|css|json)$/.test(e.name)) continue;
      for (const ch of fs.readFileSync(p, 'utf-8')) {
        const c = ch.codePointAt(0);
        if (c < 0x20) continue;
        if (c >= 0xAC00 && c <= 0xD7A3) hangul.add(c); else other.add(c);
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  // ASCII 는 전부 넣는다 — 사람이 칠 수 있다
  for (let c = 0x20; c < 0x7F; c += 1) other.add(c);
  return { hangul: [...hangul].sort((a, b) => a - b), other: [...other].sort((a, b) => a - b) };
}

/** 이어진 수를 `U+AC00-AC03` 꼴로 묶는다 — 한 자씩 적으면 CSS 가 두 배가 된다 */
function ranges(cps) {
  const out = [];
  let s = cps[0];
  let p = cps[0];
  for (const c of cps.slice(1)) {
    if (c === p + 1) { p = c; continue; }
    out.push([s, p]); s = c; p = c;
  }
  out.push([s, p]);
  const hex = (n) => n.toString(16).toUpperCase();
  return out.map(([a, b]) => (a === b ? 'U+' + hex(a) : 'U+' + hex(a) + '-' + hex(b))).join(',');
}

function download(it) {
  fs.mkdirSync(CACHE, { recursive: true });
  const to = path.join(CACHE, it.file);
  if (fs.existsSync(to) && fs.statSync(to).size > 1000) return to;
  const url = RAW + '/' + it.dir + '/' + it.file;
  console.log('  받는 중 ' + it.file);
  execFileSync('curl', ['-sL', '--max-time', '120', url, '-o', to]);
  if (!fs.existsSync(to) || fs.statSync(to).size < 1000) {
    console.error('[sans] 원본을 못 받았습니다 — ' + url);
    process.exit(1);
  }
  return to;
}

// 파이썬에게 맡긴다 — `fontTools.subset` 이 woff2 까지 싼다
const PY = [
  'import sys',
  'from fontTools import subset',
  'src, out = sys.argv[1], sys.argv[2]',
  'cps = [int(x) for x in open(sys.argv[3], encoding="utf-8").read().split(",")]',
  'opts = subset.Options()',
  "opts.flavor = 'woff2'",
  'opts.layout_features = []',
  'opts.hinting = False',
  'opts.desubroutinize = True',
  "opts.name_IDs = ['*']",
  'opts.name_legacy = True',
  'opts.notdef_outline = True',
  'font = subset.load_font(src, opts)',
  's = subset.Subsetter(opts)',
  's.populate(unicodes=cps)',
  's.subset(font)',
  '',
  '# ── OFL 5절: 고친 판은 예약된 이름을 쓸 수 없다 ──',
  '# 넷째 인자로 새 이름을 받으면 이름표를 바꾼다 (IBM Plex 의 RFN 은 "Plex" 다).',
  '# 저작권(0) · 라이선스(13 · 14) 줄은 **손대지 않는다** — OFL 이 남기라고 한다.',
  'new = sys.argv[4] if len(sys.argv) > 4 else ""',
  'if new:',
  '    ps = new.replace(" ", "")',
  '    for rec in font["name"].names:',
  '        if rec.nameID not in (1, 3, 4, 6, 16, 18, 21):',
  '            continue',
  '        old = rec.toUnicode()',
  '        if rec.nameID == 6:',
  '            tail = old.split("-")[-1] if "-" in old else "Regular"',
  '            rec.string = ps + "-" + tail',
  '        elif rec.nameID == 3:',
  '            rec.string = new + " subset (BLACK IRON)"',
  '        elif rec.nameID == 4:',
  '            rec.string = new + (old[old.rfind(" "):] if " " in old else "")',
  '        else:',
  '            rec.string = new if "Plex" in old else old',
  '',
  'subset.save_font(font, out, opts)',
  'font.close()',
].join('\n');

const CMAP_PY = [
  'import sys, json',
  'from fontTools.ttLib import TTFont',
  'print(json.dumps(list(TTFont(sys.argv[1]).getBestCmap().keys())))',
].join('\n');

function cut(src, out, cps, rename) {
  const py = path.join(CACHE, '_cut.py');
  const lst = path.join(CACHE, '_cps.txt');
  fs.writeFileSync(py, PY, 'utf-8');
  fs.writeFileSync(lst, cps.join(','), 'utf-8');
  const args = [py, src, out, lst];
  if (rename) args.push(rename);
  execFileSync('python', args, { stdio: 'inherit' });
  return fs.statSync(out).size;
}

function cmapOf(src) {
  const py = path.join(CACHE, '_cmap.py');
  fs.writeFileSync(py, CMAP_PY, 'utf-8');
  return new Set(JSON.parse(execFileSync('python', [py, src], { encoding: 'utf-8' })));
}

// ── 돌린다 ──
const { hangul, other } = appChars();
const appHangul = new Set(hangul);
console.log('앱이 그리는 글자 — 한글 ' + hangul.length + '자 · 그 밖 ' + other.length + '자');
fs.mkdirSync(OUT_DIR, { recursive: true });

const faces = [];
let total = 0;
for (const it of SRC) {
  const src = download(it);
  // 그 글꼴이 실제로 들고 있는 글자만 고른다 — 없는 것을 조르면 fontTools 가 운다
  const have = cmapOf(src);
  if (it.kr) {
    const appCps = [...hangul, ...other].filter((c) => have.has(c)).sort((a, b) => a - b);
    const restCps = [...have].filter((c) => c >= 0xAC00 && c <= 0xD7A3 && !appHangul.has(c))
      .sort((a, b) => a - b);
    const appFile = 'plex-kr-' + it.w + '.woff2';
    const restFile = 'plex-kr-rest-' + it.w + '.woff2';
    const a = cut(src, path.join(OUT_DIR, appFile), appCps, KR_NAME);
    const r = cut(src, path.join(OUT_DIR, restFile), restCps, KR_NAME);
    total += a + r;
    console.log('  ' + it.fam + ' ' + it.w + ' — 앱 ' + kb(a) + ' (' + appCps.length + '자)'
      + ' · 나머지 한글 ' + kb(r) + ' (' + restCps.length + '자)');
    // **나머지를 먼저, 앱 것을 뒤에** — 뒤에 적은 것이 이긴다
    faces.push({ fam: it.fam, w: it.w, file: restFile, range: 'U+AC00-D7A3', note: '나머지 한글 — 사람이 친 글자에만 받아진다' });
    faces.push({ fam: it.fam, w: it.w, file: appFile, range: ranges(appCps), note: '앱이 그리는 글자 (뒤에 적어야 이긴다)' });
  } else {
    const cps = other.filter((c) => have.has(c));
    const name = it.fam.toLowerCase().replace(/\s+/g, '-') + '-' + it.w + '.woff2';
    const n = cut(src, path.join(OUT_DIR, name), cps);
    total += n;
    console.log('  ' + it.fam + ' ' + it.w + ' — ' + kb(n) + ' (' + cps.length + '자)');
    // **「라틴 전용」 이라고 적는다** — `check-font` 가 「라틴 글꼴 뒤에 한글 글꼴이
    // 있나」를 세는데, 여기는 글꼴을 **정의하는** 자리라 뒤에 올 것이 없다.
    // 예외를 자 안에 파일 이름으로 적지 않고 **그 줄 위에 까닭을 적는** 것이 이 앱의 규칙이다
    faces.push({ fam: it.fam, w: it.w, file: name, range: null, note: '라틴 전용 — 라틴 · 숫자 · 기호' });
  }
}

const head = '/* **이 파일은 손으로 고치지 않는다** — `npm run sans` 가 만든다 (scripts/gen-sans.mjs).\n'
  + ' *\n'
  + ' * 구글 글꼴 넷을 우리 주소에서 내준다. 까닭과 수는 그 손의 머리글에 적어뒀다.\n'
  + ' * 비테가 해시를 박아 `/assets/` 로 내보내므로 서비스 워커가 담고 지하에서도 온다.\n'
  + ' */\n';
const css = head + faces.map((f) => '@font-face {\n'
  + '  /* ' + f.note + ' */\n'
  + "  font-family: '" + f.fam + "';\n"
  + '  font-style: normal;\n'
  + '  font-weight: ' + f.w + ';\n'
  + '  font-display: swap;\n'
  + "  src: url('../assets/fonts/" + f.file + "') format('woff2');"
  + (f.range ? '\n  unicode-range: ' + f.range + ';' : '') + '\n}').join('\n\n') + '\n';
fs.writeFileSync(CSS_OUT, css, 'utf-8');

console.log('\n잘라냈습니다 — ' + faces.length + '벌 · 합계 ' + kb(total));
console.log('  ' + path.relative(ROOT, CSS_OUT) + ' ' + kb(fs.statSync(CSS_OUT).size));
