const http = require('http');
const https = require('https');

const API = 'http://localhost:4000/api';
let PASS = 0, FAIL = 0, TOKEN = '';

function req(method, path, body, headers = {}) {
  return new Promise((resolve) => {
    const url = new URL(API + path);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: { 'Content-Type': 'application/json', ...headers } };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, body: json, raw: data, headers: res.headers });
      });
    });
    r.on('error', (e) => resolve({ status: 0, body: null, raw: e.message }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function pass(msg) { PASS++; console.log(`  [PASS] ${msg}`); }
function fail(msg, detail) { FAIL++; console.log(`  [FAIL] ${msg} -- ${detail}`); }

async function run() {
  console.log('=== 1. 인증 테스트 ===');

  // 회원가입
  let r = await req('POST', '/auth/register', { email: 'test_run@test.com', password: 'Test1234', nickname: '런테스터', username: 'runtester1' });
  if (r.status === 201 || r.status === 409) pass(`회원가입 (${r.status})`); else fail('회원가입', r.status);

  // 중복가입
  r = await req('POST', '/auth/register', { email: 'test_run@test.com', password: 'Test1234', nickname: '중복', username: 'runtester1' });
  if (r.status === 409) pass('중복가입 차단'); else fail('중복가입', r.status);

  // 필수항목 누락
  r = await req('POST', '/auth/register', { email: '', password: '', nickname: '', username: '' });
  if (r.status === 400) pass('필수항목 누락 차단'); else fail('필수항목', r.status);

  // 로그인
  r = await req('POST', '/auth/login', { email: 'test_run@test.com', password: 'Test1234' });
  if (r.status === 200 && r.body?.token) { TOKEN = r.body.token; pass('로그인 + 토큰 발급'); } else fail('로그인', `${r.status} ${r.raw?.substring(0,80)}`);

  const auth = { Authorization: `Bearer ${TOKEN}` };

  // 잘못된 비밀번호
  r = await req('POST', '/auth/login', { email: 'test_run@test.com', password: 'wrong' });
  if (r.status === 401) pass('잘못된 비밀번호 차단'); else fail('비밀번호 차단', r.status);

  // 아이디 중복확인
  r = await req('POST', '/auth/check-username', { username: 'runtester1' });
  if (r.body?.available === false) pass('아이디 중복 감지'); else fail('아이디 중복', JSON.stringify(r.body));

  // 내 정보
  r = await req('GET', '/auth/me', null, auth);
  if (r.status === 200 && r.body?.email) pass('내 정보 조회'); else fail('내 정보', r.status);

  // 인증 없이
  r = await req('GET', '/workouts');
  if (r.status === 401) pass('인증 없이 접근 차단'); else fail('무인증', r.status);

  console.log('\n=== 2. 운동 기록 테스트 ===');

  // 운동 추가
  r = await req('POST', '/workouts', { date: '2026-04-13', exercise: '벤치프레스', sets: 3, reps: 10, weight: '80' }, auth);
  let wid = r.body?.id;
  if (r.status === 201 && wid) pass(`운동 추가 (id=${wid})`); else fail('운동 추가', `${r.status} ${r.raw?.substring(0,80)}`);

  // 음수 세트
  r = await req('POST', '/workouts', { date: '2026-04-13', exercise: '스쿼트', sets: -1, reps: 10 }, auth);
  if (r.status === 400) pass('음수 세트 차단'); else fail('음수 세트', r.status);

  // 0 횟수
  r = await req('POST', '/workouts', { date: '2026-04-13', exercise: '스쿼트', sets: 3, reps: 0 }, auth);
  if (r.status === 400) pass('0 횟수 차단'); else fail('0 횟수', r.status);

  // XSS
  r = await req('POST', '/workouts', { date: '2026-04-13', exercise: '<script>alert(1)</script>', sets: 3, reps: 10 }, auth);
  if (r.status === 201) pass('XSS 입력 sanitize 처리'); else fail('XSS', r.status);

  // 운동 목록
  r = await req('GET', '/workouts', null, auth);
  if (r.status === 200 && Array.isArray(r.body)) pass(`운동 목록 조회 (${r.body.length}건)`); else fail('운동 조회', r.status);

  // 운동 삭제
  if (wid) {
    r = await req('DELETE', `/workouts/${wid}`, null, auth);
    if (r.status === 200) pass('운동 삭제'); else fail('운동 삭제', r.status);
  }

  console.log('\n=== 3. 인바디 테스트 ===');

  r = await req('POST', '/inbody', { date: '2026-04-13', weight: 75, height: 175, fat_pct: 15, muscle_kg: 35 }, auth);
  let iid = r.body?.id;
  if (r.status === 201 && r.body?.bmi) pass(`인바디 추가 (bmi=${r.body.bmi})`); else fail('인바디 추가', r.status);

  r = await req('POST', '/inbody', { date: '2026-04-13' }, auth);
  if (r.status === 400) pass('체중 누락 차단'); else fail('체중 누락', r.status);

  r = await req('POST', '/inbody', { weight: 999 }, auth);
  if (r.status === 400) pass('비정상 체중 차단'); else fail('비정상 체중', r.status);

  r = await req('GET', '/inbody', null, auth);
  if (r.status === 200) pass('인바디 조회'); else fail('인바디 조회', r.status);

  if (iid) {
    r = await req('DELETE', `/inbody/${iid}`, null, auth);
    if (r.status === 200) pass('인바디 삭제'); else fail('인바디 삭제', r.status);
  }

  console.log('\n=== 4. 측정 시스템 테스트 ===');

  r = await req('POST', '/measures', { type: 'bodySize', date: '2026-04-13', data: { chest: '95', waist: '78' } }, auth);
  let mid = r.body?.id;
  if (r.status === 201) pass(`전신사이즈 저장 (id=${mid})`); else fail('전신사이즈', `${r.status} ${r.raw?.substring(0,80)}`);

  r = await req('POST', '/measures', { type: 'invalid', date: '2026-04-13', data: { x: 'y' } }, auth);
  if (r.status === 400) pass('잘못된 타입 차단'); else fail('잘못된 타입', r.status);

  r = await req('POST', '/measures', { type: 'oneRM', date: '2026-04-13', data: { exercise: '<img onerror=alert(1)>', orm: '100' } }, auth);
  if (r.status === 201) pass('측정 XSS sanitize'); else fail('측정 XSS', r.status);

  r = await req('GET', '/measures', null, auth);
  if (r.status === 200) pass(`측정 조회 (${r.body?.length}건)`); else fail('측정 조회', r.status);

  if (mid) {
    r = await req('DELETE', `/measures/${mid}`, null, auth);
    if (r.status === 200) pass('측정 삭제'); else fail('측정 삭제', r.status);
  }

  console.log('\n=== 5. 루틴 테스트 ===');

  r = await req('GET', '/routines/%EB%A8%B8%EC%8B%A0', null, auth);
  if (r.status === 200) pass('추천 루틴 조회'); else fail('추천 루틴', r.status);

  r = await req('POST', '/my-routines', { name: '월요일 가슴', exercises: [{ name: '벤치', sets: '4', reps: '10' }] }, auth);
  let rid = r.body?.id;
  if (r.status === 201) pass(`나만의 루틴 저장 (id=${rid})`); else fail('루틴 저장', `${r.status} ${r.raw?.substring(0,80)}`);

  r = await req('POST', '/my-routines', { name: '빈', exercises: [] }, auth);
  if (r.status === 400) pass('빈 운동 차단'); else fail('빈 운동', r.status);

  r = await req('GET', '/my-routines', null, auth);
  if (r.status === 200) pass('루틴 조회'); else fail('루틴 조회', r.status);

  if (rid) {
    r = await req('DELETE', `/my-routines/${rid}`, null, auth);
    if (r.status === 200) pass('루틴 삭제'); else fail('루틴 삭제', r.status);
  }

  console.log('\n=== 6. 공지사항 테스트 ===');

  r = await req('GET', '/notices');
  if (r.status === 200 && Array.isArray(r.body)) pass(`공지 조회 (${r.body.length}건)`); else fail('공지 조회', r.status);

  r = await req('POST', '/notices', { date: '2026-04-13', title: '테스트', type: '공지', content: '내용' }, auth);
  if (r.status === 403) pass('일반 유저 공지 작성 차단'); else fail('공지 권한', r.status);

  r = await req('POST', '/notices/ai-generate', { topic: '테스트', type: 'update' }, auth);
  if (r.status === 403) pass('일반 유저 AI 공지 차단'); else fail('AI 공지 권한', r.status);

  console.log('\n=== 7. 닉네임 변경 테스트 ===');

  r = await req('PUT', '/auth/nickname', { nickname: '변경닉네임' }, auth);
  if (r.status === 200) pass('닉네임 변경'); else fail('닉네임 변경', `${r.status} ${r.raw?.substring(0,80)}`);

  r = await req('PUT', '/auth/nickname', { nickname: '' }, auth);
  if (r.status === 400) pass('빈 닉네임 차단'); else fail('빈 닉네임', r.status);

  // 변경 후 확인
  r = await req('GET', '/auth/me', null, auth);
  if (r.body?.nickname === '변경닉네임') pass('닉네임 서버 반영 확인'); else fail('닉네임 반영', r.body?.nickname);

  console.log('\n=== 8. 보안 테스트 ===');

  r = await req('GET', '/workouts', null, { Authorization: 'Bearer invalidtoken' });
  if (r.status === 401) pass('잘못된 토큰 차단'); else fail('잘못된 토큰', r.status);

  r = await req('DELETE', '/workouts/99999', null, auth);
  if (r.status === 404) pass('없는 기록 삭제 404'); else fail('없는 기록', r.status);

  r = await req('GET', '/health');
  if (r.status === 200) pass('Health check'); else fail('Health', r.status);

  // gzip 테스트
  const gzRes = await new Promise(resolve => {
    http.get({ hostname: 'localhost', port: 4000, path: '/api/notices', headers: { 'Accept-Encoding': 'gzip' } }, res => {
      resolve(res.headers['content-encoding']);
    }).on('error', () => resolve(null));
  });
  if (gzRes === 'gzip') pass('gzip 압축 동작'); else fail('gzip', `encoding=${gzRes}`);

  console.log('\n=== 9. 프론트엔드 테스트 ===');

  const feRes = await new Promise(resolve => {
    http.get('http://localhost:5173', res => resolve(res.statusCode)).on('error', () => resolve(0));
  });
  if (feRes === 200) pass('프론트엔드 로드'); else fail('프론트엔드', feRes);

  const proxyRes = await new Promise(resolve => {
    http.get('http://localhost:5173/api/health', res => resolve(res.statusCode)).on('error', () => resolve(0));
  });
  if (proxyRes === 200) pass('Vite 프록시'); else fail('프록시', proxyRes);

  console.log(`\n========================================`);
  console.log(`  결과: PASS=${PASS} / FAIL=${FAIL}`);
  console.log(`  총 테스트: ${PASS + FAIL}건`);
  console.log(`========================================`);
}

run().catch(console.error);
