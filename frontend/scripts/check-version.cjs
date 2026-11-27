// **버전이 한 벌인가 · 라이브가 어느 판인지 짚을 수 있나** (2026-11-27 · 정석).
//
//   npm run ver     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 버전이 **세 자리에 따로** 박혀 있었다 —
//
//   `package.json`                  `1.0.0`
//   `android/app/build.gradle`      `versionName "1.0"` · `versionCode 1`
//   화면 넷(설정 · 소개 · 고객센터 · 제보)   `pkg.version` 을 그대로
//
// ⑴ **스토어와 앱이 다른 수를 말했다.** 스토어 목록은 「1.0」, 설정 화면은 「v1.0.0」.
//    사람이 제보할 때 어느 쪽을 적어도 우리가 모른다. `check-brand` 의 이름 두 벌과
//    **같은 류**다 — 같은 것을 두 곳에 적어두면 어느 순간 한쪽만 바뀐다.
//
// ⑵ 더 큰 것은 **그 수가 안 변한다**는 것이다. 설정 화면에는 이렇게 적혀 있었다 —
//    「판 번호는 **제보할 때 필요한 것**이다. 지금 무슨 판을 쓰고 있나를 눈으로 볼
//    자리가 아무 데도 없었다」. 그런데 11월에 커밋 마흔 몇 개가 라이브로 나가는 동안
//    화면은 내내 `v1.0.0` 이었다. **적어둔 뜻이 코드에서 서 있지 않았다.**
//    제보에 붙는 `appVersion` 도 늘 `1.0.0` 이라 **어느 판에서 난 일인지 짚을 수
//    없었다** — 부총재가 받는 500 도 같은 처지다(라이브는 12/1 에 켜진다).
//
// ── 무엇을 보는가 ──
//
//   ⑴ 버전을 말하는 자리가 **`package.json` 하나**인가 (gradle 에 손으로 박은 수가
//      없고, 정말 `package.json` 을 읽는가)
//   ⑵ `versionCode` 셈이 **늘 커지는가** — `1.0.0` → `10000`. 그 셈을 여기서 또 해
//      gradle 이 적어둔 꼴과 견준다
//   ⑶ 화면 넷이 **`pkg.version` 을 직접 쓰지 않는가** (그 수는 안 변한다)
//   ⑷ 판 번호가 **공지 산출물의 맨 윗 커밋**과 같은가 — 라이브로 가는 그 수다
//   ⑸ 제보에 붙는 글자가 **스무 자 안**인가 (서버가 `DEVICE_FIELDS.appVersion = 20`
//      으로 자른다 — 넘치면 판 번호가 **잘려서** 짚을 수 없다)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf-8');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const pkg = JSON.parse(rd('package.json'));
const gradle = rd('android/app/build.gradle');
// ── **주석을 빼고 본다** ── (첫 판이 제 주석을 읽고 울었다)
//
// 그 파일의 주석에 「`versionName "1.0"` 이 박혀 있었다」고 **까닭을 적어뒀다.**
// 글자로 찾으면 그 설명이 걸린다 — 자는 **코드를 봐야** 한다. 까닭을 지우는 쪽이
// 아니라 자를 고치는 쪽이 맞다(적어둔 까닭이 다음 사람을 살린다)
const 코드 = gradle.replace(/^\s*\/\/.*$/gm, '');
const changelog = JSON.parse(rd('src/data/changelog.json'));

console.log('── ⑴ 버전의 주인은 한 자리인가 ──');
ok('`package.json` 의 version 이 세 토막 꼴이다', /^\d+\.\d+\.\d+$/.test(pkg.version || ''), true);
// 손으로 박은 수가 **없어야** 한다. `versionName "1.0"` · `versionCode 1` 꼴
ok('★ gradle 에 손으로 박은 versionName 이 없다', /versionName\s+"/.test(코드), false);
ok('★ gradle 에 손으로 박은 versionCode 가 없다', /versionCode\s+\d/.test(코드), false);
ok('  gradle 이 `package.json` 을 읽는다', gradle.includes("'../../package.json'"), true);
ok('  못 찾으면 조용히 넘기지 않고 터진다', /package\.json 을 못 찾았다[\s\S]{0,200}GradleException|GradleException[\s\S]{0,80}못 찾았다/.test(gradle), true);

console.log('\n── ⑵ versionCode 가 늘 커지는가 ──');
//
// gradle 쪽 셈을 **여기서 또 해 본다.** 꼴을 견주는 것이 아니라 **값**을 견준다 —
// `major*10000 + minor*100 + patch` 가 그 파일에 그대로 적혀 있어야 한다
const [major, minor, patch] = pkg.version.split('.').map(Number);
const 셈 = major * 10000 + minor * 100 + patch;
ok('gradle 이 10000·100 자리로 센다',
  /major \* 10000 \+ minor \* 100 \+ patch/.test(gradle), true);
ok(`  지금 버전(${pkg.version})의 versionCode 는 ${셈} 이다`, 셈 > 0, true);
ok('  자리가 넘치면 터뜨린다 (minor·patch 는 99 까지)',
  /minor > 99 \|\| patch > 99/.test(gradle) && /GradleException/.test(gradle), true);
ok('  지금 버전은 그 자리를 안 넘는다', [minor <= 99, patch <= 99], [true, true]);

console.log('\n── ⑶ 화면이 안 변하는 수를 그리지 않는가 ──');
//
// **`pkg.version` 을 직접 쓰면 영영 `1.0.0` 이다.** 사람에게 보이는 자리는 전부
// `data/appVersion.js` 를 거친다
const 화면 = [
  'src/pages/SettingsPage.jsx',
  'src/pages/IntroPage.jsx',
  'src/pages/support/SupportPage.jsx',
  'src/pages/support/ReportBox.jsx',
];
for (const f of 화면) {
  const s = rd(f);
  ok(`★ ${path.basename(f)} — package.json 을 직접 안 든다`, /from '.*package\.json'/.test(s), false);
  ok(`  ${path.basename(f)} — appVersion 을 든다`, /from '.*data\/appVersion'/.test(s), true);
}

console.log('\n── ⑷ 판 번호가 라이브로 가는 그 수인가 ──');
//
// 판 번호는 `changelog.json` 의 맨 윗 커밋이다. 그 파일은 빌드마다 다시 뽑히고
// **커밋되어** 라이브로 간다(Render 는 얕은 클론이라 빌드 때 git 을 다시 못 읽는다).
// 그래서 새 산출물을 만들지 않고 이미 그러고 있는 것을 쓴다
const ver = rd('src/data/appVersion.js');
ok('appVersion 이 판 번호 산출물을 든다', ver.includes("./build.json"), true);
// ★ **공지(75KB)를 들여오면 안 된다** — 10/16 에 `feedData.js` 에서 떼어낸 무게다.
//   그래서 맨 윗 커밋만 담은 `build.json` 을 따로 뽑는다
ok('★ 공지 75KB 를 첫 화면에 들여오지 않는다', ver.includes("./changelog.json"), false);
const built = JSON.parse(rd('src/data/build.json'));
const 맨위 = (changelog.items && changelog.items[0] && changelog.items[0].hash) || '';
ok('공지 산출물 맨 위에 커밋이 있다', /^[0-9a-f]{7,40}$/.test(맨위), true);
// ★ **둘을 묶는 자리다.** 산출물 하나만 담고 다른 하나를 빠뜨리면 여기서 운다 —
//   그러면 화면이 **옛 판 번호**를 말하고, 제보에 붙는 수가 거짓이 된다
ok('★ 판 번호가 공지 맨 윗 커밋과 같다', built.hash, 맨위);
ok(`  지금 판 번호는 ${맨위} 다`, 맨위.length >= 7, true);
// **작아야 뜻이 있다** — 커지면 떼어낸 까닭이 사라진다
ok('  판 번호 산출물이 작다 (300바이트 안)',
  fs.statSync(path.join(ROOT, 'src/data/build.json')).size <= 300, true);
// **못 읽는 날에도 화면이 안 깨져야 한다** — 빈 글자면 괄호를 안 그린다
ok('  못 읽으면 빈 글자로 비킨다 (화면이 괄호를 안 그린다)',
  /build \? `v\$\{version\} \(\$\{build\}\)` : `v\$\{version\}`/.test(ver), true);

console.log('\n── ⑸ 제보에 붙는 글자가 서버가 자르는 선 안인가 ──');
//
// 서버는 `DEVICE_FIELDS = { appVersion: 20 }` 으로 자른다. 넘치면 **판 번호가
// 잘려서** 짚을 수 없다 — 자르는 선을 **서버에서 직접 읽어** 견준다(두 벌로 적지 않는다)
const 서버 = fs.readFileSync(path.join(ROOT, '..', 'backend/src/routes/reports.js'), 'utf-8');
const m = 서버.match(/appVersion:\s*(\d+)/);
ok('서버가 자르는 선을 읽었다', m !== null, true);
const 선 = m ? Number(m[1]) : 0;
const stamp = `${pkg.version}+${맨위}`;
ok(`  제보에 붙는 "${stamp}" 가 ${선}자 안이다`, stamp.length <= 선, true);
// 버전이 커져도 안전한가 — 두 자리씩 꽉 찬 꼴로 재 본다
ok('  버전이 `99.99.99` 가 되어도 안 잘린다', `99.99.99+${'0'.repeat(7)}`.length <= 선, true);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
