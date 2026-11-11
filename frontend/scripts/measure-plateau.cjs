// **「몇 주째 제자리인가」를 붙이면 누가 무엇을 보게 되나 — 재는 자** (2026-11-11).
//
//   npm run plateaudata            (로컬 기록부 `backend/blackiron.json` 을 본다)
//   npm run plateaudata -- <길>    (다른 기록부 파일)
//
// ── 왜 ──
//
// 11/09 에 기능을 권하면서 **「밀기가 당기기의 네 배」라는 수를 내가 지어냈다.**
// 그 수가 결론까지 끌고 갔고, 실제로 재니 **1.24배**였다. 그래서 그 뒤로는 기능을
// 붙일지 말지를 **재서** 말한다 (`measure-pushpull.cjs` 가 그때 선 자다).
//
// 이 자가 답하는 것은 하나다 — **이 기능이 실제 기록부에서 몇 번 말을 거나.**
// 걸리는 것이 0 이면 그 기능은 **붙여도 아무도 못 본다**(「조용히 없는 기능」).
// 그러면 붙이는 자리를 바꾸거나, 선(`FLAT_DAYS`)을 다시 정해야 한다.
//
// ★ **판정은 하지 않는다.** 수만 적는다 — 고를 사람은 주인이고, 판정은 정석이다.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const DB = process.argv[2] || path.join('..', 'backend', 'blackiron.json');

const bundle = (entry, out) => {
  esbuild.buildSync({
    entryPoints: [entry], bundle: true, format: 'cjs', outfile: out,
    platform: 'node', logLevel: 'silent',
  });
  const m = require(path.resolve(out));
  fs.unlinkSync(out);
  return m;
};
const P = bundle('src/data/plateau.js', '.plateau-measure.cjs');

if (!fs.existsSync(DB)) {
  console.log('기록부를 못 찾았다: ' + DB);
  console.log('(배포본 Postgres 는 여기서 안 본다 — 로컬 파일이나 내려받은 사본을 준다)');
  process.exit(2);
}
const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const rows = Array.isArray(db.workouts) ? db.workouts : [];

// 서버 줄(평평한 배열)을 **화면이 받는 꼴**(날짜 → 목록)로 바꾼다.
// 화면과 **같은 꼴로** 먹여야 재는 것이 뜻이 있다
const byUser = new Map();
for (const r of rows) {
  if (!byUser.has(r.user_id)) byUser.set(r.user_id, {});
  const w = byUser.get(r.user_id);
  (w[r.date] = w[r.date] || []).unshift(r);
}

// **오늘**은 그 사람의 **마지막 기록일**로 삼는다. 진짜 오늘로 재면 석 달 전에
// 떠난 시험 계정이 전부 「쉼」으로 깔려 **제자리가 0 으로 보인다**
const lastDayOf = (w) => Object.keys(w).sort().pop() || null;

const 요약 = { 사람: 0, 말건사람: 0, 제자리운동: 0, 쉼운동: 0, 늘고있는운동: 0, 말못함: 0, 횟수로본것: 0 };
const 줄 = [];

for (const [uid, w] of byUser) {
  const today = lastDayOf(w);
  const names = new Set();
  for (const list of Object.values(w)) for (const r of list) if (r.exercise) names.add(r.exercise.trim());
  요약.사람 += 1;
  let 걸림 = 0;
  for (const name of names) {
    const s = P.plateauOf(w, name, today);
    if (!s) { 요약.말못함 += 1; continue; }
    if (s.metric === 'reps') 요약.횟수로본것 += 1;
    if (s.kind === 'flat') { 요약.제자리운동 += 1; 걸림 += 1; }
    else if (s.kind === 'rest') 요약.쉼운동 += 1;
    else 요약.늘고있는운동 += 1;
    줄.push({ uid, name, ...s });
  }
  if (걸림 > 0) 요약.말건사람 += 1;
}

const pad = (s, n) => String(s).padEnd(n);
console.log('기록부: ' + DB + ' · 운동 줄 ' + rows.length + ' · 기록 있는 사람 ' + 요약.사람
  + ' / 계정 ' + ((db.users || []).length));
console.log('선: 제자리 ' + P.FLAT_DAYS + '일 · 쉼 ' + P.REST_DAYS + '일 · 최고 뒤 ' + P.MIN_AFTER + '판\n');

console.log('── 사람마다 무엇을 보게 되나 ──');
for (const [uid, w] of byUser) {
  const today = lastDayOf(w);
  const mine = 줄.filter((x) => x.uid === uid);
  const flat = mine.filter((x) => x.kind === 'flat');
  const 본다 = flat.length
    ? flat.map((x) => x.name + ' ' + x.weeks + '주').join(' · ')
    : (mine.length ? '(칸이 안 뜬다)' : '(말할 것이 없다 — 서로 다른 날이 둘 미만)');
  console.log('  user ' + pad(uid, 5) + ' 마지막 ' + pad(today, 12) + 본다);
}

console.log('\n── 걸린 운동 전부 (오래된 것부터) ──');
console.log('  ' + pad('운동', 20) + pad('주', 4) + pad('단위', 5) + pad('최고', 9) + pad('최고날', 12) + '최고뒤판');
for (const x of 줄.filter((y) => y.kind === 'flat').sort((a, b) => b.days - a.days)) {
  console.log('  ' + pad(x.name, 20) + pad(x.weeks, 4) + pad(x.unit, 5) + pad(x.best.value, 9)
    + pad(x.best.date, 12) + x.after);
}

console.log('\n── 선을 다르게 잡으면 몇 개가 걸리나 ──');
// `FLAT_DAYS` 를 바꿔 끼울 수는 없으니(상수다) **같은 셈을 날수로 다시 센다** —
// `plateauOf` 가 준 `days` · `after` · `idle` 로 가른다. 손을 또 만드는 것이 아니다
const 후보 = 줄.filter((x) => x.kind !== 'rest' && x.after >= P.MIN_AFTER);
for (const 주 of [2, 3, 4, 6, 8]) {
  const hit = 후보.filter((x) => x.days >= 주 * 7);
  console.log('  ' + 주 + '주: ' + hit.length + '개'
    + (hit.length ? ' — ' + hit.map((x) => x.name + '(' + x.days + '일)').join(', ') : ''));
}

console.log('\n── 한눈에 ──');
console.log('  제자리 ' + 요약.제자리운동 + ' · 쉼 ' + 요약.쉼운동 + ' · 늘고 있다 ' + 요약.늘고있는운동
  + ' · 말 못 함 ' + 요약.말못함);
console.log('  그중 **횟수로 본 것**(맨몸) ' + 요약.횟수로본것 + '개 — 무게로만 보면 이 수가 0 이 된다');
console.log('  칸이 뜨는 사람 ' + 요약.말건사람 + ' / 기록 있는 사람 ' + 요약.사람);
if (요약.말건사람 === 0) {
  console.log('\n  ★ **이 기록부에서는 아무에게도 말을 걸지 않는다.** 붙이면 「조용히 없는 기능」이 된다 —');
  console.log('     붙이는 자리(홈 칸 vs 그 운동 화면)와 선을 다시 정해야 한다.');
}
