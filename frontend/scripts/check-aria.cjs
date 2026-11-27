// **고른 것을 색으로만 말하지 않는가** (2026-11-27 · 맵시)
//
//   npm run aria     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 이 앱의 고르기 묶음은 `btn-secondary active` 로 **금 테두리**를 켜서 고른 것을
// 말한다. 눈으로는 또렷한데 **화면 읽기로는 네 칸이 똑같이 들린다** — 어느 것이
// 골라져 있는지 알 길이 없다. 11/27 에 전수로 세니 **열여섯**이었다(기간 · 성별 ·
// 스톱워치/타이머 · 휴식 길이 · 인바디 갈래 · 간편/상세 · 요일 · 루틴 갈래 · 부위 ·
// 견줄 것 · 칩 · 날 수).
//
// `aria-pressed={골랐나}` 한 줄이면 「선택됨」으로 읽힌다.
//
// ── `role="tablist"` 로 올리지 않은 까닭 ──
//
// 갈래 둘을 고르는 묶음(스톱워치/타이머 · 기록/비교)은 탭처럼 보인다. 그런데 탭으로
// **선언**하면 `tabpanel` 짝과 **화살표 키 이동**이 따라와야 한다 — 선언만 바꾸고
// 키 이동을 안 넣으면 **선언은 맞고 쓰기는 더 나빠진다**(읽는 도구가 화살표로 옮길
// 수 있다고 알리는데 안 옮겨진다). 지금 필요한 것은 **고른 상태를 전하는 것**이고
// `aria-pressed` 가 그 일을 한다. 탭으로 올리는 것은 키 이동을 같이 넣을 때 한다.
//
// ── 무엇을 보는가 ──
//
// **삼항으로 `active` 를 붙이는** 눌리는 칸에 `aria-pressed`(또는 `aria-selected` ·
// `aria-checked` · `aria-current`)가 있는가. 과녁을 삼항으로 좁히는 것이 중요하다 —
//
//   `className="btn-secondary active"` (고정)   ← **상태가 아니다.** 「랩」 단추처럼
//      늘 켜 두는 **강조**다(`StopwatchSection` · `RoutinePage` 둘). 고를 것이 없으니
//      「선택됨」이라고 말하면 거짓말이 된다
//   `className={`…${고른가 ? ' active' : ''}`}`  ← **상태다.** 여기가 과녁이다
//
// 11/27 에 이 둘을 안 가렸더니 거짓이 셋 섞였다. 거짓으로 울리는 자는 다음 사람이 끈다.

const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

/** 여는 태그 하나. `>` 를 글자로 찾으면 **`=>` 에서 끊긴다** — 중괄호·따옴표를 세며 읽는다 */
const 태그읽기 = (글, at) => {
  let q = null;
  let 깊이 = 0;
  for (let i = at; i < 글.length; i++) {
    const c = 글[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '{') { 깊이 += 1; continue; }
    if (c === '}') { 깊이 -= 1; continue; }
    if (깊이 === 0 && c === '>') return 글.slice(at, i + 1);
  }
  return null;
};

const 난것 = [];
const 센것 = { 과녁: 0, 고정: 0 };

const 훑기 = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) { 훑기(full); continue; }
    if (!/[.]jsx$/.test(f.name)) continue;
    const 글 = fs.readFileSync(full, 'utf8');
    const 이름 = path.relative(ROOT, full).split(path.sep).join('/');
    for (const m of 글.matchAll(/<(button|div|span|a)\b/g)) {
      const 태그 = 태그읽기(글, m.index);
      if (!태그) continue;
      if (!/onClick=/.test(태그)) continue;
      // **고정 `active` 는 상태가 아니다** — 늘 켜 두는 강조다 (머리글 참고)
      if (/className="[^"]*\bactive\b[^"]*"/.test(태그)) { 센것.고정 += 1; continue; }
      // 삼항으로 `active` 를 붙이는가 — `? ' active' :` 꼴
      if (!/\?\s*'\s*active'|\?\s*"\s*active"|\?\s*'\s+active'/.test(태그)) continue;
      센것.과녁 += 1;
      if (/aria-pressed|aria-selected|aria-checked|aria-current/.test(태그)) continue;
      난것.push(이름 + ':' + 글.slice(0, m.index).split('\n').length);
    }
  }
};

console.log('── 고른 것을 색으로만 말하는 자리 ──');
훑기(SRC);
console.log('     삼항으로 `active` 를 켜는 칸 ' + 센것.과녁 + '곳 · 늘 켜 둔 강조 '
  + 센것.고정 + '곳(상태가 아니라 과녁에서 뺀다)');
ok('고른 것을 말하지 않는 자리', 난것, []);
console.log('     ↑ 걸리면 `aria-pressed={골랐나}` 한 줄을 단다 — 금 테두리와 같은 조건을 쓴다');

console.log('');
if (bad === 0) console.log('고른 것이 색 말고도 들립니다');
else console.log(bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
