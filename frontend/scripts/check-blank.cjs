// **「없어요」를 두 번 말하거나, 없다면서 그리지 않는가** (2026-10-28).
//
//   npm run blank     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 기록 화면의 「통계」 갈래에 빈 안내(`EmptyTab`)가 **둘** 있었다 —
// 위에 「아직 셀 것이 없어요」, 맨 아래에 「아직 견줄 것이 없어요」. 조건이
// `totalWorkouts === 0` 과 `totalWorkouts === 0 && records.length <= 1` 이라
// **운동을 안 적은 사람에게 큰 빈 화면이 나란히 둘** 떴고 「운동 적으러 가기」
// 단추도 둘이었다. 바로 위 달력 갈래에 **「같은 말을 두 번 한다. 한 줄이면 된다」**
// 고 적어둔 그 자리다.
//
// 반대쪽도 있었다 — 통계 상자가 `totalWorkouts > 0` 하나로 막혀 있어서,
// **인바디만 적은 사람**에게는 「아직 셀 것이 없어요 — 인바디 잰 횟수를 여기서
// 셉니다」라고 적어놓고 그 숫자를 안 보여주고, **바로 아래에 체중 그래프를 그렸다.**
//
// ── 여기가 지키는 것 ──
//
// 글자로 「EmptyTab 이 둘이면 FAIL」 하면 안 된다 — 갈래가 여럿이면 둘이 맞다.
// 그래서 **조건을 꺼내 값으로 돌린다**: 갈래마다 `{조건 && (` 를 모아 빈 안내인지
// 그리는 것인지 가르고, 있을 수 있는 상태를 다 넣어 본다.
//   1. 한 상태에서 빈 안내가 **둘 이상** 참이면 FAIL
//   2. 빈 안내가 참인 상태에서 **그리는 것**이 참이면 FAIL (없다면서 그린다)
const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 주석이 검사를 통과시키면 안 된다 — `/*` 는 앞에 공백이나 `{` 가 있을 때만 주석으로
// 본다(`accept="image/*"` 가 주석 시작으로 읽히면 그 아래가 통째로 사라진다)
const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');

const FILE = path.join(__dirname, '..', 'src', 'pages', 'HistoryPage.jsx');
const src = codeOf(fs.readFileSync(FILE, 'utf8'));

// 넣어 볼 상태. 「운동 몇 건 · 인바디 몇 번」으로 갈리는 화면이다
const STATES = [];
for (const w of [0, 7]) for (const r of [0, 1, 2]) {
  STATES.push({ totalWorkouts: w, totalDays: w ? 3 : 0, records: { length: r } });
}
const label = (st) => `운동 ${st.totalWorkouts} · 인바디 ${st.records.length}`;

// 갈래 하나를 잘라낸다 (`{seg === 'stats' && (<>` … `</>)}`). 조각이 둘이면 이어 붙인다
const chunksOf = (segName) => {
  const out = [];
  const mark = `{seg === '${segName}' && (<>`;
  let from = 0;
  for (;;) {
    const i = src.indexOf(mark, from);
    if (i < 0) break;
    const j = src.indexOf('</>)}', i);
    out.push(src.slice(i + mark.length, j < 0 ? src.length : j));
    from = j < 0 ? src.length : j + 1;
  }
  return out;
};

// `{조건 && (` 를 모은다. 바로 뒤에 `<EmptyTab` 이 오면 빈 안내다
const guardsOf = (chunk) => {
  const found = [];
  for (const m of chunk.matchAll(/\{([^{}\n]+?) && \(/g)) {
    const after = chunk.slice(m.index + m[0].length, m.index + m[0].length + 200);
    found.push({ cond: m[1].trim(), empty: /<EmptyTab/.test(after) });
  }
  return found;
};

for (const seg of ['stats', 'wall']) {
  const chunks = chunksOf(seg);
  console.log(`── 「${seg}」 갈래 ──`);
  ok('  조각을 찾았다', chunks.length > 0, true);
  const guards = chunks.flatMap(guardsOf);
  const empties = guards.filter((g) => g.empty);
  const draws = guards.filter((g) => !g.empty);
  console.log(`     빈 안내 ${empties.length}개 · 그리는 칸 ${draws.length}개`);
  ok('  빈 안내가 하나는 있다', empties.length >= 1, true);

  const test = (cond, st) => {
    try {
      // eslint-disable-next-line no-new-func
      return !!Function('totalWorkouts', 'totalDays', 'records', `"use strict";return (${cond});`)(
        st.totalWorkouts, st.totalDays, st.records,
      );
    } catch {
      return null;      // 이 갈래가 안 보는 값으로 갈리는 조건이다 — 건너뛴다
    }
  };

  const twice = [];
  const bothWays = [];
  for (const st of STATES) {
    const onEmpty = empties.filter((g) => test(g.cond, st) === true);
    if (onEmpty.length > 1) twice.push(label(st) + ' → ' + onEmpty.map((g) => g.cond).join(' / '));
    if (onEmpty.length >= 1) {
      const drawn = draws.filter((g) => test(g.cond, st) === true);
      if (drawn.length) bothWays.push(label(st) + ' → 없다면서 그린다: ' + drawn.map((g) => g.cond).join(' / '));
    }
  }
  ok('  빈 안내가 둘 뜨는 상태', twice, []);
  ok('  없다면서 그리는 상태', bothWays, []);
  console.log('');
}

console.log(bad === 0 ? '모두 통과' : bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
