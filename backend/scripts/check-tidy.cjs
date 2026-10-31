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
