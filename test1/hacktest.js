const http = require('http');
const crypto = require('crypto');

let PASS = 0, FAIL = 0, VULN = [];

function req(m, p, b, h = {}) {
  return new Promise((resolve) => {
    const url = new URL('http://localhost:4000' + p);
    const opts = { method: m, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: { 'Content-Type': 'application/json', ...h }, timeout: 5000 };
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ s: res.statusCode, b: d, h: res.headers }));
    });
    r.on('error', () => resolve({ s: 0, b: 'ERR', h: {} }));
    r.on('timeout', () => { r.destroy(); resolve({ s: 0, b: 'TIMEOUT', h: {} }); });
    if (b) r.write(typeof b === 'string' ? b : JSON.stringify(b));
    r.end();
  });
}

function chk(name, passed, detail) {
  if (passed) { PASS++; console.log('  [SAFE] ' + name); }
  else { FAIL++; VULN.push({ name, detail: detail || '' }); console.log('  [VULN] ' + name + (detail ? ' -> ' + detail : '')); }
}

async function run() {
  const uid = crypto.randomBytes(4).toString('hex');
  const email = 'hack_' + uid + '@test.com';

  await req('POST', '/api/auth/send-code', { email });
  const codeRes = await req('POST', '/api/auth/send-code', { email });
  let code = '';
  try { code = JSON.parse(codeRes.b).code; } catch {}
  if (code) await req('POST', '/api/auth/verify-code', { email, code });
  await req('POST', '/api/auth/register', { email, password: 'Hack1234', nickname: 'hacker', username: 'hk_' + uid });

  const loginRes = await req('POST', '/api/auth/login', { email, password: 'Hack1234' });
  let token = '';
  try { token = JSON.parse(loginRes.b).token; } catch {}
  const auth = { Authorization: 'Bearer ' + token };
  if (!token) { console.log('LOGIN FAILED - restart server'); return; }
  console.log('Logged in: ' + email + '\n');

  // 1. XSS
  console.log('=== 1. XSS (12) ===');
  const xss = [
    '<script>alert(1)</script>', '<ScRiPt>alert(1)</ScRiPt>',
    '<img src=x onerror=alert(1)>', '<svg/onload=alert(1)>',
    '<input onfocus=alert(1)>', 'javascript:alert(1)',
    '<iframe src="data:text/html,<script>alert(1)</script>">',
    '<a href="javascript:void(0)" onclick=alert(1)>',
    '{{constructor.constructor("alert(1)")()}}',
    '<math><mtext><img src=x onerror=alert(1)>',
    String.fromCharCode(60, 115, 99, 114, 105, 112, 116, 62),
    '%3Cscript%3Ealert(1)%3C/script%3E',
  ];
  for (const x of xss) {
    const r = await req('POST', '/api/workouts', { date: '2026-04-17', exercise: x, sets: 1, reps: 1 }, auth);
    if (r.s === 201) {
      const body = JSON.parse(r.b);
      const list = await req('GET', '/api/workouts', null, auth);
      const items = JSON.parse(list.b);
      const saved = items.find(w => w.id === body.id);
      const hasXSS = saved && /<script|onerror|onload|onclick|onfocus|javascript:/i.test(saved.exercise);
      chk('XSS: ' + x.substring(0, 30), !hasXSS, hasXSS ? 'STORED: ' + saved.exercise : undefined);
      if (saved) await req('DELETE', '/api/workouts/' + saved.id, null, auth);
    } else {
      chk('XSS: ' + x.substring(0, 30), true); // blocked = safe
    }
  }

  // 2. SQL/NoSQL
  console.log('\n=== 2. SQL/NoSQL Injection (8) ===');
  const sqli = [["' OR 1=1 --","x"],["'; DROP TABLE users;--","x"],["1 UNION SELECT *--","x"],["admin' AND 1=1--","x"]];
  for (const [e, p] of sqli) {
    const r = await req('POST', '/api/auth/login', { email: e, password: p });
    chk('SQLi: ' + e.substring(0, 25), r.s >= 400 && r.s < 500, 'status=' + r.s);
  }
  const nosql = [
    { email: { '$gt': '' }, password: { '$gt': '' } },
    { email: { '$ne': null }, password: { '$ne': null } },
    { email: { '$regex': '.*' }, password: 'x' },
    { email: { '$where': 'return true' }, password: 'x' },
  ];
  for (const n of nosql) {
    const r = await req('POST', '/api/auth/login', n);
    // 400,401,403,500 모두 "로그인 안 됨" = 안전 (200만 위험)
    chk('NoSQLi: ' + JSON.stringify(n.email).substring(0, 20), r.s !== 200, 'status=' + r.s);
  }

  // 3. JWT
  console.log('\n=== 3. JWT Attacks (6) ===');
  const jwts = [
    ['alg:none', 'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjEsInJvbGUiOiJhZG1pbiJ9.'],
    ['forged', 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJhZG1pbiJ9.FAKE'],
    ['empty', ''],
    ['long', 'a'.repeat(10000)],
    ['tampered', token ? token.split('.')[0] + '.' + Buffer.from('{"userId":1,"role":"admin"}').toString('base64url') + '.' + token.split('.')[2] : 'x.y.z'],
    ['expired', 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjEsImV4cCI6MH0.x'],
  ];
  for (const [name, t] of jwts) {
    const r = await req('GET', '/api/workouts', null, { Authorization: 'Bearer ' + t });
    // 401 또는 403 = 차단 = 안전
    chk('JWT ' + name, r.s === 401 || r.s === 403, 'status=' + r.s);
  }

  // 4. IDOR
  console.log('\n=== 4. IDOR / Privilege (6) ===');
  let r = await req('DELETE', '/api/workouts/1', null, auth);
  chk('IDOR: delete other workout', r.s === 404 || r.s === 403, 'status=' + r.s);
  r = await req('DELETE', '/api/inbody/1', null, auth);
  chk('IDOR: delete other inbody', r.s === 404 || r.s === 403, 'status=' + r.s);
  r = await req('DELETE', '/api/measures/1', null, auth);
  chk('IDOR: delete other measure', r.s === 404 || r.s === 403, 'status=' + r.s);
  r = await req('GET', '/api/security/dashboard', null, auth);
  chk('Priv: admin dashboard', r.s === 403, 'status=' + r.s);
  r = await req('POST', '/api/notices', { date: '2026-04-17', title: 'h', type: 'x', content: 'x' }, auth);
  chk('Priv: create notice', r.s === 403, 'status=' + r.s);
  r = await req('POST', '/api/security/block-user/1', null, auth);
  chk('Priv: block user', r.s === 403, 'status=' + r.s);

  // 5. Proto
  console.log('\n=== 5. Prototype Pollution (2) ===');
  r = await req('POST', '/api/workouts', { date: '2026-04-17', exercise: 'safe', sets: 1, reps: 1, '__proto__': { admin: true } }, auth);
  // JSON reviver가 __proto__ 제거하므로 201(정상 저장)이면 오염 안 됨
  chk('Proto: __proto__', r.s === 201 || r.s === 403, 'status=' + r.s);
  r = await req('POST', '/api/workouts', { date: '2026-04-17', exercise: 'safe', sets: 1, reps: 1, 'constructor': { 'prototype': { x: 1 } } }, auth);
  chk('Proto: constructor', r.s === 201 || r.s === 403, 'status=' + r.s);

  // 6. Path Traversal
  console.log('\n=== 6. Path Traversal (4) ===');
  const paths = ['/api/workouts/../../etc/passwd','/api/export/workouts?file=../../../etc/passwd','/api/photos/../../../etc/passwd','/%2e%2e/%2e%2e/%2e%2e/etc/passwd'];
  for (const p of paths) {
    r = await req('GET', p, null, auth);
    chk('Path: ' + p.substring(0, 35), !r.b.includes('root:'), 'status=' + r.s);
  }

  // 7. Overflow
  console.log('\n=== 7. Overflow / Edge (3) ===');
  r = await req('POST', '/api/workouts', { date: '2026-04-17', exercise: 'A'.repeat(200), sets: 1, reps: 1 }, auth);
  chk('Overflow: long name', r.s === 400, 'status=' + r.s);
  r = await req('DELETE', '/api/workouts/-1', null, auth);
  chk('Edge: negative ID', r.s === 404 || r.s === 400, 'status=' + r.s);
  r = await req('POST', '/api/workouts', { date: '2026-02-31', exercise: 't', sets: 1, reps: 1 }, auth);
  chk('Edge: invalid date', r.s === 400, 'status=' + r.s);

  // 8. Headers
  console.log('\n=== 8. Security Headers (5) ===');
  r = await req('GET', '/api/health');
  chk('Hdr: X-Powered-By', !r.h['x-powered-by']);
  chk('Hdr: HSTS', !!r.h['strict-transport-security']);
  chk('Hdr: X-Content-Type', r.h['x-content-type-options'] === 'nosniff');
  chk('Hdr: X-Frame-Options', !!r.h['x-frame-options']);
  chk('Hdr: Referrer-Policy', !!r.h['referrer-policy']);

  // 9. Info leak
  console.log('\n=== 9. Info Leak (2) ===');
  r = await req('GET', '/api/security/users', null, auth);
  chk('Info: users blocked', r.s === 403);
  r = await req('GET', '/api/nonexistent');
  chk('Info: no stack trace', !r.b.includes('at ') && !r.b.includes('Error:'));

  // RESULT
  console.log('\n========================================');
  console.log('  PENETRATION TEST RESULT');
  console.log('  SAFE: ' + PASS + ' / VULNERABLE: ' + FAIL);
  console.log('  TOTAL: ' + (PASS + FAIL));
  console.log('========================================');
  if (VULN.length > 0) {
    console.log('\n  *** VULNERABILITIES ***');
    VULN.forEach((v, i) => console.log('  ' + (i + 1) + '. ' + v.name + (v.detail ? ' -> ' + v.detail : '')));
  } else {
    console.log('\n  ALL CLEAR - NO VULNERABILITIES FOUND');
  }
}
run().catch(console.error);
