// 스크롤을 끈적하게 만드는 손이 있나 (2026-10-06).
//
//   npm run scroll     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// `window.addEventListener('scroll', …)` 를 **패시브 없이** 걸면, 브라우저는
// 그 손이 스크롤을 **막을 수도 있다**고 보고 **기다린다.** 폰에서 스크롤이
// 끈적해지는 전형적인 자리다 — 이 앱은 폰이 주 무대고 기록 목록은 몇 백 줄이다.
//
// 홈페이지(`/site`)는 10/5 에 `{ passive: true }` 로 걸었다. 그런데 **앱의 틀**
// (`Layout.jsx` — 모든 화면이 그 안에 앉는다)은 패시브 없이 걸고 있었고,
// 거기서 **매 스크롤 이벤트마다 `setState`** 를 불렀다. 같은 값이면 React 가
// 건너뛰지만, 300px 경계를 넘나드는 순간에는 **앱이 통째로 다시 그려진다.**
//
// ── 무엇을 보나 ──
//
// 둘 중 하나여야 한다.
//
//   1. `{ passive: true }` 가 붙어 있다
//   2. 그 줄 위에 **「막아야 한다」**고 적혀 있다 — `preventDefault` 를 부르는
//      손은 패시브로 걸 수가 없다(걸면 브라우저가 무시한다). 그런 자리가 생기면
//      그 줄 위에 적으면 된다
//
// **스크롤을 아예 안 듣는 쪽이 제일 좋다.** `Layout` 은 보이지 않는 표 하나와
// `IntersectionObserver` 로 바꿨다 — 관찰자는 들어오고 나갈 때 두 번만 깨운다.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const OPT_OUT = '막아야 한다';

let bad = 0;
const ok = (label, pass, detail) => {
  if (!pass) bad += 1;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label}${detail ? ` → ${detail}` : ''}`);
};

// ── 주석을 먼저 걷는다 ──
//
// 처음 판이 **제가 주석에 적어둔 옛 코드를 잡았다** — `Layout.jsx` 의 머리말에
// 「앞서는 이랬다」로 옛 손을 그대로 적어뒀는데, 검사가 그것을 살아 있는 코드로
// 봤다. 멀쩡한 파일을 실패로 만든 것이고, 오늘 다른 검사에서도 같은 종류를
// 겪었다(`check-routineform` 의 정규식이 삼항의 조건에 걸린 것).
//
// **고친 자리를 적어두는 것이 이 앱의 방식**이라(왜 그렇게 짰나를 코드 옆에 둔다)
// 주석에 옛 코드가 적히는 일은 앞으로도 생긴다. 걷어내고 본다.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // /* … */
    .replace(new RegExp('(^|[^:])//[^\n]*', 'g'), '$1');  // 줄 주석 (`https://` 는 안 건드린다)
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

// 스크롤처럼 **자주 터지는** 이벤트들. 하나라도 패시브가 아니면 그 손이
// 손가락과 브라우저 사이에 끼어든다
const HOT = ['scroll', 'touchstart', 'touchmove', 'wheel'];

const found = [];
for (const file of walk(SRC)) {
  const raw = fs.readFileSync(file, 'utf8');
  const src = stripComments(raw);
  const rel = path.relative(path.join(__dirname, '..'), file).split(path.sep).join('/');
  for (const ev of HOT) {
    const re = new RegExp(`addEventListener\\(\\s*'${ev}'[^)]*\\)`, 'g');
    let m;
    while ((m = re.exec(src)) !== null) {
      const above = src.slice(Math.max(0, m.index - 220), m.index);
      found.push({
        rel,
        ev,
        line: src.slice(0, m.index).split('\n').length,
        passive: /passive:\s*true/.test(m[0]),
        allowed: above.includes(OPT_OUT),
      });
    }
  }
}

console.log('── 자주 터지는 이벤트에 패시브가 붙었나 ──');
console.log('');

if (found.length === 0) {
  // **하나도 못 찾으면 통과가 아니다.** 정규식이 어긋나 빈 손으로 통과하는 것이
  // 이 검사에서 제일 나쁜 결말이다 — 오늘 다른 검사에서 세 번 겪었다
  ok('손을 하나라도 찾았나', false, '하나도 못 찾았다 — 정규식이 어긋났을 수 있다');
} else {
  for (const f of found) {
    const pass = f.passive || f.allowed;
    const why = f.passive ? 'passive: true' : f.allowed ? `「${OPT_OUT}」 (preventDefault 를 부른다)` : '**패시브가 아니다**';
    ok(`${f.rel}:${f.line} (${f.ev})`, pass, why);
  }
}

console.log('');
console.log('── 앱의 틀은 스크롤을 아예 안 듣나 ──');
// `Layout` 은 모든 화면을 감싼다. 거기서 스크롤마다 `setState` 를 부르면
// 경계를 넘나드는 순간 앱이 통째로 다시 그려진다 — 패시브로 걸어도 그건 그대로다
const layout = stripComments(fs.readFileSync(path.join(SRC, 'components', 'Layout.jsx'), 'utf8'));
ok('스크롤 손이 없다', !/addEventListener\(\s*'scroll'/.test(layout));
ok('  보이지 않는 표로 본다', /topMarkRef/.test(layout));
ok('  관찰자를 쓴다', /new IntersectionObserver/.test(layout));
// 관찰자를 못 쓰는 브라우저에서 패시브 아닌 손으로 되돌리지 않았나
ok('  못 쓰는 브라우저에서는 단추를 안 그린다', /typeof IntersectionObserver !== 'function'/.test(layout));

console.log('\n' + (bad ? `${bad}건 실패` : '전부 통과'));
process.exit(bad ? 1 : 0);
