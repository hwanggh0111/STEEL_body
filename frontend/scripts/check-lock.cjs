// 앱 잠금 (2026-09-18).
//
//   npm run lock     (npm run check 에도 들어 있다)
//
// **몸 사진이 들어 있는 앱**인데 폰을 잠깐 빌려주면 다 보였다 — 앱은 늘 로그인된 채로
// 열려 있어서 여는 데 아무것도 필요 없었다.
//
// **화면으로 확인하기 어려운 것들이다.** 「45초 넘게 비워두면 잠근다」를 눈으로 보려면
// 폰을 놓고 45초를 기다려야 하고, 「다섯 번 틀리면 30초 쉰다」는 다섯 번 틀려야 한 번
// 나온다. 그래서 값으로 본다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

// `localStorage` 가 없는 자리(node)에서도 돌아야 한다 — `safeStorage` 가 삼키게 돼 있다.
// 여기서는 **담아둔 것이 없을 때**의 판단만 본다 (담는 것은 브라우저의 일이다)
const lock = bundle('src/data/appLock.js', '.l1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');
const read = (f) => codeOf(fs.readFileSync(f, 'utf-8'));

console.log('── 네 자리인가 ──');
ok('네 자리 숫자만 받는다', [lock.isPin('1234'), lock.isPin('12345'), lock.isPin('12a4')], [true, false, false]);
ok('  빈 값도 안 터진다', [lock.isPin(''), lock.isPin(null), lock.isPin(1234)], [false, false, false]);

console.log('');
console.log('── 돌아왔을 때 잠그는가 ──');
// 담아둔 잠금이 없으면(=안 걸어둔 사람) **아무것도 안 한다**
ok('안 걸어뒀으면 안 잠근다', lock.shouldLock(null, Date.now()), false);
// 아래는 걸어뒀다고 치고 보는 값이다 — `shouldLock` 은 「비워둔 시간」만 본다.
// 걸었는지는 스토어가 이미 보고 있으므로, 여기서는 그 판단만 따로 뗀다
const NOW = 1_700_000_000_000;
const gone = (ms) => NOW - ms;
const rule = (hiddenAt, graceMs = lock.GRACE_MS) => {
  if (!hiddenAt) return true;
  const away = NOW - hiddenAt;
  if (!Number.isFinite(away)) return true;
  return away > graceMs;
};
ok('앱을 다시 띄웠으면 잠근다 (비워둔 때가 없다)', rule(null), true);
ok('  잠깐 나갔다 온 것은 안 잠근다 (10초)', rule(gone(10_000)), false);
ok('  오래 비워뒀으면 잠근다 (2분)', rule(gone(120_000)), true);
ok('  테두리는 45초다', [rule(gone(44_000)), rule(gone(46_000))], [false, true]);
ok('  이상한 값이 들어와도 잠근다 (안전한 쪽)', rule(NaN), true);

console.log('');
console.log('── 여러 번 틀렸을 때 ──');
ok('다섯 번 전에는 안 쉰다', lock.cooldownLeft(4, NOW - 1000, NOW), 0);
ok('  다섯 번이면 쉰다', lock.cooldownLeft(5, NOW - 1000, NOW), 29000);
ok('  30초가 지나면 다시 칠 수 있다', lock.cooldownLeft(5, NOW - 31_000, NOW), 0);
// **늘려가지 않는다.** 서버 자물쇠라면 늘려야 하지만 여기는 기기 안의 가림막이라,
// 오래 잠가둬 봐야 주인만 곤란해진다 — 마음먹은 사람은 저장소를 지운다
ok('  여러 번 더 틀려도 쉬는 시간은 같다',
  [lock.cooldownLeft(5, NOW, NOW), lock.cooldownLeft(30, NOW, NOW)], [30000, 30000]);

console.log('');
console.log('── 네 자리를 그대로 담지 않는가 ──');
const setup = read('src/data/appLock.js');
// 저장소를 열어보면 보이는 자리다 — 「1234」가 그대로 적혀 있으면 있는 척만 하는 셈이다
ok('해시로 담는다 (SHA-256)', /crypto\.subtle\.digest\('SHA-256'/.test(setup), true);
ok('  기기마다 다른 소금을 섞는다', /getRandomValues/.test(setup) && /\$\{salt\}:\$\{pin\}/.test(setup), true);
ok('  서버로 안 보낸다', /client\.(post|put|get)/.test(setup), false);
// `crypto.subtle` 은 https(와 localhost)에서만 있다. 없는 자리에서 약한 방법으로
// 대신 걸면 **사람은 걸린 줄 알고 폰을 빌려준다**
ok('못 거는 자리에서는 거는 척하지 않는다', /export function canLock/.test(setup), true);
ok('  설정 화면이 그것을 먼저 본다', /canLock\(\)/.test(read('src/components/LockSetup.jsx')), true);

console.log('');
console.log('── 화면이 제 일을 하는가 ──');
const overlay = read('src/components/AppLock.jsx');
const app = read('src/App.jsx');
// 반쯤 가리면 그 틈으로 오늘 한 운동과 몸 사진 미리보기가 보인다
ok('통째로 덮는다', /position: 'fixed', inset: 0/.test(overlay), true);
ok('  껍데기 밖(라우터 밖)에 건다', /<AppLock \/>/.test(app), true);
// **로그인 화면은 안 덮는다.** 덮으면 나갈 길이 막힌다 — 잊었을 때 푸는 길이
// 로그아웃인데, 로그아웃하면 이 화면이 로그인 화면을 덮고 그 위에서는 아무것도 못 한다
ok('  로그인 전에는 안 덮는다', /!loggedIn\) return null;/.test(overlay), true);
ok('  잊어서 로그아웃할 때 잠긴 것을 놓는다', /release\(\);/.test(overlay), true);
// 자판을 직접 그린다 — 폰마다 다른 자판에는 붙여넣기 · 자동완성 · 「완료」가 같이 온다
ok('숫자 자판을 직접 그린다', /const KEYS = \[/.test(overlay), true);
ok('  친 숫자를 그대로 안 보여준다 (점으로)', /borderRadius: '50%'/.test(overlay), true);
// 잊었을 때 길이 없으면 그 기기에서 앱을 영영 못 연다
ok('잊었을 때 나갈 길이 있다 (로그아웃)', /네 자리를 잊으셨나요/.test(overlay), true);
// 「사진 좀 보여줘」는 앱이 열려 있는 채로 폰을 건네는 일이다 — 돌아왔을 때
// 잠그는 것만으로는 정작 그 순간을 못 막는다
ok('지금 잠그는 길이 있다', /지금 잠그기/.test(read('src/components/LockSetup.jsx')), true);
// 걸어뒀는지 눌러봐야 아는 것이 제일 나쁘다
ok('걸어뒀으면 설정 줄에 적는다', /badgeText=\{lockOn \? '켜짐' : null\}/.test(read('src/components/AccountSheet.jsx')), true);
// 듣기만 하고 안 걷으면 화면을 옮길 때마다 하나씩 쌓인다
ok('보던 것을 걷는다', /removeEventListener\('visibilitychange'/.test(overlay), true);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('전부 통과');
