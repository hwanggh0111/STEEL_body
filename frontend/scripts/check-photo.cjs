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
    }
    // 한도 안내를 글자로 적은 자리 (말을 만드는 그 파일만 가질 수 있다)
    if (rel === 'src/data/photoLimit.js') continue;
    if (/이하만 가능|아래로 줄여|줄여보세요/.test(src)) 베낀말.push(rel);
  }
  return { 거절자리, 베낀말 };
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

console.log('\n── 못 읽은 것을 「크다」고 말하지 않는가 ──');
{
  const raw = fs.readFileSync(path.join(SRC, 'data', 'shrinkImage.js'), 'utf8');
  ok('줄이는 손이 못 읽은 자리마다 `unreadable` 을 돌려준다', 줄이는손(raw), []);
  // 말을 만드는 손이 **두 갈래를 다 말하나** — 한 갈래만 있으면 다시 크기 탓만 한다
  const 말 = fs.readFileSync(path.join(SRC, 'data', 'photoLimit.js'), 'utf8');
  ok('  말을 만드는 손이 `unreadable` 갈래를 갖는다', /unreadable/.test(codeOf(말)), true);
  ok('  그 갈래가 **다음 걸음**을 적는다 (「줄여 오세요」로 끝내지 않는다)',
    /JPG|jpg/.test(말), true);
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
