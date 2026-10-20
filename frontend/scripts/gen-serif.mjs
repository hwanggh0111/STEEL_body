// 명조를 **우리가 잘라서 내준다** (2026-10-20).
//
//   npm run serif      ← 손으로 돌린다. 빌드에는 안 들어간다
//
// ── 왜 ──
//
// 명조(Nanum Myeongjo)를 구글에서 받고 있었고 **236.6KB** 였다. 앱 첫 짐(JS 81.3KB)의
// 세 배다. 10/15 에 첫 그림을 막지 않게 뒤로 미뤄뒀지만(`lateFonts.js`) 받는 양은 그대로였다.
//
// 그런데 명조로 적는 글자는 **닫혀 있다.** 열 자리의 첫 줄 한 줄씩이고, 들어가는
// 글은 고정 문구 + 숫자 + **운동 이름(사전 437개)** + 부위 이름 일곱이다. 즉
// **무엇이 필요한지 미리 셀 수 있다** — 467자다.
//
//     구글에서 받기        236.6KB   조각 6~92개 · 구글 두 곳에 왕복
//     467자만 잘라서        58.7KB   우리 서버 · 왕복 없음
//
// 그리고 **우리 주소에서 오면 서비스 워커가 담는다** — 지하 헬스장에서도 온다
// (구글에서 오는 것은 남의 집 것이라 담지 않는다, `public/sw.js` 의 2번).
//
// ── 이름을 바꿔야 한다 (라이선스) ──
//
// 나눔 글꼴은 OFL 인데 **「Nanum」 · 「NanumMyeongjo」 가 예약된 이름(RFN)** 이다.
// OFL 5절: **고친 판은 예약된 이름을 쓸 수 없다.** 글자를 잘라낸 것은 고친 판이다.
// 그래서 이름을 `BI Myeongjo` 로 바꿔 넣는다. 저작권 글귀와 라이선스는 글꼴 안에
// 그대로 두고, `public/fonts/OFL.txt` 로 같이 내준다 (OFL 이 요구한다).
//
// ── 무엇이 필요한가 ──
//
// 파이썬 `fonttools` 와 원본 글꼴. 원본은 받아서 `node_modules/.cache` 에 둔다
// (저장소에 3MB 를 넣지 않는다). 잘라낸 것(58.7KB)만 커밋한다.
//
//   pip install fonttools
//
// `woff2` 가 아니라 `woff` 인 까닭: woff2 로 싸려면 파이썬 `brotli` 가 더 필요하다.
// 58.7KB 와 47KB 쯤의 차이라서, 남의 컴퓨터에 설치를 더 요구하지 않는 쪽을 골랐다.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { collect } = require('./serifGlyphs.cjs');

const ROOT = path.resolve('.');
const OUT_DIR = path.join(ROOT, 'public', 'fonts');
const WOFF = path.join(OUT_DIR, 'bi-myeongjo.woff');
// 담은 글자 목록은 **내주지 않는다** — 검사만 읽는다. public 에 두면 서버가 집어 준다
const CHARS = path.join(ROOT, 'scripts', 'bi-myeongjo-chars.txt');
const LICENSE = path.join(OUT_DIR, 'OFL.txt');

// 원본 글꼴 — 구글 폰트 저장소(OFL)
const SRC_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/nanummyeongjo/NanumMyeongjo-Regular.ttf';
const LICENSE_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/nanummyeongjo/OFL.txt';
const CACHE = path.join(ROOT, 'node_modules', '.cache', 'nanummyeongjo.ttf');

const kb = (n) => `${Math.round((n / 1024) * 10) / 10}KB`;

async function download(url, to) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, Buffer.from(await res.arrayBuffer()));
}

const { text, perFile } = collect(ROOT);
console.log('── 명조로 그리는 글자 ──');
for (const [file, n] of Object.entries(perFile)) {
  console.log(`   ${String(n ?? '없음').padStart(4)} 자   ${file}`);
}
console.log(`   ${String(text.length).padStart(4)} 자   합계 (사전 운동 이름 · 부위 이름 포함)`);

if (!fs.existsSync(CACHE)) {
  console.log('\n원본 글꼴을 받습니다 (3MB · 저장소에는 안 넣는다)…');
  await download(SRC_URL, CACHE);
}
if (!fs.existsSync(LICENSE)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await download(LICENSE_URL, LICENSE);
}

// 파이썬에게 맡긴다 — 자르기(`fontTools.subset`)와 **이름 바꾸기**(RFN)를 한 번에.
// 이름표를 안 바꾸면 라이선스를 어기고, 브라우저가 들고 있는 이름과도 어긋난다.
const py = `
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

src, out, text = sys.argv[1], sys.argv[2], sys.argv[3]

opts = subset.Options()
opts.flavor = 'woff'
opts.layout_features = []
opts.hinting = False
opts.desubroutinize = True
opts.name_IDs = ['*']          # 저작권 · 라이선스 글귀를 남긴다 (OFL 이 요구한다)
opts.name_legacy = True
opts.notdef_outline = True

font = subset.load_font(src, opts)
subsetter = subset.Subsetter(options=opts)
subsetter.populate(text=text)
subsetter.subset(font)

# ── OFL 5절: 고친 판은 예약된 이름(Nanum)을 쓸 수 없다 ──
NEW = 'BI Myeongjo'
name = font['name']
for rec in name.names:
    if rec.nameID in (1, 3, 4, 6, 16, 18, 21):
        old = rec.toUnicode()
        if rec.nameID == 6:                      # PostScript 이름에는 공백을 못 쓴다
            rec.string = 'BIMyeongjo-Regular'
        elif rec.nameID == 3:                    # 이 판을 가리키는 고유 이름
            rec.string = NEW + ' subset (BLACK IRON)'
        elif rec.nameID == 4:
            rec.string = NEW + ' Regular'
        else:
            rec.string = NEW if 'Nanum' in old or 'NANUM' in old.upper() else old

subset.save_font(font, out, opts)
`;
const tmp = path.join(os.tmpdir(), `gen-serif-${process.pid}.py`);
fs.writeFileSync(tmp, py, 'utf8');
try {
  execFileSync('python', [tmp, CACHE, WOFF, text], { stdio: 'inherit' });
} finally {
  fs.unlinkSync(tmp);
}

// **담은 글자를 적어둔다.** 검사(`check-font.cjs`)가 이것과 화면을 견준다 —
// 글꼴 파일 안을 들여다보려면 파이썬이 또 필요한데, 검사는 아무것도 요구하지 않아야 한다
fs.writeFileSync(CHARS, `${text}\n`, 'utf8');

const size = fs.statSync(WOFF).size;
console.log(`\n잘라냈습니다 — ${path.relative(ROOT, WOFF)} ${kb(size)} (구글에서 받던 것 236.6KB)`);
console.log(`담은 글자 목록 → ${path.relative(ROOT, CHARS)}`);
console.log('이름은 `BI Myeongjo` 다 (OFL 의 예약 이름 규정). 라이선스는 public/fonts/OFL.txt');
