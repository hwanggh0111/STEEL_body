// **폰 틀을 지키는 자가 하나도 없었다** (2026-11-20 · 정석)
//
//   npm run devframe     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// `/dev` 의 폰 틀은 `dist` 밖에 산다(`apply: 'serve'`). 그래서 어떤 자도 이 파일을 보지
// 않았고, 조용히 깨져도 아무도 울지 않았다. 11/20 에 그 틀에 「크게」 손잡이가 들어갔는데
// (글자를 키운 폰을 흉내낸다), 오늘 고친 넷이 전부 글자를 키운 폰에서만 잘린 것이라
// 이 손잡이는 점검의 첫 걸음이 됐다. 첫 걸음이 조용히 깨지면 그 뒤가 다 헛돈다 —
// 오늘 창 셋이 거듭 밟은 「안 보이는 자리를 통과로 적는다」 류다.
//
// ── 무엇을 보는가 ──
//
//   ⑴ 손잡이가 있고 값이 비지 않았다 — 점검표 값 150·200 이 들어 있다
//   ⑵ 주소로 받은 배율은 목록에 있는 것만 쓴다 (`?zoom=9` 를 그대로 믿지 않는다)
//   ⑶ 배율을 입히기 전에 되돌린다 — 입힌 뒤의 크기로 또 나누면 배율이 겹친다
//   ⑷ 이름표는 앱이 받는 자리(나눈 쪽)를 적는다 — 눈에 보이는 수를 적으면 거짓이다
//   ⑸ 배율을 쓰는 동안 한계 문구가 뜬다 — 이 틀은 여백·단추까지 키워 넘침을 과장한다.
//      그 줄이 없으면 이 틀이 폰 점검을 대신한다고 믿게 된다
//   ⑹ 틀이 `dist` 에 안 실린다 (`apply: 'serve'`)
//
// ★ 글자를 찾는 자이므로 주석을 먼저 걷는다. 주석에 적힌 말을 코드로 읽으면 이 자가
// 거짓 PASS 를 낸다. 그리고 ⑸ 는 꼴에 기대지 않는다 — 처음에 「한 줄에 40자 이상」으로
// 적었더니, 그 줄을 굵게 하려고 `<b>` 칸으로 쪼개자 내 눈이 멀었다(11/20 · b0 가 고친
// 바로 그 줄이다). 뜻을 담은 낱말이 다 있는가로 본다 — 꼴은 바뀌어도 뜻은 남는다.
//
//   node scripts/check-devframe.cjs --되돌려     일부러 어긋낸 꼴 여덟을 먹여 빨개지는지 본다

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const 틀 = path.join(ROOT, 'dev', 'preview.html');
const 설정 = path.join(ROOT, 'vite.config.js');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 주석을 걷는다. 식에 역슬래시를 쓰지 않고 손으로 자른다 — 이 트리에서 셸을 거치며
// 역슬래시가 먹히는 일을 하루에 네 번 밟았다. 자르는 자리는 셋이다:
// HTML 주석 · 덩이 주석 · 줄 머리의 줄 주석 (줄 끝에 붙은 것은 건드리지 않는다 —
// 주소의 `//` 를 잘라 먹지 않으려면 그 쪽이 안전하다)
function 걷기(src, 여는것, 닫는것) {
  let out = '';
  let i = 0;
  for (;;) {
    const a = src.indexOf(여는것, i);
    if (a < 0) { out += src.slice(i); return out; }
    out += src.slice(i, a);
    const b = src.indexOf(닫는것, a + 여는것.length);
    if (b < 0) return out;
    i = b + 닫는것.length;
  }
}
const 알맹이 = (src) => 걷기(걷기(src, '<!--', '-->'), '/*', '*/')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

/**
 * 식을 한 자리에 둔다 — 본 검사와 되돌려-FAIL 이 같은 손을 부른다. 되돌려가 제 안에
 * 식을 또 적으면 식을 넓히는 날 되돌려만 옛 식을 본다 (11/17 에 정석이 밟은 꼴).
 */
function 재기(틀원본, 설정원본) {
  const h = 알맹이(틀원본);
  const 어긋남 = [];

  // ⑴ 손잡이와 값
  const 자리 = h.indexOf('id="zoom"');
  if (자리 < 0) 어긋남.push('크게 손잡이가 없다');
  else {
    const 끝 = h.indexOf('</select>', 자리);
    const 칸 = h.slice(자리, 끝 < 0 ? 자리 + 600 : 끝);
    const 값들 = 칸.split('value="').slice(1).map((x) => x.slice(0, x.indexOf('"')));
    if (값들.length < 2) 어긋남.push('고를 값이 비었다 (' + 값들.length + '개)');
    for (const 점검표 of ['1.5', '2']) {
      if (!값들.includes(점검표)) 어긋남.push('점검표 값 ' + 점검표 + ' 이 없다');
    }
  }

  // ⑵ 주소로 받은 배율을 목록과 맞댄다
  if (!(h.includes('zoomSel.options') && h.includes('.value === z'))) {
    어긋남.push('`?zoom` 을 목록과 맞대지 않는다');
  }

  // ⑶ 되돌린 뒤 읽는 순서
  const 되돌림 = h.indexOf("transform = ''");
  const 읽기 = h.indexOf('getBoundingClientRect');
  if (되돌림 < 0) 어긋남.push('배율을 되돌리는 줄이 없다');
  else if (읽기 >= 0 && 되돌림 > 읽기) 어긋남.push('되돌리기가 크기 읽기보다 뒤에 있다 (배율이 겹친다)');

  // ⑷ 이름표가 나눈 쪽을 적는다
  if (!(h.includes('r.width / f') && h.includes('r.height / f'))) {
    어긋남.push('이름표가 앱이 받는 자리(나눈 쪽)를 안 적는다');
  }

  // ⑸ 한계 문구 — 꼴이 아니라 뜻으로 본다
  const 빠진말 = ['과장', '폰에서', '안 넘친다'].filter((w) => !h.includes(w));
  if (빠진말.length) 어긋남.push('배율의 한계를 적은 줄이 없다 (틀을 믿게 된다) — 빠진 말: ' + 빠진말.join('·'));

  // ⑹ `dist` 밖에 산다
  if (!알맹이(설정원본).includes("apply: 'serve'")) 어긋남.push("틀이 `dist` 에 실린다 (`apply: 'serve'` 가 없다)");

  return 어긋남;
}

const 전부바꾸기 = (s, a, b) => s.split(a).join(b);

if (process.argv.includes('--되돌려')) {
  console.log('── 되돌려-FAIL: 일부러 어긋낸 꼴을 먹인다 ──');
  const 원본 = fs.readFileSync(틀, 'utf8');
  const 설정원본 = fs.readFileSync(설정, 'utf8');
  // ★ 「아무거나 울면 통과」로 적지 않는다. 처음에 그렇게 적었다가, 한계 문구를 못 보는
  // 내 눈먼 자리가 모든 꼴에 섞여 들어 「이름표를 틀리게 적어도 운다」가 거짓으로
  // 통과했다. 어긋난 말 자체를 맞댄다 (11/20 · 오늘 세 번째로 밟은 류)
  const 꼴 = [
    ['  손잡이를 떼면 운다', 전부바꾸기(원본, 'id="zoom"', 'id="nope"'), 설정원본, '손잡이가 없다'],
    ['  점검표 값(200%)을 빼면 운다', 전부바꾸기(원본, 'value="2">', 'value="x">'), 설정원본, '점검표 값 2'],
    ['  `?zoom` 을 목록과 안 맞대면 운다', 전부바꾸기(원본, 'zoomSel.options', 'NOPE'), 설정원본, '목록과 맞대지 않는다'],
    ['  되돌리기를 지우면 운다 (배율이 겹친다)', 전부바꾸기(원본, "transform = ''", "transform = 'keep'"), 설정원본, '되돌리는 줄이 없다'],
    ['  이름표가 눈에 보이는 수를 적으면 운다', 전부바꾸기(원본, 'r.width / f', 'r.width'), 설정원본, '나눈 쪽'],
    ['  한계 문구를 지우면 운다', 전부바꾸기(전부바꾸기(원본, '과장', ''), '안 넘친다', ''), 설정원본, '한계를 적은 줄이 없다'],
    ['  틀이 `dist` 에 실리면 운다', 원본, 전부바꾸기(설정원본, "apply: 'serve'", "apply: 'build'"), '`dist` 에 실린다'],
    ['  고친 꼴은 안 운다 (지금 판)', 원본, 설정원본, null],
  ];
  for (const [이름, h, c, 기대말] of 꼴) {
    const 난것 = 재기(h, c);
    if (기대말 === null) ok(이름, 난것, []);
    else {
      // 그 말로 울었나 — 다른 줄이 울어서 통과하는 것을 막는다
      ok(이름, 난것.some((x) => x.includes(기대말)), true);
      if (난것.length) console.log('       ' + 난것.join(' · '));
    }
  }
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
}

console.log('── 폰 틀의 「크게」 손잡이가 제자리인가 ──');
// 0건은 통과가 아니다 — 파일이 사라지면 이 자가 장식이 된다
ok('틀 파일을 찾았다', fs.existsSync(틀) && fs.existsSync(설정), true);
ok('지켜야 하는 것 여섯이 다 있다', 재기(fs.readFileSync(틀, 'utf8'), fs.readFileSync(설정, 'utf8')), []);
console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
