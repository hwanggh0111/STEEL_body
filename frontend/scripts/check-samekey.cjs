// ── **이름을 두 꼴로 적어도 한 운동으로 보는가** ── (2026-11-27 · 정석, 벼림 넘김)
//
//   npm run samekey   (frontend/ · npm run check 가 찾아서 돈다)
//
// ── 왜 이 자가 생겼나 ──
//
// `data/flatName.js` 머리글이 「이 앱에서 운동 이름을 견주는 식은 이것 하나다」라고
// 못 박고, **「쉬는 시간은 『벤치 프레스』에 기억해 뒀는데 원판은 『벤치프레스』로
// 찾는다. 그리고 그것은 아무 자도 안 울린다」**고 예고까지 해뒀다.
//
// 벼림이 11/27 에 최고기록 쪽 둘을 닫고(`check-samename`) 나머지를 넘겼다. 받아서
// 전수로 깐 결과 **열셋**이었고, 꼴이 **셋**이나 돌아다녔다 —
//
//   String(w.exercise).trim() === name        글자 그대로 (열한 자리)
//   String(a).trim().toLowerCase() === ...    대소문자만 (nextSet.js)
//   flatName(a) === flatName(b)               맞는 식 (gymSetting.js)
//
// 사람에게는 이렇게 보였다 — 「벤치 프레스」로 다섯 세트를 적고, 다음날 홈에서
// 「벤치프레스」로 들어가면 **지난 세트가 없고**(처음 하는 운동으로 본다) 「다음
// 세트」가 **1세트부터 다시** 세고, 추세 그림에 **점이 하나만** 선다.
//
// ── 무엇을 보는가 ──
//
//   1. 지난 세트 · 지난 기록 · 세트 수 · 지난 메모 넷이 두 꼴을 한 운동으로 본다
//   2. 「다음 세트」가 이어서 센다 (1세트로 안 돌아간다)
//   3. 추세가 두 날을 다 본다
//   4. 같은 무게로 한 날을 찾는다
//   5. 다른 운동은 안 묶는다 — 「인클라인 벤치프레스」는 「벤치프레스」가 아니다
//   6. 빈 이름은 아무와도 안 같다 (빈 열쇠를 「다 맞음」으로 두면 이름을 못 읽은
//      줄이 모든 운동의 지난 기록으로 끼어든다)
//   7. 견주는 손을 제 자리에서 짜는 데가 없다 — 코드만 본다(주석은 뺀다. 고친
//      자리마다 까닭을 적어두므로 글자로 찾으면 자가 조용해진다 · 오늘 두 번 밟았다)
//
// 되돌려-FAIL: `--되돌려` 를 주면 `sameName` 을 글자 그대로로 돌린다 →
// 1~4 가 뒤집혀 FAIL 이 보여야 한다.
'use strict';
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const NL = String.fromCharCode(10);
const ROOT = path.resolve(__dirname, '..');
const 뿌리손 = path.join(ROOT, 'src/data/flatName.js');
const 치울것 = [];
process.on('exit', () => { for (const f of 치울것) { try { fs.unlinkSync(f); } catch { /* 없으면 그만 */ } } });

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : '  (기대: ' + JSON.stringify(want) + ')'));
};

// ── 되돌려: 뿌리의 손을 옛 꼴로 ───────────────────────────────────────────
//
// **글자로 찾고, 못 찾으면 멎는다** — 조용히 안 먹으면 이 자가
// 「되돌렸는데 통과」라는 거짓을 말한다
const 되돌림 = process.argv.includes('--되돌려');
let 쓸뿌리 = 뿌리손;
if (되돌림) {
  const 원본 = fs.readFileSync(뿌리손, 'utf-8');
  const 머리 = 'export const sameName = (a, b) => {';
  const i = 원본.indexOf(머리);
  const 끝 = i < 0 ? -1 : 원본.indexOf('};', i);
  if (i < 0 || 끝 < 0) {
    console.log('FAIL 되돌릴 자리를 못 찾았다 — sameName 이 바뀌었다. 이 자를 고쳐라');
    process.exit(1);
  }
  const src = 원본.slice(0, i)
    + "export const sameName = (a, b) => String(a || '').trim() === String(b || '').trim();"
    + 원본.slice(끝 + 2);
  쓸뿌리 = path.join(ROOT, 'src/data', '.flatName.revert.' + process.pid + '.js');
  fs.writeFileSync(쓸뿌리, src, 'utf-8');
  치울것.push(쓸뿌리);
  console.log('── 되돌려: 견주기를 글자 그대로 — 아래에 FAIL 이 있어야 한다 ──');
}

// 손들을 **묶어서 진짜로 돌린다** (꼴을 베끼지 않는다)
//
// ── 되돌릴 때 어떻게 바꿔 끼우나 ──
//
// `alias` 는 상대 경로를 안 받고(`Invalid alias name`), `buildSync` 는 plugin 을
// 못 쓴다(`Cannot use plugins in synchronous API calls`). 그래서 **네 손의 베낀
// 판**을 같은 자리에 두고 그 안의 `./flatName` 만 되돌린 파일로 돌려 둔다 —
// 같은 디렉터리라 **다른 형제 들여오기는 그대로 풀린다.**
//
// ★ **원래 파일은 절대 안 건드린다** — 창 셋이 같은 트리를 쓰므로, 잠깐이라도
//   `flatName.js` 를 되돌려 두면 그 순간 남의 빌드가 **되돌린 코드를 집는다**
const 들여온다 = (파일들) => {
  const 자리 = path.join(ROOT, 'src/data');
  const 쓸것 = 파일들.map((f) => {
    if (!되돌림) return f;
    const 베낀것 = '.samekey.' + process.pid + '.' + f;
    const src = fs.readFileSync(path.join(자리, f), 'utf-8')
      .split("from './flatName'").join("from './" + path.basename(쓸뿌리) + "'");
    fs.writeFileSync(path.join(자리, 베낀것), src, 'utf-8');
    치울것.push(path.join(자리, 베낀것));
    return 베낀것;
  });
  const 입구 = path.join(자리, '.samekey.entry.' + process.pid + '.js');
  fs.writeFileSync(입구, 쓸것.map((f, i) => 'export * as m' + i + " from './" + f + "';").join(NL), 'utf-8');
  치울것.push(입구);
  const out = esbuild.buildSync({
    entryPoints: [입구], bundle: true, write: false, format: 'cjs', platform: 'node',
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', out.outputFiles[0].text)(mod, mod.exports, require);
  return 파일들.map((_, i) => mod.exports['m' + i]);
};

const [LAST, NEXT, TREND, SAME] = 들여온다(['lastSets.js', 'nextSet.js', 'liftTrend.js', 'sameWeight.js']);

// ── 판: 같은 운동을 **두 꼴**로 적었다 ───────────────────────────────────
//
// 11/25 에 「벤치 프레스」로 세 세트, 11/26 에 「벤치프레스」로 두 세트.
// 사람은 같은 운동을 했고, 적은 꼴만 다르다.
//
// ★ **진짜 꼴로 둔다** (첫 판이 두 군데서 틀렸다) —
//   ⑴ 적은 시각 칸은 `created_at` 이다(`lastSets.js` 의 `at()`). `at` 으로 두면
//      시각을 **못 읽어** 차례가 엉키고, 그러면 이 자가 엉뚱한 FAIL 을 낸다
//   ⑵ 하루 안의 차례는 **최신이 앞**이다 — 서버가 그렇게 준다(`db.js` 의 `ROW_CMP`).
//      오래된 것부터 늘어놓으면 `plannedSetsOf` 가 첫 줄(1세트)을 집어 **없는 결함**이
//      보인다. 자가 흉내 내는 판은 **서버가 주는 꼴**이어야 한다
const 판 = {
  '2026-11-25': [
    { exercise: '인클라인 벤치프레스', weight: '40', reps: 10, sets: 1, created_at: '2026-11-25T10:30:00Z' },
    { exercise: '벤치 프레스', weight: '60', reps: 8, sets: 3, note: '어깨가 뻐근', created_at: '2026-11-25T10:10:00Z' },
    { exercise: '벤치 프레스', weight: '60', reps: 9, sets: 2, created_at: '2026-11-25T10:05:00Z' },
    { exercise: '벤치 프레스', weight: '60', reps: 10, sets: 1, created_at: '2026-11-25T10:00:00Z' },
  ],
  '2026-11-26': [
    { exercise: '벤치프레스', weight: '62.5', reps: 8, sets: 2, created_at: '2026-11-26T10:06:00Z' },
    { exercise: '벤치프레스', weight: '60', reps: 10, sets: 1, created_at: '2026-11-26T10:00:00Z' },
  ],
};
const 오늘 = '2026-11-27';

console.log('── 1. 지난 세트 · 기록 · 세트 수 · 메모 (넷) ──');
// 「벤치 프레스」로 묻는다 — 어제 적은 꼴은 「벤치프레스」다
const 묶음 = LAST.sessionsOf(판, '벤치 프레스', 오늘);
ok('★ 두 날을 다 본다 (두 꼴이 한 운동)', 묶음.length, 2);
ok('  가장 가까운 날이 11/26 이다', 묶음[0] && 묶음[0].date, '2026-11-26');
const 지난것 = LAST.lastRecordOf(판, '벤치 프레스', 오늘);
ok('★ 지난 기록이 11/26 의 62.5kg 이다', 지난것 && [지난것.date, 지난것.weight], ['2026-11-26', '62.5']);
ok('★ 세트 수를 11/26 에서 가져온다', LAST.plannedSetsOf(판, '벤치 프레스', 오늘, null, null), 2);
const 메모 = LAST.lastNoteOf(판, '벤치프레스', 오늘);
ok('★ 지난 메모를 11/25(다른 꼴)에서 찾는다', 메모 && [메모.date, 메모.note], ['2026-11-25', '어깨가 뻐근']);

console.log('');
console.log('── 2. 「다음 세트」가 이어서 세는가 ──');
// 오늘 「벤치 프레스」로 한 세트 적었다 — 어제는 「벤치프레스」로 두 세트였다
const 오늘판 = Object.assign({}, 판, {
  '2026-11-27': [{ exercise: '벤치 프레스', weight: '62.5', reps: 8, sets: 1, created_at: '2026-11-27T10:00:00Z' }],
});
const 쉼 = NEXT.restView(오늘판, '벤치 프레스', 오늘);
ok('★ 지난 번을 11/26 로 본다 (1세트로 안 돌아간다)', 쉼 && 쉼.last && 쉼.last.date, '2026-11-26');
ok('  지난 번 세트 수가 2 다', 쉼 && 쉼.last && 쉼.last.sets, 2);

console.log('');
console.log('── 3. 추세가 두 날을 다 보는가 ──');
// `trendOf` 는 **점 배열**을 그대로 준다 (`[{ date, kg }]`)
const 추세 = TREND.trendOf(판, '벤치프레스', { today: 오늘 });
ok('★ 점이 둘이다 (두 꼴이 한 줄로 선다)', Array.isArray(추세) && 추세.length, 2);
ok('  11/25 의 60 과 11/26 의 62.5 다', 추세.map((p) => [p.date, p.kg]),
  [['2026-11-25', 60], ['2026-11-26', 62.5]]);

console.log('');
console.log('── 4. 같은 무게로 한 날을 찾는가 ──');
// 오늘 60kg **11회**를 적는 중. 60kg 10회를 한 날이 **두 꼴로** 있다 —
// 11/25(「벤치 프레스」) · 11/26(「벤치프레스」). 같은 횟수면 **가까운 날**을 든다.
//
// ★ 묻는 이름을 **「벤치 프레스」(띄어쓰기)** 로 두는 것이 이 자리의 핵이다 —
//   눕혀 견주면 11/26 을 찾고, 글자 그대로면 11/26 이 **안 보여** 11/25 를 든다.
//   그래서 **날짜 하나로 두 식이 갈린다.** 11 로 묻는 까닭은 이 손이 「오늘이 더
//   많이 했을 때만」 말하기 때문이다(`reps <= prevReps` 면 `null`)
const 같은무게 = SAME.sameWeightBest(판, { exercise: '벤치 프레스', weight: '60', reps: 11 }, 오늘);
ok('★ 다른 꼴로 적힌 11/26 을 찾는다 (글자 그대로면 11/25 를 든다)',
  같은무게 && [같은무게.prevReps, 같은무게.prevDate], [10, '2026-11-26']);

console.log('');
console.log('── 5·6. 안 묶어야 할 것 ──');
ok('다른 운동은 안 묶는다 (인클라인은 하루뿐)', LAST.sessionsOf(판, '인클라인 벤치프레스', 오늘).length, 1);
ok('★ 빈 이름은 아무와도 안 같다', LAST.sessionsOf(판, '', 오늘).length, 0);
ok('  이름이 공백뿐이어도 그렇다', LAST.sessionsOf(판, '   ', 오늘).length, 0);

console.log('');
console.log('── 7. 견주는 손을 제 자리에서 짜는 데가 없는가 ──');
{
  // **코드만 본다** — 고친 자리마다 「눕혀 견준다」고 까닭을 적어두므로 글자로
  //   찾으면 그 설명이 걸려 **자가 조용해진다**(오늘 아침 `check-version` ·
  //   낮에 `check-tidy` 가 같은 꼴로 울었다)
  const 걸린것 = [];
  const 손들 = ['flatName', 'sameName', 'matchesExercise', 'sameExercise'];
  const 이름칸 = ['.exercise', 'exercise?.', 'item.name', 'exercise.trim'];
  // ★ **운동 이름이 아닌 것을 걸러낸다** (첫 판이 다섯을 거짓으로 걸었다) —
  //   `.exercises`(루틴의 **목록**) · 그 길이 · `id` 견주기 · 부위(`bodyPartOf`)는
  //   이름을 견주는 자리가 아니다. 거짓 울음이 쌓이면 사람이 이 자를 안 본다
  const 이름아님 = ['.exercises', 'bodyPartOf', '.length', '.id ', '._id', 'kind ==='];
  (function 걷기(d) {
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n);
      if (fs.statSync(p).isDirectory()) { 걷기(p); continue; }
      if (!(n.endsWith('.js') || n.endsWith('.jsx'))) continue;
      if (n.startsWith('.')) continue;                 // 되돌림이 만든 임시 파일
      fs.readFileSync(p, 'utf-8').split(NL).forEach((l, i) => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
        if (손들.some((h) => l.includes(h))) return;
        if (!(l.includes('===') || l.includes('!=='))) return;
        if (!이름칸.some((k) => l.includes(k))) return;
        if (이름아님.some((k) => l.includes(k))) return;
        걸린것.push(path.relative(ROOT, p).split(path.sep).join('/') + ':' + (i + 1));
      });
    }
  })(path.join(ROOT, 'src'));
  ok('★ 손으로 짠 견주기가 없다', 걸린것, []);
  if (걸린것.length) {
    console.log('     ↑ sameName(a, b) 을 쓴다 (data/flatName.js). 그 자리만 고치면');
    console.log('       같은 운동이 두 운동으로 보이고 **아무 자도 안 울린다**');
  }
}

console.log('');
console.log(bad ? bad + '건 실패' : '전부 통과');
process.exit(bad ? 1 : 0);
