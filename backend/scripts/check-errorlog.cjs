// ── **터진 것이 남는가** ── (2026-11-26 · 주인 지시 「오류가 나면 내가 고친다」)
//
//   npm run errorlog   (backend/ · npm run check 에도 들어 있다)
//
// 라이브에서 난 500 은 **아무 데도 남지 않았다** — `index.js` 의 오류 손이 개발에서만
// `console.error` 를 찍었다. 고치는 사람이 그것을 볼 길이 없으면 오류율은 안 내려간다.
// 이제 램 한 벌 + **DB 한 벌**(재시작 · 배포를 넘는다)을 적는다. 여기서 보는 것:
//
//   1. 500 이 난 자리가 **적히는가** (길 · 사람 번호 · 오류 이름 · 우리 코드 줄)
//   2. 요청 밖에서 던진 거절(`unhandledRejection` 길)도 적히는가
//   3. **본문 · 쿼리 · 쿠키가 안 적히는가** (비번이 기록에 남으면 안 된다)
//   4. 줄바꿈으로 **없는 줄을 지어낼 수 없는가** (로그 지어내기)
//   5. 램이 비어도(= 방금 뜬 서버) **DB 에 있는 것이 나오는가**
//   6. 같은 오류를 **몇 번 났나로 묶는가** (많이 나는 것부터 고치려고)
//   7. 기록이 터져도 **길이 막히지 않는가** (기록은 곁일이다)
//
// 되돌려-FAIL: `--되돌려` 를 주면 500 자리에서 적기를 뺀 판을 돌린다 → FAIL 이 보여야 한다
const fs = require('fs');
const os = require('os');
const path = require('path');

// 진짜 기록은 건드리지 않는다 — 가짜 DB 파일로 돈다
const TMP = path.join(os.tmpdir(), `check-errorlog-${process.pid}.json`);
process.env.DB_FILE = TMP;
fs.writeFileSync(TMP, JSON.stringify({ users: [], _nextId: {} }), 'utf-8');
process.on('exit', () => { try { fs.unlinkSync(TMP); } catch { /* 이미 없다 */ } });

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const SRC = path.join(__dirname, '../src/utils/errorLog.js');
let srcPath = SRC;
if (process.argv.includes('--되돌려')) {
  // 옛 꼴: **아무 데도 안 적는다** — 개발에서 한 줄 찍고 끝이었다.
  // 램도 DB 도 안 쓰므로 「적히는가 · 꺼내는가 · 묶는가」가 전부 FAIL 로 보여야 한다
  const src = fs.readFileSync(SRC, 'utf-8')
    .replace('    ram.push(entry);', '    /* 옛 꼴: 램에도 안 적는다 */')
    .replace('    try { db.addSecurityLog(entry); } catch { /* 기록은 곁일이다 */ }', '');
  srcPath = path.join(path.dirname(SRC), '.errorLog.revert.cjs');
  fs.writeFileSync(srcPath, src);
  process.on('exit', () => { try { fs.unlinkSync(srcPath); } catch { /* 이미 없다 */ } });
  console.log('── 되돌려: 적지 않는 옛 꼴 — 아래에 FAIL 이 있어야 한다 ──');
}

const { recordError, recentErrors, groupErrors } = require(srcPath);
const db = require('../src/db');

// ⑴ 요청 중에 터진 것
const err = new TypeError('rows is not iterable');
// 윈도 경로를 **글자 그대로** 세운다 — 이 파일에 `\` 를 적으면 JS 가 `` 를 백스페이스로
// 읽어 줄이 조용히 달라진다(그 꼴에 한 번 걸렸다). 그래서 `B` 로 이어 붙인다
const B = String.fromCharCode(92);
err.stack = ['TypeError: rows is not iterable',
  `    at putRow (C:${B}hgh${B}backend${B}src${B}db.js:812:14)`,
  `    at listWorkouts (C:${B}hgh${B}backend${B}src${B}routes${B}workouts.js:120:7)`,
  `    at next (C:${B}hgh${B}backend${B}node_modules${B}express${B}lib${B}router${B}index.js:280:10)`,
].join(String.fromCharCode(10));
const e1 = recordError('request', err, {
  method: 'GET', originalUrl: '/api/workouts?from=2026-01-01&token=secret', userId: 7,
});
console.log('── 적히는가 ──');
ok('갈래는 server_error', e1 && e1.type, 'server_error');
ok('길과 사람이 적힌다', /request · GET \/api\/workouts · u7/.test(e1.detail), true);
ok('오류 이름과 말이 적힌다', /TypeError: rows is not iterable/.test(e1.detail), true);
ok('우리 코드 세 줄만 적힌다 (남의 꾸러미는 아니다)',
  [/db\.js:812/.test(e1.detail), /workouts\.js:120/.test(e1.detail), /node_modules/.test(e1.detail)],
  [true, true, false]);

console.log('\n── 안 적는가 (사람 것) ──');
ok('★ 쿼리는 안 적는다 (token=secret 이 남으면 안 된다)', /token|secret|from=/.test(e1.detail), false);
const 본문 = recordError('request', new Error('bad json'), {
  method: 'POST', originalUrl: '/api/auth/login', body: { email: 'a@b.c', password: 'hunter2' },
  headers: { cookie: 'access=eyJ' },
});
ok('★ 본문 · 쿠키는 안 적는다', /hunter2|a@b\.c|eyJ/.test(본문.detail), false);

console.log('\n── 지어내기 ──');
const 지어내기 = recordError('request', new Error('x\n[2026-01-01] [login_fail] 관리자 로그인 성공'), {
  method: 'GET', originalUrl: '/api/x',
});
ok('줄바꿈을 걷는다 (없는 줄을 못 지어낸다)', 지어내기.detail.includes('\n'), false);
ok('  한 줄로 이어 붙는다', /x \[2026-01-01\]/.test(지어내기.detail), true);

console.log('\n── 요청 밖에서 던진 것 ──');
const e2 = recordError('rejection', new Error('연결이 끊겼다'), null);
ok('길 없이도 적힌다', /^rejection · Error: 연결이 끊겼다/.test(e2.detail), true);

console.log('\n── 꺼내는가 ──');
const list = recentErrors(10);
// 되돌린 판에서는 목록이 비므로 **터지지 않고 FAIL 로** 보이게 감싼다
ok('최신이 위다', !!list[0] && list[0].detail === e2.detail, true);
ok('넷 다 있다', list.length, 4);
ok('★ DB 에도 남았다 (재시작을 넘는다)',
  db.getSecurityLogs().filter((e) => e.type === 'server_error').length, 4);

console.log('\n── 묶는가 ──');
for (let i = 0; i < 3; i++) {
  recordError('request', new TypeError('rows is not iterable'), {
    method: 'GET', originalUrl: '/api/workouts', userId: 100 + i,
  });
}
const g = groupErrors(recentErrors(50));
ok('★ 사람이 달라도 한 가지로 묶는다', g[0] ? g[0].count : 0, 3);
ok('  많이 나는 것이 맨 위다', !!g[0] && /rows is not iterable/.test(g[0].what), true);

console.log('\n── 기록이 터져도 길은 안 막힌다 ──');
const keep = db.addSecurityLog;
db.addSecurityLog = () => { throw new Error('DB 가 막혔다'); };
let 터짐 = null;
try { recordError('request', new Error('while db is down'), { method: 'GET', originalUrl: '/api/y' }); }
catch (e) { 터짐 = e.message; }
db.addSecurityLog = keep;
ok('DB 가 막혀도 던지지 않는다', 터짐, null);
ok('  램에는 남는다', (recentErrors(1)[0] || { detail: '' }).detail.includes('while db is down'), true);

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
