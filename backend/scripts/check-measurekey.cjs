// **내보낸 측정 · 인바디를 다시 넣어도 두 벌이 안 되고, 0 이 사라지지 않는가** (2026-11-25 · 근호).
//
//   node scripts/check-measurekey.cjs              (npm run check 에도 들어 있다 — 찾아서 돈다)
//   node scripts/check-measurekey.cjs --되돌려     옛 열쇠 · 옛 `|| null` 로 돌려 **우는지** 본다
//
// ── 무엇을 보는가 ──
//
// 1. 치수 화면은 `{ ...values, date }` 를 보내서 `data` 안에 **날짜 · 빈 칸 · 글자 숫자**가
//    담긴다. 내보내기는 날짜 · 빈 칸을 빼고 쓰고, 읽는 손은 글자 숫자를 숫자로 되돌린다.
//    그래서 **진짜 내보내기 길**(`GET /export/measures`)로 뽑은 파일을 읽어 `measureKey` 를
//    맞대면, 담긴 줄과 **같은 지문**이어야 한다 — 안 그러면 다시 넣을 때마다 두 벌이 된다
// 2. `POST /inbody` 가 체지방 0 을 **0 으로** 담는가(고치기 PUT 과 같은 값)
//
// 둘 다 **진짜 길**을 부른다 — 임시 DB 에 줄을 담고, 라우터의 손을 그대로 돌린다.
const fs = require('fs');
const path = require('path');
const os = require('os');

const REVERT = process.argv.includes('--되돌려');
const TMP = path.join(os.tmpdir(), `measurekey-${process.pid}.json`);
process.env.DB_FILE = TMP;
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('./_tmpdb.cjs')(TMP);

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// ── 되돌려: 옛 손으로 바꿔 끼운다 (파일은 안 고친다 — 사본을 부른다) ──
const SRC = path.join(__dirname, '../src');
const copies = [];
const swap = (rel, from, to) => {
  const file = path.join(SRC, rel);
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(from)) { ok(`되돌릴 자리를 찾았다 (${rel})`, false, true); return file; }
  const out = path.join(path.dirname(file), `.${path.basename(file, '.js')}.revert.js`);
  fs.writeFileSync(out, src.replace(from, to));
  copies.push(out);
  return out;
};
process.on('exit', () => { for (const f of copies) { try { fs.unlinkSync(f); } catch { /* 없어도 된다 */ } } });

const csvRowsPath = REVERT
  ? swap('utils/csvRows.js', `.filter((k) => k !== 'date' && data[k] !== null && data[k] !== undefined && data[k] !== '')
    .map((k) => \`\${k}=\${JSON.stringify(measureValue(data[k]))}\`)`,
  `.map((k) => \`\${k}=\${JSON.stringify(data[k])}\`)`)
  : path.join(SRC, 'utils/csvRows.js');
const inbodyPath = REVERT
  ? swap('routes/inbody.js', 'fat_pct ?? null,', 'fat_pct || null,')
  : path.join(SRC, 'routes/inbody.js');

const db = require('../src/db');
const { readMeasures, measureKey } = require(csvRowsPath);

// 라우터에서 그 길의 **마지막 손**(인증 · 문지기 뒤)을 꺼낸다
const handlerOf = (router, method, p) => {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  const hs = layer.route.stack;
  return hs[hs.length - 1].handle;
};
const fakeRes = () => {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.set = r.setHeader;
  return r;
};

(async () => {
  const u = db.createUser('mk@check.local', '$2a$10$abcdefghijklmnopqrstuv', '열쇠', 'mkcheck01').lastInsertRowid;

  // ── 1. 치수 — 화면이 보내는 꼴 그대로 담는다 ──
  console.log('── 내보낸 측정을 다시 읽으면 같은 지문인가 ──');
  db.createMeasure(u, 'bodySize', '2026-11-01', { chest: '100', waist: '', arm_r: '35.5', date: '2026-11-01' });
  db.createMeasure(u, 'oneRM', '2026-11-02', { exercise: '벤치프레스', weight: '80', reps: '5', orm: 93.3 });
  const stored = db.getMeasures(u);
  ok('담은 줄이 둘이다 (모집단 0 을 통과로 내보내지 않는다)', stored.length, 2);

  const exportRouter = require('../src/routes/export');
  const res = fakeRes();
  await handlerOf(exportRouter, 'get', '/measures')({ userId: u, query: {} }, res);
  const csv = String(res.body || '').replace(/^﻿/, '');
  ok('내보내기가 파일을 줬다', csv.split('\n').length > 1, true);

  const { rows, bad: badRows } = readMeasures(csv);
  ok('되읽은 줄 수가 같다', rows.length, stored.length);
  ok('되읽다 걸린 줄이 없다', badRows.length, 0);
  const have = new Set(stored.map(measureKey));
  ok('**되읽은 줄이 전부 「이미 있다」로 맞는다** (다시 넣어도 안 는다)',
    rows.map((r) => have.has(measureKey(r))), rows.map(() => true));

  // 값이 다르면 여전히 다른 줄이다 (09-18 의 교훈을 안 지운다)
  ok('값이 다른 치수는 다른 지문이다',
    measureKey({ date: '2026-11-01', type: 'bodySize', data: { chest: 100 } })
      === measureKey({ date: '2026-11-01', type: 'bodySize', data: { chest: 101 } }), false);
  ok('숫자가 아닌 글자는 글자로 둔다',
    measureKey({ date: '2026-11-02', type: 'oneRM', data: { exercise: '80kg' } })
      === measureKey({ date: '2026-11-02', type: 'oneRM', data: { exercise: 80 } }), false);

  // ── 2. 인바디 0 ──
  console.log('');
  console.log('── 인바디 0 은 값이다 ──');
  const inbodyRouter = require(inbodyPath);
  const r2 = fakeRes();
  await handlerOf(inbodyRouter, 'post', '/')({
    userId: u, body: { date: '2026-11-03', weight: 70, fat_pct: 0, muscle_kg: 30 }, ip: '127.0.0.1', get: () => '',
  }, r2);
  ok('만들기가 받았다', r2.code < 300, true);
  const ib = db.getInbody(u).find((r) => r.date === '2026-11-03');
  ok('**체지방 0 이 0 으로 담긴다** (고치기 PUT 과 같은 값)', ib ? ib.fat_pct : 'no-row', 0);
  ok('  비운 칸은 null 이다', ib ? ib.water_l : 'no-row', null);

  console.log('');
  if (bad > 0) { console.log(bad + '건 FAIL'); process.exit(1); }
  console.log('모두 통과');
  process.exit(0);
})().catch((err) => { console.error('터짐:', err); process.exit(1); });
