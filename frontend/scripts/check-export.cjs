// **내 기록을 받는 길이 전부 화면에 닿아 있는가** (2026-11-17)
//
//   npm run export
//   node scripts/check-export.cjs --되돌려     일부러 어긋낸 꼴 아홉을 먹여 본다
//
// ── 왜 이 자가 생겼나 ──
//
// 11/17 에 「내보내기 화면이 없다」고 **두 번 틀리게 읽었다.** `client.js` 에
// `/export` 가 없는 것을 보고 「아무도 안 부른다」고 했는데, 세 화면이 `axios` 가
// 아니라 **`fetch` 로 직접** 부르고 있었다. 이름도 「내려받기」가 아니라
// 「CSV 로 내보내기」·`exportMeasures` 여서 글자로 찾을 때 또 놓쳤다.
//
// 그 과정에서 **진짜 어긋난 것 둘**이 나왔다 —
//
//   1. **파일 이름이 서버와 화면에서 갈려 있었다.** 서버는
//      `Content-Disposition` 으로 `steelbody_*.csv` 를 주는데 화면은
//      `a.download = 'blackiron_*.csv'` 를 적었고, **`a.download` 가 헤더를 이긴다.**
//      셋 다 그랬다 — 서버가 정한 이름은 **죽은 글자**였다
//   2. **같은 손이 두 벌**이었다(`HistoryPage` · `MeasurePage` — fetch · blob ·
//      `a.click` · revoke 지연까지 글자 그대로). 복붙한 손은 갈리고, 위 1 이 그 결과다
//
// ── 무엇을 보는가 ──
//
//   ⑴ **길 목록을 서버에서 읽는다** — 여기 베껴 적으면 길이 하나 늘 때 **자만 옛
//      목록을 본다**(11/13 `a42b1b6` 류). `export.js` 의 `router.get('/x'` 를 긁는다.
//      관리자 전용(`adminAuth`)은 뺀다 — 그것은 사람이 받는 길이 아니다
//   ⑵ 그 길이 **전부 화면에서 불리는가** — 하나라도 안 불리면 지어두고 안 쓰는 길이다
//   ⑶ 화면이 **파일 이름을 적지 않는가** — 이름은 서버 한 자리에만 있어야 한다
//   ⑷ 받는 손이 **한 벌인가** — `fetch(.../export/` 가 공용 손 밖에 또 있으면 복붙이다
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRV = path.join(ROOT, '..', 'backend', 'src', 'routes', 'export.js');
let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 화면 글자를 한 자리에 모은다 — 주석은 안 센다(이 집은 까닭을 길게 적고,
// 그 주석에 **옛 꼴을 그대로 적어둔다**. 줄 단위로 걷는다)
const 코드만 = (p) => fs.readFileSync(p, 'utf8').split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

const 손파일 = path.join(ROOT, 'src', 'data', 'exportCsv.js');
const 화면들 = [];
(function 걷기(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { 걷기(p); continue; }
    if (!/\.(jsx?|js)$/.test(e.name)) continue;
    if (p === 손파일) continue;              // 공용 손은 화면이 아니다
    화면들.push(p);
  }
})(path.join(ROOT, 'src'));
const 화면글 = 화면들.map((p) => 코드만(p)).join('\n');

// ── 식은 한 자리에 둔다 — 되돌려-FAIL 이 **같은 것**을 부른다 ──
// **세 식을 첫 판에서 바로 고쳤다** (2026-11-17 · 정석) — 셋 다 **거짓으로 울었다.**
// 세우자마자 FAIL 3 이 떴고, 전부 자 탓이었다. 그 자리를 그대로 적어둔다:
//
//   ⑴ `workouts`·`inbody` 를 「안 불린다」고 했다 — `HistoryPage` 는
//      `exportCsv(type, 뒷이름)` 으로 **변수**를 넘긴다. 리터럴만 보는 식이었다.
//      뜻은 「그 길이 화면에 쓰인다」지 「리터럴로 적혀 있다」가 아니다
//   ⑵ `ComparePage` 의 `blackiron_전후.jpg` 를 집었다 — 그것은 **사진**이고
//      서버가 주는 것이 아니라 화면이 그린 것이다. **이름을 적는 것이 맞는 자리**다.
//      서버가 `Content-Disposition` 을 주는 길에만 걸어야 한다
//   ⑶ `BackupAdmin` 의 `/export/backup` 을 복붙으로 셌다 — `adminAuth` 길이라
//      위에서 **일부러 뺀** 것이다. 길 목록에서 뺐으면 여기서도 빼야 맞다
//
// 셋 다 「자가 지금을 베끼면 거짓이 된다」류다 — 내가 그 선을 적어두고 같은 날 또
// 밟았다. 그래서 **사람 길만** 보고, **그 길을 받는 파일 안에서만** 이름을 본다.
const 식 = {
  길목록: (srv) => [...srv.matchAll(/router\.get\(\s*'\/([a-z]+)'\s*,\s*([A-Za-z]+)/g)]
    .filter((m) => m[2] !== 'adminAuth').map((m) => m[1]),
  // 그 길 이름이 코드에 쓰이거나 주소가 적혀 있으면 닿은 것이다 (주석은 이미 걷었다)
  안불리는길: (글, 길들) => 길들.filter((t) => !(new RegExp("'" + t + "'").test(글)
    || new RegExp("/export/" + t).test(글))),
  // **사람 길을 받는 자리**에서만 이름을 본다 — 화면이 그린 사진은 제 이름을 가져도 된다
  이름을적은자리: (글, 길들) => {
    if (!길들.length) return [];
    const 사람길 = new RegExp('/export/(' + 길들.join('|') + ')');
    return 글.split('\n').filter((l) => 사람길.test(l) || /\.download\s*=/.test(l))
      .join('\n').split('\n')
      .flatMap((l) => (사람길.test(l) ? [...l.matchAll(/\.download\s*=\s*['"]([^'"]+)['"]/g)].map((m) => m[1]) : []));
  },
  // 사람 길만 본다. 관리자 길(`/export/backup`)은 위에서 뺀 것과 같은 선이다
  손이또있나: (글, 길들) => (길들.length
    ? new RegExp('fetch\\(\\s*`?[^`\'"]*\\/export\\/(' + 길들.join('|') + ')').test(글)
    : false),
};

console.log('── 1. 서버가 낸 길을 읽는다 ──');
let srv = '';
try { srv = fs.readFileSync(SRV, 'utf8'); } catch { /* 아래 ok 가 잡는다 */ }
const 길들 = 식.길목록(srv);
ok('`export.js` 에서 길 목록을 읽었다', 길들.length > 0, true);
if (길들.length) console.log('       ' + 길들.join(' ') + '  (관리자 전용은 뺐다)');

console.log('');
console.log('── 2. 그 길이 전부 화면에 닿아 있는가 ──');
ok('지어두고 안 부르는 길이 없다', 식.안불리는길(화면글, 길들), []);

console.log('');
console.log('── 3. 파일 이름은 서버 한 자리에만 ──');
// `a.download` 에 **글자로 적힌** 이름이 화면에 있으면 서버 헤더를 이긴다.
// 공용 손은 `a.download = name`(변수)이라 여기 안 걸린다
ok('화면이 파일 이름을 적지 않는다', 식.이름을적은자리(화면글, 길들), []);

console.log('');
console.log('── 4. 받는 손은 한 벌인가 ──');
ok('공용 손 밖에서 사람 길을 직접 받지 않는다', 식.손이또있나(화면글, 길들), false);

if (process.argv.includes('--되돌려')) {
  console.log('');
  console.log('── 되돌려-FAIL: 일부러 어긋낸 꼴을 먹인다 ──');
  let 샌것 = 0;
  const 꼴 = [
    ['서버 파일을 못 읽으면', () => 식.길목록(''), []],
    ['길이 하나 늘었는데 화면이 안 부르면', () => 식.안불리는길(
      "exportCsv('workouts');exportCsv('inbody');exportCsv('measures')",
      ['workouts', 'inbody', 'measures', 'cardio']), ['cardio']],
    ['관리자 전용 길을 사람 길로 세면', () => 식.길목록(
      "router.get('/backup', adminAuth, (req"), []],
    ['화면이 이름을 글자로 적으면', () => 식.이름을적은자리(
      "fetch(`${b}/export/measures`);a.download = 'blackiron_measures.csv';",
      ['workouts', 'inbody', 'measures']), ['blackiron_measures.csv']],
    ['공용 손을 또 복붙하면', () => 식.손이또있나(
      'fetch(`${baseURL}/export/measures`, {', ['workouts', 'inbody', 'measures']), true],
    // 변수로 넣은 것은 **어긋난 것이 아니다** — 공용 손이 그렇게 쓴다
    ['이름을 변수로 넣은 것은 안 집는다', () => 식.이름을적은자리(
      'fetch(`${b}/export/measures`);a.download = name;',
      ['workouts', 'inbody', 'measures']), []],
    // ★ 첫 판에서 **거짓으로 울었던 자리 둘**을 자에 박아둔다 — 다시 좁아지면 여기서 잡힌다
    ['화면이 그린 사진 이름은 안 집는다', () => 식.이름을적은자리(
      "a.download = 'blackiron_전후.jpg';", ['workouts', 'inbody', 'measures']), []],
    ['관리자 길을 복붙으로 세지 않는다', () => 식.손이또있나(
      'fetch(`${baseURL}/export/backup`, {', ['workouts', 'inbody', 'measures']), false],
    ['변수로 넘기는 호출도 닿은 것으로 센다', () => 식.안불리는길(
      "const t='workouts';exportCsv(t);exportCsv('inbody');exportCsv('measures')",
      ['workouts', 'inbody', 'measures']), []],
  ];
  for (const [이름, 부르기, 어긋난값] of 꼴) {
    const 받은것 = 부르기();
    const 집었다 = JSON.stringify(받은것) === JSON.stringify(어긋난값);
    if (!집었다) 샌것 += 1;
    console.log((집었다 ? 'OK   잡는다: ' : 'FAIL 샌다  : ') + 이름
      + ' → ' + JSON.stringify(받은것)
      + (집었다 ? '' : ' (기대: ' + JSON.stringify(어긋난값) + ')'));
  }
  bad += 샌것;
  console.log(샌것 ? '  ↑ **어긋난 꼴을 자가 못 집었다.** 식이 느슨하다'
    : '  어긋낸 꼴 ' + 꼴.length + '개를 다 집었다');
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
