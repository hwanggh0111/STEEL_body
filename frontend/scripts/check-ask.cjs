// **묻는 창** — Enter 가 지우지 않는가 (2026-11-04).
//
//   npm run ask     (npm run check 에도 들어 있다)
//
// ── 무엇을 보는가 ──
//
// `ConfirmModal` 은 「정말 지울까요」를 묻는 **그 창 하나**다. 운동 기록 · 메모 ·
// 인바디 · 루틴 · 사진 · 계정까지 지우는 길이 다 이 창을 지나간다. 11/03 위험 지도의
// **「고친 적도 없고 자도 없는 13개」**에 들어 있던 자리고, **사람이 기록을 잃는
// 자리**라 그 목록에서 둘째로 적어뒀다.
//
// 그런데 **키를 보는 자리가 포커스를 안 봤다** — 위험한 물음이면 「취소」에 포커스를
// 주면서(「실수 방지」라고 적어뒀다) Enter 는 그냥 `close(true)` 였다.
// **Enter 한 번에 지워진다.** 가리려고 둔 포커스가 아무 일도 안 하고 있었다.
//
// ── 어떻게 보는가 ──
//
// 화면으로는 보기 어렵다 — 폰에는 키보드가 없고, PC 로 열어 눌러봐야 한 번에 하나다.
// 그래서 `data/appLock.js` 와 같은 자리를 만들었다: **판단만 떼어** `data/askKeys.js`
// 에 두고 여기서 값으로 본다. 창이 그 판단을 **실제로 부르는지**는 코드를 읽어 본다.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node', logLevel: 'silent' });
  const m = require(path.resolve(out));
  fs.unlinkSync(out);
  return m;
};

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (f) => codeOf(fs.readFileSync(f, 'utf-8'));

const keys = bundle('src/data/askKeys.js', '.ask.cjs');

console.log('── Enter 를 눌렀다 ──');
// **여기가 오늘의 버그다.** 포커스가 어디에도 없을 때 위험한 물음이면 취소여야 한다
ok('위험한 물음이면 승인하지 않는다', keys.enterChoice(null, true), 'cancel');
ok('  위험하지 않으면 승인한다 (「알겠습니다」)', keys.enterChoice(null, false), 'confirm');
// 포커스가 우리 단추에 있으면 **브라우저가 그 단추를 누른다** — 우리가 또 닫으면 두 번이다
ok('취소에 포커스가 있으면 비킨다', keys.enterChoice('cancel', true), 'browser');
ok('  확인에 포커스가 있어도 비킨다', keys.enterChoice('confirm', false), 'browser');
// 위험한데 사람이 Tab 으로 확인까지 가서 눌렀으면 그것은 **고른 것**이다. 막지 않는다
ok('  위험한데 확인을 골라 눌렀으면 그대로 간다', keys.enterChoice('confirm', true), 'browser');
ok('이상한 값이 와도 안전한 쪽이다', [keys.enterChoice(undefined, true), keys.enterChoice('x', true)], ['cancel', 'cancel']);

console.log('');
console.log('── 포커스가 어디인가 ──');
const A = { a: 1 }; const B = { b: 2 }; const C = { c: 3 };
ok('확인 단추', keys.focusKind(A, A, B), 'confirm');
ok('  취소 단추', keys.focusKind(B, A, B), 'cancel');
ok('  그 밖', keys.focusKind(C, A, B), null);
// 창이 막 떠서 포커스를 못 줬을 때 — 셋이 다 null 이면 「같다」로 읽혀선 안 된다
ok('아무것도 없을 때 (단추가 아직 없다)', keys.focusKind(null, null, null), null);
ok('  포커스가 없고 단추는 있다', keys.focusKind(null, A, B), null);

console.log('');
console.log('── 창이 그 판단을 쓰는가 ──');
const modal = read('src/components/ConfirmModal.jsx');
ok('Enter 를 포커스로 가른다', /enterChoice\(/.test(modal) && /focusKind\(/.test(modal), true);
// 되돌아가면 이것이 다시 뜬다 — 그 한 줄이 기록을 지우는 자리다
ok('  **Enter 로 그냥 승인하지 않는다**', /'Enter'\)\s*close\(true\)/.test(modal.replace(/\s+/g, ' ').replace(/ \)/g, ')')), false);
ok('Escape 는 취소다', /'Escape'\)\s*close\(false\)/.test(modal.replace(/\s+/g, ' ')), true);
ok('위험한 물음은 취소에 포커스를 준다', /danger \? cancelBtnRef\.current : confirmBtnRef\.current/.test(modal), true);
// 적어두지 않으면 `danger: false` 를 빠뜨린 물음이 조용히 안전한 쪽으로 샌다
ok('  아무 말 없으면 위험한 것으로 친다', /options\.danger !== false/.test(modal), true);

console.log('');
console.log('── 한 번 누른 것이 두 번 닫지 않는가 ──');
// 두 번 닫히면 줄에서 하나를 더 꺼내고, 꺼내진 물음은 영영 안 풀린다
ok('닫은 것을 또 닫지 않는다', /state\.done/.test(modal), true);
ok('  줄을 세운다 (앞의 물음을 덮지 않는다)', /_pendingQueue\.push\(next\)/.test(modal), true);
ok('  닫을 때 줄에서 하나를 꺼낸다', /setState\(_pendingQueue\.shift\(\)\)/.test(modal), true);

// 줄 세우기와 두 번 닫기를 **값으로** 본다 — 창 없이 그 셈만 떼어 돌린다
console.log('');
console.log('── 줄 세우기 셈 ──');
{
  const queue = [];
  let shown = null;
  const show = (next) => { if (shown) { queue.push(next); return; } shown = next; };
  // **닫는 자는 「지금 뜬 그 물음」을 붙들고 있다** — 창의 `close` 가 `useCallback`
  // 으로 그때의 `state` 를 쥐고 있는 모양 그대로다. 한 번 누를 때 들어온 두 번은
  // **같은 물음**을 가리키므로 `done` 이 둘째를 막는다. 붙들지 않으면 둘째가
  // **다음 물음**을 닫아 버린다 (자를 처음 적었을 때 내가 그렇게 적어 터졌다)
  const closer = (item) => (result) => {
    if (!item || item.done) return;
    item.done = true;
    item.resolve(result);
    shown = queue.length > 0 ? queue.shift() : null;
  };
  const answers = [];
  const ask = (name) => { const item = { name, resolve: (v) => answers.push(name + ':' + v) }; show(item); return item; };
  const a1 = ask('지우기'); const a2 = ask('가져오기'); const a3 = ask('계정');
  ok('한 번에 하나만 뜬다', shown.name, '지우기');
  closer(a1)(false);
  ok('  닫으면 다음 것이 뜬다', shown.name, '가져오기');
  // **한 번 누른 것이 두 번 들어온다** (브라우저가 단추를 누르고 + 창이 또 닫고)
  const c2 = closer(a2);
  c2(true); c2(true);
  ok('  두 번 닫아도 하나만 넘어간다', shown.name, '계정');
  closer(a3)(false);
  ok('기다리던 것이 다 풀린다', answers, ['지우기:false', '가져오기:true', '계정:false']);
  ok('  남은 줄이 없다', [queue.length, shown], [0, null]);
  ok('  한 물음에 답은 한 번뿐이다', answers.filter((x) => x.startsWith('가져오기')).length, 1);
}

console.log('');
console.log('── 파일을 가져오기 ──');
const imp = read('src/components/ImportCsv.jsx');
// 못 읽으면 함수가 그 자리에서 터지고 **화면은 아무 말도 안 했다**
ok('못 읽으면 말해준다', /catch\s*\{\s*toast\(/.test(imp.replace(/\s+/g, ' ')), true);
ok('  읽기를 감싼다', /try \{ csv = await file\.text\(\); \}/.test(imp.replace(/\s+/g, ' ')), true);
// 묻기 전에 읽는다 — 몇 줄인지 알고 물어야 한다
ok('묻기 전에 줄 수를 센다',
  imp.indexOf('rows = rowsIn(csv)') < imp.indexOf('await confirmDialog('), true);
// 가져오기는 **위험하지 않다**고 적어둔 물음이다(넣는 것은 지우는 것이 아니다).
// 그래야 Enter 가 「넣습니다」로 간다 — 위 `enterChoice(null, false)` 가 그 값이다
ok('가져오기 물음은 위험 표시가 아니다', /danger: false/.test(imp), true);
// 줄 수를 **올리기 전에** 본다 (올린 뒤에 거절당하면 기다린 시간이 버려진다)
ok('줄 수를 올리기 전에 본다', imp.indexOf('rows > MAX_ROWS') < imp.indexOf("client.post('/import'"), true);
// 서버와 같은 수를 본다 — 한쪽만 고치면 화면이 통과시킨 파일이 서버에서 걸린다
const limits = read('src/data/limits.js');
const srv = fs.readFileSync('../backend/src/routes/importData.js', 'utf-8');
const nOf = (s, re) => (s.match(re) || [])[1];
ok('줄 수 자가 서버와 같다',
  nOf(limits, /MAX_ROWS = (\d+)/), nOf(srv, /MAX_ROWS = (\d+)/));

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
