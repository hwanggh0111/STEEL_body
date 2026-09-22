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
const ratio = bundle('src/data/shapeRatio.js', '.s2.cjs');

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


// ═══════════════════════════════════════════
// 02 단계 — 사진에서 잰 비율
// ═══════════════════════════════════════════
//
// 관절 자리를 손으로 만들어 넣는다. 사진을 넣어 보려면 모델을 받아야 하고, 모델은
// 사진마다 조금씩 다르게 잡는다 — **계산이 맞는지는 자리를 정해놓고 봐야 안다.**
console.log('\n── 사진에서 잰 비율 ──');

const L = ratio.LM;
/** 정규화 좌표로 사람 하나를 세운다. 안 적은 자리는 가운데에 두고 잘 보인다고 친다. */
function stand(over, vis) {
  const marks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: vis === undefined ? 1 : vis }));
  Object.entries(over || {}).forEach(([k, v]) => {
    marks[L[k]] = { x: v[0], y: v[1], visibility: v[2] === undefined ? 1 : v[2] };
  });
  return marks;
}
const SIZE = { width: 1000, height: 1000 };   // 정사각이라 x·y 가 같은 자로 잰다

// 어깨 폭 0.30 · 골반 폭 0.20 → 1.5배. 몸통 0.25 · 다리 0.20+0.20=0.40 → 0.63배
const A = stand({
  shoulderL: [0.35, 0.30], shoulderR: [0.65, 0.30],
  hipL: [0.40, 0.55], hipR: [0.60, 0.55],
  kneeL: [0.40, 0.75], kneeR: [0.60, 0.75],
  ankleL: [0.40, 0.95], ankleR: [0.60, 0.95],
  elbowL: [0.33, 0.45], elbowR: [0.67, 0.45],
  wristL: [0.33, 0.58], wristR: [0.67, 0.58],
});
const a2 = ratio.buildRatios(A, SIZE);
ok('어깨:골반 (0.30 / 0.20)', a2.shoulderHip, 1.5);
ok('상체:다리 (0.25 / 0.40)', a2.torsoLeg, 0.63);
ok('똑바로 서면 기울기 0', a2.shoulderTilt, 0);
ok('좌우가 같으면 차이 0', a2.sideGap, 0);
ok('정면으로 본다', a2.facing, 'front');
ok('못 본 자리 없음', a2.missing, []);

// ── 세로로 긴 사진에서도 같은 값이 나와야 한다 ──
//
// 정규화 좌표를 그대로 빼면 세로가 짧게 잡힌다. 픽셀로 되돌리는지 여기서 본다 —
// 세로를 2배로 늘리면서 y 를 반으로 접으면 **실제 몸은 같은 몸**이다
const TALL = stand({
  shoulderL: [0.35, 0.15], shoulderR: [0.65, 0.15],
  hipL: [0.40, 0.275], hipR: [0.60, 0.275],
  kneeL: [0.40, 0.375], kneeR: [0.60, 0.375],
  ankleL: [0.40, 0.475], ankleR: [0.60, 0.475],
});
ok('세로로 긴 사진도 같은 상체:다리', ratio.buildRatios(TALL, { width: 1000, height: 2000 }).torsoLeg, 0.63);

// ── 안 보이는 관절은 안 쓴다 ──
//
// 모델은 가려진 관절도 자리를 지어낸다. 그 점으로 재면 옷과 각도가 만든 숫자를
// 몸이라고 말하게 된다
const HIDDEN = stand({
  shoulderL: [0.35, 0.30], shoulderR: [0.65, 0.30],
  hipL: [0.40, 0.55], hipR: [0.60, 0.55],
  kneeL: [0.40, 0.75, 0.2], kneeR: [0.60, 0.75, 0.2],
  ankleL: [0.40, 0.95, 0.1], ankleR: [0.60, 0.95, 0.1],
});
const h2 = ratio.buildRatios(HIDDEN, SIZE);
ok('안 보이는 다리는 안 잰다', h2.torsoLeg, null);
ok('못 본 자리를 적는다', h2.missing, ['무릎', '발목']);
ok('그래도 어깨:골반은 나온다', h2.shoulderHip, 1.5);

// ── 옆으로 선 사진을 걸러낸다 ──
const SIDE = stand({
  shoulderL: [0.48, 0.30], shoulderR: [0.55, 0.30],
  hipL: [0.48, 0.55], hipR: [0.54, 0.55],
  kneeL: [0.48, 0.75], kneeR: [0.54, 0.75],
  ankleL: [0.48, 0.95], ankleR: [0.54, 0.95],
});
const s3 = ratio.buildRatios(SIDE, SIZE);
ok('옆으로 서면 정면이 아니라고 본다', s3.facing, 'side');
ok('그 줄은 확실하지 않다고 적는다', ratio.ratioLines(s3).every((l) => l.sure === false), true);

// ── 기울기는 3도부터만 말한다 ──
//
// 0.4도를 적어주면 사람은 그것을 고쳐야 할 것으로 읽는다. 우리 정밀도가 그게 아니다
const TILT = stand({
  shoulderL: [0.35, 0.30], shoulderR: [0.65, 0.34],
  hipL: [0.40, 0.55], hipR: [0.60, 0.553],
  kneeL: [0.40, 0.75], kneeR: [0.60, 0.75],
  ankleL: [0.40, 0.95], ankleR: [0.60, 0.95],
});
const ti = ratio.buildRatios(TILT, SIZE);
ok('어깨 기울기를 잰다 (7~8도)', ti.shoulderTilt > 7 && ti.shoulderTilt < 8, true);
const tl = ratio.ratioLines(ti).map((l) => l.key);
ok('7도는 말한다', tl.includes('shoulderTilt'), true);
ok('1도 안쪽은 아무 말도 안 한다', tl.includes('hipTilt'), false);

console.log('── 사진 말투 ──');
const pText = ratio.ratioLines(a2).map((l) => l.text).join(' ');
// 자세 인식은 관절만 잡는다. 허리 둘레를 아는 점이 없으므로 **허리라고 하면 안 된다**
ok('허리라고 안 한다 (못 재니까)', pText.includes('허리'), false);
ok('골반이라고 적는다', pText.includes('골반'), true);
ok('점수·이상비율을 안 쓴다', ['황금', '이상적', '평균', '정상'].filter((w) => pText.includes(w)), []);

// ═══════════════════════════════════════════
// 03 단계 — 사진 · 기록 · 인바디를 합친다
// ═══════════════════════════════════════════
console.log('── 셋을 합친다 ──');

const base = shape.buildShapeRead(W, IN, TODAY);   // 어깨 꼴찌 + 줄고 있음 + 골격근 늘고 있음
const wide = { ok: true, shoulderHip: 1.50, torsoLeg: 0.63, facing: 'front', missing: [] };
const narrow = { ok: true, shoulderHip: 1.35, torsoLeg: 0.63, facing: 'front', missing: [] };

const m1 = shape.mergeShape(base, wide, null);
ok('첫 장은 견줄 것이 없다고 적는다', m1.lines[m1.lines.length - 1].text.includes('처음'), true);
ok('첫 장으로는 단정을 안 바꾼다', m1.verdict, base.verdict);

const m2 = shape.mergeShape(base, narrow, wide);
ok('지난 번보다 좁아진 것을 안다', m2.shoulderMove, 'down');
ok('기록과 사진이 같은 곳이면 단정한다', m2.verdict, 'sure');
ok('그 줄의 근거는 사진·기록', m2.lines[m2.lines.length - 1].basis, '사진·기록');

// 0.06 안쪽은 안 움직인 것으로 본다 — 옷과 서 있는 자세가 그만큼 흔든다
const m3 = shape.mergeShape(base, { ...wide, shoulderHip: 1.47 }, wide);
ok('조금 다른 것은 같다고 본다', m3.shoulderMove, 'flat');
ok('그때는 단정을 안 올린다', m3.verdict, base.verdict);

// 사진만 그러고 기록은 아닐 때 — **「각도일 수 있어요」로 끝낸다** (9/19 에 정한 것)
const LEG = { ...W };
delete LEG['2026-09-19'];
delete LEG['2026-08-18'];
const legBase = shape.buildShapeRead(LEG, IN, TODAY);
const m4 = shape.mergeShape(legBase, narrow, wide);
ok('꼴찌가 어깨가 아니게 만든다', legBase.least.part !== '어깨', true);
ok('사진만 그러면 단정하지 않는다', m4.verdict !== 'sure', true);
ok('각도일 수 있다고 적는다', m4.lines.some((l) => l.text.includes('각도일 수 있어요')), true);

ok('사진이 없으면 01 그대로다', shape.mergeShape(base, null, null).lines.length, base.lines.length);

// ── 안내 줄에 「각도일 수 있어요」가 붙으면 안 된다 (2026-09-22 에 찾은 것) ──
//
// 화면은 `sure === false` 인 사진 줄에 「각도일 수 있어요」를 덧붙인다. 첫 장 안내는
// **잰 값이 아니라 안내**라, 거기 붙으면 「견줄 것이 없어요. 각도일 수 있어요.」가 된다
const firstLine = m1.lines[m1.lines.length - 1];
ok('안내 줄에는 sure 를 안 단다', firstLine.sure, undefined);
ok('그래서 각도 꼬리가 안 붙는다', firstLine.sure === false, false);

console.log('── 가장 챙긴 곳도 말한다 ──');
ok('가장 많이 한 곳을 안다', base.most.sets >= base.least.sets, true);
ok('덜 한 곳과 다르다', base.most.part !== base.least.part, true);

console.log(bad === 0 ? '\n모두 통과' : '\n' + bad + '건 어긋남');
process.exit(bad === 0 ? 0 : 1);
