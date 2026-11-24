// **개발 서버 감시 범위를 지키는 자가 없었다** (2026-11-24 · 정석)
//
//   npm run watchscope     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 11/24 에 개발 서버를 재 보니 「ready in 400ms」 뒤로 **5.5초 동안 끊어 가며 멈췄다.**
// 그 창에 브라우저가 들어오면 첫 요청 하나가 1.7초를 먹는다. 까닭은 감시 범위였다 —
// `frontend/android` 가 94MB · 3,421장이고 그중 **3,323장이 그래들 빌드 산출물**인데,
// 화면에 한 장도 안 쓰이면서 감시자가 전부 붙들고 있었다. 한 줄
// (`server.watch.ignored`)을 넣자 **첫 그림이 2,728ms → 195ms** 가 됐다.
//
// 그런데 그 한 줄을 지키는 것이 아무것도 없다. `android/` 는 `npm run android` 가
// 다시 지으면 장수가 또 늘고, 아이폰을 붙이는 날 `ios/` 가 같은 꼴로 생긴다.
// **주석은 썩고 메모도 썩는다 — 지키는 것은 자다.**
//
// ── 무엇을 보는가 ──
//
//   ⑴ 설정을 **들여와서** 읽는다 (글자로 찾지 않는다 — 주석에 적힌 꼴에 안 속는다)
//   ⑵ 큰 폴더가 다 덮였나 — 파일 500장 넘고 **화면이 가리키지 않는** 폴더는
//      감시에서 빠져 있어야 한다. 장수는 **그때그때 센다**
//   ⑶ 적어둔 줄이 **있는 폴더**를 가리키나 — 사라진 폴더를 가리키는 줄은 알리바이다
//      (11/20 에 「안 넘친다」고 빼준 자리가 실제로 넘쳤다. 빼주는 줄은 늘 거짓이 된다)
//   ⑷ 화면이 쓰는 자리를 빼지 않았나 — 그건 더 나쁜 결함이다. 고쳐도 안 바뀐다
//
// ★ 비테는 제 기본값(`node_modules` · `.git` · `test-results` · 캐시)에 우리 줄을
// **더한다**(덮지 않는다 · `resolveChokidarOptions` 확인). 그리고 `emptyOutDir` 이
// 참이면 `dist` 도 비테가 스스로 뺀다 — 그래서 `dist` 는 **일부러 안 적었다.**
// 재 보니 넣어도 차이가 없었다. **장식인 줄은 안 둔다.**
//
//   node scripts/check-watch.cjs --되돌려     일부러 어긋낸 설정 넷을 먹여 빨개지는지 본다

const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.join(__dirname, '..');
const 설정 = path.join(ROOT, 'vite.config.js');

// 비테가 스스로 비켜 두는 자리 — 우리가 또 적을 까닭이 없다
const 비테가빼는것 = ['node_modules', '.git', 'test-results', 'dist'];
// 화면이 그 폴더를 가리키는지 볼 자리
const 화면자리 = ['src', 'dev', 'public', 'index.html'];
const 큰폴더선 = 500;

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

/** 폴더 안 파일을 센다. 선을 넘으면 그만 센다 — 3천 장을 다 셀 까닭이 없다 */
function 장수(dir, 멈춤) {
  let n = 0;
  const 걷기 = (d) => {
    if (n > 멈춤) return;
    let 목록;
    try { 목록 = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of 목록) {
      if (n > 멈춤) return;
      if (e.name === 'node_modules' || e.name === '.git') continue;
      if (e.isDirectory()) 걷기(path.join(d, e.name));
      else n += 1;
    }
  };
  걷기(dir);
  return n;
}

/** 화면 쪽 글에서 그 폴더 이름을 가리키는 줄이 있나 — 있으면 감시에서 빼면 안 된다 */
function 화면이가리키나(이름) {
  const 찾기 = (p) => {
    let st;
    try { st = fs.statSync(p); } catch { return false; }
    if (st.isFile()) {
      if (!/\.(jsx?|mjs|cjs|css|html|json)$/.test(p)) return false;
      try { return fs.readFileSync(p, 'utf8').includes('/' + 이름 + '/'); } catch { return false; }
    }
    let 목록;
    try { 목록 = fs.readdirSync(p, { withFileTypes: true }); } catch { return false; }
    for (const e of 목록) {
      if (e.name === 'node_modules') continue;
      if (찾기(path.join(p, e.name))) return true;
    }
    return false;
  };
  return 화면자리.some((a) => 찾기(path.join(ROOT, a)));
}

/** `**​/android/**` 꼴이 그 폴더를 가리키나 — 식 대신 글자 자리로 본다 */
const 가리키나 = (꼴, 이름) => 꼴.includes('/' + 이름 + '/') || 꼴 === 이름;

/**
 * 식을 한 자리에 둔다 — 본 검사와 되돌려-FAIL 이 같은 손을 부른다.
 * 되돌려가 제 안에 식을 또 적으면, 식을 넓히는 날 되돌려만 옛 식을 본다
 */
function 재기(ignored) {
  const 줄들 = Array.isArray(ignored) ? ignored : (ignored ? [ignored] : []);
  const 어긋남 = [];

  // 뿌리의 폴더를 **그때그때** 훑는다. 이름을 박아두지 않는다 —
  // `ios/` 가 생기는 날에도 이 자가 그것을 집어야 한다
  let 뿌리목록 = [];
  try { 뿌리목록 = fs.readdirSync(ROOT, { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { /* */ }

  for (const e of 뿌리목록) {
    if (비테가빼는것.includes(e.name)) continue;
    const n = 장수(path.join(ROOT, e.name), 큰폴더선);
    if (n <= 큰폴더선) continue;
    if (화면이가리키나(e.name)) continue;   // 화면이 쓰는 자리는 감시에 둬야 한다
    if (!줄들.some((꼴) => 가리키나(꼴, e.name))) {
      // 센 수를 그대로 적지 않는다 — 선에서 세기를 멈추므로 그 수는 **진짜가 아니다**
      어긋남.push('`' + e.name + '` 이 ' + 큰폴더선 + '장 넘는데 감시에 남아 있다');
    }
  }

  for (const 꼴 of 줄들) {
    // ⑶ 가리키는 폴더가 있나
    const 이름 = 꼴.split('/').filter((x) => x && x !== '**')[0];
    if (!이름) { 어긋남.push('무엇을 가리키는지 알 수 없는 줄: ' + 꼴); continue; }
    if (!fs.existsSync(path.join(ROOT, 이름))) {
      어긋남.push('`' + 꼴 + '` 이 가리키는 폴더가 없다 (죽은 줄이 알리바이가 된다)');
      continue;
    }
    // ⑷ 화면이 쓰는 자리를 뺐나
    if (화면자리.includes(이름) || 화면이가리키나(이름)) {
      어긋남.push('화면이 쓰는 `' + 이름 + '` 을 감시에서 뺐다 (고쳐도 안 바뀐다)');
    }
  }

  return 어긋남;
}

/** 설정 파일을 들여와 `server.watch.ignored` 를 받아 온다 */
async function 설정에서읽기(파일) {
  const m = await import(url.pathToFileURL(파일).href + '?t=' + Date.now());
  const cfg = typeof m.default === 'function' ? await m.default({ command: 'serve', mode: 'development' }) : m.default;
  return cfg?.server?.watch?.ignored;
}

async function 본검사() {
  console.log('── 개발 서버가 안 쓰는 자리를 감시하고 있나 ──');
  ok('설정 파일을 찾았다', fs.existsSync(설정), true);
  const ignored = await 설정에서읽기(설정);
  // 0건은 통과가 아니다 — 줄이 아예 없으면 이 자가 장식이 된다
  ok('감시에서 빼는 줄이 있다', Array.isArray(ignored) && ignored.length > 0, true);
  console.log('     빼는 줄 ' + JSON.stringify(ignored || []));
  ok('안 쓰는 큰 자리가 다 빠졌다 · 화면이 쓰는 자리는 남았다', 재기(ignored), []);
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
}

async function 되돌려() {
  console.log('── 되돌려-FAIL: 일부러 어긋낸 설정을 **진짜 파일로** 먹인다 ──');
  // ★ 자 안의 꼴이 아니라 실제 파일로 돌린다. 11/20 에 자 안에서만 되돌려 보고
  //    통과시켰다가, 실제 파일에서는 안 우는 자리를 하나 놓쳤다
  const 원본 = fs.readFileSync(설정, 'utf8');
  const 꼴 = [
    ['줄을 통째로 지우면 운다', "watch: { ignored: ['**/android/**'] },", '', 'android`'],
    ['화면이 쓰는 자리를 빼면 운다', "ignored: ['**/android/**']", "ignored: ['**/src/**']", '화면이 쓰는'],
    ['없는 폴더를 가리키면 운다', "ignored: ['**/android/**']", "ignored: ['**/android/**', '**/ios/**']", '폴더가 없다'],
    ['지금 설정은 조용하다', null, null, null],
  ];
  for (const [이름, 찾을것, 바꿀것, 기대말] of 꼴) {
    let 글 = 원본;
    if (찾을것 !== null) {
      if (!원본.includes(찾을것)) { ok(이름 + ' (★먹일 자리를 못 찾았다)', false, true); continue; }
      글 = 원본.split(찾을것).join(바꿀것);
    }
    const 임시 = path.join(ROOT, 'vite.config.되돌려.js');
    fs.writeFileSync(임시, 글);
    let 난것;
    try { 난것 = 재기(await 설정에서읽기(임시)); } catch (e) { 난것 = ['들여오다 터졌다: ' + e.message]; }
    try { fs.unlinkSync(임시); } catch { /* */ }
    if (기대말 === null) ok(이름, 난것, []);
    else {
      // 「아무거나 울면 통과」로 적지 않는다 — 다른 줄이 울어 거짓 통과가 난다
      ok(이름, 난것.some((x) => x.includes(기대말)), true);
      if (난것.length) console.log('       ' + 난것.join(' · '));
    }
  }
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
}

(process.argv.includes('--되돌려') ? 되돌려() : 본검사()).catch((e) => {
  console.log('FAIL 자가 터졌다 → ' + e.message);
  process.exit(1);
});
