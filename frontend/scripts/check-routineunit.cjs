// 루틴 줄의 단위를 두 번 안 붙인다 (2026-11-12) — `src/data/setRange.js` 의 `unitOf` · `isPlainNum`
//
//   node scripts/check-routineunit.cjs
//
// 추천 루틴은 sets · reps 를 「4세트」 · 「8~10회」 · 「40초」처럼 **단위까지 적힌 글**로 든다.
// 그것을 내 루틴으로 담으면 카드가 「4세트세트 · 10회회」, 플랭크는 「40초회」를 찍었다(맵시가 잡았다).
// 그리고 고치는 폼의 숫자 칸은 그 글을 **빈 칸으로** 보여줬다
const esbuild = require('esbuild');
const fs = require('fs');

const out = process.cwd() + '/.ru1.cjs';
esbuild.buildSync({ entryPoints: ['src/data/setRange.js'], bundle: true, format: 'cjs', outfile: out, platform: 'node', logLevel: 'silent' });
const { unitOf, isPlainNum } = require(out);
fs.unlinkSync(out);

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

ok('맨 숫자에는 단위를 붙인다', [unitOf(4, '세트'), unitOf('10', '회')], ['4세트', '10회']);
ok('**이미 적힌 단위는 또 안 붙인다**', [unitOf('4세트', '세트'), unitOf('8~10회', '회')], ['4세트', '8~10회']);
ok('  다른 단위도 그대로 (「40초회」가 아니다)', unitOf('40초', '회'), '40초');
ok('  범위 글도 그대로', unitOf('10~12', '회'), '10~12');
ok('비었으면 빈 글 (「· 세트」를 안 찍는다)', [unitOf('', '세트'), unitOf(null, '세트'), unitOf('  ', '회')], ['', '', '']);
ok('폼 칸: 맨 숫자 · 빈 칸만 숫자 칸', [isPlainNum('4'), isPlainNum(''), isPlainNum(12)], [true, true, true]);
ok('  글이 담기면 글 칸 (숫자 칸은 빈 칸으로 보여준다)', [isPlainNum('4세트'), isPlainNum('8~10회'), isPlainNum('40초')], [false, false, false]);

{
  const rp = fs.readFileSync('src/pages/RoutinePage.jsx', 'utf-8');
  ok('루틴 카드가 unitOf 로 그린다', /unitOf\(ex\.sets, '세트'\)/.test(rp) && /unitOf\(ex\.reps, '회'\)/.test(rp), true);
  ok('  옛 꼴(`${ex.sets}세트`)이 안 남았다', /\$\{ex\.sets\}세트|\$\{ex\.reps\}회/.test(rp), false);
  ok('고치는 폼: 글이 담기면 글 칸', /type=\{isPlainNum\(ex\.sets\) \? 'number' : 'text'\}/.test(rp) && /type=\{isPlainNum\(ex\.reps\) \? 'number' : 'text'\}/.test(rp), true);
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
