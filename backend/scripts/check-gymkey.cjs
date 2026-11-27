// ── **기구 세팅이 같은 운동을 한 줄로 지키는가** ── (2026-11-27 · 주인 「기능 좀 봐봐」)
//
//   npm run gymkey   (backend/ · npm run check 에도 들어 있다)
//
// `db.js` 의 `saveGymSetting` 머리글이 **「같은 (헬스장 · 운동) 은 한 줄뿐이다 —
// 여러 줄이 되면 화면이 어느 것을 띄울지 정해야 하고, 그러면 세팅이 목록이 된다」**
// 고 적어뒀다. 그런데 운동 이름을 **글자 그대로** 견주던 동안 그 선이 깨져 있었다.
//
// 앱은 운동 이름을 눕혀 견준다(`frontend/src/data/flatName.js` — 그 머리글이
// 「이 앱에서 운동 이름을 견주는 식은 이것 하나다」라고 못 박았다). 그래서
// 「벤치 프레스」와 「벤치프레스」가 **서버에서는 두 줄, 앱에서는 한 운동**이었고,
// 사람에게는 **적어둔 시트 번호가 사라진 것**으로 보였다 (쉬는 시간과 원판은 그 둘을
// 한 운동으로 기억하고 있으니 더 그렇다).
//
// ── 여기서 보는 것 ──
//
//   1. 변형 이름으로 담으면 **줄이 안 늘어난다** (한 줄을 고친다) ★
//   2. 변형 이름으로 **찾을 수 있다** · **지울 수 있다**
//   3. 담은 이름은 **방금 친 글자**다 (화면에 뜨는 이름이 그것이다)
//   4. 헬스장이 다르면 **여전히 다른 줄**이다 (장소 이름은 글자 그대로 견준다)
//   5. 다른 운동은 안 묶는다 — 「인클라인 벤치프레스」는 「벤치프레스」가 아니다
//   6. ★ **두 식이 같은가** — 앱 파일(`flatName.js`)을 읽어 같은 보기들로 견준다.
//      한쪽만 고치면 이 자가 운다 (식이 두 벌인 것을 자가 메운다)
//
// 되돌려-FAIL: `--되돌려` 면 서버 쪽 견주기를 **옛 꼴**(글자 그대로)로 돌린다
// → 1번이 「두 줄」로 뒤집혀 FAIL 이 보여야 한다
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const 앱손 = path.join(ROOT, 'frontend/src/data/flatName.js');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : '  (기대: ' + JSON.stringify(want) + ')'));
};

// ── 가짜 판 ────────────────────────────────────────────────────────────────
const 때 = `${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
const DB = path.join(os.tmpdir(), `check-gymkey-${때}.json`);
const 치울것 = [DB, DB.replace(/\.json$/, '') + '.photos.json'];
process.on('exit', () => { for (const f of 치울것) { try { fs.unlinkSync(f); } catch { /* 없다 */ } } });
fs.writeFileSync(DB, JSON.stringify({
  users: [{ id: 5, email: 'g@b.c', password: 'x', role: 'user' }], _nextId: { users: 6 },
}), 'utf-8');

process.env.DB_FILE = DB;
process.env.DATABASE_URL = '';

// ── 되돌려: 서버 쪽 견주기를 옛 꼴로 ───────────────────────────────────────
const 되돌림 = process.argv.includes('--되돌려');
let 쓸db = path.join(ROOT, 'backend/src/db.js');
if (되돌림) {
  const 원본 = fs.readFileSync(쓸db, 'utf-8');
  // 줄끝이 CRLF 일 수 있다 — **글자로 맞추면 조용히 안 먹는다**(그러면 이 자가
  // 「되돌렸는데 통과」라는 거짓을 말한다). 꼴로 찾고, **안 먹으면 멎는다**
  const 꼴 = /const sameExercise = \(a, b\) => \{[\s\S]*?\n\};/;
  if (!꼴.test(원본)) {
    console.log('FAIL 되돌릴 자리를 못 찾았다 — `sameExercise` 가 바뀌었다. 이 자를 고쳐라');
    process.exit(1);
  }
  const src = 원본.replace(꼴, "const sameExercise = (a, b) => String(a || '') === String(b || '');");
  if (src === 원본) { console.log('FAIL 되돌림이 안 먹었다'); process.exit(1); }
  쓸db = path.join(ROOT, 'backend/src', `.db.revert.${process.pid}.js`);
  fs.writeFileSync(쓸db, src, 'utf-8');
  치울것.push(쓸db);
  console.log('── 되돌려: 서버 견주기를 글자 그대로 — 아래에 FAIL 이 있어야 한다 ──');
}
const db = require(쓸db);

const 세팅 = (patch) => Object.assign({ seat: null, foot: null, grip: null, note: null }, patch);

// ── ⑴ 변형 이름으로 담으면 줄이 안 늘어난다 ───────────────────────────────
console.log('\n── ⑴ 한 줄 선 ──');
db.saveGymSetting(5, '강남점', '벤치 프레스', 세팅({ seat: '3', grip: '보통' }));
db.saveGymSetting(5, '강남점', '벤치프레스', 세팅({ seat: '4' }));
db.saveGymSetting(5, '강남점', '벤치-프레스', 세팅({ foot: '2' }));
const 강남 = db.getGymSettings(5, '강남점');
ok('★ 셋을 담아도 한 줄이다 (머리글의 「한 줄뿐이다」)', 강남.length, 1);
ok('  마지막에 친 것이 남는다', [강남[0].seat, 강남[0].foot], [null, '2']);
ok('★ 담긴 이름은 방금 친 글자다 (화면에 그것이 뜬다)', 강남[0].exercise, '벤치-프레스');

// ── ⑵ 변형 이름으로 찾고 지운다 ───────────────────────────────────────────
console.log('\n── ⑵ 찾기 · 지우기 ──');
ok('★ 공백을 넣어 찾아도 찾는다', !!db.getGymSetting(5, '강남점', '벤치 프레스'), true);
ok('  붙여 써도 찾는다', !!db.getGymSetting(5, '강남점', '벤치프레스'), true);
ok('  대소문자도 (영어 이름)', (() => {
  db.saveGymSetting(5, '강남점', 'Lat Pulldown', 세팅({ seat: '7' }));
  return !!db.getGymSetting(5, '강남점', 'lat-pulldown');
})(), true);
ok('  빈 이름은 아무것도 안 찾는다', db.getGymSetting(5, '강남점', '   '), null);

// ── ⑶ 헬스장은 글자 그대로 ────────────────────────────────────────────────
// 장소 이름은 사람이 붙인 것이고, 서버가 다듬어 담은 글자를 화면이 그대로 들고 있다.
// 「강남점」과 「강남 점」을 묶으면 **다른 헬스장의 세팅을 믿고 기구를 맞춘다** —
// 그것은 아예 없느니만 못하다(`gymSetting.js` 머리글).
console.log('\n── ⑶ 헬스장은 따로 ──');
db.saveGymSetting(5, '집앞점', '벤치프레스', 세팅({ seat: '9' }));
ok('★ 헬스장이 다르면 다른 줄이다', db.getGymSettings(5, null).length, 3);
ok('  집앞점 것을 찾으면 그 줄이다', db.getGymSetting(5, '집앞점', '벤치 프레스').seat, '9');
ok('  강남점 줄은 안 변했다', db.getGymSetting(5, '강남점', '벤치프레스').foot, '2');

// ── ⑷ 다른 운동은 안 묶는다 ───────────────────────────────────────────────
console.log('\n── ⑷ 다른 운동 ──');
db.saveGymSetting(5, '강남점', '인클라인 벤치프레스', 세팅({ seat: '1' }));
ok('★ 인클라인은 따로 선다', db.getGymSettings(5, '강남점').length, 3);
ok('  벤치 줄을 덮지 않았다', db.getGymSetting(5, '강남점', '벤치프레스').foot, '2');

// ── ⑸ 지우기 ──────────────────────────────────────────────────────────────
console.log('\n── ⑸ 지우기 ──');
ok('★ 변형 이름으로 지워진다', db.deleteGymSetting(5, '강남점', '벤치 프레스').changes, 1);
ok('  지운 뒤에는 안 찾힌다', db.getGymSetting(5, '강남점', '벤치프레스'), null);
ok('  옆 줄은 남아 있다', db.getGymSettings(5, '강남점').length, 2);
ok('  없는 것을 지우면 0 이다', db.deleteGymSetting(5, '강남점', '없는운동').changes, 0);

// ── ⑹ ★ 두 식이 같은가 ───────────────────────────────────────────────────
//
// 서버와 앱은 다른 런타임이라 손을 불러올 수 없다. 그래서 글자를 옮겨 적었고,
// **이 자가 그 둘을 맞춰 본다** — 한쪽만 고치면 여기서 운다. (식이 두 벌인 것을
// 자가 메우는 자리다 — `flatName.js` 머리글이 두 벌을 경계하는 그 까닭이다.)
console.log('\n── ⑹ 앱의 식과 같은가 ──');
const 앱글 = fs.readFileSync(앱손, 'utf-8');
const m = 앱글.match(/replace\((\/\[[^/]*\/g)\s*,\s*''\)/);
ok('앱 파일에서 눕히는 식을 읽었다', !!m, true);
const 서버글 = fs.readFileSync(path.join(ROOT, 'backend/src/db.js'), 'utf-8');
const m2 = 서버글.match(/flatExercise = \(s\) => String\(s \|\| ''\)\s*\n\s*\.toLowerCase\(\)\s*\n\s*\.replace\((\/\[[^/]*\/g)\s*,\s*''\)/);
ok('서버 쪽 식도 읽었다', !!m2, true);
ok('★ 걷는 글자가 **글자 하나까지** 같다', m2 && m2[1], m && m[1]);
// 글자가 같아도 **답이 같은지**를 본다 (읽기만으로는 `toLowerCase` 빠진 것을 못 본다)
const 보기 = ['벤치 프레스', '벤치프레스', '벤치-프레스', 'Bench Press', 'bench_press',
  '  랫 풀다운  ', '인클라인 벤치프레스', '풀업(와이드)', '케이블·플라이', ''];
// 앱 손을 그 자리에서 만들어 쓴다 (esbuild 없이 — 식 한 줄이라 그대로 지어도 된다)
// eslint-disable-next-line no-new-func
const 앱눕힘 = new Function('s', `return String(s || '').toLowerCase().replace(${m ? m[1] : '/x/g'}, '');`);
const 서버눕힘 = (s) => String(s || '').toLowerCase().replace(/[\s.,!?~·・\-_'"()]/g, '');
ok('★ 같은 보기 열 개에 같은 답을 낸다', 보기.map(앱눕힘), 보기.map(서버눕힘));

// ── ⑺ 앱 쪽도 같은 선을 지키는가 ──────────────────────────────────────────
//
// 서버가 한 줄로 지켜도 **앱이 글자 그대로 찾으면** 그 줄을 못 본다 — 사람 눈에는
// 똑같이 「안 적어둔 것」이다. 찾는 자리가 둘 있다(카드 · 「그대로 쓰기」) —
// 식은 `data/gymSetting.js` 에 하나뿐이고 스토어도 그것을 부른다.
console.log('\n── ⑺ 앱 쪽 찾기 ──');
let esbuild = null;
try {
  esbuild = require(require.resolve('esbuild', { paths: [path.join(ROOT, 'frontend/node_modules')] }));
} catch { /* 없으면 아래에서 건너뛴다 */ }
if (!esbuild) {
  console.log('건너뜀: esbuild 가 없다 (frontend 쪽 꾸러미를 빌린다 — `cd frontend && npm install`)');
} else {
  const 짐 = path.join(os.tmpdir(), `gymkey-${때}.cjs`);
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, 'frontend/src/data/gymSetting.js')],
    bundle: true, format: 'cjs', outfile: 짐, platform: 'node', logLevel: 'silent',
  });
  const G = require(짐);
  fs.unlinkSync(짐);
  const 세팅들 = [
    { gym: '강남점', exercise: '벤치 프레스', seat: '3' },
    { gym: '집앞점', exercise: '랫 풀다운', seat: '7' },
  ];
  ok('★ 카드가 변형 이름으로 그 줄을 찾는다',
    (G.settingIn(세팅들, '강남점', '벤치프레스') || {}).seat, '3');
  ok('  붙임표로도', (G.settingIn(세팅들, '강남점', '벤치-프레스') || {}).seat, '3');
  ok('  헬스장이 다르면 안 찾는다', G.settingIn(세팅들, '집앞점', '벤치프레스'), null);
  ok('  빈 이름 · 빈 헬스장이면 null',
    [G.settingIn(세팅들, '강남점', '  '), G.settingIn(세팅들, '', '벤치프레스')], [null, null]);
  ok('★ 「그대로 쓰기」가 다른 헬스장의 같은 운동을 찾는다',
    (G.copyableFrom(세팅들, '집앞점', '벤치프레스') || {}).gym, '강남점');
  ok('  다른 운동은 안 찾는다', G.copyableFrom(세팅들, '집앞점', '스쿼트'), null);
  ok('  같은 헬스장 것은 베낄 것이 아니다', G.copyableFrom(세팅들, '강남점', '벤치프레스'), null);
  ok('  견주는 손을 내놓는다 (`sameExercise`)', typeof G.sameExercise, 'function');
  ok('  스토어가 제 식을 안 짠다 (`settingIn` 을 부른다)', (() => {
    const 글 = fs.readFileSync(path.join(ROOT, 'frontend/src/store/gymStore.js'), 'utf-8');
    return /settingIn\(/.test(글) && !/s\.exercise === name/.test(글);
  })(), true);
}

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
