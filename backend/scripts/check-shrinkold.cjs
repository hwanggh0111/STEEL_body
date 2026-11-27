// ── **옛 사진 줄이는 일꾼이 사람 기록을 안 잃는가** ── (2026-11-26 · 주인 지시)
//
//   npm run shrinkold   (backend/ · npm run check 에도 들어 있다)
//
// `580ee55` 로 **앞으로 올라오는** 사진은 담아둘 선(500KB) 안으로 줄인다. 이미 올라간
// 것은 그대로라서 한 번 돌리는 일꾼을 만들었다(`shrink-photos.cjs`). 그 일꾼은
// **사람 사진을 덮어쓴다** — 그래서 자가 먼저 선다.
//
// 여기서 보는 것 (진짜 일꾼을 딴 프로세스로 돌려서 본다):
//
//   1. **기본은 한 줄도 안 바꾼다** (`--진짜로` 가 없으면 재기만) ★
//   2. `--진짜로` 면 줄여 담는다 — 담아둘 선 안으로 · 긴 변도 1280 안으로
//   3. **되돌릴 파일을 먼저 쓴다** · 그 파일로 **원본이 그대로 돌아온다** ★
//   4. **작은 것은 건드리지 않는다** (다시 구우면 화질만 손해다)
//   5. **못 읽는 그림은 그 장만 건너뛴다** — 통째로 멎지 않는다
//   6. 담은 뒤 **판 번호가 올라간다** (안 올리면 기기가 옛 사진을 계속 본다)
//   7. 프로필은 **256px 자**로 줄인다
//
// 되돌려-FAIL: `--되돌려` 를 주면 판단을 **거절하는 선(2MB)** 으로 돌린다(고치기 전 꼴)
// → 「줄일 것 0장」이 되어 FAIL 이 보여야 한다
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const 일꾼 = path.join(__dirname, 'shrink-photos.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

let sharp;
try {
  sharp = require(require.resolve('sharp', { paths: [path.join(ROOT, 'frontend/node_modules')] }));
} catch {
  console.log('건너뜀: sharp 가 없다 (frontend 쪽 꾸러미를 빌린다 — `cd frontend && npm install`)');
  process.exit(0);
}

// ── 되돌려: 판단을 옛 선으로 ────────────────────────────────────────────────
const 되돌림 = process.argv.includes('--되돌려');
let 돌릴일꾼 = 일꾼;
const 치울것 = [];
if (되돌림) {
  const src = fs.readFileSync(일꾼, 'utf-8')
    .replace('const 줄여야 = 전 > 선.TARGET || 긴변 > maxEdge;',
      'const 줄여야 = 전 > 선.MAX;');          // 옛 꼴: 거절하는 선까지 그냥 둔다
  돌릴일꾼 = path.join(__dirname, `.shrink-photos.revert.${process.pid}.cjs`);
  fs.writeFileSync(돌릴일꾼, src, 'utf-8');
  치울것.push(돌릴일꾼);
  console.log('── 되돌려: 판단을 거절하는 선(2MB)으로 — 아래에 FAIL 이 있어야 한다 ──');
}
process.on('exit', () => { for (const f of 치울것) { try { fs.unlinkSync(f); } catch { /* 없다 */ } } });

// ── 가짜 판을 세운다 ───────────────────────────────────────────────────────
const 때 = `${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
const DB = path.join(os.tmpdir(), `check-shrinkold-${때}.json`);
const PHOTOS = DB.replace(/\.json$/, '') + '.photos.json';
치울것.push(DB, PHOTOS);

/** 큰 그림 하나 — 잡음이라 잘 안 눌린다(진짜 사진에 가깝다) */
async function 큰그림(w, h) {
  const px = Buffer.alloc(w * h * 3);
  for (let i = 0; i < px.length; i += 1) px[i] = (i * 2654435761) % 256;
  const buf = await sharp(px, { raw: { width: w, height: h, channels: 3 } })
    .jpeg({ quality: 95 }).toBuffer();
  return 'data:image/jpeg;base64,' + buf.toString('base64');
}
async function 작은그림(w) {
  const buf = await sharp({ create: { width: w, height: w, channels: 3, background: '#223344' } })
    .jpeg({ quality: 80 }).toBuffer();
  return 'data:image/jpeg;base64,' + buf.toString('base64');
}

const 돌린다 = (args) => {
  try {
    return execFileSync(process.execPath, [돌릴일꾼, ...args], {
      cwd: path.join(ROOT, 'backend'), encoding: 'utf-8', timeout: 300000,
      env: Object.assign({}, process.env, { DB_FILE: DB, DATABASE_URL: '' }),
    });
  } catch (err) {
    return String(err.stdout || '') + String(err.stderr || '') + '\n[터짐]';
  }
};
const 판읽기 = () => JSON.parse(fs.readFileSync(PHOTOS, 'utf-8'));
const 사진 = (type) => 판읽기().photos.find((p) => p.type === type);

(async () => {
  const 큰것 = await 큰그림(3000, 2000);        // 아주 크다 (옛 꼴도 이건 줄였다)
  const 프로필큰것 = await 큰그림(1200, 1200);
  const 작은것 = await 작은그림(600);           // 아주 작다
  // ★ **이 고침의 핵이 되는 구간** — 담아둘 선(500KB)보다 크고 **거절하는 선(2MB)보다
  // 작다.** 옛 꼴은 이걸 「한도 안이니 그냥 둔다」로 넘겼다. 사람들 사진 대부분이 여기다
  const 중간것 = await 큰그림(1400, 1000);
  fs.writeFileSync(DB, JSON.stringify({
    users: [{ id: 7, email: 'a@b.c', password: 'x', role: 'user' }], _nextId: { users: 8 },
  }), 'utf-8');
  fs.writeFileSync(PHOTOS, JSON.stringify({
    _nextId: 4,
    photos: [
      { id: 1, user_id: 7, type: 'before', data: 큰것, created_at: 'x', updated_at: 'x' },
      { id: 2, user_id: 7, type: 'profile', data: 프로필큰것, created_at: 'x', updated_at: 'x' },
      { id: 3, user_id: 7, type: 'after', data: 작은것, created_at: 'x', updated_at: 'x' },
      { id: 4, user_id: 7, type: 'band', data: 중간것, created_at: 'x', updated_at: 'x' },
    ],
    vers: {},
  }), 'utf-8');

  const 처음 = {
    before: 사진('before').data.length,
    profile: 사진('profile').data.length,
    after: 사진('after').data.length,
    band: 사진('band').data.length,
  };
  // 세운 판이 **정말 그 구간인가** — 아니면 이 자가 엉뚱한 것을 보고 통과한다
  ok('세운 중간 사진이 500KB~2MB 사이다 (이 고침의 핵이다)',
    [처음.band > 500 * 1024, 처음.band < 2 * 1024 * 1024], [true, true]);
  console.log(`── 세운 판: before ${Math.round(처음.before / 1024)}KB`
    + ` · profile ${Math.round(처음.profile / 1024)}KB · after ${Math.round(처음.after / 1024)}KB ──`);

  // ── ⑴ 기본은 안 바꾼다 ─────────────────────────────────────────────────
  console.log('\n── ⑴ 기본은 한 줄도 안 바꾼다 ──');
  const 잰것 = 돌린다([]);
  ok('재기만 한다고 말한다', /재기만 한다/.test(잰것), true);
  ok('★ 사진이 그대로다', {
    before: 사진('before').data.length, profile: 사진('profile').data.length,
  }, { before: 처음.before, profile: 처음.profile });
  ok('  줄일 것이 있다고는 말한다', /줄일 것 [1-9]/.test(잰것), true);
  ok('  되돌릴 파일을 만들지 않았다',
    fs.readdirSync(path.join(ROOT, 'backend')).filter((f) => /^photo-backup-/.test(f)).length, 0);

  // ── ⑵⑶⑹⑺ 진짜로 ───────────────────────────────────────────────────────
  console.log('\n── ⑵ 진짜로 담는다 ──');
  const 담은것 = 돌린다(['--진짜로']);
  const 되돌릴것 = fs.readdirSync(path.join(ROOT, 'backend')).filter((f) => /^photo-backup-/.test(f));
  for (const f of 되돌릴것) 치울것.push(path.join(ROOT, 'backend', f));
  ok('★ 되돌릴 파일을 먼저 썼다', 되돌릴것.length, 1);
  ok('  그 길을 화면에 적어준다', /되돌리려면/.test(담은것), true);

  const 선 = (() => {
    const 글 = fs.readFileSync(path.join(ROOT, 'frontend/src/data/photoLimit.js'), 'utf-8');
    // eslint-disable-next-line no-new-func
    return new Function('return (' + 글.match(/PHOTO_TARGET_BASE64 = ([^;]+);/)[1] + ');')();
  })();
  const 뒤 = {
    before: 사진('before').data.length,
    profile: 사진('profile').data.length,
    after: 사진('after').data.length,
    band: 사진('band').data.length,
  };
  ok('★★ 500KB~2MB 짜리가 줄었다 (옛 꼴은 이걸 그냥 뒀다)',
    [뒤.band <= 선, 뒤.band < 처음.band], [true, true]);
  ok('★ 큰 사진이 담아둘 선 안으로 줄었다', [뒤.before <= 선, 뒤.before < 처음.before], [true, true]);
  ok('★ 프로필도 줄었다', 뒤.profile < 처음.profile, true);
  ok('★ 작은 것은 그대로다 (다시 굽지 않는다)', 뒤.after, 처음.after);

  // 긴 변이 정말 작아졌나 — 담긴 것을 다시 열어 본다
  const 긴변 = async (type) => {
    const b64 = 사진(type).data.replace(/^data:image\/[a-z+]+;base64,/, '');
    const m = await sharp(Buffer.from(b64, 'base64')).metadata();
    return Math.max(m.width, m.height);
  };
  ok('★ 긴 변이 1280 안으로 들어왔다', await 긴변('before') <= 1280, true);
  ok('★ 프로필은 256 자로 줄인다', await 긴변('profile') <= 256, true);

  console.log('\n── ⑹ 라이브에 돌릴 때의 선 ──');
  //
  // 판 번호(`bumpVer`)는 **램에만** 있다 — 딴 프로세스인 이 일꾼이 올려도 떠 있는
  // 서버는 모른다. 그래서 「판 번호가 올라갔나」로 볼 자리가 아니다. 진짜 위험은
  // 그 반대쪽이다: **떠 있는 서버의 램이 내 고침을 되돌린다**(Postgres 에서는
  // 바깥의 고침을 알아채지 못한다 — `statMs` 가 `null` 이다).
  const 일꾼글 = fs.readFileSync(일꾼, 'utf-8');
  ok('★ 라이브에 담을 때 서버가 살아 있나 두드려 본다',
    일꾼글.includes('살아있나(') && 일꾼글.includes('/api/health'), true);
  ok('★ 살아 있으면 시작하지 않는다',
    /살아 있다[\s\S]{0,700}?process\.exit\(1\)/.test(일꾼글), true);
  ok('  약속(깃발)만으로 넘기지 않는다 — 두드려 본 뒤에만 넘어간다',
    일꾼글.indexOf('const 상태 = await 살아있나') < 일꾼글.indexOf('--서버내렸다'), true);
  ok('  끝나면 다시 띄우라고 말한다', 일꾼글.includes('다시 띄우세요'), true);

  // ── ⑶ 되돌리기 ─────────────────────────────────────────────────────────
  console.log('\n── ⑶ 되돌리기 ──');
  const 백업길 = path.join(ROOT, 'backend', 되돌릴것[0]);
  const 되돌린것 = 돌린다(['--되돌리기', 백업길]);
  ok('되돌렸다고 말한다', /되돌렸다/.test(되돌린것), true);
  ok('★ 원본이 **글자 하나까지** 돌아왔다', {
    before: 사진('before').data.length, profile: 사진('profile').data.length,
    after: 사진('after').data.length, band: 사진('band').data.length,
  }, 처음);

  // ── ⑸ 못 읽는 그림 ────────────────────────────────────────────────────
  console.log('\n── ⑸ 못 읽는 그림이 섞여 있어도 ──');
  const 판 = 판읽기();
  판.photos.push({ id: 9, user_id: 7, type: 'before2', data: 'data:image/jpeg;base64,QUJD',
    created_at: 'x', updated_at: 'x' });
  fs.writeFileSync(PHOTOS, JSON.stringify(판), 'utf-8');
  const 섞인것 = 돌린다([]);
  ok('★ 통째로 멎지 않는다', /\[터짐\]/.test(섞인것), false);
  ok('  그 장만 건너뛴다고 말한다', /못 읽었다/.test(섞인것), true);
  ok('  나머지는 여전히 센다', /줄일 것 [1-9]/.test(섞인것), true);

  // ── ⑹ **까닭별 장수를 찍는가** ── (2026-11-26 · 정석, 맵시 넘김)
  //
  // 12/1 에 ①(재기만)을 돌리고 나서 할 판단은 **「화질 55 까지 내려간 장이 몇이냐」**
  // 하나다 — 맵시가 재 보니 **화면 안에서는 안 보이고**(두 장을 나란히 그려 긴 변
  // 1280 을 2~2.7배 줄여 쓴다) **내보낸 그림에서 보인다**(`mergeShots` 의 칸이 900px
  // 이라 거의 1:1 이고 거기서 `0.88` 로 또 굽는다 · 그 그림이 사람이 폰에 저장해
  // 남기는 것이다). 수가 없으면 그 판단을 할 수가 없다
  ok('★ 까닭별 장수를 묶어 찍는다', /까닭별:/.test(섞인것), true);
  ok('  「화질 55」가 몇 장인지 말한다 (0장이면 0장이라고)',
    /화질 55 까지 내려간/.test(섞인것), true);
  // ★ 이 판에는 **55 가 한 장 있다** — `band` 가 1.75MB 라 500KB~2MB 칸에 들어가고,
  // 일꾼이 그 칸을 화질 55 로 굽는다(위 ⑴ 에서 `392KB · 화질 55` 로 찍힌 그 장이다).
  // 「없다」로 적어두면 셈이 **0 을 세도 통과**한다 — 세는 자리가 진짜 도는지는
  // **있는 판에서 1 을 세는 것**으로만 보인다 (2026-11-27 · 정석 고침)
  ok('  이 판의 55 를 한 장으로 센다 (band 1.75MB → 화질 55)',
    /화질 55 까지 내려간 것이 1장이다/.test(섞인것), true);
  ok('  0장일 때의 줄도 코드에 있다',
    일꾼글.includes('화질 55 까지 내려간 것은 없다'), true);

  // ── 지키는 것이 코드에 적혀 있나 (시늉할 수 없는 자리) ─────────────────
  console.log('\n── 되돌릴 파일을 못 쓰면 시작하지 않는다 ──');
  const src = fs.readFileSync(일꾼, 'utf-8');
  const 백업자리 = src.slice(src.indexOf('되돌릴파일 = path.join'), src.indexOf('console.log(\'\');', src.indexOf('되돌릴파일 = path.join')));
  ok('★ 못 쓰면 멎는다 (사진은 덮으면 되살릴 길이 그 파일뿐이다)',
    /process\.exit\(1\)/.test(백업자리), true);
  ok('  담기 전에 쓴다 (`savePhoto` 보다 위다)',
    src.indexOf('되돌릴파일 = path.join') < src.indexOf('db.savePhoto(p.user_id, p.type, r.data)'), true);
  ok('  끝까지 기다린 뒤 끝낸다 (묶어 쓰는 사진이 날아가지 않게)',
    /await db\.drain\(\)/.test(src), true);

  for (const f of 치울것) { try { fs.unlinkSync(f); } catch { /* 없다 */ } }
  console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.log('FAIL 터졌다:', e && e.message); process.exit(1); });
