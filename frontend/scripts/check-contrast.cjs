// **글자가 바탕에서 읽히는가** (2026-11-11)
//
//   npm run contrast     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 11/11 에 배포본 홈에서 **안 보이는 글자** 둘을 찾았다. 둘 다 같은 잘못이었다 —
// **테두리 색(`--border-hover`, #4a3f2c)을 글자색으로 썼다.**
//
//     홈 주간 달력의 앞날 날짜      바탕과 1.84 : 1
//     한 해 벽의 기록 없는 달 이름  그 칸에서 1.62 : 1
//
// 수요일에 홈을 열면 목·금·토·일 숫자가 **지워진 것처럼** 보였고, 새로 온 사람의
// 한 해 벽은 달 이름이 거의 다 안 보였다. 흐린 것과 안 보이는 것은 다르다 —
// **흐린 것은 읽을 수 있어야 한다.**
//
// 이 류가 조용한 까닭은 **화면이 멀쩡해 보이기** 때문이다. 글자가 거기 있고 자리도
// 맞고 잘리지도 않았다. 색만 안 보인다. 그리고 **고치는 사람은 밝은 모니터로** 본다.
//
// 그래서 값으로 본다 — 토큰의 색을 읽어 **대비를 직접 셈한다**(WCAG 2.x 식).
//
// ── 무엇을 보는가 ──
//
//   1. 테두리 토큰이 **글자색 자리**에 쓰이지 않는가 (`color:` · `color=`)
//   2. 글자 토큰들이 늘 쓰는 바탕에서 **몇 대 일**인가. 뜻이 있어 흐린 것
//      (`--text-faint`)은 3 : 1 아래로 내려가지 않으면 되고, **눌리는 것의 이름**은
//      4.5 를 지킨다 (어디를 누르는지 모른 채 누르게 된다)
//   3. 밝은 색을 통째로 칠한 자리에 얹는 글자(`--on-accent`)가 읽히는가
//
// 대비는 **큰 값을 바라지 않는다** — 이 앱은 검정과 금이고 층이 뜻이다. 기준선만 본다.

const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'src', 'styles', 'globals.css'), 'utf8');

// ─── 대비 셈 (WCAG 2.x) ───
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const ratio = (a, b) => {
  const x = lum(a), y = lum(b);
  return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100;
};

/** `:root` 에 적힌 토큰 값. 주석은 걷어낸다 — 주석의 색 글자에 속으면 안 된다 */
const tokens = {};
for (const m of css.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1').matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
  if (!(m[1] in tokens)) tokens[m[1]] = m[2].toLowerCase();
}

console.log('── 토큰을 읽었는가 (자기 시험) ──');
ok('색 토큰을 찾았다', Object.keys(tokens).length > 12, true);
ok('  셈이 맞는다 (흰 글자 · 검은 바탕)', ratio('#ffffff', '#000000'), 21);
ok('  같은 색은 1 : 1', ratio('#12100c', '#12100c'), 1);

console.log('');
console.log('── 1. 테두리 색을 글자색으로 쓰지 않는가 ──');
// 테두리로 쓰라고 둔 토큰들. 글자로 쓰면 1.5~1.9 : 1 이 된다
const BORDER_TOKENS = ['--border', '--border-hover'];
const 글자로쓴자리 = [];
const walk = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) { walk(full); continue; }
    if (!/\.(jsx?|css)$/.test(f.name)) continue;
    const src = fs.readFileSync(full, 'utf8');
    src.split('\n').forEach((line, i) => {
      // 주석 줄은 넘긴다 — 이 검사의 까닭을 적은 글에 제가 걸리면 안 된다
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const t of BORDER_TOKENS) {
        // `color: 'var(--border-hover)'` · `color="var(--border)"` · 삼항 안쪽까지.
        //
        // 두 가지를 비킨다 — 안 비키면 **멀쩡한 줄이 걸린다**(처음 넷이 그랬다) —
        //   · `borderColor:` · `border-color:` 는 글자색이 아니다 → 앞 글자를 본다.
        //     `kind.color : 'var(--border)'`(삼항의 **읽는** 쪽)도 같다 → 점도 본다
        //   · `color: 'var(--text-muted)', border: '1px solid var(--border)'` 처럼
        //     한 줄에 둘이 있는 자리 → **쉼표에서 끊는다**
        if (new RegExp('(?<![a-zA-Z.-])color\\s*[:=][^;\\n,]*var\\(' + t + '\\)').test(line)) {
        글자로쓴자리.push(path.relative(ROOT, full).split(path.sep).join('/') + ':' + (i + 1));
        }
      }
    });
  }
};
walk(path.join(ROOT, 'src'));
ok('테두리 토큰을 글자색으로 쓴 자리', 글자로쓴자리, []);
console.log('     ↑ 걸리면 **안 보이는 글자**다 (1.84 : 1). 흐리게 둘 자리라면');
console.log('       `--text-faint`, **눌리는** 자리면 `--text-muted` 를 쓰고 그 칸');
console.log('       바탕이 4.5 를 못 받치면 **바탕을 내린다** (③ 을 볼 것)');

console.log('');
console.log('── 2. 글자 토큰이 늘 쓰는 바탕에서 읽히는가 ──');
// 바탕 넷. 카드는 그라디언트의 **밝은 쪽**(가장 불리한 쪽)으로 본다
const 바탕 = {
  '화면': tokens['--bg-primary'],
  '카드': '#1e1a14',
  '칩':   tokens['--bg-tertiary'],
};
// 한 해 벽의 달 칸은 제 그라디언트를 쓴다 — 그 칸을 재려면 여기를 본다
const 달칸 = '#221d16';

const 재기 = (이름, 토큰, 최소) => {
  const c = tokens[토큰];
  if (!c) { ok(이름 + ' 토큰이 있다', !!c, true); return; }
  const 값 = Object.fromEntries(Object.entries(바탕).map(([k, b]) => [k, ratio(c, b)]));
  const 낮은 = Math.min(...Object.values(값));
  ok(`${이름} (${c}) 가 ${최소} : 1 이상`, 낮은 >= 최소, true);
  console.log('     ' + Object.entries(값).map(([k, v]) => `${k} ${v}`).join(' · '));
};

// 본문·보조 글자는 **읽는 글**이다 — 4.5 를 지킨다
재기('본문 글자  --text-primary  ', '--text-primary', 4.5);
재기('보조 글자  --text-secondary', '--text-secondary', 4.5);
재기('금색      --accent        ', '--accent', 4.5);
// ★ `--text-muted` — 11/25 에 **주인이 시안 A 를 골라** #7a7160 → #8c816e 가 됐다
//   (화면 4.96 · 카드 4.52 · 칩 4.11). 11~12px 보조 글자 766 자리의 색이다.
//   **칩(#282219) 위에서는 아직 4.11** 이라 바닥은 3 으로 둔다 — 여기를 4.5 로 올리려면
//   칩 바탕을 내리는 결정이 먼저다. 다만 **눌리는 칸** 안에서는 4.5 를 지킨다 (③)
재기('흐린 글자  --text-muted    ', '--text-muted', 3);
// 뜻이 있어 흐린 것 — 「아직 안 온 날」처럼 **있다는 것만 알리는** 자리다.
// 안 눌리는 정보이므로 3 : 1 을 바닥으로 둔다 (1.84 로 되돌아가면 여기서 걸린다)
재기('흐려도 되는 것 --text-faint ', '--text-faint', 3);

console.log('');
console.log('── 3. 눌리는 칸 안의 글자는 그 칸 바탕에서 4.5 를 지킨다 ──');
// 한 해 벽의 달 칸은 **기록이 없어도 눌린다**(`onPickMonth`). 어디를 누르는지 모른 채
// 누르게 두지 않는다. 그 칸의 바탕은 카드가 아니라 **제 그라디언트**다.
//
// 2026-11-26 에 보는 자리를 넓혔다 — 옛 자는 `--text-faint-tap` **토큰 하나**만 쟀고,
// **같은 칸의 횟수**(`--text-muted` · 4.37)는 안 봤다. 그래서 11/25 에 muted 가 밝아져
// 층이 뒤집힐 때(이름 4.55 > 횟수 4.37) 자는 초록이었다. 이제 ⑴ 바탕색을 `YearWall.jsx`
// 에서 **읽고**(베껴 적으면 바탕이 바뀔 때 거짓 통과가 난다) ⑵ 그 칸이 쓰는 글자 토큰
// **전부**를 그 바탕에서 잰다.
{
  const wallPath = path.join(ROOT, 'src', 'components', 'YearWall.jsx');
  const wall = fs.readFileSync(wallPath, 'utf8');

  // 칸 하나의 범위 — 바탕을 칠하는 줄부터 범례 앞까지
  const 시작 = wall.indexOf('linear-gradient');
  const 끝 = wall.indexOf('{/* 범례 */}');
  ok('달 칸을 코드에서 찾았다', 시작 > 0 && 끝 > 시작, true);
  const 칸 = wall.slice(시작, 끝);

  // 그라디언트의 **밝은 쪽**(첫 색) — 가장 불리한 쪽이다
  const g = 칸.match(/#[0-9a-fA-F]{6}/);
  ok('  바탕을 자에 베끼지 않고 읽었다', !!g, true);
  const 달칸바탕 = g ? g[0].toLowerCase() : null;

  // 그 칸이 글자색으로 쓰는 토큰 전부 (삼항의 양쪽까지 — `color: a ? var(x) : var(y)`)
  const 쓰는토큰 = [...new Set(칸.split('var(--text-').slice(1)
    .map((t) => '--text-' + t.slice(0, t.indexOf(')'))))].sort();
  ok('  칸이 쓰는 글자 토큰을 찾았다', 쓰는토큰.length > 0, true);
  console.log('     바탕 ' + 달칸바탕 + ' · 글자 ' + 쓰는토큰.join(' · '));

  if (달칸바탕) {
    const 밑 = 쓰는토큰.filter((t) => !tokens[t] || ratio(tokens[t], 달칸바탕) < 4.5);
    ok('  그 칸의 글자 전부가 4.5 : 1 이상', 밑, []);
    for (const t of 쓰는토큰) {
      // 없는 토큰을 쓰는 자리도 **FAIL 로 적고 넘어간다** — 여기서 터지면 자가 죽는다
      console.log('     ' + t + (tokens[t]
        ? ' (' + tokens[t] + ') → ' + ratio(tokens[t], 달칸바탕)
        : ' → ★ :root 에 없는 토큰이다 (글자가 아예 안 칠해진다)'));
    }
  }

  // 11/11 에 두고 11/26 에 걷은 토큰 — 되살아나면 층이 또 뒤집힌다.
  // **쓰는 자리**(var(...))만 센다 — 까닭을 적은 주석에 제가 걸리면 안 된다
  const 쓴자리 = [];
  const 훑기 = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) { 훑기(full); continue; }
      if (!/[.](jsx?|css)$/.test(f.name)) continue;
      if (fs.readFileSync(full, 'utf8').includes('var(--text-faint-tap)')) {
        쓴자리.push(path.relative(ROOT, full).split(path.sep).join('/'));
      }
    }
  };
  훑기(path.join(ROOT, 'src'));
  ok('  --text-faint-tap 토큰이 걷혔다 (밝기로 「눌린다」를 말하지 않는다)',
    '--text-faint-tap' in tokens, false);
  ok('  그 토큰을 쓰는 자리가 없다', 쓴자리, []);
}

console.log('');
console.log('── 3-2. 바탕을 칠한 자리의 글자 ──');
// ── **칩에서만 4.11 로 남아 있었다** ── (2026-11-26 · 맵시 · 시안 ② B안)
//
// `--bg-tertiary`(#282219)는 칩 · 큰 단추 · 고르기 칸이 쓰는 바탕이다. 11/25 에 주인이
// 흐린 글자를 밝힌 뒤에도 **그 바탕에서만 4.11** 로 남았다(화면 4.96 · 카드 4.52).
// **바탕은 안 내렸다** — 내리면 앱 전체가 따라오고, 내린 값은 카드 바탕과 거의 같아져
// 칩이 떠 보이지 않는다(시안 ② A안의 치르는 값). **그 바탕에 얹는 글자만** 올렸다.
//
// ── 이 자를 세 번 고쳤다. 고친 까닭을 적어둔다 ──
//
// ⑴ **한 줄만** 봤다 → `MaintAdmin` 의 style 을 여러 줄로 쪼개자 색과 바탕이 다른 줄에
//    놓여 **되돌려도 안 울었다**(되돌려-FAIL ③ 이 잡았다).
// ⑵ **위아래 다섯 줄**을 봤다 → 거짓 FAIL 이 열일곱. `background` 와 `color` 가 각자
//    삼항이고 조건이 서로 달랐다(홈 주간 달력은 칩 바탕일 때 글자가 **금색**이다).
// ⑶ **갈래를 맞췄다**(토큰 수가 같을 때 같은 자리끼리) → 그래도 `WeeklyReport` 가 거짓이었다.
//    막대는 칩 바탕이고 글자는 **옆 칸**인데, 다섯 줄 창이 그 둘을 한 자리로 봤다.
//
// 그래서 지금은 **같은 덩이**만 본다 — 바탕 토큰을 감싼 **가장 안쪽 중괄호**를 찾아
// 그 안의 `color:` 만 짝으로 본다. 옆 칸은 다른 덩이라 안 섞인다. 짝을 못 가리면
// **의심으로 적어만 둔다** — 거짓 FAIL 로 울리면 다음 사람이 자를 끈다.
//
// ⑷ **조건까지 보고 짝짓는다** (2026-11-27 · 맵시). ⑶ 은 **갈래 수가 같을 때만** 짝을
//    맞췄다. 그런데 `background: on ? var(--accent) : 'transparent'` 는 토큰이 하나고
//    `color: on ? var(--on-accent) : var(--text-secondary)` 는 둘이라 **수가 안 맞아
//    의심으로 밀렸다** — 그 꼴이 열다섯이었다. 삼항을 **조건 → 값** 짝으로 쪼개고
//    `transparent` · `none` 도 한 갈래로 세면 수가 맞고, 그래도 안 맞으면 **조건이 같은
//    갈래끼리**(`on` ↔ `on`) 짝지으면 코드로 가려진다. 열다섯이 전부 OK 로 내려갔다.
//
// ★ 그리고 **바탕을 칩 하나만 보고 있었다** (2026-11-27 · 맵시). 11/26 에 고친
//   「정지」 단추는 **밝은 빨강을 면으로 깔고 금 글자가 얹힌 것**(1.9 : 1)이었는데,
//   이 자는 `--bg-tertiary` 만 과녁이라 그 자리를 **보지 못했다.** 면으로 칠하는
//   **모든 밝은 토큰**을 같은 틀로 본다 — 3-2 는 칩, 3-3 은 금·초록·노랑·빨강·파랑.
{
  /** 그 자리를 감싼 **가장 안쪽 중괄호** 덩이 (style={{…}} · { label, color, dim } 둘 다) */
  const 덩이 = (글, at) => {
    let 깊이 = 0;
    let 시작 = -1;
    for (let i = at; i >= 0; i--) {
      const c = 글[i];
      if (c === '}') 깊이 += 1;
      else if (c === '{') {
        if (깊이 === 0) { 시작 = i; break; }
        깊이 -= 1;
      }
    }
    if (시작 < 0) return null;
    깊이 = 0;
    for (let i = 시작; i < 글.length; i++) {
      const c = 글[i];
      if (c === '{') 깊이 += 1;
      else if (c === '}') { 깊이 -= 1; if (깊이 === 0) return { 글: 글.slice(시작, i + 1), 시작 }; }
    }
    return null;
  };

  /**
   * 한 선언의 몸통. 괄호·따옴표를 세며 읽고 **깊이 0 쉼표**에서 끊는다.
   * 덩이 안에서의 **자리(시작 · 끝)도 같이** 돌려준다 — 과녁이 그 선언 안쪽인지
   * 가리는 데 쓴다 (`stroke="var(--accent)"` 를 면으로 읽던 거짓을 막는다)
   */
  const 몸통 = (덩, 이름들) => {
    const m = 덩.match(new RegExp('(?<![a-zA-Z-])(?:' + 이름들 + ')\\s*:'));
    if (!m) return null;
    let q = null;
    let 깊이 = 0;
    let 몸 = '';
    for (let i = m.index + m[0].length; i < 덩.length; i++) {
      const c = 덩[i];
      if (q) { 몸 += c; if (c === q) q = null; continue; }
      if (c === "'" || c === '"' || c === '`') { q = c; 몸 += c; continue; }
      if (c === '(' || c === '{' || c === '[') 깊이 += 1;
      if (c === ')' || c === '}' || c === ']') { if (깊이 === 0) break; 깊이 -= 1; }
      if (깊이 === 0 && c === ',') break;
      몸 += c;
    }
    const 시작 = m.index + m[0].length;
    return { 몸, 시작, 끝: 시작 + 몸.length };
  };

  /** 삼항을 **조건 → 값** 짝으로. `a ? X : b ? Y : Z` → [{a,X},{b,Y},{그밖,Z}] */
  const 갈래 = (몸) => {
    if (몸 == null) return null;
    const 조각 = [];
    const 끝 = [];
    let q = null;
    let 깊이 = 0;
    let 지금 = '';
    for (let i = 0; i < 몸.length; i++) {
      const c = 몸[i];
      if (q) { 지금 += c; if (c === q) q = null; continue; }
      if (c === "'" || c === '"' || c === '`') { q = c; 지금 += c; continue; }
      if (c === '(' || c === '{' || c === '[') { 깊이 += 1; 지금 += c; continue; }
      if (c === ')' || c === '}' || c === ']') { 깊이 -= 1; 지금 += c; continue; }
      // 삼항의 `?` `:` 만 구분자다. `?.` · `??` 는 아니고, 깊이 0 에서만 본다
      if (깊이 === 0 && (c === '?' || c === ':') && !/[?:]/.test(몸[i + 1] || '') && 몸[i + 1] !== '.') {
        조각.push(지금.trim()); 끝.push(c); 지금 = ''; continue;
      }
      지금 += c;
    }
    조각.push(지금.trim());
    // 조각 **뒤에 오는 구분자가 `?`** 면 그 조각은 값이 아니라 **조건**이다
    const 갈래들 = [];
    let 앞조건 = null;
    for (let i = 0; i < 조각.length; i++) {
      if (끝[i] === '?') { 앞조건 = 조각[i]; continue; }
      갈래들.push({ 조건: 앞조건 === null ? '늘' : 앞조건, 값: 조각[i] });
      앞조건 = null;
    }
    return 갈래들;
  };

  const 토큰of = (값) => { const m = /var[(](--[\w-]+)[)]/.exec(값 || ''); return m ? m[1] : null; };
  const 색of = (값) => {
    const t = 토큰of(값);
    if (t) return { 이름: t, 색: tokens[t] || null };
    const h = /#[0-9a-fA-F]{6}\b/.exec(값 || '');
    return h ? { 이름: h[0], 색: h[0].toLowerCase() } : { 이름: (값 || '').trim().slice(0, 24), 색: null };
  };

  /**
   * 한 바탕 무리에 얹는 글자를 전부 잰다.
   *   바탕들 — 과녁 바탕 토큰 (이 토큰을 **면으로 칠한** 덩이를 찾는다)
   *   이름들 — 바탕으로 읽을 선언 이름 (칩은 `{label,color,dim}` 꼴의 `dim` 도 바탕이다)
   */
  const 면검사 = (바탕들, 이름들) => {
    const 난것 = []; const 의심 = []; const 예외 = []; const 막대 = [];
    const 훑기 = (dir) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, f.name);
        if (f.isDirectory()) { 훑기(full); continue; }
        if (!/[.]jsx?$/.test(f.name)) continue;
        const 글 = fs.readFileSync(full, 'utf8');
        const 이름 = path.relative(ROOT, full).split(path.sep).join('/');
        for (const 과녁 of 바탕들) {
          let at = -1;
          for (;;) {
            at = 글.indexOf(과녁, at + 1);
            if (at < 0) break;
            // 주석 줄에 적힌 것은 건너뛴다 — 까닭을 적은 글에 제가 걸리면 안 된다
            const 줄머리 = 글.lastIndexOf('\n', at) + 1;
            if (/^\s*([/][/]|[*]|[/][*])/.test(글.slice(줄머리, at))) continue;
            // `--accent` 가 `--accent-dim` 의 앞머리로 걸리지 않게 한다
            if (/[\w-]/.test(글[at + 과녁.length] || '')) continue;
            const 줄번호 = 글.slice(0, at).split('\n').length;
            const 덩싸개 = 덩이(글, at);
            if (!덩싸개) continue;
            const 덩 = 덩싸개.글;
            const 안자리 = at - 덩싸개.시작;          // 덩이 안에서 과녁이 적힌 자리
            const 바탕선언 = 몸통(덩, 이름들);
            if (!바탕선언) continue;
            // ★ **과녁이 그 선언 안쪽일 때만** 면으로 본다. 안 가리면 같은 덩이의
            //   `stroke="var(--accent)"` · 옆 칸의 색까지 면으로 읽는다 (⑶ 의 구멍)
            if (안자리 < 바탕선언.시작 || 안자리 >= 바탕선언.끝) continue;
            const 바탕갈래 = 갈래(바탕선언.몸);
            if (!바탕갈래) continue;
            const 면자리 = 바탕갈래.findIndex((g) => 토큰of(g.값) === 과녁);
            if (면자리 < 0) continue;
            const 자리 = 이름 + ':' + 줄번호 + (바탕들.length > 1 ? ' [' + 과녁 + ']' : '');
            const 글자선언 = 몸통(덩, 'color');
            const 글자갈래 = 글자선언 ? 갈래(글자선언.몸) : null;
            // **글자가 없는 덩이는 막대·점이다** — 읽을 글자가 없으니 대비를 안 본다.
            //   (칩 쪽은 11/26 부터 그냥 넘겼다. 이제 세어서 적는다)
            if (!글자갈래 || !글자갈래.length) { 막대.push(자리); continue; }
            // ★ **못 누르는 상태는 예외다** — 흐린 것이 뜻이다(`.btn-primary:disabled` 도
            //   같은 꼴로 `--text-muted` 를 쓴다). 조용히 빼지 않고 **적어서** 둔다.
            //   과녁은 그 덩이에 적힌 `not-allowed` · `disabled`, 즉 **그 자리가 스스로
            //   「못 누른다」고 말하는가**다 (`OverlayCamera` 의 「찍기」가 그 하나다).
            const 못누름 = /not-allowed|disabled/.test(덩);
            // 짝을 고르는 차례 — ⑴ 하나뿐 ⑵ **조건이 같은 것** ⑶ 갈래 수가 같으면 그 자리
            const 짝 = 글자갈래.length === 1
              ? 글자갈래[0]
              : (글자갈래.find((x) => x.조건 === 바탕갈래[면자리].조건)
                 ?? (바탕갈래.length === 글자갈래.length ? 글자갈래[면자리] : null));
            if (!짝) {
              의심.push(자리 + ' 짝을 못 가림 → ' + 글자갈래.map((x) => (x.조건 === '늘' ? '늘' : x.조건.slice(0, 12)) + '=' + 색of(x.값).이름).join(' / '));
              continue;
            }
            const { 이름: 글자이름, 색: 글자색 } = 색of(짝.값);
            const 바탕색 = tokens[과녁];
            if (!글자색 || !바탕색) {
              // 물려받는 색(`inherit` · `currentColor`)은 여기서 못 잰다 — 적어만 둔다
              의심.push(자리 + ' 색을 못 읽음 → ' + 글자이름);
              continue;
            }
            const r = ratio(글자색, 바탕색);
            if (r < 4.5) (못누름 ? 예외 : 난것).push(자리 + ' ' + 글자이름 + ' ' + r);
          }
        }
      }
    };
    훑기(path.join(ROOT, 'src'));
    const u = (a) => [...new Set(a)];
    return { 난것: u(난것), 의심: u(의심), 예외: u(예외), 막대: u(막대) };
  };

  const 적는다 = (제목, 결과) => {
    ok(제목, 결과.난것, []);
    if (결과.예외.length) {
      console.log('     못 누르는 상태라 비킨 자리 ' + 결과.예외.length + '곳 (흐린 것이 뜻이다):');
      for (const x of 결과.예외) console.log('       · ' + x);
    }
    if (결과.의심.length) {
      console.log('     의심 ' + 결과.의심.length + '곳 (코드로 못 가린다 — 눈으로 볼 것):');
      for (const x of 결과.의심.slice(0, 8)) console.log('       · ' + x);
    }
    console.log('     글자 없는 덩이(막대 · 점) ' + 결과.막대.length + '곳 — 읽을 글자가 없다');
  };

  const 칩 = tokens['--bg-tertiary'];
  console.log('     칩 바탕 ' + 칩 + ' — 흐린 글자 ' + ratio(tokens['--text-muted'], 칩)
    + ' · 보조 글자 ' + ratio(tokens['--text-secondary'], 칩));
  적는다('칩 바탕 위에서 4.5 를 못 지키는 글자',
    면검사(['--bg-tertiary'], '(?:background|backgroundColor|dim)'));

  console.log('');
  console.log('── 3-3. 밝은 색을 면으로 칠한 자리의 글자 ──');
  // 「정지」가 여기 걸릴 자리였다 — 면이 밝으면 **금 글자도 흐린 글자도 안 보인다**.
  // 면으로 칠해도 되는 밝은 토큰이면 글자는 `--on-accent` · `--on-danger` 중 하나다
  적는다('밝은 면 위에서 4.5 를 못 지키는 글자',
    면검사(['--accent', '--accent-hover', '--accent-low', '--success', '--warning',
            '--danger', '--danger-strong', '--info'], '(?:background|backgroundColor)'));
}

console.log('');
console.log('── 4. 밝은 색을 통째로 칠한 자리에 얹는 글자 ──');
// 금·초록·노랑에 흰 글자를 얹으면 1.8 : 1 이다 (그래서 `--on-accent` 가 있다)
// ★ 토큰이 없으면 **FAIL 로 적고 넘어간다** — 여기서 터지면 자가 죽어서, 그 뒤의
//   검사가 아예 안 돌고 「되돌려도 안 운다」가 된다 (2026-11-26 에 ③·④ 둘 다 밟았다)
const 얹기 = (이름, 글자토큰, 바탕토큰) => {
  const f = tokens[글자토큰]; const b = tokens[바탕토큰];
  if (!f || !b) {
    ok(`${이름} — 토큰이 있다 (${글자토큰} · ${바탕토큰})`, { [글자토큰]: f || null, [바탕토큰]: b || null },
      { [글자토큰]: f || '있어야 한다', [바탕토큰]: b || '있어야 한다' });
    return null;
  }
  const r = ratio(f, b);
  ok(`${이름}(${b}) 위의 ${글자토큰} 가 4.5 : 1 이상 → ${r}`, r >= 4.5, true);
  return r;
};
for (const [이름, t] of [['금', '--accent'], ['초록', '--success'], ['노랑', '--warning']]) {
  얹기(이름, '--on-accent', t);
}
// ── **빨강은 이 자에 아예 없었다** ── (2026-11-26 · 맵시)
//
// 빨강은 금과 **반대**다. 면으로 칠하는 것은 어두운 `--danger-strong` 이라 흰 글자가
// 6.34 이고, 금 위에 쓰는 `--on-accent`(#12100c)를 얹으면 3.0 으로 떨어진다. 그래서
// `--on-danger` 를 따로 둔다. 여태 여섯 자리가 `#fff` 를 **손으로** 적고 있었다.
{
  얹기('빨강', '--on-danger', '--danger-strong');
  // 금 위의 글자를 빨강에 얹지 않는가 — 반대로 쓰면 3.0 이다
  if (tokens['--on-accent'] && tokens['--danger-strong']) {
    ok('  빨강 위에 --on-accent 를 얹으면 기준선 밑이다 (그래서 토큰이 둘이다)',
      ratio(tokens['--on-accent'], tokens['--danger-strong']) < 4.5, true);
  }
  // 밝은 빨강은 **면으로 쓰지 않는다** — 그 위 흰 글자는 3.41 이다
  ok('  밝은 --danger 를 면으로 칠한 자리', (() => {
    const 난것 = [];
    const 훑기 = (dir) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, f.name);
        if (f.isDirectory()) { 훑기(full); continue; }
        if (!/[.]jsx?$/.test(f.name)) continue;
        fs.readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
          if (/^\s*([/][/]|[*])/.test(line)) return;
          // `background: 'var(--danger)'` — 딱지(`badge-danger`)는 테두리·글자만 쓴다
          if (/background(Color)?\s*:\s*'var[(]--danger[)]'/.test(line)) {
            난것.push(path.relative(ROOT, full).split(path.sep).join('/') + ':' + (i + 1));
          }
        });
      }
    };
    훑기(path.join(ROOT, 'src'));
    return 난것;
  })(), []);
  // 손으로 적은 흰 글자 — 제공자 색(네이버·구글·인스타·X)만 빼고 0 이어야 한다
  ok('  빨강 위 글자를 손으로 적은 자리', (() => {
    const 난것 = [];
    // 제공자 색(브랜드 가이드) · 사진 위에 그려 내보내는 글자(캔버스)는 토큰 자리가 아니다
    const 제공자 = ['SocialLoginButtons.jsx', 'OauthEmailPage.jsx', 'mergeShots.js'];
    const 훑기 = (dir) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, f.name);
        if (f.isDirectory()) { 훑기(full); continue; }
        if (!/[.]jsx?$/.test(f.name)) continue;
        if (제공자.includes(f.name)) continue;   // 브랜드 가이드가 못 박은 색이다
        fs.readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
          if (/^\s*([/][/]|[*])/.test(line)) return;
          if (/(?<![a-zA-Z.-])color\s*[:=][^;\n,]*'#(fff|ffffff)'/.test(line)) {
            난것.push(path.relative(ROOT, full).split(path.sep).join('/') + ':' + (i + 1));
          }
        });
      }
    };
    훑기(path.join(ROOT, 'src'));
    return 난것;
  })(), []);
}

console.log('');
if (bad === 0) console.log('글자가 바탕에서 읽힙니다');
else console.log(bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
