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
console.log('── ★ 모집단 — 로딩 문구를 가진 화면 전수 ──');
// ── **자가 류를 닫았다고 적고 파일 넷만 보고 있었다** ── (2026-11-19 · 정석)
//
// 위의 것들은 11/09 에 터진 **그 네 자리를 이름으로** 본다. 그런데 이 류
// (「상태가 셋인데 분기가 둘」)는 **앱 전체**에 있다 — 로딩 문구를 코드에 가진 화면이
// **스물다섯**이고, 자가 이름으로 보는 것은 **넷**이었다. 나머지 스물하나는 지금은
// 멀쩡하지만 **자 밖**이라, 새로 어긋나거나 **새 화면이 붙으면** 아무도 모른다
// (어제만 해도 한 줄 메모 · 좌우 칸 · 묶음 받기 세 화면이 붙었다).
//
// 그래서 **모집단을 이름으로 들지 않고 걸어서 센다.** 로딩 문구가 코드에 있으면
// 그 화면은 **못 받음도 말할 수 있어야** 한다. 글자를 세는 자다 — 실패를 일부러
// 만들어야 보이는 것이라 화면으로는 확인할 수 없다(위 머리글과 같은 까닭).
//
// **예외는 까닭과 함께 적고, 자가 그 까닭이 아직 참인지 확인한다** — 예외 목록만
// 적어두면 그 목록이 썩는다(「없어진 예외」를 11/17 에 `check-corner` 가 잡았다).
{
  const 로딩말 = /불러오는 중|로딩 중|받는 중|받아오는 중/;
  const 못받음표 = /failed|Failed|error|Error|못 불러|못 받|다시 받기|다시 해보|다시 읽기|다시<|retry/;

  // 까닭이 있는 예외 — **그 까닭이 코드에 아직 있는지**까지 본다
  const 예외 = {
    'components/WeightChart.jsx': {
      why: '`lazy` + `Suspense` 의 미리 잡아둔 자리다 — 조각 받기가 실패하면 '
        + 'App 의 `ErrorBoundary` 가 받아 한 번 새로 받는다(그쪽이 이 류의 셋째 상태다)',
      아직참인가: (글) => /lazy\(/.test(글) && /Suspense/.test(글),
    },
    'components/admin/BackupAdmin.jsx': {
      why: '내려받기 **단추 글자**다(`busy ? …`). 실패는 토스트로 말하고, '
        + '그 뒤 남는 화면은 단추뿐이라 **거짓을 말하지 않는다** — 관리자 화면이다',
      아직참인가: (글) => /\.catch\(/.test(글) && /toast\(/.test(글),
    },
  };

  const 파일들 = (d, out = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) 파일들(p, out);
      else if (/\.jsx$/.test(e.name)) out.push(p);
    }
    return out;
  };

  const SRC = path.join(ROOT, 'src');
  const 모집단 = [];
  for (const f of 파일들(SRC)) {
    const 글 = fs.readFileSync(f, 'utf8');
    if (!로딩말.test(codeOf(글))) continue;      // 주석·상수에만 있으면 모집단이 아니다
    모집단.push({ 자리: path.relative(SRC, f).replace(/\\/g, '/'), 글 });
  }

  // **셈 0 은 통과가 아니다** — 걷다 실패하면 「전부 통과」로 보인다
  ok('로딩 문구를 가진 화면을 찾았다 (셈 0 은 통과가 아니다)', 모집단.length > 0, true);
  console.log('       모집단 ' + 모집단.length + '개');

  const 샌것 = [];
  for (const r of 모집단) {
    if (못받음표.test(codeOf(r.글))) continue;
    const e = 예외[r.자리];
    if (e && e.아직참인가(r.글)) continue;
    샌것.push(r.자리 + (e ? ' (예외인데 그 까닭이 코드에서 사라졌다)' : ''));
  }
  ok('로딩을 말하는 화면은 **못 받음도 말한다**', 샌것, []);
  if (샌것.length) {
    console.log('       → 「받는 중」만 있고 「못 받았어요」가 없으면, 못 받은 순간');
    console.log('         그 화면은 **영영 받는 중이라고 말한다**(11/09 의 그 자리).');
    console.log('         상태로 남겨야 한다 — 토스트는 몇 초 뒤 사라진다.');
  }
  for (const [자리, e] of Object.entries(예외)) {
    const r = 모집단.find((x) => x.자리 === 자리);
    ok('  예외 「' + 자리 + '」 의 까닭이 아직 참이다', !r || e.아직참인가(r.글), true);
  }
  console.log('       예외 둘 — ' + Object.entries(예외).map(([k, v]) => k + ': ' + v.why.slice(0, 40) + '…').join(' · '));
}

// ── 되돌려 FAIL — 가짜 화면을 먹여 모집단 자가 사는지 본다 ──
if (process.argv.includes('--되돌려')) {
  console.log('');
  console.log('── 되돌려 FAIL — 가짜 화면 둘을 먹인다 ──');
  const 로딩말 = /불러오는 중|로딩 중|받는 중|받아오는 중/;
  const 못받음표 = /failed|Failed|error|Error|못 불러|못 받|다시 받기|다시 해보|다시 읽기|다시<|retry/;
  const 잡나 = (글) => 로딩말.test(codeOf(글)) && !못받음표.test(codeOf(글));
  const 꼴 = [
    ['로딩만 있고 못 받음이 없는 화면을 잡는다',
      잡나('export default function X(){ return loading ? <p>불러오는 중…</p> : <L/>; }'), true],
    ['  못 받음까지 가린 화면은 안 잡는다',
      잡나('export default function X(){ return loading ? <p>불러오는 중…</p> : failed ? <p>못 불러왔어요</p> : <L/>; }'), false],
    ['  「불러오는 중」이 **주석에만** 있으면 모집단이 아니다',
      로딩말.test(codeOf('// 여기서 불러오는 중 을 적었다\nexport default function X(){ return <L/>; }')), false],
  ];
  let 샌것 = 0;
  for (const [이름, 받은것, 기대] of 꼴) {
    const 집었다 = 받은것 === 기대;
    if (!집었다) { 샌것 += 1; bad += 1; }
    console.log((집었다 ? 'OK   잡는다: ' : 'FAIL 샌다  : ') + 이름 + ' → ' + JSON.stringify(받은것));
  }
  console.log(샌것 ? '  ↑ **가짜를 못 집었다.** 이 자는 모집단을 못 지킨다' : '  가짜 ' + 꼴.length + '개를 다 집었다');
}

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
