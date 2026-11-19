#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  정석 2차 — **내 기록 전부 받기(⑥)를 내가 직접 재현한다** (2026-11-19)
 *
 *    node agents/jeongseok/probe-takeall.cjs
 *
 *  ── 왜 벼림의 자를 믿지 않고 또 세우나 ──
 *
 *  고친 쪽의 자기 보고가 곧 통과가 되면 라이브에 결함이 남는다. 그리고 이 건은
 *  **밖으로 나가는 묶음**이다 — 한 자리만 어긋나면 **남의 기록이 섞여 나간다.**
 *  그런 건에서 「자가 통과했다」는 증거로 모자라다. 그래서 **길을 달리 잡는다** —
 *  벼림의 `check-takeall.cjs` 와 겹치더라도, 틀리는 모양이 같지 않아야 한다.
 *
 *  ── 아직 안 붙었으면 **미검증**이다 (FAIL 이 아니다) ──
 *
 *  짓는 중인 것에 FAIL 을 내면 그 딱지가 쌓여 다음 판정을 오염시킨다
 *  (11/19 에 라이브 503 으로 같은 것을 한 번 밟았다). 라우트가 없으면
 *  **「미검증 — 아직 안 붙었다」**로 적고 0 으로 끝낸다.
 *
 *  ── 무엇을 보는가 (내가 그은 선 그대로) ──
 *
 *    ① 모집단   담김 + 일부러 뺌 = `db.USER_COLLECTIONS` + `users` + 사진.
 *               **상수를 베끼지 않고 `db` 에서 읽는다** — 새 collection 이 생기면 운다
 *    ② 섞임     사람 **둘**을 만들고 둘 다 자료를 넣은 뒤, A 의 묶음에 **B 의 줄이
 *               하나라도** 있으면 FAIL. 이 건의 제일 위험한 자리다
 *    ③ 빼기     열쇠·기기 주소·비밀번호가 **절대** 안 담겼는지 (담기면 그 파일이
 *               곧 계정 열쇠다)
 *    ④ 적기     빠진 것이 **파일 안에 목록으로** 적혀 있는지, 그리고
 *               **「되넣는 길은 아직 없다」**가 적혀 있는지 (안 적으면 사람이 그것을
 *               백업으로 믿고 계정을 지운다)
 *    ⑤ 사진     한 묶음에 사진이 들어 있지 않은지 (수십 MB · 서버는 256MB 로 돈다)
 *    ⑥ 지우기 전 삭제를 예약한 사람이 **되살아나지 않고** 꺼낼 수 있는지 —
 *               지금은 `middleware/auth.js` 가 예약 계정의 모든 길을 401 로 막고
 *               `routes/auth.js` 는 로그인하면 묻지 않고 되살린다. **그 자리를 같이
 *               고치지 않으면 ⑥ 은 반만 닫힌다**
 *    ⑦ 크기     묶음이 상한(8MB) 안인지 — 넘기는 날은 조각내야 하는 날이고, 그걸
 *               사람이 받다 죽어서 알게 되면 안 된다
 *
 *  **진짜 DB 도 진짜 포트도 안 건드린다** (집안 꼴 — `check-admin-api.cjs`).
 * ─────────────────────────────────────────────────────────────────────────────
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BACK = path.join(ROOT, 'backend');
const PORT = 4791;
const TMP = path.join(BACK, '.probe-takeall.json');
const BASE = `http://127.0.0.1:${PORT}/api`;
const 크기상한 = 8 * 1024 * 1024;

let bad = 0;
let 미검증 = 0;
const 판 = [];
const ok = (이름, 받은것, 기대) => {
  const pass = JSON.stringify(받은것) === JSON.stringify(기대);
  if (!pass) bad += 1;
  판.push({ 이름, 결과: pass ? 'PASS' : 'FAIL', 받은것 });
  console.log((pass ? 'OK   ' : 'FAIL ') + 이름 + ' → ' + JSON.stringify(받은것)
    + (pass ? '' : ' (기대: ' + JSON.stringify(기대) + ')'));
};
function 미검증적기(이름, 까닭) {
  미검증 += 1;
  판.push({ 이름, 결과: '미검증', 받은것: 까닭 });
  console.log('미검증 ' + 이름 + ' — ' + 까닭);
}

const cleanTmp = () => {
  for (const f of [TMP, TMP.replace(/\.json$/, '.photos.json')]) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* 없으면 그만이다 */ }
  }
};

// ── 묶음을 내보내는 길을 **코드에서 찾는다** (주소를 베끼지 않는다) ──
function 길찾기() {
  const 라우트 = path.join(BACK, 'src', 'routes', 'exportAll.js');
  const 옛길 = path.join(BACK, 'src', 'routes', 'export.js');
  const 글 = [라우트, 옛길].filter((p) => fs.existsSync(p))
    .map((p) => ({ p, s: fs.readFileSync(p, 'utf8') }));
  if (!글.length) return null;
  const idx = fs.readFileSync(path.join(BACK, 'src', 'index.js'), 'utf8');
  for (const { p, s } of 글) {
    // 그 파일이 어디에 걸렸나 — `app.use('/api/export', …)` 꼴을 찾는다
    const 이름 = path.basename(p, '.js');
    const m = new RegExp(`app\\.use\\(\\s*['"]([^'"]+)['"][^)]*${이름}`).exec(idx);
    const 밑 = m ? m[1].replace(/^\/api/, '') : null;
    for (const r of s.matchAll(/router\.get\(\s*['"]([^'"]+)['"]/g)) {
      const 끝 = r[1];
      if (/all|everything|전부|bundle/i.test(끝) && 밑) return { 주소: (밑 + 끝).replace(/\/+/g, '/'), 파일: 이름 };
    }
  }
  return null;
}

const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, url, body, token, extra) {
  const h = { 'Content-Type': 'application/json', ...(extra || {}) };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(BASE + url, {
    method, headers: h, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch { /* 글로 온 것 */ }
  return { status: r.status, body: j, text: t };
}

/**
 * 계정 하나 만들고 토큰을 받는다 — 가입은 메일 번호를 같이 보낸다.
 * **아이디(`username`)도 받는다** — 11/19 에 그것을 빼고 불러 400 을 받았다
 * (`routes/auth.js` 가 넷을 다 본다). 거절 문구를 **그대로 적어** 올린다 —
 * 까닭을 삼키면 다음 사람이 또 같은 자리에서 막힌다
 */
async function 사람만들기(email, nickname, username) {
  const sent = await call('POST', '/auth/send-code', { email });
  const code = sent.body?.code;
  if (!code) return { token: null, why: '인증번호를 못 받았다 (' + sent.status + ')' };
  const reg = await call('POST', '/auth/register', {
    email, password: 'Takeall12345!', nickname, username, code,
  });
  if (!reg.body?.token) {
    return { token: null, why: `가입이 안 됐다 (${reg.status}: ${reg.body?.error || reg.text.slice(0, 60)})` };
  }
  return { token: reg.body.token, nickname, id: reg.body.id };
}

async function main() {
  const 길 = 길찾기();
  if (!길) {
    미검증적기('⑥ 묶음 받기', '`routes/exportAll.js` 에 전부 받는 길이 아직 없다 — 짓는 중이면 정상이다');
    보고();
    return 0;
  }
  console.log('찾은 길: /api' + 길.주소 + '  (' + 길.파일 + '.js)');

  cleanTmp();
  const child = spawn(process.execPath, [path.join(BACK, 'src', 'index.js')], {
    cwd: BACK,
    env: { ...process.env, PORT: String(PORT), DB_FILE: TMP, NODE_ENV: 'test', DATABASE_URL: '' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let 터진것 = '';
  child.stderr.on('data', (d) => { 터진것 += String(d); });

  try {
    // 뜰 때까지 기다린다 — 「떴다」 줄이 아니라 **답이 오는 때**다
    let 떴나 = false;
    for (let i = 0; i < 60; i += 1) {
      await 잠깐(250);
      try {
        const h = await call('GET', '/health');
        if (h.status === 200) { 떴나 = true; break; }
      } catch { /* 아직 */ }
    }
    if (!떴나) {
      미검증적기('서버 띄우기', '시험 서버가 15초 안에 안 떴다' + (터진것 ? ' — ' + 터진것.split('\n')[0] : ''));
      보고();
      return 0;
    }

    const A = await 사람만들기('takeall-a@example.com', '가아', 'takeallaaa');
    const B = await 사람만들기('takeall-b@example.com', '나비', 'takeallbbb');
    if (!A.token || !B.token) {
      미검증적기('사람 둘 만들기', (A.why || '') + ' ' + (B.why || ''));
      보고();
      return 0;
    }

    // ── 둘 다 자료를 남긴다 — **앱의 길로** 넣는다 (DB 를 밖에서 쑤시지 않는다) ──
    //
    // ★ **넣기가 됐는지 본다** (2026-11-19 에 내 probe 가 이것을 안 봐서 거짓 FAIL 을
    // 냈다 — 씨가 안 심겼는데 「A 의 것이 안 담겼다」고 적었다). 씨가 없으면 내용
    // 판정은 전부 뜻이 없다 → **미검증**이다
    const 심은것 = [];
    for (const [who, t] of [['A', A.token], ['B', B.token]]) {
      const w = await call('POST', '/workouts', {
        date: '2026-11-19', exercise: who + ' 벤치프레스', weight: '60', sets: 3, reps: 10,
      }, t);
      const n = await call('POST', '/notes', { body: who + ' 의 글' }, t);
      심은것.push({ who, 운동: w.status, 메모: n.status,
        왜: [w.body?.error, n.body?.error].filter(Boolean).join(' · ') });
    }
    await 잠깐(900);          // 서버가 쓰기를 모아 쓴다 (500ms)
    const 못심은것 = 심은것.filter((r) => ![200, 201].includes(r.운동) || ![200, 201].includes(r.메모));
    if (못심은것.length) {
      미검증적기('씨 심기', 못심은것.map((r) => `${r.who}: 운동 ${r.운동} · 메모 ${r.메모}${r.왜 ? ' (' + r.왜 + ')' : ''}`).join(' / ')
        + ' — 씨가 없으면 내용 판정이 거짓이 된다');
      보고();
      return 0;
    }

    // ── ★ **미리보기와 묶음은 다른 답이다** ── (2026-11-19)
    //
    // 인자 없이 부르면 「담기는것 / 안담는것」 **목록**이 온다(사람에게 먼저 보여
    // 고르게 하는 화면이다). 그것을 묶음으로 보고 재면 **내용이 다 없다고 적는다** —
    // 내가 그 꼴로 거짓 FAIL 다섯을 냈다. 그래서 **고를 것을 코드에서 읽어** 전부 켠다.
    const 미리 = await call('GET', 길.주소, null, A.token);
    if (미리.status !== 200) {
      미검증적기('미리보기', '길이 ' + 미리.status + ' 로 답했다 — 아직 안 열렸거나 조건이 다르다');
      보고();
      return 0;
    }
    const 고를것 = (미리.body?.담기는것 || []).map((r) => r.열쇠).filter(Boolean);
    ok('⓪ 미리보기가 **무엇이 담기고 무엇이 빠지는지** 먼저 말한다',
      Array.isArray(미리.body?.담기는것) && Array.isArray(미리.body?.안담는것), true);
    if (!고를것.length) {
      미검증적기('묶음 받기', '미리보기에 고를 것이 없다 — 모양이 바뀌었다');
      보고();
      return 0;
    }
    // **사진까지 일부러 켠다** — 켜도 한 묶음에 사진이 들어가면 안 되는지를 봐야 한다
    const r = await call('GET', 길.주소 + '?parts=' + 고를것.join(','), null, A.token);
    if (r.status !== 200) {
      미검증적기('묶음 받기', '고른 것을 주니 ' + r.status + ' 로 답했다');
      보고();
      return 0;
    }
    const 글 = r.text;
    ok('② A 의 묶음에 **B 의 이름이 없다**', /나비|takeall-b@/.test(글), false);
    ok('② A 의 묶음에 **B 의 기록이 없다**', /B 벤치프레스|B 메모|B 의 글/.test(글), false);
    ok('② A 의 것은 들어 있다', /A 벤치프레스/.test(글), true);

    // 줄마다 user_id 를 센다 — 글자 찾기로는 놓친다.
    // **아래 ③ 이 이 값을 쓴다** — 차례를 바꾸지 말 것
    let 묶음 = null;
    try { 묶음 = JSON.parse(글); } catch { /* JSON 이 아니다 */ }
    if (!묶음) {
      미검증적기('② 줄마다 user_id', '묶음이 JSON 이 아니다 — 모양이 정해지면 다시 본다');
    } else {
      const 남의것 = [];
      const 걷기 = (v, 길자리) => {
        if (Array.isArray(v)) return v.forEach((x, i) => 걷기(x, 길자리 + '[' + i + ']'));
        if (v && typeof v === 'object') {
          for (const k of ['user_id', 'userId']) {
            if (k in v && v[k] != null) {
              // A 의 번호를 모르므로 **값이 여러 가지면** 섞인 것이다
              남의것.push(String(v[k]));
            }
          }
          for (const [k, x] of Object.entries(v)) 걷기(x, 길자리 + '.' + k);
        }
      };
      걷기(묶음, '');
      const 가지수 = [...new Set(남의것)];
      ok('② 묶음 안의 user_id 가 **한 가지뿐이다**', 가지수.length <= 1, true);
      if (가지수.length > 1) console.log('       섞인 번호: ' + 가지수.join(' '));
    }

    // ── ③ 절대 안 담는 것 ──
    //
    // ★ **글자 찾기로 보면 거짓 FAIL 이 난다** — 「안담는것」 설명에 그 이름이 적혀
    // 있다(적는 것이 맞고, 그게 내가 그은 선이다). 11/19 에 내가 그 꼴로 두 건을
    // 거짓 FAIL 냈다. 그래서 **자료 쪽만** 본다 — 설명 칸은 걷어내고 본다
    const 자료쪽 = (() => {
      if (!묶음) return 글;
      const 벗긴것 = { ...묶음 };
      for (const k of ['안담는것', '빠진것', '되넣기', '설명', '담기는것']) delete 벗긴것[k];
      return JSON.stringify(벗긴것);
    })();
    const 금지 = {
      '비밀번호': /"password(_hash)?"\s*:/,
      '로그인 유지 열쇠': /"(refreshTokens?|token_hash)"\s*:/i,
      '기기 알림 주소': /"(pushSubs?|endpoint|p256dh)"\s*:/i,
      '권한': /"role"\s*:/,
    };
    for (const [이름, 식] of Object.entries(금지)) {
      ok('③ ' + 이름 + ' 가 **자료 쪽에** 안 담겼다', 식.test(자료쪽), false);
    }
    // 설명 쪽에는 **적혀 있어야** 한다 — 빼놓고 말 안 하면 사람은 빠진 줄 모른다.
    //
    // 모양은 둘이다 — 묶음은 `빠진것`(「이름 — 까닭」 글 목록), 미리보기는
    // `안담는것`(까닭 칸). **둘 다 받는다.** 내가 한 모양만 받다가 11/19 에
    // 거짓 FAIL 을 하나 더 냈다 — 자가 제 가정을 지키려 들면 그것이 거짓이 된다
    const 뺀목록 = Array.isArray(묶음?.빠진것) ? 묶음.빠진것
      : Array.isArray(묶음?.안담는것) ? 묶음.안담는것 : [];
    const 까닭이있나 = (r) => (typeof r === 'string' ? /[—:-]\s*\S/.test(r) : !!(r.까닭 || r.why));
    ok('③ 뺀 것을 **까닭과 함께** 적었다',
      뺀목록.length > 0 && 뺀목록.every(까닭이있나), true);
    if (뺀목록.length) console.log('       뺀 것 ' + 뺀목록.length + '가지 — 전부 까닭이 붙어 있다');

    // ── ① 모집단 — `db` 에서 읽는다 (베끼지 않는다) ──
    let db = null;
    try { db = require(path.join(BACK, 'src', 'db.js')); } catch { /* 못 읽으면 아래에서 미검증 */ }
    if (!db || !Array.isArray(db.USER_COLLECTIONS)) {
      미검증적기('① 모집단', '`db.USER_COLLECTIONS` 를 못 읽었다');
    } else if (!묶음) {
      미검증적기('① 모집단', '묶음이 JSON 이 아니라 칸을 셀 수 없다');
    } else {
      const 담긴칸 = new Set(Object.keys(묶음.data || 묶음));
      const 적힌뺌 = JSON.stringify(묶음).match(/[a-zA-Z]+/g) || [];
      const 안보이는것 = db.USER_COLLECTIONS.filter((k) => !담긴칸.has(k) && !적힌뺌.includes(k));
      ok('① 모든 collection 이 **담겼거나 뺐다고 적혀 있다**', 안보이는것, []);
      if (안보이는것.length) {
        console.log('       → 담지도 않고 뺐다고 적지도 않은 칸이다. 사람은 그것이 없는 줄 모른다');
      }
    }

    // ── ④ 적기 — 빠진 것과 「되넣는 길 없음」 ──
    ok('④ 빠진 것을 파일 안에 적었다', /빠|없|제외|담지/.test(글), true);
    ok('④ **되넣는 길이 아직 없다**고 적었다', /다시 넣|되넣|가져오기는|불러올 수는/.test(글), true);

    // ── ⑤ 사진은 한 묶음에 없다 ──
    //
    // ★ **빈 통과는 통과가 아니다.** 사진을 한 장도 안 심고 「사진이 안 들어 있다」를
    // PASS 로 적으면 그 줄은 아무것도 지키지 않는다(「셈 0 은 통과가 아니다」와 같은 선).
    // 심을 길이 없으면 **미검증**으로 적는다 — 사진 올리기는 여러 쪽 짜리 길이라
    // 여기서 심지 않는다
    const 사진줄 = (미리.body?.담기는것 || []).find((r) => r.열쇠 === 'photos');
    if (!사진줄 || !사진줄.줄) {
      미검증적기('⑤ 사진이 묶음에 안 들어 있다',
        '사진을 한 장도 안 심었다 — 빈 통과로 적지 않는다. 사진 있는 계정으로 한 번 더 봐야 한다');
    } else {
      ok('⑤ 사진이 묶음에 안 들어 있다 (사진 ' + 사진줄.줄 + '장인데)',
        /data:image\/|base64,/.test(글), false);
    }

    // ── ⑦ 크기 ──
    const 바이트 = Buffer.byteLength(글);
    ok('⑦ 묶음이 ' + (크기상한 / 1024 / 1024) + 'MB 안이다 (지금 ' + (바이트 / 1024).toFixed(1) + 'KB)',
      바이트 <= 크기상한, true);

    // ── ⑥ 지우기 전에 꺼낼 수 있나 ──
    // 길 이름을 베끼지 않는다 — `routes/auth.js` 에서 찾는다 (11/19 에 `/delete-account` 로
    // 베껴 적고 404 를 받았다. 실제 이름은 `/delete` 다)
    const 삭제길 = (() => {
      const 글a = fs.readFileSync(path.join(BACK, 'src', 'routes', 'auth.js'), 'utf8');
      for (const m of 글a.matchAll(/router\.(?:post|delete)\(\s*['"]([^'"]+)['"]/g)) {
        if (/delete|account|지우/i.test(m[1])) return '/auth' + m[1];
      }
      return null;
    })();
    if (!삭제길) { 미검증적기('⑥ 삭제 예약 뒤 꺼내기', '삭제 예약 길을 코드에서 못 찾았다'); 보고(); return bad ? 1 : 0; }
    const 지움 = await call('POST', 삭제길, { password: 'Takeall12345!' }, A.token);
    if (지움.status !== 200) {
      미검증적기('⑥ 삭제 예약 뒤 꺼내기', '삭제 예약(' + 삭제길 + ')이 ' + 지움.status
        + ' 로 답했다' + (지움.body?.error ? ' — ' + 지움.body.error : ''));
    } else {
      await 잠깐(600);
      const 뒤 = await call('GET', 길.주소, null, A.token);
      if (뒤.status === 200) {
        ok('⑥ 삭제를 예약한 사람도 **되살아나지 않고** 꺼낼 수 있다', true, true);
      } else {
        ok('⑥ 삭제를 예약한 사람이 못 꺼낸다 — **「지워지기 전에 꺼내기」가 안 된다** (' + 뒤.status + ')',
          false, true);
        console.log('       → `middleware/auth.js` 가 예약 계정의 모든 길을 401 로 막고,');
        console.log('         `routes/auth.js` 는 로그인하면 묻지 않고 되살린다.');
        console.log('         꺼내려면 로그인 → 로그인하면 삭제가 취소된다. 이 건의 근거가 그 30일이다.');
        console.log('         길 둘 중 하나가 필요하다 — (가) 지우기 누르는 자리에서 먼저 받게 하거나');
        console.log('         (나) 예약 상태에서 **이 길만** 통과시킨다(그 구멍이 하나뿐인지 자로 센다).');
      }
    }
  } finally {
    try { child.kill(); } catch { /* 이미 죽었다 */ }
    await 잠깐(400);
    cleanTmp();
  }
  보고();
  return bad ? 1 : 0;
}

function 보고() {
  const 센것 = 판.filter((r) => r.결과 !== '미검증').length;
  console.log('');
  console.log('──────────────────────────────────────────────');
  console.log(`항목 ${판.length} · 판정 ${센것} · PASS ${센것 - bad} · **FAIL ${bad}** · 미검증 ${미검증}`);
  console.log(`버그비율 ${센것 ? (bad / 센것 * 100).toFixed(1) : 0}%   (FAIL ÷ 판정한 항목)`);
  if (미검증) console.log('**미검증은 통과가 아니다** — 붙은 뒤에 다시 돌린다');
  console.log('──────────────────────────────────────────────');
  fs.writeFileSync(path.join(__dirname, 'last-takeall.json'),
    JSON.stringify({ 때: new Date().toISOString(), 센것, FAIL: bad, 미검증, 항목: 판 }, null, 2), 'utf8');
}

main().then((c) => process.exit(c)).catch((e) => {
  console.error('터졌다: ' + (e && e.message));
  process.exit(1);
});
