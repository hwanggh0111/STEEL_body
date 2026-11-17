// **말줄임이 실제로 드는가** — 적어만 두고 안 듣는 `textOverflow: 'ellipsis'` 를 막는다
// (2026-11-17 · 맵시)
//
//   npm run shrink     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 11/16 에 `frontend/src` 를 읽기만으로 훑다가 **말줄임이 안 드는 자리 셋**을 잡았다
// (`31f7919`) — `home/TodayCard.jsx` 둘(홈 화면의 루틴 이름이 「진행 중」 꼬리표를
// 밀어내고 카드를 넘어갔다) · `RestBar.jsx`(운동 중 바닥 띠에서 긴 종목 이름이
// 삐져나갔다). 까닭은 하나다 —
//
//   **가로 flex 자식의 `min-width` 기본값은 `auto` 다.** 글 길이 아래로 안 줄어든다.
//   그래서 `overflow: hidden` · `textOverflow: ellipsis` · `whiteSpace: nowrap` 을
//   셋 다 적어둬도 **칸이 글만큼 넓어져** 말줄임이 영영 안 걸린다. `minWidth: 0`
//   을 같이 적어야 그때부터 줄어들고 점셋이 뜬다.
//
// 그 셋을 고쳐놓고 보니 **이 류를 지키는 자가 앱에 하나도 없었다** — `textOverflow`
// 를 들여다보는 검사가 0개였다. 자가 없으면 다음에 말줄임을 적는 사람이 같은 자리에
// 또 빠뜨리고, **빠진 것은 눈으로만 보인다**(긴 이름을 넣어 봐야 보인다).
//
// ── 무엇을 보는가 ──
//
// `@babel/parser` 로 JSX 를 **실제로 파싱한다.** 들여쓰기나 글자 맞대기로는 어느
// 칸이 어느 칸의 자식인지 알 수 없고, 그것을 모르면 이 류를 셀 수 없다.
//
//   ⑴ **말줄임을 적었으면 `overflow: hidden` 과 한 줄 규칙도 같이 있다.**
//      `textOverflow` 혼자서는 아무 일도 안 한다
//   ⑵ **가로 flex 안의 말줄임 칸은 `minWidth: 0` 을 든다.** 말줄임 칸이 flex 통의
//      직접 자식이 아니면 **그 사이의 직접 자식**이 들어야 한다 — 거기서 막히면
//      아래로 아무리 적어도 안 줄어든다
//
// flex 통인지는 `style` 의 `display: 'flex'` 로 보고, **클래스로 flex 가 되는 것은
// `globals.css` 에서 읽는다** — 여기 베껴 적으면 클래스가 하나 늘 때 자만 옛 목록을
// 본다(11/16 의 「자가 지금을 베끼면 거짓이 된다」 류). `flexDirection: 'column'` 인
// 통은 세로라 이 류가 안 난다(세로 축에서는 `min-height` 가 걸린다).
//
// 볼 것이 없으면 **PASS 가 아니라 FAIL** 이다 — 파서가 깨지거나 자리를 못 찾았을 때
// 조용히 통과하면 이 자가 장식이 된다.
//
//   node scripts/check-shrink.cjs --되돌려     일부러 어긋낸 꼴 다섯을 먹여 빨개지는지 본다

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

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
 * **이 자가 못 보는 자리가 CSS 에 생겼나.**
 *
 * 돌려주는 것 — `{ 말줄임: [...], 동그라미: [...] }` (둘 다 비어 있어야 한다)
 *
 * ★ **식을 여기 한 자리에 둔다.** 본 검사와 되돌려-FAIL 이 **같은 손을 부른다** —
 * 되돌려가 제 안에 식을 또 적으면, 식을 넓히는 날 **되돌려만 옛 식을 본다.**
 * 2026-11-17 에 정석이 `check-typedfield` 에서 실제로 그 꼴을 밟았다(본 검사를
 * 넓혔는데 새로 박은 되돌려 꼴 둘이 안 걸렸다 — 되돌려가 `name` 만 보는 식을
 * 베껴 적고 있었다). **자 안에서 일어난 「자가 「지금」을 베끼면 거짓이 된다」**다.
 */
function cssMoJib(cssRaw) {
  const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, '');
  const 말줄임 = [...css.matchAll(/text-overflow:\s*ellipsis|-webkit-line-clamp/g)].map((m) => m[0]);
  // 크기가 박힌 동그라미가 CSS 에 생기면 그것도 flex 자식일 수 있다.
  // `position: absolute|fixed` 인 것은 flex 자식이 아니라 눌리지 않는다
  // (`.finish-mote` — 금가루 다섯 알이 그 꼴이다)
  const 동그라미 = [];
  for (const m of css.matchAll(/([.#][\w-]+)\s*\{([^}]*)\}/g)) {
    if (!/border-radius:\s*50%/.test(m[2])) continue;
    if (/position:\s*(absolute|fixed)/.test(m[2])) continue;
    동그라미.push(m[1]);
  }
  return { 말줄임, 동그라미 };
}

// ── 클래스로 가로 flex 가 되는 것을 `globals.css` 에서 읽는다 ──
function flex클래스(cssText) {
  const out = new Set();
  // `.이름 { … }` 덩이를 훑는다. 여러 이름을 콤마로 묶은 것도 같이 받는다
  const re = /([.#][\w-]+(?:\s*,\s*[.#][\w-]+)*)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(cssText))) {
    const body = m[2];
    if (!/display\s*:\s*(inline-)?flex/.test(body)) continue;
    if (/flex-direction\s*:\s*column/.test(body)) continue;
    for (const sel of m[1].split(',')) {
      const name = sel.trim();
      if (name.startsWith('.')) out.add(name.slice(1));
    }
  }
  return out;
}

// ── 한 파일을 파싱해 말줄임 자리를 모은다 ──
//
// 돌려주는 것: { file, line, 빠진것: [...] }
function 훑기(code, file, 가로클래스) {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx'],
    errorRecovery: false,
  });

  const 결과 = [];

  // `style={{ … }}` 에서 **글자로 적은 값만** 꺼낸다. 변수·삼항은 값을 모르니
  // `null` 로 둔다 — 모르는 것을 「없다」로 읽으면 거짓 FAIL 이 난다
  function 스타일(el) {
    const attrs = el.openingElement ? el.openingElement.attributes : [];
    const out = { 있나: false, 값: {}, 모름: new Set(), 퍼짐: false };
    for (const a of attrs) {
      if (a.type !== 'JSXAttribute' || !a.name || a.name.name !== 'style') continue;
      const v = a.value;
      if (!v || v.type !== 'JSXExpressionContainer') continue;
      const e = v.expression;
      if (e.type !== 'ObjectExpression') { out.퍼짐 = true; out.있나 = true; continue; }
      out.있나 = true;
      for (const p of e.properties) {
        if (p.type === 'SpreadElement') { out.퍼짐 = true; continue; }
        if (p.type !== 'ObjectProperty') continue;
        const k = p.key.name || p.key.value;
        const val = p.value;
        if (val.type === 'StringLiteral') out.값[k] = val.value;
        else if (val.type === 'NumericLiteral') out.값[k] = val.value;
        else out.모름.add(k);
      }
    }
    return out;
  }

  function 클래스(el) {
    const attrs = el.openingElement ? el.openingElement.attributes : [];
    for (const a of attrs) {
      if (a.type !== 'JSXAttribute' || !a.name || a.name.name !== 'className') continue;
      if (a.value && a.value.type === 'StringLiteral') return a.value.value.split(/\s+/);
    }
    return [];
  }

  const 가로flex통 = (s, cls) => {
    if (cls.some((c) => 가로클래스.has(c))) {
      // 클래스가 flex 인데 `style` 로 세로로 돌려놨으면 세로다
      return s.값.flexDirection !== 'column';
    }
    if (s.값.display !== 'flex') return false;
    if (s.값.flexDirection === 'column') return false;
    // `flexDirection` 이 변수면 모른다 — 가로일 수 있으니 **보는 쪽**으로 둔다
    return true;
  };

  // `maxWidth` · `width` 를 **글자로** 박아두면 `minWidth: 0` 이 없어도 든다.
  // flexbox 명세(§4.5)가 「자동 최소 크기는 **최대 크기로 깎인다**」고 못박아 뒀다 —
  // 그래서 `maxWidth: 90` 인 칸은 글이 길어도 90 에서 멈추고 점셋이 뜬다.
  // 11/17 에 이 자를 처음 돌렸을 때 `Layout.jsx:581`(머리띠의 **닉네임** · `maxWidth: 90`)
  // 을 「안 든다」고 울었는데 **거짓 FAIL** 이었다. 변수로 넣은 `maxWidth` 는 값이
  // 비어 있을 수도 있으니 **안 센다** — 둘 중 하나를 골라야 하면 우는 쪽이다
  const 폭이박혔나 = (s) => ['maxWidth', 'width'].some((k) => {
    const v = s.값[k];
    return typeof v === 'number' ? v > 0 : typeof v === 'string' && /^[\d.]+(px|%|ch|em|rem|vw)?$/.test(v);
  });

  const 줄어들수있나 = (s) => s.값.minWidth === 0 || s.값.minWidth === '0'
    || s.값.minWidth === '0px' || s.모름.has('minWidth') || s.퍼짐
    || 폭이박혔나(s)
    // `flexBasis: 0` · `flex: '1 1 0'` 도 같은 일을 한다
    || s.값.flexBasis === 0 || /\b0(px)?\s*$/.test(String(s.값.flex || ''))
    || s.모름.has('flex') || s.모름.has('flexBasis')
    // 아예 flex 자식이 아니게 띄워놓은 것
    || s.값.position === 'absolute' || s.값.position === 'fixed';

  // **눌리지 않게 박아뒀나.** `flexShrink: 0` 이거나 `flex` 의 둘째 값이 0 이거나,
  // 아예 flex 자식이 아니게 띄워놓은 것. 변수로 넣은 것은 **센다** — 여기서는
  // 「모르면 안 울린다」가 맞다(동그라미는 셈이 아니라 꼴이고, 거짓 FAIL 이 스무
  // 자리에 깔리면 자를 아무도 안 본다)
  const 안줄어드나 = (s) => s.값.flexShrink === 0 || s.값.flexShrink === '0'
    || s.모름.has('flexShrink') || s.퍼짐
    || /^0\s+0\b/.test(String(s.값.flex || '')) || s.모름.has('flex')
    || s.값.position === 'absolute' || s.값.position === 'fixed';

  // 조상 줄기를 들고 내려간다
  const stack = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const isEl = node.type === 'JSXElement';
    if (isEl) {
      const s = 스타일(node);
      const cls = 클래스(node);
      stack.push({ node, s, cls, line: node.loc.start.line });

      if (s.값.textOverflow === 'ellipsis') {
        const 빠진것 = [];

        // ⑴ 혼자서는 안 듣는다 — `overflow: hidden` 과 한 줄 규칙
        const 넘침숨김 = s.값.overflow === 'hidden' || s.값.overflowX === 'hidden'
          || s.모름.has('overflow') || s.퍼짐;
        if (!넘침숨김) 빠진것.push('overflow:hidden');
        const 한줄 = s.값.whiteSpace === 'nowrap' || s.모름.has('whiteSpace')
          || s.값.WebkitLineClamp !== undefined || s.모름.has('WebkitLineClamp')
          || s.퍼짐;
        if (!한줄) 빠진것.push('whiteSpace:nowrap');

        // ⑵ 가로 flex 안이면 **flex 통의 직접 자식**이 줄어들 수 있어야 한다
        for (let i = stack.length - 2; i >= 0; i -= 1) {
          const 조상 = stack[i];
          if (!가로flex통(조상.s, 조상.cls)) continue;
          // 그 통의 직접 자식은 바로 아래 칸이다
          const 직접자식 = stack[i + 1];
          const 사이 = stack.slice(i + 1);
          if (!줄어들수있나(직접자식.s) && !사이.some((x) => 줄어들수있나(x.s))) {
            빠진것.push('minWidth:0@' + 직접자식.line);
          }
          break; // 가장 가까운 가로 flex 통 하나만 본다
        }

        결과.push({ file, line: node.loc.start.line, 빠진것, 류: '말줄임' });
      }

      // ── ⑶ **크기가 박힌 동그라미는 눌리면 달걀이 된다** ── (2026-11-17 · 맵시)
      //
      // 같은 뿌리의 반대쪽이다. 말줄임은 「줄어들어야 하는데 안 줄어든다」이고
      // 이쪽은 「**줄어들면 안 되는데 줄어든다**」다 — flex 자식의 `flex-shrink`
      // 기본값이 **1** 이라 자리가 빠듯하면 폭만 눌린다. 높이는 `height` 로 묶여
      // 있으니 `border-radius: 50%` 가 **달걀**이 되고, 그것은 바로 눈에 보인다.
      // 머리띠의 프로필 동그라미(`Layout.jsx`)가 그 꼴이었다.
      //
      // 글이 드는 칸 옆에 선 작은 점(`width: 6`)도 같다 — 글이 길어지는 날에
      // 점이 **타원**이 된다. `flexShrink: 0` 한 줄이면 영영 안 난다.
      const 동그라미 = s.값.borderRadius === '50%';
      const 크기박힘 = typeof s.값.width === 'number' && s.값.width === s.값.height;
      if (동그라미 && 크기박힘) {
        const 빠진것 = [];
        for (let i = stack.length - 2; i >= 0; i -= 1) {
          const 조상 = stack[i];
          if (!가로flex통(조상.s, 조상.cls)) continue;
          const 직접자식 = stack[i + 1];
          if (!안줄어드나(직접자식.s)) 빠진것.push('flexShrink:0@' + 직접자식.line);
          break; // 가장 가까운 가로 flex 통 하나만 본다
        }
        if (빠진것.length) 결과.push({ file, line: node.loc.start.line, 빠진것, 류: '동그라미' });
      }
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments'
        || k === 'trailingComments' || k === 'innerComments') continue;
      walk(node[k]);
    }
    if (isEl) stack.pop();
  }
  walk(ast);
  return 결과;
}

function 파일들(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...파일들(p));
    else if (e.name.endsWith('.jsx')) out.push(p);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// 되돌려-FAIL — 일부러 어긋낸 꼴을 먹여 **빨개지는지** 본다
// ─────────────────────────────────────────────────────────────
const 되돌려꼴 = [
  {
    이름: '가로 flex 자식인데 `minWidth: 0` 이 없다',
    code: `const A = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    <span style={{ flexShrink: 0 }}>진행 중</span>
  </div>
);`,
    기대: ['minWidth:0'],
  },
  {
    이름: '한 칸 건너 있어도 **직접 자식**이 막으면 안 든다',
    code: `const A = () => (
  <div style={{ display: 'flex' }}>
    <div style={{ padding: 4 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </div>
  </div>
);`,
    기대: ['minWidth:0'],
  },
  {
    이름: '`overflow: hidden` 이 없으면 점셋이 안 뜬다',
    code: `const A = () => (
  <div style={{ minWidth: 0, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
);`,
    기대: ['overflow:hidden'],
  },
  {
    이름: '`whiteSpace: nowrap` 이 없으면 줄만 바뀐다',
    code: `const A = () => (
  <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
);`,
    기대: ['whiteSpace:nowrap'],
  },
  {
    이름: '바른 꼴은 울지 않는다 (거짓 FAIL 막이)',
    code: `const A = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <div style={{ minWidth: 0, flexGrow: 1 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </div>
  </div>
);`,
    기대: [],
  },
  {
    이름: '`maxWidth` 가 박혀 있으면 든다 (거짓 FAIL 막이 · 11/17 에 실제로 울었다)',
    code: `const A = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nickname}</span>
    <span style={{ flexShrink: 0 }}>관리자</span>
  </div>
);`,
    기대: [],
  },
  {
    이름: '`maxWidth` 가 변수면 안 센다 (값이 비어 있을 수 있다)',
    code: `const A = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <span style={{ maxWidth: cap, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
  </div>
);`,
    기대: ['minWidth:0'],
  },
  {
    이름: '세로 flex 는 이 류가 안 난다 (거짓 FAIL 막이)',
    code: `const A = () => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
  </div>
);`,
    기대: [],
  },
  {
    이름: '글 옆에 선 동그라미가 `flexShrink: 0` 을 안 들었다',
    code: `const A = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--info)' }} />
    <span>{긴글}</span>
  </div>
);`,
    기대: ['flexShrink:0'],
  },
  {
    이름: '`flexShrink: 0` 을 들었으면 울지 않는다 (거짓 FAIL 막이)',
    code: `const A = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%' }} />
    <span>{긴글}</span>
  </div>
);`,
    기대: [],
  },
  {
    이름: '세로로 쌓은 동그라미는 눌리지 않는다 (거짓 FAIL 막이)',
    code: `const A = () => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%' }} />
  </div>
);`,
    기대: [],
  },
];

if (process.argv.includes('--되돌려')) {
  console.log('── 되돌려-FAIL: 일부러 어긋낸 꼴을 먹인다 ──');
  const 가로클래스 = flex클래스(fs.readFileSync(path.join(SRC, 'styles', 'globals.css'), 'utf8'));
  for (const t of 되돌려꼴) {
    const r = 훑기(t.code, '(되돌려)', 가로클래스);
    const 난것 = r.flatMap((x) => x.빠진것).map((s) => s.replace(/@\d+$/, ''));
    ok(t.이름, 난것, t.기대);
  }

  // ── 모집단 자도 되돌려 본다 ── **본 검사와 같은 손**(`cssMoJib`)에 먹인다
  ok('CSS 에 말줄임 클래스가 생기면 걸린다 (내가 안 보는 자리다)',
    cssMoJib('.cut { overflow: hidden; text-overflow: ellipsis; }').말줄임,
    ['text-overflow: ellipsis']);
  ok('  CSS 에 뜨지 않은 동그라미가 생기면 걸린다',
    cssMoJib('.dot { width: 6px; height: 6px; border-radius: 50%; }').동그라미, ['.dot']);
  ok('  떠 있는 동그라미는 안 걸린다 (거짓 FAIL 막이 · 금가루)',
    cssMoJib('.finish-mote { position: absolute; border-radius: 50%; }').동그라미, []);
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────
console.log('── 말줄임이 실제로 드는가 ──');

const cssPath = path.join(SRC, 'styles', 'globals.css');
const 가로클래스 = flex클래스(fs.readFileSync(cssPath, 'utf8'));
ok('가로 flex 클래스를 `globals.css` 에서 읽었다', 가로클래스.size > 0, true);
console.log('       ' + [...가로클래스].join(' '));

const files = 파일들(SRC);
ok('볼 화면 파일이 있다', files.length > 0, true);

let 터진파일 = [];
let 모두 = [];
for (const f of files) {
  try {
    모두.push(...훑기(fs.readFileSync(f, 'utf8'), path.relative(ROOT, f).replace(/\\/g, '/'), 가로클래스));
  } catch (e) {
    터진파일.push(path.relative(ROOT, f).replace(/\\/g, '/') + ': ' + e.message.slice(0, 60));
  }
}
ok('모든 화면 파일이 파싱됐다', 터진파일, []);

const 말줄임 = 모두.filter((r) => r.류 === '말줄임');
const 동그라미 = 모두.filter((r) => r.류 === '동그라미');

// **볼 것이 없으면 PASS 가 아니다** — 파서가 자리를 못 찾은 것일 수 있다
ok('말줄임을 적은 자리를 찾았다', 말줄임.length > 0, true);
console.log('       말줄임 자리 ' + 말줄임.length + '곳');

const 안드는것 = 말줄임.filter((r) => r.빠진것.length);
ok('적어둔 말줄임이 **전부** 실제로 든다', 안드는것.map((r) => r.file + ':' + r.line), []);
if (안드는것.length) {
  console.log('       안 드는 자리:');
  for (const r of 안드는것) {
    console.log('         ' + r.file + ':' + r.line + '  빠진 것 → ' + r.빠진것.join(' · '));
  }
  console.log('       → 가로 flex 자식에는 `minWidth: 0` 을 같이 적으세요.');
  console.log('         `min-width` 기본값이 `auto` 라 글 길이 아래로 안 줄어듭니다.');
}

// ── ★ **내가 못 보는 모집단이 생겼나** ── (2026-11-17 · 정석의 지적을 받아 세웠다)
//
// 이 자는 **인라인 `style={{…}}` 만** 본다. 이 앱의 꼴은 거의 다 인라인이라
// 지금은 그것으로 전수가 되는데, **CSS 클래스로 말줄임을 걸기 시작하면 그 자리를
// 아예 안 본다.** 그러면 「적어둔 말줄임이 전부 든다 → []」가 **셈이 작아서 참**이
// 된다 — 아무것도 안 봤는데 말이 통과와 같다.
//
// 오늘 정석이 `check-typedfield` 에서 같은 꼴을 잡았다(아이디 칸을 셋 중 하나만
// 셌다). 그래서 **못 보는 자리가 생기면 자가 울게** 둔다 — 그날 자를 넓히면 된다.
console.log('\n── 내가 못 보는 자리가 생겼나 ──');
{
  const r = cssMoJib(fs.readFileSync(cssPath, 'utf8'));
  ok('CSS 에 말줄임이 없다 (이 자는 인라인 `style` 만 본다)', r.말줄임, []);
  ok('  CSS 의 동그라미는 flex 자식이 아니다 (떠 있는 것만 있다)', r.동그라미, []);
}

console.log('\n── 눌려서 달걀이 되는 동그라미가 없는가 ──');
ok('크기가 박힌 동그라미는 가로 flex 안에서 `flexShrink: 0` 을 든다',
  동그라미.map((r) => r.file + ':' + r.line), []);
if (동그라미.length) {
  console.log('       눌릴 수 있는 자리:');
  for (const r of 동그라미) console.log('         ' + r.file + ':' + r.line);
  console.log('       → `flexShrink: 0` 을 적으세요. `flex-shrink` 기본값이 **1** 이라');
  console.log('         자리가 빠듯하면 폭만 눌리고 높이는 그대로여서 **달걀**이 됩니다.');
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
