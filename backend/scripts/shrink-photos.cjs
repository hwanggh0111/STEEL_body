#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  **이미 올라간 사진을 한 번 줄인다** (2026-11-26 · 주인 지시 · 근호 용량 점검)
 *
 *    npm run shrinkphotos                      ★ 재기만 한다 (아무것도 안 바꾼다)
 *    DATABASE_URL=<라이브> npm run shrinkphotos    라이브를 재기만
 *    npm run shrinkphotos -- --진짜로            줄여서 담는다 (되돌릴 파일을 먼저 쓴다)
 *    npm run shrinkphotos -- --진짜로 --사람 42   그 사람 것만
 *
 *  ── 왜 필요한가 ──
 *
 *  `580ee55` 로 **앞으로 올라오는** 사진은 담아둘 선(500KB) 안으로 줄여 담는다. 그런데
 *  **이미 올라간 것은 그대로**다 — 줄이는 자가 「거절하는 선(2MB) 안이면 그냥 둔다」였던
 *  동안 올라간 1.4MB 짜리들이 남아 있다. 근호 실측으로 **사진 다 채운 40~50명이면 무료
 *  512MB 가 넘치는데**, 그 수를 만드는 것이 바로 그 옛 사진들이다.
 *
 *  ── 지키는 것 (사람 기록을 만지는 일이다) ──
 *
 *  1. **기본은 재기만 한다.** `--진짜로` 를 주지 않으면 **한 줄도 안 바꾼다**
 *  2. **되돌릴 파일을 먼저 쓴다.** 못 쓰면 **아예 시작하지 않는다** —
 *     사진은 base64 덩어리라 한 번 덮으면 되살릴 길이 그 파일뿐이다
 *  3. **작은 것은 건드리지 않는다.** 담아둘 선 안이고 긴 변도 작으면 그대로 둔다
 *     (다시 구우면 화질만 손해다 — 화면과 **같은 자**를 쓴다)
 *  4. **커지면 원본을 둔다.** 줄이려고 부른 일꾼이 늘리면 안 된다
 *  5. 한 장이라도 터지면 **그 장만 건너뛴다.** 나머지는 계속한다
 *  6. 담은 뒤 **판 번호를 올린다**(`savePhoto` 가 한다) — 안 올리면 기기들이
 *     옛 사진을 계속 캐시에서 본다
 *
 *  ── ★ **라이브에 돌릴 때는 서버를 먼저 멈춘다** ──
 *
 *  서버는 사진 판을 **램에 들고 있다**(`db.js` 의 `_photoCache`). 파일로 둘 때는 바깥에서
 *  바뀐 것을 서버가 알아채 다시 읽는다(`_syncPhotosIfChanged`) — 그런데 그 검사는
 *  **파일의 시각**으로 하므로 **Postgres 에서는 서 있지 않는다**(`statMs` 가 `null` 이다).
 *
 *  즉 **라이브에서는 서버가 내 고침을 모른다.** 그 서버가 사진을 한 장이라도 저장하면
 *  램에 있던 **옛 판이 통째로 되돌아간다** — 줄인 것이 사라지고, 그 사실을 아무도 모른다
 *  (`db.js` 의 「바깥에서 파일을 고치면 조용히 되돌아간다」가 적어둔 그 꼴이다).
 *
 *  그래서 `--진짜로` + `DATABASE_URL` 이면 **라이브가 살아 있나 두드려 보고**, 答하면
 *  **시작하지 않는다.** Render 에서 서비스를 멈춘 뒤(또는 자고 있을 때) 돌리고, 끝나면
 *  다시 띄운다 — 그러면 새로 뜬 서버가 줄인 판을 읽는다.
 *
 *  ── 되돌리는 법 ──
 *
 *    npm run shrinkphotos -- --되돌리기 <되돌릴파일>
 *
 *  ── 줄이는 자 ──
 *
 *  `sharp` 를 쓴다. backend 의 꾸러미가 아니라 **frontend 의 것을 빌린다**(아이콘 만들
 *  때 쓰는 그것이다) — 한 번 돌리는 일꾼 때문에 서버 꾸러미에 네이티브 짐을 더하지
 *  않는다. 없으면 **까닭을 말하고 멎는다**(조용히 안 줄이는 것보다 낫다).
 * ─────────────────────────────────────────────────────────────────────────────
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const 진짜로 = process.argv.includes('--진짜로');
const 되돌리기 = process.argv.includes('--되돌리기');
const 사람만 = (() => {
  const i = process.argv.indexOf('--사람');
  return i >= 0 ? Number(process.argv[i + 1]) : null;
})();

// 화면과 **같은 선**을 쓴다 — 두 벌로 적으면 한쪽만 고쳐진다
function 선읽기() {
  const 글 = fs.readFileSync(path.join(ROOT, 'frontend/src/data/photoLimit.js'), 'utf-8');
  const 수 = (이름) => {
    const m = 글.match(new RegExp('export const ' + 이름 + ' = ([^;]+);'));
    if (!m) throw new Error(`${이름} 을 못 찾았다 (frontend/src/data/photoLimit.js)`);
    // eslint-disable-next-line no-new-func
    return new Function('return (' + m[1] + ');')();
  };
  const shrink = fs.readFileSync(path.join(ROOT, 'frontend/src/data/shrinkImage.js'), 'utf-8');
  const edge = (shrink.match(/const MAX_EDGE = (\d+);/) || [])[1];
  const profile = (shrink.match(/export const PROFILE_EDGE = (\d+);/) || [])[1];
  return {
    MAX: 수('PHOTO_MAX_BASE64'),
    TARGET: 수('PHOTO_TARGET_BASE64'),
    MAX_EDGE: Number(edge),
    PROFILE_EDGE: Number(profile),
  };
}

function sharp불러오기() {
  try {
    return require(require.resolve('sharp', { paths: [path.join(ROOT, 'frontend/node_modules')] }));
  } catch (err) {
    console.error('sharp 를 못 들었다 — frontend 쪽 꾸러미를 빌린다.');
    console.error('  cd frontend && npm install   한 뒤 다시 돌리면 된다.');
    console.error('  (까닭: ' + String(err.message).slice(0, 120) + ')');
    process.exit(1);
  }
}

const KB = 1024;
const MB = 1024 * KB;
const 재기 = (n) => (n >= MB ? (n / MB).toFixed(2) + 'MB' : Math.round(n / KB) + 'KB');

/** data URL 을 쪼갠다. 아니면 `null` */
function 쪼개기(dataUrl) {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(String(dataUrl || ''));
  return m ? { mime: m[1], b64: m[2] } : null;
}

/**
 * 한 장을 줄인다. **화면의 `needsShrink` 와 같은 판단**을 쓴다 —
 * 담아둘 선을 넘거나 긴 변이 크면 줄이고, 둘 다 아니면 **그대로 둔다**.
 *
 * 돌려주는 것: `{ 손댔나, data, 왜, 전, 후, 폭, 높이 }`
 */
async function 한장줄이기(sharp, 선, photo) {
  const 전 = String(photo.data || '').length;
  const 쪼갠것 = 쪼개기(photo.data);
  if (!쪼갠것) return { 손댔나: false, 왜: '그림이 아니다 (data URL 이 아니다)', 전, 후: 전 };

  const 통 = Buffer.from(쪼갠것.b64, 'base64');
  let 메타;
  try {
    메타 = await sharp(통).metadata();
  } catch (err) {
    return { 손댔나: false, 왜: '못 읽었다 (' + String(err.message).slice(0, 60) + ')', 전, 후: 전 };
  }
  const 긴변 = Math.max(메타.width || 0, 메타.height || 0);
  const maxEdge = photo.type === 'profile' ? 선.PROFILE_EDGE : 선.MAX_EDGE;

  // 화면과 같은 판단 (`data/shrinkImage.js` 의 `needsShrink`)
  const 줄여야 = 전 > 선.TARGET || 긴변 > maxEdge;
  if (!줄여야) {
    return { 손댔나: false, 왜: '이미 작다', 전, 후: 전, 폭: 메타.width, 높이: 메타.height };
  }

  // 화질을 낮춰가며 담아둘 선 안으로 — 화면의 `QUALITIES` 와 같은 셋
  for (const q of [85, 70, 55]) {
    let 구운것;
    try {
      구운것 = await sharp(통)
        .rotate()                                  // 폰 사진의 방향 표시를 반영한다
        .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: q, mozjpeg: true })
        .toBuffer();
    } catch (err) {
      return { 손댔나: false, 왜: '굽다 터졌다 (' + String(err.message).slice(0, 60) + ')', 전, 후: 전 };
    }
    const 새것 = 'data:image/jpeg;base64,' + 구운것.toString('base64');
    if (새것.length <= 선.TARGET) {
      // **커지면 원본을 둔다** — 줄이려고 부른 일꾼이 늘리면 안 된다
      if (새것.length >= 전) return { 손댔나: false, 왜: '줄여도 안 작아진다', 전, 후: 전 };
      return { 손댔나: true, data: 새것, 왜: `화질 ${q}`, 전, 후: 새것.length };
    }
  }
  // 셋을 다 낮춰도 선에 안 들면 **마지막 것이라도** 쓴다 (거절하는 선보다 작으면 된다)
  try {
    const 마지막 = await sharp(통).rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 55, mozjpeg: true }).toBuffer();
    const 새것 = 'data:image/jpeg;base64,' + 마지막.toString('base64');
    if (새것.length >= 전) return { 손댔나: false, 왜: '줄여도 안 작아진다', 전, 후: 전 };
    return { 손댔나: true, data: 새것, 왜: '화질 55 (선보다는 크다)', 전, 후: 새것.length };
  } catch (err) {
    return { 손댔나: false, 왜: '굽다 터졌다 (' + String(err.message).slice(0, 60) + ')', 전, 후: 전 };
  }
}

/**
 * **라이브가 살아 있나.** 살아 있으면 `--진짜로` 를 시작하지 않는다 (위 머리글).
 *
 * 약속으로 묻지 않고 **두드려 본다** — 「서버 내렸어요」를 깃발로 받으면 그 말이 틀린
 * 날 사진이 사라진다. 자고 있는 Render 는 안 答하므로(무료 판은 15분 조용하면 잔다)
 * 그때는 돌려도 된다 — 깨어나면 새로 읽는다.
 */
function 살아있나(주소) {
  return new Promise((done) => {
    let 끝났다 = false;
    const 답 = (v) => { if (!끝났다) { 끝났다 = true; done(v); } };
    try {
      const https = require('https');
      const req = https.get(주소.replace(/\/$/, '') + '/api/health', { timeout: 8000 }, (res) => {
        답(res.statusCode >= 200 && res.statusCode < 500 ? res.statusCode : null);
        res.resume();
      });
      req.on('error', () => 답(null));
      req.on('timeout', () => { req.destroy(); 답(null); });
    } catch { 답(null); }
  });
}

// ── 되돌리기 ───────────────────────────────────────────────────────────────
async function 되돌린다(db, 파일) {
  if (!파일 || !fs.existsSync(파일)) {
    console.error('되돌릴 파일을 주세요: npm run shrinkphotos -- --되돌리기 <파일>');
    process.exit(1);
  }
  const 담긴것 = JSON.parse(fs.readFileSync(파일, 'utf-8'));
  const 줄들 = Array.isArray(담긴것.photos) ? 담긴것.photos : [];
  console.log(`되돌린다 — ${파일} 의 ${줄들.length}장`);
  let 됐다 = 0;
  for (const p of 줄들) {
    try { db.savePhoto(p.user_id, p.type, p.data); 됐다 += 1; }
    catch (err) { console.error(`  (건너뜀) 사람 ${p.user_id} ${p.type}: ${err.message}`); }
  }
  await db.drain();
  console.log(`되돌렸다 — ${됐다}/${줄들.length}장`);
  process.exit(0);
}

// ── 돈다 ───────────────────────────────────────────────────────────────────
(async () => {
  const 선 = 선읽기();
  const storage = require(path.join(ROOT, 'backend/src/storage.js'));
  await storage.init();
  const db = require(path.join(ROOT, 'backend/src/db.js'));

  if (되돌리기) {
    const i = process.argv.indexOf('--되돌리기');
    return 되돌린다(db, process.argv[i + 1]);
  }

  const sharp = sharp불러오기();

  // ★ **라이브에 담으려면 그 서버가 멎어 있어야 한다** (위 머리글)
  if (진짜로 && process.env.DATABASE_URL) {
    const 주소 = process.env.BACKEND_URL || 'https://steel-body.onrender.com';
    const 상태 = await 살아있나(주소);
    if (상태 !== null && !process.argv.includes('--서버내렸다')) {
      console.error('');
      console.error(`  ★ 라이브 서버가 살아 있다 (${주소} → ${상태}).`);
      console.error('  **시작하지 않는다.** 그 서버는 사진 판을 램에 들고 있고,');
      console.error('  Postgres 에서는 바깥의 고침을 알아채지 못한다 — 사진을 한 장이라도');
      console.error('  저장하면 **줄인 것이 통째로 되돌아간다**(아무 소리도 안 난다).');
      console.error('');
      console.error('  Render 에서 서비스를 멈춘 뒤 돌리고, 끝나면 다시 띄우세요.');
      console.error('  (자고 있을 때는 答이 없으니 그냥 돌아간다)');
      process.exit(1);
    }
    if (상태 === null) console.log('  라이브가 答하지 않는다 (멎었거나 자고 있다) — 돌린다.');
  }

  // 사람마다 모은다 — `getPhotos` 는 사람별이라, 사람 목록에서 돈다
  const 사람들 = db.getAllUsers().map((u) => u.id);
  const 볼사람 = 사람만 ? 사람들.filter((id) => id === 사람만) : 사람들;

  const 어디 = process.env.DATABASE_URL ? '라이브(Postgres)' : '내 컴퓨터(파일)';
  console.log('');
  console.log('─'.repeat(74));
  console.log(`  옛 사진 줄이기 — ${어디} · 사람 ${볼사람.length}명`
    + ` · 담아둘 선 ${재기(선.TARGET)} · 긴 변 ${선.MAX_EDGE}px(프로필 ${선.PROFILE_EDGE}px)`);
  console.log(`  ${진짜로 ? '★ 진짜로 담는다' : '재기만 한다 (아무것도 안 바꾼다 · 담으려면 --진짜로)'}`);
  console.log('─'.repeat(74));

  const 할것 = [];
  let 전체전 = 0;
  for (const id of 볼사람) {
    for (const p of db.getPhotos(id)) {
      전체전 += String(p.data || '').length;
      할것.push(p);
    }
  }
  if (할것.length === 0) {
    console.log('\n  사진이 없다.\n');
    process.exit(0);
  }

  // **되돌릴 파일을 먼저 쓴다.** 못 쓰면 시작하지 않는다
  let 되돌릴파일 = null;
  if (진짜로) {
    const 때 = new Date().toISOString().replace(/[:.]/g, '-');
    되돌릴파일 = path.join(ROOT, 'backend', `photo-backup-${때}.json`);
    try {
      fs.writeFileSync(되돌릴파일, JSON.stringify({
        때: new Date().toISOString(), 어디, 선, photos: 할것,
      }), 'utf-8');
      const 큰가 = fs.statSync(되돌릴파일).size;
      console.log(`\n  되돌릴 파일을 썼다: ${path.relative(ROOT, 되돌릴파일).replace(/\\/g, '/')}`
        + ` (${재기(큰가)})`);
      console.log('  되돌리려면: npm run shrinkphotos -- --되돌리기 <그 파일>');
    } catch (err) {
      console.error(`\n  되돌릴 파일을 못 썼다 — ${err.message}`);
      console.error('  **시작하지 않는다.** 사진은 한 번 덮으면 되살릴 길이 이 파일뿐이다.');
      process.exit(1);
    }
  }

  console.log('');
  let 손댄것 = 0;
  // 까닭별 장수 (아래 머리글) — 「화질 55」가 몇 장인지를 12/1 에 읽는다
  const 까닭셈 = new Map();
  let 건너뜀 = 0;
  let 터짐 = 0;
  let 전체후 = 0;
  for (const p of 할것) {
    const r = await 한장줄이기(sharp, 선, p);
    전체후 += r.후;
    const 머리 = `  사람 ${String(p.user_id).padStart(4)} · ${String(p.type).padEnd(7)}`;
    if (r.손댔나) {
      손댄것 += 1;
      const 줌 = Math.round((1 - r.후 / r.전) * 100);
      console.log(`${머리} ${재기(r.전)} → ${재기(r.후)}  (−${줌}% · ${r.왜})`
        + (진짜로 ? '' : '   [재기만]'));
      if (진짜로) {
        try { db.savePhoto(p.user_id, p.type, r.data); }
        catch (err) { 터짐 += 1; console.error(`${머리} 담다 터졌다: ${err.message}`); }
      }
    } else {
      건너뜀 += 1;
      if (!/이미 작다/.test(r.왜)) console.log(`${머리} 그대로 — ${r.왜}`);
    }
    // ── ★ **까닭을 묶어 센다** ── (2026-11-26 · 정석, 맵시 넘김)
    //
    // 장마다 `왜` 를 들고 있는데 **묶어 세는 자리가 없었다.** 그런데 12/1 에 ①(재기만)을
    // 돌리고 나서 해야 하는 판단이 **「화질 55 까지 내려간 장이 몇이냐」 하나**다 —
    // 맵시가 재 보니 **화면 안에서는 안 보이고**(두 장을 나란히 그려 긴 변 1280 을
    // 2~2.7배 줄여 쓴다) **내보낸 그림에서 보인다**: `data/mergeShots.js` 가 한 칸을
    // `CELL_W = 900` 으로 그려 **거의 1:1** 이고 거기에 `0.88` 로 **또 한 번 굽는다**.
    // 그 그림이 사람이 폰에 저장해 남기는 것이다.
    //
    // 그래서 **55 가 0장이면 그대로 돌리고, 있으면 그 장들만 눈으로 본다.** 수가 없으면
    // 그 판단을 할 수가 없다 — 한 줄로 찍는다
    까닭셈.set(r.왜, (까닭셈.get(r.왜) || 0) + 1);
  }

  if (진짜로) {
    // **쓰기를 끝까지 기다린다** — 사진 저장은 묶어 쓴다(500ms). 안 기다리면 날아간다
    await db.drain();
  }

  console.log('');
  console.log('─'.repeat(74));
  console.log(`  사진 ${할것.length}장 · 줄일 것 ${손댄것}장 · 그대로 ${건너뜀}장`
    + (터짐 ? ` · 담다 터진 것 ${터짐}장` : ''));
  // **까닭별 장수** (위 `까닭셈` 머리글) — 「화질 55」가 0장인지를 여기서 읽는다.
  // 많이 나온 것부터 적는다. 55 가 있으면 **눈으로 볼 장**이 그만큼이라는 뜻이다
  if (까닭셈.size > 0) {
    const 줄 = [...까닭셈.entries()].sort((a, b) => b[1] - a[1])
      .map(([왜, n]) => `${왜} ${n}장`).join(' · ');
    console.log(`  까닭별: ${줄}`);
    const 쉰다섯 = [...까닭셈.entries()]
      .filter(([왜]) => /55/.test(왜)).reduce((n, [, c]) => n + c, 0);
    if (쉰다섯 > 0) {
      console.log(`  ★ 화질 55 까지 내려간 것이 ${쉰다섯}장이다 — **그 장들은 눈으로 본다**`);
      console.log('     (내보내는 칸이 900px 이라 거의 1:1 이고 거기서 또 굽는다 · 맵시 판단)');
    } else {
      console.log('  ★ 화질 55 까지 내려간 것은 없다 — 내보낸 그림에서도 자국이 안 보인다 (맵시 판단)');
    }
  }
  console.log(`  전부 합쳐 ${재기(전체전)} → ${재기(전체후)}`
    + (전체전 > 0 ? `  (−${Math.round((1 - 전체후 / 전체전) * 100)}%)` : ''));
  if (!진짜로 && 손댄것 > 0) {
    console.log('');
    console.log('  ★ 아직 아무것도 안 바꿨다. 담으려면:');
    console.log('     npm run shrinkphotos -- --진짜로');
  }
  if (진짜로) {
    console.log('');
    console.log('  담았다. 기기들은 **새로 뜬 서버의 딱지**로 다음에 받을 때 새 사진을 받는다.');
    if (process.env.DATABASE_URL) {
      console.log('  ★ 라이브를 다시 띄우세요 — 새 서버가 줄인 판을 읽습니다.');
    }
    console.log(`  되돌리려면: npm run shrinkphotos -- --되돌리기 ${path.basename(되돌릴파일)}`);
  }
  console.log('─'.repeat(74));
  console.log('');
  process.exit(0);
})().catch((err) => {
  console.error('터졌다:', err && err.stack ? err.stack.split('\n').slice(0, 3).join('\n') : err);
  process.exit(1);
});
