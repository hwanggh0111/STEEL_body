// **검사가 쓰고 간 임시 DB 가 남아 있지 않은가** (2026-10-28).
//
//   npm run tidy      (npm run check 의 **맨 끝**에 들어 있다)
//
// ── 왜 ──
//
// `backend/scripts/.check-fresh.photos.json` 이 **열흘 가까이 늘 바뀐 채로**
// git status 에 떠 있었다. 치우는 쪽은 멀쩡했다 — 끝에서 `unlinkSync` 로 둘을
// 지운다. 다시 만든 것은 **나가는 쪽**이었다: `db.js` 의 `process.on('exit')` 가
// `_flushPhotosSync()` 를 돌려서, 지운 파일을 `process.exit()` 뒤에 되살렸다.
// 본체는 `db.flushNow()` 를 불러 「안 쓴 것 없음」이 되어 안 되살아났고,
// **사진만 안 쓴 채로 남아 있었다.**
//
// 값이 작아 보이지만 둘을 끌고 온다 —
//   1. 날시각이 든 파일이 늘 바뀌어 **훅 나눠 커밋하는 자리가 매번 어긋난다**
//   2. 한 번 올라간 뒤에는 gitignore 로는 안 막힌다 (이미 들고 있는 파일)
//
// ── 여기가 지키는 것 ──
//
// **글자를 보지 않는다.** 이 검사는 `npm run check` 맨 끝에서 **그 앞의 검사
// 서른셋이 돌고 난 작업 트리를 본다** — 누가 무엇을 지웠다고 적어두었는지와
// 상관없이, 남아 있으면 남아 있는 것이다.
//   1. 임시 DB 모양의 파일이 작업 트리에 **있으면** FAIL (그 앞 검사가 안 치웠다)
//   2. 그 모양이 **git 에 올라가 있으면** FAIL (gitignore 가 못 막는 자리)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const ROOT = path.join(__dirname, '..', '..');

// 검사·재는 자리가 쓰는 임시 DB 의 이름 꼴. 사진 짝(`.photos.json`)까지 같이 걸린다.
// **이름 꼴이 두 가지다** — `.check-나.json` 과 `.나-check.json`(일곱). 좁게 보면
// 그 절반이 안 보인다 (gitignore 도 같은 자리에서 반만 막고 있었다)
const TEMP = /^\.[\w.-]*(check|bench|probe|boot)[\w.-]*\.json$/;

// 사람의 자료는 여기서 보지 않는다 — `blackiron.json` · `photos.json` 은 **살아 있는
// 파일**이고 gitignore 가 막는다. 여기서 보는 것은 **점으로 시작하는 임시 것**뿐이다
const DIRS = ['', 'backend', 'backend/scripts', 'frontend', 'frontend/scripts'];

console.log('── 작업 트리에 남은 임시 DB ──');
const left = [];
for (const d of DIRS) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (TEMP.test(name)) left.push(path.posix.join(d || '.', name));
  }
}
ok('검사가 쓰고 간 임시 DB 가 없다', left, []);
if (left.length) {
  console.log('     ↑ 이 파일을 만든 검사가 끝에서 안 지웠다. 지우는 줄이 있는데도');
  console.log('       남아 있으면 **나가는 쪽**을 본다 — `db.js` 의 process.on(\'exit\') 가');
  console.log('       `_flushPhotosSync()` 를 돌린다. `db.flushPhotosNow()` 를 지우기 **전에** 부른다');
}

// ── ★ **원자적 쓰기의 임시 파일은 안 보고 있었다** ── (2026-11-26 · 정석, 전수검사 ③)
//
// 위 `TEMP` 는 **임시 DB 모양**(`.check-*.json`)만 본다. 그런데 쓰는 중에 프로세스가
// 죽으면 **`파일.writing`** 이 남는다(`storage.js` 의 원자적 쓰기) — 오늘 트리에 셋
// 있었다(`.check-order.json.writing` · `.check-range…` · `.check-session…`).
// 이 자가 세우려던 것이 「**작업 트리에 찌꺼기를 남기지 않는다**」인데 그 꼴을
// 안 봤다. 이름을 세는 자는 또 새므로 — **꼬리로** 본다(`.writing` 로 끝나는 것 전부).
//
// 뜰 때 치우는 손도 같이 뒀다(`storage.sweepTemp`). 그래도 **검사가 남기고 간 것**은
// 서버를 안 띄우면 안 치워지므로 여기서 운다
console.log('');
console.log('── 원자적 쓰기가 남긴 임시 파일 (`*.writing`) ──');
{
  const 남은것 = [];
  for (const d of DIRS) {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (/\.writing(\.sync)?$/.test(name)) 남은것.push(path.posix.join(d || '.', name));
    }
  }
  ok('남은 `.writing` 이 없다', 남은것, []);
  if (남은것.length) {
    console.log('     ↑ 쓰다 죽은 자취다. 지워도 된다 — 본 파일은 그 옆에 온전히 있다');
    console.log('       (서버를 띄우면 `storage.init` 의 `sweepTemp` 가 본 DB 옆의 것은 치운다)');
  }
}

// ── ★ **찌꺼기를 치우는 손을 등록했는가** ── (2026-11-27 · 정석)
//
// 위 꼬리 검사는 **그 자리에 남아 있을 때만** 운다. 그런데 그 꼴이 나는 자리는
// **서버를 띄워 `kill()` 로 끊는 자 넷**이고(윈도 `kill()` 은 `TerminateProcess` 라
// 끝내는 손이 아예 안 돈다), 그 찌꺼기는 **그 자를 다시 돌릴 때까지** 트리에 앉아
// 있는다. 즉 전수를 한 바퀴 돌린 **뒤에** 남는다 — 돌리는 중에 보는 이 자는
// 그때 조용하다. 11/27 에 둘이 또 남았다(`.check-order.json.writing` ·
// `.check-range.json.writing`).
//
// 고친 뒤 **같은 구멍이 다시 생기지 않게** 보는 자리는 여기다 —
// **임시 DB 를 쓰는 자가 공용 손(`_tmpdb.cjs`)을 등록하는가.** 그 손은 들어올 때와
// 나갈 때 `.json` · `.photos.json` · `.writing` · `.writing.sync` 를 다 치운다.
// 자 서른이 그것을 쓰는데 **서버를 띄우는 넷만 제 목록을 들고 있었고, 거기에
// `.writing` 이 빠져 있었다.** 새 자를 쓰는 사람이 그것을 기억해야 하는 구조였다.
//
// **꼴을 베끼지 않는다** — 「`_tmpdb` 라는 글자가 있나」가 아니라, `DB_FILE` 을 제
// 임시 파일로 돌리는 자를 **찾아서** 그 자가 그 손을 걸었는지 본다
console.log('');
console.log('── 임시 DB 를 쓰는 자가 치우는 손을 걸었는가 ──');
{
  const 자리 = path.join(ROOT, 'backend', 'scripts');
  const 빠진것 = [];
  let 센것 = 0;
  for (const name of (fs.existsSync(자리) ? fs.readdirSync(자리) : [])) {
    if (!/^check-.*\.cjs$/.test(name)) continue;
    const src = fs.readFileSync(path.join(자리, name), 'utf-8');
    // ★ **주석을 빼고 본다** — 고친 자리마다 「`_tmpdb.cjs` 로 모았다」고 까닭을
    //   적어두는데, 글자로 찾으면 **그 설명이 걸려 자가 조용해진다.** 오늘 아침
    //   `check-version` 이 같은 꼴로 울었다. 자는 **코드**를 봐야 한다
    const 코드 = src.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    if (!코드.includes("DB_FILE")) continue;
    // ── ★ **트리 안에 두는 자만 본다** ── (첫 판이 열여섯을 거짓으로 걸었다)
    //
    // 자 스물여덟은 임시 DB 를 **`os.tmpdir()`** 에 둔다 — 그것이 남아도 작업
    // 트리는 깨끗하고 `git status` 도 조용하다. **치우는 손이 필요한 것은
    // 트리 안(`__dirname` 에서 만든 길)에 두는 자**다. 자리로 갈라야 한다 —
    // 안 가르면 이 자가 고칠 것 없는 열여섯을 불러 세우고, **그 울음에 사람이
    // 익숙해지면 진짜가 묻힌다**
    const 안에둔다 = 코드.includes("path.join(__dirname");
    const 밖에둔다 = 코드.includes("os.tmpdir()");
    if (!안에둔다 || 밖에둔다) continue;
    센것 += 1;
    if (!코드.includes("_tmpdb.cjs")) 빠진것.push(name);
  }
  // **0건은 통과가 아니다** — 찾는 꼴이 어긋나면 조용히 다 지나간다
  ok('트리 안에 임시 DB 를 두는 자를 찾았다 (스물은 넘는다)', 센것 > 20, true);
  ok('★ 그 자들이 전부 공용 손을 걸었다', 빠진것, []);
  if (빠진것.length) {
    console.log('     ↑ 그 자가 끝내도(또는 끊겨도) `.writing` 이 트리에 남는다.');
    console.log("       고치는 법: `const 치운다 = require('./_tmpdb.cjs')(TMP_DB);` 를 걸고");
    console.log('       끝에서 `치운다()` 를 부른다 (제 목록을 들고 있으면 꼴이 하나 빠진다)');
  }
}

console.log('');
console.log('── git 이 들고 있는 것 ──');
let tracked = [];
try {
  const out = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  tracked = out.split('\n').filter((l) => TEMP.test(path.posix.basename(l.trim())));
} catch (err) {
  console.log('SKIP git 을 못 불렀다 (' + err.message.split('\n')[0] + ')');
  tracked = null;
}
if (tracked !== null) {
  ok('임시 DB 가 git 에 올라가 있지 않다', tracked, []);
  if (tracked.length) {
    console.log('     ↑ `git rm --cached <파일>` 로 빼고 .gitignore 에 그 자리를 적는다.');
    console.log('       **이미 들고 있는 파일은 gitignore 로 안 막힌다** — 그래서 빼는 것이 먼저다');
  }
}

console.log('');
// ── **`backend/scripts/` 아래의 `.json` 은 전부 임시다** ── (2026-10-31)
//
// 위 `TEMP` 는 **이름 꼴**로 센다(`check`·`bench`·`probe`·`boot`). 오늘 한 번
// 재보려고 `.x.json` 을 만들었더니 **그 꼴에 안 걸려 커밋에 끼어 올라갔다** —
// 10/28 ① 이 바로 그 자리였고(「gitignore 가 이름 꼴 반만 막고 있었다」) 그날 꼴을
// 둘로 늘렸는데, **셋째 꼴을 내가 또 만들었다. 이름을 세는 자는 또 새는 자다.**
//
// 그래서 그 칸만은 **이름을 안 센다** — 올려야 할 `.json` 이 하나도 없는 자리다
// (검사·재는 자가 쓰고 지우는 것뿐이다). 남은 것도, git 에 든 것도 FAIL 한다
console.log('');
console.log('── backend/scripts 아래의 json (전부 임시다) ──');
{
  const dir = path.join(ROOT, 'backend', 'scripts');
  const 남은것 = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.json')) : [];
  ok('남아 있는 json 이 없다', 남은것, []);
  let 든것 = [];
  try {
    const out = execFileSync('git', ['ls-files', 'backend/scripts'], { cwd: ROOT, encoding: 'utf8' });
    든것 = out.split(String.fromCharCode(10)).map((l) => l.trim()).filter((l) => l.endsWith('.json'));
  } catch { 든것 = []; }
  ok('git 이 들고 있는 json 이 없다', 든것, []);
  if (든것.length) {
    console.log('     ↑ `git rm --cached <파일>` 로 먼저 뺀다 — **이미 들고 있는 파일은 gitignore 로 안 막힌다**');
  }
}
console.log(bad === 0 ? '모두 통과' : bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
