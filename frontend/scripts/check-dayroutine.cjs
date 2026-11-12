// 이 날을 루틴으로 (2026-11-12, 시안 1112 A) — `src/data/dayRoutine.js`
//
//   node scripts/check-dayroutine.cjs
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};
const { routineFromDay, fillNote } = bundle('src/data/dayRoutine.js', '.dr1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const t = (m) => `2026-11-08T10:${String(m).padStart(2, '0')}:00.000Z`;
// 기록 목록은 **최신이 위**다 — 그대로 넣어 본다
const DAY = [
  { id: 9, exercise: '러닝머신', minutes: 20, distance_km: 3, sets: null, reps: null, created_at: t(50) },
  { id: 8, exercise: '딥스', weight: '맨몸', sets: 3, reps: 12, created_at: t(40) },
  { id: 7, exercise: '케이블 플라이', weight: '15', sets: 3, reps: 15, link: 'super', created_at: t(35) },
  { id: 6, exercise: '벤치프레스', weight: '60', sets: 1, reps: 15, link: 'drop', created_at: t(20) },
  { id: 5, exercise: '벤치프레스', weight: '80', sets: 1, reps: 6, created_at: t(15) },
  { id: 4, exercise: '벤치프레스', weight: '80', sets: 3, reps: 8, created_at: t(10) },
  { id: 3, exercise: ' 벤치프레스 ', weight: '70', sets: 1, reps: 10, created_at: null },
];
const f = routineFromDay(DAY);
ok('적은 차례로 · 같은 운동은 한 줄', f.exercises.map((e) => e.name), ['벤치프레스', '케이블 플라이', '딥스']);
ok('  세트는 더한다 (드롭 줄은 빼고 · 시각 없는 줄도 센다)', f.exercises[0].sets, 5);
ok('  횟수는 **드롭 아닌 첫 줄** (평균이 아니다)', f.exercises[0].reps, 8);
ok('  슈퍼세트 줄은 그대로 담는다 (다른 운동이다)', f.exercises[1], { name: '케이블 플라이', sets: 3, reps: 15 });
ok('  맨몸도 담는다', f.exercises[2], { name: '딥스', sets: 3, reps: 12 });
ok('  무게 칸은 없다', f.exercises.every((e) => !('weight' in e)), true);
ok('뺀 것: 드롭 1줄 · 유산소(러닝머신)', f.dropped, { drop: 1, cardio: ['러닝머신'] });
ok('빈 날은 빈 것', routineFromDay([]), { exercises: [], dropped: { drop: 0, cardio: [] } });
ok('유산소뿐인 날은 담을 것이 없다 (단추를 안 그린다)', routineFromDay([DAY[0]]).exercises.length, 0);

ok('알림 — 머리', fillNote('2026-11-08', f).head, '11월 8일에 한 대로 채웠어요 · 운동 3개');
ok('  둘 다 뺐으면', fillNote('2026-11-08', f).tail, '무게는 루틴에 안 들어가요. 드롭세트 1줄과 유산소 1개(러닝머신)는 뺐어요.');
ok('  드롭만 뺐으면 「줄은」', fillNote('2026-11-08', { exercises: [1], dropped: { drop: 2, cardio: [] } }).tail, '무게는 루틴에 안 들어가요. 드롭세트 2줄은 뺐어요.');
ok('  안 뺐으면 무게 말만', fillNote('2026-11-08', { exercises: [1], dropped: { drop: 0, cardio: [] } }).tail, '무게는 루틴에 안 들어가요.');
ok('  이름', fillNote('2026-11-08', f).name, '11월 8일 루틴');

// 화면이 이은 자리
{
  const hist = fs.readFileSync('src/pages/HistoryPage.jsx', 'utf-8');
  const rp = fs.readFileSync('src/pages/RoutinePage.jsx', 'utf-8');
  ok('기록: 고른 날 · 거르지 않을 때 · **앞날 아님**', hist.includes('date === selectedDate && !filterExercise && date <= today'), true);
  ok('  담을 게 없으면 안 그린다', /if \(!fill\.exercises\.length\) return null;/.test(hist), true);
  ok('  그날 목록 맨 아래 (머리줄 「이 달 전체」 옆이 아니다)', hist.indexOf('이 날을 루틴으로</button>') > hist.indexOf('<WorkoutCard key={w.id}'), true);
  ok('루틴: 한 번만 편다 · 주소의 state 를 비운다', /openedFillRef\.current = true;/.test(rp) && /navigate\('\/routine', \{ replace: true, state: null \}\)/.test(rp), true);
  ok('  루틴이 없는 사람도 추천 탭으로 안 옮겨진다', /openedFillRef\.current = true;\s*movedRef\.current = true;/.test(rp), true);
  ok('  고치기가 아니라 새 루틴이다', /setEditingId\(null\);\s*setNewRoutine\(\{\s*name: note\.name/.test(rp), true);
  ok('  운동 수 한도를 넘으면 앞에서부터 · 그렇다고 말한다', /slice\(0, MAX_EXERCISES\)/.test(rp) && /개만 담았어요/.test(rp), true);
  ok('  닫힐 때만 알림을 거둔다 (첫 그림에 지우지 않는다)', rp.includes('if (wasOpenRef.current && !showCreate) setFill(null);') && !rp.includes('if (!showCreate) setFill(null)'), true);
  ok('  알림을 낭독기가 읽는다', /\{fill && \(\s*<div role="status"/.test(rp), true);
  ok('  **저장은 사람이 누른다** (여기서 서버로 안 보낸다)', !/fromDay[\s\S]{0,1500}?client\.post/.test(rp.slice(rp.indexOf('const fromDay'), rp.indexOf('const fromDay') + 1600)), true);
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
