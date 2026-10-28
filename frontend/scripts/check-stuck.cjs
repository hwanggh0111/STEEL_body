// **「못 받았다」를 세우고 안 내려놓는 자리가 없는가** (2026-10-28).
//
//   npm run stuck     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 알림 설정 화면이 **신호가 한 번 끊기면 영영 막혀 있었다.** 못 받으면 `error` 를
// 세우고 화면을 통째로 「불러오지 못함」으로 바꾸는데, **성공하는 쪽이 그 값을
// 내려놓지 않았다** — 거는 자리 1 : 푸는 자리 0. 머리의 새로고침으로 다시 받아
// **잘 받아와도** 그 화면이 그대로여서, 그 사람은 **앱을 다시 띄워야** 알림을
// 만질 수 있었다. 신호가 한 번 끊긴 것 치고는 값이 너무 크다.
//
// 10/27 에 세운 자가 그대로 적용되는 자리다 — **거는 자리 : 푸는 자리를 센다.**
//
// ── 여기가 지키는 것 ──
//
// 「못 받았다」를 들고 **그것으로 화면을 가리는** 자리를 찾아, 받아온 쪽에서
// 내려놓는지 본다. 가리지 않고 한 줄만 적는 자리(토스트 · 곁다리)는 안 본다 —
// 거기서는 남아 있어도 길이 막히지 않는다.
const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const SRC = path.join(__dirname, '..', 'src');
const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/[.](jsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
};
const codeOf = (s) => s
  .replace(/(^|[\s\{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');

// 「이 값이 서면 화면을 통째로 가린다」는 꼴을 **글자로 찾는다** — 정규식을 이름으로
// 지어내면 `||` 같은 글자에서 깨진다. `if (그이름` 뒤 300자 안에 `return` 이 있으면
// **그 값이 화면을 가리는 것**으로 본다 (가림막은 일찍 돌아가는 모양이다)
//
// **`return` 만 보면 안 된다** (2026-10-28). `if (error) setError('');` 같은 줄도
// 그 뒤 300자 안에 `return` 이 있어서 가입 화면의 **폼 오류**가 걸렸다 —
// 거기는 길을 막는 자리가 아니다. **`return (` 로 JSX 를 돌려주는 것**만 본다.
const blockOf = (src, name) => {
  for (const head of ['if (' + name + ')', 'if (' + name + ' ', 'if (!' + name + ' ']) {
    let i = src.indexOf(head);
    while (i >= 0) {
      const near = src.slice(i, i + 400);
      const r = near.indexOf('return (');
      if (r >= 0 && near.slice(0, r).indexOf(';') < 0) {
        // 가림막 한 덩어리를 돌려준다 (`  }` 까지)
        const end = src.indexOf('\n  }', i);
        return src.slice(i, end < 0 ? i + 1200 : end);
      }
      i = src.indexOf(head, i + 1);
    }
  }
  return null;
};

console.log('── 못 받았다를 세우고 안 내려놓는 자리 ──');
const stuck = [];
const noWay = [];
let watched = 0;
for (const f of walk(SRC)) {
  const src = codeOf(fs.readFileSync(f, 'utf8'));
  const rel = path.relative(SRC, f).split(path.sep).join('/');
  for (const m of src.matchAll(/const \[(\w+), (set\w+)\] = useState\((''|false|null)\)/g)) {
    const [, name, setter] = m;
    // 못 받았다는 뜻으로 쓰는 값만 본다
    if (!/(err|fail|stuck)/i.test(name)) continue;
    const block = blockOf(src, name);
    if (!block) continue;             // 가리지 않으면 길을 막지 않는다
    watched += 1;
    const sets = [...src.matchAll(new RegExp('\\b' + setter + '\\(([^;\n]*)', 'g'))].map((x) => x[1]);
    const downs = sets.filter((v) => /^\s*(''|false|null)\s*\)/.test(v));
    if (sets.length && downs.length === 0) {
      stuck.push(rel + '  ' + name + ' (세우는 자리 ' + sets.length + ' : 내려놓는 자리 0)');
    }
    // **다시 읽는 길**이 그 가림막 안에 있는가 (2026-10-28).
    // 없으면 나갔다 들어오는 수밖에 없다. 관리자 화면 넷 중 **셋은 이미** 들고
    // 있었고 보안 현황 하나만 없었다 — 넷 중 하나만 다른 자리는 잊은 자리다
    if (!/onClick=\{/.test(block)) noWay.push(rel + '  ' + name);
  }
}
console.log('     화면을 가리는 「못 받았다」 ' + watched + '개');
ok('안 내려놓는 자리', stuck, []);
ok('  다시 읽을 길이 없는 가림막', noWay, []);

console.log('');
console.log('── 막힌 화면에서 다시 받을 길이 있나 ──');
// 가림막에 떨어지면 나갔다 들어오는 수밖에 없는 자리가 있었다
{
  const rem = codeOf(fs.readFileSync(path.join(SRC, 'pages', 'RemindersPage.jsx'), 'utf8'));
  const blocked = (rem.match(/if \(error \|\| !settings\) \{([\s\S]*?)\n  \}/) || ['', ''])[1];
  ok('알림 설정: 다시 받기가 있다', /onClick=\{load\}/.test(blocked), true);
  ok('  받아오는 자리는 하나다', (rem.match(/client\.get\('\/reminders'\)/g) || []).length, 1);
}

console.log('');
console.log(bad === 0 ? '모두 통과' : bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
