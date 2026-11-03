// 부위 표가 사전과 맞나 (2026-09-29).
//
//   npm run parts     사전에서 다시 뽑는다
//   npm run check     여기 들어 있다
//
// **뽑아 적은 파일은 언젠가 어긋난다.** 사전의 부위를 고치고 `npm run parts` 를 안
// 돌리면, 검색 화면과 몸 지도가 **다른 부위**를 말하기 시작한다 — 이 작업(9/29)이
// 고친 것이 바로 그것이라 같은 일이 조용히 되돌아오면 안 된다.
//
// 그리고 **낱말 규칙도 사전과 맞아야 한다.** 사전에 있는 이름은 표가 답하지만
// 「라잉 레그컬」 같은 변형은 낱말이 답한다 — 둘이 다른 말을 하면 같은 운동이
// 이름을 조금 바꿔 적었을 때 부위가 바뀐다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const D = bundle('src/data/exerciseDict.js', '.p1.cjs');
const B = bundle('src/data/bodyPart.js', '.p2.cjs');
const T = bundle('src/data/exercisePart.js', '.p3.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 사전 151개에 부위가 적혀 있나 ──');
const missing = D.EXERCISE_DICT.filter((e) => !D.partOf(e)).map((e) => e.ko);
ok('빠진 칸이 없다', missing, []);
ok('부위 이름이 목록에 있는 것뿐', [...new Set(D.EXERCISE_DICT.map((e) => e.part))].filter((p) => !D.PARTS.includes(p)), []);

console.log('── 뽑아둔 표가 사전과 같나 ──');
// 스크립트를 안 돌리고 사전만 고친 경우를 잡는다. **여기가 이 검사의 핵심이다**
const gen = fs.readFileSync('scripts/gen-parts.mjs', 'utf8');
const norm = (s) => String(s || '').toLowerCase().replace(/[\s.,!?~·・\-_'"()]/g, '');
const MAP_PARTS = ['가슴', '등', '어깨', '하체', '팔', '코어'];
const want = {};
for (const e of D.EXERCISE_DICT) {
  const part = MAP_PARTS.includes(e.part) ? e.part : '기타';
  // **별명도 센다** (2026-11-03). 사전에 `alias` 칸이 생겼다 — 「벤프」·「턱걸이」
  // 처럼 사람이 실제로 적는 이름이고, 없으면 그 기록이 몸 지도에 안 들어간다.
  // 이 표는 **일부러 손으로 다시 만든다**(위 머리글) — 뽑는 자를 불러 쓰면
  // 「스크립트를 안 돌렸다」를 못 잡는다. 그래서 여기도 같이 적는다
  for (const name of [e.ko, e.en, ...(e.alias || [])]) {
    const k = norm(name);
    if (k && !(k in want)) want[k] = part;
  }
}
const got = T.EXERCISE_PART;
ok('표의 칸 수가 같다', Object.keys(got).length, Object.keys(want).length);
const wrong = Object.keys(want).filter((k) => got[k] !== want[k]);
ok('어긋난 칸이 없다 (아니면 npm run parts)', wrong, []);
ok('표에만 있는 칸도 없다', Object.keys(got).filter((k) => !(k in want)), []);
// 뽑는 스크립트가 같은 다듬기를 쓰는지는 **결과로 본다** — 글자로 견주면 escape 하나에
// 검사가 흔들린다. 열쇠가 다듬어져 있으면(소문자 · 공백과 기호 없음) 같은 자를 쓴 것이다
const rough = Object.keys(T.EXERCISE_PART).filter((k) => k !== norm(k));
ok('표의 열쇠가 이미 다듬어져 있다', rough, []);
ok('뽑는 스크립트가 있다', gen.includes('EXERCISE_PART'), true);

console.log('── 지도가 사전대로 답하나 ──');
const off = D.EXERCISE_DICT
  .map((e) => ({ ko: e.ko, want: e.part === '전신 · 유산소' ? '기타' : e.part, got: B.bodyPartOf(e.ko) }))
  .filter((r) => r.want !== r.got);
ok('사전 151개가 다 맞는다', off, []);
// 영어 이름으로 적어도 같은 답이어야 한다 (가져오기로 들어온 기록이 그렇다)
const offEn = D.EXERCISE_DICT
  .filter((e) => e.en)
  .map((e) => ({ en: e.en, want: e.part === '전신 · 유산소' ? '기타' : e.part, got: B.bodyPartOf(e.en) }))
  .filter((r) => r.want !== r.got);
ok('영어 이름도 같은 답이다', offEn, []);

console.log('── 낱말 규칙이 사전과 안 싸우나 ──');
// 사전에 있는 이름 앞에 흔한 말을 붙여도 부위가 안 바뀌어야 한다.
// (표는 정확히 일치할 때만 답하므로, 이 경우는 **낱말 규칙**이 답한다)
const PREFIX = ['덤벨 ', '바벨 ', '머신 ', '케이블 ', '라잉 ', '시티드 ', '스미스 '];
const flip = [];
for (const e of D.EXERCISE_DICT) {
  const want2 = e.part === '전신 · 유산소' ? '기타' : e.part;
  for (const pre of PREFIX) {
    const got2 = B.bodyPartOf(pre + e.ko);
    // 「기타」로 못 맞히는 것은 여기서 따지지 않는다 — 규칙이 모르는 것은 모른다고
    // 하는 쪽이 맞다. **다른 부위라고 우기는 것**만 잡는다
    if (got2 !== '기타' && got2 !== want2) flip.push(pre + e.ko + ' → ' + got2 + ' (사전 ' + want2 + ')');
  }
}
ok('말을 붙여도 부위가 안 뒤집힌다', flip, []);

console.log('── 버피를 복근으로 세지 않는다 ──');
// 9/29 에 정한 것: 「전신 · 유산소」는 지도에 셀 곳이 없어서 기타다
['버피', '점핑잭', '하프 버피', '스프롤', '섀도 복싱'].forEach((x) => ok('  ' + x, B.bodyPartOf(x), '기타'));
// 플랭크로 버티는 것은 코어다 (같은 유산소 갈래여도)
['마운틴 클라이머', '플랭크 잭'].forEach((x) => ok('  ' + x, B.bodyPartOf(x), '코어'));
// 앉았다 일어서는 것은 하체다
['스쿼트 펀치', '스쿼트 사이드킥'].forEach((x) => ok('  ' + x, B.bodyPartOf(x), '하체'));

console.log('── 9/29 에 고친 것들 ──');
const FIXED = [
  ['레그컬', '하체'], ['라잉 레그컬', '하체'], ['카프레이즈', '하체'], ['싱글 레그 카프레이즈', '하체'],
  ['할로우 홀드', '코어'], ['사이드 플랭크 힙 딥', '코어'], ['페이스풀', '어깨'], ['수건 페이스풀', '어깨'],
  ['슈러그', '등'], ['덤벨 슈러그', '등'], ['다이아몬드 푸시업', '팔'], ['파이크 푸시업', '어깨'],
  ['스캡 푸시업', '어깨'], ['업라이트로우', '어깨'], ['굿모닝', '하체'], ['스텝업', '하체'],
  ['월싯', '하체'], ['오버헤드 스쿼트', '하체'], ['로우 크롤', '기타'], ['노르딕 컬', '하체'],
  ['클로즈그립 벤치프레스', '팔'], ['플로어프레스', '가슴'],
];
FIXED.forEach(([name, part]) => ok('  ' + name, B.bodyPartOf(name), part));

console.log('── 꾸며 적어도 부위를 아는가 ── (2026-10-22)');
// 사전에 **그 꼴로** 있으면 사전이 답한다. 그런데 사람은 꾸며서 적는다 —
// 「라잉 아놀드프레스」 · 「덤벨 풀오버 (좌)」 · 「집에서 앱 롤아웃」.
// 그때 낱말 규칙에 그 낱말이 없으면 **「기타」로 떨어졌다** — 어깨 운동을 했는데
// 몸 지도가 모른다. 사전 전부에 변형 여덟 꼴을 붙여 **1,752개**를 들이민다.
{
  const dict = D.EXERCISE_DICT;
  const want = (e) => (e.part === '전신 · 유산소' ? '기타' : e.part);
  const 변형 = [
    (n) => `라잉 ${n}`, (n) => `${n} (좌)`, (n) => `${n} 머신`, (n) => `${n} 3세트`,
    (n) => n, (n) => n.replace(/\s+/g, ''), (n) => `${n} 왼쪽`, (n) => `집에서 ${n}`,
  ];
  const 어긋난것 = [];
  for (const e of dict) {
    for (const g of 변형) {
      const name = g(e.ko);
      const got = B.bodyPartOf(name);
      if (got !== want(e)) 어긋난것.push(`${name} → ${got} (사전 ${want(e)})`);
    }
  }
  ok(`변형 ${dict.length * 변형.length}개 중 어긋난 것`, 어긋난것.length, 0);
  어긋난것.slice(0, 8).forEach((m) => console.log('   ' + m));

  // **짧은 쪽이 먼저 걸리면 안 된다** — 「클로즈그립 벤치프레스」(팔)는
  // 「벤치프레스」(가슴)를 품고 있다. 긴 것부터 봐야 삼두 운동이 가슴으로 안 간다
  ok('품은 이름은 긴 것이 이긴다', B.bodyPartOf('클로즈그립 벤치프레스 (좌)'), '팔');
  ok('  꾸민 짧은 이름은 그대로', B.bodyPartOf('벤치프레스 (좌)'), '가슴');
  ok('  다이아몬드 푸시업도', B.bodyPartOf('다이아몬드 푸시업 3세트'), '팔');
  ok('  그냥 푸시업은 가슴', B.bodyPartOf('푸시업 3세트'), '가슴');
  // 겹침표가 품은 꼴보다 앞이어야 한다 — 「덤벨 로우 크롤」은 「덤벨로우」를 품지만 로우가 아니다
  ok('겹침표가 품은 꼴보다 앞이다', B.bodyPartOf('덤벨 로우 크롤'), '기타');
}

console.log('── 적어둔 부위가 여전히 제일 위다 ──');
// 홈트 한 판은 「기능성(특수부대식) · 하체」처럼 이름 끝에 부위가 붙는다.
// 표보다 그것이 먼저여야 한다 — 동작마다 적어둔 것에서 온 부위다
ok('이름 끝의 부위가 이긴다', B.bodyPartOf('기능성(특수부대식) · 하체'), '하체');
ok('  사전에 있는 이름이어도', B.bodyPartOf('벤치프레스 · 팔'), '팔');
ok('모르는 이름은 기타다', B.bodyPartOf('아무거나'), '기타');

console.log('');
console.log('── 헬스장에서 실제로 적는 이름 ──');
// **사용자 자리에 앉아 찾은 자리다** (2026-11-03). 일곱이 「기타」로 떨어졌다 —
// 그러면 몸 지도가 안 달아오르고(이 앱이 「이어가는 이유」로 내세운 화면이다),
// 주간 요약의 부위가 비고, 홈이 「아직 한 번도 안 했습니다」를 계속 띄운다.
// **검색에서도 안 나와서** 사람은 제 손으로 이름을 적고, 그 이름은 사전에 없다.
//
// 이름 규칙으로는 못 잡는다 — 「벤프」는 어느 열쇠의 조각도 아니고 「턱걸이」는
// 순우리말이라 한글·영어 이름 어디에도 안 걸린다. 사전의 `alias` 칸이 맡는다
const 실제이름 = [
  ['벤프', '가슴'], ['푸쉬업', '가슴'], ['팔굽혀펴기', '가슴'],
  ['턱걸이', '등'], ['사레레', '어깨'], ['사이드레터럴레이즈', '어깨'], ['숄프', '어깨'],
  ['스쿳', '하체'], ['렉프레스', '하체'], ['윗몸일으키기', '코어'],
];
for (const [이름, 부위] of 실제이름) {
  ok(`「${이름}」 → ${부위}`, B.bodyPartOf(이름), 부위);
}
// **검색에서도 나와야 한다** — 안 나오면 사람이 제 이름을 적게 된다
for (const [이름] of 실제이름) {
  const hit = D.searchExercises(이름, 5);
  ok(`  「${이름}」로 검색하면 나온다`, hit.length > 0, true);
}
// ── **「가슴운동」처럼 부위만 적는 사람** ── (2026-11-03)
//
// 사람은 자세히 안 적고 「가슴운동」·「등운동」·「하체 운동」으로 적기도 한다.
// 여섯이 다 「기타」였다 — 적은 사람은 가슴을 했는데 몸 지도는 모른다.
// **제일 뒤에서** 본다(한 글자 「등」·「팔」이 다른 이름을 채가면 안 된다)
for (const [이름, 부위] of [['가슴운동', '가슴'], ['등운동', '등'], ['어깨 운동', '어깨'],
                            ['하체운동', '하체'], ['팔 운동', '팔'], ['코어운동', '코어'],
                            ['가슴', '가슴'], ['하체', '하체']]) {
  ok(`「${이름}」 → ${부위}`, B.bodyPartOf(이름), 부위);
}
// **앞의 자들을 안 밀어냈는지** 본다 — 이것이 이 받침의 유일한 위험이다
for (const [이름, 부위] of [['팔굽혀펴기', '가슴'], ['팔꿈치 푸시업', '가슴'],
                            ['한팔 덤벨로우', '등'], ['가슴 딥스', '팔'],
                            ['등 스트레칭', '등'], ['버피', '기타']]) {
  ok(`  「${이름}」는 그대로 ${부위}`, B.bodyPartOf(이름), 부위);
}

// ── **유산소는 「못 알아봤다」가 아니라 「셀 곳이 없다」여야 한다** ── (2026-11-03)
//
// 유산소 **기계**는 10/05 에 다 들어왔는데(런닝머신·실내 자전거·로잉·스텝퍼·
// 일립티컬·에어바이크) **사람이 부르는 이름**이 안 붙어 있었고, **기계 없이 하는
// 달리기·줄넘기는 아예 없었다.** 그러면 몸 지도가 「부위를 못 알아봐서 지도에
// 없어요 · 이름을 알아보게 적으면 들어옵니다」라고 말한다 —
// `bodyPart.isKnownName` 머리글이 그것을 그대로 **「거짓말이다」**라고 적어뒀다.
// 어떻게 적어도 달리기는 그 여섯 부위가 되지 않는다.
//
// 그래서 보는 것이 둘이다: **부위는 「기타」**(지도에 셀 곳이 없다) ·
// **사전은 그 이름을 안다**(그래야 화면이 맞는 말을 한다)
console.log('── 유산소 (지도에 셀 곳이 없는 것) ──');
for (const 이름 of ['달리기', '러닝', '런닝', '조깅', '줄넘기',
                    '트레드밀', '러닝머신', '사이클', '자전거', '계단오르기', '스테퍼',
                    '런닝머신', '실내 자전거', '로잉머신', '버피']) {
  ok(`「${이름}」 — 지도에는 기타`, B.bodyPartOf(이름), '기타');
  ok('  사전은 그 이름을 안다 (「못 알아봤다」로 말하지 않는다)', B.isKnownName(이름), true);
}
// **아직 없는 것은 없다고 둔다** — 수영은 사전에 없다(기록할 자리가 아니다)
ok('수영은 아직 사전에 없다', B.isKnownName('수영'), false);

// 별명은 **이름이 아니다** — 목록에 보이는 이름은 `ko` 하나다
ok('별명이 목록의 이름으로 새지 않는다',
  D.EXERCISE_DICT.filter((e) => (e.alias || []).includes(e.ko)).map((e) => e.ko), []);

console.log(bad ? bad + '건 어긋남' : '모두 통과');
process.exitCode = bad ? 1 : 0;
