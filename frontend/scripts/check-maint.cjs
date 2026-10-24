// 점검 스케줄의 **수정 폼** (2026-10-24).
//
//   npm run maint     (npm run check 에도 들어 있다)
//
// ── 왜 생겼나 ──
//
// 날짜로 잡은 점검(긴급 · 서버 · 정기 셋 다)의 「수정」을 누르면 관리자 화면이
// **흰 화면**이 됐다 — `form.days.includes` 가 `undefined` 를 읽었다.
//
// 같은 줄이 **두 모양**이었기 때문이다. 화면이 만들 때는 `days: []` 를 달고,
// 서버(`backend/src/routes/maintenance.js` 의 `clean`)는 날짜가 있으면 그 칸을
// 아예 안 만든다. 저장하면 화면이 **서버가 돌려준 줄로 갈아끼우므로**, 저장한
// 뒤부터 그 줄에는 `days` 가 없다.
//
// **여기가 지키는 것은 「서버가 돌려준 줄을 폼에 올릴 수 있는가」다.** 눈으로 보려면
// 관리자로 들어가 점검을 잡고 저장한 다음 수정을 눌러야 하는데, 점검은 **모든
// 사용자를 막는 것**이라 그렇게 확인하기 어렵다. 그래서 값으로 본다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const F = bundle('src/data/maintForm.js', '.m1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 서버의 `clean` 이 돌려주는 **그 모양**이다 (날짜가 있으면 `days` 칸이 없다).
// 이 줄을 손으로 적지 않으려고 서버 쪽 함수를 그대로 꺼내 쓴다 — 두 벌로 적어두면
// 서버가 모양을 바꿀 때 이 검사가 거짓으로 통과한다
const serverClean = (() => {
  const src = fs.readFileSync('../backend/src/routes/maintenance.js', 'utf-8');
  const body = src.slice(src.indexOf('function clean'), src.indexOf('// 누구나 읽는다'));
  return new Function('sanitize', body + '; return clean;')((s) => s);
})();

const DATED = serverClean({ date: '2026-10-25', startHour: 3, startMin: 0, durationMin: 60, reason: '긴급 점검', type: 'emergency', days: [] });
const WEEKLY = serverClean({ startHour: 4, startMin: 0, durationMin: 60, reason: '정기 점검', days: [1, 3, 5] });

console.log('── 서버가 돌려주는 모양 ──');
ok('날짜짜리에는 요일 칸이 없다 (이것이 화면을 터뜨렸다)', 'days' in DATED, false);
ok('  요일짜리에는 날짜 칸이 없다', 'date' in WEEKLY, false);

console.log('');
console.log('── 수정 폼에 올린다 ──');
// **고치기 전에는 여기서 터졌다.** `{ ...DATED }` 를 그대로 폼으로 썼다
ok('날짜짜리를 올려도 요일이 배열이다', Array.isArray(F.formOf(DATED).days), true);
ok('  요일 단추 일곱 개를 그려도 안 터진다',
  [0, 1, 2, 3, 4, 5, 6].map((i) => F.formOf(DATED).days.includes(i)),
  [false, false, false, false, false, false, false]);
ok('  날짜 · 종류는 그대로 들고 간다', [F.formOf(DATED).date, F.formOf(DATED).type], ['2026-10-25', 'emergency']);
ok('요일짜리는 고른 요일이 그대로 뜬다', F.formOf(WEEKLY).days, [1, 3, 5]);
ok('빈 값 · 이상한 값도 안 터진다',
  [Array.isArray(F.formOf(null).days), Array.isArray(F.formOf({ days: 3 }).days)], [true, true]);

console.log('');
console.log('── 폼을 다시 줄로 내린다 ──');
// 저장 전후로 모양이 달라지면, 그 차이를 읽는 자리가 또 터진다
ok('날짜짜리에는 요일을 안 적는다', 'days' in F.entryOf(DATED, F.formOf(DATED)), false);
ok('  날짜 하루짜리가 「매일」 로 바뀌지 않는다', F.entryOf(DATED, F.formOf(DATED)).date, '2026-10-25');
ok('  시각 · 사유는 고친 것이 들어간다',
  (() => { const e = F.entryOf(DATED, { ...F.formOf(DATED), startHour: 5, reason: '고침' }); return [e.startHour, e.reason]; })(),
  [5, '고침']);
ok('요일짜리는 요일을 고칠 수 있다', F.entryOf(WEEKLY, { ...F.formOf(WEEKLY), days: [0, 6] }).days, [0, 6]);
ok('새로 만들면 평일 새벽 4시다', [F.NEW_FORM.days, F.NEW_FORM.startHour], [[1, 2, 3, 4, 5], 4]);
ok('  숫자로 적어 보낸 시각도 숫자가 된다', F.entryOf({}, { startHour: '5', startMin: '30', durationMin: '45', days: [] }).startHour, 5);

console.log('');
console.log('── 요일 단추를 아예 안 보여주는 자리 ──');
ok('날짜짜리는 요일 반복이 아니다', [F.repeats(DATED), F.repeats(WEEKLY)], [false, true]);

// 화면이 **그 판단을 쓰는가.** 날짜짜리에 요일 일곱 개를 그려놓으면 눌러도
// 아무 일이 없다 — `runsOn` 이 날짜가 있으면 요일을 안 읽는다
const admin = fs.readFileSync('src/components/admin/MaintAdmin.jsx', 'utf-8');
ok('수정 폼이 repeats 로 갈라 그린다', /\{!repeats\(form\)/.test(admin), true);
ok('  폼을 직접 만들지 않는다 (formOf 를 지난다)', /setForm\(\{\s*\.\.\.schedules\[/.test(admin), false);

console.log('');
console.log(bad === 0 ? '모두 통과' : bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
