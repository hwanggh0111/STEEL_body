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
console.log('── 이름을 바꾸면 인사할 이름도 같이 고치나 ──');
// ── 왜 (2026-10-28) ──
//
// 위의 아이디 자리를 10/02 에 고치면서 「바꾼 사람이 제일 먼저 하는 일이 로그아웃이라,
// 이 자리를 빠뜨리면 바로 걸린다」고 적어뒀다. **그런데 이름은 안 왔다** —
// 로그인 화면은 `SAVED_NICKNAME_KEY` 로 「다시 오셨군요 ○○」를 그리고 아바타 첫
// 글자까지 거기서 가져오는데, 이름을 바꾸는 **두 화면이 그 값을 안 고쳤다.**
//
// 그 둘이 **같은 일을 두 벌로** 적고 있었던 것이 까닭이다(머리의 계정 시트 · 설정함).
// 담는 일을 `authStore.rename` 한 자리로 모았으니, **두 화면이 그것을 부르는지**와
// **그 자리가 열쇠 둘을 다 담는지**를 본다.
{
  const store = fs.readFileSync('src/store/authStore.js', 'utf8');
  const code = store.replace(/(^|[\s\{])\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');
  const body = (code.match(/rename: async \(name\) => \{([\s\S]*?)\n  \},/) || ['', ''])[1];
  ok('이름 바꾸는 자리가 스토어에 있다', !!body, true);
  ok('  서버로 가는 길은 하나다', /client\.put\('\/auth\/nickname'/.test(body), true);
  ok('  담는 이름', /saveLS\(NICKNAME_KEY/.test(body), true);
  ok('  **인사할 이름도** 담는다', /saveLS\(SAVED_NICKNAME_KEY/.test(body), true);
  ok('  서버가 다듬은 것을 쓴다', /data\?\.nickname/.test(body), true);

  // 두 화면이 손으로 적지 않는가 — 두 벌이면 하나 늘 때 한쪽만 고쳐진다
  for (const [name, f] of [['머리의 계정 시트', 'src/components/Layout.jsx'], ['설정함', 'src/pages/SettingsPage.jsx']]) {
    const src = fs.readFileSync(f, 'utf8').replace(/(^|[\s\{])\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');
    ok('  ' + name + '이 그 자리를 부른다', /\.rename\(/.test(src), true);
    ok('    직접 치지 않는다', /client\.put\('\/auth\/nickname'/.test(src), false);
  }
}

console.log('');
console.log(bad ? bad + '건 실패' : '전부 통과');
process.exit(bad ? 1 : 0);
