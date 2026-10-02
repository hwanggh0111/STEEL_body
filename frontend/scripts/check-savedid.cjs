// 아이디를 바꾼 뒤 로그인 화면에 적어둔 값 (2026-10-02).
//
//   npm run savedid     (npm run check 에도 들어 있다)
//
// **눈으로 보려면** 아이디로 로그인하고 → 설정함에서 아이디를 바꾸고 → 로그아웃하고 →
// 로그인 화면의 칸을 봐야 한다. 네 걸음이라 값으로 본다.
//
// 지키려는 것 둘:
//   1. 아이디로 들어오던 사람의 적어둔 값은 **같이 고친다** — 안 고치면 로그아웃한 뒤
//      자동으로 채워진 옛 아이디로 로그인이 안 된다
//   2. **메일로 들어오던 사람은 건드리지 않는다** — 메일은 아이디를 바꿔도 그대로 통한다
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const { nextSavedId } = bundle('src/data/savedId.js', '.s1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 아이디로 들어오던 사람 ──');
ok('적어둔 것이 옛 아이디면 새 아이디로', nextSavedId('oldname01', 'oldname01', 'newname01'), 'newname01');
ok('  대문자로 적혀 있어도 알아본다', nextSavedId('OldName01', 'oldname01', 'newname01'), 'newname01');
ok('  앞뒤 빈칸이 있어도 알아본다', nextSavedId('  oldname01 ', 'oldname01', 'newname01'), 'newname01');
ok('  새 아이디는 **친 그대로** 적는다', nextSavedId('oldname01', 'oldname01', 'NewName01'), 'NewName01');

console.log('');
console.log('── 메일로 들어오던 사람은 건드리지 않는다 ──');
//
// 여기서 덮으면 고쳐준 게 아니라 바꿔버린 것이다 — 메일로 들어오던 사람이
// 갑자기 아이디로 들어가게 된다
ok('메일이 적혀 있으면 그대로', nextSavedId('me@test.local', 'oldname01', 'newname01'), null);
ok('  남의 아이디가 적혀 있어도 그대로', nextSavedId('someoneelse', 'oldname01', 'newname01'), null);

console.log('');
console.log('── 없는 것은 만들지 않는다 ──');
ok('적어둔 것이 없으면 안 만든다', nextSavedId(null, 'oldname01', 'newname01'), null);
ok('  빈 글자도 같다', nextSavedId('', 'oldname01', 'newname01'), null);
ok('  빈칸만 있어도 같다', nextSavedId('   ', 'oldname01', 'newname01'), null);

console.log('');
console.log('── 모르는 것으로는 아무것도 안 한다 ──');
ok('옛 아이디를 모르면 가만둔다', nextSavedId('oldname01', '', 'newname01'), null);
ok('새 아이디가 없으면 가만둔다', nextSavedId('oldname01', 'oldname01', ''), null);
ok('  undefined 도 같다', nextSavedId('oldname01', undefined, undefined), null);

console.log('');
console.log(bad ? bad + '건 실패' : '전부 통과');
process.exit(bad ? 1 : 0);
