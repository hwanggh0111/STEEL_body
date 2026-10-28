// 접속자 IP 를 **진짜 사람의 주소로 읽는가** (2026-10-15)
//
//   npm run proxy
//
// 10/14 에 배포본의 차단 목록에 `10.31.78.209` · `10.31.50.190` 이 남아 있었다.
// 사람 IP 가 아니라 **Render 내부 프록시 주소**다. `TRUST_PROXY=1` 이 홉 수로
// 세고 있었고, Render 는 XFF 끝에 내부 주소를 하나 더 붙인다.
//
// 그래서 **한 명이 차단되면 그 홉을 지나는 사람이 전부 막혔다** — 내가 점검하다
// 차단되자 다른 통신망에 있던 핸드폰까지 못 들어왔다. rate limit 도 사람별이 아니라
// 전체 한 덩어리로 걸렸다.
//
// 이 검사가 지키는 것은 셋이다 —
//   1. `TRUST_PROXY` 값이 홉 수가 아니라 **사설 범위**로 읽히는가
//   2. 실제 express 의 `req.ip` 가 위조 XFF 에도 **진짜 공인 IP** 를 주는가
//   3. 사설 주소는 차단 목록에 **못 들어가는가** (들어가면 그 자체가 잘못된 신호다)
//
// 서버를 띄우지 않는다 — 임시 express 하나를 127.0.0.1 의 빈 포트에 올려서 본다.
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { parseTrustProxy, TRUST_PRIVATE } = require('../src/config/trustProxy');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── TRUST_PROXY 값을 어떻게 읽나 ──');
ok('없으면 안 믿는다', parseTrustProxy(undefined), false);
ok('빈 값도 안 믿는다', parseTrustProxy(''), false);
ok('"0" 은 안 믿는다', parseTrustProxy('0'), false);
ok('"true" 는 안 받는다 (그게 구멍이었다)', parseTrustProxy('true'), false);
ok('"private" → 사설 범위', parseTrustProxy('private'), TRUST_PRIVATE);
ok('"auto" 도 같다', parseTrustProxy('AUTO'), TRUST_PRIVATE);
ok('숫자는 아직 받는다 (셀 수 있는 곳용)', parseTrustProxy('1'), 1);
ok('앞뒤 공백·대문자를 흘린다', parseTrustProxy('  Private '), TRUST_PRIVATE);

console.log('\n── 배포본 설정이 홉 수로 돌아가 있지 않은가 ──');
// 이 검사의 본체다. 누가 render.yaml 을 "1" 로 되돌리면 여기서 걸린다.
const yaml = fs.readFileSync(path.join(__dirname, '..', '..', 'render.yaml'), 'utf8');
const m = yaml.match(/key:\s*TRUST_PROXY\s*\n\s*value:\s*"?([^"\n]+)"?/);
ok('render.yaml 에 TRUST_PROXY 가 있다', !!m, true);
const deployed = m ? m[1].trim() : '(없음)';
ok('배포본 값이 사설 범위로 읽힌다', parseTrustProxy(deployed), TRUST_PRIVATE);
if (/^\d+$/.test(deployed)) {
  console.log('     ↑ 홉 수(' + deployed + ')로 돌아가 있다. Render 는 홉이 하나 더 있어서,');
  console.log('       이 값으로는 차단 목록에 10.31.x.x 같은 내부 주소가 다시 들어간다.');
}

console.log('\n── 사설 주소는 사람이 아니다 ──');
const guard = require('../src/middleware/aiGuard');
for (const ip of ['10.31.78.209', '192.168.0.5', '172.16.0.1', '169.254.1.1', '127.0.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.9.9.9', 'unknown']) {
  ok('사설로 본다: ' + ip, guard.isPrivateIp(ip), true);
}
for (const ip of ['203.0.113.9', '8.8.8.8', '172.32.0.1', '::ffff:203.0.113.9', '2001:4860:4860::8888']) {
  ok('공인으로 본다: ' + ip, guard.isPrivateIp(ip), false);
}

console.log('\n── 사설 주소가 차단 목록에 들어가나 ──');
// 진짜 DB 는 안 건드린다
const TMP = path.join(__dirname, '..', '.check-proxy.json');
for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
process.env.DB_FILE = TMP;
const db = require('../src/db');
// 나가는 길에 임시 DB 를 치운다 — `db.js` 의 exit 손이 되살리는 것까지 (2026-10-28)
require('./_tmpdb.cjs')(TMP);

guard.manualBlock('10.31.78.209', 60);
ok('사설 주소는 막아도 안 들어간다', db.listBlocks().some(b => b.ip === '10.31.78.209'), false);
guard.manualBlock('203.0.113.9', 60);
ok('공인 주소는 그대로 막힌다', db.listBlocks().some(b => b.ip === '203.0.113.9'), true);

// 10/14 에 남은 것처럼 파일에 이미 사설 주소가 적혀 있는 경우 —
// 서버가 뜰 때 램에 올리지 않고 파일에서도 걷어내야 한다
db.blockIp('10.31.50.190', Infinity, 4, '검사: 예전에 잘못 적힌 것');
db.flushNow();
ok('파일에는 들어 있다 (걷기 전)', db.listBlocks().some(b => b.ip === '10.31.50.190'), true);
guard.hydrateBlocks();
ok('뜰 때 램에 안 올린다', guard.getSuspiciousIPs().includes('10.31.50.190'), false);
ok('파일에서도 걷어낸다', db.listBlocks().some(b => b.ip === '10.31.50.190'), false);
ok('공인 차단은 그대로 살아 있다', guard.getSuspiciousIPs().includes('203.0.113.9'), true);

console.log('\n── 실제 express 의 req.ip ──');
const CLIENT = '203.0.113.9';
const cases = [
  ['정상 (엣지 → 내부홉)', '203.0.113.9, 10.31.78.209', CLIENT],
  ['정상 3홉 (내부홉이 하나 더)', '203.0.113.9, 10.31.78.209, 10.31.50.190', CLIENT],
  ['위조 — 클라가 XFF 를 먼저 적음', '1.2.3.4, 203.0.113.9, 10.31.78.209', CLIENT],
  ['위조 — 사설 가면', '10.9.9.9, 203.0.113.9, 10.31.78.209', CLIENT],
  ['위조 — IPv4-mapped 사설 가면', '::ffff:10.9.9.9, 203.0.113.9, 10.31.78.209', CLIENT],
  ['헤더 없이 직접 접속', null, '127.0.0.1'],
];

const app = express();
app.set('trust proxy', parseTrustProxy('private'));
app.get('/', (req, res) => res.json({ ip: req.ip }));

const srv = http.createServer(app).listen(0, '127.0.0.1', async () => {
  const port = srv.address().port;
  for (const [label, xff, want] of cases) {
    const headers = xff ? { 'x-forwarded-for': xff } : {};
    const body = await new Promise((done, fail) => {
      const r = http.get({ port, host: '127.0.0.1', path: '/', headers }, (res) => {
        let s = ''; res.on('data', (d) => (s += d)); res.on('end', () => done(s));
      });
      r.on('error', fail);
    });
    ok(label, JSON.parse(body).ip, want);
  }
  srv.close();

  for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  console.log('\n' + (bad === 0 ? '전부 통과' : bad + '건 실패'));
  process.exit(bad === 0 ? 0 : 1);
});
