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

// ── **빼는 갈래도 생성기에서 읽는다** ── (2026-11-13)
//
// 종류(`SHOWN`)만 읽고 **갈래(`SKIP_SCOPE`)는 안 읽고 있었다.** 생성기는
// `fix(개발)` · `fix(검사)` 처럼 **사용자가 열 수도 돌릴 수도 없는 자리**는 일부러
// 공지에 안 담는데, 자는 그것을 모르고 「빠졌다」고 울었다 — 11/13 에 맵시의
// `58eed53`(fix(개발), 개발 서버에서만 도는 고침)에서 그 꼴로 FAIL 이 떴다.
//
// 「더 무거운 줄에 덮였다」 예외를 걷은 것과 **다른 자리다.** 그건 생성기 쪽 규칙이
// **틀려서** 걷은 것이고, 이건 **맞는 규칙**이라 자가 따라가야 한다. 다만 **여기
// 또 적지 않는다** — 한쪽만 고치는 날이 오기 때문이다. 생성기에서 읽는다.
let 빼는갈래 = [];
try {
  const gen = fs.readFileSync(path.join(ROOT, 'scripts', 'gen-changelog.mjs'), 'utf8');
  const blk = /const SKIP_SCOPE = \[([^\]]*)\]/.exec(gen);
  빼는갈래 = blk ? [...blk[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
} catch { /* 위에서 이미 울었다 */ }
ok('공지에서 빼는 갈래도 생성기에서 읽었다', 빼는갈래.length > 0, true);
if (빼는갈래.length) console.log('       ' + 빼는갈래.join(' '));

let 이력 = null;
try {
  const 얕음 = git(['rev-parse', '--is-shallow-repository']).trim() === 'true';
  // `-n20` 에서 `-n40` 으로 (2026-11-13) — 위의 창을 스물로 넓혔으니 **훑는 것이
  // 스물보다 적으면** 그 창이 채워지지 않는다. 20 을 훑으면 `docs` · `chore` 가
  // 섞여 실제로 보는 것은 열 남짓이었다(11/12 의 `26b07cd` 가 그래서 안 보였다).
  if (얕음) { 이력 = 'shallow'; } else { 이력 = git(['log', '-n40', '--date=short', '--pretty=format:%h%x09%ad%x09%s']); }
} catch { 이력 = null; }

if (이력 === null || 이력 === 'shallow') {
  console.log('건너뜀 git 이력을 못 본다 (' + (이력 === 'shallow' ? '얕은 클론' : 'git 없음')
    + ') — 생성기와 같은 선이다');
} else {
  const 줄 = 이력.split('\n').filter(Boolean).map((l) => {
    const [h, d, ...rest] = l.split('\t');
    const s = rest.join('\t');
    const t = (/^(\w+)\s*[(:]/.exec(s) || [])[1] || '';
    // 갈래도 뽑는다 — 생성기가 빼는 갈래는 자도 빼야 한다
    const sc = (/^\w+\(([^)]+)\):/.exec(s) || [])[1] || '';
    // 날짜를 받는다 — 「덮은 줄이 **같은 날**에 있나」를 보려면 날짜가 있어야 한다
    return { hash: h, date: d, subject: s, type: t, scope: sc };
  });
  // **HEAD 는 뺀다** — 커밋은 제 해시를 제 안에 담을 수 없다
  // **여덟에서 스물로 넓힌다** (2026-11-13) — 11/12 에 빠진 둘 중 `26b07cd` 는 여덟
  // 창 밖이라 이 자가 **볼 수조차 없었다**(`da893b3` 만 보였다). 하루에 커밋 스무
  // 개를 올리는 날이 있으니 여덟은 「어제」도 못 덮는다. `KEEP` 이 80 이라 스물은
  // 넉넉히 그 안이다 — 막이에 밀려난 것을 빠짐으로 읽을 일은 없다.
  const 봐야할것 = 줄.slice(1)
    .filter((r) => 드는종류.includes(r.type) && !빼는갈래.includes(r.scope))
    .slice(0, 20);

  const clog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'changelog.json'), 'utf8'));
  const 담긴것 = new Set((clog.items || []).map((r) => r.hash));

  ok('공지에 담긴 줄이 있다', (clog.items || []).length > 0, true);

  // ── ★ **보안 갈래는 본문을 안 싣는다** ── (2026-11-13, 정석)
  //
  // 11/13 에 `KEEP` 40 → 80 · `SCAN` 120 → 300 으로 올리면서 **지난 커밋 마흔이
  // 새로 공개됐고**, 그 안에 `ea80aef`(`fix(관리자·보안)`)의 본문이 있었다 —
  // **권한 상승 경로를 그대로 적은 글**이다(어느 길을 어떻게 밀면 정지가 풀리는지).
  // 10/2 에 「먼저 가입하면 관리자가 된다」가 나갔던 그 자리다.
  //
  // 그때 세운 선은 `---`(커밋 적는 사람이 손으로 긋는 선)였는데, **그어두지 않은
  // 옛 커밋에는 소용이 없다.** 그래서 생성기가 갈래로 한 번 더 막는다. 여기서는
  // **막혔는지**를 본다 — 손으로 긋는 선 하나에 기대지 않는다.
  const 본문샌것 = (clog.items || [])
    .filter((it) => /보안|security/i.test(it.scope || '') && String(it.detail || '').trim())
    .map((it) => it.hash);
  ok('보안 갈래 공지는 본문을 안 싣는다 (제목만)', 본문샌것, []);

  // ── **예외를 걷었다 — 빠짐은 빠짐이다** ── (2026-11-13, 주인 결정)
  //
  // 여기에 「같은 날 같은 scope 에 더 무거운 줄이 실려 있으면 그 빠짐은 규칙대로다」가
  // 있었다. 생성기의 묶는 규칙과 짝을 맞추려고 11/11 에 넣은 예외다.
  //
  // **그 짝이 구멍이었다.** 자와 생성기가 **같은 규칙**을 알고 있으면, 그 규칙이 틀린
  // 날에는 자가 영영 안 운다. 11/12 의 `26b07cd`(자판이 오르면 찾기 결과가 하나도 안
  // 보였다) · `da893b3` 이 그렇게 소식에서 사라졌고, 이 자는 **통과로 적었다** —
  // 11/13 에 라이브와 산출물을 **해시로 전수 대조**해서야 보였다.
  //
  // 생성기가 더 이상 묶지 않으므로(`gen-changelog.mjs`) 예외도 필요 없다. 다시
  // **「전부 있어야 한다」** 다. 이 자가 울면 답은 하나다 — `npm run changelog` ·
  // `npm run feed` 를 돌리고 **산출물 넷을 같이 커밋**하는 것(48차 교훈).
  const 빠진것 = 봐야할것.filter((r) => !담긴것.has(r.hash));
  ok('고친 커밋이 **전부** 공지에 있다 (HEAD 제외)', 빠진것.map((r) => r.hash), []);
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
