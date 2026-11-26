// ── **CSP 가 집 전체를 믿지 않는다 · 두 응답이 같은 말을 한다** ── (2026-11-26 · 근호 안전 4·8)
//
//   npm run cspnarrow   (backend/ · npm run check 에도 들어 있다)
//
// ④ 여태 `script-src` · `connect-src` 가 **`https://cdn.jsdelivr.net` 통째로**였다.
//    그 집에는 누구나 올린 꾸러미가 수십만 개 있다 — 「jsdelivr 의 아무 스크립트나
//    받아도 된다」와 같았다. `storage.googleapis.com` 도 버킷 전체였다.
// ⑧ helmet 은 적어주지 않은 것에 **제 기본값**을 보탠다. 그래서 API 응답에는
//    `script-src-attr` · `frame-ancestors` · `upgrade-insecure-requests` 가 붙었는데
//    **화면 문서(`index.html`)에는 빠졌다** — 같은 앱의 두 응답이 다른 말을 했다.
//
// 여기서 보는 것:
//
//   1. 어느 지시에도 **집만 적힌 CDN 이 없다** (길까지 적혀 있다)
//   2. **앱이 실제로 받는 주소**가 그 앞자리로 시작한다 (판을 올려 길이 바뀌면 여기서 운다)
//   3. 길은 `/` 로 끝난다 — CSP 의 앞자리 맞추기 규칙이 그렇다
//   4. 화면 문서와 API 응답이 **같은 집합**을 받는다 (셋이 빠지지 않는다)
//   5. 값 없는 지시는 **이름만** 적힌다 (`upgrade-insecure-requests`)
//   6. `spaCSP` 가 그 표를 **다시 적지 않는다** (두 벌이 되면 또 갈린다)
//
// 되돌려-FAIL: `--되돌려` 를 주면 집 전체를 믿던 옛 꼴로 돌린다 → FAIL 이 보여야 한다
'use strict';
const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const SRC = path.join(__dirname, '../src/csp.js');
let srcPath = SRC;
if (process.argv.includes('--되돌려')) {
  // 옛 꼴: 집 전체를 믿고 · helmet 이 주던 셋이 표에 없다
  const src = fs.readFileSync(SRC, 'utf-8')
    .replace(/'https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/'/, "'https://cdn.jsdelivr.net'")
    .replace(/'https:\/\/storage\.googleapis\.com\/mediapipe-models\/'/, "'https://storage.googleapis.com'")
    .replace(/'script-src-attr': \["'none'"\],/, '')
    .replace(/'frame-ancestors': \["'self'"\],/, '')
    .replace(/'upgrade-insecure-requests': \[\],/, '');
  srcPath = path.join(path.dirname(SRC), '.csp.revert.cjs');
  fs.writeFileSync(srcPath, src);
  process.on('exit', () => { try { fs.unlinkSync(srcPath); } catch { /* 이미 없다 */ } });
  console.log('── 되돌려: 집 전체를 믿던 옛 꼴 — 아래에 FAIL 이 있어야 한다 ──');
}

const csp = require(srcPath);
const 머리 = csp.headerValue();
const 표 = csp.DIRECTIVES;

// ── ⑴⑶ 집만 적힌 CDN 이 없다 ──────────────────────────────────────────────
console.log('── ⑴ 집 전체를 믿지 않는다 ──');
const 바깥집 = [];
for (const [k, v] of Object.entries(표)) {
  for (const one of v) {
    if (!/^https?:\/\//.test(one)) continue;
    바깥집.push({ 지시: k, 집: one });
  }
}
ok('바깥 집을 쓰는 자리가 있다 (없으면 이 자가 할 일이 없다)', 바깥집.length > 0, true);
ok('★ 길 없이 집만 적힌 자리가 없다',
  바깥집.filter((x) => /^https?:\/\/[^/]+\/?$/.test(x.집)).map((x) => `${x.지시}: ${x.집}`), []);
ok('  길이 `/` 로 끝난다 (CSP 는 앞자리 맞추기를 그렇게 본다)',
  바깥집.filter((x) => !x.집.endsWith('/')).map((x) => `${x.지시}: ${x.집}`), []);

// ── ⑵ 앱이 받는 주소가 그 앞자리로 시작하나 ───────────────────────────────
console.log('\n── ⑵ 앱이 적어둔 주소와 맞나 ──');
const 앱글 = fs.readFileSync(path.join(__dirname, '../../frontend/src/data/poseModel.js'), 'utf-8');
const 앱주소 = (앱글.match(/https:\/\/[^'"`\s)]+/g) || []);
ok('앱이 밖에 묻는 주소를 찾았다', 앱주소.length > 0, true);
const 허락 = 바깥집.map((x) => x.집);
const 못받는것 = 앱주소.filter((u) => !허락.some((a) => u.startsWith(a)));
ok('★ 앱이 받는 주소가 모두 허락 안에 있다 (판을 올려 길이 바뀌면 여기서 운다)', 못받는것, []);

// ── ⑷⑸ 두 응답이 같은 말을 하나 ───────────────────────────────────────────
console.log('\n── ⑷ 화면 문서와 API 가 같은 말을 한다 ──');
const 꼭있어야 = ['script-src-attr', 'frame-ancestors', 'upgrade-insecure-requests'];
ok('★ helmet 이 끼워주던 셋이 표에 있다 (화면 문서도 같이 받는다)',
  꼭있어야.filter((k) => !(k in 표)), []);
ok('  머리 한 줄에도 셋이 다 있다',
  꼭있어야.filter((k) => !머리.includes(k)), []);
ok('★ 값 없는 지시는 이름만 적힌다',
  /upgrade-insecure-requests(;|$)/.test(머리), true);
ok('  빈칸을 붙여 보내지 않는다', /upgrade-insecure-requests ;/.test(머리), false);

const helmet꼴 = csp.helmetDirectives();
ok('helmet 꼴도 같은 수다 (한쪽만 늘지 않는다)',
  Object.keys(helmet꼴).length, Object.keys(표).length);
ok('  helmet 꼴의 값 없는 지시는 빈 배열이다', Array.isArray(helmet꼴.upgradeInsecureRequests)
  && helmet꼴.upgradeInsecureRequests.length === 0, true);

// ── ⑹ 두 벌로 적지 않았나 ─────────────────────────────────────────────────
console.log('\n── ⑹ 두 벌로 적지 않았다 ──');
const indexSrc = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf-8');
const spa = indexSrc.slice(indexSrc.indexOf('const spaCSP ='), indexSrc.indexOf('const spaCSP =') + 500);
ok('`spaCSP` 는 한 곳에서 받아 적는다', /csp\.headerValue\(\)/.test(spa), true);
ok('  거기에 지시를 또 적어두지 않았다', /default-src|script-src/.test(spa), false);
ok('helmet 도 같은 곳에서 받는다', /contentSecurityPolicy: \{ directives: csp\.helmetDirectives\(\) \}/.test(indexSrc), true);

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
