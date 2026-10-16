// **건강 앱 연동이 받는 것만 받고, 지어내지 않는가** (2026-10-16)
//
//   npm run health     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 이 자리는 **조용히 넓어진다.**
//
// `capacitor-health` 플러그인은 제 매니페스트에 건강 권한 **열세 개**를 적어두고
// 있고, 그것이 **그대로 우리 앱에 합쳐진다**(라이브러리 매니페스트 병합). 우리가
// 쓰는 것은 둘(체중 · 체지방률)뿐인데, 가만두면 동의 화면에 **걸음수 · 심박 · 운동 ·
// 식사까지** 뜬다 — 사람은 그걸 보고 거절하고, 구글은 **쓰지도 않는 권한**을 왜
// 받느냐고 묻는다. 그래서 열한 개를 `tools:node="remove"` 로 지워뒀다.
// **플러그인을 올릴 때마다 되살아날 수 있는 줄이다.**
//
// 그리고 **지어내면 안 되는 자리**다. 헬스 커넥트의 `lean-body-mass`(제지방량)는
// 인바디의 **골격근량이 아니다** — 뼈 · 장기 · 수분이 다 들어 있어 대개 두 배쯤이다.
// 칸 이름이 비슷하다고 밀어 넣으면 그래프가 거짓말을 한다.
//
// 보는 것 넷 —
//   1. 묻는 권한이 **둘뿐**인가 (JS · 매니페스트 둘 다)
//   2. 골격근량에 **제지방량을 넣지 않는가**
//   3. 못 쓰는 자리에서 **단추를 안 그리는가** (브라우저 · 플러그인 뺀 판)
//   4. 방침(`/privacy`)과 **뺄 수 있는 길**(docs/PLAY-STORE.md)이 적혀 있는가
const fs = require('fs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const read = (f) => fs.readFileSync(f, 'utf-8');

const link = read('src/data/healthLink.js');
const page = read('src/pages/InbodyPage.jsx');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const privacy = read('src/pages/PrivacyPage.jsx');
const doc = read('../docs/PLAY-STORE.md');
const vars = read('android/variables.gradle');

console.log('── 1. 묻는 권한이 둘뿐인가 ──');
const jsPerms = (link.match(/HEALTH_PERMS = \[([^\]]+)\]/) || [, ''])[1]
  .split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
ok('화면이 묻는 권한', jsPerms, ['READ_WEIGHT', 'READ_BODY_FAT']);

// 매니페스트에 **살려둔** 것 (지운 줄 제외)
const kept = [...manifest.matchAll(/<uses-permission android:name="android\.permission\.health\.([A-Z_]+)"\s*(\/>|tools:node="remove")/g)]
  .filter((m) => m[2] !== 'tools:node="remove"').map((m) => m[1]);
ok('매니페스트가 살려둔 권한', kept.sort(), ['READ_BODY_FAT', 'READ_WEIGHT']);
// 플러그인이 적어둔 열셋 중 나머지는 **지워져 있어야** 한다
const PLUGIN_ALL = ['READ_STEPS', 'READ_EXERCISE', 'READ_EXERCISE_ROUTE', 'READ_DISTANCE',
  'READ_ACTIVE_CALORIES_BURNED', 'READ_TOTAL_CALORIES_BURNED', 'READ_FLOORS_CLIMBED',
  'READ_HEART_RATE', 'READ_HEIGHT', 'READ_LEAN_BODY_MASS', 'READ_NUTRITION'];
const removed = new Set([...manifest.matchAll(/android\.permission\.health\.([A-Z_]+)" tools:node="remove"/g)].map((m) => m[1]));
ok('  나머지 열하나를 지웠다', PLUGIN_ALL.filter((p) => !removed.has(p)), []);
ok('  tools 이름공간이 선언돼 있다 (없으면 remove 가 안 먹는다)',
  /xmlns:tools="http:\/\/schemas\.android\.com\/tools"/.test(manifest), true);
// 권한 화면에서 「왜 필요한가」를 여는 자리 — 13까지는 activity, 14부터는 alias
ok('권한 설명 자리가 둘 다 있다',
  /ACTION_SHOW_PERMISSIONS_RATIONALE/.test(manifest) && /category\.HEALTH_PERMISSIONS/.test(manifest), true);
// 폰에 헬스 커넥트가 깔렸는지 물어보려면 안드로이드 11부터 이 줄이 있어야 한다
ok('헬스 커넥트가 있는지 물어볼 수 있다 (queries)', /com\.google\.android\.apps\.healthdata/.test(manifest), true);
// 헬스 커넥트 라이브러리가 26 미만을 안 받는다
ok('minSdk 가 26 이상이다', Number((vars.match(/minSdkVersion = (\d+)/) || [])[1]) >= 26, true);

console.log('');
console.log('── 2. 지어내지 않는가 ──');
// **제지방량(lean-body-mass)은 골격근량이 아니다.** 가져오지도, 칸에 넣지도 않는다
ok('제지방량을 안 읽는다', /lean-body-mass/.test(link.replace(/^\s*\/\/.*$/gm, '')), false);
ok('  골격근 칸을 건드리지 않는다', /setMuscleKg\(String\(/.test(page.split('pullHealth')[1] || ''), false);
ok('읽는 것은 체중 · 체지방률뿐', [/'weight'/.test(link), /'body-fat'/.test(link)], [true, true]);
// 없는 값을 0 으로 채우면 그래프가 바닥으로 떨어진다
ok('없는 값은 null 로 둔다', /weight: w \? round1\(w\.value\) : null/.test(link), true);
// 반년 전 체중을 「오늘 잰 것」으로 적으면 안 된다
ok('오래된 값은 안 가져온다 (기간을 자른다)', /latestBody\(30\)/.test(page), true);
// 언제 · 어디서 온 값인지 같이 보여준다
ok('  어디서 온 값인지 적는다', /에서 가져왔어요/.test(page), true);

console.log('');
console.log('── 3. 못 쓰는 자리에서는 안 보인다 ──');
ok('앱일 때만', /isNativePlatform\(\)/.test(link), true);
ok('플러그인이 없으면 조용히 꺼진다', /missing = true/.test(link), true);
ok('  쓸 수 있을 때만 단추를 그린다', /\{healthOn && \(/.test(page), true);
ok('권한은 누른 자리에서 묻는다', /const allowed = await askHealth\(\)/.test(page), true);
// 두 번 거절하면 헬스 커넥트 설정에서만 풀 수 있다 — 그 자리로 가는 길이 있어야 한다
ok('  거절한 사람에게 설정으로 가는 길을 준다', /openHealthSettings/.test(page), true);

console.log('');
console.log('── 4. 방침과 뺄 수 있는 길이 적혀 있는가 ──');
// **방침과 실제가 다르면 그것 자체가 위반이다** (PrivacyPage 머리글)
ok('방침에 건강 앱 칸이 있다', /건강 앱\(헬스 커넥트\)에서 가져오는 것/.test(privacy), true);
ok('  읽는 둘을 밝힌다', /체중과 체지방률 둘뿐/.test(privacy), true);
ok('  건강 앱에 쓰지 않는다고 밝힌다', /건강 앱 쪽에는 아무것도 쓰지 않고/.test(privacy), true);
ok('스토어 문서에 빼는 법이 있다', /npm uninstall capacitor-health/.test(doc), true);
ok('  심사가 하나 더 붙는다고 적혀 있다', /건강 앱 선언 양식/.test(doc), true);

console.log('');
console.log(bad === 0 ? '모두 통과' : bad + '곳 어긋남');
process.exit(bad === 0 ? 0 : 1);
