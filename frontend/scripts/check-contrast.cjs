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
