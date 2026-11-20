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

// ── 자가 눈이 멀지 않게 (2026-11-20 · 정석) ──
//
// 여태 이 자는 `useState('')` **한 꼴만** 봤다. 쌍따옴표 · 괄호 안 빈칸 · 인자
// 없음 · `undefined` 는 **보이지 않았다**. 그러고도 `watched` 를 **적기만 하고
// 판정하지 않아서**, 누가 `useState("")` 로 적는 날 그 줄은 이 검사에서 조용히
// 사라지고 전체는 초록으로 남는다. **셈 0 은 통과가 아니다.**
//
// 그래서 ⑴ 꼴을 넓히고 ⑵ **느슨한 자와 견준다** — 느슨한 자가 더 잡으면 FAIL
// 이다. 기준 숫자를 박지 않으므로 썩지 않는다.
const 세우는꼴 = /const\s*\[\s*(\w+)\s*,\s*(set\w+)\s*\]\s*=\s*useState\s*(?:<[^>]*>)?\s*\(\s*(''|""|``|false|null|undefined)?\s*\)/g;
const 내리는꼴 = /^\s*(''|""|``|false|null|undefined)?\s*\)/;
// 이것보다 더 잡는 자가 있으면 위의 자가 눈이 먼 것이다 (이름만 보고 센다)
const 더느슨한꼴 = /\[\s*(\w*(?:err|fail|stuck)\w*)\s*,\s*(set\w+)\s*\]\s*=\s*useState/gi;

console.log('── 못 받았다를 세우고 안 내려놓는 자리 ──');
const stuck = [];
const noWay = [];
let watched = 0;
const 본것 = [];           // 느슨한 자와 견주려고 이름까지 적어 둔다
for (const f of walk(SRC)) {
  const src = codeOf(fs.readFileSync(f, 'utf8'));
  const rel = path.relative(SRC, f).split(path.sep).join('/');
  for (const m of src.matchAll(세우는꼴)) {
    const [, name, setter] = m;
    // 못 받았다는 뜻으로 쓰는 값만 본다
    if (!/(err|fail|stuck)/i.test(name)) continue;
    const block = blockOf(src, name);
    본것.push(rel + ' ' + name);    // 가림막이 없어도 **봤다** — 느슨한 자와 셈을 맞춘다
    if (!block) continue;             // 가리지 않으면 길을 막지 않는다
    watched += 1;
    const sets = [...src.matchAll(new RegExp('\\b' + setter + '\\(([^;\n]*)', 'g'))].map((x) => x[1]);
    const downs = sets.filter((v) => 내리는꼴.test(v));
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
// **적은 수를 판정으로 올린다** — 모집단이 0 이 되면 운다
ok('  「못 받았다」를 한 자리라도 봤다', watched > 0, true);
// 그리고 **내 눈이 느슨한 자보다 좁아지지 않았는가** (꼴이 바뀌는 날을 위해)
{
  const 느슨히본것 = [];
  for (const f of walk(SRC)) {
    const src = codeOf(fs.readFileSync(f, 'utf8'));
    const rel = path.relative(SRC, f).split(path.sep).join('/');
    for (const m of src.matchAll(더느슨한꼴)) 느슨히본것.push(rel + ' ' + m[1]);
  }
  const 내가본것 = new Set(본것);
  const 놓친것 = 느슨히본것.filter((x) => !내가본것.has(x));
  console.log('     느슨한 자로는 ' + 느슨히본것.length + '개 — 내 자로는 ' + 본것.length + '개');
  ok('  ★ 내 자가 느슨한 자보다 좁지 않다 (눈이 멀면 운다)', 놓친것, []);
}
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
