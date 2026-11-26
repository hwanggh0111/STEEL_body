// ── **오류 관리자가 제 일을 하는가** ── (2026-11-26 · 주인 지시 「오류 관리자를 파일로」)
//
//   npm run triage   (backend/ · npm run check 에도 들어 있다)
//
// `agents/buchongjae/triage.cjs` 는 기록 한 줄을 보고 **사람이 고치러 가는 데 필요한
// 네 가지**를 먼저 해 둔다 — 갈래·까닭·다음 걸음(`rules.js`) · 그 줄의 코드 · 그 파일을
// 마지막에 바꾼 커밋 · **그 자리를 보는 자가 있는가**. 그리고 **순서를 정한다**.
//
// 그 넷이 진짜 되는지 **가짜 오류를 먹여** 본다. 여기서 보는 것:
//
//   1. 아는 꼴을 갈래로 가른다 (「줄의 모양이 다르다」 · 「DB 에 못 닿았다」 …)
//   2. **모르는 꼴도 버리지 않는다** — 「아직 모르는 꼴」로 세고 다음 걸음을 적는다
//   3. 순서가 **급함 먼저**다 (한 번 난 1급이 백 번 난 4급보다 위)
//   4. **그 줄의 코드를 진짜로 읽어 온다** (적힌 이름이 짧아도 파일을 찾아낸다)
//   5. 같은 오류를 **몇 사람이 겪었나**를 센다 (한 사람 ≠ 모두)
//   6. 자가 없는 자리를 **「자 없음」으로 세운다**
//   7. 기록이 없어도 안 터진다
//
// 되돌려-FAIL: `--되돌려` 를 주면 **아는 것(`rules.js`)을 비운 판**으로 돌린다 →
// 갈래가 전부 「모르는 꼴」이 되고 순서도 무너져 FAIL 이 보여야 한다
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const TRIAGE = path.join(ROOT, 'agents', 'buchongjae', 'triage.cjs');
const RULES = path.join(ROOT, 'agents', 'buchongjae', 'rules.js');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// ── 되돌려: 아는 것을 비운다 ────────────────────────────────────────────────
let 치울것 = [];
if (process.argv.includes('--되돌려')) {
  const 원본 = fs.readFileSync(RULES, 'utf-8');
  const 빈판 = 원본.replace(/const RULES = \[[\s\S]*?\n\];/, 'const RULES = [];');
  fs.writeFileSync(RULES + '.bak', 원본, 'utf-8');
  fs.writeFileSync(RULES, 빈판, 'utf-8');
  치울것.push(() => {
    fs.writeFileSync(RULES, fs.readFileSync(RULES + '.bak', 'utf-8'), 'utf-8');
    fs.unlinkSync(RULES + '.bak');
  });
  console.log('── 되돌려: 아는 것(rules)을 비웠다 — 아래에 FAIL 이 있어야 한다 ──');
}
process.on('exit', () => { for (const f of 치울것) { try { f(); } catch { /* 이미 됐다 */ } } });

/** 가짜 기록을 담은 DB 파일을 세우고 관리자를 돌려 **보고서(JSON)** 를 받는다 */
function 돌려본다(줄들) {
  const DB = path.join(os.tmpdir(), `check-triage-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  const now = Date.now();
  fs.writeFileSync(DB, JSON.stringify({
    users: [], _nextId: {},
    securityLogs: 줄들.map((d, i) => ({
      type: 'server_error', detail: d, timestamp: new Date(now - (줄들.length - i) * 1000).toISOString(),
    })),
  }), 'utf-8');
  try {
    const out = execFileSync(process.execPath, [TRIAGE, '--json'], {
      cwd: ROOT, encoding: 'utf-8',
      env: Object.assign({}, process.env, { DB_FILE: DB, DATABASE_URL: '' }),
    });
    return JSON.parse(out);
  } finally {
    try { fs.unlinkSync(DB); } catch { /* 이미 없다 */ }
  }
}

// ── ⑴⑵ 갈래를 가르는가 ─────────────────────────────────────────────────────
console.log('── 갈래를 가르는가 ──');
const 넷 = 돌려본다([
  'request · GET /api/workouts · u7 · TypeError: rows is not iterable · src/db.js:812',
  'rejection · Error: connect ECONNREFUSED 10.0.0.1:5432 · src/storage.js:120',
  'request · POST /api/photos · u9 · Error: request entity too large · src/index.js:700',
  'request · GET /api/odd · u1 · RangeError: 듣도 보도 못한 것 · src/db.js:812',
]);
const 갈래들 = 넷.건들.map((b) => b.갈래);
ok('아는 꼴 셋을 제 갈래로', [
  갈래들.includes('줄의 모양이 다르다'),
  갈래들.includes('DB 에 못 닿았다'),
  갈래들.includes('보낸 것이 너무 크다'),
], [true, true, true]);
ok('★ 모르는 꼴도 버리지 않는다', 넷.모르는꼴, 1);
const 모름 = 넷.건들.find((b) => /모르는 꼴/.test(b.갈래));
ok('  모르는 꼴에도 다음 걸음이 있다', !!모름 && /rules\.js/.test(모름.다음), true);

// ── ⑶ 순서가 급함 먼저인가 ─────────────────────────────────────────────────
console.log('\n── 순서 ──');
const 섞음 = 돌려본다([].concat(
  // 4급(사람이 먼저 끊었다) 을 **여섯 번**
  new Array(6).fill('request · GET /api/export/workouts · u3 · Error: aborted · src/index.js:700'),
  // 1급(판이 깨졌다) 을 **한 번**
  ['rejection · SyntaxError: Unexpected end of JSON input · src/storage.js:88'],
));
ok('★ 한 번 난 1급이 여섯 번 난 4급보다 위다',
  [섞음.건들[0].급함, 섞음.건들[0].횟수, 섞음.건들[1].급함, 섞음.건들[1].횟수], [1, 1, 4, 6]);

// ── ⑷ 코드를 진짜 읽어 오는가 ──────────────────────────────────────────────
console.log('\n── 그 줄의 코드 ──');
const 한건 = 돌려본다(['request · GET /api/workouts · u7 · TypeError: rows is not iterable · src/db.js:812']);
const 자리 = 한건.건들[0].자리[0];
ok('짧게 적힌 이름으로 파일을 찾아낸다', 자리.파일, 'backend/src/db.js');
ok('  줄 수도 그대로', 자리.줄, 812);
// 보고서 JSON 에는 자리와 자만 담고, 코드는 사람이 보는 화면에 찍는다 — 그쪽을 본다
const 화면 = execFileSync(process.execPath, [TRIAGE], {
  cwd: ROOT, encoding: 'utf-8',
  env: Object.assign({}, process.env, { DATABASE_URL: '' }),
});
ok('기록이 없으면 그렇게 말한다 (안 터진다)', /터진 기록이 없다/.test(화면), true);

// 코드를 찍는지는 **진짜 파일의 그 줄**을 견줘 본다
const db줄 = fs.readFileSync(path.join(ROOT, 'backend/src/db.js'), 'utf-8').split(/\r?\n/)[811];
const 화면2 = (() => {
  const DB = path.join(os.tmpdir(), `check-triage-show-${process.pid}.json`);
  fs.writeFileSync(DB, JSON.stringify({
    users: [], _nextId: {},
    securityLogs: [{ type: 'server_error', timestamp: new Date().toISOString(),
      detail: 'request · GET /api/workouts · u7 · TypeError: rows is not iterable · src/db.js:812' }],
  }), 'utf-8');
  try {
    return execFileSync(process.execPath, [TRIAGE], {
      cwd: ROOT, encoding: 'utf-8',
      env: Object.assign({}, process.env, { DB_FILE: DB, DATABASE_URL: '' }),
    });
  } finally { try { fs.unlinkSync(DB); } catch { /* 이미 없다 */ } }
})();
ok('★ 그 줄의 코드를 진짜로 찍는다', 화면2.includes((db줄 || '').trim().slice(0, 40)), true);
ok('  그 자리에 ▶ 를 세운다', /▶\s+812 │/.test(화면2), true);
ok('  마지막 손(커밋)도 적는다', /마지막 손 [0-9a-f]{7,}/.test(화면2), true);

// ── ⑸ 사람 수를 세는가 ────────────────────────────────────────────────────
console.log('\n── 몇 사람이 겪었나 ──');
const 세사람 = 돌려본다([
  'request · GET /api/goal · u1 · TypeError: Cannot read properties of undefined (reading \'startedAt\') · src/pages/GoalPage.jsx:304',
  'request · GET /api/goal · u2 · TypeError: Cannot read properties of undefined (reading \'startedAt\') · src/pages/GoalPage.jsx:304',
  'request · GET /api/goal · u3 · TypeError: Cannot read properties of undefined (reading \'startedAt\') · src/pages/GoalPage.jsx:304',
]);
ok('★ 한 가지로 묶고 사람 셋을 센다', [세사람.가지수, 세사람.건들[0].사람], [1, 3]);

// ── ⑹ 자가 없는 자리 ──────────────────────────────────────────────────────
console.log('\n── 자가 있나 ──');
const 자본다 = 돌려본다([
  'request · GET /api/x · u1 · TypeError: rows is not iterable · src/utils/errorLog.js:100',
]);
ok('그 파일을 보는 자를 찾아낸다',
  자본다.건들[0].자리[0].자.some((z) => /check-errorlog/.test(z)), true);

// ── ⑺ 비어도 안 터진다 (위 `화면` 에서 이미 봤다) ─────────────────────────
console.log('\n── 보고서 파일 ──');
const 보고서길 = path.join(ROOT, 'agents/buchongjae/last-report.json');
ok('보고서를 남긴다', fs.existsSync(보고서길), true);

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
