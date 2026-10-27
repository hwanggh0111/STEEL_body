// 날짜를 **UTC 글자로 자르고 있지 않은가** (2026-10-27)
//
//   npm run isoday     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 서버가 적는 시각은 `new Date().toISOString()` 이다 — 끝에 `Z` 가 붙은 UTC.
// 그것을 글자로 열 자 자르면(`iso.slice(0, 10)`) 한국에서는 **자정부터 오전 9시까지가
// 하루 전**이 된다.
//
// 이 함정은 이 집에서 **이미 두 번 적혀 있었다** —
//
//   · `frontend/src/data/dateKey.js` 첫 줄: 「toISOString() 은 UTC 로 바꾼 뒤 자르기
//     때문에 KST(+9)에서는 새벽 0시~8시 59분 사이에 하루 전 날짜가 나온다」
//   · `backend/src/utils/seoulDay.js`: 「그 사이에 가입한 사람이 관리자 화면의
//     『오늘 가입』에서 빠졌다」
//
// **적어두고도 열한 자리가 그 자르기를 쓰고 있었다.** 제보가 어제 묶음에 들어가고,
// 정지 만료일과 계정 삭제 마감일이 하루 빠르게 적히고, 내보내는 사진에 전날 날짜가
// 박혔다. 눈으로는 못 잡는다 — **오전 9시가 지나면 맞게 보인다.**
//
// 그래서 글자로 센다. 맞는 자리는 아래 `ALLOW` 에 **까닭과 함께** 적는다.

const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const yes = (name, cond, why) => {
  if (!cond) bad += 1;
  console.log((cond ? 'OK   ' : 'FAIL ') + name + (cond ? '' : ' — ' + why));
};

const ROOT = path.join(__dirname, '..', '..');

/** 훑을 자리 — 앱과 서버의 소스뿐. 검사와 시안과 쌓인 것은 안 본다 */
const ROOTS = [
  path.join(ROOT, 'frontend', 'src'),
  path.join(ROOT, 'backend', 'src'),
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) { walk(p, out); continue; }
    if (/\.(js|jsx|cjs|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

// 주석 안의 것은 안 센다 — 이 집은 까닭을 주석에 길게 적고, 그 주석에 바로
// 이 잘못된 꼴(`iso.slice(0, 10)`)을 적어둔 자리가 여럿이다.
//
// **줄 단위로 본다.** 처음에는 글자(문자열)까지 가려 걷었는데, JSX 글 안의 홑따옴표
// 하나에 어긋나서 **진짜 잘못된 줄을 놓쳤다** (되돌려 보고 알았다 — 계정 삭제 마감일).
// 주석 표시보다 **앞**에 있는 자리만 코드로 본다: 뒤에 있는 것은 어차피 주석이다.
function codeLines(src) {
  let inBlock = false;
  return src.split('\n').map((raw) => {
    let line = raw;
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end < 0) return '';
      line = line.slice(end + 2);
      inBlock = false;
    }
    // 한 줄에서 블록 주석이 열리면 그 앞까지만, 같은 줄에서 닫히면 뒤도 본다
    for (;;) {
      const open = line.indexOf('/*');
      if (open < 0) break;
      const close = line.indexOf('*/', open + 2);
      if (close < 0) { line = line.slice(0, open); inBlock = true; break; }
      line = line.slice(0, open) + ' ' + line.slice(close + 2);
    }
    const slash = line.indexOf('//');
    return slash < 0 ? line : line.slice(0, slash);
  });
}

// **맞는 자리는 까닭과 함께 적는다.** 여기 없는 자리가 나오면 FAIL 한다
const ALLOW = {
  'frontend/src/data/dateKey.js': '날짜를 만드는 그 자리다 — 여기만 `Date` 의 로컬 칸(getFullYear…)으로 만든다',
  'backend/src/utils/seoulDay.js': '서울 날짜를 만드는 그 자리다 — 아홉 시간을 더한 뒤에 자른다',
  'backend/src/utils/dayRange.js': '테두리를 **하루 넉넉하게** 주는 자리다 — 거기 적어둔 대로 시차만큼의 헐거움이 일부러 있다',
};

const hits = [];
ROOTS.forEach((r) => walk(r).forEach((p) => {
  const rel = path.relative(ROOT, p).replace(/\\/g, '/');
  if (ALLOW[rel]) return;
  codeLines(fs.readFileSync(p, 'utf8')).forEach((line, i) => {
    // 날짜 열 자 · 시각 여덟 자를 글자로 자르는 꼴
    if (/\.(slice|substring)\(\s*0\s*,\s*10\s*\)/.test(line) || /\.(slice|substring)\(\s*11\s*,\s*19\s*\)/.test(line)) {
      hits.push(`${rel}:${i + 1}`);
    }
  });
}));

console.log('── ISO 를 글자로 자르는 자리 ──');
ok('없다', hits, []);
Object.entries(ALLOW).forEach(([k, why]) => console.log(`     맞는 자리: ${k} — ${why}`));

// ── 값으로도 본다 ──
const esbuild = require('esbuild');
const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};
const D = bundle('src/data/dateKey.js', '.isoday.cjs');
const { seoulDay } = require(path.join(ROOT, 'backend', 'src', 'utils', 'seoulDay.js'));

console.log('\n── 날짜를 그 사람의 시계로 만든다 ──');
// 한국 10/27 오전 1:30 — 잘라 쓰면 10/26 이다
const NIGHT = '2026-10-26T16:30:00.000Z';
const d = new Date(NIGHT);
const p2 = (n) => String(n).padStart(2, '0');
const want = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
ok('새벽 것', D.dayOf(NIGHT), want);
if (d.getTimezoneOffset() === 0) {
  console.log('SKIP 이 기계가 UTC 라 「글자로 자른 것」과 구별이 안 된다');
} else {
  yes(`글자로 자른 ${NIGHT.slice(0, 10)} 와 다르다 (${D.dayOf(NIGHT)})`, D.dayOf(NIGHT) !== NIGHT.slice(0, 10),
    'UTC 글자를 그대로 쓰고 있다 — 한국에서 자정~오전 9시가 하루 전이 된다');
}
ok('날짜뿐인 글자는 그대로', D.dayOf('2026-10-27'), '2026-10-27');
ok('없는 것 · 깨진 것', [D.dayOf(null), D.dayOf(''), D.dayOf('어제'), D.dayOf(undefined)], ['', '', '', '']);

console.log('\n── 서버는 서울로 말한다 ──');
ok('새벽 것', seoulDay(NIGHT), '2026-10-27');
ok('깨진 것', seoulDay('어제'), '');

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
