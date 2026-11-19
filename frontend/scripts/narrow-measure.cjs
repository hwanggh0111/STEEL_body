// **좁은 폰에서 칸 안에 글 자리가 남는가** — 아직 자가 아니라 **재는 도구**다
// (2026-11-19 · 맵시)
//
//   npm run narrow        (node scripts/narrow-measure.cjs)
//
// ★ **이름이 `check-` 로 시작하지 않는 것은 뜻이 있다.** `scripts/run-checks.cjs:45`
// 는 `check-*.cjs` 를 **찾아서** 돈다 — 줄에 적는 것을 잊을 자리가 없게 그렇게 세웠다.
// 그래서 `check-narrow.cjs` 로 두면 **기준이 아직 없는 자**가 묶음에 끼어 109개를
// 통째로 빨갛게 만든다(11/19 에 실제로 그렇게 터뜨렸다). 기준(아래 「비워 둔 한 줄」)이
// 정해지고 고침이 붙는 날 **`check-narrow.cjs` 로 이름을 바꾸면** 그날부터 자가 된다.
// 지금은 **수를 내놓는 도구**이고, 고침을 붙이는 손이 무엇을 지켜야 하는지 수로 알고
// 시작하게 하려고 먼저 둔다.
//
// ── 왜 이 자가 생겼나 ──
//
// 11/19 에 기록 화면의 무게 칸을 셈했더니 **글 자리가 320px 폰에서 2.7px** 였다.
// 적어둔 「100.5」가 거기 있는데 **보이지 않는다.** ± 단추 둘(36+36)과 틈(4+4)이
// 칸에서 먼저 자리를 가져가고, 칸 셋이 나란히 서면 한 칸이 89px 밖에 안 된다.
//
//   320px → 글 자리  2.7px   아무것도 안 보인다
//   360px → 글 자리 18.1px   「22.5」도 잘린다
//   390px → 글 자리 29.7px   「100.5」가 잘린다
//   430px → 글 자리 45.1px   들어간다
//
// 11/18 에 ± 단추를 42→36 으로 줄인 손은 **390 에서 0 을 면한 데까지만** 고쳤다
// (`NumberStep.jsx` 의 그 주석이 390 한 폭만 적고 있다). 그래서 이 자는 **폭을
// 여럿 놓고** 센다 — 한 폭만 보면 또 같은 자리에서 넘어진다.
//
// ── 무엇을 보는가 ──
//
// 상수를 **하나도 베껴 적지 않는다.** `globals.css` 와 `NumberStep.jsx` 와
// `TrainPage.jsx` 에서 그 자리의 값을 읽어 셈한다 — 누가 여백이나 단추 폭을 바꾸면
// 이 자의 셈이 **그날 따라 움직인다**(11/16 의 「자가 「지금」을 베끼면 거짓이 된다」).
// **읽기에 실패하면 PASS 가 아니라 터진다** — 자리를 못 찾은 것을 조용히 통과로
// 두면 이 자가 장식이 된다.
//
// ── ★ 비워 둔 한 줄 ──
//
// 「숫자 한 자가 몇 px 인가」는 **글꼴이 아는 것**이고 코드에는 없다. 어림값(Barlow
// 14px ≈ 7.7px)을 자에 박으면 그때부터 이 자는 「지금」이 아니라 **짐작을 베낀다** —
// 글꼴을 바꾸는 날, 글자를 150% 로 쓰는 사람 앞에서 거짓이 된다. 그래서 `글자폭` 을
// **비워 두고** 정석 판정을 기다린다. 길은 둘이다 —
//
//   ⑴ 실측 표 — 글꼴의 숫자 advance 를 한 번 재서 `data/` 에 두고 자가 그것을 읽는다
//   ⑵ **`ch` 로 바닥을 깔고 자는 그 바닥이 있는지만 본다** (시안 D) — `ch` 는
//      브라우저가 그 글꼴의 `0` 폭으로 재는 단위라 짐작이 아예 필요 없고, 글자를
//      크게 쓰면 바닥도 같이 자란다. 이 길로 가면 아래 셈은 **참고 출력**으로 남고
//      판정은 「`min-width` 가 `ch` 로 깔려 있는가」가 된다

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const S = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// ── 상수를 그 자리에서 읽는다 (못 읽으면 터진다) ──
function 집어내기(글, re, 무엇) {
  const m = re.exec(글);
  if (!m) throw new Error('값을 못 읽었다: ' + 무엇 + ' — 자리가 바뀌었으면 이 자를 고치세요');
  return parseFloat(m[1]);
}

function 상수() {
  const css = S('src/styles/globals.css');
  const ns = S('src/components/NumberStep.jsx');
  const tp = S('src/pages/TrainPage.jsx');

  const 비율줄 = /gridTemplateColumns: '([^']*minmax[^']*)', gap: (\d+)/.exec(tp);
  if (!비율줄) throw new Error('기록 화면의 칸 셋을 못 찾았다 (TrainPage 의 gridTemplateColumns)');
  const 비율 = (비율줄[1].match(/minmax\(0, *([\d.]+)fr\)/g) || [])
    .map((x) => parseFloat(/([\d.]+)fr/.exec(x)[1]));
  if (비율.length < 2) throw new Error('칸 셋의 비율을 못 읽었다: ' + 비율줄[1]);

  return {
    화면여백: 집어내기(css, /--padding-x: *([\d.]+)px/, '--padding-x'),
    카드여백: 집어내기(css, /^\.card \{[\s\S]*?padding: *([\d.]+)px/m, '.card padding'),
    칸글자: 집어내기(css, /^\.input \{[\s\S]*?font-size: *([\d.]+)px/m, '.input font-size'),
    단추폭: 집어내기(ns, /flexShrink: 0, width: (\d+)/, 'NumberStep 단추 폭'),
    단추틈: 집어내기(ns, /display: 'flex', gap: (\d+)/, 'NumberStep 틈'),
    칸안여백: 집어내기(ns, /paddingLeft: (\d+)/, 'NumberStep 칸 안쪽 여백'),
    비율,
    칸틈: parseFloat(비율줄[2]),
  };
}

// ── 한 폭에서 ± 가 끼인 칸의 **글 자리**를 센다 ──
//
// 테두리는 1px 씩 둘(카드 좌우 · 칸 좌우)이다. `box-sizing: border-box` 라
// 적어둔 폭 안에 여백과 테두리가 들어 있다
function 글자리(c, 화면, 칸수 = c.비율.length) {
  const 테두리 = 2;
  const 안쪽 = 화면 - c.화면여백 * 2 - c.카드여백 * 2 - 테두리;
  const 비율 = c.비율.slice(0, 칸수);
  const 합 = 비율.reduce((a, b) => a + b, 0);
  const 남은 = 안쪽 - c.칸틈 * (칸수 - 1);
  const 첫칸 = (남은 * 비율[0]) / 합;
  return {
    안쪽: Math.round(안쪽),
    칸: 비율.map((f) => Math.round((남은 * f) / 합)),
    글: +(첫칸 - c.단추폭 * 2 - c.단추틈 * 2 - c.칸안여백 * 2 - 테두리).toFixed(1),
  };
}

// ★ 비워 둔 한 줄 — 숫자 한 자의 폭(px). 정석 판정 뒤에 채운다.
//    `null` 인 동안 이 자는 **판정하지 않고 울기만 한다** (미정은 통과가 아니다)
const 글자폭 = null;

// 지켜야 하는 것 — 무게 칸에 「100.5」(숫자 넷 + 소수점)가 들어가야 한다.
// 적는 무게가 세 자리까지 가고(999kg 이 상한이다 — `data/limits.js` 쪽 선),
// 2.5 단위라 소수점이 늘 붙는다
const 넣어볼글 = '100.5';

const 폭들 = [320, 360, 390, 430];

console.log('── 좁은 폰에서 기록 칸의 글 자리 ──');
let c;
try {
  c = 상수();
} catch (e) {
  console.log('FAIL 상수를 읽지 못했다 → ' + e.message);
  process.exit(1);
}
console.log('     읽은 값 — 화면 여백 ' + c.화면여백 + ' · 카드 여백 ' + c.카드여백
  + ' · 칸 글자 ' + c.칸글자 + ' · ± 단추 ' + c.단추폭 + ' · 틈 ' + c.단추틈
  + ' · 칸 안 여백 ' + c.칸안여백 + ' · 칸 셋 ' + c.비율.join(':') + ' (틈 ' + c.칸틈 + ')');

const 잰것 = 폭들.map((w) => ({ 폭: w, ...글자리(c, w) }));
for (const r of 잰것) {
  console.log('     ' + r.폭 + 'px — 카드 안쪽 ' + r.안쪽 + ' · 칸 ' + r.칸.join('/')
    + ' · **글 자리 ' + r.글 + 'px**');
}

// 셈이 도는지 먼저 본다 — 폭이 넓어지면 글 자리도 커져야 한다. 안 그러면 셈이 죽은 것이다
ok('폭이 넓어질수록 글 자리가 커진다 (셈이 살아 있다)',
  잰것.every((r, i) => i === 0 || r.글 > 잰것[i - 1].글), true);
ok('모든 폭을 쟀다', 잰것.length, 폭들.length);

if (글자폭 === null) {
  console.log('\n★ 「숫자 한 자가 몇 px 인가」가 아직 안 정해졌다 — 머리글의 길 ⑴·⑵ 참고.');
  console.log('  어림값을 여기 박으면 이 자가 짐작을 베낀다. **미정은 통과가 아니다.**');
  console.log('  셈까지는 살아 있다: 위 네 줄이 폭마다 글 자리를 센 값이다.');
  process.exit(1);
}

const 글필요 = (넣어볼글.match(/[0-9]/g) || []).length * 글자폭
  + (넣어볼글.includes('.') ? 글자폭 * 0.5 : 0);
console.log('     「' + 넣어볼글 + '」가 드는 데 드는 자리 ' + 글필요.toFixed(1) + 'px');
ok('모든 폭에서 「' + 넣어볼글 + '」가 든다',
  잰것.filter((r) => r.글 < 글필요).map((r) => r.폭 + 'px(' + r.글 + ')'), []);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
