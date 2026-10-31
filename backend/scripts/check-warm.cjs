// **서버가 잠들지 않게 두드리는 것**이 맞게 도는가 (2026-10-16)
//
//   npm run warm      (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 이것은 **틀려도 아무 일도 안 일어나는 자리**다. 주소를 잘못 짚거나 시간대를 잘못
// 읽으면 두드리지 않을 뿐이고, 화면에는 아무 표시가 없다 — 몇 주 뒤에 「왜 아직
// 22초나 기다려?」로 돌아온다. 반대로 **꺼야 할 때 안 꺼지면** 무료 한 달치
// 인스턴스 시간(750시간)을 다 쓴다.
//
// 그래서 값으로 본다 —
//   1. 내 컴퓨터에서는 **안 돈다** (localhost 를 두드릴 일이 없다)
//   2. `KEEP_WARM=0` 으로 **꺼진다**
//   3. 시간대(`KEEP_WARM_HOURS`)를 **서울 시각으로** 읽는다 — 서버는 UTC 로 돈다
//   4. 자정을 넘는 시간대(`22-6`)도 읽는다
//   5. 못 읽을 값이 와도 **조용히 멈추지 않는다** (늘 깨우는 쪽으로 넘어간다)
let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const warm = require('../src/utils/keepWarm');

// 환경값을 만졌다 되돌린다 — 다른 검사가 뒤에 돌 수 있다
const KEEP = ['BACKEND_URL', 'FRONTEND_URL', 'KEEP_WARM', 'KEEP_WARM_HOURS'];
const saved = {};
KEEP.forEach((k) => { saved[k] = process.env[k]; });
const set = (obj) => {
  KEEP.forEach((k) => { delete process.env[k]; });
  Object.entries(obj).forEach(([k, v]) => { process.env[k] = v; });
};

console.log('── 1. 어디를 두드리나 ──');
set({ BACKEND_URL: 'https://steel-body.onrender.com' });
ok('배포 주소의 헬스체크', warm.target(), 'https://steel-body.onrender.com/api/health');
set({ BACKEND_URL: 'https://steel-body.onrender.com/' });
ok('  끝의 / 를 겹치지 않는다', warm.target(), 'https://steel-body.onrender.com/api/health');
set({ FRONTEND_URL: 'https://steel-body.onrender.com' });
ok('BACKEND_URL 이 없으면 FRONTEND_URL', warm.target(), 'https://steel-body.onrender.com/api/health');

console.log('');
console.log('── 2. 내 컴퓨터에서는 안 돈다 ──');
set({ BACKEND_URL: 'http://localhost:4000' });
ok('localhost 는 두드리지 않는다', warm.target(), null);
set({ BACKEND_URL: 'http://127.0.0.1:4000' });
ok('  127.0.0.1 도', warm.target(), null);
set({});
ok('주소가 아예 없으면', warm.target(), null);
set({ BACKEND_URL: 'steel-body.onrender.com' });
ok('  http(s) 가 아니면', warm.target(), null);

console.log('');
console.log('── 3. 시간대는 서울 시각으로 읽는다 ──');
// 2026-10-16 03:00 UTC = 서울 12:00
const noonSeoul = new Date('2026-10-16T03:00:00Z');
// 2026-10-16 20:00 UTC = 서울 다음날 05:00
const dawnSeoul = new Date('2026-10-16T20:00:00Z');
set({ BACKEND_URL: 'https://x.onrender.com', KEEP_WARM_HOURS: '6-24' });
ok('06~24시 — 서울 낮 12시는 깨운다', warm.withinHours(noonSeoul), true);
ok('  서울 새벽 5시는 잔다', warm.withinHours(dawnSeoul), false);
set({ BACKEND_URL: 'https://x.onrender.com', KEEP_WARM_HOURS: '22-6' });
ok('22~6시 (자정을 넘는다) — 새벽 5시는 깨운다', warm.withinHours(dawnSeoul), true);
ok('  낮 12시는 잔다', warm.withinHours(noonSeoul), false);
set({ BACKEND_URL: 'https://x.onrender.com' });
ok('안 적으면 하루 내내', warm.withinHours(noonSeoul) && warm.withinHours(dawnSeoul), true);
set({ BACKEND_URL: 'https://x.onrender.com', KEEP_WARM_HOURS: '아무거나' });
ok('못 읽을 값이면 늘 깨운다 (조용히 멈추지 않는다)', warm.withinHours(dawnSeoul), true);

console.log('');
console.log('── 4. 꺼지는가 · 서버를 붙잡지 않는가 ──');
set({ BACKEND_URL: 'https://x.onrender.com', KEEP_WARM: '0' });
warm.start();
ok('KEEP_WARM=0 이면 안 뜬다', warm.isRunning(), false);
set({ BACKEND_URL: 'http://localhost:4000' });
warm.start();
ok('localhost 에서도 안 뜬다', warm.isRunning(), false);
set({ BACKEND_URL: 'https://x.onrender.com' });
warm.start();
ok('배포 주소면 뜬다', warm.isRunning(), true);
// **서버가 이것 때문에 안 꺼지면 안 된다** (운동 알림 스케줄러와 같은 규칙).
// unref 를 빠뜨리면 node 가 이 타이머를 붙잡아 **이 검사부터 안 끝난다**
ok('  타이머가 서버를 붙잡지 않는다 (unref)', process._getActiveHandles().some((h) => h && h.hasRef && h.hasRef() && h.constructor && h.constructor.name === 'Timeout'), false);
warm.start();
ok('  두 번 불러도 하나다', warm.isRunning(), true);
warm.stop();
ok('멈춘다', warm.isRunning(), false);

// 15분 안에 한 번은 닿아야 잠들지 않는다 — 1분 여유
ok('두드리는 간격이 15분 미만', warm.TICK_MS < 15 * 60 * 1000, true);

KEEP.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });

console.log('');
// ── **밖에서 볼 수 있는가** ── (2026-10-31)
//
// 이 자가 돌고 있는지 **아무 데도 안 보였다.** `BACKEND_URL` 이 빠지거나
// `KEEP_WARM=0` 이 되면 조용히 멈추고, 그 뒤 처음 여는 사람만 22초를 기다린다 —
// 아무도 모르는 채로. 오늘 하루 고친 것이 전부 그 모양이었다
// (**기능이 조용히 없는 것이 된다**).
//
// 그래서 **관리자가 보는 자리**(보안 현황)에 적는다. 서버가 보내고 화면이 그린다
console.log('');
console.log('── 밖에서 볼 수 있는가 ──');
{
  const fs2 = require('fs');
  const path2 = require('path');
  const route = fs2.readFileSync(path2.join(__dirname, '..', 'src', 'routes', 'security.js'), 'utf8');
  ok('보안 현황이 깨워두기를 보낸다', /keepWarm: \{/.test(route), true);
  ok('  돌고 있나', /running: keepWarm\.isRunning\(\)/.test(route), true);
  ok('  어디를 두드리나', /target: keepWarm\.target\(\)/.test(route), true);
  // **꺼져 있으면 왜인지 적는다** — 「꺼짐」만 보면 고칠 데를 모른다
  ok('  꺼진 까닭도 보낸다', /KEEP_WARM=0 으로 꺼뒀습니다/.test(route) && /BACKEND_URL 이 없거나/.test(route), true);
  const panel = fs2.readFileSync(path2.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'SecurityPanel.jsx'), 'utf8');
  ok('화면이 그것을 그린다', /keepWarm\.running/.test(panel), true);
  // **안 받아온 것과 꺼진 것은 다르다** — 옛 서버는 이 칸을 안 보낸다
  ok('  안 보내면 칸을 안 그린다', /\{keepWarm && \(/.test(panel), true);
}
console.log(bad === 0 ? '모두 통과' : bad + '곳 어긋남');
process.exit(bad === 0 ? 0 : 1);
