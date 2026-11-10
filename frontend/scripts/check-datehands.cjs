// **날짜를 거르는 손이 몇 벌이고, 같은 값에 같게 답하는가** (2026-11-10).
//
//   npm run datehands     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 「오늘까지만 센다」를 하는 자리가 `src/data` 에만 **열세 벌**이다. 한 벌씩 따로 적혀
// 있어서 **어느 순간 한쪽만 바뀐다** — 오늘 하루에 그 류로 둘이 터졌다:
//
//   11/09  통계 칸이 앞날 줄을 셌다 (한 해 벽은 안 셌다)          ee93dfc
//   11/10  홈·고객센터 네 자리가 또 그랬다 (기록 화면은 고쳐졌다)  4ad8737
//
// 무게 쪽에는 자가 둘 섰다 — `weightread`(값을 견준다) · `weighthands`(손이 몇 벌인가).
// **날짜 쪽에는 하나도 없었다.** 그 자리에 선다.
//
// ── 글자로 가르지 않는다 ──
//
// 처음에 `!today ||` 가 있나 없나로 「관대 / 엄함」을 가르려 했는데 **거짓 분류가 났다** —
// `k <= today && listOf(...)` 의 `today &&` 가 가드로 읽혔다. 글자는 뜻을 모른다.
// 그래서 둘로 나눠 본다 —
//
//   ⑴ **불러서 견준다** — 부를 수 있는 손에 같은 기록을 먹이고 나온 값을 맞댄다
//   ⑵ **자리만 센다** — `<= today` 꼴이 몇 벌인가. 분류는 안 한다(분류가 거짓을 낸다).
//      허락 목록에 없는 **새 자리**가 생기면 FAIL — 새로 생기는 것을 막는 것이 이 자의 일이다
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const TMP = [];
function bundle(rel, out) {
  execFileSync(process.execPath, [
    path.join(ROOT, 'node_modules', 'esbuild', 'bin', 'esbuild'),
    path.join(ROOT, rel), '--bundle', '--format=cjs', '--platform=node',
    '--outfile=' + path.join(ROOT, out),
  ], { stdio: 'pipe' });
  TMP.push(out);
  return require(path.join(ROOT, out));
}
const clean = () => { for (const f of TMP) { try { fs.unlinkSync(path.join(ROOT, f)); } catch { /* 남아도 해롭지 않다 */ } } };

// ── 같은 기록을 모두에게 먹인다 ──
// 어제 하나 · **내일 하나** — 앞날이 수를 부풀리는 가장 작은 모양이다
const TODAY = '2026-11-10';
const 어제 = '2026-11-09';
const 내일 = '2026-11-11';
const workouts = {
  [어제]: [{ id: 1, exercise: '벤치프레스', weight: '60', sets: 3, reps: 8, date: 어제 }],
  [내일]: [{ id: 2, exercise: '스쿼트', weight: '80', sets: 3, reps: 5, date: 내일 }],
};

let dateKey; let weekly; let goal;
try {
  dateKey = bundle('src/data/dateKey.js', '.dh-datekey.cjs');
  weekly = bundle('src/data/weeklyReport.js', '.dh-weekly.cjs');
  goal = bundle('src/data/goal.js', '.dh-goal.cjs');
} catch (e) {
  console.log('FAIL 손을 묶지 못했다 → ' + String(e.message || e).slice(0, 200));
  clean();
  process.exit(1);
}

console.log('── 같은 기록을 먹이면 같은 수가 나오는가 ──');
{
  // 오늘까지 **한 날**은 하루(어제)다. 앞날은 아직 한 것이 아니다
  const 센날 = dateKey.upToToday(Object.keys(workouts), TODAY);
  ok('upToToday 가 센 날', 센날, [어제]);

  // 주간 요약 — 그 주에 **한 날**이 며칠인가
  const w = weekly.volumeOf ? null : null;   // volumeOf 는 날짜를 안 본다(줄만 센다)
  void w;

  // 목표 — 이번 주에 몇 번 했나. `doneIn` 은 안 내보내므로 `weekProgress` 로 본다
  const prog = goal.weekProgress(workouts, { weeklyTarget: 3 }, TODAY);
  ok('목표가 센 횟수', prog && prog.done, 1);
  ok('  ★ 위 둘이 같은 수다', prog && prog.done, 센날.length);

  // 연속 주 — 같은 기록에서 앞날을 세면 주가 늘어난다
  const st = goal.weekStreak(workouts, { weeklyTarget: 1 }, TODAY);
  ok('연속 주가 돈다', st && typeof st.current === 'number', true);
}

console.log('');
console.log('── today 를 안 주면 어떻게 되는가 (지금은 안 닿는 갈래다) ──');
{
  // ★ **여기서 갈린다.** 지금은 `useToday()` 가 늘 채우므로 falsy 가 올 길이 없다.
  // 그래서 **FAIL 로 세지 않고 적어만 둔다** — 닿는 날 보이는 것이 「연속 0주」라
  // 에러가 아니라 **조용히 틀린 수**다. 그때 이 줄을 보면 바로 안다
  const keys = Object.keys(workouts);
  const 관대 = dateKey.upToToday(keys, '').length;         // 안 거른다 → 둘 다 센다
  const 엄함 = keys.filter((k) => k <= '').length;          // 전부 버린다 → 0
  console.log('     today 가 빈 글자일 때 — 안 거르는 손 ' + 관대 + '벌수 · 전부 버리는 손 ' + 엄함 + '벌수');
  console.log('     (`goal.js:173` 의 `weekStreak` 가 뒤쪽이다 — 닿으면 「연속 0주」로 보인다)');
  ok('지금은 안 닿는다 — useToday 가 늘 채운다',
    /useState\(dateKey\)|useState\(\(\) => dateKey/.test(fs.readFileSync(path.join(ROOT, 'src/data/useToday.js'), 'utf8')), true);
}

console.log('');
console.log('── 손이 몇 벌인가 (새로 생기는 것을 막는다) ──');
{
  // **분류는 안 한다** — 글자로 뜻을 가르려다 거짓 분류를 냈다(머리글 참고).
  // 자리만 세고, 허락 목록에 없는 **새 자리**가 생기면 FAIL 한다
  const 허락 = [
    'breathRecover.js', 'dateKey.js', 'goal.js', 'inbodyLatest.js', 'lastSets.js',
    'measureChange.js', 'monthGrid.js', 'plans.js', 'shapeHistory.js', 'shapeRead.js',
    'weeklyReport.js',
  ];
  const 자리 = [];
  const dir = path.join(ROOT, 'src/data');
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
    lines.forEach((line, i) => {
      // 주석 줄은 뺀다 — 오늘만 세 번 밟은 자리다(`brand` · `logo` · `check-data`)
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (/<=\s*today\b|<\s*today\b/.test(line)) 자리.push(f + ':' + (i + 1));
    });
  }
  const 새파일 = [...new Set(자리.map((r) => r.split(':')[0]))].filter((f) => !허락.includes(f));
  ok('★ 날짜를 거르는 파일이 늘지 않았다', 새파일, []);
  console.log('     지금 ' + 자리.length + '벌 / ' + 허락.length + '파일 — ' + 자리.join(' · '));
  // 벌수가 줄면 그것도 알려준다 (한 벌로 모았다는 뜻이라 좋은 쪽이다)
  if (자리.length < 13) console.log('     ↑ 13벌보다 줄었다 — 한 손으로 모았으면 이 수를 내려 적어라');
}

clean();
console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
