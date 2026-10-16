// **쉬는 시간이 끝난 것을 폰이 알리는가** (2026-10-16)
//
//   npm run alarm     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 이 길은 **PC 에서 시험이 안 된다.** 브라우저에서는 통째로 꺼지도록 만들었기 때문에,
// 여기를 잘못 건드려도 내 컴퓨터에서는 아무 일도 안 일어난다 — 알림이 안 가는 것은
// 진짜 폰에서 90초를 쉬어 봐야 안다. 공유 시트(`check-share.cjs`)와 같은 자리다.
//
// 그리고 **되돌아가기 쉬운 선이 넷** 있다. 넷 다 「고장」이 아니라 「조금 거슬림」으로
// 나타나서, 검사가 없으면 슬그머니 풀린다 —
//
//   1. **앱에서만 건다.** 브라우저에서 켜지면 지금 울리는 방식과 겹친다
//   2. **뒤로 갈 때 걸고 돌아오면 지운다.** 늘 걸어두면 띠의 삑 소리와 OS 알림이
//      **두 번 울린다**
//   3. **이미 울린 뒤에 돌아왔으면 띠는 조용하다.** 주머니에서 알림을 받고 3분 뒤에
//      앱을 열었는데 그제서야 삑 소리가 나면 사람은 시계를 다시 본다
//   4. **정확한 알람을 제멋대로 조르지 않는다.** 플러그인 기본값(`isExactNotification`)
//      그대로 두면 **예약할 때마다 안드로이드 설정 화면이 열린다** — 세트 사이에
const fs = require('fs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const read = (f) => fs.readFileSync(f, 'utf-8');

const alarm = read('src/data/restAlarm.js');
const hook = read('src/data/useRestAlarm.js');
const bar = read('src/components/RestBar.jsx');

console.log('── 1. 앱에서만 ──');
ok('앱인지 보고 돌아선다', /isNativePlatform\(\)/.test(alarm), true);
ok('  예약도 그 문을 지난다', /scheduleRestAlarm[\s\S]{0,200}?if \(!canRestAlarm\(\)/.test(alarm), true);
ok('  지우는 것도', /cancelRestAlarm[\s\S]{0,120}?if \(!canRestAlarm\(\)/.test(alarm), true);
ok('플러그인은 쓸 때 받는다 (첫 화면 무게)', /await import\('@capacitor\/local-notifications'\)/.test(alarm), true);
ok('  맨 위에서 받지 않는다', /^import .*local-notifications/m.test(alarm), false);

console.log('');
console.log('── 2. 뒤로 갈 때만 건다 ──');
ok('앱 상태를 듣는다', /appStateChange/.test(hook), true);
ok('  돌아오면 지운다', /if \(active\) \{[\s\S]{0,200}?cancelRestAlarm\(\)/.test(hook), true);
ok('  뒤로 가면 건다', /else \{[\s\S]{0,120}?scheduleRestAlarm\(deadline/.test(hook), true);
ok('떠날 때도 지운다 (정리)', /return \(\) => \{[\s\S]{0,160}?cancelRestAlarm\(\)/.test(hook), true);
ok('소리·진동을 둘 다 끄면 안 건다', /running && \(sound \|\| vibrate\) \? deadline : null/.test(bar), true);

console.log('');
console.log('── 3. 두 번 울리지 않는다 ──');
ok('띠는 알림이 울렸으면 조용하다', /if \(!alarmFired\.current\) beepDone/.test(bar), true);
ok('  울렸는지는 돌아온 시각으로 안다', /if \(armed && Date\.now\(\) >= deadline\) fired\.current = true/.test(hook), true);
ok('  새 휴식에서는 처음부터 센다', /fired\.current = false/.test(hook), true);
ok('예약 번호는 하나다 (덮어쓴다)', /const ID = \d+/.test(alarm), true);

console.log('');
console.log('── 4. 설정 화면을 열지 않는다 ──');
ok('허락돼 있을 때만 정확히 건다', /isExactNotification: exactOk === true/.test(alarm), true);
ok('  먼저 물어본다', /checkExactNotificationSetting\(\)/.test(alarm), true);
ok('깊이 잠든 폰도 깨운다', /allowWhileIdle: true/.test(alarm), true);
ok('잠금화면에 뜨는 채널', /importance: 5/.test(alarm) && /visibility: 1/.test(alarm), true);
ok('권한은 한 번만 묻는다', /LS_ASKED/.test(alarm), true);

console.log('');
console.log('── 5. 한 줄을 두 벌로 만들지 않는다 ──');
// 띠에 적는 줄과 알림에 적는 줄이 갈라지면 잠금화면과 띠가 다른 말을 한다
// 셋 — 만드는 자리 하나, 쓰는 자리 둘(알림에 적는 줄 · 띠에 적는 줄)
ok('`nextLine` 한 곳에서 만든다', (bar.match(/nextLine\(view, label\)/g) || []).length, 3);
ok('  띠 안에 따로 적지 않는다', /다음 · \$\{view\.nextSet\}세트[\s\S]{0,80}?<\/span>/.test(bar), false);

console.log('');
console.log(bad === 0 ? '모두 통과' : bad + '곳 어긋남');
process.exit(bad === 0 ? 0 : 1);
