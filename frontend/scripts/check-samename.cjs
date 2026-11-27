// ── **같은 운동을 같은 운동으로 보는가** ── (2026-11-27 · 주인 「기능 좀 봐봐」)
//
//   npm run samename   (frontend/ · npm run check 에도 들어 있다)
//
// 이 앱에서 운동 이름을 견주는 식은 `data/flatName.js` **하나**다. 그 파일 머리글이
// 까닭을 적어뒀다 — 식이 두 벌이 되면 「쉬는 시간은 『벤치 프레스』에 기억해 뒀는데
// 원판은 『벤치프레스』로 찾는다. **그리고 그것은 아무 자도 안 울린다.**」
//
// 그 울리지 않던 자리를 여기서 울린다.
//
// ── 무엇이 있었나 (2026-11-27 에 찾았다) ──
//
// **최고 기록만 글자 그대로 견주고 있었다**(`personalRecord` 의 `(exercise||'').trim()`).
// 운동 이름은 홈 · 검색 · 루틴에서 **자유 글자로** 들어오고 서버도 그대로 받는다.
// 그래서 사람에게 이렇게 보였다 —
//
//   「벤치 프레스」로 100kg → 최고가 선다.  「벤치프레스」로 **95kg** → **「최고 기록!」**
//   (처음 보는 운동으로 세기 때문이다). 목록에는 **같은 운동이 두 줄**로 선다.
//
// ── 여기서 보는 것 ──
//
//   1. 변형 이름이 **한 운동으로 묶인다** (최고가 하나다)
//   2. **낮은 무게가 경신이 안 된다** (거짓 띠가 안 뜬다) ★ 이것이 사람이 보던 꼴이다
//   3. 진짜 경신은 **그대로 뜬다** (묶었다고 못 보게 되면 안 된다)
//   4. **다른 운동은 안 묶는다** — 「인클라인 벤치프레스」는 「벤치프레스」가 아니다
//   5. 무게 쪽과 맨몸 쪽은 **따로 센다** (한 자에 못 올린다)
//   6. **열쇠를 손으로 짜는 자리가 없다** — 표를 만드는 쪽과 찾는 쪽이 갈리면
//      최고 기록이 조용히 사라진다(찾는 쪽이 늘 `undefined` 를 받는다)
//
// 되돌려-FAIL: `--되돌려` 를 주면 열쇠를 **옛 꼴**(`이름.trim()::갈래`)로 돌린다
// → 2번이 「경신이다」로 뒤집혀 FAIL 이 보여야 한다
'use strict';
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const 손 = path.join(ROOT, 'src/data/personalRecord.js');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : '  (기대: ' + JSON.stringify(want) + ')'));
};

// ── 되돌려: 눕히기 전으로 ───────────────────────────────────────────────────
const 되돌림 = process.argv.includes('--되돌려');
const 치울것 = [];
let 쓸손 = 손;
if (되돌림) {
  const src = fs.readFileSync(손, 'utf-8')
    .replace('export const bestKey = (name, kind) => `${flatName(name)}::${kind}`;',
      'export const bestKey = (name, kind) => `${String(name || \'\').trim()}::${kind}`;');
  쓸손 = path.join(path.dirname(손), `.personalRecord.revert.${process.pid}.js`);
  fs.writeFileSync(쓸손, src, 'utf-8');
  치울것.push(쓸손);
  console.log('── 되돌려: 열쇠를 옛 꼴(글자 그대로)로 — 아래에 FAIL 이 있어야 한다 ──');
}
process.on('exit', () => { for (const f of 치울것) { try { fs.unlinkSync(f); } catch { /* 없다 */ } } });

const 짐 = path.join(ROOT, `.samename.${process.pid}.cjs`);
esbuild.buildSync({
  entryPoints: [쓸손], bundle: true, format: 'cjs', outfile: 짐,
  platform: 'node', logLevel: 'silent',
});
const P = require(path.resolve(짐));
fs.unlinkSync(짐);

const 줄 = (exercise, weight, reps, extra) => Object.assign({
  exercise, weight, sets: 4, reps, date: '2026-11-20', id: Math.floor(Math.random() * 1e6),
}, extra);

// ── ⑴ 변형 이름이 한 운동으로 묶인다 ──────────────────────────────────────
console.log('\n── ⑴ 변형 이름 ──');
const 판 = {
  '2026-11-18': [줄('벤치 프레스', '100', 5)],
  '2026-11-20': [줄('벤치프레스', '95', 5), 줄('벤치-프레스', '90', 5)],
};
const 표 = P.bestRecords(판, '2026-11-27');
ok('★ 셋이 한 줄로 묶인다 (최고 기록 목록에 하나다)', 표.size, 1);
const 최고 = [...표.values()][0];
ok('  최고는 100kg 쪽이다', [최고.kg, 최고.date], [100, '2026-11-18']);
ok('  적어 둔 이름은 그 줄의 이름 그대로다 (눕힌 글자를 사람에게 보이지 않는다)',
  최고.exercise, '벤치 프레스');

// ── ⑵ ★ 거짓 경신이 안 뜬다 ───────────────────────────────────────────────
// 사람이 보던 꼴 — 「벤치 프레스」로 100kg 을 들어 두고 「벤치프레스」로 95kg.
console.log('\n── ⑵ 거짓 경신 (사람이 보던 꼴) ──');
const 앞 = P.bestRecords({ '2026-11-18': [줄('벤치 프레스', '100', 5)] }, '2026-11-27');
const 거짓 = P.checkRecord(앞, 줄('벤치프레스', '95', 5));
ok('★ 낮은 무게는 경신이 아니다 (「최고 기록!」 띠가 안 뜬다)', 거짓, null);
const 거짓3 = P.checkRecord(앞, 줄('벤치-프레스', '99', 5));
ok('  붙임표로 적어도 같다', 거짓3, null);
const 거짓4 = P.checkRecord(앞, 줄('  벤치프레스  ', '99', 5));
ok('  앞뒤 공백도 같다', 거짓4, null);

// ★ **글자가 다르면 못 묶는다 — 그것이 맞다.**
//
// 눕히기는 공백 · 기호를 걷는 것뿐이고 **번역은 하지 않는다.** 「Bench Press」와
// 「벤치프레스」는 서로 다른 글자이고, 그 둘을 같다고 하려면 운동 이름 사전을
// 들어야 한다 — 그러면 사전에 없는 이름은 또 갈린다. **여기서 그 선을 적어 둔다**:
// 나중에 누가 「영어도 묶어야 하지 않나」로 사전을 끌어오지 않게.
const 영어 = P.checkRecord(앞, 줄('Bench Press', '80', 5));
ok('  영어로 적은 것은 **다른 운동**이다 (번역은 안 한다 — 첫 기록으로 뜬다)',
  !!영어 && 영어.prev, null);
const 영어둘 = P.bestRecords({
  '2026-11-20': [줄('Bench Press', '80', 5), 줄('bench-press', '85', 5)],
}, '2026-11-27');
ok('  영어끼리는 묶는다 (대소문자 · 붙임표)', 영어둘.size, 1);

// ── ⑶ 진짜 경신은 그대로 뜬다 ─────────────────────────────────────────────
console.log('\n── ⑶ 진짜 경신 ──');
const 진짜 = P.checkRecord(앞, 줄('벤치프레스', '105', 5));
ok('★ 넘었으면 뜬다', !!진짜, true);
ok('  앞 기록을 짚어준다 (「100kg 이었어요」)', 진짜 && 진짜.prev && 진짜.prev.kg, 100);
const 첫판 = P.checkRecord(new Map(), 줄('데드리프트', '150', 3));
ok('  처음 하는 운동도 뜬다 (앞 기록은 없다)', [!!첫판, 첫판 && 첫판.prev], [true, null]);

// ── ⑷ 다른 운동은 안 묶는다 ───────────────────────────────────────────────
console.log('\n── ⑷ 다른 운동 ──');
const 다름 = P.bestRecords({
  '2026-11-20': [줄('벤치프레스', '100', 5), 줄('인클라인 벤치프레스', '70', 5),
    줄('덤벨 벤치프레스', '40', 10)],
}, '2026-11-27');
ok('★ 셋이 따로 선다 (눕히기는 공백 · 점 · 붙임표만 걷는다)', 다름.size, 3);
const 인클 = P.checkRecord(
  P.bestRecords({ '2026-11-18': [줄('벤치프레스', '100', 5)] }, '2026-11-27'),
  줄('인클라인 벤치프레스', '60', 5),
);
ok('  인클라인은 벤치의 기록을 안 넘는다 (따로 센다 — 첫 기록으로 뜬다)',
  !!인클 && 인클.prev, null);

// ── ⑸ 무게 쪽과 맨몸 쪽은 따로 ────────────────────────────────────────────
console.log('\n── ⑸ 무게와 맨몸 ──');
const 갈래 = P.bestRecords({
  '2026-11-20': [줄('풀업', '맨몸', 20), 줄('풀 업', '20kg', 5)],
}, '2026-11-27');
ok('★ 한 운동인데 갈래가 둘이다', 갈래.size, 2);
ok('  갈래 이름', [...갈래.values()].map((e) => e.kind).sort(), ['bodyweight', 'weighted']);

// ── ⑹ 열쇠를 손으로 짜는 자리가 없다 ──────────────────────────────────────
//
// 표는 `bestKey` 로 서는데 찾는 쪽이 글자를 손으로 이어 붙이면 **늘 못 찾는다** —
// 화면에 최고 기록이 안 뜨고, 아무것도 안 터지니 아무 자도 안 울린다.
// 11/27 에 그렇게 짜는 자리가 **둘** 있었다(`searchMine.js` · `TrainPage.jsx`).
console.log('\n── ⑹ 열쇠를 손으로 짜는 자리 ──');
const 훑 = (d, 모음) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) 훑(p, 모음);
    else if (/\.(js|jsx)$/.test(e.name)) 모음.push(p);
  }
  return 모음;
};
const 파일들 = 훑(path.join(ROOT, 'src'), []);
// `` `${무엇}::갈래` `` 또는 `'::weighted'` 처럼 열쇠 꼴을 글자로 짜는 자리
const 손짜기 = [];
for (const f of 파일들) {
  if (path.basename(f) === 'personalRecord.js') continue;     // 열쇠를 내놓는 집이다
  const 글 = fs.readFileSync(f, 'utf-8');
  글.split('\n').forEach((l, i) => {
    if (/`[^`]*\$\{[^`]*\}::(weighted|bodyweight|[\w$.]+)`|['"]::(weighted|bodyweight)['"]/.test(l)) {
      손짜기.push(`${path.relative(ROOT, f).replace(/\\/g, '/')}:${i + 1}`);
    }
  });
}
ok('★ 열쇠를 글자로 짜는 자리가 없다 (`bestKey` 만 짠다)', 손짜기, []);
ok('  열쇠를 내놓는다 (`bestKey`)', typeof P.bestKey, 'function');
ok('  그 손이 눕혀서 짠다', P.bestKey('벤치 프레스', 'weighted'), P.bestKey('벤치프레스', 'weighted'));

// ── 눕히는 식이 한 자리에서 온다 ──────────────────────────────────────────
const 집 = fs.readFileSync(손, 'utf-8');
ok("★ 눕히는 식을 제 손으로 베껴 쓰지 않는다 (`flatName` 을 불러온다)",
  /from '\.\/flatName'/.test(집) && !/replace\(\/\[\\s/.test(집), true);

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
