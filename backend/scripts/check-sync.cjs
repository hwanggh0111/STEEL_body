// 바깥에서 DB 파일을 고쳤을 때 (2026-09-30).
//
//   npm run sync      (npm run check 에도 들어 있다)
//
// 서버는 DB 를 **램에 들고 있고**(`db.js` 의 `_cache`) 파일은 그것을 흘려둔 자취다.
// 그래서 서버가 떠 있는 동안 파일을 직접 고치면, 여태는 **다음 저장 한 번에 조용히
// 되돌아갔다.** `npm run smoke` 가 「검사 계정을 지웠습니다」라고 말하고도 되살아나,
// 나흘에 걸쳐 검사 계정 29개와 **가짜 「손볼 제보」 28건**이 관리자 화면에 쌓였다.
//
// 이 검사가 지키는 것 넷 —
//
//   1. 안 쓴 것이 없으면 **파일 쪽을 읽어 맞춘다**
//   2. 맞출 때 **파생 색인도 같이 버린다** (안 버려서 지운 계정으로 로그인이 됐다)
//   3. 안 쓴 것이 있으면 **램이 이긴다** (합칠 수가 없다 — 그때는 말하고 덮는다)
//   4. **우리가 쓴 것**은 「바깥에서 바뀐 것」으로 보지 않는다
//
// 눈으로 볼 수 없는 자리다 — 서버를 띄운 채 파일을 고쳐야 한 번 보인다.
const path = require('path');
const fs = require('fs');

const TMP = path.join(__dirname, '..', '.sync-check.json');
process.env.DB_FILE = TMP;
process.env.JWT_SECRET = 'x'.repeat(40);
if (fs.existsSync(TMP)) fs.unlinkSync(TMP);

const db = require('../src/db');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const readFile = () => JSON.parse(fs.readFileSync(TMP, 'utf-8'));
const writeFile = (data) => fs.writeFileSync(TMP, JSON.stringify(data, null, 2));

// 파일 시각(mtime)이 1초 단위로만 갈리는 파일 시스템도 있어서 **눈에 보이게 벌린다.**
// 그리고 `db.js` 는 stat 을 1초에 한 번으로 묶으므로(STAT_EVERY_MS) 그만큼은 어차피 쉰다
const APART = 1100;

(async () => {
  // ── 1. 안 쓴 것이 없으면 파일 쪽을 읽어 맞춘다 ──
  console.log('── 바깥에서 고친 것을 받아들이는가 ──');
  const A = db.createUser('a@t.local', 'x', '가', 'aaaa').lastInsertRowid;
  db.createUser('b@t.local', 'x', '나', 'bbbb');
  db.createWorkout(A, '2026-09-30', '벤치프레스', '80', 5, 8);
  await wait(900);                     // 500ms 뒤에 파일로 흘린다 — 다 쓰길 기다린다

  ok('두 사람이 파일에 있다', readFile().users.length, 2);

  // 바깥에서 한 사람을 지운다 (`smoke.cjs` 가 하는 일이 이것이다)
  const cut = readFile();
  cut.users = cut.users.filter(u => u.email !== 'b@t.local');
  await wait(APART);
  writeFile(cut);

  db.syncIfChangedOutside();
  ok('바깥에서 지운 사람은 사라진다', db.findUserByEmail('b@t.local'), null);
  // ── 2. 파생 색인도 같이 버렸는가 ──
  //
  // 판만 갈아끼우고 색인을 안 버리면 `_index.userByEmail` 이 옛것을 가리켜,
  // **지운 계정으로 로그인이 되는** 자리가 남는다 (9/30 에 실제로 그랬다)
  ok('  남은 사람은 그대로 찾힌다', db.findUserByEmail('a@t.local')?.email, 'a@t.local');
  ok('  줄 색인도 옛것을 안 준다', db.getWorkouts(A).length, 1);

  // ── 3. 안 쓴 것이 있으면 램이 이긴다 ──
  //
  // 합칠 방법이 없다 — 바깥의 고침을 받으면 **방금 저장한 것을 버리게 된다.**
  // 그쪽이 더 크므로 램을 쓰고, 대신 덮는다고 말한다
  console.log('\n── 안 쓴 것이 있을 때 ──');
  await wait(APART);
  db.createWorkout(A, '2026-09-30', '스쿼트', '100', 5, 5);   // 아직 파일로 안 갔다
  const sneak = readFile();
  sneak.users = [];                                          // 바깥에서 전부 지운다
  writeFile(sneak);
  db.syncIfChangedOutside();
  ok('안 쓴 것이 있으면 램이 이긴다', db.findUserByEmail('a@t.local')?.email, 'a@t.local');
  ok('  방금 저장한 것도 안 잃는다', db.getWorkouts(A).length, 2);

  await wait(900);                     // 램이 파일로 흘러 나간다
  ok('  파일도 램 쪽으로 돌아온다', readFile().users.length, 1);

  // ── 4. 우리가 쓴 것은 「바깥에서 바뀐 것」이 아니다 ──
  //
  // 이것을 못 가르면 저장할 때마다 자기가 쓴 것을 다시 읽어들이게 된다
  console.log('\n── 우리가 쓴 것과 남이 쓴 것 ──');
  await wait(APART);
  db.createWorkout(A, '2026-09-30', '데드리프트', '120', 3, 5);
  await wait(900);
  db.syncIfChangedOutside();
  ok('우리가 쓴 뒤에는 다시 안 읽는다', db.getWorkouts(A).length, 3);

  // ── 5. 깨진 파일은 램을 망치지 않는다 ──
  console.log('\n── 파일이 깨져 있으면 ──');
  await wait(APART);
  fs.writeFileSync(TMP, '{ 이건 JSON 이 아니다');
  db.syncIfChangedOutside();
  ok('깨진 파일을 읽어 램을 망치지 않는다', db.findUserByEmail('a@t.local')?.email, 'a@t.local');
  // **1초 묶음으로 통과하면 안 된다** — 묶음을 지나 보내고 나서 센다
  await wait(APART);
  let said = 0;
  const realErr = console.error;
  console.error = () => { said += 1; };
  db.syncIfChangedOutside();
  console.error = realErr;
  ok('  같은 말을 되풀이하지 않는다 (한 번만 말한다)', said, 0);

  try { fs.unlinkSync(TMP); } catch { /* 이미 없으면 됐다 */ }
  try { fs.unlinkSync(TMP + '.writing'); } catch { /* 남았으면 치운다 */ }
  console.log(bad ? `\n${bad}건 실패` : '\n전부 통과');
  process.exit(bad ? 1 : 0);
})();
