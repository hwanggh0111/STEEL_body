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
  for (const name of [e.ko, e.en]) {
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

console.log('── 적어둔 부위가 여전히 제일 위다 ──');
// 홈트 한 판은 「기능성(특수부대식) · 하체」처럼 이름 끝에 부위가 붙는다.
// 표보다 그것이 먼저여야 한다 — 동작마다 적어둔 것에서 온 부위다
ok('이름 끝의 부위가 이긴다', B.bodyPartOf('기능성(특수부대식) · 하체'), '하체');
ok('  사전에 있는 이름이어도', B.bodyPartOf('벤치프레스 · 팔'), '팔');
ok('모르는 이름은 기타다', B.bodyPartOf('아무거나'), '기타');

console.log('');
console.log(bad ? bad + '건 어긋남' : '모두 통과');
process.exitCode = bad ? 1 : 0;
