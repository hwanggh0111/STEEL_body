// 새 화면 셋이 기대는 계산을 한 번에 돌린다 (2026-09-16).
//
//   npm run heat     (npm run check 에도 들어 있다)
//
//   몸 지도      data/bodyHeat.js      부위별 마지막 자극일 → 달아오른 정도
//   1년 기록 벽  data/yearWall.js      한 해를 판 열두 장으로, 각인 깊이는 그 해 기준
//   운동 끝 결산 data/sessionSummary.js 오늘 한 것 한 장 (최고기록 판정 포함)
//
// 셋 다 **화면에서는 확인하기 어려운 계산**이다. 지도의 색 하나를 눈으로 보려면
// 그 부위를 그 날짜에 실제로 기록해야 하고, 벽은 한 해 치가 있어야 하고, 결산은
// 루틴을 끝까지 돌려야 한 번 뜬다. 그래서 여기서 값으로 본다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const heat = bundle('src/data/bodyHeat.js', '.h1.cjs');
const wall = bundle('src/data/yearWall.js', '.h2.cjs');
const sum = bundle('src/data/sessionSummary.js', '.h3.cjs');
const pace = bundle('src/data/pace.js', '.h4.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// ───────────────────────────────────────────
console.log('── 몸 지도 · 달아오른 정도 ──');
ok('오늘 한 것은 제일 밝다', heat.heatLevel(0), 3);
ok('이틀까지는 남아 있다', heat.heatLevel(2), 2);
ok('사흘부터 식는 중', heat.heatLevel(3), 1);
ok('닷새까지 식는 중', heat.heatLevel(5), 1);
ok('엿새부터 식었다', heat.heatLevel(6), 0);
ok('한 번도 안 한 것도 식음', heat.heatLevel(null), 0);

const W = {
  '2026-09-16': [{ exercise: '벤치프레스', weight: '80', sets: 5, reps: 8 }],
  '2026-09-14': [{ exercise: '스쿼트', weight: '100', sets: 5, reps: 5 }],
  '2026-09-10': [{ exercise: '랫풀다운', weight: '50', sets: 4, reps: 12 }],
  '2026-09-20': [{ exercise: '오버헤드프레스', weight: '40', sets: 4, reps: 8 }],  // 앞날
  '2026-09-12': [{ exercise: '아무거나', weight: '10', sets: 1, reps: 1 }],        // '기타'
};
const h = heat.buildHeat(W, '2026-09-16');

ok('오늘 한 가슴은 0일 전', h.byPart['가슴'].days, 0);
ok('이틀 전 하체', h.byPart['하체'].days, 2);
ok('엿새 전 등', h.byPart['등'].days, 6);
// **앞날 기록은 안 센다.** 달력에서 앞날에 적을 수 있는데, 아직 하지도 않은
// 운동으로 어깨가 달아오르면 지도가 거짓말을 한다
ok('앞날(9/20) 어깨는 안 센다', h.byPart['어깨'].days, null);
// '기타' 는 몸에 자리가 없다. 어디를 칠할지 모르니 '기타' 인 것이다
ok("'기타' 는 어느 부위도 안 건드린다", heat.MAP_PARTS.every((p) => h.byPart[p].count !== 3), true);
ok('오늘 달아오른 곳은 가슴뿐', h.hot, ['가슴']);
// 한 번도 안 한 부위가 「엿새 전」보다 더 비어 있는 자리다
ok('가장 식은 곳은 한 번도 안 한 부위', h.coldest.part, '어깨');
ok('그 부위는 칠하지 않는다(레벨 0)', h.coldest.level, 0);
ok('기록이 있으면 any', h.any, true);

// ── 얼마나 했나 (2026-09-16 에 더했다) ──
//
// 마지막 자극일만으로는 「어제 한 세트 깔짝」과 「어제 스무 세트」가 똑같이 뜨겁다
const V = {
  '2026-09-16': [{ exercise: '벤치프레스', weight: '80', sets: 5, reps: 8 }],
  '2026-09-15': [{ exercise: '인클라인 덤벨프레스', weight: '24', sets: 4, reps: 10 }],
  '2026-09-11': [{ exercise: '스쿼트', weight: '100', sets: 3, reps: 5 }],   // 엿새 전 — 아직 이레 안
  '2026-09-09': [{ exercise: '스쿼트', weight: '100', sets: 9, reps: 5 }],   // 여드레 전 — 이레 밖
  '2026-09-13': [{ exercise: '아무거나', weight: '10', sets: 7, reps: 1 }],  // '기타'
};
const v = heat.buildHeat(V, '2026-09-16');
ok('최근 이레 세트를 더한다 (가슴 5+4)', v.byPart['가슴'].sets7, 9);
// 오늘까지 이레다. 「이번 주」로 세면 월요일 아침마다 모두 0 이 되어,
// 일요일에 조진 사람이 월요일에 아무것도 안 한 사람이 된다
ok('이레 밖(여드레 전)은 안 센다', v.byPart['하체'].sets7, 3);
ok('막대 기준은 그중 가장 많은 값', v.maxSets7, 9);
ok('마지막 날 첫 운동을 대표로 든다', v.byPart['가슴'].last.exercise, '벤치프레스');
ok('  무게 · 세트 · 횟수도 같이', [v.byPart['가슴'].last.sets, v.byPart['가슴'].last.reps], [5, 8]);
ok('한 번도 안 한 부위는 마지막 기록이 없다', v.byPart['어깨'].last, null);
// **조용히 빼지 않는다.** 「나는 이만큼 했는데 지도가 비어 있다」가 되면 지도를 못 믿는다
ok("'기타' 로 빠진 것을 세어 알린다", v.other.count, 1);
ok('  이름도 들고 있다', v.other.names, ['아무거나']);
ok("  '기타' 세트는 어느 부위에도 안 더해진다",
  heat.MAP_PARTS.reduce((n, p) => n + v.byPart[p].sets7, 0), 12);
ok('기록이 없으면 coldest 도 없다', heat.buildHeat({}, '2026-09-16').coldest, null);
ok('  그때는 any 가 false', heat.buildHeat({}, '2026-09-16').any, false);

// ───────────────────────────────────────────
console.log('\n── 1년 기록 벽 ──');
const Y = {
  '2026-01-05': [{ exercise: '벤치프레스', weight: '100', sets: 5, reps: 10 }],  // 5000kg — 그 해 최고
  '2026-01-06': [{ exercise: '벤치프레스', weight: '50', sets: 5, reps: 10 }],   // 2500kg — 절반
  '2026-01-07': [{ exercise: '벤치프레스', weight: '10', sets: 5, reps: 10 }],   // 500kg  — 얕게
  '2026-01-08': [{ exercise: '푸시업', weight: '맨몸', sets: 5, reps: 30 }],      // 0kg 이지만 한 날이다
  '2025-12-31': [{ exercise: '스쿼트', weight: '100', sets: 5, reps: 5 }],       // 다른 해
};
const y26 = wall.buildYear(Y, 2026);
const jan = y26.months[0];
const dayOf = (mo, d) => mo.days.find((x) => x.day === d);

ok('그 해 가장 무거운 날이 제일 깊다', dayOf(jan, 5).level, 3);
ok('절반쯤은 가운데', dayOf(jan, 6).level, 2);
ok('가벼운 날은 얕게', dayOf(jan, 7).level, 1);
// 볼륨이 0 이라고 안 한 날과 똑같이 비워두면, 맨몸으로 한 시간 한 사람의 칸이 사라진다
ok('맨몸만 한 날도 새겨진다', dayOf(jan, 8).level, 1);
ok('안 한 날은 비어 있다', dayOf(jan, 9).level, 0);
ok('다른 해(2025/12/31)는 안 섞인다', y26.total.days, 4);
ok('이어진 날을 센다 (1/5~1/8)', y26.total.longest, 4);
ok('가장 뜨거웠던 달', y26.total.bestMonth.name, '1월');
ok('열두 판이 다 있다', y26.months.length, 12);
// 2026 은 평년, 2024 는 윤년. 손으로 세지 않고 달력에서 받아온다
ok('2월은 28일', y26.months[1].days.length, 28);
ok('윤년 2월은 29일', wall.buildYear({}, 2024).months[1].days.length, 29);
ok('기록이 있는 해를 최신순으로', wall.yearsWithRecords(Y), [2026, 2025]);
ok('빈 날짜는 해로 치지 않는다', wall.yearsWithRecords({ '2026-01-01': [] }), []);
// 무게를 한 번도 안 적은 해는 기준이 없다. 전부 얕은 각인이 맞다
const bw = wall.buildYear({ '2026-03-03': [{ exercise: '푸시업', weight: '맨몸', sets: 3, reps: 20 }] }, 2026);
ok('무게가 아예 없는 해는 전부 얕게', dayOf(bw.months[2], 3).level, 1);

// ───────────────────────────────────────────
console.log('\n── 운동 끝 결산 ──');
const S = {
  '2026-09-09': [{ exercise: '벤치프레스', weight: '70', sets: 5, reps: 8 }],   // 지난주 수요일 2800kg
  '2026-09-16': [
    { exercise: '벤치프레스', weight: '80', sets: 5, reps: 8 },                  // 3200kg · 최고 경신
    { exercise: '딥스', weight: '맨몸', sets: 3, reps: 12 },
  ],
};
const s = sum.buildSummary(S, '2026-09-16', '가슴 루틴');
ok('오늘 든 무게', s.kg, 3200);
ok('세트는 맨몸도 센다', s.sets, 8);
ok('운동 개수', s.count, 2);
ok('맨몸 세트를 따로 알린다', s.bodyweightSets, 3);
// **뭘 했는지가 결산에 없었다** (2026-09-16 에 더했다). 큰 숫자 하나만 두면
// 방금 한 사람도 무엇으로 그 숫자가 됐는지 모른다
ok('오늘 한 것을 목록으로 들고 있다', s.items.map((w) => w.exercise), ['벤치프레스', '딥스']);
ok('  무게 · 세트 · 횟수도 같이', [s.items[0].weight, s.items[0].sets, s.items[0].reps], ['80', 5, 8]);
ok('부위도 같이 (칩으로 그린다)', s.parts, ['가슴', '팔']);
// **같은 날짜(한 달 전)가 아니라 같은 요일이다** — 월요일에 하체를 하는 사람에게
// 견줄 만한 날은 지난주 월요일이다
ok('지난주 같은 요일보다 얼마나 더', s.deltaKg, 400);
ok('루틴 이름을 들고 있다', s.routineName, '가슴 루틴');
// 오늘 것을 빼고 견줘야 한다. 넣고 견주면 방금 세운 기록이 이미 최고라 아무것도 안 걸린다
ok('오늘 세운 최고기록을 잡는다', s.record.entry.exercise, '벤치프레스');
ok('  지난 최고도 같이 준다', s.record.prev.kg, 70);
ok('지난주에 기록이 없으면 견주지 않는다',
  sum.buildSummary({ '2026-09-16': S['2026-09-16'] }, '2026-09-16').deltaKg, null);
// 맨몸만 한 날은 무게가 0 이다. 화면은 그때 세트 수를 대신 크게 띄운다
const only = sum.buildSummary({ '2026-09-16': [{ exercise: '푸시업', weight: '맨몸', sets: 4, reps: 25 }] }, '2026-09-16');
ok('맨몸만 한 날은 무게가 0', only.kg, 0);
ok('  그래도 세트는 남는다', only.sets, 4);
ok('기록이 없는 날도 안 터진다', sum.buildSummary({}, '2026-09-16').count, 0);

// ───────────────────────────────────────────
console.log('\n── 늘어졌나 (기록을 남긴 시각으로) ──');

// 시각을 손으로 만든다. 분 단위로 떨어뜨려 읽기 쉽게
const T0 = Date.parse('2026-09-16T19:00:00+09:00');
const rec = (min) => ({ exercise: 'x', weight: '60', sets: 3, reps: 10, created_at: new Date(T0 + min * 60000).toISOString() });

// 19:00 · 19:05 · 19:12 · 19:40  →  사이 5분 · 7분 · 28분
const day = [rec(0), rec(5), rec(12), rec(40)];
const p1 = pace.paceOf(day);
ok('잴 수 있는 날이다', p1.usable, true);
ok('첫 기록에서 마지막까지', pace.longTime(p1.spanMs), '40분');
// **중앙값으로 본다.** 평균(13분 20초)은 한 번 자리를 비운 28분에 통째로 끌려간다
ok('보통 이만큼 쉰다 (중앙값)', pace.shortTime(p1.medianMs), '7분');
ok('  평균이었다면 끌려갔을 값', Math.round((5 + 7 + 28) / 3), 13);
ok('제일 길게 쉰 것', pace.shortTime(p1.longestMs), '28분');

// **못 재는 날에는 아무 말도 안 한다.**
ok('기록이 둘이면 안 잰다', pace.paceOf([rec(0), rec(20)]).usable, false);
ok('  왜 안 재는지 말한다', pace.paceOf([rec(0), rec(20)]).why, 'few');
// 다 끝내고 한꺼번에 적은 날. 「10분 만에 운동을 끝냈다」는 명백한 거짓말이다
ok('한꺼번에 적은 날은 안 잰다', pace.paceOf([rec(0), rec(1), rec(2), rec(3)]).usable, false);
ok('  그 까닭도 다르다', pace.paceOf([rec(0), rec(1), rec(2), rec(3)]).why, 'batched');
ok('시각이 없는 옛 기록도 안 터진다', pace.paceOf([{ exercise: 'x' }, { exercise: 'y' }]).usable, false);

// ── 평소 ──
//
// **오늘은 빼고** 지난 4주에서 센다. 오늘을 넣으면 늘어진 날일수록 「평소와 비슷하다」가 된다
const PW = {};
const dayAt = (d, mins) => {
  const base = Date.parse(`2026-09-${String(d).padStart(2, '0')}T19:00:00+09:00`);
  return mins.map((m) => ({ exercise: 'x', weight: '60', sets: 3, reps: 10, created_at: new Date(base + m * 60000).toISOString() }));
};
// 평소는 사이 2분씩 — 9/10 · 9/11 · 9/12
PW['2026-09-10'] = dayAt(10, [0, 2, 4, 12]);
PW['2026-09-11'] = dayAt(11, [0, 2, 4, 12]);
PW['2026-09-12'] = dayAt(12, [0, 2, 4, 12]);
// 오늘은 사이 7분씩 — 늘어진 날
PW['2026-09-16'] = dayAt(16, [0, 7, 14, 21]);

const base = pace.baselineOf(PW, '2026-09-16');
ok('평소를 센다', pace.shortTime(base.medianMs), '2분');
ok('  센 날 수', base.days, 3);

const built = pace.buildPace(PW, '2026-09-16');
ok('오늘은 더 길다', pace.shortTime(built.medianMs), '7분');
ok('  평소보다 얼마나', pace.shortTime(built.deltaMs), '5분');

// 잴 수 있는 날이 셋 미만이면 **평소가 없다고 답한다** —
// 이틀치로 「평소」를 말하면 그날 하루가 곧 기준이 된다
const thin = { '2026-09-15': dayAt(15, [0, 2, 4, 12]), '2026-09-16': dayAt(16, [0, 7, 14, 21]) };
ok('이틀치로는 평소를 안 만든다', pace.baselineOf(thin, '2026-09-16'), null);
ok('  그때는 견주지 않는다', pace.buildPace(thin, '2026-09-16').deltaMs, null);

// 결산이 이 값을 같이 들고 다닌다
ok('결산에 속도가 실린다', sum.buildSummary(PW, '2026-09-16').pace.usable, true);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
