// **개발 일지에 빠진 날 · 겹친 차수 · 어긋난 차례가 없는가** (2026-11-13, 정석).
//
//   npm run devlog       (npm run check 에도 들어 있다)
//
// ── 왜 자로 두나 ──
//
// 루트 `README.md` 의 개발 일지는 **상시 지시**다(개발할 때마다 그 날짜 머리글에 더한다).
// 그런데 **11/12 한 바퀴(커밋 20개)가 통째로 빠졌다** — 11/13 에 대표가 제 몫을 적으려다
// 알았다. 그날 손이 아닌 사람이 뒤늦게 적으면 **까닭이 빠진다.** 커밋 메시지에 까닭이
// 적혀 있어 되짚을 수는 있었지만(그렇게 메웠다), 그건 운이었다.
//
// 공지 쪽에는 자가 둘 있다(`check-changelog` · `check-feed`). 일지에는 **하나도 없었다** —
// 「커밋은 있는데 일지에 줄이 없는 날」을 아무도 안 보고 있었다.
//
// 그리고 메우는 그 자리에서 **둘이 더 나왔다** —
//   · `2026-11-13 (52차)` 를 적었는데 **52차가 이미 11/11 에 있었다** (겹친 차수)
//   · 그 머리글이 11/11 52차 **아래**에 들어갔다 (이 일지는 최신이 위다 — 어긋난 차례)
// 셋은 같은 류다. 한 자가 셋을 다 본다.
//
// ── 선을 어디에 긋나 ──
//
// ⑴ **오늘은 안 본다.** 하루의 일지는 그날 일이 끝난 뒤 적는다. 오늘 것을 조르면
//    아침 첫 커밋부터 `npm run check` 가 FAIL 로 울어 아무 일도 못 한다.
// ⑵ **`CUTOFF` 앞은 안 본다.** 10/02 · 10/05 는 차수를 **그날마다 1부터 다시** 적던
//    때다(10/06 에 2~11차로 이어 적으면서 전체 번호가 됐다). 지난 것을 고치는 자가
//    아니라 **앞으로 어긋나는 것을 잡는 자**다.
// ⑶ **`feat` · `fix` · `perf` 가 있는 날만 조른다.** `docs` · `chore` · `test` 만 있는
//    날은 사용자 화면이 안 바뀐 날이라 일지에 적을 것이 없다 (`gen-changelog` 와 같은 선).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const README = path.join(__dirname, '..', '..', 'README.md');
const CUTOFF = '2026-10-06';

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 개발 일지 (README.md) ──');

const text = fs.readFileSync(README, 'utf-8');
const heads = [];
text.split(/\r?\n/).forEach((line, i) => {
  const m = line.match(/^## (\d{4}-\d{2}-\d{2}) \((\d+)차\)/);
  if (m) heads.push({ line: i + 1, date: m[1], n: Number(m[2]) });
});
ok('날짜 머리글이 있다', heads.length > 0, true);
if (!heads.length) process.exit(1);

const kept = heads.filter((h) => h.date >= CUTOFF);
console.log('     머리글 ' + heads.length + '개 · 보는 것 ' + kept.length
  + '개 (' + CUTOFF + ' 뒤) · 최신 ' + kept[0].date + ' ' + kept[0].n + '차');

// ── ⑵ 겹친 차수 ──
const at = new Map();
const dup = [];
for (const h of kept) {
  if (at.has(h.n)) dup.push(h.n + '차 — ' + at.get(h.n) + '행 · ' + h.line + '행');
  at.set(h.n, h.line);
}
ok('  차수가 겹치지 않는다', dup, []);

// ── ⑶ 어긋난 차례 — 위가 최신이다 (차수는 내림차순 · 날짜는 거꾸로 가지 않는다) ──
const order = [];
for (let i = 1; i < kept.length; i += 1) {
  const up = kept[i - 1];
  const down = kept[i];
  if (down.n >= up.n) order.push(up.n + '차 아래에 ' + down.n + '차 (' + down.line + '행)');
  if (down.date > up.date) order.push('날짜가 거꾸로 — ' + up.date + ' 아래에 ' + down.date
    + ' (' + down.line + '행)');
}
ok('  차례가 최신부터다', order, []);

// ── ⑴ 빠진 날 ──
//
// 깃이 없거나 얕게 받은 저장소에서는 **조르지 않는다** — 커밋이 안 보이는 것을
// 「일지가 빠졌다」로 읽으면 안 된다 (`gen-changelog.mjs` 와 같은 결).
let log = null;
try {
  log = execFileSync('git', ['log', '--since=' + CUTOFF, '--date=short',
    '--pretty=%ad\t%s'], { cwd: path.join(__dirname, '..', '..'), encoding: 'utf-8' });
} catch { /* 깃이 없다 */ }

if (log === null) {
  console.log('     (깃이 없어 「빠진 날」은 못 본다 — 자리를 비워 둔다)');
} else {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  // 서울 시각으로 오늘을 센다 — UTC 로 세면 아침에 어제가 「오늘」이 된다
  const TODAY = iso(new Date(today.getTime() + 9 * 3600 * 1000));
  const shown = /^(feat|fix|perf)(\([^)]*\))?!?:/;
  const days = new Map();
  for (const row of log.split(/\r?\n/)) {
    const [date, subject] = row.split('\t');
    if (!date || !subject || !shown.test(subject)) continue;
    if (date >= TODAY || date < CUTOFF) continue;
    if (!days.has(date)) days.set(date, subject);
  }
  const logged = new Set(kept.map((h) => h.date));
  const missing = [...days.keys()].filter((d) => !logged.has(d)).sort();
  console.log('     화면이 바뀐 날 ' + days.size + '개 (오늘 ' + TODAY + ' 은 안 본다)');
  ok('  커밋이 있는 날은 일지에 줄이 있다', missing.map((d) => d + ' — ' + days.get(d).slice(0, 44)), []);
}

console.log('');
console.log(bad === 0 ? '전부 통과' : '개발 일지가 ' + bad + '건 어긋납니다');
process.exit(bad === 0 ? 0 : 1);
