// 보안 기록이 **서버를 다시 띄워도 남는가** (2026-10-02).
//
//   npm run logfile
//
// `/security/logs` 는 램에 든 목록만 돌려줬다. 그 목록은 서버가 다시 뜨면 사라진다 —
// 배포하면 Render 무료 판은 **조용하면 잠들었다 깨므로** 관리자가 들어갈 때마다
// 「기록이 없습니다」를 보게 된다. 파일에는 처음부터 다 남고 있었는데 **읽는 데가
// 없었다.**
//
// 눈으로 보려면 **관리자로 로그인해서** 화면을 열어야 하고, 「재시작을 넘겼는가」를
// 보려면 서버를 내렸다 올려야 한다. 그래서 길을 세워 직접 쳐본다 —
// **자물쇠만 가짜로** 세운다(`check-oauth` 가 구글을 그렇게 한다). 나머지는 진짜 코드다.
//
// 여기서 보는 것:
//   1. 램이 비어 있어도(= 방금 뜬 서버) **파일에 있는 것이 나오는가**
//   2. 민 뒤의 옛 한 벌(`.1`)까지 같이 읽는가
//   3. 파일에도 있고 램에도 있는 줄이 **두 번 안 나오는가**
//   4. 최신이 위인가, 100건에서 멈추는가
//   5. 모양이 깨진 줄에 걸려 **통째로 비는 일이 없는가**
//   6. 파일이 아예 없어도 안 터지는가

const path = require('path');
const fs = require('fs');
const os = require('os');

// 진짜 기록은 건드리지 않는다
const TMP_LOG = path.join(os.tmpdir(), `check-logfile-${process.pid}.log`);
process.env.SECURITY_LOG_PATH = TMP_LOG;
process.env.DB_FILE = path.join(os.tmpdir(), `check-logfile-${process.pid}.json`);
fs.writeFileSync(process.env.DB_FILE, JSON.stringify({ users: [], _nextId: {} }), 'utf-8');
process.env.JWT_SECRET = 'check-secret-check-secret-check-secret';
process.env.NODE_ENV = 'development';

// ── 자물쇠를 가짜로 세운다 ──
//
// `adminAuth` 는 관리자 토큰을 본다. 그 토큰을 만들려면 관리자 계정이 있어야 하고,
// 그러면 이 검사가 **보려는 것과 상관없는 것**을 한 무더기 세워야 한다.
// 자물쇠만 통과시키고 **읽는 자리는 진짜 코드**로 돌린다.
const authPath = require.resolve('../src/middleware/adminAuth');
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true, children: [], paths: [],
  exports: (req, res, next) => next(),
};

const express = require('express');
const http = require('http');
const security = require('../src/routes/security');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' -> ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const app = express();
app.use(express.json());
app.use('/api/security', security);
const server = app.listen(0, run);

function get(p) {
  return new Promise((resolve, reject) => {
    const req = http.get({ port: server.address().port, path: p }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch (e) { /* 글이면 null */ }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
  });
}

// `addLog` 가 적는 모양 그대로
const line = (iso, type, detail) => `[${iso}] [${type}] ${detail}\n`;
const at = (n) => new Date(Date.UTC(2026, 9, 2, 0, 0, n)).toISOString();

const logs = () => get('/api/security/logs');

async function run() {
  try {
    console.log('── 파일이 없어도 안 터진다 ──');
    //
    // 처음 띄운 서버에는 파일이 없다. 여기서 터지면 관리자 화면이 **통째로** 안 열린다
    try { fs.unlinkSync(TMP_LOG); } catch (e) { /* 없으면 그만 */ }
    const empty = await logs();
    ok('빈 목록을 돌려준다', empty.status, 200);
    ok('  배열이다 (화면이 배열로 받는다)', Array.isArray(empty.body), true);
    ok('  0건', empty.body.length, 0);

    console.log('');
    console.log('── 램이 비어 있어도 파일에 있는 것이 나온다 ──');
    //
    // 이것이 이 작업의 요점이다. 이 검사는 **서버를 방금 띄운 상태**(램이 비었다)라,
    // 나오는 것은 전부 파일에서 읽은 것이다
    fs.writeFileSync(TMP_LOG,
      line(at(1), 'login_fail', '아이디 틀림 ip=1.1.1.1')
      + line(at(2), 'register', 'New user: a@b.c (abc)')
      + line(at(3), 'username_change', 'Username: old -> new (id=1)'), 'utf-8');
    const three = await logs();
    ok('세 건이 나온다', three.body.length, 3);
    ok('  최신이 위다', three.body.map((e) => e.type), ['username_change', 'register', 'login_fail']);
    ok('  종류를 그대로 읽는다', three.body[2].type, 'login_fail');
    ok('  내용을 그대로 읽는다', three.body[1].detail, 'New user: a@b.c (abc)');
    ok('  적힌 때를 그대로 읽는다', three.body[0].timestamp, at(3));

    console.log('');
    console.log('── 민 뒤의 옛 한 벌까지 읽는다 ──');
    //
    // 2MB 를 넘기면 한 벌을 `.1` 로 밀고 새로 쓴다. 그 직후에는 **지금 파일이 거의
    // 비어 있다** — `.1` 을 안 읽으면 관리자 화면이 갑자기 텅 빈다
    fs.writeFileSync(TMP_LOG + '.1', line(at(0), 'system', '옛 한 벌에 있던 줄'), 'utf-8');
    const rolled = await logs();
    ok('네 건이 된다', rolled.body.length, 4);
    ok('  옛 줄이 **맨 아래**다 (가장 오래됐다)', rolled.body[3].detail, '옛 한 벌에 있던 줄');

    console.log('');
    console.log('── 모양이 깨진 줄에 걸려 통째로 비지 않는다 ──');
    //
    // detail 에 줄바꿈이 섞이면 뒷줄은 모양이 안 맞는다. 그 줄만 버리고 나머지는 보여준다
    fs.appendFileSync(TMP_LOG, '이건 모양이 아닌 줄\n[깨진] 꼴\n'
      + line(at(4), 'block', '유저 차단: id=9'), 'utf-8');
    const broken = await logs();
    ok('깨진 줄은 빼고 센다', broken.body.length, 5);
    ok('  그 뒤의 멀쩡한 줄도 나온다', broken.body[0].detail, '유저 차단: id=9');

    console.log('');
    console.log('── 같은 줄이 두 번 나오지 않는다 ──');
    //
    // 모든 `addLog` 는 램과 파일 **둘 다**에 쓴다. 합치기만 하면 전부 두 벌이 된다.
    // 여기서는 램에 든 것과 **똑같은 줄**을 파일에 한 번 더 넣어 그 자리를 본다
    const before = (await logs()).body.length;
    fs.appendFileSync(TMP_LOG, line(at(4), 'block', '유저 차단: id=9'), 'utf-8');
    const dup = await logs();
    ok('두 번 적혀 있어도 한 줄', dup.body.length, before);

    console.log('');
    console.log('── 100건에서 멈춘다 ──');
    //
    // 화면이 백 줄 넘게 받아도 읽지 않는다. 그리고 **적힌 때로 세워 보내므로**
    // 아무 백 건이 아니라 **최신 백 건**이어야 한다
    let many = '';
    for (let i = 0; i < 300; i++) many += line(new Date(Date.UTC(2026, 9, 3, 0, 0, i)).toISOString(), 'login_success', `n=${i}`);
    fs.appendFileSync(TMP_LOG, many, 'utf-8');
    const capped = await logs();
    ok('백 건까지만 준다', capped.body.length, 100);
    ok('  최신 백 건이다 (맨 위가 마지막 줄)', capped.body[0].detail, 'n=299');
    ok('  맨 아래가 200번째다', capped.body[99].detail, 'n=200');
    ok('  차례가 내려간다', capped.body.every((e, i, a) => i === 0 || a[i - 1].timestamp >= e.timestamp), true);
  } catch (err) {
    bad += 1;
    console.log('FAIL 검사가 도중에 터졌다 -> ' + err.message);
  } finally {
    server.close();
    for (const f of [TMP_LOG, TMP_LOG + '.1', process.env.DB_FILE]) {
      try { fs.unlinkSync(f); } catch (e) { /* 이미 없으면 그만 */ }
    }
    console.log('');
    console.log(bad ? bad + '건 실패' : '전부 통과');
    setTimeout(() => process.exit(bad ? 1 : 0), 300);
  }
}
