// ± 로 숫자를 넣는 셈이 맞는가 (2026-10-15)
//
//   npm run step     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 세트를 적는 칸에 ± 를 붙였다. 눈으로 보면 「올라간다」까지는 바로 보이는데,
// **경계에서 하는 일**은 눌러봐도 잘 안 보인다 —
//
//   · 무게 칸이 비어 있는 것은 **맨몸**이다. `0kg` 이 아니다. 그 둘을 섞으면
//     맨몸 턱걸이가 「0kg 턱걸이」로 적힌다
//   · 비어 있을 때 `−` 를 누르면? **맨몸보다 가벼운 것은 없다** — 아무 일도 안 해야 한다
//   · 1.25 + 2.5 같은 셈은 글자로 다루면 `3.7500000000000004` 가 나온다
//   · 상한에 닿으면 **꾹 누르기가 멈춰야** 한다. 안 멈추면 손은 누르고 있는데
//     아무 일도 안 일어나는 채로 끝난다
//
// 값을 **글자로** 다루는 것도 여기서 지킨다. 숫자로 바꿔 돌려주면 `''`(맨몸)이
// `0` 이 되어 뜻이 바뀐다.

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// ── 컴포넌트에서 **셈만** 떼어 돌린다 ──
//
// React 를 띄우지 않는다. 이 검사가 보려는 것은 그리는 일이 아니라 `bump()` 의 셈이다.
// 그래서 같은 규칙을 한 벌 더 적지 않고 **파일에서 그 함수를 그대로 뽑아 쓴다** —
// 두 벌로 두면 한쪽만 고치는 날이 온다.
const SRC = path.join(__dirname, '..', 'src', 'components', 'NumberStep.jsx');
const src = fs.readFileSync(SRC, 'utf8');

// `num` · `tidy` · `bump` 세 조각만 꺼낸다
const grab = (name, kind = 'function') => {
  const at = src.indexOf(`${kind} ${name}(`);
  if (at < 0) throw new Error(`${name} 를 못 찾았다 — NumberStep.jsx 가 바뀌었다면 이 검사도 고쳐야 한다`);
  let depth = 0;
  for (let i = src.indexOf('{', at); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(at, i + 1); }
  }
  throw new Error(`${name} 의 끝을 못 찾았다`);
};

const bumpAt = src.indexOf('const bump = (dir');
if (bumpAt < 0) { console.log('FAIL NumberStep.jsx 에 bump 가 없다'); process.exit(1); }
let depth = 0, bumpSrc = '';
for (let i = src.indexOf('{', bumpAt); i < src.length; i += 1) {
  if (src[i] === '{') depth += 1;
  else if (src[i] === '}') { depth -= 1; if (depth === 0) { bumpSrc = src.slice(bumpAt, i + 1); break; } }
}

// ──────────────────────────────────────────────────────────────
// 세트 칸으로 적을 때 **무게를 지어내지 않는가** (2026-10-27)
// ──────────────────────────────────────────────────────────────
//
// 세트 칸은 **폼을 안 보고 누르는 자리**다(그게 이 기능의 뜻이다). 그래서 적을 때
// 무게가 어디서 오는지가 흐릿했고, **모르면 「맨몸」으로 지어내고 있었다** —
// 빈 값은 `asWeight` 가 「맨몸」으로 바꾼다. 루틴을 돌다 폼에서 다른 운동을 고른 채
// 세트 칸을 누르면 **벤치프레스가 「맨몸」으로 적혔다.**
//
// 바로 옆의 횟수는 「몇 회 했는지는 지어낼 수 없어요」로 막고 있었다 —
// **무게만 그 자를 안 쓰고 있었다.**
{
  const src2 = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'TrainPage.jsx'), 'utf8');
  const at = src2.indexOf('export function setsWeight(');
  if (at < 0) { console.log('FAIL TrainPage 에 setsWeight 가 없다'); process.exit(1); }
  let depth = 0; let body = '';
  // **매개변수의 중괄호부터 세면 안 된다** — 이 함수는 `({ sameForm, … })` 로 받는다.
  // 괄호가 닫힌 **뒤**의 첫 중괄호가 몸통의 시작이다 (처음에 여기서 틀렸다)
  const paramEnd = src2.indexOf(')', at);
  for (let i = src2.indexOf('{', paramEnd); i < src2.length; i += 1) {
    if (src2[i] === '{') depth += 1;
    else if (src2[i] === '}') { depth -= 1; if (depth === 0) { body = src2.slice(at, i + 1); break; } }
  }
  const mod = { exports: {} };
  // `isBodyweight` 도 같이 떼어 온다 — 그 자가 맨몸을 가린다
  const iso = src2.match(/const isBodyweight = [^;]+;/)[0];
  // eslint-disable-next-line no-new-func
  const fn = new Function(`${iso}
${body.replace('export function', 'function')}
return setsWeight;`)();

  console.log('\n── 세트 칸으로 적을 때 무게 ──');
  ok('폼이 그 운동이면 폼의 값', fn({ sameForm: true, formWeight: '80', lastWeight: '70' }), { ok: true, weight: '80' });
  ok('  폼이 비어 있으면 **그것이 답이다** (맨몸)', fn({ sameForm: true, formWeight: '', lastWeight: '70' }), { ok: true, weight: '' });
  ok('폼이 딴 운동이면 지난 기록', fn({ sameForm: false, formWeight: '40', lastWeight: '70' }), { ok: true, weight: '70' });
  ok('  지난 기록이 맨몸이면 무게가 아니다', fn({ sameForm: false, formWeight: '', lastWeight: '맨몸' }), { ok: false, weight: '' });
  ok('  둘 다 없으면 **지어내지 않는다**', fn({ sameForm: false, formWeight: '', lastWeight: null }), { ok: false, weight: '' });
  ok('  없는 값도 안 터진다', fn({}), { ok: false, weight: '' });

  // **값만 맞아서는 모자란다** — 세는 자를 만들어두고 **안 쓰면** 그대로다.
  // 되돌려 보니 멈추는 자리를 빼도 위의 여섯은 다 통과했다 (10/27)
  const cut = src2.slice(src2.indexOf('const saveRoutineSets'), src2.indexOf('const tapSet'));
  ok('  적는 자리가 그 자를 쓴다', /setsWeight\(\{\s*sameForm/.test(cut), true);
  ok('  모르면 멈춘다', /if \(!wv\.ok\) \{/.test(cut) && /return;/.test(cut), true);
  ok('  횟수도 지어내지 않는다 (옆의 같은 자)', /지어낼 수 없어요/.test(cut), true);
}

const make = ({ value, step = 1, min = 0, max = 9999, startAt }) => {
  let now = value;
  // 흉내: `set` 은 적어두고 바깥에 알린다. `mine` 은 컴포넌트의 ref 자리
  const mine = { current: null };
  const set = (v) => { mine.current = v; now = v; };
  // eslint-disable-next-line no-new-func
  const fn = new Function('num', 'tidy', 'value', 'set', 'mine', 'step', 'min', 'max', 'startAt',
    `${bumpSrc}; return bump;`);
  const numFn = new Function(`${grab('num')}; return num;`)();
  const tidyFn = new Function(`${grab('tidy')}; return tidy;`)();
  return {
    bump: (dir, isRepeat = false) => {
      const b = fn(numFn, tidyFn, now, set, mine, step, min, max, startAt);
      return b(dir, isRepeat);
    },
    get value() { return now; },
  };
};

console.log('── 맨몸과 0kg 은 다르다 ──');
{
  const w = make({ value: '', step: 2.5, min: 0, startAt: 2.5 });
  ok('비어 있을 때 − 는 아무 일도 안 한다', w.bump(-1), false);
  ok('값도 그대로 비어 있다 (맨몸이 0kg 이 되지 않는다)', w.value, '');
  ok('비어 있을 때 ＋ 는 정해둔 자리에서 시작한다', (w.bump(1), w.value), '2.5');
}

console.log('\n── 무게 셈 (2.5kg 짜리) ──');
{
  const w = make({ value: '80', step: 2.5, min: 0, max: 999 });
  ok('＋ 한 번에 2.5', (w.bump(1), w.value), '82.5');
  ok('− 한 번에 2.5', (w.bump(-1), w.value), '80');
  const odd = make({ value: '1.25', step: 2.5, min: 0, max: 999 });
  ok('1.25 + 2.5 가 3.75 다 (0.0000004 가 안 붙는다)', (odd.bump(1), odd.value), '3.75');
}

console.log('\n── 경계에서 멈추는가 ──');
{
  const w = make({ value: '1', step: 2.5, min: 0, max: 999 });
  ok('바닥을 넘기면 바닥에 맞춘다', (w.bump(-1), w.value), '0');
  ok('바닥에서 또 누르면 멈춘다 (꾹 누르기가 끝난다)', w.bump(-1), false);
}
{
  const w = make({ value: '998', step: 2.5, min: 0, max: 999 });
  ok('천장을 넘기면 천장에 맞춘다', (w.bump(1), w.value), '999');
  ok('천장에서 또 누르면 멈춘다', w.bump(1), false);
}

console.log('\n── 횟수 셈 (1회짜리 · 최소 1) ──');
{
  const r = make({ value: '8', step: 1, min: 1, max: 999, startAt: 1 });
  ok('＋ 한 번에 1', (r.bump(1), r.value), '9');
  const one = make({ value: '1', step: 1, min: 1, max: 999, startAt: 1 });
  ok('1 에서 − 는 멈춘다 (0회 세트는 없다)', one.bump(-1), false);
}

console.log('\n── 화면이 그렇게 쓰고 있는가 ──');
{
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'TrainPage.jsx'), 'utf8');
  ok('무게 칸에 ± 가 붙어 있다', /NumberStep[\s\S]{0,200}tr-w/.test(page), true);
  ok('무게는 2.5kg 씩', /tr-w[\s\S]{0,200}step=\{2\.5\}/.test(page), true);
  ok('횟수는 1회씩', /tr-r[\s\S]{0,200}step=\{1\}/.test(page), true);
  // **자판을 막지 않는다.** 이상한 값은 눌러서 쳐야 한다
  const comp = src;
  ok('칸은 그대로 쳐서 넣을 수 있다', /onChange\(e\.target\.value\)/.test(comp), true);
  ok('읽기 전용으로 잠그지 않았다', /readOnly/.test(comp), false);
}

console.log('\n── 꾹 누르는 동안 올라가다 멈추지 않는가 ──');
{
  // **처음에 여기서 두 번 넘어졌다.**
  //   ① props 를 그대로 봤다 → 40ms 간격에서 React 가 아직 안 그려서 같은 값을
  //      다시 읽었다. 올라가다 멈춘 것처럼 보인다
  //   ② 「바깥 값이 내가 적어둔 것과 다르면 바깥을 따른다」로 고쳤다 → 연달아 두 번
  //      누르면 **첫 번째 그림이 도착할 때 둘째가 지워졌다**
  // 그래서 **누를 때마다(isRepeat=false) 바깥을 다시 읽고, 이어지는 동안은 적어둔 것**을 쓴다.
  const comp = src;
  ok('이어지는 동안은 적어둔 값에서 센다', /isRepeat && mine\.current !== null \? mine\.current : value/.test(comp), true);
  ok('새로 누를 때는 바깥 값을 다시 읽는다', /bump\(-1, isRepeat\)/.test(comp), true);
  ok('직접 치면 적어둔 값을 버린다', /mine\.current = null; onChange\(e\.target\.value\)/.test(comp), true);

  // 키보드 꾹 누르기를 따로 만들면 **한 번에 두 번 올라간다** —
  // 브라우저가 Enter 를 누르고 있을 때 click 을 스스로 되풀이해 보낸다
  const hold = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'useHoldRepeat.js'), 'utf8');
  ok('keydown 으로 되풀이하지 않는다 (click 이 두 번 세어진다)', /onKeyDown/.test(hold), false);
}

console.log('\n── 꾹 누르기가 손을 떼는 것을 window 에서 받는가 ──');
{
  // 반복 중에 그 단추가 `disabled` 되면 **그 요소로는 pointerup 이 오지 않는다.**
  // 단추에만 걸어두면 손을 떼도 계속 오른다 — 눌러봐도 잘 안 드러나는 자리다
  const hold = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'useHoldRepeat.js'), 'utf8');
  ok('window 의 pointerup 을 듣는다', /window\.addEventListener\('pointerup'/.test(hold), true);
  ok('창이 포커스를 잃으면 멈춘다', /'blur'/.test(hold), true);
  ok('앱을 나가면 멈춘다', /visibilitychange/.test(hold), true);
  ok('치울 때 다 떼어낸다', /removeEventListener\('pointerup'/.test(hold), true);
  ok('동작이 false 를 주면 멈춘다', /=== false/.test(hold), true);
}

console.log('');
if (bad) {
  console.log(bad + '건 실패 — 세트 적는 칸의 셈이 틀렸습니다.');
  process.exit(1);
}
console.log('± 로 넣는 셈이 경계까지 맞습니다');
