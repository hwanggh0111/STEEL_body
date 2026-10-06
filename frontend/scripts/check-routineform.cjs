// 루틴 폼이 조용히 썩을 자리 둘 (2026-10-06).
//
// ── 1. 운동 이름은 사전이 거들어야 한다 ──
//
// 루틴 폼만 운동 이름을 **맨 글자로** 받고 있었다. 앱에 사전이 437개 있고 「운동」
// 탭과 「운동 검색」은 그것을 쓰는데 여기만 안 썼다.
//
// 그게 그냥 불편한 정도가 아니다. **루틴은 그 사람이 매번 하는 운동**이다 —
// 이름이 사전에 없으면 `bodyPartOf` 가 '기타'로 떨어지고, 그 운동은 **몸 지도에
// 영영 안 들어간다.** 한 번이 아니라 매번. 「랫풀다운」을 「렛풀다운」으로
// 적어두면 등은 영영 식은 채로 보인다.
//
// 되돌아가기 쉬운 자리다 — `<input placeholder="운동명">` 한 줄이면 끝나니까.
//
// ── 2. 줄의 열쇠를 자리 번호로 두면 안 된다 ──
//
// 가운데 줄을 지우면 그 아래 줄들이 한 칸씩 당겨진다. 열쇠가 자리 번호면 React 는
// **같은 줄이 고쳐진 것**으로 보고 DOM 을 그대로 쓴다 — 글자는 state 가 끌고 오니
// 맞게 보이지만 **커서와 열려 있던 자동완성 목록이 엉뚱한 줄에 남는다.**
//
// 그래서 줄이 생길 때 번호를 붙인다(`blankRow` · `uidRef`). 그런데 폼을 채우는
// 길이 **넷**이다 — 새로 만들기 · 운동 추가 · 루틴 고치기 · 메모에서 옮기기.
// **한 길만 번호를 안 붙여도 그 길로 온 줄에서만** 그 증상이 난다.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'pages', 'RoutinePage.jsx');
const src = fs.readFileSync(FILE, 'utf8');

let bad = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label} → ${JSON.stringify(got)}${pass ? '' : ` (기대: ${JSON.stringify(want)})`}`);
};

console.log('── 운동 이름이 맨 입력으로 돌아가지 않았나 ──');
ok('사전이 거드는 칸을 쓴다', /<ExerciseNameInput/.test(src), true);
// 맨 input 으로 되돌아간 자리가 없나. 세트·회 칸은 `placeholder="세트"` · `"회"` 다
ok('  맨 input 으로 이름을 받지 않는다', /placeholder="운동명"/.test(src), false);

console.log('');
console.log('── 줄의 열쇠가 자리 번호가 아닌가 ──');
ok('열쇠는 줄 번호(uid)다', /key=\{ex\.uid\}/.test(src), true);
// 자리 번호로 떨어지는 길을 남겨두면 **빠진 길이 조용히 숨는다**
ok('  자리 번호로 떨어지는 길이 없다', /key=\{ex\.uid \?\?/.test(src), false);
ok('  줄 번호를 되쓰지 않는다 (uidRef.current++)', /uidRef\.current\+\+/.test(src), true);

// 폼을 채우는 길 넷이 다 번호를 붙이는가.
//
// `blankRow()` 를 부르거나 `uid: uidRef.current++` 를 적는 것 둘 중 하나여야 한다.
// 번호 없는 빈 줄(`{ name: '', sets: '', reps: '' }`)이 남아 있으면 그 길이 빠진 것이다
const bareRows = [...src.matchAll(/\{\s*name:\s*''\s*,\s*sets:\s*''\s*,\s*reps:\s*''\s*\}/g)];
// `blankRow` 의 정의 안에 있는 한 번은 빼고 센다
const bareOutside = bareRows.filter((m) => !src.slice(Math.max(0, m.index - 60), m.index).includes('uid: uidRef.current++'));
ok('번호 없는 빈 줄을 만드는 자리가 없다', bareOutside.length, 0);
ok('  채우는 길이 다 blankRow 를 쓴다', (src.match(/blankRow\(\)/g) || []).length >= 5, true);

// ── 개수로 세지 않는다 ──
//
// 처음에는 `uid: uidRef.current++` 가 몇 번 나오나로 셌다. **그건 검사가 아니었다** —
// 메모 길에서 번호를 빼도 다른 세 자리가 개수를 채워서 통과했다(돌려보고 알았다).
//
// 밖에서 받아온 줄을 폼에 얹는 길은 **둘**이다 — 루틴 고치기(`r.exercises`)와
// 메모에서 옮기기(`routine.exercises`). 그 둘이 **번호를 붙이는지 자리를 직접 본다.**
const attaches = (re) => re.test(src);
ok('고치기 길이 번호를 붙인다',
  attaches(/r\.exercises[\s\S]{0,400}?uid: uidRef\.current\+\+/), true);
ok('  메모 길이 번호를 붙인다',
  attaches(/routine\.exercises\.map\(\(ex\) => \(\{ \.\.\.ex, uid: uidRef\.current\+\+ \}\)\)/), true);
// 「받아온 줄을 그대로 얹지 않는다」를 **한 줄 더 두려다 걷어냈다.**
// `exercises: routine.exercises(?!\.map)` 로 적었더니 삼항의 조건
// (`routine.exercises.length ? …`)에 걸려 **멀쩡한 코드를 실패로** 만들었다.
// 위의 두 줄이 이미 그 길을 보고 있다 — 돌려서 확인했다.

console.log('');
console.log('── 줄 번호가 서버로 새지 않는가 ──');
// 화면이 줄을 짚는 데만 쓰는 번호다. 보내면 서버가 그대로 담고, 다음에 받아온
// 루틴에 옛 번호가 섞여 들어와 새 줄의 번호와 겹칠 수 있다
ok('저장하기 전에 uid 를 벗긴다', /\.map\(\(\{ uid, \.\.\.rest \}\) => rest\)/.test(src), true);

console.log('\n' + (bad ? `${bad}건 실패` : '전부 통과'));
process.exit(bad ? 1 : 0);
