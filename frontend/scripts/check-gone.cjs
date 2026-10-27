// **걷어낸 것을 아직 있다고 말하는 자리가 있는가** (2026-10-27)
//
//   npm run gone     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 이 앱은 기능을 **자주 걷어낸다** — 게임 층(8/25) · 성취 뱃지(8/25) · 미션(9/03) ·
// 커뮤니티(9/16) · recharts(8/28) · 인스타그램과 X(10/09). 걷어내는 것은 이 앱이
// 잘하는 일인데, **걷어낸 뒤에도 그것을 말하는 글이 남는다.**
//
// 실제로 그랬다 —
//
//   · README 첫 줄: 「**미션**이 이어가는 이유를 만든다」 (미션은 9/03 에 지웠다)
//   · 같은 줄: 「React 18 + Vite + Zustand + **Recharts**」 (8/28 에 걷었다)
//   · 그 아래: 「**JSON 파일 DB**」 (10/14 에 운영은 Postgres 로 옮겼다)
//
// 앞서 한 번 물린 자리이기도 하다 — README 에 **「Node.js + Express + SQLite」**라고
// 적혀 있던 것을 「SQLite 가 아니다」로 고친 기록이 일지에 남아 있다.
//
// **지난 일을 적은 글은 건드리지 않는다.** 일지와 공지는 그때 그랬다는 기록이라
// 걷어낸 이름이 나오는 것이 맞다. 보는 것은 **지금을 말하는 글**이다 —
// README 의 머리와, 쓰는 사람이 읽는 화면.

const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(__dirname, '..', 'src');

// 걷어낸 것들. **이름 → 언제 · 어디서 걷었나** (까닭은 일지에 있다)
const GONE = {
  미션: '2026-09-03 (`MissionSystem.jsx` 삭제)',
  파칭코: '2026-08-25 (게임 층)',
  사다리: '2026-08-25 (게임 층)',
  커뮤니티: '2026-09-16 (글·댓글·공감·신고를 통째로)',
  Recharts: '2026-08-28 (그래프를 직접 그린다)',
  recharts: '2026-08-28 (그래프를 직접 그린다)',
  SQLite: '쓴 적이 없다 (운영은 Postgres, 내 컴퓨터는 JSON 파일 한 장)',
};

// 주석은 걷는다 — 「8/25 에 걷었다」는 설명은 걷어냈다는 **증거**지 되살리는 말이 아니다
// **그 줄 자체가 「없다」고 말하고 있으면 넘긴다.** 「8/25 에 걷었다」 ·
// 「지금은 없는 기능」은 걷어냈다는 **증거**지 되살리는 말이 아니다
const SAYS_GONE = /걷어|걷었|없앴|없어졌|뺐|지웠|뒀다가|안 쓴다|쓴 적이|지금은 없는|없는 기능|삭제/;

const codeLines = (src) => {
  let inBlock = false;
  return src.split('\n').map((raw) => {
    let line = raw;
    if (inBlock) {
      const e = line.indexOf('*/');
      if (e < 0) return '';
      line = line.slice(e + 2); inBlock = false;
    }
    for (;;) {
      const o = line.indexOf('/*');
      if (o < 0) break;
      const c = line.indexOf('*/', o + 2);
      if (c < 0) { line = line.slice(0, o); inBlock = true; break; }
      line = line.slice(0, o) + ' ' + line.slice(c + 2);
    }
    const s = line.indexOf('//');
    return s < 0 ? line : line.slice(0, s);
  });
};

const walk = (d, out = []) => {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(n)) out.push(p);
  }
  return out;
};

// ── ① 지금을 말하는 화면 글 ──
//
// **지난 일을 적어둔 것은 뺀다** — 공지함(`notices.json` · `changelog.json`)은
// 그때 그랬다는 기록이고, 홈페이지의 「말을 걸지 않는다」는 **걷어냈다는 말 자체**다.
console.log('── 화면이 걷어낸 것을 말하지 않는다 ──');
{
  const hits = [];
  for (const f of walk(SRC)) {
    const rel = path.relative(SRC, f).replace(/\\/g, '/');
    codeLines(fs.readFileSync(f, 'utf8')).forEach((line, i) => {
      for (const word of Object.keys(GONE)) {
        if (!line.includes(word)) continue;
        // 「걷어냈다 · 없앴다 · 뒀다가」가 같은 줄에 있으면 그것은 **걷어냈다는 말**이다
        if (SAYS_GONE.test(line)) continue;
        hits.push(`${rel}:${i + 1}  ${word}`);
      }
    });
  }
  ok('살아 있는 화면 글에 남은 것', hits, []);
}

// ── ② README 의 머리 (지금을 말하는 자리) ──
//
// 개발 일지는 **지난 일**이라 안 본다. 「# 개발 일지」 앞까지만 본다
console.log('\n── README 머리가 지금을 말한다 ──');
{
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const cut = readme.indexOf('# 개발 일지');
  const head = cut < 0 ? readme : readme.slice(0, cut);
  const hits = [];
  head.split('\n').forEach((line, i) => {
    if (line.trim().startsWith('>')) return;        // 「10/27 에 고쳤다」 같은 덧말
    for (const word of Object.keys(GONE)) {
      if (!line.includes(word)) continue;
      if (SAYS_GONE.test(line)) continue;
      hits.push(`README:${i + 1}  ${word} — 걷은 때: ${GONE[word]}`);
    }
  });
  ok('머리에 남은 것', hits, []);
  console.log(`     (보는 데까지 ${head.split('\n').length}줄 · 일지는 지난 일이라 안 본다)`);
}

// ── ③ 짐에 없는 것을 쓴다고 적지 않았나 ──
console.log('\n── 적어둔 짐이 실제 짐과 같은가 ──');
{
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  ok('recharts 는 짐에 없다', deps.includes('recharts'), false);
  ok('  그래프는 직접 그린다', fs.existsSync(path.join(SRC, 'components', 'charts', 'LineChart.jsx')), true);
}

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
