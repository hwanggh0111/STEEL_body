// **보이지 않는 글자가 이름이 되지 못하게 하고, 꼴 검사가 지운 뒤에 보게 한다** (2026-11-19 · 정석)
//
//   npm run invisible
//   node scripts/check-invisible.cjs --되돌려     옛 손 둘을 먹여 자가 집는지 본다
//
// ── 왜 이 자가 생겼나 ──
//
// 11/18 에 bb0ed7a 가 「보이지 않는 이름이 통과한다」를 **닉네임에서** 닫았다. 자는
// 세우지 않았다. 11/19 2차에서 그 류가 반만 닫혀 있었다 —
//
//   ⑴ **표가 둘이었다.** `utils/nickname.js` 는 넓은 표, `utils/sanitize.js` 는 좁은
//      표(제어 문자 · 방향 뒤집기)를 들었다. 그래서 **운동 이름 · 루틴 이름 · 계획
//      이름 · 체육관 설정 · 목록 글**에는 U+200B ×3 · U+3164 · U+2800 · U+00AD ·
//      U+180E · 태그 글자만으로 된 이름이 **그대로 통과**했다 → 목록에 **이름이
//      없는 줄**이 생긴다. 닉네임에서 닫은 바로 그 결함이다
//   ⑵ **꼴 검사가 지우기 전에 돌았다.** `tagLike(raw)` 가 날것을 보니, 꺾쇠 바로
//      뒤에 보이지 않는 글자 하나를 끼우면 「꺾쇠는 거절하고 까닭을 말한다」는
//      선(11/17)을 넘어갔다. 그 뒤 지우는 손이 **`<img src=x>` 를 되살려 저장**했다.
//      그 손을 부르는 자리가 **열세 곳**이다
//
// ── 무엇을 보는가 ──
//
//   ① **표를 베껴 적지 않는다.** 글자 하나하나를 `utils/invisible.js` 의 식에 **물어서**
//      모집단을 만든다 (「자가 지금을 베끼면 거짓이 된다」류 — 표를 넓히는 날 자가
//      옛 표를 보고 있으면 안 된다)
//   ② **모집단이 0이면 그것이 실패다.** 셈 0 은 통과가 아니다
//   ③ 표의 글자만으로 된 값은 **손 일곱 전부**에서 빈 값이거나 거절이어야 한다
//   ④ 꺾쇠 뒤에 그 글자를 끼운 꼴은 **거절**되고, 어떤 손에서도 **태그가 살아남지
//      않아야** 한다
//   ⑤ 표는 **한 자리**여야 한다 — `backend/src` 안에 또 다른 보이지 않는 글자 표가
//      있으면 선이 둘이 되어 류가 또 반만 닫힌다
//   ⑥ 정규식에 **날글자를 박지 않는다** — U+2028 을 정규식 안에 날글자로 두면 JS 가
//      파일을 못 읽는다(줄 끝으로 본다). 11/19 에 한 번 밟았다
//   ⑦ **보이는 글자는 건드리지 않는다** — 점이 있는 브라유(U+2801) · 한글 · 이모지 ·
//      `L < R` 은 그대로 남아야 한다 (11/03·11/17 의 선)
//   ⑧ **되돌려 FAIL** — 옛 손 둘(좁은 표 · 날것을 보는 꼴 검사)을 자에게 먹여,
//      자가 그것을 **집는지** 본다. 못 집으면 이 자는 아무것도 지키지 않는다
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');
const INV = require(path.join(SRC, 'utils', 'invisible'));
const S = require(path.join(SRC, 'utils', 'sanitize'));
const N = require(path.join(SRC, 'utils', 'nickname'));
const W = require(path.join(SRC, 'utils', 'workoutFields'));

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const U = (c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
const TAG_SHAPE = /<[/!?a-zA-Z]/;

// 줄을 깨는 글자를 **코드로** 만든다 — 식에 날것으로 두면 이 파일도 못 읽힌다
const LINE_SEP = String.fromCodePoint(0x2028);
const PARA_SEP = String.fromCodePoint(0x2029);

// ── ① 표에 **물어서** 모집단을 만든다 (베끼지 않는다) ──
const 표 = [];
for (let cp = 0; cp <= 0xFFFF; cp += 1) {
  if (cp >= 0xD800 && cp <= 0xDFFF) continue;        // 홀 서러게이트는 글자가 아니다
  const ch = String.fromCodePoint(cp);
  if (INV.invisibleRe().test(ch)) 표.push(ch);
}
for (let cp = 0xE0000; cp <= 0xE007F; cp += 1) {
  const ch = String.fromCodePoint(cp);
  if (INV.invisibleRe().test(ch)) 표.push(ch);
}

console.log('── ① 모집단 — 표에 물어서 센다 ──');
console.log('   표가 가리키는 글자 ' + 표.length + '개'
  + ' (보기: ' + 표.slice(0, 6).map(U).join(' ') + ' …)');
ok('모집단이 비지 않았다 (셈 0 은 통과가 아니다)', 표.length > 0, true);
ok('11/18 에 닫은 넷이 표 안에 있다',
  [0x200B, 0x3164, 0x200F, 0x00AD].every((c) => 표.includes(String.fromCodePoint(c))), true);
ok('11/19 에 더한 둘이 표 안에 있다',
  [0x2800, 0xE0041].every((c) => 표.includes(String.fromCodePoint(c))), true);

// ── 손 일곱 — 라우트가 부르는 그대로 ──
//
// 값이 「남았다」고 볼 것: 비지 않은 글자. 거절(`null`)과 빈 값은 **둘 다 막힌 것**이다
const 값만뽑기 = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && typeof v.name === 'string') return v.name;   // 운동 이름 꼴
  if (typeof v === 'object' && typeof v.value === 'string') return v.value;
  return String(v);
};

const 손 = [
  ['sanitize (한 줄 글)', (r) => S.sanitize(r)],
  ['sanitizeMultiline (여러 줄)', (r) => S.sanitizeMultiline(r)],
  ['plainText (목록 글)', (r) => S.plainText(r)],
  ['cleanName (루틴·계획·체육관 이름)', (r) => S.cleanName(r, 60)],
  ['cleanExerciseName (운동 이름)', (r) => W.cleanExerciseName(r)],
  ['keepNickname (닉네임 세 길)', (r) => N.keepNickname(r, 30)],
  ['normalizeNote (운동 한 줄 메모)', (r) => {
    const o = W.normalizeNote(r);
    return o.ok ? (o.value ?? '') : null;
  }],
];

// ── ③ 표의 글자만으로는 이름이 되지 못한다 ──
console.log('\n── ③ 보이지 않는 글자만으로 된 값 — 손 ' + 손.length + '개 × 글자 ' + 표.length + '개 ──');
for (const [이름, 부르기] of 손) {
  const 샌것 = [];
  for (const ch of 표) {
    for (const raw of [ch, ch.repeat(3)]) {
      let got;
      try { got = 값만뽑기(부르기(raw)); } catch (e) { got = 'THROW:' + e.message; }
      if (got !== '') 샌것.push(U(ch) + '→' + JSON.stringify(got));
    }
  }
  ok('  ' + 이름 + ' 에서 빈 이름이 안 생긴다', 샌것.slice(0, 4), []);
}

// ── ④ 꼴 검사는 **지운 뒤에** 본다 ──
console.log('\n── ④ 꺾쇠 뒤에 끼운 꼴 — 거절되고, 태그가 살아남지 않는다 ──');
{
  const 샌것 = [];
  for (const ch of 표) {
    if (ch === '\n' || ch === '\r' || ch === '\t') continue;
    if (!S.tagLike('<' + ch + 'img src=x onerror=1>')) 샌것.push(U(ch));
  }
  ok('  tagLike 가 글자 ' + 표.length + '개 전부에서 거절한다', 샌것.slice(0, 6), []);
}
// 「태그가 남았다」만으로는 판정이 안 된다 — `plainText` 는 **태그를 떼는 손이 아니다**
// (긴 글은 글자 그대로 남긴다, 11/17 주인 결정). 11/19 에 그 꼴로 거짓 FAIL 을 한 번
// 냈다. 그래서 **끼운 것이 안 끼운 것과 같은 답을 받는가**로 본다 — 보이지 않는 글자
// 하나로 판정이 **달라지는 것**이 이 결함의 정체다
for (const [이름, 부르기] of 손) {
  const 갈린것 = [];
  const 맨몸 = (() => {
    try { return 값만뽑기(부르기('<img src=x onerror=1>')); } catch (e) { return 'THROW'; }
  })();
  for (const ch of 표) {
    let got;
    try { got = 값만뽑기(부르기('<' + ch + 'img src=x onerror=1>')); }
    catch (e) { got = 'THROW:' + e.message; }
    if (got !== 맨몸) 갈린것.push(U(ch) + '→' + JSON.stringify(got));
  }
  ok('  ' + 이름 + ' — 끼운 것이 맨몸(' + JSON.stringify(맨몸) + ')과 같은 답을 받는다',
    갈린것.slice(0, 4), []);
}

// ── ⑤ 표는 한 자리여야 한다 ──
console.log('\n── ⑤ 표가 한 자리인가 ──');
{
  // **표**를 찾는다 — 글자 하나를 쓰는 것과 표를 **세우는** 것은 다르다.
  //
  // 11/19 에 이 자가 한글 엑셀 BOM 셋(`routes/export.js` 의 `'﻿' + header`)과
  // BOM 을 걷는 줄(`csvRows.js`)을 표로 집어 **거짓 FAIL 둘**을 냈다. BOM 은 우리가
  // 일부러 붙이는 글자다. 표의 표식은 **묶음 하나 안에 보이지 않는 글자가 둘 이상**
  // 들어간 것이다 — 그것이 「선이 둘이 된다」는 뜻이고, 하나만 쓰는 것은 아니다
  const 범위꼴 = /\\u(?:200[BCDEF]|3164|00AD|2800|180E|115F|1160|FFA0|E00[0-7][0-9A-F]|202[ABCDE]|206[0-9])/gi;
  const 날것꼴 = new RegExp(
    '[\\u00AD\\u115F\\u1160\\u180E\\u200B-\\u200F\\u202A-\\u202E'
    + '\\u2060-\\u2064\\u2066-\\u2069\\u2800\\u3164\\uFFA0]'
    + '|[\\u{E0000}-\\u{E007F}]', 'gu');
  // 묶음(`[...]`) 안에서 센다. 묶음 밖에 홀로 쓰인 것은 표가 아니다.
  //
  // **묶음은 줄을 넘는다** — `invisible.js` 의 표가 바로 여러 줄에 이어 붙인 꼴이다.
  // 줄 단위로만 보면 **그 표조차 못 집는다**(11/19 에 자기 점검이 그렇게 FAIL 했다).
  // 그래서 주석 줄을 걷어낸 뒤 **이어 붙여** 본다
  const 주석걷기 = (글) => 글.split('\n')
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    })
    .join('\n');
  const 묶음안에둘이상 = (글) => {
    for (const m of 주석걷기(글).matchAll(/\[(?:[^\]\\]|\\.)*\]/g)) {
      const 속 = m[0];
      const 셈 = (속.match(범위꼴) || []).length + (속.match(날것꼴) || []).length;
      if (셈 >= 2) return true;
    }
    return false;
  };
  const 자리 = [];
  const 훑기 = (디렉) => {
    for (const e of fs.readdirSync(디렉, { withFileTypes: true })) {
      const p = path.join(디렉, e.name);
      if (e.isDirectory()) { 훑기(p); continue; }
      if (!/\.c?js$/.test(e.name)) continue;
      if (p === path.join(SRC, 'utils', 'invisible.js')) continue;
      if (묶음안에둘이상(fs.readFileSync(p, 'utf8'))) 자리.push(path.relative(SRC, p));
    }
  };
  훑기(SRC);
  ok('  `src` 안에 또 다른 표가 없다', 자리, []);
  // **셈 0 은 통과가 아니다** — 이 자가 표를 **하나는** 집어야 식이 산 것이다
  ok('  식이 살아 있다 (`invisible.js` 의 표를 집는다)',
    묶음안에둘이상(fs.readFileSync(path.join(SRC, 'utils', 'invisible.js'), 'utf8')), true);
}

// ── ⑥ 정규식에 날글자를 박지 않는다 ──
console.log('\n── ⑥ 줄을 깨는 글자가 코드 줄에 날것으로 있지 않은가 ──');
{
  const 박힌것 = [];
  const 훑기 = (디렉) => {
    for (const e of fs.readdirSync(디렉, { withFileTypes: true })) {
      const p = path.join(디렉, e.name);
      if (e.isDirectory()) { 훑기(p); continue; }
      if (!/\.c?js$/.test(e.name)) continue;
      fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
        if (l.trim().startsWith('//')) return;
        if (l.includes(LINE_SEP) || l.includes(PARA_SEP)) {
          박힌것.push(path.relative(SRC, p) + ':' + (i + 1));
        }
      });
    }
  };
  훑기(SRC);
  ok('  U+2028 · U+2029 가 코드 줄에 날것으로 없다', 박힌것, []);
}

// ── ⑦ 보이는 글자는 건드리지 않는다 ──
console.log('\n── ⑦ 보이는 것은 그대로 남는가 ──');
ok('  점 있는 브라유(U+2801)는 남는다', S.plainText('⠁⠂'), '⠁⠂');
ok('  한글 이름은 그대로', N.keepNickname('김 철수', 30), '김 철수');
ok('  이모지는 반 토막 나지 않는다', N.socialNickname('강철\u{1F4AA}', 30, 'FB'), '강철\u{1F4AA}');
ok('  `L < R` 은 거절하지 않는다 (11/17 의 선)', S.tagLike('L < R'), false);
ok('  `60>65` 는 그대로', S.sanitize('무게 60>65'), '무게 60>65');
ok('  줄 구분 글자는 이름 안에서 **공백**이 된다',
  N.keepNickname('철' + LINE_SEP + '수', 30), '철 수');

// ── ⑧ 되돌려 FAIL — 옛 손을 먹여 자가 집는지 본다 ──
{
  console.log('\n── ⑧ 되돌려 FAIL — 옛 손 둘을 자에게 먹인다 ──');

  // 옛 표 (11/18 의 `sanitize.js` 쪽 좁은 표 — 제어 문자 · 방향 뒤집기만)
  const 옛표 = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F'
    + '\\u202A-\\u202E\\u2066-\\u2069]', 'g');
  const 옛지우기 = (s) => String(s).replace(옛표, '');
  // 옛 꼴 검사 (**날것**을 본다)
  const 옛tagLike = (s) => typeof s === 'string' && TAG_SHAPE.test(s);
  // 옛 닉네임 손 — 지운 뒤에 꼴을 보지 않는다
  const 옛keepNickname = (raw) => {
    if (typeof raw !== 'string') return null;
    const v = raw.replace(N.NICK_INVISIBLE, '').replace(/[\t\r\n]/g, ' ').trim();
    return (!v || v.length > 30) ? null : v;
  };

  const 꼴 = [
    ['옛 좁은 표는 U+200B 만으로 된 이름을 통과시킨다',
      () => 옛지우기('​​​') !== '', true],
    ['옛 좁은 표는 U+2800 · 태그 글자도 통과시킨다',
      () => 옛지우기('⠀\u{E0041}') !== '', true],
    ['  지금 표는 둘 다 빈 값으로 만든다',
      () => INV.stripInvisible('​​​') === ''
        && INV.stripInvisible('⠀\u{E0041}') === '', true],
    ['옛 꼴 검사는 꺾쇠 뒤 U+200B 를 못 본다',
      () => 옛tagLike('<​img src=x>'), false],
    ['  지금 꼴 검사는 본다',
      () => S.tagLike('<​img src=x>'), true],
    ['옛 닉네임 손은 그 꼴을 `<img src=x>` 로 되살려 저장한다',
      () => 옛keepNickname('<​img src=x>'), '<img src=x>'],
    ['  지금 손은 거절한다',
      () => N.keepNickname('<​img src=x>', 30), null],
  ];

  let 샌것 = 0;
  for (const [이름, 부르기, 기대] of 꼴) {
    let 받은것;
    try { 받은것 = 부르기(); } catch (e) { 받은것 = 'THROW:' + e.message; }
    const 집었다 = JSON.stringify(받은것) === JSON.stringify(기대);
    if (!집었다) 샌것 += 1;
    console.log((집었다 ? 'OK   잡는다: ' : 'FAIL 샌다  : ') + 이름
      + ' → ' + JSON.stringify(받은것)
      + (집었다 ? '' : ' (기대: ' + JSON.stringify(기대) + ')'));
  }
  bad += 샌것;
  console.log(샌것 ? '  ↑ **되돌린 꼴을 자가 못 집었다.** 이 자는 아무것도 지키지 않는다'
    : '  되돌린 꼴 ' + 꼴.length + '개를 다 집었다');
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
