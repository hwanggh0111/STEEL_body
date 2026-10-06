// 남의 것을 건드릴 수 있는 길이 있나 (2026-10-06).
//
//   npm run owner     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// `/:id` 로 받은 번호는 **주소에 적혀 오는 값**이다. 그 번호의 줄이 내 것인지는
// 서버가 봐야 하는데, 보는 자리를 한 줄 빼먹으면 **남의 기록을 고치고 지울 수 있다.**
// 그리고 그건 **아무 증상도 안 낸다** — 자기 것만 만지는 사람에게는 영영 멀쩡하다.
//
// 라우트 스물둘을 손으로 훑어서 지금은 맞다는 것을 봤다(2026-10-06). 그런데 손으로
// 훑은 것은 **다음 라우트에 안 따라온다.** 그래서 못을 박는다.
//
// ── 길마다 셋 중 하나여야 한다 ──
//
//   1. **`req.userId` 를 쓴다** — 내 것인지 보고 아니면 못 건드린다
//   2. **`adminAuth` 다** — 사람별 소유가 없는 것이다(공지 · 홈페이지 사진 ·
//      FAQ 구멍 · 사람 차단). 관리자 하나가 다 다루는 자료라 주인을 볼 것이 없다
//   3. **그 줄 위에 「누구나 본다」고 적혀 있다** — 추천 루틴처럼 로그인도 없이
//      누구나 받는 목록이다
//
// **예외를 이 파일에 적지 않는다.** 여기에 길 이름을 적어두면 그 길을 고치는
// 사람은 예외인 줄을 모른다. 그 줄 위에 적게 한다 — 오늘 글꼴 검사에서 같은
// 판단을 했다(`frontend/scripts/check-font.cjs` 의 「라틴 전용」).
//
// ── 빈 손으로 통과하는 것이 제일 나쁘다 ──
//
// 오늘 다른 검사에서 그것을 **두 번** 겪었다 — 개수로 센 것, 낱말이 있나로 센 것.
// 여기서는 셋째 모양으로 겪었다: **정규식이 본문 긴 길을 건너뛰었다.**
// `inbody PUT` 과 `workouts PUT` 이 목록에 안 잡혔는데, 그 둘은 화면이 실제로
// 쓰는 길이다. 그래서 **길을 따로 세어 맞춰본다** — 잡은 수와 있는 수가 다르면
// 그것부터 실패시킨다.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'src', 'routes');
const OPT_OUT = '누구나 본다';

let bad = 0;
const ok = (label, pass, detail) => {
  if (!pass) bad += 1;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label}${detail ? ` → ${detail}` : ''}`);
};

/** 한 라우트 블록의 끝(괄호 짝이 맞는 자리)을 찾는다. 길이로 자르지 않는다. */
function blockOf(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    const c = src[i];
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return src.slice(start);
}

const rows = [];
const declared = [];

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(DIR, file), 'utf8');
  const name = file.replace(/\.js$/, '');

  const re = /router\.(put|delete|patch|post|get)\(\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const [, method, route] = m;
    if (!/:\w+/.test(route)) continue;          // `:id` 가 없는 길은 여기 일이 아니다
    declared.push(`${name} ${method} ${route}`);

    const body = blockOf(src, m.index + `router.${method}`.length);
    // 그 줄 위 세 줄에 적어둔 예외
    const above = src.slice(Math.max(0, m.index - 260), m.index);
    rows.push({
      name,
      method: method.toUpperCase(),
      route,
      owner: /req\.userId/.test(body),
      admin: /adminAuth/.test(body),
      open: above.includes(OPT_OUT),
    });
  }
}

console.log('── `:id` 를 받는 길이 주인을 보나 ──');
console.log('');

for (const r of rows) {
  const pass = r.owner || r.admin || r.open;
  const why = r.owner ? 'req.userId'
    : r.admin ? 'adminAuth (사람별 소유 없음)'
      : r.open ? `「${OPT_OUT}」 (로그인 없이 받는 목록)`
        : '**아무것도 안 본다**';
  ok(`${r.name.padEnd(16)} ${r.method.padEnd(6)} ${r.route.padEnd(22)}`, pass, why);
}

console.log('');
console.log('── 빈 손으로 통과하지 않는가 ──');
// 잡은 수와 적힌 수가 같아야 한다. 다르면 **정규식이 건너뛴 길이 있다는 뜻**이고,
// 그 길은 검사받지 않은 채로 남는다
ok(`잡은 길 = 적힌 길 (${rows.length} / ${declared.length})`, rows.length === declared.length);
// 화면이 실제로 쓰는 길 넷은 **반드시** 목록에 있어야 한다. 하나라도 빠지면
// 정규식이 조용히 샌 것이다 (처음 판이 바로 이 둘을 빠뜨렸다)
const must = [
  ['inbody', 'PUT'], ['workouts', 'PUT'], ['myRoutines', 'PUT'], ['notes', 'PUT'],
];
for (const [n, meth] of must) {
  ok(`  ${n} ${meth} 를 봤다`, rows.some((r) => r.name === n && r.method === meth));
}

console.log('\n' + (bad ? `${bad}건 실패` : '전부 통과'));
process.exit(bad ? 1 : 0);
