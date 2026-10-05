// 홈트 한 판이 몸의 어디를 채우나 (2026-09-22).
//
//   npm run homeparts     (npm run check 에도 들어 있다)
//
// 여기서 보는 것 둘.
//
//   1. **52개에 부위가 다 적혀 있나.** 적는 것을 잊은 줄은 화면에서 안 보인다 —
//      그 동작만 몸을 안 칠하고 조용히 지나간다. 글자로 잡을 수밖에 없다.
//   2. **쌓는 계산이 맞나.** 주로 쓰는 곳과 곁들여 쓰는 곳의 무게가 다르고,
//      아직 안 한 동작은 안 센다. 화면으로 보려면 판을 끝까지 돌려야 한다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const P = bundle('src/data/homeworkoutPrograms.js', '.hp1.cjs');
const H = bundle('src/data/homeworkoutParts.js', '.hp2.cjs');
const B = bundle('src/data/bodyHeat.js', '.hp3.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 모든 동작에 부위가 적혀 있는가 ──');

const all = Object.entries(P.PROGRAMS).flatMap(([prog, list]) =>
  list.map((e) => ({ prog, ...e })));

// 2026-10-05 에 판 셋(밤에 조용히 · 덤벨 하나로 · 밴드 하나로)을 더해 76개가 됐다.
// **숫자를 박아두는 까닭**: 동작이 조용히 빠져도 앱은 안 터진다 — 그 판만 짧아진다
ok('동작이 76개다', all.length, 76);
// 주로 쓰는 곳이 없는 동작은 **몸을 하나도 안 칠하고 지나간다**
ok('주로 쓰는 곳이 없는 동작', all.filter((e) => !e.main || e.main.length === 0).map((e) => e.name), []);
// 몸 지도에 자리가 없는 이름을 적으면 그 줄은 조용히 사라진다 ('기타' 포함)
const strayMain = all.flatMap((e) => (e.main || []).filter((p) => !H.isMapPart(p)).map((p) => e.name + ' — ' + p));
const straySub = all.flatMap((e) => (e.sub || []).filter((p) => !H.isMapPart(p)).map((p) => e.name + ' — ' + p));
ok('몸 지도에 없는 부위를 안 쓴다 (주)', strayMain, []);
ok('몸 지도에 없는 부위를 안 쓴다 (곁)', straySub, []);
// 같은 부위를 주와 곁에 겹쳐 적으면 한 번에 1.5 로 세어진다
const dup = all.filter((e) => (e.sub || []).some((p) => (e.main || []).includes(p))).map((e) => e.name);
ok('주와 곁이 겹치지 않는다', dup, []);

// ── 이름으로 맞히던 길은 왜 버렸나 ──
//
// **2026-09-29 에 여기가 바뀌었다.** 예전에는 「이름으로 맞히면 노르딕 컬이 팔,
// 카프레이즈가 어깨가 된다」를 박아두고 그것이 홈트가 부위를 손으로 적어두는 까닭이었다.
// 이제는 사전(`exerciseDict.js` 의 `part`)이 그 둘을 하체로 적어두고 `bodyPartOf` 가
// **사전을 먼저 본다** — 그래서 이름으로도 맞는다.
//
// 그래도 **적어둔 것을 안 버린다.** 홈트가 적어두는 것은 부위 하나가 아니라
// 주로 쓰는 곳 · 곁들여 쓰는 곳(`main` · `sub`)이고, 사전은 그것을 모른다.
// 아래는 **둘이 같은 곳을 가리키는지** 본다 — 어긋나면 화면마다 다른 말을 하게 된다.
const BP = bundle('src/data/bodyPart.js', '.hp4.cjs');
ok('이름으로도 노르딕 컬은 하체다 (9/29)', BP.bodyPartOf('노르딕 컬'), '하체');
ok('적어둔 것도 하체다', P.PROGRAMS['하체 집중'].find((e) => e.name === '노르딕 컬').main, ['하체']);
ok('이름으로도 카프레이즈는 하체다 (9/29)', BP.bodyPartOf('싱글 레그 카프레이즈'), '하체');
ok('적어둔 것도 하체다', P.PROGRAMS['하체 집중'].find((e) => e.name === '싱글 레그 카프레이즈').main, ['하체']);

// 홈트 52개 전부 — **적어둔 주 부위와 사전이 어긋나지 않는지.**
// 사전에 없는 동작은 이름으로 맞히므로 「기타」가 나올 수 있다. 그건 안 따진다 —
// **다른 부위라고 우기는 것**만 잡는다 (홈트 기록은 이름 끝에 부위가 붙어서 안 틀린다)
const clash = all
  .filter((e) => (e.main || []).length === 1)
  .map((e) => ({ name: e.name, 적어둔: e.main[0], 사전: BP.bodyPartOf(e.name) }))
  .filter((r) => r.사전 !== '기타' && r.사전 !== r.적어둔);
ok('적어둔 것과 사전이 안 싸운다', clash, []);

console.log('── 쌓는 계산 ──');

const FUNC = P.PROGRAMS['기능성(특수부대식)'];
ok('기능성은 12개다', FUNC.length, 12);

// 처음 셋: 베어 크롤(어깨·코어 / 하체) · 로우 크롤(코어 / 어깨·하체) · 크랩 워크(어깨·팔 / 코어)
const p3 = H.buildPump(FUNC, 3);
ok('어깨 — 주 2 · 곁 1', [p3.byPart['어깨'].main, p3.byPart['어깨'].sub], [2, 1]);
ok('어깨 점수 (2 + 0.5)', p3.byPart['어깨'].score, 2.5);
ok('코어 — 주 2 · 곁 1', [p3.byPart['코어'].main, p3.byPart['코어'].sub], [2, 1]);
ok('하체는 곁들이기만 (0.5 × 2)', [p3.byPart['하체'].main, p3.byPart['하체'].score], [0, 1]);
// 곁들여 쓰는 곳을 같이 세면 곁들인 것이 주된 것을 이긴다
ok('곁들인 것은 절반으로 센다', H.SUB_WEIGHT, 0.5);

// **아직 안 한 동작은 안 센다.** 앞날 기록을 안 세는 몸 지도와 같은 규칙이다
ok('가슴은 아직 0 (스파이더맨 푸시업은 4번째)', p3.byPart['가슴'].score, 0);
ok('안 건드린 곳을 알려준다', p3.untouched.includes('가슴'), true);
ok('건드린 곳도 알려준다', p3.touched.sort(), ['어깨', '코어', '팔', '하체'].sort());
ok('센 동작 수', p3.done, 3);

ok('시작 전에는 아무 데도 안 쌓인다', H.buildPump(FUNC, 0).touched, []);
ok('목록보다 많이 넘겨도 전체까지만 센다', H.buildPump(FUNC, 99).done, 12);
ok('음수를 넣어도 안 터진다', H.buildPump(FUNC, -3).done, 0);
ok('목록이 없어도 안 터진다', H.buildPump(null, 5).done, 0);

// 판 전체 — 기능성은 하체 판이다(점프가 넷)
const whole = H.programPump(FUNC);
ok('기능성은 하체가 가장 많다', whole.order[0].part, '하체');
ok('막대 기준은 가장 큰 점수', whole.max, whole.order[0].score);
// 가슴은 주로 쓰는 자리가 하나(스파이더맨 푸시업)뿐이고, **등은 그마저도 없다** —
// 9/29 에 리버스 플랭크를 코어로 옮겼다(뒤로 버티는 것은 플랭크 계열이라 코어고,
// 사전도 그렇게 적혀 있다). 그래서 이 판을 다 해도 **가슴과 등은 덜 채워진다** —
// 몸 지도에서 「오늘 뭘 하지」가 그 둘을 가리키게 되는 근거다
ok('가슴은 1점 · 등은 곁들이기만 (9/29)',
  [whole.byPart['가슴'].score, whole.byPart['등'].score], [1, 0.5]);
ok('등이 꼴찌다', whole.order[whole.order.length - 1].part, '등');
ok('그 앞이 가슴이다', whole.order[whole.order.length - 2].part, '가슴');

console.log('── 몸 지도로 넘기기 ──');
//
// 홈트는 여태 몸 지도와 따로 놀았다. 판을 다 해도 지도는 아무것도 몰랐다 —
// 한 줄로 넘어갔고 지도는 그 이름을 못 읽어 '기타' 로 봤다
const recs = H.toRecords(FUNC, 3, '기능성(특수부대식)');

// 처음 셋: 베어 크롤(어깨·코어) · 로우 크롤(코어) · 크랩 워크(어깨·팔)
ok('부위별로 묶인다', recs.map((r) => r.exercise), [
  '기능성(특수부대식) · 어깨',
  '기능성(특수부대식) · 팔',
  '기능성(특수부대식) · 코어',
]);
ok('세트는 그 부위를 주로 쓴 동작 수', recs.map((r) => r.sets), [2, 1, 2]);
ok('맨몸이라 무게는 비운다', recs[0].weight, '');
// 45초 버틴 것을 「45회」라고 적으면 거짓말이 된다
ok('초를 횟수로 안 옮긴다', recs.every((r) => r.reps === 1), true);
// 곁들여 쓴 것으로 「했다」고 하면, 베어 크롤 한 번으로 하체까지 한 것이 된다
ok('곁들인 하체는 안 적는다', recs.some((r) => r.exercise.includes('하체')), false);
ok('시작 전에는 아무것도 안 만든다', H.toRecords(FUNC, 0, '기능성'), []);
ok('목록이 없어도 안 터진다', H.toRecords(null, 5, '기능성'), []);
ok('판 이름이 없어도 이름이 선다', H.toRecords(FUNC, 1, '')[0].exercise.startsWith('홈트'), true);

// **여기가 진짜 확인이다.** 이 줄을 몸 지도에 넣어서 실제로 읽히는가 —
// 넘긴 것이 지도에 안 잡히면 이은 것이 아니다
const dated = recs.map((r) => ({ ...r, date: '2026-09-22' }));
const heat = B.buildHeat({ '2026-09-22': dated }, '2026-09-22');
ok('지도가 이 판을 본다', heat.any, true);
ok('어깨가 오늘 달아올랐다', heat.byPart['어깨'].days, 0);
ok('코어도', heat.byPart['코어'].days, 0);
ok('팔도', heat.byPart['팔'].days, 0);
// 안 한 부위는 안 달아오른다 — 이것이 「오늘 뭘 하지」의 답이 된다
ok('안 한 가슴은 그대로다', heat.byPart['가슴'].days, null);
ok("'기타' 로 새지 않는다", heat.other.count, 0);
ok('세트도 지도에 실린다 (어깨 2)', heat.byPart['어깨'].sets7, 2);

// 고치기 전에는 어땠나 — **그 한 줄은 '기타' 였다**
const oldWay = [{ date: '2026-09-22', exercise: '기능성운동 - 기능성(특수부대식)', weight: '', sets: 12, reps: 1 }];
const oldHeat = B.buildHeat({ '2026-09-22': oldWay }, '2026-09-22');
ok('옛 방식은 지도에 아무것도 안 남겼다', oldHeat.any, false);
ok('통째로 기타로 샜다', oldHeat.other.count, 1);

console.log('');
console.log(bad ? bad + '건 어긋남' : '모두 통과');
process.exitCode = bad ? 1 : 0;
