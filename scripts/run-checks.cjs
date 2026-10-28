// **검사를 다 돌리고, 무엇이 어떻게 끝났는지 적는다** (2026-10-28).
//
//   node ../scripts/run-checks.cjs      (`npm run check` 가 이것을 부른다)
//
// ── 왜 이것이 생겼나 ──
//
// `npm run check` 는 검사 예순한 개를 `&&` 로 이어 붙인 **한 줄**이었다. 그 모양의
// 값은 「틀리면 바로 멈춘다」인데, 대가가 크다 —
//
//   · **중간의 검사가 터지면 그 뒤가 아예 안 돈다.** 10/27 ⑨ 에서 열일곱이 그렇게
//     사라졌고, **10/28 에 내가 또 밟았다**(점검 사유에 이름을 주자 `check-maint` 가
//     `ReferenceError` 로 죽었다). 그때 `FAIL` 은 **0 이었다** — 나는 그것을 통과로
//     읽고 커밋했다. 줄 수가 3,477 → 3,376 으로 줄어 있었던 것이 유일한 흔적이다
//   · **새 검사를 그 줄에 적는 것을 잊으면** 그 검사는 영영 안 돈다
//
// ── 그래서 이렇게 한다 ──
//
//   1. `scripts/check-*.cjs` 를 **찾아서** 돈다 — 줄에 적는 것을 잊을 자리가 없다
//   2. **하나가 죽어도 멈추지 않는다.** 다 돌린 뒤 **무엇이 FAIL 하고 무엇이
//      터졌는지**를 한 상자에 적는다. 「FAIL 0」인데 터진 것이 있으면 그것이 보인다
//   3. 하나라도 FAIL 하거나 터지면 **exit 1**
//
// 차례는 **이름 차례**다. 검사들은 서로를 안 쓰므로(각자 제 자료를 읽는다) 차례에
// 뜻이 없다 — 예전 줄의 차례를 흉내 내려고 목록을 또 들고 있지 않는다.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = path.join(process.cwd(), 'scripts');

// **일부러 안 도는 것은 까닭과 함께 적는다.** 여기 적힌 것만 건너뛴다
const SKIP = {
  // **`check-web.cjs` 는 건너뛰지 않는다** — 옛 `&&` 줄에 들어 있던 검사다.
  // 지은 것(dist)을 읽으므로 **`npm run build` 를 먼저** 해야 통과한다. 그것이
  // 10/27 에 세운 자고(「반드시 `npm run build`」), 건너뛰면 그 자가 사라진다.
  'check-odd-api.cjs': '**진짜 서버를 띄운다** — 포트를 쓰므로 따로 돌린다 (`npm run odd`)',
  'check-shield.cjs': '**진짜 서버를 띄운다** — 포트를 쓰므로 따로 돌린다 (`npm run shield`)',
};

const files = fs.readdirSync(DIR).filter((f) => /^check-.*\.cjs$/.test(f)).sort();
const ran = [];
const failed = [];
const crashed = [];
const skipped = [];

for (const f of files) {
  if (SKIP[f]) { skipped.push(f); continue; }
  const r = spawnSync(process.execPath, [path.join('scripts', f)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(out);
  ran.push(f);
  if (r.status === 0) continue;
  // **FAIL 로 끝난 것과 터진 것을 가른다** — 터진 것은 그 검사가 아무것도 안 본 것이다
  if (/^FAIL/m.test(out)) failed.push(f);
  else crashed.push(f);
}

const line = '─'.repeat(58);
console.log('');
console.log(line);
console.log('돌린 검사 ' + ran.length + '개 · 통과 ' + (ran.length - failed.length - crashed.length)
  + ' · FAIL ' + failed.length + ' · **터진 것** ' + crashed.length + ' · 건너뜀 ' + skipped.length);
if (failed.length) console.log('  FAIL  : ' + failed.join(' '));
if (crashed.length) {
  console.log('  터졌다: ' + crashed.join(' '));
  console.log('          ↑ **그 검사는 아무것도 안 봤다.** 고침이 검사를 깨뜨린 것이다 —');
  console.log('            옛 `&&` 줄에서는 이 자리에서 뒤가 조용히 사라졌다');
}
for (const f of skipped) console.log('  건너뜀: ' + f + ' — ' + SKIP[f]);
console.log(line);

const bad = failed.length + crashed.length;
console.log(bad === 0 ? '모두 통과' : bad + '개 검사가 통과하지 못했다');
process.exit(bad === 0 ? 0 : 1);
