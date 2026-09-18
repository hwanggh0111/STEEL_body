// 사람이 한 일을 덮어쓰지 않는가 (2026-09-18).
//
//   npm run stale     (npm run check 에도 들어 있다)
//
// 네 자리 모두 **한 가지 모양**의 잘못이었다 — 화면이 들고 있는 값과 실제로 저장될
// 값이 어긋나거나, 새로 받아온 것이 사람이 고른 것을 밀어낸다.
//
//   · 기구 세팅 폼이 **운동이 바뀌어도 그대로 남아**, 앞 운동의 값이 새 운동 이름으로 저장
//   · 직접 입력 칸이 **스스로 비어서** 「12」를 칠 수 없다
//   · 견주기의 고른 두 장을 **새로고침이 처음·나중으로 되돌린다**
//   · 저장 직후의 다시 받기가 **저장 전에 떠난 요청**을 기다려, 방금 넣은 것이 없는 목록을 받는다
//
// 넷 다 **값으로는 안 보인다** — 화면을 며칠 굴려야 한 번 걸리는 자리다. 그래서 코드를 본다.
// (2026-09-18 코드 리뷰가 잡은 것이고, 같은 자리로 돌아오지 않게 여기 박아둔다.)
const fs = require('fs');

const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');
const read = (f) => codeOf(fs.readFileSync(f, 'utf-8'));

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 기구 세팅 폼이 운동을 따라가는가 ──');
const gym = read('src/components/GymSetting.jsx');
// **참/거짓이 아니라 운동 이름을 든다.** 이름이 바뀌는 순간 폼이 저절로 닫히므로
// 한 프레임도 어긋난 채로 안 그려진다 (effect 로 닫으면 그 한 프레임이 생긴다)
ok('펴둔 것이 어느 운동 것인지 들고 있다', /const \[editFor, setEditFor\] = useState\(null\)/.test(gym), true);
ok('  이 운동 것일 때만 폼을 그린다', /if \(editFor === name\)/.test(gym), true);
ok('  참/거짓으로 돌아가지 않았다', /\[editing, setEditing\]/.test(gym), false);

console.log('');
console.log('── 직접 입력 칸 ──');
// `options.includes(value) ? '' : value` 로 그리면 「12」를 치려고 `1` 을 누른 순간
// 값이 칩과 같아져 **칸이 스스로 빈다** — 1~6 으로 시작하는 두 자리를 못 친다
ok('칸이 제가 친 것을 들고 있다', /const \[typed, setTyped\] = useState\(/.test(gym), true);
ok('  스스로 비우지 않는다', /value=\{options\.includes\(value\) \? '' : \(value \|\| ''\)\}/.test(gym), false);
// 칩으로 고른 뒤에도 칸에 옛 글자가 남으면 두 곳이 서로 다른 말을 한다
ok('  칩을 누르면 칸을 비운다', /const pick = \(v\) => \{ setTyped\(''\); onPick\(v\); \};/.test(gym), true);

console.log('');
console.log('── 견주기: 고른 두 장 ──');
const compare = read('src/pages/ComparePage.jsx');
// 머리에 새로고침이 생긴 뒤로는 보고 있는 동안에도 `records` 가 새 것으로 바뀐다.
// 그때마다 처음·나중으로 되돌리면 5월과 8월을 골라둔 사람의 선택이 사라진다
ok('줄 수가 달라졌을 때만 다시 놓는다', /placedFor\.current === records\.length/.test(compare), true);
ok('  목록을 다시 받은 것만으로는 안 되돌린다',
  /\}, \[records\]\);/.test(compare) && !/placedFor/.test(compare), false);

console.log('');
console.log('── 저장 직후의 다시 받기 ──');
// `force` 를 쓰는 자리는 「방금 저장했으니 다시 받아라」다. 날아가 있는 요청은
// **저장 전에 떠난 것일 수 있어서**, 그것을 기다려 받으면 방금 넣은 것이 없는 목록이 온다
for (const f of ['src/store/workoutStore.js', 'src/store/inbodyStore.js',
                 'src/store/goalStore.js', 'src/store/gymStore.js']) {
  const src = read(f);
  const name = f.split('/').pop();
  ok(`${name} — force 가 날아가 있는 요청을 이긴다`, /if \(!force\) return inflight;/.test(src), true);
  ok(`  ${name} — 기다린 뒤 한 번 더 받는다`, /waiting\.then\(/.test(src), true);
  // 조건 없이 돌려주면 위 일이 다시 생긴다
  ok(`  ${name} — 조건 없이 돌려주지 않는다`, /^\s*if \(inflight\) return inflight;$/m.test(src), false);
}

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('전부 통과');
