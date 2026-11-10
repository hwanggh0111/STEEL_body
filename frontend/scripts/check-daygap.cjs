// **「며칠 전인가」를 세는 손이 몇 벌인가** (2026-11-10).
//
//   npm run daygap     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 벼림이 넘긴 전수 지도(「화면 파일에 박힌 셈 45자리」)를 내가 다시 세다가 걸렸다.
// 밀리초로 날짜를 세는 자리가 **열세 벌**이고, 그중 다섯이 **한 글자도 안 다르다** —
//
//     return Number.isFinite(ms) ? Math.round(ms / 86400000) : null;
//
// `bodyChange.js:37` · `personalRecord.js:209` · `shapeHistory.js:98` ·
// `shapeRead.js:53` · `sorePart.js:31`.
//
// ★★ **그리고 더 나쁜 것이 있었다 — 이 자가 내 첫 수를 잡아줬다.**
// `daysBetween` 이라는 **이름이 셋**이고 그중 **둘이 `export`** 다:
//
//     personalRecord.js:206   Math.abs 를 쓴다 — 어느 쪽이 앞이든 **0 이상**
//     compare.js:35           부호를 지킨다 — `b - a` 라 **음수가 나온다**
//     bodyChange.js:34        파일 안에서만 쓴다
//
// 둘을 불러 견줬다 — `('2026-11-12','2026-11-10')` 에 하나는 **2**, 하나는 **-2** 다.
// 지금은 한 화면이 둘을 같이 들이지 않아 안 닿는다(`ComparePage` 만 `compare` 쪽을 쓴다).
// 그런데 **이름이 같아서** 다음 사람이 어느 쪽을 들였는지 안 보고 쓰면 부호가 뒤집힌다.
//
// ★ 그런데 **`personalRecord.js` 의 것은 `export` 되어 있다**(`daysBetween`).
// `bodyHeat.js` · `BestRecords.jsx` · `PersonalRecordBanner.jsx` 는 그것을 들여다 쓴다.
// 나머지 넷은 **같은 이름 · 같은 코드를 제 파일 안에 또 만들었다** —
// `bodyChange.js:34` 는 이름까지 `daysBetween` 이다. 읽는 사람은 같은 손인 줄 안다.
//
// 오늘 하루에 같은 모양을 넷 봤다 —
//   무게 읽는 손 넷 벌(`weighthands`) · 날짜 거르는 손 열세 벌(`datehands`) ·
//   앱 이름 두 벌(`brand`) · 로고 다섯 벌(`logo`). **이것이 다섯째다.**
//
// ── 고치지 않고 자만 세운다 ──
//
// 한 손으로 모으는 것은 **리팩터링**이고 사람 눈에 보이는 변화가 없다. 그런데
// `src` 를 건드리는 판은 이 저장소에서 **7일 안에 84% 확률로 고침이 따라온다**
// (11/10 에 내가 센 기준선 · 위약 58%). **값이 안 보이는 일에 그 확률을 쓰지 않는다.**
// 대신 **새로 생기는 것을 막는다** — 오늘 원판 ⑥·날짜 손에 내린 것과 같은 처방이다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 하루를 밀리초로 적은 수. 이 수가 코드에 박혀 있으면 **날짜를 손으로 세는 자리**다
const DAY_MS = '86400000';
// 지금 그렇게 세는 자리 — **파일 이름만** 적는다. 줄 번호를 적으면 주석 한 줄에
// 어긋난다(오늘 벼림이 그 자리를 밟았고 나도 세 번 밟았다)
const 허락 = [
  'data/bodyChange.js', 'data/compare.js', 'data/measureChange.js',
  'data/offline.js', 'data/offlineNotes.js', 'data/partVolume.js',
  'data/personalRecord.js', 'data/plans.js', 'data/shapeHistory.js',
  'data/shapeRead.js', 'data/sorePart.js',
  // 상수 선언 자리다 — 세는 자리가 아니지만 수는 박혀 있다
  'data/measureRange.js',
  'pages/HomeworkoutPage.jsx',
];
// `daysBetween` 이라는 이름을 **제 파일 안에서 선언**한 자리. 지금 둘이다 —
// 늘면 FAIL 하고, 줄이는 것은 좋은 쪽이라 안 막는다
const OWN_COPIES = ['data/bodyChange.js', 'data/compare.js'];

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(jsx?|cjs)$/.test(e.name)) files.push(p);
  }
}(path.join(ROOT, 'src')));

// 주석은 뗀다 — 오늘만 세 번 거짓 FAIL 을 낸 자리다(`brand` · `logo` · `check-data`)
const codeOf = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const 자리 = [];
for (const f of files) {
  const src = codeOf(fs.readFileSync(f, 'utf8'));
  if (!src.includes(DAY_MS)) continue;
  const rel = path.relative(path.join(ROOT, 'src'), f).split(path.sep).join('/');
  const n = (src.match(new RegExp(DAY_MS, 'g')) || []).length;
  자리.push({ rel, n });
}

console.log('── 날짜를 밀리초로 세는 자리 ──');
{
  const 새것 = 자리.map((r) => r.rel).filter((r) => !허락.includes(r));
  ok('★ 새로 생긴 자리가 없다', 새것, []);
  const 합 = 자리.reduce((a, r) => a + r.n, 0);
  console.log('     지금 ' + 합 + '벌 / ' + 자리.length + '파일');
  자리.forEach((r) => console.log('       ' + r.rel + (r.n > 1 ? '  ×' + r.n : '')));
}

console.log('');
console.log('── 공용 손이 있는데 따로 만든 자리 ──');
{
  // `personalRecord.js` 가 `daysBetween` 을 내보낸다. 같은 이름을 **제 파일 안에서
  // 선언**한 자리를 센다 — 이름이 같으면 읽는 사람은 같은 손인 줄 안다
  const pr = fs.readFileSync(path.join(ROOT, 'src/data/personalRecord.js'), 'utf8');
  ok('공용 손이 내보내져 있다', /export function daysBetween/.test(pr), true);

  const 따로 = [];
  for (const f of files) {
    const rel = path.relative(path.join(ROOT, 'src'), f).split(path.sep).join('/');
    if (rel === 'data/personalRecord.js') continue;
    const src = codeOf(fs.readFileSync(f, 'utf8'));
    if (/(?:^|\s)function daysBetween\s*\(/.test(src)) 따로.push(rel);
  }
  // ★ 지금 하나다(`bodyChange.js`). **늘어나면 FAIL** — 줄이는 것은 좋은 쪽이라 안 막는다
  ok('★ 같은 이름을 따로 만든 자리가 늘지 않았다',
    따로.filter((r) => !OWN_COPIES.includes(r)), []);
  console.log('     지금 따로 만든 자리: ' + (따로.join(' · ') || '없다'));
  console.log('     (고치지 않았다 — 리팩터링이라 사람 눈에 안 보이는데 `src` 를 건드리는');
  console.log('      판은 7일 안에 84% 로 고침이 따라온다. 새로 생기는 것만 막는다)');
}

console.log('');
console.log('── ★ 같은 이름을 내보내는 자리가 몇인가 ──');
{
  // **이름이 같은데 답이 다르면** 들이는 쪽이 어느 것인지 안 보고 쓴다.
  // 오늘 고친 류(「같은 말로 다른 수」)의 교과서다
  const exported = [];
  for (const f of files) {
    const rel = path.relative(path.join(ROOT, 'src'), f).split(path.sep).join('/');
    const src = codeOf(fs.readFileSync(f, 'utf8'));
    if (/export function daysBetween\s*\(/.test(src)) exported.push(rel);
  }
  ok('★ 내보내는 자리가 늘지 않았다',
    exported.filter((r) => !['data/personalRecord.js', 'data/compare.js'].includes(r)), []);
  console.log('     지금 ' + exported.join(' · '));
  // 둘이 **다르게 답한다**는 것을 못 박아 둔다 — 같아지면 그때 이 줄을 지운다
  // ★ **함수 본문만 본다.** 파일 전체를 보면 그 파일의 **다른 함수**가 쓴 `Math.abs`
  // 가 걸린다 — 첫 판이 `compare.js` 에서 그 거짓 FAIL 을 냈다. 자가 나를 잡았다
  const bodyOf = (rel) => {
    const src = codeOf(fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8'));
    const i = src.indexOf('function daysBetween');
    if (i < 0) return '';
    const j = src.indexOf(String.fromCharCode(10) + '}', i);
    return src.slice(i, j < 0 ? src.length : j);
  };
  ok('  personalRecord 쪽은 절대값이다 (0 이상)', /Math\.abs\(/.test(bodyOf('data/personalRecord.js')), true);
  ok('  compare 쪽은 부호를 지킨다 (음수가 난다)', /Math\.abs\(/.test(bodyOf('data/compare.js')), false);
  console.log('     ↑ ("2026-11-12","2026-11-10") 에 하나는 2, 하나는 -2 다.');
  console.log('       지금은 한 화면이 둘을 같이 안 들여서 안 닿는다 —');
  console.log('       닿는 날 보이는 것은 「-2일 전」이라 에러가 아니라 조용히 틀린 수다.');
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
