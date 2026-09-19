// **휴식 타이머가 맞는 것을 보여주는가, 그리고 필요할 때만 다시 그리는가** (2026-09-19).
//
//   npm run rest      (npm run check 에도 들어 있다)
//
// 휴식 타이머에는 잣대가 둘 있다. 이름이 비슷해서 **바꿔 쓰기 쉽다** —
//
//   · `duration` — **다음** 휴식에 쓸 기본값 (사람이 프리셋으로 고르는 것)
//   · `runSec`   — **지금 도는** 휴식이 몇 초짜리인가 (+30초를 누르면 여기가 늘어난다)
//
// 9/14 에 링(`RestTimer`)에서 이 둘을 바꿔 쓴 것을 고쳤는데, **띠(`RestBar`)는 그대로
// 남아 있었다** (9/19 에 찾았다). 그래서 이랬다 —
//
//   · +30초를 누르면 120초를 쉬는데 잣대가 90초 → 비율이 1을 넘어 잘리면서
//     **띠가 꽉 찬 채로 30초를 멈춰 있다**
//   · 쉬는 중에 프리셋을 180초로 바꾸면 **띠가 그 자리에서 반으로 줄어든다**
//
// 둘 다 「잘못된 값이 뜬다」가 아니라 **「그럴듯한 값이 뜬다」**라서 눈으로 안 잡힌다.
// 그리고 250ms 마다 다시 그리던 것을 **초가 바뀔 때만** 그리게 바꿨으므로,
// 움직임(CSS transition)이 그 간격과 맞는지도 여기서 본다 — 어긋나면 뚝뚝 끊겨 보인다.
const fs = require('fs');

const read = (f) => fs.readFileSync(f, 'utf-8');
let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 잣대를 바꿔 쓰지 않는가 ──');
const bar = read('src/components/RestBar.jsx');
const ring = read('src/components/RestTimer.jsx');
// 비율을 잴 때 `duration` 을 잣대로 쓰면 위의 두 증상이 그대로 돌아온다
ok('띠는 runSec 로 비율을 잰다', /const span = runSec > 0 \? runSec : duration/.test(bar), true);
ok('  duration 으로 나누지 않는다', /leftMs[^)]*\)\s*\/\s*\(duration \* 1000\)/.test(bar), false);
ok('링도 제 잣대로 잰다 (span)', /leftMs \?\? 0\) \/ \(span \* 1000\)/.test(ring), true);

console.log('');
console.log('── 값으로 맞춰본다 (스토어를 떼어내 계산) ──');
// 화면 없이 셈만 본다. 이 앱의 규칙: +30초는 10분에서 자르고, 늘린 만큼 잣대도 늘어난다
const MAX_SEC = 600;
const sim = (startSec, adds = []) => {
  let runSec = Math.min(MAX_SEC, startSec);
  let leftMs = runSec * 1000;
  for (const a of adds) {
    const grown = Math.min(MAX_SEC, runSec + a);
    const added = grown - runSec;
    runSec = grown;
    leftMs += added * 1000;
  }
  return { runSec, ratio: Math.max(0, Math.min(1, leftMs / (runSec * 1000))) };
};
// 90초를 시작하고 바로 +30초 → 120초짜리이고, 방금 시작했으니 비율은 1 이다.
// 옛 방식(잣대 90초)이면 120/90 = 1.33 → 잘려서 1 로 보이고, **30초 동안 안 움직인다**
ok('90초에 +30초 → 120초짜리', sim(90, [30]).runSec, 120);
ok('  방금 시작했으므로 비율은 1', sim(90, [30]).ratio, 1);
// 10분에서 자른다 (스무 번 눌러도)
ok('+30초를 스무 번 눌러도 10분에서 자른다', sim(90, Array(20).fill(30)).runSec, MAX_SEC);
// 절반쯤 지났으면 비율도 절반 — 잣대가 맞으면 그렇게 나온다
const half = (runSec) => Math.max(0, Math.min(1, (runSec * 1000 / 2) / (runSec * 1000)));
ok('절반 지났으면 0.5', half(120), 0.5);

console.log('');
console.log('── 초당 한 번 알려주는데 움직임도 그에 맞는가 ──');
const store = read('src/store/restTimerStore.js');
// 시계는 250ms 마다 본다 (끝나는 순간을 늦게 알면 안 된다)
ok('시계는 250ms 마다 본다', /TICK_MS = 250/.test(store), true);
// 넣는 것은 적히는 초가 바뀔 때만 — 90초 휴식에 360번이 90번이 된다
ok('  적히는 초가 바뀔 때만 넣는다', /if \(shown !== before\) set\(\{ leftMs: left \}\)/.test(store), true);
// 그러면 움직임은 1초여야 한다. 0.25초로 두면 한 칸 움직이고 0.75초를 멈춰 있다
ok('띠의 움직임이 1초다', /transition: 'width 1s linear'/.test(bar), true);
ok('링의 움직임이 1초다', /stroke-dashoffset 1s linear/.test(ring), true);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
