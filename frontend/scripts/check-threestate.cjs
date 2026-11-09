// **못 받은 것과 없는 것은 다르다** — 상태가 셋인데 분기가 둘인 자리 (2026-11-09).
//
//   npm run threestate     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 11/09 에 같은 류를 **세 자리에서** 잡았다 —
//
//   고객센터  공지를 눌러도 영영 「불러오는 중…」 (`FeedDetailBody`)
//   목표      못 받았는데 「불러오는 중…」이 영영 돌았다 (관리자가 고쳤다)
//   루틴·측정 못 받아왔는데 **「아직 만든 루틴이 없어요」·「측정 기록이 없어요」**
//
// 앞의 둘을 닫은 반나절 안에 뒤의 것이 또 나왔다. **류를 하나 닫으면 앱 전체에서
// 그 류를 훑는 것까지가 한 건**이라고 정했고, 다시 들어오지 못하게 자를 박는다.
//
// ── 무엇을 보는가 ──
//
// 받아오는 자리의 상태는 **셋**이다 — 받는 중 · 받음 · **못 받음**. 그런데 화면은
// 둘로만 갈라지기 쉽다(`loading` 과 그 나머지). 그러면 **못 받은 것이 「없다」로
// 둔갑한다** — 루틴이 열 개인 사람에게 「아직 만든 루틴이 없어요 · 만들어보세요」라고
// 말하고, 재둔 사람에게 「안 쟀어요」라고 말한다.
//
// 토스트로 알리는 것은 **모자라다.** 토스트는 몇 초 뒤 사라지고 그 뒤에 남는 화면이
// 거짓을 말한다. **상태로 남겨야** 한다.
//
// 글자를 세는 자다 — 화면을 띄워 확인할 수 없는 것이라(실패를 일부러 만들어야 한다)
// 코드가 그 모양인지로 본다.
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
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');

console.log('── 받아오는 화면이 「못 받음」을 상태로 남기는가 ──');
// ★ **실패를 토스트로만 알리고 끝내지 않는다.** 아래 자리들은 그 목록이 비면
// 「없어요」라고 적는 화면이라, 못 받은 것을 상태로 안 남기면 그 말이 거짓이 된다
for (const [rel, flag] of [
  ['src/pages/RoutinePage.jsx', 'routinesFailed'],
  ['src/pages/MeasurePage.jsx', 'failed'],
]) {
  const src = codeOf(read(rel));
  const name = rel.split('/').pop();
  ok(`${name} 이 못 받음을 상태로 남긴다`, new RegExp(`set${flag[0].toUpperCase()}${flag.slice(1)}\\(true\\)`).test(src), true);
  ok('  성공하면 그 상태를 내린다', new RegExp(`set${flag[0].toUpperCase()}${flag.slice(1)}\\(false\\)`).test(src), true);
  // 토스트만 띄우고 상태를 안 남기는 꼴이 남아 있나
  // ★ **받아오는 그 자리**만 본다 — 저장·삭제·내보내기 실패 토스트는 정직한 것이다
  //    (처음에 파일 전체에서 보다가 CSV 내보내기 토스트를 잡았다)
  const load = new RegExp(`client\\.get\\('/(my-routines|measures)'\\)[\\s\\S]{0,900}?\\.catch\\(`);
  const m = load.exec(src);
  const afterCatch = m ? src.slice(m.index + m[0].length, m.index + m[0].length + 200) : '';
  ok('  받아오는 자리의 실패가 상태를 남긴다', /set[A-Za-z]*[Ff]ailed\(true\)/.test(afterCatch), true);
  ok('  다시 받는 길을 준다', /다시 받기/.test(read(rel)), true);
}

console.log('');
console.log('── 「없다」고 말하기 전에 「못 받았나」를 먼저 보는가 ──');
{
  const rp = read('src/pages/RoutinePage.jsx');
  // 빈 자리 안내가 **둘**이어야 한다 — 못 받음 · 정말 없음
  ok('루틴: 못 받았으면 다른 말을 한다', /루틴을 못 불러왔어요/.test(rp), true);
  ok('  정말 없을 때만 「루틴 없음」', /!routinesFailed && \(/.test(rp), true);
  // ★ 글자 거리로 보면 두 블록이 붙어 있어서 엉뚱하게 걸린다 — **차례**로 본다
  const iFail = rp.indexOf('&& routinesFailed && (');
  const iNot = rp.indexOf('&& !routinesFailed && (');
  const iMake = rp.indexOf('추천 루틴」에서 골라');
  ok('  두 안내가 다 있다', iFail > 0 && iNot > 0, true);
  ok('  「만들어보세요」는 **정말 없을 때** 블록에만 있다', iMake > iNot, true);
  ok('    못 받음 블록이 먼저 온다', iFail < iNot, true);

  const mp = read('src/pages/MeasurePage.jsx');
  ok('측정: 못 받았으면 갈래를 아예 안 그린다', /failed && measures\.length === 0 \? \(/.test(mp), true);
  ok('  갈래 일곱을 각자 고치지 않았다 (한 자리에서 가린다)',
    (mp.match(/failed/g) || []).length < 12, true);
  ok('  다시 받는 길을 준다', /다시 받기/.test(mp), true);
}

console.log('');
console.log('── 먼저 닫은 두 자리가 그대로 있는가 ──');
{
  // 고객센터 — 상태 넷 (본문 있음 · 아직 안 옴 · 못 받음 · **묶음은 왔는데 그 줄이 없음**)
  const fd = read('src/pages/support/FeedDetailBody.jsx');
  ok('고객센터: 묶음은 왔는데 그 줄이 없을 때를 가린다', /본문이 아직 안 올라왔어요/.test(fd), true);
  // ★ 주석에도 「불러오는 중」이 적혀 있어서 글자로는 못 가린다 — **코드만** 보고 차례로 본다
  const fdCode = codeOf(fd);
  const iHas = fdCode.indexOf('if (details)');
  const iWait = fdCode.indexOf('불러오는 중');
  ok('  「없다」를 「불러오는 중」보다 먼저 가린다', iHas > 0 && iWait > iHas, true);
  // 묶음이 왔는지 안 왔는지로 가른다 — 그 분기가 없으면 영영 도는 그 모양으로 돌아간다
  ok('  묶음이 왔는지로 가른다', /if \(details\) \{/.test(fdCode), true);
  // 목표 — 관리자가 닫은 자리
  const gp = read('src/pages/GoalPage.jsx');
  ok('목표: 못 받았을 때를 가린다', /failed/.test(gp), true);
}

console.log('');
console.log('── 저장소가 그 깃발을 들고 있는가 ──');
// 화면이 볼 수 있어야 가릴 수 있다. 깃발이 없는 저장소는 화면도 못 가린다
for (const st of ['inbodyStore', 'workoutStore', 'noteStore', 'goalStore', 'gymStore', 'reportStore', 'routineSessionStore']) {
  const src = read(`src/store/${st}.js`);
  ok(`${st} 에 못 받음 깃발이 있다`, /failed/.test(src), true);
}

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
