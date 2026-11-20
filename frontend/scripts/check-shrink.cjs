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
//   ⑶ **크기가 박힌 동그라미는 가로 flex 안에서 `flexShrink: 0` 을 든다** (11/17)
//   ⑷ **글이 든 칸을 `height` 와 px 줄 높이로 묶지 않는다** (11/18) — 폰에서 글자를
//      크게 쓰면 글자만 자라 잘리거나 옆을 덮는다
//   ⑸ **크기를 박은 44 미만 단추는 표를 든다** (11/18·11/19) — 폰은 높이만 44 로 키운다
//   ⑹ **단축 `font` 가 앞에 적은 글자 크기를 지우지 않는다** (11/19)
//   ⑺ **화면을 덮는 칸은 넘치면 스크롤한다** (11/20) — 가운데로만 맞춘 덮개는 글자를
//      키우면 위아래가 같이 잘리고 **스크롤도 안 돼** 잘린 것에 영영 못 닿는다.
//      그 자리에서 사라지는 것이 **앞으로 가는 단추**라 꾸밈이 아니라 막힘이다.
//      ★ 이 류를 지키는 자가 11/20 에 **두 벌로 갈라질 뻔했다**(맵시가 `check-layer`
//      에 같은 묶음을 짓고 있었다). 한 벌로 합치면서 저쪽의 **`안쪽상자` 갈래**를
//      이리로 옮겨 왔다 — 덮개 검사는 **여기 하나다.** 저쪽의 **까닭 목록은 안 옮겼다**
//      (정석 판정 · 그 목록이 큰 스플래시를 거짓으로 빼준 자리를 그날 봤다).
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
  // `height` 와 `line-height` 를 둘 다 px 로 박은 클래스 — 인라인 ⑷ 와 같은 류인데
  // 이 자는 클래스 안의 글을 못 본다. 생기면 자를 넓히라고 운다 (2026-11-18)
  const 글묶음 = [];
  for (const m of css.matchAll(/([.#][\w-]+)\s*\{([^}]*)\}/g)) {
    if (/(^|[;\s{])height:\s*[\d.]+px/.test(m[2]) && /line-height:\s*[\d.]+px/.test(m[2])) 글묶음.push(m[1]);
  }
  // ── **떠 있는 칸이 한 줄로 늘어나 화면을 넘는가** ── (2026-11-19 · 맵시)
  //
  // `position: fixed` 로 띄운 칸이 `white-space: nowrap` 인데 **상한이 없으면**, 글이
  // 길어지는 날 화면 밖으로 나간다. 가운데 맞춤(`translateX(-50%)`)이면 **양쪽이 다**
  // 잘려 가운데 토막만 보인다. 토스트가 그 꼴이었다 — 앱의 알림 글은 길고(240곳 중
  // 「한 번에 50,000줄까지…기간을 나눠 넣어주세요」는 600px 쯤이다) 320px 폰에서
  // 좌우로 140px 씩 삐져나갔다. **왜 안 됐는지 말하려고 띄운 알림이 그 말을 못 한다.**
  //
  // 11/11 에 같은 고침이 `.toast-action`(되돌리기 단추가 붙은 꼴) **한 자리에만**
  // 들어가 있었다 — 집안에 꼴이 이미 있는데 한 자리만 고쳐진 그 모양이다.
  const 떠서잘림 = [];
  for (const m of css.matchAll(/([.#][\w-]+(?:\s*,\s*[.#][\w-]+)*)\s*\{([^}]*)\}/g)) {
    const body = m[2];
    if (!/position:\s*fixed/.test(body)) continue;
    if (!/white-space:\s*nowrap/.test(body)) continue;
    if (/max-width:/.test(body)) continue;
    for (const sel of m[1].split(',')) 떠서잘림.push(sel.trim());
  }

  // `body` 가 한글을 **띄어쓰기에서만** 끊나 (2026-11-18) — 빠지면 「생깁 / 니다」로
  // 돌아간다. 브라우저 없이는 끊긴 자리를 셀 수 없어 **그 한 줄을 지킨다**
  const body = /(^|\})\s*body\s*\{([^}]*)\}/.exec(css);
  const 낱말 = {
    keepAll: !!body && /word-break:\s*keep-all/.test(body[2]),
    받침: !!body && /overflow-wrap:\s*(break-word|anywhere)/.test(body[2]),
  };
  return { 말줄임, 동그라미, 글묶음, 떠서잘림, 낱말 };
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
    const out = { 있나: false, 값: {}, 모름: new Set(), 퍼짐: false, 순서: [] };
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
        out.순서.push(k);
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

  // **이 칸에 글이 직접 드는가.** `{…}` 은 값을 모르니 글일 수 있는 것은 **센다** —
  // `.map(…)` 이나 JSX 만 내는 식은 요소를 그리는 것이라 글이 아니다
  // (막대 그래프 · 로고 단추가 그 꼴이다)
  const 글식 = (e) => {
    if (!e) return false;
    switch (e.type) {
      case 'JSXElement': case 'JSXFragment': case 'JSXEmptyExpression': return false;
      case 'StringLiteral': return e.value.trim() !== '';
      case 'ConditionalExpression': return 글식(e.consequent) || 글식(e.alternate);
      case 'LogicalExpression': return 글식(e.right);
      case 'CallExpression':
        return !(e.callee.type === 'MemberExpression' && e.callee.property.name === 'map');
      default: return true;
    }
  };
  const 글이드나 = (el) => (el.children || []).some((c) => (c.type === 'JSXText' ? c.value.trim() !== ''
    : c.type === 'JSXExpressionContainer' && 글식(c.expression)));

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

      // ── ⑷ **글이 든 칸을 `height` 와 px 줄 높이로 묶었다** ── (2026-11-18 · 맵시)
      //
      // 크롬(안드로이드)·앱 안 웹뷰의 「글자 크기」는 `px` 로 적은 `fontSize` 도
      // 키운다. 칸이 `height` 에 묶여 있고 줄 높이까지 `'16px'` 로 박혀 있으면
      // **글자만 자라고 칸과 줄은 그대로**라 글이 잘리거나 옆 칸을 덮는다.
      // 11/17 에 손으로 둘을 풀었는데(`8638e86` · 탭바 딱지와 잠금 자판) 이 류를
      // 지키는 자가 없었고, 11/18 에 셋째(`LineChart` 의 짚은 값)가 그대로 있었다 —
      // 그날 셈에서는 글이 `{hoverText(…)}` 로 들어와 **눈으로 글자리로 안 읽혔다.**
      //
      // 줄 높이를 `px` 로 박는 것은 **묶인 칸 안에서 글을 세로로 맞출 때뿐**이라
      // 그 셋이 겹치면 이 류다. `height` 만 박고 글자 한둘을 flex 로 가운데 앉힌
      // 동그라미·네모(요일 · 날짜 · 머리글자)는 글자가 커져도 **잘리지 않고 고르게
      // 넘친다** — 그것은 안 센다. 값이 변수인 `height` 는 막대 그래프 같은 것이라
      // 안 센다(줄 높이까지 변수로 박는 자리는 없다).
      const 높이박힘 = typeof s.값.height === 'number' || /^[\d.]+px$/.test(String(s.값.height ?? ''));
      const 줄박힘 = /^[\d.]+px$/.test(String(s.값.lineHeight ?? ''));
      if (높이박힘 && 줄박힘 && 글이드나(node)) {
        결과.push({ file, line: node.loc.start.line, 빠진것: ['minHeight'], 류: '글묶음' });
      }

      // ── ⑺ **화면을 덮는 칸이 가운데로만 맞추고 넘침을 안 받았다** ── (2026-11-20 · 맵시)
      //
      // `position: fixed; inset: 0` 으로 화면을 덮고 안을 `justifyContent: 'center'`
      // 로 가운데 맞춘 칸은, **담을 것이 화면보다 커지는 날** 넘침이 위아래로 갈려
      // 잘린다. 그리고 `overflow` 가 없으니 **스크롤도 안 된다** — 잘린 것에 영영
      // 닿을 수가 없다. 글자 크기를 150~200% 로 쓰면 그 날이 바로 온다.
      //
      // 11/20 에 잠금 화면이 그 꼴이었다: 320×568 기본 글자에서 이미 57px 넘쳤고
      // 아래에서 사라지는 것이 **지문 단추**와 **「네 자리를 잊으셨나요」**였다 —
      // 네 자리를 잊은 사람이 **나갈 길을 못 찾는다.** 같은 류를 둘 더 찾았다
      // (`RepCounter` 의 「카메라 켜기」 · `SiteHome` 의 사진 설명). 꾸밈이 아니라
      // **막힘**이라 ⑷ 와 같은 자리에 둔다.
      //
      // ★ 고치는 법은 `overflow` 한 줄이 **아니다.** `justifyContent: 'center'` 와
      // 스크롤을 같이 두면 **위로 넘친 쪽은 스크롤해도 안 닿는다**(flexbox 명세
      // §5.1 의 그 자리 — 넘침이 시작 가장자리 밖으로 나가고 스크롤 자리가 안 생긴다).
      // 가운데 맞춤을 **안쪽 칸의 `margin: auto` 로** 옮겨야 자리가 모자랄 때 0 으로
      // 떨어져 양 끝이 다 닿는다. 그러니 이 자는 **둘을 같이 본다** —
      // 넘침 손이 없으면 울고, `justifyContent: 'center'` 가 남아 있어도 운다.
      //
      // 세로통만 센다(`flexDirection: 'column'`) — 가로로 늘어놓은 것은 이 류가
      // 아니고, `flexDirection` 이 변수인 자리는 **안 센다**(모르는 것을 세로로
      // 읽으면 거짓 FAIL 이 깔린다 · ⑶ 과 같은 판단).
      //
      // ★ **`inset: 0` 이 다 화면을 덮는 것은 아니다.** `position: absolute; inset: 0`
      // 은 **가장 가까운 자리 잡은 조상**을 덮는데, 그 조상이 크기를 적어 둔 통이면
      // (`width: size, height: size`) 덮는 것은 화면이 아니라 **그 통**이다 — 고리
      // 가운데의 숫자가 그 꼴이다(`GoalRing` · `RestTimer`). 거기에 스크롤을 달면
      // 고리 안에서 숫자가 굴러간다. 11/20 에 이 자를 처음 돌렸을 때 그 둘을
      // 울렸고 **거짓 FAIL** 이었다 — 그래서 조상을 보고 가른다.
      const 크기적힘 = (x) => ['width', 'height'].some((k) => x.값[k] !== undefined || x.모름.has(k));
      const 화면을덮나 = () => {
        if (s.값.position === 'fixed') return true;            // 틀이 화면이다
        if (s.값.position !== 'absolute') return false;
        for (let i = stack.length - 2; i >= 0; i -= 1) {
          const a = stack[i];
          const p = a.s.값.position;
          if (p !== 'relative' && p !== 'absolute' && p !== 'fixed' && !a.s.모름.has('position')) continue;
          return !크기적힘(a.s);          // 크기를 적어 둔 통이면 화면이 아니다
        }
        return true;                       // 자리 잡은 조상이 없으면 틀이 화면이다
      };
      const 덮나 = (s.값.inset === 0 || s.값.inset === '0' || s.값.inset === '0px'
        || ((s.값.top === 0 || s.값.top === '0') && (s.값.bottom === 0 || s.값.bottom === '0')))
        && 화면을덮나();
      const flex통 = s.값.display === 'flex';
      const 세로쌓임 = s.값.flexDirection === 'column';
      //
      // **세로로 가운데 맞추는 칸만 센다.** 머리·발을 `flexShrink: 0` 으로 두고
      // 가운데를 `flexGrow: 1; minHeight: 0` 으로 줄이는 통(`OverlayCamera` ·
      // `RepCounter` 의 바깥)은 **넘쳐도 속이 먼저 줄어** 이 류가 안 난다 — 거기까지
      // 울리면 거짓 FAIL 이다(11/20 에 되돌려-FAIL 이 그것을 잡아냈다 · 자를 먼저
      // 좁혔다). 그 통이 **진짜 넘치는지는 재야 알고**, 재는 것은 이 자가 못 한다.
      //
      // 세로로 가운데 맞추는 손은 **쌓는 쪽에 따라 다르다** — 세로로 쌓으면
      // `justifyContent`, 가로로 늘어놓으면 `alignItems` 다. 가로통도 세는 까닭은
      // 덮개의 절반이 **상자 하나를 가운데 앉히는 가로통**이기 때문이다
      // (`AccountBlocked` · `MaintenanceScreen` · `ConfirmModal`). `flexDirection`
      // 이 변수인 자리는 안 센다(모르는 것을 세로로 읽으면 거짓 FAIL 이 깔린다).
      const 세로가운데 = !s.모름.has('flexDirection')
        && (세로쌓임 ? s.값.justifyContent === 'center' : s.값.alignItems === 'center');
      //
      // ★ **안쪽 상자가 넘침을 받으면 겉은 넘칠 수 없다** (2026-11-20 · 맵시의 지적).
      // `maxHeight: '85vh'` + `overflowY: 'auto'` 로 담은 상자를 가운데 앉힌 덮개는
      // 11/16 에 이미 닫힌 자리다 — 담을 것이 85vh 를 못 넘으니 겉이 샐 일이 없다.
      // 맵시가 `check-layer` 에서 같은 자를 짓다가 이 갈래 없이 돌려 **거짓 FAIL
      // 둘**(`AccountBlocked`·`MaintenanceScreen`)을 받았다. 글자로 훑지 않고
      // **직접 자식의 꼴로** 본다.
      //
      // 받는 손이 **그 상자 자신에** 있을 필요는 없다 — `ConfirmModal` 은 상자를
      // `maxHeight: calc(100dvh - 32px)` 로 묶고 **글만** 스크롤한다(제목과 단추가
      // 흘러가면 「확인이 어디 있지」가 되므로 그것이 더 낫다). 그래서 **자손까지**
      // 내려가 받는 손을 찾는다. 그림 한 장은 상한만으로 끝난다 — **안에서 굴릴
      // 것이 없다**(`Layout` 의 사진 확대).
      // ── ★ **`{…}` 안에 든 자식도 자식이다** ── (2026-11-20 · 정석)
      //
      // 처음에는 `node.children` 에서 `JSXElement` 만 집었다. 그런데 앱의 칸 절반은
      // `{live && <div …>}` · `{a ? <X/> : <Y/>}` 꼴로 **조건 안에** 들어 있다 —
      // 그러면 바로 아래 자식이 `JSXExpressionContainer` 라 **눈에 안 보인다.**
      // `RepCounter` 의 바깥 통이 그 꼴이었고(속을 줄이는 `flex: 1; minHeight: 0`
      // 칸이 조건 안에 있었다) 이 자가 **거짓 FAIL** 을 냈다. 조건·삼항·묶음을
      // 걷어내고 **칸만** 모은다.
      const 속칸들 = (el) => {
        const out = [];
        const 쓸어담기 = (x) => {
          if (!x || typeof x !== 'object') return;
          if (x.type === 'JSXElement') { out.push(x); return; }
          if (x.type === 'JSXFragment') { (x.children || []).forEach(쓸어담기); return; }
          if (x.type === 'JSXExpressionContainer') { 쓸어담기(x.expression); return; }
          // 조건(`&&` · `||`) · 삼항 · 괄호만 걷는다. 손으로 부르는 것(`map` 안의
          // 칸 따위)까지 쫓지 않는다 — 거기까지 가면 **남의 칸**을 제 자식으로 센다
          if (x.type === 'LogicalExpression') { 쓸어담기(x.left); 쓸어담기(x.right); return; }
          if (x.type === 'ConditionalExpression') { 쓸어담기(x.consequent); 쓸어담기(x.alternate); return; }
          if (x.type === 'ParenthesizedExpression') { 쓸어담기(x.expression); }
        };
        (el.children || []).forEach(쓸어담기);
        return out;
      };
      const 받는손있나 = (el) => {
        const es = 스타일(el);
        if (['overflow', 'overflowY'].some((k) => es.값[k] !== undefined || es.모름.has(k))) return true;
        const 태그 = el.openingElement.name && el.openingElement.name.name;
        if (태그 === 'img') return true;
        return (el.children || []).some((c) => c.type === 'JSXElement' && 받는손있나(c));
      };
      // 안쪽 상자도 **같은 눈으로** 본다 — 한쪽만 조건을 걷으면 그 쪽만 눈이 밝다
      const 안쪽상자 = 속칸들(node).some((c) => {
        const cs = 스타일(c);
        const 상한 = cs.값.maxHeight !== undefined || cs.모름.has('maxHeight');
        return 상한 && 받는손있나(c);
      });
      // ── ★ **가운데 맞춤이 없어도 아래로 잘린다** ── (2026-11-20 · 정석)
      //
      // 위까지는 **가운데 맞춤인 덮개**만 봤다. 그런데 세로로 쌓기만 한 덮개도
      // 담을 것이 화면보다 커지면 **아래쪽이 잘리고 스크롤이 없으니 못 닿는다** —
      // 넘침이 위아래로 갈리지 않을 뿐이다. 맵시가 `check-layer` 에서 그 과녁을
      // 보고 있었고, 자를 한 벌로 모으기로 판정하면서 **그 구멍을 여기 메운다**.
      //
      // ★ 두 가지는 빼준다 — 둘 다 **넘칠 수 없는 꼴**이다.
      //
      //   ⑴ **속이 먼저 줄어드는 통** — 머리·발을 `flexShrink: 0` 으로 두고 가운데를
      //      `flexGrow: 1; minHeight: 0` 으로 둔 꼴(`OverlayCamera` · `RepCounter`
      //      의 바깥). 자리가 모자라면 **가운데가 줄어** 겉이 안 넘친다
      //   ⑵ **빈 덮개** — 서랍 뒤판처럼 담은 것이 없는 칸은 넘칠 것이 없다
      //
      // 가로로 늘어놓은 덮개는 **여기서도 안 센다.** 가로통의 자식은 기본으로
      // `align-items: stretch` 라 칸이 화면 높이에 맞춰지고, 넘치는 것은 **그 칸
      // 안쪽**이다 — 어느 칸이 받아야 하는지는 이 자가 못 가른다(거짓 FAIL 이 깔린다).
      const 속이줄어드나 = 속칸들(node).some((c) => {
        const cs = 스타일(c);
        const 자람 = cs.값.flexGrow === 1 || cs.값.flex === 1 || /^1/.test(String(cs.값.flex ?? ''))
          || cs.모름.has('flexGrow') || cs.모름.has('flex');
        const 줄어듦 = cs.값.minHeight === 0 || cs.값.minHeight === '0'
          || ['overflow', 'overflowY'].some((k) => cs.값[k] !== undefined || cs.모름.has(k));
        return 자람 && 줄어듦;
      });
      // 담은 것이 있나 — 칸 · 글 · `{…}` 로 끼운 것 아무거나 (빈 덮개는 넘칠 것이 없다)
      const 담을것있나 = (node.children || []).some((c) => {
        if (c.type === 'JSXElement' || c.type === 'JSXFragment') return true;
        if (c.type === 'JSXExpressionContainer') return c.expression.type !== 'JSXEmptyExpression';
        return c.type === 'JSXText' && c.value.trim().length > 0;
      });
      if (덮나 && flex통 && !s.퍼짐) {
        const 빠진것 = [];
        const 넘침손 = ['overflow', 'overflowY'].some((k) => s.값[k] !== undefined || s.모름.has(k));
        if (세로가운데 && !안쪽상자) {
          if (!넘침손) 빠진것.push('overflowY:auto');
          // 넘침 손이 있어도 **가운데 맞춤이 남아 있으면 반만 고친 것**이다.
          // ★ 가로통도 같다 — 처음에는 「가로통은 `alignItems: 'center'` 를 그대로 둬도
          // 된다」고 적었는데 **틀렸다**(11/20 · 그 자리에서 되돌려 돌려보고 알았다).
          // 세로 넘침을 못 닿게 만드는 것은 쌓는 방향이 아니라 **스크롤 통에서 가운데로
          // 맞췄다는 사실** 자체다: `justifyContent` 든 `alignItems` 든 넘친 것을
          // **시작 가장자리 밖**으로 밀어내고 거기에는 스크롤 자리가 안 생긴다
          빠진것.push('margin:auto(안쪽으로)');
        } else if (세로쌓임 && !세로가운데 && !안쪽상자 && !속이줄어드나 && 담을것있나 && !넘침손) {
          // 가운데로 맞추지 않았으니 **아래쪽만** 잘린다 — 가운데 맞춤을 옮길 일은
          // 없고 넘침 손 한 줄이면 된다
          빠진것.push('overflowY:auto(아래로 잘린다)');
        }
        // 어긋난 것이 없어도 **적어 둔다** — 모집단이 0 으로 떨어지면 아래가 운다
        결과.push({ file, line: node.loc.start.line, 빠진것, 류: '덮침' });
      }

      // ── ⑹ **단축 `font` 가 앞에 적은 글자 크기를 지웠다** ── (2026-11-19 · 맵시)
      //
      // 단추의 기본 꼴을 지우려고 `font: 'inherit'` 을 적는다. 그런데 **`font` 는
      // 단축 속성**이라 `font-size`·`font-weight`·`letter-spacing`·`line-height` 를
      // **안 적은 칸까지 되돌린다.** 그래서 `{ fontSize: 11.5, …, font: 'inherit' }`
      // 처럼 **뒤에 오면 그 11.5 가 조용히 사라지고** 상속 크기(15px)로 커진다.
      //
      // 11/19 에 여섯 자리가 그 꼴이었다(전부 `TrainPage` 의 작은 글씨 단추 —
      // 「그만두기」 · 「+ 오른쪽이 다릅니다」 · 「접기」 …). **화면은 멀쩡해 보인다** —
      // 그 글씨가 작아야 한다는 것을 아는 사람만 안다. 뜻이 「글꼴만 상속」이면
      // `fontFamily: 'inherit'` 이 맞다.
      const 단축자리 = s.순서.indexOf('font');
      if (단축자리 >= 0) {
        const 지워지는것 = ['fontSize', 'fontWeight', 'letterSpacing', 'fontFamily', 'lineHeight', 'fontStyle'];
        const 앞에있는것 = s.순서.slice(0, 단축자리).filter((k) => 지워지는것.includes(k));
        if (앞에있는것.length) {
          결과.push({ file, line: node.loc.start.line, 빠진것: 앞에있는것, 류: '글꼴단축' });
        }
      }

      // ── ⑸ **크기를 박은 동그란 단추는 폰에서 달걀이 된다** ── (2026-11-18 · 맵시)
      //
      // 손가락 기기(`pointer: coarse`)에서는 globals.css 가 단추마다 `min-height: 44px`
      // 를 건다 — **높이만**이다. 34×34 동그라미가 34×44 세로 달걀이 됐다(머리띠의
      // 새로고침 · 설정). PC 와 `/dev` 틀에서는 안 보이고 폰에서만 보인다.
      // `tap-round` 를 들면 높이는 두고 안 보이는 테두리로 닿는 자리만 44 로 넓힌다.
      // 44 이상이면 늘어날 것이 없어 안 센다
      const 태그 = node.openingElement.name && node.openingElement.name.name;
      const 역할 = (node.openingElement.attributes || []).find((a) => a.type === 'JSXAttribute'
        && a.name && a.name.name === 'role');
      const 누르는것 = 태그 === 'button' || 태그 === 'summary'
        || (역할 && 역할.value && 역할.value.value === 'button');
      // ── **네모는 폭을 아무도 안 메웠다** ── (2026-11-19 · 맵시)
      //
      // ⑸ 를 처음 세울 때 **둥근 것만** 봤다(`borderRadius`). 그런데 위의 까닭에
      // 둥글기는 아무 상관이 없다 — 폰에서 높이만 44 로 자라는 것은 **크기를 박은
      // 누르는 것 전부**다. 네모는 달걀이 안 되니 **눈에 덜 띄고**, 그래서 더 오래
      // 남았다: 운동 기록 줄의 고치기·지우기가 30×44 로 서 있었고 둘이 `marginLeft: 2`
      // 로 붙어 **지우려다 고치기**가 났다(루틴 줄의 32 는 옆이 「시작」이라 **고치려다
      // 운동이 시작**됐다). 꼴보다 **잘못 눌리는 것**이 먼저다.
      //
      // 그래서 **둥근 조건을 걷는다.** 기대하는 표만 꼴에 따라 가른다 —
      // 동그라미는 `tap-round` · 네모는 `tap-box`(`globals.css` 에서 **같은 손**이다).
      // 폭만 박고 높이를 안 박은 단추도 센다 — 폰에서 높이는 44 로 자라고 **폭은
      // 그대로**라 과녁이 좁다. 글이 드는 단추는 폭이 글만큼 넓어지지만, `width` 를
      // 박아두면 그 값이 실제 폭이다(앱 전체가 `box-sizing: border-box` 다).
      const 둥근 = ['50%', 999, '999px', '9999px'].includes(s.값.borderRadius);
      const 폭박힘 = typeof s.값.width === 'number' && s.값.width < 44;
      // 높이가 변수인 것은 **안 센다** — 모르는 것을 「작다」로 읽으면 거짓 FAIL 이
      // 깔리고, 거짓 FAIL 이 깔린 자는 아무도 안 본다 (⑶ 과 같은 판단)
      const 높이가더크지않다 = !s.모름.has('height')
        && (s.값.height === undefined || (typeof s.값.height === 'number' && s.값.height < 44));
      if (누르는것 && 폭박힘 && 높이가더크지않다
        && !cls.includes('tap-round') && !cls.includes('tap-box') && !cls.includes('tap-tight')) {
        const 표 = 둥근 ? 'tap-round' : 'tap-box';
        결과.push({ file, line: node.loc.start.line, 빠진것: [표], 류: 둥근 ? '달걀단추' : '홀쭉단추' });
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
  {
    이름: '11/17 의 탭바 딱지 꼴 — `height` 와 px 줄 높이에 수가 묶였다',
    code: `const A = () => (
  <span style={{ height: 16, lineHeight: '16px', fontSize: 10, padding: '0 4px' }}>{badge}</span>
);`,
    기대: ['minHeight'],
  },
  {
    이름: '  삼항으로 들어온 글도 글이다 (11/18 의 체크칸 ✓)',
    code: `const A = () => (
  <div style={{ width: 16, height: 16, fontSize: 11, lineHeight: '15px' }}>{on ? '✓' : ''}</div>
);`,
    기대: ['minHeight'],
  },
  {
    이름: '  `minHeight` 와 비율 줄 높이로 풀었으면 울지 않는다 (거짓 FAIL 막이)',
    code: `const A = () => (
  <div style={{ minHeight: 18, fontSize: 11.5, lineHeight: 18 / 11.5 }}>{hoverText(rows)}</div>
);`,
    기대: [],
  },
  {
    이름: '  `.map` 으로 막대를 그리는 칸은 글이 아니다 (거짓 FAIL 막이)',
    code: `const A = () => (
  <div style={{ height: 30, lineHeight: '30px' }}>{bars.map((v) => <span key={v} />)}</div>
);`,
    기대: [],
  },
  {
    // 글묶음(⑷)으로는 안 센다 — 줄 높이를 박지 않았다. 그런데 **누르는 36 동그라미**라
    // 11/18 에 세운 ⑸ 가 운다. 그것이 맞다: 점검 요일이 실제로 이 꼴로 달걀이었다
    이름: '  글자 하나를 flex 로 앉힌 동그라미는 글묶음이 아니다 · 누르는 것이면 달걀로만 운다 (요일)',
    code: `const A = () => (
  <button style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', fontSize: 13 }}>{day}</button>
);`,
    기대: ['tap-round'],
  },
  {
    이름: '11/18 의 새로고침 꼴 — 34 동그라미 단추가 `tap-round` 를 안 들었다',
    code: `const A = () => (
  <button style={{ width: 34, height: 34, borderRadius: 999 }}>↻</button>
);`,
    기대: ['tap-round'],
  },
  {
    이름: '  `tap-round` 를 들었으면 울지 않는다 (거짓 FAIL 막이)',
    code: `const A = () => (
  <button className="tap-round" style={{ width: 34, height: 34, borderRadius: '50%' }}>↻</button>
);`,
    기대: [],
  },
  {
    이름: '  44 이상 동그라미는 늘어날 것이 없다 (거짓 FAIL 막이)',
    code: `const A = () => (
  <button style={{ width: 52, height: 52, borderRadius: '50%' }} />
);`,
    기대: [],
  },
  {
    이름: '  누르지 않는 동그라미는 안 센다 (거짓 FAIL 막이 · 날짜 동그라미)',
    code: `const A = () => (
  <div style={{ width: 32, height: 32, borderRadius: '50%' }}>18</div>
);`,
    기대: [],
  },
  {
    이름: '11/19 의 작은 단추 꼴 — `font: inherit` 이 앞의 `fontSize` 를 지운다',
    code: `const A = () => (
  <button style={{ background: 'none', color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', font: 'inherit' }}>접기</button>
);`,
    기대: ['fontSize'],
  },
  {
    이름: '  `font` 가 먼저면 뒤의 크기가 산다 (거짓 FAIL 막이)',
    code: `const A = () => (
  <button style={{ font: 'inherit', fontSize: 11.5, color: 'var(--text-muted)' }}>접기</button>
);`,
    기대: [],
  },
  {
    이름: '  `fontFamily` 로 적으면 아무것도 안 지운다 (거짓 FAIL 막이)',
    code: `const A = () => (
  <button style={{ fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>접기</button>
);`,
    기대: [],
  },
  {
    이름: '11/19 의 기록 줄 꼴 — 네모 30 단추가 `tap-box` 를 안 들었다 (지우려다 고치기)',
    code: `const A = () => (
  <button aria-label="지우기" style={{ width: 30, height: 30, flexShrink: 0, padding: 0 }}>
    <svg width="15" height="15" />
  </button>
);`,
    기대: ['tap-box'],
  },
  {
    이름: '  `tap-box` 를 들었으면 울지 않는다 (거짓 FAIL 막이)',
    code: `const A = () => (
  <button className="tap-box" style={{ width: 30, height: 30 }}>
    <svg width="15" height="15" />
  </button>
);`,
    기대: [],
  },
  {
    이름: '  폭만 박고 높이를 안 박은 단추도 센다 (폰에서 높이만 자란다)',
    code: `const A = () => (
  <button style={{ width: 28, padding: 0 }}>×</button>
);`,
    기대: ['tap-box'],
  },
  {
    이름: '  높이가 변수인 것은 안 센다 (거짓 FAIL 막이)',
    code: `const A = () => (
  <button style={{ width: 30, height: barH }}>{v}</button>
);`,
    기대: [],
  },
  {
    이름: '  폭이 44 이상이면 늘어날 것이 없다 (거짓 FAIL 막이)',
    code: `const A = () => (
  <button style={{ width: 48, height: 30 }}>저장</button>
);`,
    기대: [],
  },
  {
    이름: '  일부러 작게 둔 것은 표가 있다 (거짓 FAIL 막이 · `tap-tight`)',
    code: `const A = () => (
  <button className="tap-tight" style={{ width: 20, height: 20 }}>×</button>
);`,
    기대: [],
  },
  // ── ⑺ 덮는 칸의 넘침 (2026-11-20) ──
  {
    이름: '11/20 의 잠금 화면 꼴 — 덮는 칸이 가운데만 맞추고 넘침을 안 받는다',
    code: `const A = () => (
  <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 26, padding: 24 }}>
    <button>지문으로</button>
  </div>
);`,
    기대: ['overflowY:auto', 'margin:auto(안쪽으로)'],
  },
  {
    이름: '  `overflow` 만 붙이고 가운데 맞춤을 남겨두면 **반만 고친 것**이다',
    code: `const A = () => (
  <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
    <button>지문으로</button>
  </div>
);`,
    기대: ['margin:auto(안쪽으로)'],
  },
  {
    이름: '  넘침을 받고 가운데를 안쪽으로 넘기면 안 운다 (고친 꼴)',
    code: `const A = () => (
  <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', overflowY: 'auto', padding: 24 }}>
    <div style={{ margin: 'auto' }}><button>지문으로</button></div>
  </div>
);`,
    기대: [],
  },
  {
    이름: '  머리·발을 나눠 둔 통은 이 류가 아니다 (거짓 FAIL 막이 · 가운데 맞춤 없음)',
    code: `const A = () => (
  <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
    <div style={{ flexShrink: 0 }}>머리</div>
    <div style={{ flexGrow: 1, minHeight: 0 }}>속</div>
  </div>
);`,
    기대: [],
  },
  {
    이름: '  크기를 적어 둔 통 안의 `inset: 0` 은 화면이 아니다 (거짓 FAIL 막이 · 고리 속 숫자)',
    code: `const A = () => (
  <div style={{ position: 'relative', width: size, height: size }}>
    <svg />
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center' }}>{main}</div>
  </div>
);`,
    기대: [],
  },
  {
    이름: '  크기를 안 적은 통 안이면 센다 (11/20 의 「카메라 켜기」 꼴)',
    code: `const A = () => (
  <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center' }}>
      <button>카메라 켜기</button>
    </div>
  </div>
);`,
    기대: ['overflowY:auto', 'margin:auto(안쪽으로)'],
  },
  {
    이름: '  가로통이 `alignItems` 로 세로 가운데를 맞춰도 센다 (스크롤 통에서는 같은 함정)',
    code: `const A = () => (
  <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center' }}>
    <div style={{ maxWidth: 360 }}>긴 알림</div>
  </div>
);`,
    기대: ['overflowY:auto', 'margin:auto(안쪽으로)'],
  },
  {
    이름: '  가로통이 안쪽 상자로 받으면 안 운다 (`maxHeight` + 자손의 `overflowY`)',
    code: `const A = () => (
  <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center' }}>
    <div style={{ maxWidth: 360, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
      <h3>제목</h3>
      <p style={{ overflowY: 'auto', minHeight: 0 }}>{message}</p>
      <button>확인</button>
    </div>
  </div>
);`,
    기대: [],
  },
  {
    이름: '  그림 한 장은 상한만으로 끝난다 (거짓 FAIL 막이 · 사진 확대)',
    code: `const A = () => (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <img src={zoomImg} alt="확대" style={{ maxWidth: '90vw', maxHeight: '85vh' }} />
  </div>
);`,
    기대: [],
  },
  {
    이름: '  가로로 늘어놓기만 한 덮는 칸은 안 센다 (거짓 FAIL 막이 · 세로 가운데 아님)',
    code: `const A = () => (
  <div style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center' }}>
    <span>x</span>
  </div>
);`,
    기대: [],
  },
  {
    이름: '  `top: 0` + `bottom: 0` 으로 적어도 덮는 것으로 본다 (`inset` 만 보면 눈이 먼다)',
    code: `const A = () => (
  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
    <button>켜기</button>
  </div>
);`,
    기대: ['overflowY:auto', 'margin:auto(안쪽으로)'],
  },
  {
    이름: '  가운데 맞춤이 없어도 담은 것이 넘치면 운다 (아래쪽이 잘린다 · 11/20 정석)',
    code: `const A = () => (
  <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', padding: 24 }}>
    <h2>기록을 지울까요</h2>
    <p>되돌릴 수 없습니다</p>
    <button>지우기</button>
  </div>
);`,
    기대: ['overflowY:auto(아래로 잘린다)'],
  },
  {
    이름: '  속을 줄이는 칸이 `{…}` 안에 있어도 안 운다 (거짓 FAIL 막이 · 오늘 실제로 났다)',
    code: `const A = () => (
  <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
    <div style={{ flexShrink: 0 }}>머리</div>
    {open && (
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>속</div>
    )}
  </div>
);`,
    기대: [],
  },
  {
    이름: '  빈 덮개는 안 센다 (거짓 FAIL 막이 · 서랍 뒤판)',
    code: `const A = () => (
  <div onClick={close} style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }} />
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
  ok('  CSS 에 글을 묶는 클래스가 생기면 걸린다',
    cssMoJib('.pill { height: 16px; line-height: 16px; }').글묶음, ['.pill']);
  ok('  `min-height` 는 묶음이 아니다 (거짓 FAIL 막이)',
    cssMoJib('.pill { min-height: 16px; line-height: 16px; }').글묶음, []);
  ok('  떠서 한 줄로 늘어나는 칸이 생기면 걸린다 (11/19 의 토스트 꼴)',
    cssMoJib('.toast { position: fixed; white-space: nowrap; }').떠서잘림, ['.toast']);
  ok('  상한이 있으면 안 걸린다 (거짓 FAIL 막이)',
    cssMoJib('.toast { position: fixed; white-space: nowrap; max-width: min(420px, calc(100vw - 32px)); }').떠서잘림, []);
  ok('  안 떠 있는 칸은 안 센다 (거짓 FAIL 막이 · 줄 안의 꼬리표)',
    cssMoJib('.badge { white-space: nowrap; }').떠서잘림, []);
  ok('  `body` 에서 `keep-all` 이 빠지면 걸린다',
    cssMoJib('body { color: red; overflow-wrap: break-word; }').낱말, { keepAll: false, 받침: true });
  ok('  `keep-all` 만 있고 받침이 없으면 걸린다 (긴 메일이 칸을 넘는다)',
    cssMoJib('body { word-break: keep-all; }').낱말, { keepAll: true, 받침: false });
  ok('  `.notbody` 의 `keep-all` 을 `body` 로 읽지 않는다 (거짓 PASS 막이)',
    cssMoJib('.notbody { word-break: keep-all; overflow-wrap: break-word; }').낱말, { keepAll: false, 받침: false });
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
  ok('  CSS 에 `height` 와 px 줄 높이로 글을 묶는 클래스가 없다', r.글묶음, []);
  // 떠 있는 칸이 한 줄로 늘어나 화면을 넘는 꼴 (2026-11-19) — 토스트가 그랬다
  ok('  떠 있는 칸이 한 줄로 늘어나 화면을 넘지 않는다 (`nowrap` + 상한 없음)', r.떠서잘림, []);

  // 11/18 실제 화면을 띄워 낱말마다 줄 상자를 셌을 때 360px 에서 **마흔한 자리**가
  // 낱말 가운데서 갈렸다(「생깁 / 니다」). 그 한 줄이 빠지면 그대로 돌아간다
  ok('한글을 띄어쓰기에서만 끊는다 (`body` 의 `keep-all` + 긴 덩이 받침)',
    r.낱말, { keepAll: true, 받침: true });
}

console.log('\n── 글자를 크게 쓰면 잘리는 칸이 없는가 ──');
{
  const 글묶음 = 모두.filter((r) => r.류 === '글묶음');
  ok('글이 든 칸을 `height` 와 px 줄 높이로 묶지 않는다',
    글묶음.map((r) => r.file + ':' + r.line), []);
  if (글묶음.length) {
    console.log('       묶인 자리:');
    for (const r of 글묶음) console.log('         ' + r.file + ':' + r.line);
    console.log('       → `height` 를 `minHeight` 로, 줄 높이를 비율(예: 18 / 11.5)로 푸세요.');
    console.log('         폰의 「글자 크기」는 px 글자도 키우는데 묶인 칸과 줄은 그대로입니다.');
  }
}

console.log('\n── 폰에서 세로로 늘어나는 작은 단추가 없는가 ──');
{
  const 늘어남 = 모두.filter((r) => r.류 === '달걀단추' || r.류 === '홀쭉단추');
  // **셈이 0 인 것은 통과가 아니다.** 「표를 든 자리」를 같이 세어 둔다 — 모집단이
  // 0 으로 떨어지면(파서가 단추를 못 찾거나 류 이름을 고쳐 필터가 빗나가면) 이 줄이
  // 먼저 운다. 11/16·11/17 에 거듭 밟은 「자가 「지금」을 베끼면 거짓이 된다」 류다
  const 표든자리 = [];
  for (const f of 파일들(SRC)) {
    const src = fs.readFileSync(f, 'utf8');
    if (/className="tap-(round|box)"/.test(src)) 표든자리.push(path.relative(ROOT, f).replace(/\\/g, '/'));
  }
  ok('표를 든 자리가 있다 (모집단이 비면 이 자는 장식이다)', 표든자리.length > 0, true);
  console.log('       `tap-round`·`tap-box` 를 든 파일 ' + 표든자리.length + '개');
  ok('크기를 박은 44 미만 단추는 표를 든다 (동그라미 `tap-round` · 네모 `tap-box`)',
    늘어남.map((r) => r.file + ':' + r.line), []);
  if (늘어남.length) {
    for (const r of 늘어남) console.log('         ' + r.file + ':' + r.line + '  → ' + r.빠진것.join(' · '));
    console.log('       → 그 표를 붙이세요. 폰은 단추 **높이만** 44 로 키우고 **폭은 그대로**라');
    console.log('         꼴이 찌그러지고(30×44) 과녁이 좁아 **옆 단추가 눌립니다**.');
  }
}

console.log('\n── 단축 `font` 가 글자 크기를 지우지 않는가 ──');
{
  const 단축 = 모두.filter((r) => r.류 === '글꼴단축');
  ok('`font: inherit` 이 앞에 적은 글자 크기를 지우지 않는다',
    단축.map((r) => r.file + ':' + r.line + ' (' + r.빠진것.join('·') + ')'), []);
  if (단축.length) {
    console.log('       → `font` 는 **단축 속성**이라 안 적은 칸을 기본값으로 되돌립니다.');
    console.log('         글꼴만 물려받으려면 `fontFamily` 로 적으세요.');
  }
}

console.log('\n── 화면을 덮는 칸이 넘침을 받는가 ──');
{
  const 덮침 = 모두.filter((r) => r.류 === '덮침');
  // **셈 0 은 통과가 아니다** — 모집단을 먼저 세운다 (11/19·11/20 에 거듭 밟은 류).
  // 11/20 에 맵시가 손으로 센 덮개가 **열일곱**이었다. 그보다 적게 잡히면 이 자가
  // 눈이 먼 것이다 — 숫자를 박지 않고 **열 넘는지**로만 둔다(숫자를 박으면 썩는다)
  ok('덮는 칸을 찾았다 (모집단이 비면 이 자는 장식이다)', 덮침.length > 10, true);
  console.log('       화면을 덮는 칸 ' + 덮침.length + '곳');

  // ── **빼주는 목록을 두지 않는다** ── (2026-11-20 · 정석 판정)
  //
  // 맵시 쪽 `check-layer` 에는 「안 받아도 되는 까닭」 목록이 있었고 여기도 한때 그것을
  // 옮겨 왔다(빈 까닭이면 울고 없는 깃발이면 우는 막이까지). 걷었다 — **그 목록이
  // 거짓이 된 자리를 그 자리에서 봤다**: 큰 스플래시가 「로고 한 줄뿐이라 안 넘친다」로
  // 들어 있었는데 글자 200% 에서 넘쳤다. 과녁이 제대로 좁으면(조상에 크기가 적혔나 ·
  // 안쪽 상자가 받나 · 세로로 가운데 맞추나) **빼줄 자리가 0 이다.** 적는 쪽이 아니라
  // **재는 쪽**이고, 재서 안 되면 **한 줄 붙이는 쪽**이다(`MiniSplash` 가 그 꼴이다).
  const 막힌것 = 덮침.filter((r) => r.빠진것.length);
  ok('덮는 칸은 넘치면 스크롤하고, 가운데 맞춤을 안쪽으로 넘겼다',
    막힌것.map((r) => r.file + ':' + r.line + ' (' + r.빠진것.join('·') + ')'), []);
  if (막힌것.length) {
    console.log('       → `overflowY: \'auto\'` 를 덮는 칸에, 가운데 맞춤은 **안쪽 칸의**');
    console.log('         `margin: \'auto\'` 로 옮기세요. `justifyContent: \'center\'` 와');
    console.log('         스크롤을 같이 두면 **위로 넘친 쪽은 스크롤해도 안 닿습니다**.');
  }
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
