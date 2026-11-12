// 찾기에서 내 기록도 · 이름이 갈린 운동 (2026-11-12, 시안 1112 C · D) — `src/data/searchMine.js`
//
//   node scripts/check-searchmine.cjs
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};
const { mineFor, MINE_MAX } = bundle('src/data/searchMine.js', '.sm1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const TODAY = '2026-11-12';
const row = (exercise, weight, reps, extra = {}) => ({ exercise, weight, sets: 3, reps, ...extra });
const W = {
  '2026-10-01': [row('데드리프트', '120', 5), row('데드리프트', '120', 5), row('데드리프트', '120', 5)],
  '2026-10-14': [row('데드리프트', '140', 3)],
  '2026-11-03': [row('루마니안 데드리프트', '80', 10)],
  '2026-11-20': [row('데드리프트', '200', 1)],                       // 앞날
  '2026-11-08': [row('벤치프레스', '100', 3)],
  '2026-11-01': [row('벤치 프레스', '90', 5)],
  '2026-11-02': [row('벤치 프레스', '90', 5), row('벤치프레스', '95', 3)],
  '2026-11-05': [row('푸시업', '맨몸', 25)],
  '2026-11-06': [row('Push Up', '맨몸', 20)],
};
const m = (q) => mineFor(W, q, TODAY);

{
  const r = m('데드');
  ok('맞는 이름이 나온다', r.map((x) => x.name), ['데드리프트', '루마니안 데드리프트']);
  ok('  「일」은 날 수다 (한 날 세 줄은 하루)', r[0].days, 2);
  ok('  앞날 줄은 안 센다 — 마지막 날', r[0].lastDate, '2026-10-14');
  ok('  최고는 앞날 200kg 이 아니다', r[0].best, { kind: 'weighted', kg: 140, reps: 3 });
}
ok('맨몸은 횟수로', m('푸시업')[0].best, { kind: 'bodyweight', kg: null, reps: 25 });
ok('맞는 게 없으면 빈 칸 (칸을 안 그린다)', m('스쿼트'), []);
ok('빈 말이면 빈 칸', m('  '), []);
ok('많아야 둘', m('데').length <= MINE_MAX, true);

{
  const r = m('벤치');
  ok('D · 띄어쓰기만 다른 이름은 한 줄로 묶는다', r.length, 1);
  ok('  대표는 날이 많은 쪽 (같으면 사전 이름)', r[0].name, '벤치프레스');
  ok('  딸린 줄 — 이름 · 날 수 · 마지막 날', r[0].split, { names: ['벤치 프레스'], days: 2, lastDate: '2026-11-02' });
  ok('  띄어 친 말로 찾아도 같다', m('벤치 프')[0]?.name, '벤치프레스');
}
ok('D · 대소문자 · 띄어쓰기만 다른 영어 이름', mineFor({
  '2026-11-01': [row('Push Up', '맨몸', 20)], '2026-11-02': [row('push up', '맨몸', 21)],
  '2026-11-03': [row('PushUp', '맨몸', 22)],
}, 'push', TODAY)[0]?.split?.names.length, 2);
// 사전에는 「덤벨컬」만 있다(「덤벨 컬」은 없다) — 사전에 없는 쪽이 사전 이름에 묶인다
ok('D · 사전에 없는 띄어쓴 이름은 사전 이름으로 묶인다', mineFor({
  '2026-11-01': [row('덤벨 컬', '10', 10)], '2026-11-02': [row('덤벨 컬', '10', 10)], '2026-11-03': [row('덤벨컬', '10', 10)],
}, '컬', TODAY).map((x) => [x.name, x.split?.names]), [['덤벨 컬', ['덤벨컬']]]);
// **사전에 둘 다 따로 있으면** 열쇠가 갈린다 — 지금 사전에는 그런 짝이 없다(221 개를 맞춰 봤다).
// 그래서 값 대신 짜임을 본다: 사전 이름은 제 이름을 열쇠에 붙여 따로 무리를 이룬다
{
  const src = fs.readFileSync('src/data/searchMine.js', 'utf-8');
  ok('D · **사전에 둘 다 따로 있으면 진짜 다른 운동** — 열쇠가 갈린다',
    /loose\(e\.name\) \+ \(hasExercise\(e\.name\) \? `::\$\{e\.name\}` : ''\)/.test(src), true);
}
ok('D · 묶인 이름은 따로 줄로 안 나온다', m('벤치 프레스').filter((x) => x.name === '벤치 프레스').length, 0);
ok('남의 앞날 · 빈 기록에도 터지지 않는다', mineFor(null, '벤치', TODAY), []);

// 화면이 이은 자리
{
  const page = fs.readFileSync('src/pages/SearchPage.jsx', 'utf-8');
  const finder = fs.readFileSync('src/components/ExerciseFinder.jsx', 'utf-8');
  ok('로그인 안 했으면 안 그린다', /above=\{loggedIn \?/.test(page), true);
  ok('줄 = 기록하기 (/train)', /onRecord=\{\(name\) => navigate\('\/train'/.test(page), true);
  ok('그날 = 기록 화면 그 날', /onDay=\{\(date\) => navigate\('\/history', \{ state: \{ date \} \}\)\}/.test(page), true);
  ok('말: 「일」 · 「띄어쓰기만 달라요」 (「번」이 아니다)', /\$\{r\.days\}일/.test(page) && /띄어쓰기만 달라요 ›/.test(page) && !/번 적었어요/.test(page), true);
  ok('  「으로/로」를 이름에 맞춘다', /euroJosa\(r\.split\.names\[0\]\)\}도/.test(page), true);
  ok('찾기 부품: 끼울 자리는 입력 칸 아래 · 사전 결과 위', /\{above && above\(query\)\}\s*\{results\.length > 0/.test(finder), true);
  ok('  안 주면 아무것도 안 그린다 (다른 두 화면은 그대로)', /above = null/.test(finder), true);
  // **칠 때마다 세지 않는다** — 3만 줄에서 한 글자 33.8ms → 0.63ms (2026-11-12 재봤다)
  ok('셈은 기록이 바뀔 때만 (useMemo · mineIndex)', /useMemo\(\(\) => \(loggedIn \? mineIndex\(workouts, today\)/.test(page), true);
  ok('  칠 때는 거르기만 (mineQuery)', /rows=\{mineQuery\(mine, query\)\}/.test(page) && !/mineFor\(/.test(page), true);
  // 낭독기 (맵시) — 보이는 것보다 덜 들으면 안 된다
  ok('낭독기: 줄 이름에 최고 기록도', /기록하기 — \$\{r\.days\}일 했어요\$\{bestText\(r\.best\)\}/.test(page), true);
  ok('  D 줄은 보이는 글 그대로 읽힌다 (aria-label 로 안 덮는다)', !/aria-label="그 이름 날 보기"/.test(page), true);
}
{

  const m2 = bundle('src/data/searchMine.js', '.sm2.cjs');
  const index = m2.mineIndex(W, TODAY);
  ok('미리 센 것과 한 번에 센 것이 같다', JSON.stringify(m2.mineQuery(index, '벤치')) === JSON.stringify(m2.mineFor(W, '벤치', TODAY)), true);
  ok('  미리 센 것은 친 말과 상관없이 다 든다', index.length >= 5, true);
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
