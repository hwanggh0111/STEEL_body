// **만들어 놓고 아무도 안 부르는 길이 있는가** (2026-11-04).
//
//   npm run alive     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 이 앱이 **두 번** 당한 모양이다 —
//
//   · `resetPoseVideo` : 「`resetPose` 와 짝」이라고 **주석까지 달아두고 아무도 안
//     불렀다**(10/21 에 찾았다). 횟수를 한 번 세면 10MB 짜리 모델을 로그인 화면까지
//     들고 서 있었다
//   · `DELETE /reminders/subscribe` : 서버에 처음부터 있었는데 **화면이 한 번도 안
//     불렀다** — 알림을 켤 수는 있고 **끌 수는 없었다**
//
// 내보내 놓고 아무도 안 쓰는 것은 둘 중 하나다 — **잊은 길**이거나 **죽은 값**이다.
// 둘 다 거기 있다는 사실만으로 **「이 일은 돌고 있다」고 믿게 만든다.** 그래서
// 다음에 그 자리를 읽는 사람(대개 나)이 **안 보고 지나간다.**
//
// ── 이 자를 세 번 고쳐서 여기까지 왔다 ──
//
//   ① 자(`scripts/`)를 안 세어 **92곳**이 나왔다 — 거의 다 값으로 보려고 내보낸 것
//   ② **같은 파일 안에서 쓰는 것**을 안 세어 39곳 — `clearReloadMark` 는 그 파일의
//      단추가 부르고 `loadPose` 는 같은 파일의 `readPose` 가 부른다
//   ③ 만든 줄 말고 **그 이름이 한 번이라도 더 나오는지**를 센다 → 셋
//
// **자가 넓으면 거짓을 말한다** — 오늘 네 번째로 같은 자리다.
const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = d + '/' + e.name;
  return e.isDirectory() ? walk(p) : (/\.jsx?$/.test(e.name) ? [p] : []);
});
const strip = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');

// **일부러 남겨둔 것은 까닭과 함께 적는다** — `scripts/run-checks.cjs` 의 `SKIP` 과
// 같은 결이다. 조용히 빼면 그 자리가 영영 안 보인다.
//
// ★ **쓰이지 않는 면제는 FAIL 한다** (`check-twins` 가 세운 그 선) — 이름이 바뀌거나
// 길이 이어지면 이 목록이 **덫**이 된다
const EXEMPT = {
  'data/healthLink.js openHealthStore':
    '헬스 커넥트가 없는 폰에 「받으러 가기」를 여는 길. **건강연동을 첫 출시에 넣을지가 미결**이라 '
    + '지금 단추를 붙이면 출시 전에 기능을 넓히는 셈이다 (까닭은 그 파일 머리글)',
  'data/measureRange.js MEASURE_MS_MAX':
    '스톱워치 테두리. 화면 폼은 안 읽지만(값이 타이머에서 온다) **서버에 같은 이름의 짝이 있고 '
    + '`npm run twins` 가 그 둘을 견준다** — 걷으면 그 견주기가 조용히 사라진다',
};

const srcFiles = walk('src');
const scriptFiles = fs.readdirSync('scripts')
  .filter((f) => /\.(cjs|mjs)$/.test(f))
  .map((f) => 'scripts/' + f);

const texts = new Map();
for (const p of srcFiles.concat(scriptFiles)) {
  // ★ **이 자 자신은 세지 않는다** — 아래 `EXEMPT` 에 이름이 적혀 있다는 것은
  // 「그 이름을 쓴다」가 아니다. 처음 돌렸을 때 면제한 둘이 **산 것으로 세어져**
  // 「쓰이지 않는 면제」로 되돌아왔다. 자가 자기를 보면 거짓을 말한다
  if (p === 'scripts/check-alive.cjs') continue;
  texts.set(p, strip(fs.readFileSync(p, 'utf-8')));
}

const exported = [];
for (const p of srcFiles) {
  const s = texts.get(p);
  for (const m of s.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) exported.push([p, m[1]]);
  for (const m of s.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)/g)) exported.push([p, m[1]]);
  // `export { a, b }` · `export { a as b } from '...'` — 넘겨주는 줄도 이름이다
  for (const m of s.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name && name !== 'default') exported.push([p, name]);
    }
  }
}

const dead = [];
const seen = new Set();
for (const [p, name] of exported) {
  const key = p.replace('src/', '') + ' ' + name;
  if (seen.has(key)) continue;
  seen.add(key);
  const re = new RegExp('\\b' + name.replace(/[$]/g, '\\$') + '\\b', 'g');
  let elsewhere = 0;
  for (const [q, s] of texts) {
    if (q === p) continue;
    elsewhere += (s.match(re) || []).length;
  }
  // 만든 파일 안에서 **한 번 더** 나오나 (만든 줄 하나는 빼고 센다)
  const inside = Math.max(0, (texts.get(p).match(re) || []).length - 1);
  if (elsewhere === 0 && inside === 0) dead.push(key);
}

console.log('── 내보냈는데 아무 데서도 안 쓰는 이름 ──');
const unexplained = dead.filter((k) => !EXEMPT[k]);
ok('까닭 없이 죽어 있는 이름이 없다', unexplained, []);

// 면제가 **아직 그 자리에 있는지** 본다 — 이름이 바뀌면 그 면제는 빈 채로 돌고,
// 그 자리는 아무도 안 보는 채로 남는다
const stale = Object.keys(EXEMPT).filter((k) => !dead.includes(k));
ok('  쓰이지 않는 면제가 없다', stale, []);

// 면제한 것은 **그 파일에 까닭이 적혀 있어야** 한다 — 목록만 보고는 왜인지 모른다
const nodoc = Object.keys(EXEMPT).filter((k) => {
  const [file] = k.split(' ');
  const src = fs.readFileSync(path.join('src', file), 'utf-8');
  return !/아무 화면도 이것을 안 부른다|짝 맞추기|미결/.test(src);
});
ok('  면제한 자리에 까닭이 적혀 있다', nodoc, []);

console.log('');
console.log('── 이 앱이 두 번 당한 그 자리 ──');
// 그때 고친 짝들이 **지금도 이어져 있는지** 본다 (이 자가 지키려는 바로 그것이다)
const auth = strip(fs.readFileSync('src/store/authStore.js', 'utf-8'));
ok('`resetPoseVideo` 를 로그아웃이 부른다', /resetPoseVideo\(\)/.test(auth), true);
const rem = strip(fs.readFileSync('src/pages/RemindersPage.jsx', 'utf-8'));
ok('알림을 끄는 길이 화면에 있다', /delete\('\/reminders\/subscribe'/.test(rem), true);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
