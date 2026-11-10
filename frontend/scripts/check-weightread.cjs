// **서버와 화면이 같은 무게 값을 같은 수로 읽는가** (2026-11-10).
//
//   npm run weightread     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 무게 칸은 **자유 입력**이다 — `'60'` · `'60kg'` · `'20kg 양쪽'` · `'맨몸'`.
// 그래서 서버와 화면이 **각자 숫자를 뽑아 읽는다.** 그 두 자가 달랐다 —
//
//     적은 값   "1,000"
//       서버     1000  → 999 를 넘으니 막는다   (workoutFields.js:65, 쉼표·빈칸을 뗀다)
//       화면        1  → 쉼표 앞만 읽었다       (personalRecord.js, 안 뗐다)
//
// 상한이 생긴 11/3 **전에** 들어온 두 줄이 그러고 있었다. `parseWeight` 를 쓰는
// 자리가 일곱이라(최고기록 · 부위 비율 · 주간 요약 · 달력 · 무게 추이 · 지난 세트)
// **그 일곱이 다 1000배 작게 셌다.** 사람 눈에는 「1kg」이 그냥 적혀 있을 뿐이다.
//
// 11/3 의 한도 류(`c241638`)와 **같은 모양의 다른 판**이다 — 그때는 **수**(999)가
// 한쪽에만 있었고 이번에는 **읽는 법**이 어긋났다. 수를 견주는 자는 있었는데
// 읽는 법을 견주는 자가 없었다. 그래서 이 자가 선다.
//
// ── 무엇을 보는가 ──
//
// 글자 대조가 아니다. **양쪽 함수를 실제로 불러 같은 값을 먹이고 나온 수를 견준다.**
// 거부하는 값(음수 · 숫자 없음)은 **둘 다 거부하는가**로 본다 — 서버는 먼저 막고
// 화면은 `null` 을 주니, 수가 아니라 **거부했는가**가 견줄 자리다.
// 그리고 로컬 DB 에 쌓인 줄 전수로도 돌린다 — 지어낸 값만 보면 실제로 들어 있는
// 모양을 놓친다.
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

// ── 화면 쪽을 묶어 들인다 (`src/data` 는 ESM, 이 자는 cjs) ──
const TMP = [];
let front;
try {
  execFileSync(process.execPath, [
    path.join(ROOT, 'node_modules', 'esbuild', 'bin', 'esbuild'),
    path.join(ROOT, 'src/data/personalRecord.js'), '--bundle', '--format=cjs',
    '--platform=node', '--outfile=' + path.join(ROOT, '.wr-front.cjs'),
  ], { stdio: 'pipe' });
  TMP.push('.wr-front.cjs');
  front = require(path.join(ROOT, '.wr-front.cjs'));
} catch (e) {
  console.log('FAIL 화면 쪽을 묶지 못했다 → ' + String(e.message || e).slice(0, 200));
  process.exit(1);
}
const clean = () => { for (const f of TMP) { try { fs.unlinkSync(path.join(ROOT, f)); } catch { /* 남아도 해롭지 않다 */ } } };

// ── 서버 쪽 ──
let server;
try {
  server = require(path.join(ROOT, '..', 'backend/src/utils/workoutFields.js'));
} catch (e) {
  console.log('FAIL 서버 쪽을 들이지 못했다 → ' + String(e.message || e).slice(0, 200));
  clean();
  process.exit(1);
}

const { parseWeight } = front;
const { normalizeWeight, WEIGHT_KG_MAX } = server;

// 서버가 **그 값에서 본 수**. 거부한 값은 `'거부'` 로 돌려 화면의 `null` 과 견준다.
// (서버는 수를 돌려주지 않고 통과/거부만 준다 — 그래서 거부 여부로 견주는 것이 맞다)
function serverReads(raw) {
  const r = normalizeWeight(raw);
  if (!r.ok) return '거부';
  // 통과한 값에서 서버가 본 수를 같은 자로 다시 뽑는다
  const m = /\d+(?:\.\d+)?/.exec(String(r.value).replace(/[,\s]/g, ''));
  if (!m) return null;
  const n = Number(m[0]);
  return n > 0 ? n : null;
}
const frontReads = (raw) => {
  const n = parseWeight(raw);
  return n === null ? null : n;
};

console.log('── 양쪽이 같은 수를 읽는가 ──');
{
  // 「거부」와 `null` 은 같은 뜻으로 본다 — 둘 다 「무게로 안 센다」다
  const same = (raw) => {
    const s = serverReads(raw);
    const f = frontReads(raw);
    if (s === '거부') return f === null || f > WEIGHT_KG_MAX;
    return s === f;
  };
  // ★ 이 줄이 이번 결함이다
  ok('★ "1,000" — 쉼표를 떼고 읽는다', frontReads('1,000'), 1000);
  ok('  서버와 같은 수다', same('1,000'), true);
  ok('"1,234.5" 도 같다', frontReads('1,234.5'), 1234.5);
  ok('"1,0" 은 10 이다 (서버가 그렇게 본다)', frontReads('1,0'), 10);
  ok('빈칸도 뗀다 — "60 70"', frontReads('60 70'), 6070);
  ok('  서버와 같다', same('60 70'), true);
  // 여태 맞던 것들이 그대로여야 한다
  for (const [raw, want] of [['60', 60], ['60kg', 60], ['20kg 양쪽', 20], ['999', 999], ['998.5', 998.5], ['1000', 1000]]) {
    ok('"' + raw + '"', frontReads(raw), want);
  }
  ok('"맨몸" 은 안 센다', frontReads('맨몸'), null);
  ok('"밴드" 도', frontReads('밴드'), null);
  ok('음수는 둘 다 거부한다 — "-50"', [serverReads('-50'), frontReads('-50')], ['거부', null]);
  ok('  "- 50" 도', [serverReads('- 50'), frontReads('- 50')], ['거부', null]);
  ok('"0" 은 무게로 안 센다', frontReads('0'), null);
}

console.log('');
console.log('── 쌓인 줄 전수 (로컬 DB) ──');
{
  // 지어낸 값만 보면 실제로 들어 있는 모양을 놓친다
  let db = null;
  for (const f of ['../backend/blackiron.json', '../backend/steelbody.json', '../backend/ironlog.json']) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) { db = JSON.parse(fs.readFileSync(p, 'utf8')); break; }
  }
  if (!db) {
    console.log('SKIP 로컬 DB 가 없다 (운영에서는 이 갈래를 안 돈다)');
  } else {
    const rows = db.workouts || [];
    ok('줄이 있다', rows.length > 0, true);
    const 어긋난것 = [];
    for (const r of rows) {
      const s = serverReads(r.weight);
      const f = frontReads(r.weight);
      const 같다 = s === '거부' ? (f === null || f > WEIGHT_KG_MAX) : s === f;
      if (!같다) 어긋난것.push({ 적힌값: String(r.weight), 서버: s, 화면: f });
    }
    ok('★ 양쪽이 다르게 읽는 줄이 없다', 어긋난것, []);
    // 상한을 넘는 줄은 **화면이 읽은 값으로** 센다 — B안이 짚을 줄이 그것이다
    const 초과 = rows.filter((r) => (frontReads(r.weight) || 0) > WEIGHT_KG_MAX);
    console.log('     참고 — 상한(' + WEIGHT_KG_MAX + 'kg)을 넘는 줄 ' + 초과.length + '개'
      + ' (고침 전에는 「1,000」 둘이 1kg 으로 읽혀 빠져 있었다)');
  }
}

clean();
console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
