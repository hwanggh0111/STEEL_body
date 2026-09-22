// 체형 읽기 01 단계 — 값으로 본다 (2026-09-22).
//
//   npm run shape     (npm run check 에도 들어 있다)
//
// 이 계산은 **화면에서 확인하기가 특히 어렵다.** 한 줄을 눈으로 보려면 8주치
// 기록을 부위별로 넣고 인바디를 둘 이상 적어야 한다. 그래서 여기서 값으로 본다.
//
// 지키는지 보는 것: 꼴찌라도 늘고 있으면 단정하지 않는다 · 앞날은 안 센다 ·
// '기타' 는 안 센다 · 창 밖 인바디는 안 끌어온다 · 자료가 모자라면 아무 말도 안 한다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const shape = bundle('src/data/shapeRead.js', '.s1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const TODAY = '2026-09-22';
// 넉넉히 채운 8주. 어깨만 적게 두고, 뒤 4주(8/26~9/22)와 앞 4주(7/29~8/25)를 가른다
const W = {
  // ── 지난 4주 ──
  '2026-09-21': [{ exercise: '벤치프레스', sets: 5, reps: 8, weight: '80' }],
  '2026-09-19': [{ exercise: '스쿼트', sets: 5, reps: 5, weight: '100' }],
  '2026-09-17': [{ exercise: '랫풀다운', sets: 5, reps: 12, weight: '50' }],
  '2026-09-15': [{ exercise: '바벨컬', sets: 5, reps: 10, weight: '30' }],
  '2026-09-13': [{ exercise: '플랭크', sets: 5, reps: 1, weight: '' }],
  '2026-09-11': [{ exercise: '사이드레터럴레이즈', sets: 2, reps: 15, weight: '8' }],   // 어깨 2
  // ── 앞 4주 ──
  '2026-08-20': [{ exercise: '벤치프레스', sets: 5, reps: 8, weight: '80' }],
  '2026-08-18': [{ exercise: '스쿼트', sets: 5, reps: 5, weight: '100' }],
  '2026-08-16': [{ exercise: '랫풀다운', sets: 5, reps: 12, weight: '50' }],
  '2026-08-14': [{ exercise: '바벨컬', sets: 5, reps: 10, weight: '30' }],
  '2026-08-12': [{ exercise: '플랭크', sets: 5, reps: 1, weight: '' }],
  '2026-08-10': [{ exercise: '오버헤드프레스', sets: 6, reps: 8, weight: '40' }],        // 어깨 6
  // ── 안 세야 할 것들 ──
  '2026-09-25': [{ exercise: '오버헤드프레스', sets: 9, reps: 8, weight: '40' }],        // 앞날
  '2026-07-01': [{ exercise: '오버헤드프레스', sets: 9, reps: 8, weight: '40' }],        // 창 밖
  '2026-09-18': [{ exercise: '아무거나', sets: 9, reps: 1, weight: '10' }],              // '기타'
};

console.log('── 덜 한 곳 ──');
const a = shape.buildShapeRead(W, [], TODAY);
ok('말할 자료가 된다', a.ready, true);
ok('꼴찌는 어깨', a.least.part, '어깨');
ok('어깨 8주 세트 (2+6)', a.least.sets, 8);
ok('앞날(9/25)은 안 센다', a.least.sets < 17, true);
ok('창 밖(7/1)도 안 센다', a.least.sets < 17, true);
// '기타' 9세트가 어느 부위에도 안 들어갔는지 — 총합으로 본다
ok("'기타' 는 총합에 없다", a.total, 2 + 6 + 5 * 10);
ok('어깨는 줄고 있다 (6→2)', a.least.dir, 'down');
ok('줄고 있으니 단정한다', a.verdict, 'less');

console.log('── 꼴찌라도 늘고 있으면 단정하지 않는다 ──');
const RISE = { ...W };
delete RISE['2026-08-10'];                                                   // 앞 4주 어깨 0 → 'new'
RISE['2026-09-11'] = [{ exercise: '사이드레터럴레이즈', sets: 4, reps: 15, weight: '8' }];
const b = shape.buildShapeRead(RISE, [], TODAY);
ok('여전히 꼴찌는 어깨', b.least.part, '어깨');
ok('앞 4주가 0 이면 늘었다고 안 한다', b.least.dir, 'new');
ok('단정하지 않는다', b.verdict, 'rising');

const UP = { ...W, '2026-08-10': [{ exercise: '오버헤드프레스', sets: 2, reps: 8, weight: '40' }] };
UP['2026-09-11'] = [{ exercise: '사이드레터럴레이즈', sets: 5, reps: 15, weight: '8' }];
const c = shape.buildShapeRead(UP, [], TODAY);
ok('꼴찌지만 2→5 로 늘었다', c.least.dir, 'up');
ok('그래도 단정하지 않는다', c.verdict, 'rising');

console.log('── 인바디는 셋째 목소리 ──');
const IN = [
  { date: '2026-09-20', muscle_kg: 34.2, weight: 72 },
  { date: '2026-08-05', muscle_kg: 33.1, weight: 71 },
  { date: '2026-05-02', muscle_kg: 30.0, weight: 70 },   // 창 밖 — 안 끌어온다
];
const d = shape.buildShapeRead(W, IN, TODAY);
ok('창 안의 둘로만 잰다 (34.2-33.1)', d.muscle.delta, 1.1);
ok('늘고 있다', d.muscle.dir, 'up');
ok('둘이 같은 곳을 가리키면 합친다', d.lines[d.lines.length - 1].basis, '기록·인바디');

const ONE = [{ date: '2026-09-20', muscle_kg: 34.2, weight: 72 }];
ok('점 하나면 방향이 없다', shape.buildShapeRead(W, ONE, TODAY).muscle, null);
const OUT = [{ date: '2026-05-02', muscle_kg: 30 }, { date: '2026-05-20', muscle_kg: 31 }];
ok('창 밖 둘도 안 쓴다', shape.buildShapeRead(W, OUT, TODAY).muscle, null);
const FLAT = [{ date: '2026-09-20', muscle_kg: 33.2 }, { date: '2026-08-05', muscle_kg: 33.1 }];
ok('0.3kg 안쪽은 방향을 안 매긴다', shape.buildShapeRead(W, FLAT, TODAY).muscle.dir, 'flat');
ok('그때는 합친 말도 안 한다', shape.buildShapeRead(W, FLAT, TODAY).lines.every(l => l.basis !== '기록·인바디'), true);

console.log('── 자료가 모자라면 아무 말도 안 한다 ──');
const THIN = { '2026-09-21': [{ exercise: '벤치프레스', sets: 3, reps: 8, weight: '80' }] };
const e = shape.buildShapeRead(THIN, IN, TODAY);
ok('세트가 적으면 안 말한다', e.ready, false);
ok('모자란 것을 적는다', typeof e.need === 'string' && e.need.length > 0, true);
ok('그때는 줄이 없다', e.lines, []);
ok('아예 없으면 안내가 다르다', shape.buildShapeRead({}, [], TODAY).need.includes('아직'), true);

console.log('── 말투 ──');
const words = ['점', '등급', '부족', '정상', '비정상', '또래', '평균보다'];
const allText = d.lines.map(l => l.text).join(' ');
ok('점수·등급·「부족」을 안 쓴다', words.filter(w => allText.includes(w)), []);
ok('줄마다 근거가 붙는다', d.lines.every(l => ['기록', '인바디', '기록·인바디'].includes(l.basis)), true);

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 어긋남`);
process.exit(bad === 0 ? 0 : 1);
