// **말없이 자르는 목록이 있는가** (2026-10-27)
//
//   npm run cut     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 이 집의 자 — 홈트 거르개에 적어둔 그대로다:
//
// > 좁혀서 안 보이는 것이 있으면 **그렇다고 말한다.** 안 적으면 프로그램이 줄어든
// > 줄 안다.
//
// 그런데 `.slice(0, N).map(…)` 으로 자르고 **아무 말도 안 하는 자리**가 셋 있었다 —
//
//   · 「운동」의 시작하는 자리: 루틴을 **넷만** 그렸다. 다섯 개 이상 짜둔 사람은
//     방금 짠 것이 여기 없으면 **사라진 줄 안다**
//   · AI 관리자의 판정 기록: 서버가 **100건**을 보내는데 **50건만** 그렸다.
//     보안 기록은 「없는 것」과 「안 보여주는 것」이 전혀 다른 자리다
//   · 1년 기록 벽의 해 고르기: **세 해만** 줬다. 네 해 이상이면 **옛 해로 갈 길이
//     아예 없었다** — 앱 소개가 「한 해를 금속판 열두 장에 새깁니다」라고 말하는 자리다
//
// ── 어떻게 보나 ──
//
// 「더 있다고 말하는가」를 글자로 알아보려 해봤는데 **그게 안 된다.** 말하는 꼴이
// 자리마다 다르다 — 「나머지 N종목은 히스토리에 있습니다」 · 「외 N개」 ·
// 「모두 보기」 · 「아래에서 보기」. 느슨하게 보면 거짓 통과하고, 좁게 보면
// 멀쩡한 자리가 FAIL 한다(처음에 둘 다 겪었다).
//
// 그래서 **자리를 세어 적는다.** 자르고 그리는 자리마다 **까닭 한 줄**을 여기 둔다.
// 새 자리가 생기면 여기도 저기도 없어서 FAIL 하고, 그때 사람이 「말해야 하는가」를
// 정한다. **세는 것이 아니라 정하는 일**이라 사람이 한 번 봐야 한다.

const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const SRC = path.join(__dirname, '..', 'src');
const walk = (d, out = []) => {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(n)) out.push(p);
  }
  return out;
};
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

// 자른 뒤 **바로 그리는** 꼴만 본다
const CUT = /\.slice\(\s*0\s*,\s*([A-Za-z_]\w*|\d+)\s*\)\s*\.map\(/;

// ── 자르고 그리는 자리와 **그 까닭** ──
//
// 값은 「어떻게 말하는가」 또는 「왜 말 안 해도 되는가」다.
// **파일마다 몇 자리인지도 적는다** — 한 파일에 새 자리가 늘면 그것도 잡힌다.
const SITES = {
  'components/AiAdminPanel.jsx': [1, '받아온 수와 그리는 수를 **둘 다 적는다** (`logs.length > SHOWN_LOGS`)'],
  'components/BestRecords.jsx': [1, '「나머지 N종목은 히스토리에 있습니다」를 바로 아래에 적는다'],
  'components/DaySheet.jsx': [1, '그날 요약 셋 — 「아래에서 보기」로 그날 전부를 볼 길을 같이 준다'],
  'components/SessionFinish.jsx': [1, '「외 N개」를 바로 아래에 적는다'],
  'components/WeeklyReport.jsx': [1, '**부위 분포 상위 몇 개**다 — 막대의 합이 100%가 아닌 것이 눈에 보인다'],
  // `components/YearWall.jsx` 는 **목록에 없다** — 10/27 에 자르는 것을 아예 걷었다.
  // 「해는 자르지 않는다」를 아래에서 따로 본다
  'components/home/TodayCard.jsx': [1, '홈의 바로 시작 — 전부는 「운동」 탭에 있고, 그 탭이 수를 적는다'],
  'components/measure/OneRMSection.jsx': [1, '**최근 다섯**이다 — 그 아래가 1RM 계산기고, 기록 전부는 「몸 → 재는 도구」에 있다'],
  'data/customTones.js': [2, '그리는 것이 아니라 **담는 한도**다 — 저장할 때 넘치는 것을 버린다'],
  'pages/HistoryPage.jsx': [1, '**부위 비율 네 개를 한 줄로** 요약한다 — 목록이 아니라 한 문장이다'],
  'pages/HomeworkoutPage.jsx': [2, '**부위 막대 상위 네 개**다 — 그 아래에 「아직 안 건드린 곳」을 다 적는다'],
  'pages/PartsPage.jsx': [1, '그 운동이 **주로 달구는 곳 셋**이다 — 옆의 몸 그림이 여섯 부위를 다 칠한다'],
  'pages/SiteHome.jsx': [1, '부위 이름 **예시 다섯**이다 — 전부라고 말하지 않는다'],
  'pages/TrainPage.jsx': [1, '짜둔 수와 보이는 수를 **둘 다 적는다** (`routines.length > SHOWN_ROUTINES`)'],
  'pages/support/AskFirst.jsx': [1, '앞의 여섯만 보여주고 **「모두 보기」**를 둔다'],
  'pages/support/SupportPage.jsx': [1, '다가오는 점검 셋 — 전부는 공지함에 있다'],
};

const found = {};
for (const f of walk(SRC)) {
  const rel = path.relative(SRC, f).replace(/\\/g, '/');
  codeLines(fs.readFileSync(f, 'utf8')).forEach((line) => {
    if (CUT.test(line)) found[rel] = (found[rel] || 0) + 1;
  });
}

console.log('── 자르고 그리는 자리 ──');
const news = Object.keys(found).filter((k) => !SITES[k]);
ok('적어두지 않은 자리', news, []);
const grew = Object.keys(found).filter((k) => SITES[k] && found[k] !== SITES[k][0])
  .map((k) => `${k}: ${SITES[k][0]} → ${found[k]}`);
ok('적어둔 수와 같다', grew, []);
const gone = Object.keys(SITES).filter((k) => !found[k]);
ok('없어진 자리는 목록에서 빼둔다', gone, []);
console.log(`     (자리 ${Object.values(found).reduce((a, b) => a + b, 0)}개 · 파일 ${Object.keys(found).length}개)`);

// ── 오늘 고친 셋은 **수를 글에 적는지**까지 본다 ──
console.log('\n── 자르는 수를 글에 적는다 ──');
const read = (...p) => codeLines(fs.readFileSync(path.join(SRC, ...p), 'utf8')).join('\n');
const train = read('pages', 'TrainPage.jsx');
const admin = read('components', 'AiAdminPanel.jsx');
const wall = read('components', 'YearWall.jsx');
ok('루틴은 이름 붙은 수로 자른다', /slice\(0, SHOWN_ROUTINES\)/.test(train), true);
ok('  안 보이는 루틴 수를 적는다',
  /routines\.length > SHOWN_ROUTINES/.test(train) && /routines\.length}개 중/.test(train), true);
ok('판정 기록도 이름 붙은 수로 자른다', /slice\(0, SHOWN_LOGS\)/.test(admin), true);
ok('  안 보이는 기록 수를 적는다',
  /logs\.length > SHOWN_LOGS/.test(admin) && /logs\.length}건/.test(admin), true);
ok('해는 자르지 않는다', /years\.map\(/.test(wall) && !/years\.slice\(/.test(wall), true);

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
