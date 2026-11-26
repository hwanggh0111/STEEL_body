// AI 관리자의 **하루 줄** (2026-11-16 · 정석)
//
//   npm run aiday      (npm run check 에도 들어 있다)
//
// 벼림이 11/16 에 붙인 기능이고(`a265e2a`), 내가 2차로 받아 둘을 고쳤다.
// **화면으로는 확인할 수 없는 자리다** — 「요 이레」가 맞는지 보려면 조용한 주를
// 한 주 보내야 하고, 「날 넘김」을 보려면 자정을 걸터앉아야 한다.
//
// ── ① 「요 이레」가 요 이레인가 ──
//
// `db.getAiDays(n)` 이 `rows.slice(-n)` 으로 **줄 수**를 자르고 있었다. 그런데 줄은
// **일이 있었던 날만** 생기고 서른 날까지 남는다(`AI_DAY_KEEP`). 조용한 주가 지나면 —
//
//     저장된 줄  10/20 · 10/25 · 11/01 · 11/16
//     slice(-7)  11/16 11/01 10/25 10/20
//     화면 제목   「요 이레」            ★ 10/20 줄이 요 이레에 섞인다
//
// 관리자가 **한 달 전 사고를 이번 주 일로 읽는다.** 더 나쁜 것은 그 바로 위 칸에
// 「서른 날까지 남습니다」가 적혀 있다는 것 — **글과 코드가 서로를 부정했다.**
// 그래서 **날짜 창**으로 자른다. 날 수를 물었으면 날 수로 답한다.
//
// ── ② 세는 값이 뒤로 가면 안 적는다 ──
//
// `aiGuard` 는 **지난번에 넘긴 값과의 차이**만 넘긴다(`sent`). 그래서 세는 값이
// 뒤로 가면(런타임에 0 으로 되돌리는 자리가 생기면) `sent` 가 높이 남아 **그 뒤로
// 요청이 영영 안 적힌다** — 조용한 손실이다. 지금은 되돌리는 자리가 없고, 그것을
// **자가 지킨다**: 음수 차이를 적지 않는 선과, 되돌리는 자리가 생겼는지 둘 다 본다.
//
// ── ③ 하루 줄은 사람 것이 아니다 ──
//
// `aiDays` 는 **서버가 한 일의 기록**이라 계정을 지울 때 지워질 자리가 아니다.
// `USER_COLLECTIONS` 에 들어가면 사람 하나가 나갈 때 **서버의 일지가 같이 지워진다.**
//
// ── ④ 빈 칸이 모르는 것을 안다고 말하지 않는다 ──
//
// 줄은 **요청이 하나라도 적혔을 때** 생긴다. 그러니 줄이 없는 것은 「조용했다」가
// 아니라 **「적힌 것이 없다」** 다 — 라이브에서 그건 대개 서버가 내려가 있었다는
// 뜻이다. 가르는 값은 `since`(프로세스가 뜬 시각)이고, **하루를 넘겨 떠 있을 때만**
// 「조용했다 · 정상입니다」로 말할 수 있다.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const BACK = path.join(ROOT, '..', 'backend', 'src');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const 읽기 = (p) => fs.readFileSync(p, 'utf8');

// ─────────────────────────────────────────────
console.log('── ① 「요 이레」가 요 이레인가 ──');

const dbSrc = 읽기(path.join(BACK, 'db.js'));
const getAi = /getAiDays\(n = 7\) \{[\s\S]*?\n  \},/.exec(dbSrc);
ok('`getAiDays` 를 찾았다', !!getAi, true);
if (getAi) {
  const 몸 = getAi[0];
  // **줄 수로 자르지 않는다** — 날짜로 걸러야 한다
  ok('  날짜로 거른다 (`r.day >= 창시작`)', /r\.day\s*>=/.test(몸), true);
  ok('  창의 시작을 서울 날짜로 만든다', /seoulDay\(/.test(몸), true);
  ok('  `seoulDay` 를 들여온다 (적는 쪽과 같은 자)', /require\('\.\/utils\/seoulDay'\)/.test(dbSrc), true);
}

// 셈을 그대로 돌려 본다 — **조용한 주가 지난 꼴**을 먹인다.
// `db.js` 를 통째로 불러오면 파일·DB 를 건드리므로 **그 함수의 셈만** 떼어 세운다
{
  const { seoulDay } = require(path.join(BACK, 'utils', 'seoulDay.js'));
  const 창 = (rows, n, now) => {
    const days = Math.max(1, Number(n) || 1);
    const 창시작 = seoulDay(now - (days - 1) * 86400000);
    return rows.filter((r) => r && typeof r.day === 'string' && r.day >= 창시작)
      .slice(-days).reverse().map((r) => r.day);
  };
  const 오늘 = Date.parse('2026-11-16T05:00:00Z');       // 서울 11/16 14시
  const rows = ['2026-10-20', '2026-10-25', '2026-11-01', '2026-11-16'].map((day) => ({ day }));
  ok('조용한 주가 지나도 한 달 전 줄이 안 섞인다', 창(rows, 7, 오늘), ['2026-11-16']);
  const 이레 = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16']
    .map((day) => ({ day }));
  ok('  이레가 꽉 차면 일곱 줄 (가까운 날이 앞)', 창(이레, 7, 오늘).length, 7);
  ok('  오늘이 맨 앞이다', 창(이레, 7, 오늘)[0], '2026-11-16');
  // 창 **경계**를 본다 — 오늘을 1일로 세니 이레면 11/10 까지 든다
  ok('  이레의 경계가 오늘 포함 일곱째 날이다',
    [창([{ day: '2026-11-10' }], 7, 오늘).length, 창([{ day: '2026-11-09' }], 7, 오늘).length], [1, 0]);
  ok('  줄이 하나도 안 들면 빈 배열 (화면이 「없다」로 읽는다)', 창(rows, 1, Date.parse('2026-11-17T05:00:00Z')), []);
}

// ─────────────────────────────────────────────
console.log('');
console.log('── ② 세는 값이 뒤로 가면 안 적는다 ──');

const guardSrc = 읽기(path.join(BACK, 'middleware', 'aiGuard.js'));
ok('차이가 0 보다 커야 넘긴다', /if \(d > 0\)/.test(guardSrc), true);
// 되돌리는 자리가 생기면 `sent` 가 높이 남아 **그 뒤로 영영 안 적힌다**
{
  const 되돌림 = guardSrc.split('\n')
    .map((l, i) => ({ l, n: i + 1 }))
    .filter(({ l }) => /^\s*(totalRequests|blockedRequests)\s*=\s*0|^\s*threats\s*=\s*\{\s*level2:\s*0/.test(l))
    // 맨 처음 선언 세 줄은 되돌림이 아니다
    .filter(({ l }) => !/^\s*let\s/.test(l))
    .map(({ n }) => `aiGuard.js:${n}`);
  ok('  세는 값을 런타임에 0 으로 되돌리는 자리가 없다', 되돌림, []);
}
// **선언만 보면 안 된다** — 지어두고 안 부르면 그 손은 없는 것이다.
// 되돌려 보다가 잡았다: 부르는 줄만 걷었는데 자가 그대로 통과했다 (11/16)
ok('하루가 바뀌기 전에 넘기는 손이 있다', /function 날바뀌기전에넘긴다\(/.test(guardSrc), true);
ok('  그 손을 **부른다** (줄머리에서 한 번)', /^날바뀌기전에넘긴다\(\);$/m.test(guardSrc), true);
ok('  스스로 다시 잡는다 (하루 뒤에도 뛴다)',
  /setTimeout\([\s\S]{0,200}날바뀌기전에넘긴다\(\);/.test(guardSrc), true);
ok('  그 타이머가 프로세스를 붙잡지 않는다 (`unref`)',
  /날바뀌기전에넘긴다[\s\S]*?t\.unref/.test(guardSrc), true);
// **한계를 적어뒀나** — 안 적으면 다음 사람이 0 이라고 믿는다
ok('  자는 동안은 안 뛴다는 것을 적어뒀다', /깨어 있을 때만|안 뛴다/.test(guardSrc), true);

// ─────────────────────────────────────────────
console.log('');
console.log('── ③ 하루 줄은 사람 것이 아니다 ──');
{
  // ★ 과녁이 `],\n` 으로 끝나 **CRLF 판에서 조용히 빗나갔다** (2026-11-26 · 정석).
  // 이 집의 파일은 작업 트리에서 CRLF 인 것이 섞여 있다(git 은 LF 로 들고 있다) —
  // 그래서 **커밋된 판에서는 통과하고 내 트리에서만 FAIL** 하는 꼴이 났다.
  // 줄바꿈을 보는 과녁은 **늘 `\r?\n`** 으로 적는다 ([[shell-eats-backslash]] 와 같은 결)
  const m = /USER_COLLECTIONS: \[([\s\S]*?)\],\r?\n/.exec(dbSrc);
  ok('`USER_COLLECTIONS` 를 찾았다', !!m, true);
  if (m) ok('  `aiDays` 가 거기 없다 (계정 지울 때 안 지워진다)', /['"]aiDays['"]/.test(m[1]), false);
}

// ─────────────────────────────────────────────
console.log('');
console.log('── ④ 빈 칸이 모르는 것을 안다고 말하지 않는다 ──');
{
  const panel = 읽기(path.join(ROOT, 'src', 'components', 'AiAdminPanel.jsx'));
  // 주석은 줄 단위로 걷는다 — 머리글이 까닭을 적는 자리라 글만으로 통과시키면 안 된다
  let 안 = false;
  const 코드 = panel.split('\n').filter((l) => {
    if (안) { if (/\*\//.test(l)) 안 = false; return false; }
    if (/^\s*\{?\/\*/.test(l)) { 안 = !/\*\//.test(l); return false; }
    return !/^\s*\/\//.test(l);
  }).join('\n');
  ok('`since` 로 두 갈래를 가른다', /data\?\.since|data\.since/.test(코드) && /24 \* 60 \* 60000/.test(코드), true);
  // 「정상입니다」는 **하루를 넘겨 떠 있을 때만** 쓸 수 있는 말이다
  const 정상자리 = 코드.split('\n').map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => /정상입니다/.test(l));
  ok('  「정상입니다」가 한 자리뿐이다', 정상자리.length, 1);
  if (정상자리.length === 1) {
    const 앞 = 코드.split('\n').slice(Math.max(0, 정상자리[0].n - 12), 정상자리[0].n).join('\n');
    ok('  그 말이 「하루 넘게 떠 있었다」 쪽에 붙어 있다', /hasSlept \? \([\s\S]*/.test(코드) && /하루 넘게/.test(앞), true);
  }
  ok('  모르는 쪽에는 「알 수 없습니다」라고 적는다', /알 수 없습니다/.test(코드), true);
}

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
