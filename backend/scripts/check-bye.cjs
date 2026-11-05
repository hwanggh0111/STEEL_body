// **끝낼 때 마지막 쓰기를 잃지 않는가** (2026-11-05).
//
//   npm run bye     (npm run check 가 찾아서 돈다)
//
// ── 무엇이 틀렸었나 ──
//
// `db.js` 와 `index.js` 가 **둘 다** SIGTERM 을 듣고 있었다. 노드는 들은 차례대로
// 다 부르는데 `index.js` 가 맨 위에서 `db` 를 들여오므로 **`db.js` 것이 먼저**다.
// 그리고 그것이 `process.exit()` 를 부르면 **그 뒤 차례는 아예 안 돈다** —
// `index.js` 의 끝내기(`server.close` → `await db.drain()`)가 통째로 건너뛰어졌다.
//
//   · **Postgres 에서는 마지막 쓰기가 사라진다.** `_flushImmediate` 는 파일에
//     동기로 쓰는 손이고, 운영은 Postgres 다. 기다리는 자리가 `db.drain()` 이다 —
//     10/01 에 `index.js` 에 적어둔 말이 바로 그것이다(「마지막 저장이 통째로
//     사라진다. Render 는 **배포할 때마다** SIGTERM 을 보낸다」). 그 고침이
//     **되살아난 버그로 덮여 있었다**
//   · **파일에서도 옛 판이 이길 수 있다** — 비동기 쓰기가 날아가 있는데 동기로 먼저
//     쓰면 그쪽 `rename` 이 나중에 닿아 마지막 판을 덮는다(10/22 의 그 자리)
//
// ── 어떻게 보나 ──
//
// **그 자리에서 듣는 사람들을 부른다**(`process.emit('SIGTERM')`). 여기서 못 박으려는
// 것은 **차례와 나감**이다 — 누가 먼저 불리고, 누가 `process.exit()` 를 하는가.
//
// 신호를 진짜로 보내는 길은 **윈도우에서 못 쓴다**: 자식을 죽이면 신호가 안 가고
// 바로 죽으며(TerminateProcess), 제게 `process.kill(pid, 'SIGTERM')` 를 보내도
// **그 자리에서 죽는다**(흉내 내주지 않는다. 처음 판이 그래서 아무것도 못 봤다).
// 리눅스(운영)에서는 신호가 그 사람들을 부르므로, 부르는 것을 보면 그 뒤는 같다.
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

/** 꼬마 프로그램을 띄워 돌리고 찍힌 글을 돌려준다 */
function run(code, tag) {
  const file = path.join(ROOT, `.bye-${tag}.cjs`);
  const db = path.join(ROOT, `.bye-${tag}.json`);
  fs.writeFileSync(file, code.replace(/__DB__/g, JSON.stringify(db)), 'utf8');
  try {
    return execFileSync(process.execPath, [file], {
      cwd: ROOT, encoding: 'utf8',
      env: { ...process.env, DB_FILE: db, NODE_ENV: 'test' },
    }).trim();
  } catch (e) {
    return 'FAIL 터졌다: ' + String(e.stdout || e.message).slice(0, 300);
  } finally {
    for (const f of [file, db, db.replace(/\.json$/, '') + '.photos.json']) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  }
}

console.log('── 듣는 사람이 서버뿐일 때 ──');
// 서버가 제 끝내기를 들고 있으면 **db 는 흘려만 쓰고 비킨다** — 그쪽이 기다려서 끝낸다
const withServer = run(`
process.env.DB_FILE = __DB__;
require('./src/db');
let ran = false;
process.on('SIGTERM', () => { ran = true; console.log('서버끝내기:' + ran); process.exit(0); });
process.emit('SIGTERM');
setTimeout(() => { console.log('안불렸다'); process.exit(0); }, 1500);
`, 'server');
ok('**서버의 끝내기가 불린다** (db 가 앞질러 나가지 않는다)', withServer.includes('서버끝내기:true'), true, withServer);

console.log('');
console.log('── 듣는 사람이 db 뿐일 때 (자 · 도구) ──');
// 신호를 듣는 사람이 생기면 **기본 종료가 사라진다**. 그때는 db 가 나가야 한다 —
// 안 나가면 `npm run backup` 같은 도구가 Ctrl+C 에도 안 끝난다
const alone = run(`
process.env.DB_FILE = __DB__;
require('./src/db');
process.on('exit', (c) => { /* 나가는 것을 보려고 */ });
process.emit('SIGTERM');
setTimeout(() => { console.log('안나갔다'); process.exit(7); }, 1500);
`, 'alone');
ok('db 혼자면 그 자리에서 끝낸다', alone.includes('안나갔다'), false, alone || '(조용히 끝났다)');

console.log('');
console.log('── 끝내기가 마지막 쓰기를 담는가 ──');
// 신호를 받고 끝낼 때 **방금 담은 줄**이 파일에 있어야 한다
const saved = run(`
process.env.DB_FILE = __DB__;
const db = require('./src/db');
const fs = require('fs');
db.createUser('bye@test.local', 'x', '끝내기', 'bye01');
process.on('exit', () => {
  const raw = JSON.parse(fs.readFileSync(__DB__, 'utf8'));
  // 이 줄은 exit 듣는 자리의 **뒤**에 등록됐으므로 db 의 흘려쓰기가 먼저 돈다
  console.log('담긴사람:' + (raw.users || []).length);
});
process.emit('SIGTERM');
setTimeout(() => process.exit(0), 1500);
`, 'flush');
ok('신호를 받고 끝내도 담긴다', saved.includes('담긴사람:1'), true, saved);

console.log('');
console.log('── 두 자리가 다 듣고 있는가 ──');
// 글자로도 한 번 못 박는다 — 둘 중 하나가 사라지면 이 자가 보는 것이 뜻을 잃는다
const dbSrc = fs.readFileSync(path.join(ROOT, 'src', 'db.js'), 'utf8');
const idxSrc = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
ok('db 가 듣는 사람 수를 보고 나간다', /listenerCount\(sig\) <= 1/.test(dbSrc), true);
ok('서버가 기다려서 끝낸다 (`db.drain()`)', /await db\.drain\(\)/.test(idxSrc), true);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('끝내기 전부 통과');
