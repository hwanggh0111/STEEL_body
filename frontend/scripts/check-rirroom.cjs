// **여유를 쓴다** — 적어둔 여유를 맞게 세고, 권하지 않는가 (2026-11-25 · 맵시).
//
//   npm run rirroom     (npm run check 에도 들어 있다)
//   node scripts/check-rirroom.cjs --root=<사본>   사본을 본다 (되돌려-FAIL 은 사본에서 한다)
//
// ── 왜 자로 두나 ──
//
// 「같은 무게에서 세 번」을 눈으로 보려면 날짜를 바꿔 기록을 세 판 만들어야 한다.
// 그리고 이 줄은 **사람이 믿는 사실**이다 — 무게가 바뀐 날을 섞어 세거나 `1~2` 를
// 「세 개 이상」으로 세면 수가 거짓이 된다. 또 이 줄이 「올리세요」로 번지는 날
// (권하지 않는다는 약속)을 막는다.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const ROOT = (process.argv.find((a) => a.startsWith('--root=')) || '').slice(7) || '.';
const at = (rel) => path.join(ROOT, rel);

const bundle = (entry, out) => {
  esbuild.buildSync({
    entryPoints: [entry], bundle: true, format: 'cjs', outfile: out,
    platform: 'node', logLevel: 'silent',
  });
  const m = require(path.resolve(out));
  fs.unlinkSync(out);
  return m;
};

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const R = bundle(at('src/data/rirRoom.js'), '.rirroom.cjs');
const LIM = bundle(at('src/data/limits.js'), '.rirroom-limits.cjs');
const TODAY = '2026-11-25';

let seq = 0;
const row = (exercise, weight, rir, { date, link = null, t = '19:00' }) => ({
  id: (seq += 1), date, exercise, weight, sets: 5, reps: 5, rir, link,
  created_at: `${date}T${t}:00.000Z`,
});
const days = (...rows) => {
  const out = {};
  for (const r of rows) (out[r.date] = out[r.date] || []).unshift(r);
  return out;
};

console.log('── 같은 무게에서 「3개 이상」을 센다 ──');
const three = days(
  row('벤치프레스', '60', '3+', { date: '2026-11-14' }),
  row('벤치프레스', '60', '3+', { date: '2026-11-18' }),
  row('벤치프레스', '60kg', '3+', { date: '2026-11-24' }),
);
const r3 = R.rirRoom(three, '벤치프레스', TODAY);
ok('**세 번을 센다**', r3 && [r3.kg, r3.count, r3.dates], [60, 3, ['2026-11-24', '2026-11-18', '2026-11-14']]);
const t3 = R.rirRoomText(r3);
ok('  말이 수와 같다', t3.head, '60kg 에서 「세 개 이상 더 할 수 있었다」고 적은 날이 3번이에요.');
ok('  날짜는 오래된 것부터 읽힌다', t3.dates, '11/14 · 11/18 · 11/24 — 그 사이 무게는 그대로예요');

console.log('');
console.log('── 세지 않는 것 ──');
ok('한 번은 말하지 않는다',
  R.rirRoom(days(row('벤치프레스', '60', '3+', { date: '2026-11-24' })), '벤치프레스', TODAY), null);
// `1~2` 는 하나일 수도 있다 — 「세 개 이상」으로 세면 적지 않은 것을 센다
ok('`1~2` 는 세지 않는다', R.rirRoom(days(
  row('벤치프레스', '60', '1~2', { date: '2026-11-14' }),
  row('벤치프레스', '60', '1~2', { date: '2026-11-18' }),
  row('벤치프레스', '60', '3+', { date: '2026-11-24' }),
), '벤치프레스', TODAY), null);
// 무게가 바뀌면 거기서 멈춘다 — 옛 무게의 여유는 지금 무게의 사실이 아니다
const moved = R.rirRoom(days(
  row('벤치프레스', '60', '3+', { date: '2026-11-10' }),
  row('벤치프레스', '60', '3+', { date: '2026-11-14' }),
  row('벤치프레스', '62.5', '3+', { date: '2026-11-18' }),
  row('벤치프레스', '62.5', '3+', { date: '2026-11-24' }),
), '벤치프레스', TODAY);
ok('무게가 바뀌면 멈춘다', moved && [moved.kg, moved.count], [62.5, 2]);
ok('  사이에 다른 무게가 끼면 그 앞은 안 본다', R.rirRoom(days(
  row('벤치프레스', '60', '3+', { date: '2026-11-10' }),
  row('벤치프레스', '62.5', '0', { date: '2026-11-18' }),
  row('벤치프레스', '60', '3+', { date: '2026-11-24' }),
), '벤치프레스', TODAY), null);
// 적고 있는 날은 아직 안 끝났다
const writing = days(
  row('벤치프레스', '60', '3+', { date: '2026-11-18' }),
  row('벤치프레스', '60', '3+', { date: '2026-11-25' }),
);
ok('적고 있는 날은 뺀다', R.rirRoom(writing, '벤치프레스', TODAY, TODAY), null);
ok('  앞날도 뺀다', R.rirRoom(days(
  row('벤치프레스', '60', '3+', { date: '2026-11-18' }),
  row('벤치프레스', '60', '3+', { date: '2026-12-01' }),
), '벤치프레스', TODAY), null);
ok('드롭 줄의 여유는 안 센다', R.rirRoom(days(
  row('벤치프레스', '60', '3+', { date: '2026-11-18' }),
  row('벤치프레스', '60', '0', { date: '2026-11-24', t: '19:00' }),
  row('벤치프레스', '60', '3+', { date: '2026-11-24', t: '19:10', link: 'drop' }),
), '벤치프레스', TODAY), null);
ok('맨몸은 안 센다', R.rirRoom(days(
  row('풀업', '', '3+', { date: '2026-11-18' }),
  row('풀업', '', '3+', { date: '2026-11-24' }),
), '풀업', TODAY), null);
ok('다른 이름은 안 섞는다', R.rirRoom(days(
  row('벤치프레스', '60', '3+', { date: '2026-11-18' }),
  row('인클라인 벤치프레스', '60', '3+', { date: '2026-11-24' }),
), '벤치프레스', TODAY), null);

console.log('');
console.log('── 넷 이상이면 최근 셋만 적는다 ──');
const four = R.rirRoom(days(
  row('스쿼트', '100', '3+', { date: '2026-11-03' }),
  row('스쿼트', '100', '3+', { date: '2026-11-10' }),
  row('스쿼트', '100', '3+', { date: '2026-11-17' }),
  row('스쿼트', '100', '3+', { date: '2026-11-24' }),
), '스쿼트', TODAY);
ok('수는 전부', four && four.count, 4);
ok('  날짜는 최근 셋', R.rirRoomText(four).dates, '최근 11/10 · 11/17 · 11/24 — 그 사이 무게는 그대로예요');
ok('  없으면 빈 글', R.rirRoomText(null), { head: '', dates: '' });

console.log('');
console.log('── 칸의 말을 베끼지 않는다 · 권하지 않는다 ──');
ok('「3개 이상」은 여유 칸에서 읽는다', R.ROOM_RIR, LIM.RIR_VALUES[LIM.RIR_VALUES.length - 1]);
const said = [t3.head, t3.dates, R.rirRoomText(four).head, R.rirRoomText(four).dates].join(' ');
ok('「올리」 · 「권」 · 「세요」를 말하지 않는다', /올리|올려|권|세요/.test(said), false);

console.log('');
console.log('── 화면이 그 셈만 쓰는가 ──');
const page = codeOf(fs.readFileSync(at('src/pages/TrainPage.jsx'), 'utf-8'));
ok('기록 화면이 셈 자리를 불러 쓴다', /rirRoom\(workouts, exercise, today, date\)/.test(page), true);
ok('  두 토막을 다 그린다', /rirRoomText\(room\)\.head/.test(page) && /rirRoomText\(room\)\.dates/.test(page), true);
// 그 칸만 떼어 본다 — `{room && …(` 부터 그 짝 `)}` 까지
const start = page.indexOf('{room && !editingId && (');
ok('  고치는 중에는 안 그린다', start >= 0, true);
let block = '';
if (start >= 0) {
  let depth = 0;
  for (let i = start; i < page.length; i += 1) {
    const ch = page[i];
    if (ch === '(' || ch === '{') depth += 1;
    else if (ch === ')' || ch === '}') { depth -= 1; if (depth === 0) { block = page.slice(start, i + 1); break; } }
  }
}
ok('  그 칸이 금 옷을 안 입는다 (권하는 카드와 갈린다)', /--accent|--border-accent|gold/i.test(block), false);
ok('  그 칸이 비어 있지 않다', block.length > 0, true);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
