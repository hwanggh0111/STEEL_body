// 못 불러온 것을 「없다」로 읽지 않는가 (2026-10-06).
//
//   npm run loadfail     (npm run check 에도 들어 있다)
//
// ── 「기구」 탭이 9/17 에 겪은 것 ──
//
// 캡처를 뽑다가 레이트 리밋(429)에 걸려 **「불러오는 중…」에 영영 멈춘 화면**을
// 실제로 봤고, 그때 그 자리에 적어뒀다 — **「못 불러온 것과 없는 것은 다르다」**.
//
// 그런데 그 교훈이 **인바디에는 안 와 있었다.** 인바디 스토어는 실패를 조용히
// 삼켰고(`catch { set({ loading: false }) }`), 화면은 빈 목록을
// **「기록 없음 · 체중부터 한 줄 적어두면」**으로 읽었다. 몇 달 적어온 사람이
// 신호 한 번 끊겼다고 그 화면을 본다. 게다가 인바디 화면은 **비어 있으면 적는
// 폼을 저절로 여는데**, 그 말을 믿고 적으면 **같은 날이 두 줄**이 된다.
//
// ── 왜 검사로 두나 ──
//
// 이 구멍은 **눈에 안 보인다.** 서버가 멀쩡하면 영영 안 나타나고, 나타나는 날은
// 신호가 나쁜 날이다 — 그날은 아무도 코드를 안 보고 있다.
//
// 그래서 **목록을 서버에서 받아 화면에 그리는 스토어**마다 「못 받았다」를 들고
// 있는지 본다. 들고만 있으면 안 되고 화면이 그것을 **읽어야** 한다.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let bad = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label} → ${JSON.stringify(got)}${pass ? '' : ` (기대: ${JSON.stringify(want)})`}`);
};

// 목록을 받아 **빈 상태를 그리는** 스토어들. 값 하나만 들고 오는 것(goalStore)은
// 다른 길로 푼다 — 거기는 `loaded` 를 안 켜서 「없다」와 「못 받았다」를 가른다
// (그 까닭이 그 파일에 적혀 있다).
const STORES = [
  { file: 'store/inbodyStore.js', page: 'pages/InbodyPage.jsx', name: '인바디' },
  { file: 'store/gymStore.js', page: 'pages/GymPage.jsx', name: '기구' },
];

// ── 여기 없는 둘 ──
//
// **운동 기록**(`workoutStore`)은 같은 문제를 **다른 길로** 이미 풀었다 —
// 받아온 것을 기기에 담아두고(`saveCache`), 못 받으면 그것으로 그린다. 그 자리에
// 같은 말이 적혀 있다: 「못 받아온 것과 없는 것은 다르다 — 신호가 없어 못 받았으면
// 마지막으로 담아둔 것으로 그린다. 지하에서도 지난 기록은 보여야 한다」.
// 깃발이 아니라 캐시로 푼 것이라 **여기서 깃발을 요구하면 멀쩡한 코드를 실패로
// 만든다.** (처음에 넣어뒀다가 그렇게 돼서 뺐다.)
//
// **목표**(`goalStore`)는 값 하나라 또 다른 길이다 — 실패했을 때 `loaded` 를
// **안 켠다.** 그래서 「세운 목표가 없다」와 「아직 못 받았다」가 갈린다.
// 그 까닭도 그 파일에 적혀 있다.

console.log('── 스토어가 「못 받았다」를 들고 있나 ──');
//
// **낱말이 있나로 세지 않는다.** 처음에는 `/failed/.test(src)` 로 봤는데,
// 인바디 스토어에서 `failed: true` 를 지우고 돌려보니 **그대로 통과했다** —
// 선언(`failed: false`)과 주석에 그 낱말이 남아 있었다. 돌려봐야 안다.
//
// 그래서 **`catch` 안에서 실제로 켜는지** 본다. 들고만 있고 안 켜면 아무 일도 안 한다.
for (const s of STORES) {
  const src = read(s.file);
  ok(`${s.name} 스토어`, /failed:\s*false/.test(src), true);
  ok(`  실패했을 때 켠다`, /catch[\s\S]{0,400}?failed:\s*true/.test(src), true);
  // **빈 목록으로 덮으면 안 된다** — 전에 받아둔 것이 있으면 그것을 보여주는 쪽이
  // 조금 묵은 줄보다 낫다
  ok(`  실패했을 때 목록을 비우지 않는다`,
    /catch\s*\{[\s\S]{0,200}?records:\s*\[\]/.test(src) || /catch\s*\{[\s\S]{0,200}?settings:\s*\[\]/.test(src), false);
}

console.log('');
console.log('── 화면이 그것을 읽나 ──');
for (const s of STORES.filter((x) => x.page)) {
  const src = read(s.page);
  ok(`${s.name} 화면이 failed 를 본다`, /failed/.test(src), true);
  ok(`  「못 불러왔어요」를 적는다`, /못 불러왔어요/.test(src), true);
  ok(`  다시 받는 길을 준다`, /다시 받기/.test(src), true);
}

console.log('');
// ── ★ **그 스토어를 쓰는 화면이 하나가 아니다** ── (2026-11-13, 정석)
//
// 위의 「화면이 그것을 읽나」는 **스토어마다 화면 하나**만 봤다. 그래서 인바디
// 스토어를 쓰는 화면이 **여섯**인데 `failed` 를 읽는 것은 `InbodyPage` 하나뿐인
// 것을 못 봤다 — 11/13 에 전수로 깔다가 `ComparePage` 에서 잡았다.
//
// 거기서 나온 것이 이렇다. 못 받으면 `records` 가 빈 채로 `loading` 이 꺼지고,
// 화면은 **「인바디를 두 번 이상 넣으시면 실제 기록으로 바뀝니다」와 예시 숫자**를
// 띄웠다. **인바디를 열 번 넣은 사람**이 신호 한 번 나쁜 자리에서 그 화면을 본다 —
// 없는 것을 없다고 하는 것보다 나쁘다. 가짜 수를 제 기록 자리에 띄우는 것이다.
//
// ── 무엇을 조르고 무엇을 넘기나 ──
//
// **전부 읽으라고 하지 않는다.** 홈 · 기록 화면은 목록이 비면 **그 칸을 아예 안
// 그린다** — 거짓말을 하지 않으니 조를 것이 없다. 조르는 것은 **빈 것을 보고
// 사람에게 말을 거는 화면**이다. 그 말이 「아직 없어요」면 **못 받은 날에 거짓이
// 된다.** 그래서 `records.length` 로 **글을 띄우는** 화면만 본다.
console.log('');
console.log('── ★ 그 스토어를 쓰는 화면이 전부 읽나 ──');
{
  const SRC = path.join(__dirname, '..', 'src');
  const walk = (d, out = []) => {
    for (const n of fs.readdirSync(d)) {
      const f = path.join(d, n);
      if (fs.statSync(f).isDirectory()) walk(f, out);
      else if (/\.jsx$/.test(f)) out.push(f);
    }
    return out;
  };
  const rel = (f) => path.relative(SRC, f).split(path.sep).join('/');
  const files = walk(SRC);

  for (const [store, hook] of [['인바디', 'useInbodyStore'], ['기구', 'useGymStore']]) {
    const 쓰는것 = files.filter((f) => new RegExp(hook + '\(\)').test(fs.readFileSync(f, 'utf8')));
    // **빈 것을 보고 글을 띄우는 화면**만 조른다
    const 말하는것 = 쓰는것.filter((f) => {
      const t = fs.readFileSync(f, 'utf8');
      return /\{\s*records\.length\s*(===\s*0|<\s*\d)[\s\S]{0,400}?[가-힣]/.test(t);
    });
    // **파일 어디든에서 찾지 않는다 — 스토어에서 꺼내 쓰는 줄을 본다.**
    // 처음에 파일 전체를 `/\bfailed\b/` 로 봤다가 `ComparePage` 의 주석 한 줄
    // (「'failed'(iOS 가 손짓 차례를 끊은 경우)」)에 걸려 **되돌려도 안 물었다.**
    // 자가 보는 것은 주석이 아니라 꺼내 쓰는 줄이다 (오늘 글꼴 자에서도 같은 데 물렸다).
    const 꺼내썼나 = (t) => {
      const m = new RegExp('const\\s*\\{([^}]*)\\}\\s*=\\s*' + hook + '\\(\\)').exec(t);
      return !!m && /\bfailed\b/.test(m[1]);
    };
    const 안읽는것 = 말하는것.filter((f) => !꺼내썼나(fs.readFileSync(f, 'utf8')));
    ok(store + ' — 빈 것을 보고 말을 거는 화면이 failed 를 읽는다',
      안읽는것.map(rel), []);
    console.log('       쓰는 화면 ' + 쓰는것.length + ' · 그 중 말을 거는 화면 '
      + 말하는것.length + ' — ' + 말하는것.map(rel).join(' · '));
  }
}

console.log('');
console.log('── 늦게 받는 조각이 못 왔을 때 ── (2026-10-20)');
//
// 무거운 조각을 **눌렀을 때 · 칠 때** 받게 가른 자리가 늘었다(자세 설명 78KB ·
// 운동 사전 22KB). 가르는 것은 좋은데 **못 받는 날**이 생긴다 — 그날 화면이
// 입을 닫으면 위의 스토어들과 똑같은 일이 된다. 지하 헬스장이 이 앱의 자리다.
//
// 「자세 보기」는 둘 다 틀렸었다 — 머리글에는 「접어두고 **말한다**」고 적어뒀는데
// 코드는 접기만 했다. 누른 사람에게는 **아무 일도 안 일어난 것**으로 보인다.
const finder = read('components/ExerciseFinder.jsx');
ok('자세 설명 — 실패를 들고 있다', /setFormErr\(true\)/.test(finder), true);
ok('  접어버리지 않는다 (펴둔 채로 말한다)',
  /if \(!m\) \{ setOpenForm\(false\); return; \}/.test(finder), false);
ok('  「못 불러왔어요」를 적는다', /못 불러왔어요/.test(finder), true);
ok('  다시 받는 길을 준다', /다시 받기/.test(finder), true);
// **다만 지하에서는 다시 받아도 안 온다.** 서비스 워커가 미리 담는 것은 껍데기
// 둘뿐이고 조각은 지나간 것만 담는다 — 그래서 목록을 보고 있는 틈에 담아둔다
ok('  목록을 보고 있을 때 미리 담아둔다', /requestIdleCallback/.test(finder), true);
ok('    데이터 아끼기를 켠 사람은 건드리지 않는다', /saveData/.test(finder), true);
ok('    신호가 없으면 안 받으러 간다', /navigator\.onLine === false/.test(finder), true);
// 미리 담는 것이 **첫 그림을 막으면** 가른 까닭이 없어진다 — 위에서 들여오지 않는다
ok('    위에서 들여오지는 않는다', /^import .*exerciseForm/m.test(finder), false);
// 홈페이지의 운동 사전도 같은 자리다. 그쪽 검사는 `check-feed.cjs` 에 있다
// (거기서 「첫 화면에서 안 받는다」와 함께 본다)
const siteHome = read('pages/SiteHome.jsx');
ok('홈페이지 사전 — 실패를 들고 있다', /setFailed\(true\)/.test(siteHome), true);
ok('  다시 받는 길을 준다', /다시 받기/.test(siteHome), true);

console.log('');
console.log('── 못 받았을 때 적는 폼을 열지 않나 ──');
// 인바디 화면만 그런 자동 열기를 한다. **빈 목록이 「없다」가 아닐 수 있는데**
// 그때 폼을 열면 있는데 또 적게 된다 — 같은 날이 두 줄이 된다
const inbody = read('pages/InbodyPage.jsx');
ok('자동 열기가 failed 를 본다', /if \(loading \|\| failed \|\| autoOpenedRef\.current\) return;/.test(inbody), true);

console.log('');
console.log('── 되돌릴 수 없는 일에 확인이 있나 ──');
// 이 앱은 **인바디 한 줄**을 지울 때도 묻는다. 전·후 사진은 반년을 모은 것이고
// 되돌릴 길이 없는데 **✕ 한 번에 바로 지워졌다** — 덜 아까운 것은 묻고 더
// 아까운 것은 안 묻고 있었다
const compare = read('pages/ComparePage.jsx');
ok('전·후 사진을 지울 때 묻는다', /const handleDelete = async \(\) => \{[\s\S]{0,400}?confirmDialog/.test(compare), true);
ok('  되돌릴 수 없다고 적는다', /되돌릴 수 없어요/.test(compare), true);
// 전·후 두 칸이 나란히 있어서 잘못 누르기 쉽다 — 무엇을 지우는지가 물음에 있어야 한다
ok('  언제 올린 무엇인지 말한다', /\$\{when\}\$\{label\} 사진을 지웁니다/.test(compare), true);
const card = read('components/InbodyCard.jsx');
ok('인바디 한 줄도 묻는다 (전부터 그랬다)', /confirmDialog/.test(card), true);

console.log('\n' + (bad ? `${bad}건 실패` : '전부 통과'));
process.exit(bad ? 1 : 0);
