// 찾기 차례 — **같은 칸이면 그 갈래의 대표가 위다** (2026-11-12, 맵시) — `src/data/exerciseDict.js`
//
// 「벤치」를 치면 「벤치 딥스」가 첫째였다. 「벤치프레스」와 둘 다 「앞이 맞음」(60)이라
// 가나다로 갈렸고 띄어쓰기가 앞섰다. 「벤치」를 치는 사람은 거의 다 벤치프레스를 찾는다.
//
//   node scripts/check-searchorder.cjs
//   node scripts/check-searchorder.cjs --src <사본의 exerciseDict.js>   (되돌려 보기용)
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const i = process.argv.indexOf('--src');
const entry = i > 0 ? process.argv[i + 1] : 'src/data/exerciseDict.js';
const out = path.join(process.cwd(), '.so1.cjs');
esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node', logLevel: 'silent' });
const { searchExercises } = require(out);
fs.unlinkSync(out);

let bad = 0;
const ok = (name, got, want) => {
  const pass = got === want;
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const first = (q) => searchExercises(q, 5)[0]?.ko ?? null;

ok('「벤치」 첫째는 벤치프레스 (벤치 딥스가 아니다)', first('벤치'), '벤치프레스');
ok('「bench」 도 같다', first('bench'), '벤치프레스');
ok('「ㅂㅊ」(초성) 도 같다', first('ㅂㅊ'), '벤치프레스');
ok('「스쿼」 첫째는 스쿼트', first('스쿼'), '스쿼트');
ok('「데드」 첫째는 데드리프트 (데드버그 · 데드행이 아니다)', first('데드'), '데드리프트');
// **대표라고 더 잘 맞은 것을 밀어내지 않는다** — 칸(100/60/40…)은 그대로다
ok('딱 맞는 이름은 그대로 첫째 (「벤치 딥스」)', first('벤치 딥스'), '벤치 딥스');
ok('딱 맞는 이름은 그대로 첫째 (「데드행」)', first('데드행'), '데드행');

console.log(bad ? `\n${bad}건 FAIL` : '\n찾기 차례 — 전부 통과');
process.exit(bad ? 1 : 0);
