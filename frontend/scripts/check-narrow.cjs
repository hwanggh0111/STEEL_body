// **좁은 폰에서 칸 안에 글 자리가 남는가** (2026-11-19 · 맵시)
//
//   npm run narrow     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 11/19 에 기록 화면에서 **적어둔 무게가 안 보이는 것**을 잡았다. 칸 셋을
// `minmax(0, …fr)` 로 나눠 세웠더니 320px 폰에서 무게 칸이 89px 이고, 그중
// **86px 을 ± 와 여백이 먼저 가져가** 글이 들어갈 자리가 **2.7px** 이었다 —
//
//   320px → 2.7px    360px → 18.1px    390px → 29.7px    430px → 45.1px
//   「22.5」가 드는 데 26.4px · 「100.5」는 33.9px (Barlow tnum 527/1000em · 점 278)
//
// **430 아래 전부**에서 숫자가 잘렸다. 11/18 에 ± 를 42→36 으로 깎은 손은 390 에서
// 0 을 면한 데까지만 고쳤고, 그 아래 폭은 그대로 터져 있었다. 깎을 여백이 애초에
// **2** 뿐이라 깎기로는 닫히지 않는다.
//
// ── 이 자가 **네 폭을 재지 않는** 까닭 ──
//
// 주인이 고른 길(D)은 칸 바닥을 `calc(5ch + 86px)` 로 깔고 **자리가 모자라면
// 브라우저가 줄을 바꾼다** — 폭을 숫자로 가르는 경계가 **한 줄도 없다.** 그러니
// 「320·360·390·430 네 점에서 들어가는가」로는 이 꼴을 검사할 수 없다(브라우저가
// `ch` 로 재는 것을 자가 흉내낼 수 없다). 지켜야 하는 것이 바뀐다 —
//
//   ⑴ `NumberStep` 이 **제 바닥을 스스로 센다** (부르는 쪽에 `86` 을 적게 두지 않는다)
//   ⑵ 그 바닥이 `ch` 로 적혀 있다 (짐작한 px 가 아니다)
//   ⑶ **줄바꿈 통의 칸은 모두 바닥을 깐다** — 하나만 안 깔면 그 칸이 눌린다
//   ⑷ 비율로 나눠 세우는 꼴(`minmax(0, …fr)`)로 되돌아가지 않았다
//   ⑸ 바닥의 자릿수가 **그 칸의 상한을 담는다** ← 정석의 글꼴 조각이 쓰이는 자리
//
// ★ `ch` 는 `tnum` 폭이 아니다 — `1ch` 는 그 글꼴 「0」 의 advance(Barlow 565/1000em
// = 7.91px)이고 그려지는 숫자는 `tabular-nums` 때문에 527(7.378px)이다. 그래서
// **담는 자리는 `ch` 로, 드는 글은 그려지는 폭으로** 단위를 갈라 센다(2026-11-19 · 정석).
// 둘을 같다고 두면 바닥을 **모자라게** 깐다.
//
//   node scripts/check-narrow.cjs --되돌려     일부러 어긋낸 꼴을 먹여 빨개지는지 본다

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const esbuild = require('esbuild');
const L = require('./lib/glyphWidth.cjs');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

/**
 * **바닥을 세는 손이 상수에서 오는가.**
 *
 * ★ 식을 여기 한 자리에 둔다 — 본 검사와 되돌려-FAIL 이 **같은 손**을 부른다
 * (`check-shrink` 의 `cssMoJib` · `check-tap` 의 `폭메움` 과 같은 까닭).
 */
function 바닥손(code) {
  const 벗김 = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return {
    셈이상수다: /export const STEP_CHROME *= *[A-Z_]+ *\* *2 *\+ *[A-Z_]+ *\* *2 *\+ *[A-Z_]+ *\* *2 *\+ *[A-Z_]+/.test(벗김),
    단추가상수를쓴다: /width: BTN_W/.test(벗김),
    틈이상수를쓴다: /gap: GAP/.test(벗김),
    여백이상수를쓴다: /paddingLeft: PAD_X, paddingRight: PAD_X/.test(벗김),
    바닥이ch다: /stepFloor *= *\(\s*chars\s*\) *=> *`calc\(\$\{chars\}ch \+ \$\{STEP_CHROME\}px\)`/.test(벗김),
    맨칸도ch다: /plainFloor *= *\(\s*chars\s*\) *=> *`calc\(\$\{chars\}ch \+/.test(벗김),
    // 자릿수도 상한에서 센다 — `stepFloor(5)` 처럼 손으로 적으면 상한을 올리는 날
    // 바닥만 옛 수로 남는다
    자릿수손이있다: /export const 담을자릿수 *= *\(/.test(벗김),
  };
}

/**
 * **줄바꿈 통과 그 칸들을 모은다.**
 *
 * 통 = `flexWrap: 'wrap'` 인 칸으로, 그 안에 숫자 칸(`NumberStep` 이나
 * `type="number"` 인 맨 칸)이 하나라도 든 것. 그 통의 **직접 자식 전부**가 바닥을
 * 깔아야 한다 — 하나만 안 깔면 그 칸이 다른 칸에 눌려 글 자리를 잃는다.
 *
 * 돌려주는 것 — `{ 통: [...], 칸: [...], 바닥없음: [...], 통아닌것: [...] }`
 */
function 깔림(code, file) {
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });

  const 속성 = (el, 이름) => {
    for (const a of (el.openingElement.attributes || [])) {
      if (a.type !== 'JSXAttribute' || !a.name || a.name.name !== 이름) continue;
      const v = a.value;
      if (!v) return true;
      if (v.type === 'StringLiteral') return v.value;
      if (v.type === 'JSXExpressionContainer') return code.slice(v.expression.start, v.expression.end);
      return null;
    }
    return undefined;
  };
  const 스타일 = (el) => {
    const v = (el.openingElement.attributes || []).find((a) => a.type === 'JSXAttribute'
      && a.name && a.name.name === 'style');
    const out = {};
    if (!v || !v.value || v.value.type !== 'JSXExpressionContainer') return out;
    const e = v.value.expression;
    if (e.type !== 'ObjectExpression') return out;
    for (const p of e.properties) {
      if (p.type !== 'ObjectProperty') continue;
      const k = p.key.name || p.key.value;
      out[k] = p.value.type === 'StringLiteral' || p.value.type === 'NumericLiteral'
        ? p.value.value : code.slice(p.value.start, p.value.end);
    }
    return out;
  };

  const 통 = [];
  const 칸 = [];
  const 바닥없음 = [];
  const 통아닌것 = [];

  const stack = [];
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    const isEl = n.type === 'JSXElement';
    if (isEl) {
      const s = 스타일(n);
      stack.push({ s, line: n.loc.start.line, node: n });
      const 이름 = n.openingElement.name && n.openingElement.name.name;
      const 숫자칸 = 이름 === 'NumberStep' || (이름 === 'input' && 속성(n, 'type') === 'number');
      if (숫자칸) {
        const 곳 = file + ':' + n.loc.start.line;
        // 줄바꿈 통 안인가 — 위로 올라가며 `flexWrap: wrap` 을 찾는다
        const 통자리 = stack.map((x, i) => [x, i]).reverse()
          .find(([x], j) => j > 0 && String(x.s.flexWrap || '') === 'wrap');
        if (!통자리) { 통아닌것.push(곳); }
        else {
          const [통칸, 통i] = 통자리;
          const 통곳 = file + ':' + 통칸.line;
          if (!통.includes(통곳)) 통.push(통곳);
          // 그 통의 **직접 자식**이 바닥을 깔았나
          const 직접자식 = stack[통i + 1];
          const 바닥 = 직접자식 && String(직접자식.s.flexBasis || '');
          칸.push({
            곳,
            파일: file,
            통: 통곳,
            바닥,
            깔렸나: /(stepFloor|plainFloor)\(/.test(바닥),
            // 폭이 박혀 있으면 그 칸은 이미 줄을 바꾼다 — 바닥을 또 깔 까닭이 없다
            폭박힘: /^\d+(px)?$/.test(String(직접자식 && (직접자식.s.width ?? '')))
              || /^[\d.]+ [\d.]+ \d+px$/.test(String(직접자식 && (직접자식.s.flex ?? '')))
              || /\d+px/.test(바닥),
            상한: 속성(n, 'max'),
            걸음: 속성(n, 'step'),
            단추: 이름 === 'NumberStep',
          });
        }
      }
    }
    for (const k of Object.keys(n)) {
      if (['loc', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments'].includes(k)) continue;
      walk(n[k]);
    }
    if (isEl) stack.pop();
  })(ast);

  // ── **바닥을 요구하는 통은 ± 가 든 통이다** ──
  //
  // ± 가 붙은 칸은 86px 을 먼저 가져가므로 글 자리가 음수에 가까워진다 — 그 통의
  // 칸들은 **형제까지 모두** 바닥을 깔아야 한다(하나만 안 깔면 그 칸이 눌린다).
  // ± 가 없는 통(관리자 화면의 날짜·시간·분 줄 같은 것)은 **폭이 박혀 있거나 혼자
  // 줄을 쓰는 꼴**이라 이 류가 안 난다 — 거짓 FAIL 을 깔지 않으려고 가른다
  const 단추통 = new Set(칸.filter((k) => k.단추).map((k) => k.통));
  for (const k of 칸) {
    if (!단추통.has(k.통) || k.깔렸나) continue;
    바닥없음.push(k.곳);
  }
  return { 통: [...단추통], 칸: 칸.filter((k) => 단추통.has(k.통)), 바닥없음, 통아닌것, 모든칸: 칸 };
}

const 화면파일 = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) 화면파일(p, out);
    else if (e.name.endsWith('.jsx')) out.push(p);
  }
  return out;
};

/** 코드를 cjs 로 묶어 **실제로 불러온다** — 식을 정규식으로 흉내내지 않는다 */
function 불러오기(rel, 이름) {
  const tmp = path.join(ROOT, 'node_modules', '.narrow-' + 이름 + '.cjs');
  esbuild.buildSync({
    entryPoints: [path.join(SRC, rel)],
    bundle: true, format: 'cjs', outfile: tmp, platform: 'node',
    external: ['react', 'react-dom', 'react-router-dom', 'zustand', 'axios'],
    logLevel: 'silent',
  });
  const m = require(tmp);
  fs.unlinkSync(tmp);
  return m;
}

// ─────────────────────────────────────────────────────────────
// 되돌려-FAIL — 일부러 어긋낸 꼴을 먹여 **빨개지는지** 본다
// ─────────────────────────────────────────────────────────────
if (process.argv.includes('--되돌려')) {
  console.log('── 되돌려-FAIL: 일부러 어긋낸 꼴을 먹인다 ──');

  const 바름 = `const BTN_W = 36; const GAP = 4; const PAD_X = 2; const BORDER = 2;
export const STEP_CHROME = BTN_W * 2 + GAP * 2 + PAD_X * 2 + BORDER;
export const stepFloor = (chars) => \`calc(\${chars}ch + \${STEP_CHROME}px)\`;
export const plainFloor = (chars) => \`calc(\${chars}ch + \${14 * 2 + BORDER}px)\`;
export const 담을자릿수 = (max, 소수 = 0) => String(max).length + (소수 ? 1 + 소수 : 0);
const btn = { width: BTN_W };
const row = { gap: GAP };
const inp = { paddingLeft: PAD_X, paddingRight: PAD_X };`;
  const 전부참 = {
    셈이상수다: true, 단추가상수를쓴다: true, 틈이상수를쓴다: true, 여백이상수를쓴다: true,
    바닥이ch다: true, 맨칸도ch다: true, 자릿수손이있다: true,
  };
  ok('바른 꼴은 울지 않는다 (거짓 FAIL 막이)', 바닥손(바름), 전부참);
  ok('  바닥에 생수를 박으면 걸린다 (`86` 을 손으로 적은 꼴)',
    바닥손(바름.replace('BTN_W * 2 + GAP * 2 + PAD_X * 2 + BORDER', '86')).셈이상수다, false);
  ok('  바닥을 px 로 적으면 걸린다 (짐작을 베끼는 꼴)',
    바닥손(바름.replace('${chars}ch', '${chars * 8}px')).바닥이ch다, false);
  ok('  단추가 상수를 안 쓰면 걸린다 (바닥과 꼴이 갈린다)',
    바닥손(바름.replace('width: BTN_W', 'width: 36')).단추가상수를쓴다, false);
  ok('  칸 여백이 상수를 안 쓰면 걸린다',
    바닥손(바름.replace('paddingLeft: PAD_X, paddingRight: PAD_X', 'paddingLeft: 2, paddingRight: 2')).여백이상수를쓴다, false);
  ok('  자릿수를 세는 손이 없으면 걸린다',
    바닥손(바름.replace(/export const 담을자릿수[^\n]*\n/, '')).자릿수손이있다, false);
  ok('  주석에만 적혀 있으면 안 센다 (거짓 PASS 막이)',
    바닥손('/* export const STEP_CHROME = BTN_W * 2 + GAP * 2 + PAD_X * 2 + BORDER; */').셈이상수다, false);

  const 깔린꼴 = `const A = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
    <div style={{ flexGrow: 1.35, flexBasis: stepFloor(담을자릿수(WEIGHT_KG_MAX, 1)), minWidth: 0 }}>
      <NumberStep id="w" max={WEIGHT_KG_MAX} step={2.5} />
    </div>
    <div style={{ flexGrow: 0.8, flexBasis: plainFloor(담을자릿수(SETS_MAX)), minWidth: 0 }}>
      <input className="input" type="number" max={SETS_MAX} />
    </div>
  </div>
);`;
  {
    const r = 깔림(깔린꼴, '(되돌려)');
    ok('깔린 꼴은 울지 않는다 (거짓 FAIL 막이)',
      { 통: r.통, 바닥없음: r.바닥없음, 통아닌것: r.통아닌것, 칸수: r.칸.length },
      { 통: ['(되돌려):2'], 바닥없음: [], 통아닌것: [], 칸수: 2 });
    ok('  ± 가 없는 맨 숫자 칸도 센다 (11/19 에 세트가 하마터면 빠질 자리였다)',
      r.칸.map((x) => x.단추), [true, false]);
  }
  ok('  바닥을 안 깔면 걸린다',
    깔림(깔린꼴.replace('flexBasis: stepFloor(담을자릿수(WEIGHT_KG_MAX, 1)), ', ''), '(되돌려)').바닥없음,
    ['(되돌려):4']);
  ok('  바닥을 생수로 깔아도 걸린다 (`calc(5ch + 86px)` 를 손으로 적은 꼴)',
    깔림(깔린꼴.replace('stepFloor(담을자릿수(WEIGHT_KG_MAX, 1))', "'calc(5ch + 86px)'"), '(되돌려)').바닥없음,
    ['(되돌려):4']);
  ok('  통이 줄을 못 바꾸면 걸린다 (`grid` 로 되돌린 꼴)',
    깔림(깔린꼴.replace("display: 'flex', flexWrap: 'wrap', ", "display: 'grid', gridTemplateColumns: '1fr 1fr', "), '(되돌려)').통아닌것,
    ['(되돌려):4', '(되돌려):7']);
  ok('  숫자 칸이 없으면 통도 칸도 비어 있다고 말한다 (모집단 감시)',
    깔림('const A = () => <div />;', '(되돌려)').칸, []);

  // ── 글꼴을 읽는 손도 되돌려 본다 (정석 조각) ──
  ok('  `calc(5ch + 86px)` 을 읽는다', L.바닥식읽기('calc(5ch + 86px)'), { n: 5, m: 86 });
  ok('  `ch` 가 없는 바닥은 안 읽힌다 (px 로만 깐 꼴)', L.바닥식읽기('calc(40px + 86px)'), null);
  ok('  합이 코드에서 온다 (± 둘 · 여백 2 · 테두리 1)',
    L.더할값({ 단추폭: 36, 단추틈: 4, 칸안여백: 2, 테두리: 1 }), 86);
  ok('  ± 가 없는 맨 칸은 여백만 더한다',
    L.더할값({ 단추폭: 36, 단추틈: 4, 칸안여백: 14, 테두리: 1 }, { 단추: 0 }), 30);
  {
    const 다섯 = L.담기나('999.5', 5);
    const 넷 = L.담기나('999.5', 4);
    if (다섯.건너뜀) console.log('     건너뜀 — ' + 다섯.건너뜀);
    else ok('  「999.5」는 5ch 에 담기고 4ch 에는 안 담긴다', [다섯.드나, 넷.드나], [true, false]);
  }

  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────
console.log('── 칸이 제 바닥을 스스로 아는가 ──');
{
  const r = 바닥손(fs.readFileSync(path.join(SRC, 'components', 'NumberStep.jsx'), 'utf8'));
  ok('바닥을 상수에서 센다 (부르는 쪽에 생수를 적게 두지 않는다)', r.셈이상수다, true);
  ok('  그 상수들이 그려지는 자리에 쓰인다',
    [r.단추가상수를쓴다, r.틈이상수를쓴다, r.여백이상수를쓴다], [true, true, true]);
  ok('  글자 자리는 `ch` 로 적는다 (짐작한 px 가 아니다)', [r.바닥이ch다, r.맨칸도ch다], [true, true]);
  ok('  자릿수도 상한에서 세는 손이 있다', r.자릿수손이있다, true);
}

console.log('\n── 줄바꿈 통의 칸이 모두 바닥을 깔았는가 ──');
let 모든칸 = [];
{
  let 통 = [];
  let 바닥없음 = [];
  let 통아닌것 = [];
  const 터진것 = [];
  for (const f of 화면파일(SRC)) {
    const code = fs.readFileSync(f, 'utf8');
    if (!code.includes('<NumberStep') && !code.includes('type="number"')) continue;
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    try {
      const r = 깔림(code, rel);
      통 = 통.concat(r.통);
      모든칸 = 모든칸.concat(r.칸);
      바닥없음 = 바닥없음.concat(r.바닥없음);
      통아닌것 = 통아닌것.concat(r.통아닌것);
    } catch (e) {
      터진것.push(rel + ': ' + e.message.slice(0, 60));
    }
  }
  ok('화면 파일이 전부 파싱됐다', 터진것, []);
  // **셈이 0 이면 통과가 아니다** — 자리를 못 찾은 것일 수 있다
  ok('줄바꿈 통과 그 안의 숫자 칸을 찾았다', [통.length > 0, 모든칸.length > 0], [true, true]);
  console.log('       통 ' + 통.length + '개 · 숫자 칸 ' + 모든칸.length + '곳 — ' + 통.join(' · '));
  ok('통 안의 칸이 모두 바닥을 깔았다 (`flexBasis: stepFloor(n)`)', 바닥없음, []);
  if (바닥없음.length) {
    console.log('       → 감싼 칸에 `flexBasis: stepFloor(담을자릿수(상한))` 을 주세요.');
  }
  // 기록 화면 밖의 숫자 칸(설정·측정 등)은 혼자 한 줄을 쓰는 꼴이라 이 류가 안 난다 —
  // 세는 것만 하고 울지 않는다. 기록 칸이 통에서 빠지면 위의 「찾았다」가 먼저 운다
  if (통아닌것.length) {
    console.log('       (줄바꿈 통 밖의 숫자 칸 ' + 통아닌것.length + '곳 — 혼자 한 줄을 쓰는 자리들이다)');
  }
}

console.log('\n── 그 바닥이 칸의 상한을 담는가 (글꼴에 물어서) ──');
{
  const ns = fs.readFileSync(path.join(SRC, 'components', 'NumberStep.jsx'), 'utf8');
  const 수 = (re, 무엇) => {
    const m = re.exec(ns);
    if (!m) throw new Error('못 읽었다: ' + 무엇 + ' — 자리가 바뀌었으면 이 자를 고치세요');
    return parseFloat(m[1]);
  };
  // 상수는 **그 자리에서** 읽는다. `더할값` 은 읽어 온 것을 받기만 한다
  const c = {
    단추폭: 수(/const BTN_W = (\d+)/, 'BTN_W'),
    단추틈: 수(/const GAP = (\d+)/, 'GAP'),
    칸안여백: 수(/const PAD_X = (\d+)/, 'PAD_X'),
    테두리: 수(/const BORDER = (\d+)/, 'BORDER') / 2,   // 양쪽 합으로 적어둔 값이다
  };
  const 바닥들 = 불러오기('components/NumberStep.jsx', 'floor');
  const limits = 불러오기('data/limits.js', 'limits');

  // ── 바닥 식을 **실제로 재는 손** ──
  //
  // 바닥은 `stepFloor(담을자릿수(WEIGHT_KG_MAX, 1))` 처럼 **상수에서 뽑는다**. 그 안에
  // 쓰인 이름이 그 화면 파일의 모듈 상수일 수도 있어서(`숫자칸자릿수` — ± 칸 둘이
  // 같이 쓰는 자릿수), 모르는 이름이 나오면 **그 파일에서 그 선언을 찾아 먼저 잰다.**
  // 여기서 이름 목록을 베껴 적으면 상수가 하나 늘 때 이 자만 옛 목록을 본다
  const 캐시 = new Map();
  const 재기 = (식글, 파일, 깊이 = 0) => {
    const scope = { ...바닥들, ...limits };
    for (const [k2, v] of 캐시) scope[k2] = v;
    // `default` 같은 **예약어는 인자 이름이 될 수 없다** — 모듈을 불러오면 그 열쇠가
    // 섞여 들어와 `Unexpected token 'default'` 로 터진다. 값을 쓸 일도 없으니 건다
    const 예약 = new Set(['default', 'class', 'function', 'return', 'const', 'let', 'var',
      'new', 'delete', 'typeof', 'instanceof', 'this', 'null', 'true', 'false', 'void',
      'with', 'try', 'catch', 'finally', 'throw', 'import', 'export', 'extends', 'super',
      'yield', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'in', 'of']);
    const 이름들 = Object.keys(scope).filter((n) => !예약.has(n) && /^[^\s(){}[\].,;:'"`+\-*/%!?<>=&|^~\d]/.test(n));
    const 값들 = 이름들.map((k2) => scope[k2]);
    try {
      // eslint-disable-next-line no-new-func
      return new Function(...이름들, 'return (' + 식글 + ');')(...값들);
    } catch (e) {
      const m = /(\S+) is not defined/.exec(e.message);
      if (!m || 깊이 > 5) throw e;
      const 모르는이름 = m[1];
      const code = fs.readFileSync(path.join(ROOT, 파일), 'utf8');
      const 선언 = new RegExp('const ' + 모르는이름 + ' = ([^;\\r\\n]+);').exec(code);
      if (!선언) throw new Error('`' + 모르는이름 + '` 선언을 못 찾았다');
      캐시.set(모르는이름, 재기(선언[1], 파일, 깊이 + 1));
      return 재기(식글, 파일, 깊이 + 1);
    }
  };

  const 꼴틀림 = [];
  const 합틀림 = [];
  const 안담김 = [];
  const 못읽음 = [];
  let 건너뜀 = null;

  for (const k of 모든칸) {
    // 바닥 식을 **실제로 불러** 값을 얻는다 — 식을 두 벌로 두지 않는다
    let 식;
    try {
      식 = 재기(k.바닥, k.파일);
    } catch (e) {
      못읽음.push(k.곳 + ' → ' + k.바닥 + ' (' + e.message.slice(0, 40) + ')');
      continue;
    }
    const r = L.바닥식읽기(식);
    if (!r) { 꼴틀림.push(k.곳 + ' → ' + 식); continue; }
    const 여백 = k.단추 ? c.칸안여백 : 14;   // ± 가 없는 맨 칸은 `.input` 의 14 가 산다
    const 있어야할m = L.더할값({ ...c, 칸안여백: 여백 }, { 단추: k.단추 ? 2 : 0 });
    if (r.m !== 있어야할m) 합틀림.push(k.곳 + ' → ' + r.m + ' (코드 합 ' + 있어야할m + ')');

    // 그 칸이 **가장 크게 받는 글**을 상한에서 짓는다 — 표를 베끼지 않는다
    const 상한 = k.상한 && limits[k.상한] !== undefined ? limits[k.상한] : null;
    if (상한 === null) { 못읽음.push(k.곳 + ' 상한을 못 읽었다 → ' + k.상한); continue; }
    const 소수 = k.걸음 !== undefined && k.걸음 !== null && !Number.isInteger(Number(k.걸음));
    const 글 = String(상한) + (소수 ? '.5' : '');
    const d = L.담기나(글, r.n);
    if (d.건너뜀) { 건너뜀 = d.건너뜀; continue; }
    if (!d.드나) 안담김.push(k.곳 + ' 「' + 글 + '」 ' + d.필요 + ' > ' + d.있는것);
    else {
      console.log('     ' + k.곳 + ' — ' + 식 + ' · 「' + 글 + '」 ' + d.필요
        + 'px ≤ ' + d.있는것 + 'px (여유 ' + d.여유 + ')');
    }
  }

  ok('바닥 식을 불러 값을 얻었다', 못읽음, []);
  ok('  바닥이 `calc(<n>ch + <m>px)` 꼴이다', 꼴틀림, []);
  ok('  그 `m` 이 코드에서 읽은 합과 같다', 합틀림, []);
  if (건너뜀) {
    console.log('     건너뜀 — ' + 건너뜀);
    console.log('       (`담기나` 는 python fontTools 로 woff2 를 연다 · 파이썬 '
      + (L.파이썬있나() ? '있음' : '없음') + ')');
  } else {
    ok('  자릿수가 그 칸의 **상한**을 담는다 (`ch` 는 「0」 폭 · 드는 글은 `tnum` 폭)', 안담김, []);
  }
}

console.log('\n── 폭을 숫자로 가르는 줄로 되돌아가지 않았나 ──');
{
  // `minmax(0, …fr)` 로 칸을 나눠 세우는 꼴이 **기록 화면에** 돌아오면 이 류가 다시 난다
  const tp = fs.readFileSync(path.join(SRC, 'pages', 'TrainPage.jsx'), 'utf8');
  const 벗김 = tp.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const 나눠세움 = [...벗김.matchAll(/gridTemplateColumns: '[^']*minmax\(0, *[\d.]+fr\)[^']*'/g)].map((m) => m[0]);
  ok('기록 화면이 칸을 비율로 나눠 세우지 않는다', 나눠세움, []);
  if (나눠세움.length) {
    console.log('       → 320px 폰에서 한 칸이 89px 이 되고 글 자리가 2.7px 로 남습니다.');
  }
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
