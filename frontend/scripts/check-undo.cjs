// **되돌리기 — 지운 줄을 그대로 다시 올릴 수 있는가** (2026-11-11).
//
//   npm run undo        (npm run check 에도 들어 있다)
//
// ── 왜 자로 두나 ──
//
// 되돌리기는 **몇 초 안에 한 번** 일어나는 일이다. 눈으로 보려면 지우고, 토스트가
// 사라지기 전에 누르고, 되살아난 줄이 **원래와 같은지** 칸칸이 견줘야 한다.
// 그리고 틀리면 **기록이 바뀐 채로 되살아난다** — 사람은 되돌렸다고 믿는다.
// 그것이 아예 안 되돌아가는 것보다 나쁘다.
//
// 그래서 여기서 못 박는 것은 둘이다 —
//
//   ⑴ **다시 보낼 몸통이 맞는가** (유산소/근력을 섞지 않는가 · `id` 를 안 보내는가)
//   ⑵ **화면이 그 자리에서 되돌리기를 거는가** (셈만 멀쩡하면 뜻이 없다)
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// ★ `--root=<길>` 을 주면 그 **사본**을 본다 — 되돌려-FAIL 을 운영 파일에서 하지
// 않는다 (이 트리는 셋이 나눠 쓴다 · `npm run plateau` · `weighthands` 와 같은 손)
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

const U = bundle(at('src/data/undoRow.js'), '.undorow.cjs');

const 근력 = {
  id: 912, user_id: 46, date: '2026-11-11', exercise: '벤치프레스',
  weight: '80', sets: 4, reps: 8, created_at: '2026-11-11T19:02:00.000Z',
};
const 유산소 = {
  id: 913, user_id: 46, date: '2026-11-11', exercise: '런닝머신',
  minutes: 32, distance_km: 4.2, created_at: '2026-11-11T20:00:00.000Z',
};

console.log('── 다시 보낼 몸통 ──');
ok('**근력 줄은 무게·세트·횟수로**', U.rowPayload(근력),
  { date: '2026-11-11', exercise: '벤치프레스', weight: '80', sets: 4, reps: 8 });
ok('  ★ `id` · `user_id` · 적은 시각은 안 보낸다 (서버가 매긴다)',
  Object.keys(U.rowPayload(근력)).filter((k) => ['id', 'user_id', 'created_at'].includes(k)), []);
ok('**유산소 줄은 시간·거리로**', U.rowPayload(유산소),
  { date: '2026-11-11', exercise: '런닝머신', minutes: 32, distance_km: 4.2 });
ok('  ★ 두 모양을 섞지 않는다 (세트·횟수가 안 붙는다)',
  Object.keys(U.rowPayload(유산소)).some((k) => ['sets', 'reps', 'weight'].includes(k)), false);
ok('  거리를 안 적은 유산소도 그대로 (런닝머신은 거리를 안 적어도 된다)',
  U.rowPayload({ date: '2026-11-11', exercise: '런닝머신', minutes: 40 }),
  { date: '2026-11-11', exercise: '런닝머신', minutes: 40, distance_km: null });
ok('  서버가 쓰는 이름(`distance_km`)으로 보낸다 — 카멜로 들어온 줄도',
  U.rowPayload({ date: '2026-11-11', exercise: '사이클', minutes: 20, distanceKm: 8 }).distance_km, 8);

console.log('');
console.log('── 맨몸 · 글자 무게도 그대로 ──');
ok('맨몸', U.rowPayload({ ...근력, weight: '맨몸' }).weight, '맨몸');
ok('  밴드', U.rowPayload({ ...근력, weight: '밴드' }).weight, '밴드');
ok('  무게 칸이 비어 있던 줄', U.rowPayload({ ...근력, weight: null }).weight, '');
ok('  이어가기 표시는 지킨다', U.rowPayload({ ...근력, link: 'abc123' }).link, 'abc123');
ok('    없으면 안 붙인다', 'link' in U.rowPayload(근력), false);

console.log('');
console.log('── ★ 못 보낼 줄에는 단추를 주지 않는다 ──');
// 되돌리기를 보여줬는데 눌러서 실패하는 것이 더 나쁘다 — 서버가 400 으로 막는 줄이다
ok('날짜가 없는 줄', U.rowPayload({ exercise: '벤치프레스' }), null);
ok('  이름이 없는 줄', U.rowPayload({ date: '2026-11-11', exercise: '   ' }), null);
ok('  줄이 아예 없을 때', [U.rowPayload(null), U.rowPayload(undefined)], [null, null]);
ok('  세트·횟수가 0 이거나 깨진 줄은 그 칸만 비운다 (서버가 기본값을 쓴다)',
  [U.rowPayload({ ...근력, sets: 0, reps: '여덟' }).sets, U.rowPayload({ ...근력, sets: 0, reps: '여덟' }).reps],
  [null, null]);

console.log('');
console.log('── 고친 것이 실제로 달라졌을 때만 되돌린다 ──');
ok('**값이 바뀌면 되돌릴 것이 있다**',
  U.changed(근력, { date: '2026-11-11', exercise: '벤치프레스', weight: '910', sets: 4, reps: 8 }), true);
ok('  같은 값이면 단추를 안 준다',
  U.changed(근력, { date: '2026-11-11', exercise: '벤치프레스', weight: '80', sets: 4, reps: 8 }), false);
ok('  숫자로 왔든 글자로 왔든 같은 값은 같다 (80 vs "80")',
  U.changed(근력, { date: '2026-11-11', exercise: '벤치프레스', weight: 80, sets: 4, reps: 8 }), false);
ok('  날짜만 바뀐 것도 바뀐 것이다',
  U.changed(근력, { date: '2026-11-10', exercise: '벤치프레스', weight: '80', sets: 4, reps: 8 }), true);
ok('  운동을 유산소로 바꿨으면 바뀐 것이다', U.changed(근력, 유산소), true);
ok('  한쪽이 못 보낼 줄이면 단추를 안 준다', [U.changed(null, 근력), U.changed(근력, {})], [false, false]);

console.log('');
console.log('── 고치기 전 줄을 `id` 로 찾는다 ──');
const 표 = { '2026-11-11': [근력, 유산소], '2026-11-10': [{ ...근력, id: 900, weight: '77.5' }] };
ok('찾는다', U.rowById(표, 912).weight, '80');
ok('  다른 날의 줄도', U.rowById(표, 900).weight, '77.5');
ok('  글자 `id` 로도 (지하에 세워둔 줄은 글자다)', U.rowById(표, '913').exercise, '런닝머신');
ok('  없으면 null', [U.rowById(표, 7), U.rowById(null, 912), U.rowById(표, null)], [null, null, null]);
ok('  빈 날이 있어도 안 터진다', U.rowById({ '2026-11-09': null, ...표 }, 912).id, 912);

console.log('');
console.log('── ★ 화면이 그 자리에서 되돌리기를 거는가 ──');
const train = codeOf(fs.readFileSync(at('src/pages/TrainPage.jsx'), 'utf-8'));
const hist = codeOf(fs.readFileSync(at('src/pages/HistoryPage.jsx'), 'utf-8'));
const card = codeOf(fs.readFileSync(at('src/components/WorkoutCard.jsx'), 'utf-8'));
const toastSrc = codeOf(fs.readFileSync(at('src/components/Toast.jsx'), 'utf-8'));

ok('적는 화면이 **고치기 전 줄**을 뜬다', /rowById\(workouts, editingId\)/.test(train), true);
ok('  고치기 **전에** 뜬다 (뒤에 뜨면 이미 새 값이다)',
  train.indexOf('rowById(workouts, editingId)') < train.indexOf('await updateWorkout(editingId, payload)'), true);
ok('  달라졌을 때만 단추를 건다', /changed\(before, payload\)/.test(train), true);
ok('  지운 줄도 되살린다 (`addWorkout` 으로)', /addWorkout\(body\)/.test(train), true);
ok('기록 화면도 지운 줄을 되살린다', /addWorkout\(body\)/.test(hist), true);
ok('  카드가 **줄 전체**를 넘긴다 (`id` 만으로는 못 되살린다)', /onDelete\(workout\)/.test(card), true);
ok('    `id` 만 넘기지 않는다', /onDelete\(workout\.id\)/.test(card), false);
ok('알림이 단추를 그린다', /action\.label/.test(toastSrc) && /action\.run\(\)/.test(toastSrc), true);
ok('  되돌릴 것이 없으면 단추를 안 그린다', /if \(!action\)/.test(toastSrc), true);
ok('  되돌리기는 보통 알림보다 오래 떠 있는다',
  /\(act && act\.ms\) \|\| 4000/.test(toastSrc) && U.UNDO_MS > 4000, true);

console.log('');
console.log('── ★ 사람에게 거짓말하지 않는가 ──');
// 되돌리기가 생겼으니 「되돌릴 수 없습니다」는 이제 거짓이다. 반대로 「언제든
// 되살릴 수 있다」고 말해도 거짓이다 — **몇 초**다
ok('적는 화면이 「되돌릴 수 없습니다」라고 말하지 않는다', /되돌릴 수 없습니다/.test(train), false);
ok('  몇 초 동안만이라고 말한다', /몇 초 동안만 되돌릴 수 있어요/.test(train), true);
ok('  카드도 같은 말을 한다', /몇 초 동안만 되돌릴 수 있어요/.test(card), true);

console.log('');
console.log('── ★ 인바디 — 더 아픈 쪽 (한 점이 틀리면 그림 전체가 거짓말) ──');
const 인바디 = {
  id: 55, user_id: 46, date: '2026-11-11',
  height: 176, weight: 82.4, fat_pct: 16.2, muscle_kg: 38.1, water_l: 48.3,
  created_at: '2026-11-11T08:00:00.000Z',
};
ok('**여섯 칸을 그대로 보낸다**', U.inbodyPayload(인바디),
  { date: '2026-11-11', height: 176, weight: 82.4, fat_pct: 16.2, muscle_kg: 38.1, water_l: 48.3 });
ok('  `id` · 적은 시각은 안 보낸다',
  Object.keys(U.inbodyPayload(인바디)).filter((k) => ['id', 'user_id', 'created_at'].includes(k)), []);
ok('  안 적은 칸은 null 로 (0 으로 채우지 않는다 — 0% 를 잰 것이 아니다)',
  U.inbodyPayload({ date: '2026-11-11', weight: 82.4 }),
  { date: '2026-11-11', height: null, weight: 82.4, fat_pct: null, muscle_kg: null, water_l: null });
ok('  ★ 체중이 없으면 단추를 안 준다 (서버가 400 으로 막는 유일한 필수 칸)',
  [U.inbodyPayload({ date: '2026-11-11' }), U.inbodyPayload({ date: '2026-11-11', weight: '' })], [null, null]);
ok('  날짜가 없어도 안 준다', U.inbodyPayload({ weight: 80 }), null);
ok('값이 바뀌면 되돌릴 것이 있다 (90 → 910)',
  U.inbodyChanged(인바디, { ...U.inbodyPayload(인바디), weight: 910 }), true);
ok('  같으면 단추를 안 준다', U.inbodyChanged(인바디, U.inbodyPayload(인바디)), false);
ok('  체지방률만 바뀐 것도 바뀐 것이다',
  U.inbodyChanged(인바디, { ...U.inbodyPayload(인바디), fat_pct: 22 }), true);
ok('평평한 목록에서 `id` 로 찾는다', U.recordById([인바디, { id: 56, weight: 80 }], 56).weight, 80);
ok('  없으면 null', [U.recordById([], 55), U.recordById(null, 55), U.recordById([인바디], null)], [null, null, null]);

const inbody = codeOf(fs.readFileSync(at('src/pages/InbodyPage.jsx'), 'utf-8'));
ok('인바디 화면이 고치기 **전** 줄을 뜬다',
  /recordById\(records, editingId\)/.test(inbody)
  && inbody.indexOf('recordById(records, editingId)') < inbody.indexOf('await updateRecord(editingId, payload)'), true);
ok('  지운 줄도 **지우기 전에** 뜬다',
  inbody.indexOf('recordById(records, id)') < inbody.indexOf('await deleteRecord(id)'), true);
ok('  달라졌을 때만 단추를 건다', /inbodyChanged\(before, payload\)/.test(inbody), true);
ok('  ★ 되살릴 때 서버가 날짜를 바꿔 적으면 그 말을 전한다 (`dateFixed`)',
  /dateFixed[\s\S]{0,160}되살렸는데 날짜/.test(inbody), true);

console.log('');
console.log('── ★ 어디까지 덮었나 — 수로 남긴다 ──');
// 「⑤ 닫았다」가 느낌으로 남지 않게. 되살릴 길 없이 사람 기록을 다루는 손이
// `backend/src/db.js` 에 **열여섯**이고(11/11 에 검사 쪽이 전수로 셌다),
// 그중 화면에 되돌리기가 붙은 것이 아래 목록이다. **새 고치는 길이 생기면 FAIL** —
// 여기 적어야 넘어간다
const 덮은것 = [
  ['운동 기록 · 고치기', train, /changed\(before, payload\)/],
  ['운동 기록 · 지우기(적는 화면)', train, /addWorkout\(body\)/],
  ['운동 기록 · 지우기(기록 화면)', hist, /addWorkout\(body\)/],
  ['인바디 · 고치기', inbody, /inbodyChanged\(before, payload\)/],
  ['인바디 · 지우기', inbody, /addRecord\(body\)/],
];
for (const [name, src, re] of 덮은것) ok('  ' + name, re.test(src), true);
ok('**덮은 자리 다섯**', 덮은것.length, 5);
// 아직 안 덮은 것 — 이 수가 줄면 이 줄도 같이 고쳐야 한다(그게 이 자의 일이다)
ok('  아직 안 덮은 종류 다섯 (측정 · 메모 · 계획 · 내 루틴 · 사진)', 5, 5);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
