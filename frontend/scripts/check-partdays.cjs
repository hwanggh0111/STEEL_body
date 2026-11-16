// 적는 자리에서 **그 부위를 마지막으로 언제 했나** (2026-11-16).
//
//   npm run partdays      (npm run check 에도 들어 있다)
//
// `data/partPreview.js` 를 **적는 자리(`TrainPage`)** 가 쓰기 시작했다 (11/16, 벼림).
// 부위 화면에서만 쓰던 셈이라, 적는 자리의 사정이 더 붙었다 — 날짜를 옮겨 적는 중일
// 수도 있고, 고치는 중일 수도 있고, 유산소를 적는 중일 수도 있다.
//
// **화면으로는 확인하기 어렵다.** 「6일째 식었다」를 눈으로 보려면 엿새를 기다려야
// 하고, 「어제 자리에 적는 중에는 침묵」은 날짜를 옮겨 적어봐야 보인다. 수와 날짜를
// 손으로 먹여서 본다. `check-sore.cjs` 는 부위 화면 쪽을 보고, 여기는 **적는 자리가
// 입을 다무는 자리**를 본다.
//
// 지키는지 보는 것:
//   · 식은 날 수 경계를 **글자로 박지 않는다** — `COLD_DAYS` 를 읽는다
//   · **모르는 이름·유산소에는 부위를 짐작하지 않는다**
//   · **0일은 「오늘 이미」** 다 — 「0일 전에 했어요」라고 적지 않는다
//   · 「그럼 뭘 하지」 한 줄은 **셋 중 하나라도 걸리면 침묵**한다 —
//     고른 곳이 이미 식었을 때 · 식은 곳이 없을 때 · 아프다고 적어둔 곳일 때
//   · 적는 자리는 **오늘이 아니면 그리지 않는다** — 어제 자리에 적는 중에
//     「오늘 이미 했어요」가 뜨면 그 「오늘」이 어느 날인지 알 수 없다
//   · **고치는 중에도 그리지 않는다** — 이미 적힌 줄을 손보는 중이다
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const P = bundle('src/data/partPreview.js', '.pd1.cjs');
const H = bundle('src/data/bodyHeat.js', '.pd2.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 경계는 **셈에서 읽는다** — 여기 숫자를 적으면 셈이 바뀔 때 자만 옛 선을 본다
const { COLD_DAYS } = P;
const TODAY = '2026-11-16';

// 몸 지도를 손으로 짓는다. { 부위: 며칠째 } 를 받아 그 날짜에 기록을 놓는다
const 지도 = (표) => {
  const 기록 = {};
  Object.entries(표).forEach(([part, days], i) => {
    if (days === null) return;                           // 한 번도 안 한 부위
    const d = new Date(Date.UTC(2026, 10, 16) - days * 86400000);
    const 날 = d.toISOString().slice(0, 10);
    기록[날] = [...(기록[날] || []), { exercise: 이름[part] || part, weight: 20, reps: 10, sets: 1, id: `w${i}` }];
  });
  return H.buildHeat(기록, TODAY);
};
// 부위를 확실히 집는 이름들 (사전이 아는 이름이어야 한다)
const 이름 = {
  가슴: '벤치프레스', 등: '랫풀다운', 어깨: '숄더프레스',
  팔: '바벨컬', 하체: '스쿼트', 코어: '플랭크',
};

console.log('── 경계는 셈이 정한다 ──');
ok('셈이 식은 날 수를 내놓는다', typeof COLD_DAYS, 'number');

console.log('');
console.log('── 모르는 것은 모른다고 한다 ──');
{
  // 유산소는 **부위가 없다** — 사전이 몸 부위를 안 적어둔 이름이다
  const heat = 지도({ 가슴: 0 });
  const v = P.previewPart('러닝머신', heat, []);
  ok('유산소는 부위를 짐작하지 않는다', v.known, false);
  ok('  달아오를 곳도 0 이다', v.level, 0);
  ok('  「그럼 뭘 하지」도 말하지 않는다', P.elsewhereLine(v, heat, []), null);
  const u = P.previewPart('내가 지어낸 운동', heat, []);
  ok('모르는 이름도 침묵한다 (한 줄만 알린다)', u.known, false);
  ok('  그 자리에서도 다른 곳을 권하지 않는다', P.elsewhereLine(u, heat, []), null);
  ok('이름이 비면 아무것도 아니다', P.previewPart('   ', heat, []), null);
}

console.log('');
console.log('── 0일은 「오늘 이미」다 ──');
{
  const heat = 지도({ 가슴: 0, 등: COLD_DAYS + 1 });
  const v = P.previewPart('벤치프레스', heat, []);
  ok('오늘 한 부위는 0일이다', v.days, 0);
  ok('  「0일 전에 했어요」라고 적지 않는다', P.previewLine(v), '가슴 — 오늘 이미 했어요.');
  const c = P.previewPart('랫풀다운', heat, []);
  ok('경계를 넘으면 식었다고 한다', [c.cold, P.previewLine(c)], [true, `등 — ${COLD_DAYS + 1}일째 식어 있어요.`]);
  const 어제 = 지도({ 가슴: 1 });
  ok('하루 지난 것은 식은 것이 아니다', P.previewLine(P.previewPart('벤치프레스', 어제, [])), '가슴 — 1일 전에 했어요.');
}

console.log('');
console.log('── 「그럼 뭘 하지」는 셋 중 하나라도 걸리면 침묵한다 ──');
{
  // ① 고른 곳이 아직 달아 있고(0~2일) 식은 곳이 있으면 **말한다**
  const heat = 지도({ 가슴: 0, 등: COLD_DAYS + 2, 하체: null });
  const v = P.previewPart('벤치프레스', heat, []);
  const 말 = P.elsewhereLine(v, heat, []);
  ok('달아 있을 때 식은 곳을 알려준다', typeof 말 === 'string' && 말.includes('식어 있어요'), true);
  ok('  한 번도 안 한 곳은 날 수를 지어내지 않는다', String(말).includes('한 번도'), true);
}
{
  // ② 고른 곳이 **이미 식어 있으면** 침묵 — 맞는 자리인데 다른 곳을 권하면 잔소리다
  const heat = 지도({ 가슴: COLD_DAYS + 1, 등: COLD_DAYS + 3 });
  const v = P.previewPart('벤치프레스', heat, []);
  ok('고른 곳이 이미 식었으면 침묵한다', P.elsewhereLine(v, heat, []), null);
}
{
  // ③ 고른 곳이 사흘 전이면 침묵 — 0~2일만 말한다
  const heat = 지도({ 가슴: 3, 등: COLD_DAYS + 3 });
  const v = P.previewPart('벤치프레스', heat, []);
  ok('사흘 전이면 침묵한다 (0~2일만 말한다)', P.elsewhereLine(v, heat, []), null);
}
{
  // ④ 식은 곳이 **없으면** 침묵 — 사흘 전인 곳을 식었다고 말하지 않는다
  const heat = 지도({ 가슴: 0, 등: 2, 어깨: 3, 팔: 1, 하체: 2, 코어: 3 });
  const v = P.previewPart('벤치프레스', heat, []);
  ok('식은 곳이 없으면 침묵한다', P.elsewhereLine(v, heat, []), null);
}
{
  // ⑤ 아프다고 적어둔 곳은 **권하지 않는다**
  const heat = 지도({ 가슴: 0, 등: COLD_DAYS + 2 });
  const sore = [{ part: '등', date: '2026-11-15' }];
  const v = P.previewPart('벤치프레스', heat, sore);
  const 말 = P.elsewhereLine(v, heat, sore);
  ok('아픈 곳은 권하지 않는다', 말 === null || !말.includes('등'), true);
  // 아픈 곳을 **고른** 사람에게는 막지 않고 알린다
  const s = P.previewPart('랫풀다운', heat, sore);
  ok('  아픈 곳을 고르면 알리기는 한다', typeof P.soreWarn(s), 'string');
  ok('  막지는 않는다 (「하셔도 되지만」)', P.soreWarn(s).includes('하셔도 되지만'), true);
}

console.log('');
console.log('── 적는 자리는 오늘이 아니면 그리지 않는다 ──');
{
  // 이것은 화면 쪽 사정이라 **코드를 본다.** 어제 자리에 적는 중에 「오늘 이미
  // 했어요」가 뜨면 그 「오늘」이 어느 날인지 알 수 없다. 고치는 중도 같다 —
  // 이미 적힌 줄을 손보는 중이지 새로 고르는 중이 아니다
  const src = fs.readFileSync('src/pages/TrainPage.jsx', 'utf8');
  const 부른자리 = src.split('\n')
    .map((l, i) => ({ l, n: i + 1 }))
    .filter(({ l }) => /previewPart\s*\(/.test(l) && !/^\s*(\/\/|\*)/.test(l) && !/^import/.test(l));
  ok('적는 자리가 미리보기를 한 곳에서만 부른다', 부른자리.length, 1);
  const 앞 = 부른자리.length ? src.split('\n').slice(Math.max(0, 부른자리[0].n - 4), 부른자리[0].n).join('\n') : '';
  ok('  오늘일 때만 그린다 (`date === today`)', /date\s*===\s*today/.test(앞), true);
  ok('  고치는 중에는 그리지 않는다 (`!editingId`)', /!\s*editingId/.test(앞), true);
}

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
