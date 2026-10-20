// 뽑아둔 소식 목록이 원본과 어긋나지 않는가 (2026-10-06).
//
//   npm run checkfeed     (npm run check 에도 들어 있다)
//
// ── 왜 뽑아뒀나 ──
//
// 홈페이지(`/site`)의 「소식」 칸은 **날짜와 한 줄, 다섯 개**를 쓴다. 그런데 그걸
// 그리려고 두 파일을 통째로 받고 있었다 — `notices.json` + `changelog.json`,
// **gzip 29,451B.** 무게의 거의 전부가 「자세히」의 `detail` 이고(공지 41개에
// 18,125자) **이 화면은 그것을 한 줄도 안 쓴다.**
//
//     전   83,999B  gzip 29,451B
//     후    3,027B  gzip  1,105B
//
// 여기는 로그인도 앱 설치도 없이 처음 오는 사람이 보는 자리다. 그리고 **공지가
// 쌓일수록 더 벌어진다** — 10/6 하루에 열다섯 개를 더해서 notices 가 10KB 늘었다.
//
// ── 뽑은 파일은 썩는다 ──
//
// `feedList.json` 은 **뽑아 적은 파일**이다(`gen-feed.mjs` 가 만든다). 뽑은 파일의
// 위험은 하나다 — **원본이 바뀌었는데 안 돌려서 낡는 것.** `SiteHome` 의 옛 주석이
// 걱정한 것이 바로 그것이었다(「한쪽만 낡는 날이 온다」).
//
// 그래서 **여기서 다시 뽑아 지금 파일과 맞춰본다.** 어긋나면 `npm run feed` 를
// 돌리라고 말한다. `check-parts.cjs` 가 사전과 부위 표를 맞추는 것과 같은 방식이다.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'data');

let bad = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label} → ${JSON.stringify(got)}${pass ? '' : ` (기대: ${JSON.stringify(want)})`}`);
};

const readJson = (name) => {
  const p = path.join(DATA, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

console.log('── 뽑아둔 소식 목록이 원본과 맞나 ──');

const list = readJson('feedList.json');
ok('feedList.json 이 있다', !!list, true);

if (list) {
  // **지금 것을 적어두고 다시 뽑아 견준다.** 돌려보는 것이 가장 확실하다 —
  // 뽑는 규칙을 여기 또 적으면 그 규칙이 두 벌이 된다.
  //
  // ── 다만 **보고 있는 파일을 고쳐놓지 않는다** ── (2026-10-07, 코드 검토에서 잡혔다)
  //
  // 처음에는 그냥 다시 뽑아 덮어쓰고 견줬다. 그러면 **낡은 것을 한 번만 잡는다** —
  // `notices.json` 을 고치고 `npm run feed` 를 안 돌린 채 올린 사람이 `npm run check`
  // 를 하면 FAIL 이 뜨는데, **그때 이미 파일이 고쳐져 있다.** 다시 돌리면 통과하고,
  // 다음 사람은 **까닭 모를 고쳐진 파일**과 초록 불을 같이 보게 된다.
  //
  // 검사는 **보기만 한다.** 뽑아본 것은 되돌려 놓는다.
  const p = path.join(DATA, 'feedList.json');
  const before = fs.readFileSync(p, 'utf8');
  let after = before;
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'gen-feed.mjs')], { cwd: ROOT, stdio: 'pipe' });
    after = fs.readFileSync(p, 'utf8');
  } finally {
    // 뽑기가 도중에 터져도 **원래 것을 돌려놓는다**
    if (fs.readFileSync(p, 'utf8') !== before) fs.writeFileSync(p, before);
  }
  ok('다시 뽑아도 같다 (아니면 npm run feed)', before === after, true);

  // ── 담은 것이 화면이 쓰는 것뿐인가 ──
  //
  // `detail` 이 한 줄이라도 들어가면 이 파일을 만든 까닭이 없어진다
  const keys = new Set();
  for (const r of list.items || []) Object.keys(r).forEach((k) => keys.add(k));
  ok('detail 을 담지 않았다', keys.has('detail'), false);
  ok('  담은 칸이 셋뿐이다', [...keys].sort(), ['date', 'pinned', 'text']);

  // 홈페이지는 다섯 줄을 쓴다. 고정한 공지가 여럿이면 날짜순이 밀리므로 여유를 둔다
  ok('  다섯 줄보다 넉넉히 담았다', (list.items || []).length >= 5, true);
  // **차례는 뽑을 때 이미 맞춰둔다** — 화면에서 또 정렬하지 않는다
  const dates = (list.items || []).filter((r) => !r.pinned).map((r) => r.date);
  ok('  고정하지 않은 줄은 날짜 역순이다',
    dates.every((d, i) => i === 0 || dates[i - 1] >= d), true);
}

console.log('');
console.log('── 홈페이지가 그것만 받나 ──');
const site = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'SiteHome.jsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split(String.fromCharCode(10)).filter((l) => !/^\s*\/\//.test(l)).join(String.fromCharCode(10));
ok('feedList 를 받는다', /import\('\.\.\/data\/feedList\.json'\)/.test(site), true);
// 큰 파일을 다시 받으면 이 일이 없던 것이 된다
ok('  notices.json 을 안 받는다', /notices\.json/.test(site), false);
ok('  changelog.json 을 안 받는다', /changelog\.json/.test(site), false);
// **받는 때는 그대로 미룬다** — 위에서 그냥 들여오면 첫 화면에 딸려 온다
ok('  화면이 뜬 뒤에 받는다 (위에서 안 들여온다)',
  /^import .*feedList/m.test(site), false);

// ── 운동 사전도 같은 일이었다 ── (2026-10-20)
//
// 이 화면이 사전에서 쓰는 것은 **부위 이름 일곱 글자**뿐인데(「부위로도 찾을 수
// 있어요 — 가슴 · 등 …」) 그걸 쓰려고 **사전 조각 22KB(gzip 10.2KB)를 첫 화면에서
// 같이 받고 있었다.** 미리 받는 목록(`route-chunks.json`)에까지 올라가 있었다.
//
// 이제 **칠 때 받는다** — 두 글자를 치거나 부위 이름을 치면 그때 온다.
ok('사전을 위에서 안 들여온다', /^import .*exerciseDict/m.test(site), false);
ok('  칠 때 받는다', /import\('\.\.\/data\/exerciseDict'\)/.test(site), true);
ok('  부위 이름은 partNames 에서 온다', /from '\.\.\/data\/partNames'/.test(site), true);
// 받는 동안 「못 찾았어요」가 뜨면 없는 운동이라고 믿는다 — 그 사이는 「찾는 중」이다
ok('  받는 동안은 「찾는 중」이다', /찾는 중/.test(site), true);
// **못 받은 것은 못 받았다고 말한다** (2026-10-20). 처음에는 `catch` 가 비어 있어서
// 한 번 못 받으면 글자를 더 쳐도 다시 받지 않았다 — 의존 목록이 `[wants, dict]` 뿐이라
// 글자가 바뀌어도 안 돌았고, **「찾는 중…」이 영원히 남았다**(지하 헬스장)
ok('  못 받은 것을 적어둔다 (catch 가 비어 있지 않다)', /setFailed\(true\)/.test(site), true);
ok('    다시 받는 길을 준다', /다시 받기/.test(site), true);
ok('    못 찾은 것과 다른 말을 한다', /사전을 못 불러왔어요/.test(site), true);

// **두 벌이 되지 않게** — 부위 이름을 고치는 자리는 `partNames.js` 하나다
const partNames = fs.readFileSync(path.join(DATA, 'partNames.js'), 'utf8');
const dict = fs.readFileSync(path.join(DATA, 'exerciseDict.js'), 'utf8');
ok('부위 이름의 원본은 partNames.js 다', /export const PARTS = \[/.test(partNames), true);
ok('  사전은 그것을 다시 내보낸다', /export \{ PARTS \}/.test(dict), true);
ok('  사전에 또 적혀 있지 않다', /export const PARTS = \[/.test(dict), false);
// 떼어낸 것이 사전을 다시 끌고 오면 떼어낸 것이 아니다
ok('  partNames 는 사전을 안 들여온다', /exerciseDict/.test(
  partNames.split(String.fromCharCode(10)).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join(String.fromCharCode(10))), false);
// 노드가 그대로 불러오는 파일이라 확장자가 있어야 한다 (`gen-parts.mjs`)
ok('  사전은 확장자를 적어 들여온다 (노드가 부른다)', /from '\.\/partNames\.js'/.test(dict), true);

// ── 미리 받는 목록에 사전이 없나 ──
//
// 조각을 갈라도 `route-chunks.json` 이 /site 에 적어두면 **첫 화면에서 같이 받는다.**
// 여기가 이 일의 진짜 결과다
const rc = path.join(ROOT, 'dist', 'route-chunks.json');
if (fs.existsSync(rc)) {
  const pre = (JSON.parse(fs.readFileSync(rc, 'utf8')).chunks || {})['/site'] || [];
  ok('/site 가 미리 받는 것에 사전이 없다', pre.some((f) => /exerciseDict/.test(f)), false);
} else {
  console.log('--   dist 가 없어 미리 받는 목록은 건너뜀 (npm run build 뒤에 본다)');
}

console.log('');
console.log('── 공지함은 그대로 전체를 받나 ──');
// 거기는 `detail` 을 펼치고 **그 글까지 검색**한다. 거기서까지 목록만 받으면
// 「자세히」가 빈 채로 열린다
const feedData = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'support', 'feedData.js'), 'utf8');
ok('공지함은 notices.json 을 본다', /notices\.json/.test(feedData), true);
ok('  changelog.json 도 본다', /changelog\.json/.test(feedData), true);
ok('  detail 을 싣는다', /detail/.test(feedData), true);

// 뽑아 적은 파일이라는 말이 그 파일에 적혀 있나 — 손으로 고치면 다음 빌드에 덮인다
if (list) ok('뽑아 적은 파일이라고 적어뒀다', /손으로 고치지 않는다/.test(list.note || ''), true);

console.log('\n' + (bad ? `${bad}건 실패` : '전부 통과'));
process.exit(bad ? 1 : 0);
