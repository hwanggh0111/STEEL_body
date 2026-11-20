// **사진을 거절할 때 사실을 말하는가** · **늦게 온 답이 새 사진을 덮지 않는가**
// (2026-11-20 · 맵시)
//
//   npm run photo     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 「사진 바꾸기」를 읽다 **버그 둘**을 잡았다.
//
//   ⑴ **못 읽은 것을 「당신 사진이 크다」고 말했다.** 브라우저가 못 여는 형식(데스크톱
//      크롬의 HEIC 등)이면 줄이는 손이 **원본을 그대로** 돌려주고, 그 원본이 한도를
//      넘으면 「사진은 1.5MB 이하만 가능해요」가 떴다 — **1.2MB 짜리를 골라도 같은
//      말**이다. 까닭이 **사실과 다르고** 줄여 와도 또 안 되니 **할 수 있는 일을
//      안 알려준 셈**이다. 그 말을 **세 자리가 따로 적고** 있었다(프로필 · 전후 사진 ·
//      홈페이지 사진) — 그래서 셋 다 크기 탓으로만 말했다.
//   ⑵ **두 번 고르면 옛 사진으로 되돌아갔다.** 미리 보기를 먼저 바꾸고 올리는데,
//      첫 요청이 **늦게 실패하면** 그 실패가 옛 사진으로 되돌렸다 — **두 번째가 이미
//      성공해 있어도** 덮었다.
//
// ── 무엇을 보는가 ──
//
//   ⑴ **사진을 거절하는 자리는 모두 `photoRejectMessage` 를 부른다** (말은 한 자리)
//   ⑵ **그 말을 베껴 적은 자리가 없다** — `photoLimit.js` 밖에 한도 안내 글이 없다
//   ⑶ **줄이는 손이 못 읽은 자리마다 `unreadable` 을 돌려준다** (한 자리만 빠지면
//      그 길로 들어온 사람에게 거짓을 말한다)
//   ⑷ **프로필 올리기에 순번 막이가 있다** — 순번을 올리고 `then`·`catch` **둘 다**
//      에서 견준다. **지우기도 순번을 올린다**(올리던 것이 늦게 성공해 다시 담으면
//      지운 사진이 되살아난다)
//
// **셈 0 은 통과가 아니다** — 모집단(사진을 다루는 파일)이 비면 먼저 운다.
//
//   node scripts/check-photo.cjs --되돌려     일부러 어긋낸 꼴 일곱을 먹여 빨개지는지 본다

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 주석을 먼저 걷는다 — 걷지 않으면 **까닭을 적어둔 주석이 코드로 읽힌다**
// (11/19 에 같은 자리를 밟았다: 「글자를 찾는 자가 주석에 걸린다」)
const codeOf = (s) => s
  .replace(/(^|[\s{(,=])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');

/**
 * ★ **식을 여기 한 자리에 둔다** — 본 검사와 되돌려-FAIL 이 **같은 손**을 부른다.
 * 되돌려가 제 안에 식을 또 적으면 식을 넓히는 날 **되돌려만 옛 식을 본다**
 * (집안 규칙 · `check-shrink` · `check-narrow` 머리글).
 *
 * 돌려주는 것 — 넷 다 **비어 있어야** 한다(⑷ 는 참이어야 한다).
 */
function 식(파일들) {
  // ⑴ 거절하는 자리: 한도(`PHOTO_MAX_BASE64`)로 거르거나 줄이는 손을 부르는 파일
  const 거절자리 = [];
  // ⑵ 말을 베껴 적은 자리
  const 베낀말 = [];
  // ⑸ ★ **판단이 크기 하나에 매인 자리** (2026-11-20 · 정석 1차)
  //
  // 아침에 고친 것은 **말**이었다 — 「못 읽은 것을 크다고 말하지 않는다」. 그런데
  // **거절할지 말지를 가르는 조건은 그대로 크기 하나**였다(`length > 한도`). 그래서
  // 못 읽은 사진이 **한도 아래면 그냥 담겼고**, 담긴 뒤에는 **아무도 그것을 볼 수
  // 없다**(이 기기도 못 읽는 그림이다 · 홈페이지 사진은 손님에게 깨져 나간다).
  // 말을 한 자리에서 받는 것만으로는 모자라다 — **조건으로도** 봐야 한다.
  const 크기만본다 = [];
  for (const [rel, raw] of 파일들) {
    const src = codeOf(raw);
    // ★ **거절하는 자리는 「사람에게 말하는 자리」다.** 처음에는 「한도를 쓰거나 줄이는
    // 손을 부르는 파일」로 잡았는데, 그러면 **줄이는 손 자신**(`shrinkImage.js`)이
    // 걸렸다 — 그 파일은 한도를 보고 **값을 돌려줄 뿐** 사람에게 아무 말도 안 한다
    // (11/20 에 이 자를 처음 돌려 받은 **거짓 FAIL**이다). 말하는 자리만 센다.
    const 거르나 = (/PHOTO_MAX_BASE64/.test(src) || /shrinkImage\s*\(/.test(src))
      && /toast\s*\(/.test(src);
    if (거르나) {
      // 거절하는 말을 **스스로 만들지 말고** 한 자리에서 받아야 한다
      if (!/photoRejectMessage\s*\(/.test(src)) 거절자리.push(rel);
      // 그리고 **못 읽었다를 조건으로도** 봐야 한다 (말로만 보면 한도 아래가 샌다).
      // `if (…)` 안에 그 낱말이 있나로 본다 — 말에만 넘기는 꼴(`photoRejectMessage({
      // unreadable })`)과 가르려고 **조건 자리**를 짚는다
      if (!/if\s*\([^)]*(unreadable|못읽음|안읽힘)/.test(src)) 크기만본다.push(rel);
    }
    // 한도 안내를 글자로 적은 자리 (말을 만드는 그 파일만 가질 수 있다)
    if (rel === 'src/data/photoLimit.js') continue;
    if (/이하만 가능|아래로 줄여|줄여보세요/.test(src)) 베낀말.push(rel);
  }
  return { 거절자리, 베낀말, 크기만본다 };
}

/**
 * ⑶ **줄이는 손이 못 읽은 자리마다 사실을 돌려주나.**
 *
 * 「원본을 그대로 돌려주는」 자리를 센다. 그중 **줄이기를 건너뛴 자리**(한도 안이라
 * 손대지 않은 것 · 다시 구웠더니 더 커진 것)는 못 읽은 것이 아니므로 뺀다 —
 * 남는 것은 **못 열었거나 캔버스를 못 얻은 자리**이고, 거기에는 `unreadable` 이
 * 붙어 있어야 한다.
 */
function 줄이는손(raw) {
  const src = codeOf(raw);
  const 샌자리 = [];
  // `catch` 와 `if (!ctx)` 두 자리 — 글자 자리로 자른다(정규식으로 중괄호를 쫓지 않는다)
  for (const 머리 of ['} catch {', 'if (!ctx)']) {
    let i = src.indexOf(머리);
    while (i >= 0) {
      const 뒤 = src.slice(i, i + 260);
      if (/return\s*\{[^}]*data:\s*original/.test(뒤) && !/unreadable/.test(뒤)) {
        샌자리.push(머리 + ' (' + (src.slice(0, i).split('\n').length) + '줄)');
      }
      i = src.indexOf(머리, i + 1);
    }
  }
  return 샌자리;
}

/**
 * ⑹ ★ **한도 안이어도 열어는 보나.** (2026-11-20 · 정석 1차)
 *
 * 「한도 안이면 그대로 둔다」는 가지가 **못 읽었는지 묻지도 않고** 돌려주고 있었다 —
 * 그 길로 1MB 짜리 HEIC 이 `unreadable` **없이** 나가 그냥 올라갔다. 올라가면 이
 * 기기에서도 깨지고 남의 기기에서도 깨진다. **「크기가 괜찮다」는 「읽을 수 있다」가
 * 아니다.** 그 가지 안에 여는 손(`loadImage`)이나 `unreadable` 이 있어야 한다.
 *
 * ★ 이 손을 `줄이는손` 과 **따로** 둔다 — 처음에 그 안에 섞었더니 「줄이기를 건너뛴
 * 자리」 되돌려 꼴과 과녁이 겹쳐 **거짓 FAIL** 이 났다(11/20 · 그 자리에서 갈랐다).
 */
function 한도안열어보나(raw) {
  const src = codeOf(raw);
  const i = src.indexOf('<= PHOTO_MAX_BASE64');
  // **0건은 통과가 아니다** — 한도를 보는 줄이 사라지면 이 검사가 장식이 된다
  if (i < 0) return ['한도를 보는 줄을 못 찾았다'];
  // ★ **창으로 재지 않는다 — 가지를 뜬다.** 처음에 「그 자리에서 700자」로 봤다가
  // 진짜 파일로 되돌려 보고 두 번 샜다(11/20 · 둘 다 그 자리에서 고쳤다):
  //
  //   ⑴ `unreadable` **글자**를 증거로 삼았다 → 여는 줄만 떼면 `catch` 의
  //      `unreadable: true` 가 남아 **통과**했다
  //   ⑵ 창이 넓어 **아래 본문의 `loadImage`** 를 제 가지로 착각했다 → 여는 줄을
  //      떼도 **통과**했다
  //
  // 그래서 `if` 의 **가지만** 중괄호로 떠서 그 안에서 **여는 손**을 찾는다. 가지가
  // 중괄호 없는 한 줄(`if (…) return …;`)이면 여는 손이 들어갈 자리가 없다 — 그것이
  // 바로 샌 꼴이다. 여는 손은 셋 중 아무것이어도 된다(꼴을 하나로 못박으면 다르게
  // 적는 날 거짓 FAIL 이다).
  let j = i;
  while (j < src.length && src[j] !== '{' && src[j] !== ';') j += 1;
  if (src[j] !== '{') return ['한도 안이면 열어보지도 않는다'];   // 한 줄 가지
  let 깊이 = 0;
  let 끝 = j;
  for (; 끝 < src.length; 끝 += 1) {
    if (src[끝] === '{') 깊이 += 1;
    else if (src[끝] === '}') { 깊이 -= 1; if (깊이 === 0) break; }
  }
  const 가지 = src.slice(j, 끝 + 1);
  return /loadImage|createImageBitmap|\.decode\(/.test(가지)
    ? [] : ['한도 안이면 열어보지도 않는다'];
}

/**
 * ⑷ **늦게 온 답이 새 사진을 덮지 않나.**
 *
 * 순번을 올리는 자리가 **둘**(올리기 · 지우기)이고, 견주는 자리가 **둘**
 * (`then` · `catch`)이어야 한다. 하나라도 빠지면 그 길로 옛것이 돌아온다.
 */
function 순번막이(raw) {
  const src = codeOf(raw);
  const 올림 = (src.match(/photoSeqRef\.current\s*\+=\s*1/g) || []).length;
  const 견줌 = (src.match(/!==\s*photoSeqRef\.current/g) || []).length;
  return { 올림, 견줌 };
}

function 파일들(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...파일들(p));
    else if (/\.(jsx?|js)$/.test(e.name)) {
      out.push([path.relative(ROOT, p).replace(/\\/g, '/'), fs.readFileSync(p, 'utf8')]);
    }
  }
  return out;
}

// ── 되돌려-FAIL — 일부러 어긋낸 꼴을 먹여 **빨개지는지** 본다 ──
//
// ★ 본 검사와 **같은 손**(`식` · `줄이는손` · `순번막이`)에 먹인다.
const 되돌려꼴 = [
  {
    이름: '거절하는 자리가 말을 스스로 만들면 운다 (11/20 의 그 꼴)',
    파일: [['src/pages/X.jsx', "if (data.length > PHOTO_MAX_BASE64) toast(`사진은 ${PHOTO_MAX_LABEL} 이하만 가능해요`);"]],
    본다: (r) => r.거절자리,
    기대: ['src/pages/X.jsx'],
  },
  {
    이름: '  한 자리에서 받으면 안 운다 (고친 꼴)',
    파일: [['src/pages/X.jsx', "if (data.length > PHOTO_MAX_BASE64) toast(photoRejectMessage({ unreadable }));"]],
    본다: (r) => r.거절자리,
    기대: [],
  },
  {
    이름: '  말을 베껴 적으면 운다 (한쪽만 고치는 날이 온다)',
    파일: [['src/pages/X.jsx', "toast(photoRejectMessage({})); const 옛말 = '1.5MB 아래로 줄여보세요';"]],
    본다: (r) => r.베낀말,
    기대: ['src/pages/X.jsx'],
  },
  {
    이름: '  주석에 적어둔 옛말은 안 센다 (거짓 FAIL 막이)',
    파일: [['src/pages/X.jsx', "// 여태 「1.5MB 이하만 가능해요」라고만 말했다\ntoast(photoRejectMessage({}));"]],
    본다: (r) => r.베낀말,
    기대: [],
  },
  {
    이름: '  값만 돌려주는 손은 거절하는 자리가 아니다 (거짓 FAIL 막이 · `shrinkImage`)',
    파일: [['src/data/shrinkImage.js', "if (!always && original.length <= PHOTO_MAX_BASE64) return { data: original };"]],
    본다: (r) => r.거절자리,
    기대: [],
  },
  {
    이름: '  사진을 안 다루는 파일은 모집단이 아니다 (거짓 FAIL 막이)',
    파일: [['src/pages/Y.jsx', "const a = 1; toast('저장했어요');"]],
    본다: (r) => r.거절자리,
    기대: [],
  },
  // ── ★ 판단이 크기 하나에 매인 꼴 (2026-11-20 · 정석 1차) ──
  //
  // **아침의 고침이 여기까지 안 왔다.** 말은 한 자리에서 받는데 조건은 크기 하나라,
  // 못 읽은 사진이 **한도 아래면 그냥 담겼다.** 그 꼴을 그대로 먹인다
  {
    이름: '★ 말만 한 자리에서 받고 조건이 크기 하나면 운다 (11/20 아침의 그 꼴)',
    파일: [['src/pages/X.jsx', "if (data.length > PHOTO_MAX_BASE64) toast(photoRejectMessage({ unreadable }));"]],
    본다: (r) => r.크기만본다,
    기대: ['src/pages/X.jsx'],
  },
  {
    이름: '  조건으로도 보면 안 운다 (고친 꼴)',
    파일: [['src/pages/X.jsx', "if (unreadable || data.length > PHOTO_MAX_BASE64) toast(photoRejectMessage({ unreadable }));"]],
    본다: (r) => r.크기만본다,
    기대: [],
  },
  {
    이름: '  한글로 적은 이름도 센다 (`못읽음` · `안읽힘`)',
    파일: [['src/pages/X.jsx', "if (못읽음 || data.length > PHOTO_MAX_BASE64) toast(photoRejectMessage({ unreadable: 못읽음 }));"]],
    본다: (r) => r.크기만본다,
    기대: [],
  },
];

if (process.argv.includes('--되돌려')) {
  console.log('── 되돌려-FAIL: 일부러 어긋낸 꼴을 먹인다 ──');
  for (const t of 되돌려꼴) ok(t.이름, t.본다(식(t.파일)), t.기대);

  // 줄이는 손 — **못 읽은 자리에서 사실을 빼면** 운다
  ok('줄이는 손이 못 읽었다는 것을 빼면 운다',
    줄이는손('try { x(); } catch {\n  return { data: original, shrunk: false };\n}').length > 0, true);
  ok('  돌려주면 안 운다 (고친 꼴)',
    줄이는손('try { x(); } catch {\n  return { data: original, shrunk: false, unreadable: true };\n}'), []);
  ok('  줄이기를 건너뛴 자리는 못 읽은 것이 아니다 (거짓 FAIL 막이)',
    줄이는손('if (!always && original.length <= LIMIT) return { data: original, shrunk: false };'), []);

  // ★ 한도 안에서도 열어보나 (2026-11-20 · 정석 1차)
  ok('★ 한도 안이면 열어보지도 않으면 운다 (1MB 짜리 HEIC 이 그냥 올라갔다)',
    한도안열어보나('if (!always && original.length <= PHOTO_MAX_BASE64) return { data: original, shrunk: false };'),
    ['한도 안이면 열어보지도 않는다']);
  ok('  열어만 보면 안 운다 (고친 꼴 · 다시 굽지 않는다)',
    한도안열어보나('if (!always && original.length <= PHOTO_MAX_BASE64) {\n'
      + '  try { await loadImage(original); } catch { return { data: original, unreadable: true }; }\n'
      + '  return { data: original, shrunk: false };\n}'), []);
  ok('  한도를 보는 줄이 사라지면 운다 (0건은 통과가 아니다)',
    한도안열어보나('const a = 1;'), ['한도를 보는 줄을 못 찾았다']);
  // ★ **진짜 파일로 되돌려 보고 잡은 꼴** — 여는 줄만 떼면 `unreadable` 글자가 남아
  // 자가 통과시켰다. 글자는 증거가 아니다 (11/20 · 정석)
  ok('  ★ 여는 손 없이 `unreadable` 만 적어두면 운다 (글자는 증거가 아니다)',
    한도안열어보나('if (!always && original.length <= PHOTO_MAX_BASE64) {\n'
      + '  // 걷었다\n  return { data: original, shrunk: false };\n}\n'
      + 'try { x(); } catch { return { data: original, unreadable: true }; }'),
    ['한도 안이면 열어보지도 않는다']);
  ok('    다르게 여는 손도 받는다 (`createImageBitmap` · 거짓 FAIL 막이)',
    한도안열어보나('if (original.length <= PHOTO_MAX_BASE64) { await createImageBitmap(blob); }'), []);

  // 순번 막이 — 견주는 자리가 하나만 있으면 **다른 길로 옛것이 돌아온다**
  ok('순번을 안 견주면 셈이 모자라다',
    순번막이('const n = (photoSeqRef.current += 1);\n.then(() => { if (n !== photoSeqRef.current) return; })'),
    { 올림: 1, 견줌: 1 });

  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────
console.log('── 사진을 거절할 때 사실을 말하는가 ──');

const 모두 = 파일들(SRC);
ok('볼 파일이 있다', 모두.length > 0, true);

// **모집단을 먼저 세운다** — 0 으로 떨어지면 아래 줄이 「비어서 참」이 된다
const 사진자리 = 모두.filter(([, raw]) => {
  const src = codeOf(raw);
  return /PHOTO_MAX_BASE64/.test(src) || /shrinkImage\s*\(/.test(src);
}).map(([rel]) => rel);
ok('사진을 다루는 자리를 찾았다 (모집단이 비면 이 자는 장식이다)', 사진자리.length >= 3, true);
console.log('       ' + 사진자리.join(' · '));

const r = 식(모두);
ok('거절하는 자리는 **모두** 한 자리에서 말을 받는다 (`photoRejectMessage`)', r.거절자리, []);
ok('  한도 안내를 베껴 적은 자리가 없다', r.베낀말, []);
// ★ **말만 고치면 절반이다** — 조건이 크기 하나면 못 읽은 사진이 한도 아래로 샌다
ok('  ★ 거절 판단이 크기 하나에 매여 있지 않다 (못 읽은 것은 한도 아래여도 거절)',
  r.크기만본다, []);

console.log('\n── 못 읽은 것을 「크다」고 말하지 않는가 ──');
{
  const raw = fs.readFileSync(path.join(SRC, 'data', 'shrinkImage.js'), 'utf8');
  ok('줄이는 손이 못 읽은 자리마다 `unreadable` 을 돌려준다', 줄이는손(raw), []);
  // ★ 못 읽었는지 **묻는 자리 자체**가 한도 밖에만 있으면, 한도 아래는 영영 안 묻는다
  ok('  ★ 한도 안이어도 열어는 본다 (「크기가 괜찮다」는 「읽을 수 있다」가 아니다)',
    한도안열어보나(raw), []);
  // 말을 만드는 손이 **두 갈래를 다 말하나** — 한 갈래만 있으면 다시 크기 탓만 한다
  const 말 = fs.readFileSync(path.join(SRC, 'data', 'photoLimit.js'), 'utf8');
  ok('  말을 만드는 손이 `unreadable` 갈래를 갖는다', /unreadable/.test(codeOf(말)), true);
  ok('  그 갈래가 **다음 걸음**을 적는다 (「줄여 오세요」로 끝내지 않는다)',
    /JPG|jpg/.test(말), true);
}

console.log('\n── 고르는 동안 그 자리에서 말하는가 ──');
{
  const layout = codeOf(fs.readFileSync(path.join(SRC, 'components', 'Layout.jsx'), 'utf8'));
  const sheet = codeOf(fs.readFileSync(path.join(SRC, 'components', 'AccountSheet.jsx'), 'utf8'));
  // 걸음을 **셋 다** 세운다 — 하나만 빠지면 그 구간이 「멈춘 것」처럼 보인다
  ok('걸음을 셋 다 세운다 (읽는 중 · 줄이는 중 · 올리는 중)',
    ['read', 'shrink', 'upload'].filter((k) => !layout.includes("'" + k + "'")), []);
  // 줄이는 손이 **걸음을 알려주는 손**을 받는다 (안 받으면 화면이 짐작해야 한다)
  const shrink = codeOf(fs.readFileSync(path.join(SRC, 'data', 'shrinkImage.js'), 'utf8'));
  ok('  줄이는 손이 걸음을 알려준다 (`onStage`)', shrink.includes('onStage?.('), true);
  // **하는 중에는 다시 못 누른다** — 막는 자리가 둘이다(파일 칸 · 시트의 동그라미).
  // 하나만 막으면 다른 길이 열려 있다 (그 길로 들어가면 요청이 둘이 된다)
  ok('  하는 중에는 파일 칸이 안 받는다', layout.includes('if (photoStage)'), true);
  ok('  하는 중에는 동그라미가 안 열린다', sheet.includes('busyPhoto'), true);
  // 까닭은 **그 자리에 남는다** — 토스트로만 말하면 3초 뒤 사라진다
  ok('  까닭을 그 자리에 남긴다 (`photoFail`)',
    layout.includes('setPhotoFail(') && sheet.includes('photoFail'), true);
  ok('  까닭에 **다음 걸음**이 붙어 있다 (다시 고르기)', sheet.includes('다시 고르기'), true);
}

console.log('\n── 사진 일이 한 자리에 모였는가 ──');
{
  const sheet = codeOf(fs.readFileSync(path.join(SRC, 'components', 'AccountSheet.jsx'), 'utf8'));
  // 세 갈래가 **한 메뉴**에 있다 (여태 동그라미 · 줄 · 줄 셋으로 흩어져 있었다)
  ok('동그라미 하나가 세 갈래를 낸다 (크게 보기 · 바꾸기 · 지우기)',
    ['크게 보기', '사진 바꾸기', '사진 지우기'].filter((w) => !sheet.includes(w)), []);
  ok('  그 셋이 메뉴 안에 있다 (role="menu")', sheet.includes('role="menu"'), true);
  // 떠 있는 것에는 **나갈 길**이 있어야 한다 — 바깥 누르기와 Esc 둘 다
  ok('  바깥을 눌러도 닫힌다', sheet.includes('setPhotoMenu(false)'), true);
  ok('  Esc 로도 닫힌다', sheet.includes('Escape') && sheet.includes('photoMenu'), true);
}

console.log('\n── 늦게 온 답이 새 사진을 덮지 않는가 ──');
{
  const raw = fs.readFileSync(path.join(SRC, 'components', 'Layout.jsx'), 'utf8');
  const { 올림, 견줌 } = 순번막이(raw);
  // 올림 둘(올리기 · 지우기) · 견줌 둘(`then` · `catch`). 하나라도 빠지면 그 길로 돌아온다
  ok('순번을 올리는 자리가 둘이다 (올리기 · 지우기)', 올림, 2);
  ok('  순번을 견주는 자리가 둘이다 (성공 · 실패)', 견줌, 2);
}

console.log('\n' + (bad ? bad + '건 실패' : '모두 통과'));
process.exit(bad ? 1 : 0);
