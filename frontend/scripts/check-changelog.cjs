// **공지가 낡지 않았는가** — 고친 것이 공지함에 안 올라간 채 배포되는 것을 막는다 (2026-11-09).
//
//   npm run clog     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 11/09 에 고친 둘(`af63232` 루틴·측정 · `8488432` 목표·계정)이 **공지함에 없었다.**
// 배포는 올라갔고 화면은 멀쩡한데, 바뀐 것을 알리는 자리에만 빠져 있었다.
//
// 까닭은 **공지를 뽑는 때**다 —
//
//   `changelog.json` 은 `gen-changelog.mjs` 가 **git 이력에서** 뽑는다. 그런데 그것은
//   `predev` · `prebuild` 에만 걸려 있다. `npm run check` 는 공지를 안 뽑는다.
//   그래서 **커밋한 뒤 빌드를 안 돌리면** 그 커밋은 공지에 안 든다.
//
// ★ 그리고 **배포는 스스로 못 뽑는다.** Render 빌드는 git 이력을 못 보니
//   `gen-changelog` 가 「읽을 것이 없으면 있던 json 을 그대로 둔다」로 조용히 빠진다
//   (그 파일 머리글에 적혀 있다). 즉 **로컬에서 뽑아 커밋한 것만 공지가 된다.**
//   이 저장소가 늘 `fix` 뒤에 `docs(공지·일지)` 를 따로 올려온 까닭이 그것이다.
//
// `checkfeed` 는 이것을 못 잡는다 — 그 자는 **지금 changelog 를 기준으로** 목록과
// 본문을 다시 뽑아 짝을 맞추므로, changelog 자체가 낡은 것은 보이지 않는다.
//
// ── 무엇을 보는가 ──
//
// git 이력에서 **공지로 드는 종류**(`gen-changelog.mjs` 의 `SHOWN` — feat · fix · perf)를
// 골라, 그 해시가 `changelog.json` 에 있는지 본다.
//
// **HEAD 는 뺀다.** 커밋은 제 해시를 제 안에 담을 수 없다 — 공지를 뽑고 커밋하므로
// 가장 새 커밋의 해시는 언제나 그 안에 없다(그것이 정상이다). 잡아야 하는 것은
// **그 앞의 것들**이다: 고치고 커밋한 뒤 또 커밋했는데 공지를 안 뽑은 경우.
//
// git 이 없거나 얕은 클론이면 **건너뛴다** — 생성기와 같은 선이다(배포에서 돈다).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });

console.log('── 고친 것이 공지함에 들어 있는가 ──');

// 공지로 드는 종류를 **생성기에서 읽는다** — 여기 또 적으면 한쪽만 고치는 날이 온다
let 드는종류 = [];
try {
  const gen = fs.readFileSync(path.join(ROOT, 'scripts', 'gen-changelog.mjs'), 'utf8');
  const blk = /const SHOWN = \{([\s\S]*?)\n\};/.exec(gen);
  드는종류 = blk ? [...blk[1].matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]) : [];
} catch { /* 아래에서 잡는다 */ }
ok('공지로 드는 종류를 생성기에서 읽었다', 드는종류.length > 0, true);
if (드는종류.length) console.log('       ' + 드는종류.join(' '));

let 이력 = null;
try {
  const 얕음 = git(['rev-parse', '--is-shallow-repository']).trim() === 'true';
  if (얕음) { 이력 = 'shallow'; } else { 이력 = git(['log', '-n20', '--pretty=format:%h%x09%s']); }
} catch { 이력 = null; }

if (이력 === null || 이력 === 'shallow') {
  console.log('건너뜀 git 이력을 못 본다 (' + (이력 === 'shallow' ? '얕은 클론' : 'git 없음')
    + ') — 생성기와 같은 선이다');
} else {
  const 줄 = 이력.split('\n').filter(Boolean).map((l) => {
    const [h, ...rest] = l.split('\t');
    const s = rest.join('\t');
    const t = (/^(\w+)\s*[(:]/.exec(s) || [])[1] || '';
    return { hash: h, subject: s, type: t };
  });
  // **HEAD 는 뺀다** — 커밋은 제 해시를 제 안에 담을 수 없다
  const 봐야할것 = 줄.slice(1).filter((r) => 드는종류.includes(r.type)).slice(0, 8);

  const clog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'changelog.json'), 'utf8'));
  const 담긴것 = new Set((clog.items || []).map((r) => r.hash));

  ok('공지에 담긴 줄이 있다', (clog.items || []).length > 0, true);
  const 빠진것 = 봐야할것.filter((r) => !담긴것.has(r.hash));
  ok('고친 커밋이 전부 공지에 있다 (HEAD 제외)', 빠진것.map((r) => r.hash), []);
  if (빠진것.length) {
    console.log('       빠진 것:');
    빠진것.forEach((r) => console.log('         ' + r.hash + '  ' + r.subject.slice(0, 64)));
    console.log('       → `npm run changelog` 를 돌리고 그 파일을 같이 커밋하세요.');
    console.log('         Render 는 git 이력을 못 보므로 **로컬에서 뽑아 커밋한 것만 공지가 됩니다.**');
  } else {
    console.log('       본 커밋 ' + 봐야할것.length + '개: '
      + 봐야할것.map((r) => r.hash).join(' ') + (봐야할것.length ? '' : '(없음)'));
  }
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
