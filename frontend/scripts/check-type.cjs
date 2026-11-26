// **글자 크기는 일곱 단이다** (2026-11-26 · 맵시)
//
//   npm run type     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 있나 ──
//
// 11/26 에 세어보니 글자 크기가 적힌 자리가 **1,538곳 · 종류 34** 였다.
// `11 · 11.5 · 12 · 12.5 · 13` 다섯에 **1,201곳**이 몰려 있었고, 한 화면 안에서도
// 섞였다 — `YearWall.jsx` 한 장이 `10.5 · 11 · 11.5 · 12.5 · 13` 을 썼다.
//
// 0.5px 는 **눈에 거의 안 보인다.** 그래서 고치는 사람이 매번 「11.5 와 12 중 무엇」을
// 다시 정하고, 그 결과가 **줄 높이와 꺾이는 자리만** 어긋나게 한다. 주인이 「니가
// 판단해」라고 해서 시안 셋 중 **B안(일곱 단)**을 골라 639곳을 모았다.
//
// **모으는 것은 한 번이고, 지키는 것은 이 자다.** 자를 안 세우면 다음 주에 다시 34종이
// 된다 — 이 앱이 여러 번 겪은 꼴이다(색 · 자 이름 · 열 이름).
//
// ── 무엇을 보는가 ──
//
//   ⑴ 단에 없는 크기를 쓰는 자리가 없다 (jsx 의 `fontSize: N` · css 의 `font-size: Npx`)
//   ⑵ **24 이상은 따로 둔다** — Bebas 큰 수치(26 · 34 · 48 · 88)는 그림에 가깝고,
//      단으로 묶으면 그 화면의 뜻이 바뀐다. 그래서 자도 안 본다
//   ⑶ 단 자체가 `globals.css` 머리글에 적혀 있다 — **코드와 글이 같은 말을 한다**
//   ⑷ 0.5 가 다시 들어오지 않았다 (가장 많이 섞였던 꼴이라 따로 센다)
//
// ★ 과녁을 **주석에 두지 않는다.** 이 글에 `11.5` 가 여러 번 나오므로, 주석을 안 걷으면
//   이 자가 **제 머리글을 보고 FAIL** 을 낸다 (11/17 · 11/20 에 집에서 두 번 밟았다).
//
//   node scripts/check-type.cjs --되돌려     일부러 어긋낸 꼴 넷을 먹여 빨개지는지 본다

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const 단 = [11, 12, 13, 14, 16, 18, 22];
const 큰것 = 24;

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 주석을 걷는다. 줄 머리의 `//` · 덩이 주석 · jsx 주석 — 손으로 자른다(역슬래시 없이)
const 걷기 = (src, 여는것, 닫는것) => {
  let out = '';
  let i = 0;
  for (;;) {
    const a = src.indexOf(여는것, i);
    if (a < 0) return out + src.slice(i);
    out += src.slice(i, a);
    const b = src.indexOf(닫는것, a + 여는것.length);
    if (b < 0) return out;
    i = b + 닫는것.length;
  }
};
const 알맹이 = (src) => 걷기(src, '/*', '*/')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

/** 한 벌의 소스에서 **단에 없는 크기**를 찾는다 — 본 검사와 되돌려가 같은 손을 쓴다 */
function 재기(파일별) {
  const 어긋남 = [];
  for (const [이름, 원본] of 파일별) {
    알맹이(원본).split('\n').forEach((line, i) => {
      const 본 = [];
      for (const m of line.matchAll(/fontSize:\s*([0-9.]+)/g)) 본.push(Number(m[1]));
      for (const m of line.matchAll(/font-size:\s*([0-9.]+)px/g)) 본.push(Number(m[1]));
      for (const v of 본) {
        if (v >= 큰것) continue;                 // ⑵ 큰 수치는 따로 둔다
        if (단.includes(v)) continue;
        어긋남.push(이름 + ':' + (i + 1) + ' = ' + v);
      }
    });
  }
  return 어긋남;
}

const 소스들 = () => {
  const out = [];
  (function w(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) { w(p); continue; }
      if (!/[.](jsx?|css)$/.test(f.name)) continue;
      out.push([path.relative(ROOT, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8')]);
    }
  })(path.join(ROOT, 'src'));
  return out;
};

if (process.argv.includes('--되돌려')) {
  console.log('── 되돌려-FAIL: 일부러 어긋낸 꼴을 먹인다 ──');
  const 꼴 = [
    ['  11.5 가 들어오면 운다', [['x.jsx', 'const a = { fontSize: 11.5 };']], 'x.jsx:1 = 11.5'],
    ['  12.5 가 들어오면 운다', [['y.jsx', 'const a = { fontSize: 12.5 };']], 'y.jsx:1 = 12.5'],
    ['  css 의 15px 도 운다', [['z.css', '.a { font-size: 15px; }']], 'z.css:1 = 15'],
    ['  단에 있는 값은 안 운다', [['ok.jsx', 'const a = { fontSize: 13 };']], null],
    ['  24 이상은 안 운다 (큰 수치는 따로)', [['big.jsx', 'const a = { fontSize: 88 };']], null],
    ['  주석에 적힌 11.5 에는 안 걸린다', [['c.jsx', '// 옛 값 fontSize: 11.5 를 11 로 모았다']], null],
    ['  덩이 주석도 안 걸린다', [['d.jsx', '/* font-size: 12.5px 였다 */']], null],
  ];
  for (const [이름, 파일별, 기대말] of 꼴) {
    const 난것 = 재기(파일별);
    if (기대말 === null) ok(이름, 난것, []);
    else {
      ok(이름, 난것.some((x) => x.includes(기대말)), true);
      if (난것.length) console.log('       ' + 난것.join(' · '));
    }
  }
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
}

console.log('── 글자 크기가 일곱 단에 모여 있는가 ──');
const 파일별 = 소스들();
// 0건은 통과가 아니다 — 파일을 못 읽으면 아래 [] 도 [] 다
ok('소스를 읽었다 (파일 수)', 파일별.length > 100, true);
const 어긋남 = 재기(파일별);
console.log('     단: ' + 단.join(' · ') + '  ·  ' + 큰것 + ' 이상은 따로 둔다');
ok('단에 없는 크기를 쓰는 자리', 어긋남.slice(0, 20), []);
if (어긋남.length > 20) console.log('     … 모두 ' + 어긋남.length + '곳');

// ⑷ 가장 많이 섞였던 꼴을 따로 센다 — 0.5 는 눈에 안 보여서 조용히 다시 들어온다
const 반쪽 = 어긋남.filter((x) => /[.]5$/.test(x));
ok('  0.5 가 다시 들어온 자리', 반쪽.slice(0, 10), []);

// ⑶ 코드와 글이 같은 말을 하는가 — 단을 고치고 머리글을 안 고치면 글이 거짓이 된다
const css = fs.readFileSync(path.join(ROOT, 'src', 'styles', 'globals.css'), 'utf8');
ok('  단이 `globals.css` 머리글에 적혀 있다', css.includes(단.join(' · ')), true);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
