// **한 부위가 늘어온 길** — 주마다 들인 총량 (2026-11-04).
//
//   npm run volume     (npm run check 에도 들어 있다)
//
// ── 무엇을 보는가 ──
//
// 11/03 에 붙인 「한 운동이 늘어온 길」은 운동 하나만 본다. 기구를 바꾸면 선이 끊긴
// 것처럼 보이고, 「가슴을 덜 하게 된 것인지」는 그 선으로 모른다. 그 사이를 메우는
// 그림이다 — **무게 × 세트 × 횟수**를 주 단위로 더한다.
//
// 화면으로는 보기 어렵다. 반년치 기록을 손으로 넣어야 선이 생기고, 「주 경계」와
// 「맨몸을 뺐나」는 눈으로 세어볼 수 없다. 그래서 값으로 본다.
//
// ── 특히 지키는 것 셋 ──
//
//   ⑴ **맨몸 · 유산소는 선에서 뺀다** — 무게 없는 것을 1kg 으로 치면 지어내는 셈이다
//   ⑵ **주는 월요일에 시작한다** — 홈 달력 · 목표와 같은 자(`weeklyReport.mondayOf`)
//   ⑶ **이번 주는 선에 안 넣는다** — 안 끝난 주를 찍으면 늘 마지막이 꺾여 보인다
//
// 부위를 알아내는 자는 **몸 지도와 같은 하나**다(`bodyPartOf`) — 어제 넣은 별명
// (벤프 · 푸쉬업 · 턱걸이)이 여기로 그대로 들어오는지도 본다.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

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
  .replace(/^\s*\/\/.*$/gm, '');

const V = bundle('src/data/partVolume.js', '.vol.cjs');

// 2026-11-04 는 **수요일**이다. 그 주 월요일은 11-02
const TODAY = '2026-11-04';

console.log('── 주는 월요일에 시작한다 ──');
// 홈 달력 · 주간 요약 · 목표와 **같은 자**를 쓴다 (두 벌로 세면 한쪽만 고쳐진다)
ok('수요일은 그 주 월요일로 묶인다', V.weekOf('2026-11-04'), '2026-11-02');
ok('  월요일은 그 날이다', V.weekOf('2026-11-02'), '2026-11-02');
ok('  일요일은 **앞 월요일**이다 (주의 끝)', V.weekOf('2026-11-08'), '2026-11-02');
ok('  그 다음 월요일은 새 주다', V.weekOf('2026-11-09'), '2026-11-09');
ok('이상한 날짜는 없는 것으로 친다', [V.weekOf(''), V.weekOf('x'), V.weekOf(null)], [null, null, null]);
// ★ **넘어가는 날짜도 막는다** — `new Date(2026, 12, 45)` 는 2027-02-14 로 멀쩡히
// 돌아온다(`isNaN` 으로는 안 걸린다). 그대로 두면 없는 날이 선에 점으로 찍힌다
ok('  넘어가는 날짜도 없는 것으로 친다', [V.weekOf('2026-13-45'), V.weekOf('2026-02-31')], [null, null]);
ok('주 이름을 사람 말로 적는다', V.weekLabel('2026-11-02'), '11월 2일 주');
// ★ **주 이름도 같은 자를 쓴다** — 처음에 주 묶기만 고치고 여기를 빠뜨려서
// 빈 글자가 「1월 1일 주」로 적히고 있었다 (쌍둥이를 같이 고친다)
ok('  주 이름도 이상한 값을 거른다',
  [V.weekLabel(''), V.weekLabel('x'), V.weekLabel(null), V.weekLabel('2026-13-45')], ['', '', '', '']);

console.log('');
console.log('── 한 줄의 볼륨 ──');
ok('무게 × 세트 × 횟수', V.volumeOf({ weight: 60, sets: 4, reps: 10 }), 2400);
ok('  글자로 적힌 무게도 센다', V.volumeOf({ weight: '60kg', sets: 4, reps: 10 }), 2400);
ok('  소수도 센다', V.volumeOf({ weight: 62.5, sets: 3, reps: 8 }), 1500);
// ★ **여기가 이 그림의 약속이다** — 무게가 없는 것은 셀 수 없으니 안 센다
ok('**맨몸은 안 센다**', V.volumeOf({ weight: '맨몸', sets: 4, reps: 20 }), null);
ok('  밴드도 안 센다', V.volumeOf({ weight: '밴드', sets: 3, reps: 15 }), null);
ok('  빈 무게도 안 센다', V.volumeOf({ weight: '', sets: 3, reps: 15 }), null);
ok('  0kg 도 안 센다 (0kg 을 든 것이 아니다)', V.volumeOf({ weight: 0, sets: 3, reps: 15 }), null);
ok('세트나 횟수가 없으면 안 센다',
  [V.volumeOf({ weight: 60, sets: 0, reps: 10 }), V.volumeOf({ weight: 60, sets: 4, reps: 0 }),
   V.volumeOf({ weight: 60, sets: 4 }), V.volumeOf({ weight: 60, reps: 10 })],
  [null, null, null, null]);
ok('  이상한 값이 와도 안 터진다',
  [V.volumeOf(null), V.volumeOf({}), V.volumeOf({ weight: 60, sets: 'x', reps: 'y' })], [null, null, null]);

console.log('');
console.log('── 그릴 수 있는 부위 ──');
const W = {
  // 10월 마지막 주 (10-26 월)
  '2026-10-28': [{ exercise: '벤치프레스', weight: 60, sets: 4, reps: 10 }],
  // 11월 첫 주 (11-02 월) = **이번 주**
  '2026-11-03': [
    { exercise: '벤치프레스', weight: 70, sets: 4, reps: 10 },
    { exercise: '푸시업', weight: '맨몸', sets: 4, reps: 20 },
    { exercise: '런닝머신', weight: '맨몸', sets: 1, reps: 1 },
  ],
  // 10월 셋째 주 (10-19 월)
  '2026-10-21': [{ exercise: '벤프', weight: 55, sets: 4, reps: 10 }],   // ★ 어제 넣은 별명
  // 하체는 한 주만 — 선이 안 된다
  '2026-10-22': [{ exercise: '스쿼트', weight: 80, sets: 5, reps: 5 }],
  // 앞날 — 아직 한 것이 아니다
  '2027-01-05': [{ exercise: '데드리프트', weight: 140, sets: 5, reps: 5 }],
};
ok('두 주 이상 한 부위만 그린다', V.volumeParts(W, TODAY), ['가슴']);
// ★ **칩과 선이 같은 셈을 쓴다** — 선은 이번 주를 빼고 그리는데 칩이 넣어 세면,
// 「지난 주 + 이번 주」만 한 부위는 **칩은 뜨고 선은 안 그려지고** 화면이
// 「기간을 넓혀보세요」라고 말한다. **넓혀도 안 나온다** — 거짓말이 된다
const ONLY_NOW = {
  '2026-10-28': [{ exercise: '벤치프레스', weight: 60, sets: 4, reps: 10 }],   // 지난 주
  '2026-11-03': [{ exercise: '벤치프레스', weight: 65, sets: 4, reps: 10 }],   // 이번 주
};
ok('  이번 주는 칩에도 안 센다', V.volumeParts(ONLY_NOW, TODAY), []);
ok('  선도 한 주뿐이다 (같은 셈이다)',
  V.volumeTrend(ONLY_NOW, '가슴', { today: TODAY, days: 183 }).rows.length, 1);
ok('  앞날 기록은 안 센다 (등이 안 들어온다)', V.volumeParts(W, TODAY).includes('등'), false);
// 「두 주 이상」은 앞날을 빼고 센 뒤에도 지켜야 한다 — 등은 한 주뿐이라 어느 쪽이든 안 그린다.
// **앞날을 버리는 것**은 선 쪽에서 본다(아래 `volumeTrend`)
ok('  오늘을 안 주면 앞날도 선에 든다',
  V.volumeTrend(W, '등', {}).rows.map((r) => r.week), ['2027-01-04']);
ok('  오늘을 주면 그 점이 사라진다', V.volumeTrend(W, '등', { today: TODAY }).rows, []);
// 차례는 **몸 지도와 같다** — 많이 한 순으로 두면 같은 몸을 두 차례로 외우게 된다
ok('차례가 몸 지도와 같다', V.MAP_PARTS, ['가슴', '등', '어깨', '하체', '팔', '코어']);

console.log('');
console.log('── 주별 총 볼륨 ──');
const t = V.volumeTrend(W, '가슴', { today: TODAY, days: 183 });
// 10-19 주: 벤프 55×4×10 = 2,200 · 10-26 주: 60×4×10 = 2,400
ok('주마다 더한다', t.rows.map((r) => [r.week, r.kg]), [['2026-10-19', 2200], ['2026-10-26', 2400]]);
// ★ **별명이 그대로 들어온다** — 「벤프」가 가슴으로 세졌다 (어제 사전에 넣은 것)
ok('  별명(벤프)도 가슴으로 센다', t.rows[0].kg, 2200);
// ★ **이번 주는 선에 안 넣는다** — 안 끝난 주를 찍으면 늘 마지막이 꺾여 보인다
ok('**이번 주는 선에 없다**', t.rows.some((r) => r.week === '2026-11-02'), false);
ok('  대신 따로 돌려준다', [t.current.week, t.current.kg], ['2026-11-02', 2800]);
// 맨몸·유산소가 섞인 날인데 그 둘은 안 세였다 (2,800 = 70×4×10 뿐)
ok('  그 주에 섞인 맨몸·유산소는 안 세였다', t.current.kg, 2800);
ok('그 주에 며칠 했는지도 센다', t.rows[0].days, 1);
// ★ **반쪽 주는 왼쪽 끝에서도 뺀다** — 이번 주를 뺀 것과 같은 까닭이다.
// 10일 창은 10-25(일)부터인데 그 주 월요일(10-19)은 창 밖이다 → **10-26 주부터** 센다.
// 안 그러면 맨 앞 점이 사흘치라 「덜 한 주」처럼 보인다
const t3 = V.volumeTrend(W, '가슴', { today: TODAY, days: 10 });
ok('기간을 좁히면 앞 주가 빠진다', t3.rows.map((r) => r.week), ['2026-10-26']);
// 창이 월요일에 딱 걸리면 그 주는 온전하다 (버리지 않는다)
const t4 = V.volumeTrend(W, '가슴', { today: '2026-11-02', days: 7 });
ok('  창이 월요일에 딱 걸리면 그 주는 센다', t4.rows.map((r) => r.week), ['2026-10-26']);
ok('없는 부위는 빈 것이다', V.volumeTrend(W, '등', { today: TODAY, days: 183 }).rows, []);
ok('  부위를 안 주면 빈 것이다', V.volumeTrend(W, '', { today: TODAY }).rows, []);
ok('  기록이 없어도 안 터진다', V.volumeTrend(null, '가슴', { today: TODAY }).rows, []);

// **안 한 주는 점을 찍지 않는다** — 0 을 넣으면 안 한 주를 0kg 든 것으로 그린다
const GAP = {
  '2026-09-01': [{ exercise: '벤치프레스', weight: 60, sets: 4, reps: 10 }],
  '2026-10-28': [{ exercise: '벤치프레스', weight: 70, sets: 4, reps: 10 }],
};
const g = V.volumeTrend(GAP, '가슴', { today: TODAY, days: 183 });
ok('안 한 주는 점이 없다 (0 을 안 넣는다)', g.rows.length, 2);
ok('  주 차례대로다', g.rows.map((r) => r.week), ['2026-08-31', '2026-10-26']);

console.log('');
console.log('── 한 줄로 읽어준다 ──');
ok('퍼센트로 말한다', V.volumeLine([{ week: 'a', kg: 12400 }, { week: 'b', kg: 18900 }], '6개월').text,
  '6개월 안 주 12,400kg → 18,900kg · +52%');
// **꺾였으면 꺾인 그대로** 적는다 — 그래프와 글이 다른 말을 하면 글을 안 믿게 된다
ok('  꺾였으면 꺾인 그대로', V.volumeLine([{ week: 'a', kg: 20000 }, { week: 'b', kg: 15000 }], '3개월').pct, -25);
ok('  그대로면 그대로다', V.volumeLine([{ week: 'a', kg: 10000 }, { week: 'b', kg: 10000 }], '3개월').text,
  '3개월 안 주 10,000kg → 10,000kg · 그대로');
// ★ **크게 늘면 배로 말한다** — 처음 주가 가벼우면(한 세트만 한 주) 「+9900%」가
// 나온다. 맞는 수인데도 **고장처럼 읽힌다** — 사람이 읽는 수는 세 자리까지다
ok('  크게 늘면 배로 적는다',
  V.volumeLine([{ week: 'a', kg: 200 }, { week: 'b', kg: 20000 }], '6개월').text,
  '6개월 안 주 200kg → 20,000kg · 100배');
ok('    그래도 퍼센트는 들고 있다 (색을 고르는 데 쓴다)',
  V.volumeLine([{ week: 'a', kg: 200 }, { week: 'b', kg: 20000 }], '6개월').pct, 9900);
ok('    세 배 아래는 퍼센트로 적는다',
  V.volumeLine([{ week: 'a', kg: 10000 }, { week: 'b', kg: 25000 }], '6개월').text,
  '6개월 안 주 10,000kg → 25,000kg · +150%');
ok('점이 하나면 선이 아니다', V.volumeLine([{ week: 'a', kg: 100 }], '6개월'), null);
ok('  빈 것도 안 터진다', [V.volumeLine(null, '6개월'), V.volumeLine([], '6개월')], [null, null]);
ok('가장 많이 들인 주를 짚어준다',
  V.volumePeak([{ week: 'a', kg: 100 }, { week: 'b', kg: 300 }, { week: 'c', kg: 200 }]).week, 'b');
ok('  없으면 null', V.volumePeak([]), null);

console.log('');
console.log('── 두 벌로 두지 않았는가 ──');
const src = codeOf(fs.readFileSync('src/data/partVolume.js', 'utf-8'));
// 부위를 알아내는 자 · 주 경계 · 기간 칩 · 무게 읽는 자 — **다 이미 있는 것을 쓴다**
ok('부위는 몸 지도와 같은 자로 안다', /from '\.\/bodyPart'/.test(src), true);
ok('  여섯 부위도 그쪽 것을 쓴다', /from '\.\/bodyHeat'/.test(src), true);
ok('  주 경계도 그쪽 것을 쓴다', /from '\.\/weeklyReport'/.test(src), true);
ok('  무게 읽는 자도 그쪽 것을 쓴다', /from '\.\/personalRecord'/.test(src), true);
ok('  기간 칩은 어제 것을 그대로 쓴다', /export \{ MIN_POINTS, SPANS \} from '\.\/liftTrend'/.test(src), true);
// 월요일을 손으로 세지 않는다 (`getDay()` 를 여기서 또 쓰면 두 벌이 된다)
ok('월요일을 손으로 세지 않는다', /getDay\(\)/.test(src), false);

console.log('');
console.log('── 화면이 그 셈만 쓰는가 ──');
const ui = codeOf(fs.readFileSync('src/components/PartTrend.jsx', 'utf-8'));
ok('계산을 화면에서 또 하지 않는다', /\* *sets *\* *reps|reduce\(/.test(ui), false);
ok('  이번 주를 말해준다', /이번 주/.test(ui), true);
ok('  맨몸·유산소를 뺐다고 말해준다', /맨몸/.test(ui) && /유산소/.test(ui), true);
// 점이 하나뿐일 때 **빈 그래프를 그리지 않는다** (`LiftTrend` 가 세운 선)
ok('  점이 모자라면 그 말을 한다', /MIN_POINTS/.test(ui), true);
ok('  그릴 부위가 없으면 아무것도 안 그린다', /length === 0\) return null/.test(ui), true);
// 그리는 자는 이미 있다 — 새로 만들지 않는다
ok('그리는 자를 다시 만들지 않았다', /from '\.\/charts\/LineChart'/.test(ui), true);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
