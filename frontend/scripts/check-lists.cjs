// 목록으로 쓰는 state 에 **서버가 준 것을 그대로** 담는 자리가 있는가.
//
//   npm run lists
//
// 이 앱이 네 번 당한 종류다 — 8/24 `/security/dashboard` · 8/26 `/security/logs` ·
// 8/28 응답 모양 다섯 · 9/2 이상한 값 51군데. 배열이 올 자리에 객체가 오면
// 그리는 쪽의 `.map` 이 없어서 **그 자리에서 터지고, 터지면 흰 화면**이다.
//
// 9/3 에 하나가 더 나왔다. `SecurityPanel` 은 사람 목록을 **두 자리**에서 불러온다 —
// 처음 열 때(`loadData`)와 차단·해제를 누른 뒤(`handleAction`). 처음 것만 막혀 있었다:
//
//   setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);   // 처음 열 때
//   setUsers(res.data);                                            // 차단을 누른 뒤 ←
//
// **같은 목록을 두 자리에서 담으면 한쪽만 막히기 쉽다.** 눈으로는 안 걸린다 —
// 두 줄이 200줄 떨어져 있고 둘 다 멀쩡해 보인다. 그래서 글자로 본다.
//
// 보는 것은 하나다: `useState([])` 로 시작한 state 에 **서버가 준 것을 그대로**
// (`data` · `res.data`) 담으면서 배열 보장(`Array.isArray(...)` · `|| []` · `?? []`)이
// 없는 자리.
//
// **서버에서 온 것만 본다.** 앱 안에서 만든 값(바로 윗줄에서 이미 배열로 만든 것,
// 배열을 돌려주는 우리 함수)까지 잡으면 오탐이 쌓이고, **우는 검사는 안 보게 된다.**
// 모양이 어긋나는 자리는 늘 우리 코드가 아니라 **경계** — 서버와 화면 사이다.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(jsx|js)$/.test(f.name)) files.push(p);
  }
})(SRC);

// 이미 배열이라는 보장이 붙어 있는가
const GUARDED = /Array\.isArray|\|\|\s*\[\]|\?\?\s*\[\]/;
// 서버가 준 것인가 — `data` · `res.data` · `{ data }` 로 풀어 쓴 것
const FROM_SERVER = /\bdata\b/;
// 함수형 갱신 — `setX(prev => ...)`
const UPDATER = /^\s*(\w+|\(\s*\w*\s*\))\s*=>/;

const found = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');

  // `const [x, setX] = useState([])` 로 시작하는 것만 본다.
  // 빈 배열로 시작한다는 것은 **그리는 쪽이 목록으로 돈다**는 뜻이다
  const setters = new Set();
  for (const m of src.matchAll(/const\s*\[\s*\w+\s*,\s*(set\w+)\s*\]\s*=\s*useState\(\s*\[\s*\]\s*\)/g)) {
    setters.add(m[1]);
  }

  for (const setter of setters) {
    let at = 0;
    for (;;) {
      at = src.indexOf(setter + '(', at);
      if (at < 0) break;
      const arg = src.slice(at + setter.length + 1, at + setter.length + 121).split(';')[0];
      const line = src.slice(0, at).split('\n').length;
      at += setter.length;
      // 함수형 갱신(`setX(prev => ...)`)은 **배열이 그대로 유지되는** 자리다.
      // 그 안의 `data` 가 레코드 하나로 성한지는 다른 질문이고, 여기서 볼 것이 아니다 —
      // 검사 하나가 두 가지를 보면 둘 다 흐려진다
      if (UPDATER.test(arg)) continue;
      if (!FROM_SERVER.test(arg)) continue;
      if (GUARDED.test(arg)) continue;
      const rel = path.relative(path.join(__dirname, '..'), file).split(path.sep).join('/');
      found.push(`${rel}:${line} — ${setter}(${arg.split('\n')[0].trim().slice(0, 60)}`);
    }
  }
}

console.log('── 목록 state 에 배열이 아닌 것이 들어갈 수 있는가 ──');
if (found.length === 0) {
  console.log('없습니다');
  process.exit(0);
}
for (const f of found) console.log('FAIL ' + f);
console.log('');
console.log(`${found.length}군데. 배열이 아닌 것이 오면 그리는 쪽에서 터집니다 —`);
console.log('Array.isArray(...) ? ... : [] 로 받으세요.');
process.exit(1);
