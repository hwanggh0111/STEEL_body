// 쉬는 동안 보여줄 것 (2026-10-01, 시안 A).
//
//   npm run nextset     (npm run check 에도 들어 있다)
//
// 쉬는 자리에 「다음 · 4세트 · 80kg 5회」와 「지난 번엔 4세트째에서 4회로 줄였어요」를
// 적는다. **눈으로 보려면 판을 시작해 세트를 두 번 저장하고 그 다음 휴식까지** 가야
// 하고, 「지난 번」은 **다른 날 기록이 있어야** 나온다. 그래서 값으로 본다.
//
// 여기서 지키려는 것은 하나다 — **지어내지 않는다.** 다음에 들 무게·횟수는
// 방금 적은 그 값이고, 지난 번 이야기는 기록에 적힌 것뿐이다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const { restView, exerciseOfLabel } = bundle('src/data/nextSet.js', '.n1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const w = (exercise, sets, reps, weight) => ({ exercise, sets, reps, weight });
const TODAY = '2026-10-01';

// 10/1 에 이 규칙을 **두 군데에 따로 적었다가** 한쪽의 역슬래시가 날아갔다.
// `/s*d+세트s*$/` 는 터지지도 않고 아무것도 안 떼서, 그 화면에서만 카드가
// 조용히 안 나왔다 — 검사도 빌드도 통과했다. 그래서 여기서 본다.
console.log('── 휴식 이름에서 운동 이름을 꺼낸다 ──');
ok('뒤의 세트 번호를 뗀다', exerciseOfLabel('벤치프레스 3세트'), '벤치프레스');
ok('  두 자리도 뗀다', exerciseOfLabel('랫풀다운 12세트'), '랫풀다운');
ok('  이름에 띄어쓰기가 있어도 이름은 남는다', exerciseOfLabel('인클라인 벤치 프레스 1세트'), '인클라인 벤치 프레스');
ok('  세트가 안 붙어 있으면 그대로', exerciseOfLabel('벤치프레스'), '벤치프레스');
ok('  이름 안의 숫자는 안 건드린다', exerciseOfLabel('21s 컬 2세트'), '21s 컬');
ok('  빈 값도 안 터진다', [exerciseOfLabel(''), exerciseOfLabel(null), exerciseOfLabel(undefined)], ['', '', '']);
ok('  떼고 나면 기록에서 찾힌다', restView({ '2026-10-01': [w('벤치프레스', 1, 5, 80)] }, exerciseOfLabel('벤치프레스 1세트'), '2026-10-01').doneSets, 1);

console.log('');
console.log('── 오늘 적은 것이 없으면 아무 말도 안 한다 ──');
ok('적은 적이 없다', restView({}, '벤치프레스', TODAY), null);
ok('  다른 운동만 적었다', restView({ [TODAY]: [w('스쿼트', 1, 10, 60)] }, '벤치프레스', TODAY), null);
ok('  운동 이름이 없다', restView({ [TODAY]: [w('벤치프레스', 1, 5, 80)] }, '', TODAY), null);

console.log('\n── 다음 세트는 방금 적은 것 다음이다 ──');
{
  const v = restView({ [TODAY]: [w('벤치프레스', 1, 5, 80), w('벤치프레스', 2, 5, 80)] }, '벤치프레스', TODAY);
  ok('지금까지 두 세트', v.doneSets, 2);
  ok('  다음은 3세트', v.nextSet, 3);
  ok('  다음에 들 것은 방금 든 것', [v.weight, v.reps], [80, 5]);
  ok('  지난 번이 없으면 null', v.last, null);
  ok('  칸은 오늘 한 만큼만', v.planSets, 2);
}

console.log('\n── 적힌 차례를 믿지 않는다 ──');
{
  // 고치면 뒤에 붙는다 — 2세트를 고치면 목록에서 3세트보다 뒤에 온다.
  // 그때 「방금 적은 것」을 목록 마지막으로 잡으면 **다음 세트가 거꾸로 간다**
  const v = restView({ [TODAY]: [w('벤치프레스', 3, 4, 80), w('벤치프레스', 1, 5, 80), w('벤치프레스', 2, 5, 80)] }, '벤치프레스', TODAY);
  ok('세트 번호로 센다', v.doneSets, 3);
  ok('  다음은 4세트', v.nextSet, 4);
  ok('  방금 든 것도 세트 번호가 큰 줄에서 읽는다', v.reps, 4);
}

console.log('\n── 지난 번은 오늘이 아닌 가장 가까운 날이다 ──');
{
  const workouts = {
    '2026-09-10': [w('벤치프레스', 1, 5, 70)],
    '2026-09-24': [w('벤치프레스', 1, 5, 80), w('벤치프레스', 2, 5, 80), w('벤치프레스', 3, 5, 80), w('벤치프레스', 4, 4, 80), w('벤치프레스', 5, 4, 80)],
    '2026-10-05': [w('벤치프레스', 1, 5, 85)],   // 앞날에 적어둔 것은 지난 번이 아니다
    [TODAY]: [w('벤치프레스', 1, 5, 80), w('벤치프레스', 2, 5, 80), w('벤치프레스', 3, 5, 80)],
  };
  const v = restView(workouts, '벤치프레스', TODAY);
  ok('가장 가까운 지난 날', v.last.date, '2026-09-24');
  ok('  그날 세트 수', v.last.sets, 5);
  ok('  그날 가장 많이 한 횟수', v.last.topReps, 5);
  ok('  줄어든 첫 세트', v.drop, { set: 4, reps: 4 });
  ok('  칸은 지난 번만큼', v.planSets, 5);
  ok('  아직 다 안 했다', v.done, false);
}

console.log('\n── 안 줄었으면 줄었다고 하지 않는다 ──');
{
  const workouts = {
    '2026-09-24': [w('스쿼트', 1, 10, 60), w('스쿼트', 2, 10, 60)],
    [TODAY]: [w('스쿼트', 1, 10, 60)],
  };
  ok('끝까지 같은 횟수', restView(workouts, '스쿼트', TODAY).drop, null);
}
{
  const workouts = {
    '2026-09-24': [w('스쿼트', 1, 10, 60)],
    [TODAY]: [w('스쿼트', 1, 10, 60)],
  };
  ok('지난 번이 한 세트뿐이면 말할 것이 없다', restView(workouts, '스쿼트', TODAY).drop, null);
}

console.log('\n── 지난 번만큼 다 했으면 그렇게 안다 ──');
{
  const workouts = {
    '2026-09-24': [w('데드리프트', 1, 5, 100), w('데드리프트', 2, 5, 100)],
    [TODAY]: [w('데드리프트', 1, 5, 100), w('데드리프트', 2, 5, 100)],
  };
  const v = restView(workouts, '데드리프트', TODAY);
  ok('다 했다', v.done, true);
  ok('  그래도 다음 세트 번호는 센다', v.nextSet, 3);
}
{
  const workouts = {
    '2026-09-24': [w('데드리프트', 1, 5, 100), w('데드리프트', 2, 5, 100)],
    [TODAY]: [w('데드리프트', 1, 5, 100), w('데드리프트', 2, 5, 100), w('데드리프트', 3, 5, 100)],
  };
  ok('지난 번보다 더 했으면 칸도 오늘에 맞춘다', restView(workouts, '데드리프트', TODAY).planSets, 3);
}

console.log('\n── 이름은 앞뒤 공백과 대소문자를 안 가린다 ──');
{
  const workouts = { [TODAY]: [w(' Bench ', 1, 5, 80)] };
  ok('공백·대소문자가 달라도 같은 운동', restView(workouts, 'bench', TODAY).doneSets, 1);
  ok('  다른 운동은 안 섞인다', restView({ [TODAY]: [w('벤치프레스', 1, 5, 80)] }, '벤치프레스 와이드', TODAY), null);
}

console.log('\n── 값이 비어 있어도 안 터진다 ──');
{
  const workouts = { [TODAY]: [{ exercise: '맨몸스쿼트', sets: 1, reps: null, weight: null }] };
  const v = restView(workouts, '맨몸스쿼트', TODAY);
  ok('맨몸운동은 무게가 0', [v.weight, v.reps], [0, 0]);
  ok('  빈 줄이 섞여도 센다', restView({ [TODAY]: [null, w('맨몸스쿼트', 2, 15, 0)] }, '맨몸스쿼트', TODAY).doneSets, 2);
}

console.log(bad === 0 ? '\n전부 통과' : '\n' + bad + '건 실패');
process.exit(bad === 0 ? 0 : 1);
