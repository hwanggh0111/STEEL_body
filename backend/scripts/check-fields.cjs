// **서버가 보내는 칸을 화면이 읽는가** (2026-11-02)
//
//   npm run fields      (npm run check 가 찾아서 돈다)
//
// ── 왜 ──
//
// AI 관리자 화면이 보는 길(`GET /security/ai-dashboard`)은 `stats` 로 **일곱 칸**을
// 보내고 있었고, 화면은 그중 **둘만** 그렸다. 서버는 세고 있는데 **아무도 안 보는
// 숫자**가 다섯이었다 — 「지금 요청을 세는 주소 수」처럼 관리자가 봐야 하는 것까지
// 거기 있었다. 10/28 에 그 모양을 손으로 한 번 세어보고(「서버가 돌려주는 칸 이름을
// 기계로 세어 화면이 안 읽는 것을 찾는다») 스크립트를 버렸는데, **버리면 다음에 또
// 쌓인다.** 그래서 못을 박는다.
//
// 두 쪽을 다 본다 —
//   · 서버가 보내는데 **화면이 안 읽는 칸** → 그리거나, 안 보내거나
//   · 화면이 읽는데 **서버가 안 보내는 칸** → 그 자리는 늘 `undefined` 다
//
// **글자로 센다.** 이 길은 관리자 권한이 있어야 열리고 숫자는 그때그때 다르므로,
// 보는 것은 「칸 이름이 양쪽에 다 있나」다 (값은 `npm run shield` 가 본다).
const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const routeSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'security.js'), 'utf8');
const panelSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'AiAdminPanel.jsx'), 'utf8');

/** `이름: { a: …, b: … }` 안의 **첫 겹** 칸 이름만 뽑는다 */
function keysOf(src, label) {
  const at = src.indexOf(label + ': {');
  if (at < 0) return null;
  let depth = 0;
  let body = '';
  for (let i = src.indexOf('{', at); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) { body = src.slice(src.indexOf('{', at) + 1, i); break; } }
  }
  // 한 겹 안의 `이름:` 만 (안쪽 괄호는 건너뛴다)
  const keys = [];
  let d = 0;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (d === 0) {
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*):/);
      if (m) keys.push(m[1]);
    }
    d += (line.match(/[{[]/g) || []).length - (line.match(/[}\]]/g) || []).length;
  }
  return keys;
}

const statsKeys = keysOf(routeSrc, 'stats');
ok('서버의 stats 칸을 찾았다', Array.isArray(statsKeys) && statsKeys.length > 0, true);

// **화면이 읽는 칸** — `stats.xxx` 로 쓴다 (`const { stats } = …` 뒤의 그 이름이다)
const read = new Set([...panelSrc.matchAll(/\bstats\.([A-Za-z0-9_]+)/g)].map((m) => m[1]));

ok('서버가 보내는데 화면이 안 읽는 칸', (statsKeys || []).filter((k) => !read.has(k)), []);
ok('화면이 읽는데 서버가 안 보내는 칸', [...read].filter((k) => !(statsKeys || []).includes(k)), []);

// **같은 값을 두 이름으로 보내지 않는다** — `totalWarnings` 가 `threats.level2` 와
// 같은 값이었고, 화면은 그것을 「잠금」으로 이미 그리고 있었다
// **그 칸 목록에서 본다** — 파일 전체를 글자로 훑으면 까닭을 적어둔 주석과 **다른
// 길(`/security/report`)의 같은 이름**에 걸린다 (처음에 그렇게 걸렸다)
ok('같은 값을 두 이름으로 안 보낸다 (totalWarnings)', (statsKeys || []).includes('totalWarnings'), false);
// 램에 든 막은 수(`activeLocks`)와 파일에 남는 수(`shield.blocks`)를 같이 그리면
// 관리자가 어느 쪽이 맞는지 모른다 — 파일 쪽만 그린다(그 자가 화면에 적혀 있다)
ok('램 쪽 잠금 수를 같이 안 보낸다 (activeLocks)', (statsKeys || []).includes('activeLocks'), false);

// `shield` 도 같은 자로 본다 — 「지금 막혀 있는 것」은 관리자가 제일 먼저 보는 칸이다
const shieldKeys = keysOf(routeSrc, 'shield');
const shieldRead = new Set([...panelSrc.matchAll(/\bshield\.([A-Za-z0-9_]+)/g)].map((m) => m[1]));
ok('shield 칸을 화면이 다 읽는다', (shieldKeys || []).filter((k) => !shieldRead.has(k)), []);

// ── **`/security/report` 도 같은 자로 센다** ── (2026-11-03)
//
// 11/02 에 AI 관리자 길만 재고 끝냈는데, 같은 파일의 바로 아래 길(`GET
// /security/report`)을 세어보니 **보내면서 아무도 안 읽는 칸이 셋** 더 있었다 —
//   · `server.memory` : `process.memoryUsage()` 를 통째로(바이트 다섯 개). 화면에 한 자리도 없었다
//   · `auth.csrfProtection` : 바로 아래 `defense` 가 **같은 말을 같이** 보내고 있었다
//   · `auth.cookieFlags` : 손으로 적어둔 글자였고, 읽는 데도 없었다
//
// 이 화면은 서버가 주는 뭉치를 **별명으로 받아** 그린다(`const srv = report?.server`).
// 그래서 읽는 쪽은 뭉치 이름이 아니라 **그 별명**으로 센다.
const scanSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'admin', 'SecurityScan.jsx'), 'utf8');

/** 화면이 `const <별명> = report?.<뭉치>` 로 받은 별명을 찾는다 (손으로 적어두면 어긋난다) */
function aliasOf(group) {
  const hit = [...scanSrc.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*report\?\.([A-Za-z0-9_]+)/g)]
    .find((m) => m[2] === group);
  return hit ? hit[1] : null;
}

for (const group of ['server', 'users', 'threats', 'auth']) {
  const alias = aliasOf(group);
  ok(`화면이 report.${group} 을 받는 별명을 찾았다`, typeof alias === 'string', true);
  if (!alias) continue;

  const sent = keysOf(routeSrc, group) || [];
  // `threats` 는 `...stats.threats` 를 펼쳐 보낸다 — 그 칸 이름은 가드가 들고 있다
  if (group === 'threats') {
    const guardSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'middleware', 'aiGuard.js'), 'utf8');
    const m = guardSrc.match(/let threats = \{([^}]*)\}/);
    for (const k of (m ? m[1] : '').matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) sent.push(k[1]);
  }
  ok(`report.${group} 의 칸을 찾았다`, sent.length > 0, true);

  const seen = new Set([...scanSrc.matchAll(/([A-Za-z_$][\w$]*)\.([A-Za-z0-9_]+)/g)]
    .filter((m) => m[1] === alias).map((m) => m[2]));
  ok(`report.${group} — 보내는데 화면이 안 읽는 칸`, sent.filter((k) => !seen.has(k)), []);
  ok(`report.${group} — 화면이 읽는데 안 보내는 칸`, [...seen].filter((k) => !sent.includes(k)), []);
}

// **같은 말을 두 뭉치에 담지 않는다** — `auth.csrfProtection` 과 `defense.csrfProtection`
// 이 같이 가고 있었고, 화면이 그리는 쪽은 `defense` 였다
const authKeys = keysOf(routeSrc, 'auth') || [];
const defenseKeys = keysOf(routeSrc, 'defense') || [];
ok('auth 와 defense 에 겹치는 칸이 없다', authKeys.filter((k) => defenseKeys.includes(k)), []);

// **램은 MB 로 보낸다** — 헬스체크(`/api/health`)와 같은 모양이어야 한다.
// `process.memoryUsage()` 를 그대로 보내면 바이트고, 두 길이 다른 단위로 말한다
ok('램을 바이트째 통째로 안 보낸다', /memory: process\.memoryUsage\(\),/.test(routeSrc), false);
const memKeys = keysOf(routeSrc, 'memory') || [];
ok('램 칸은 헬스체크와 같은 이름이다', memKeys, ['rss', 'heap']);

console.log('');
console.log(bad === 0 ? '전부 통과' : bad + '건 실패');
process.exit(bad === 0 ? 0 : 1);
