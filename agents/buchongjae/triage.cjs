#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  부총재의 **오류 관리자** (2026-11-26 · 주인 지시 「오류 관리자를 파일로 만들어라」)
 *
 *    node agents/buchongjae/triage.cjs              내 컴퓨터의 기록
 *    DATABASE_URL=<라이브> node .../triage.cjs      ★ 라이브 기록
 *    node agents/buchongjae/triage.cjs --json       보고서 JSON 만
 *    node agents/buchongjae/triage.cjs --전부       아는 꼴도 다 펼친다
 *
 *  (backend 에서 `npm run triage` 로도 돈다)
 *
 *  ── `npm run errors` 와 무엇이 다른가 ──
 *
 *  `errors` 는 **쌓인 것을 보여준다**(몇 번 났나). 그걸 보고 나서 내가 매번 하던 일이
 *  있었다 — 그 `파일:줄` 을 열고, 위아래를 읽고, 그 파일을 마지막에 누가 언제 건드렸나
 *  보고, 그 자리를 **보는 자가 있는지** 찾는 것. 네 번 왕복이다.
 *
 *  이 자는 그 네 가지를 **먼저 해서 한 장으로** 내놓는다:
 *
 *    1. 갈래 · 급함 · 까닭 후보 · 다음 걸음   ← `rules.js` (아는 것 열둘)
 *    2. **그 줄의 코드**를 열어 위아래까지 찍는다
 *    3. 그 파일을 마지막에 바꾼 커밋 (언제 · 무엇) — 새 고침 뒤에 생긴 오류인지 본다
 *    4. **그 자리를 보는 자가 있는가** — 없으면 「자 없음」. 고치고 자를 안 만들면
 *       같은 오류가 다시 온다(이 앱이 여러 번 겪었다)
 *
 *  그리고 **순서를 정해 준다** — 급함 × 빈도 × 사람 수. 많이 나는 것부터가 아니라
 *  **사람 기록이 걸린 것부터**다.
 *
 *  ── 선 ──
 *
 *  **읽기만 한다.** 고치지 않는다 — 고치는 것은 사람(부총재 세션)이 읽고 판단한 뒤다.
 *  기록에는 본문 · 쿠키가 없으므로(`utils/errorLog.js`) 이 자도 사람 글을 못 본다.
 *  보고서는 `agents/buchongjae/last-report.json` 에 남긴다(정석 검사소와 같은 결).
 * ─────────────────────────────────────────────────────────────────────────────
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { matchRule, fallback } = require('./rules.js');

const ROOT = path.resolve(__dirname, '..', '..');
const JSON_ONLY = process.argv.includes('--json');
const 전부 = process.argv.includes('--전부');

const 한국시 = (iso) => {
  try { return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }); }
  catch { return String(iso); }
};

/** 오류 한 줄에서 **우리 코드 자리**를 꺼낸다 (`db.js:812` · `routes/workouts.js:120`) */
function 자리들(detail) {
  const out = [];
  const re = /([A-Za-z0-9_.\-/]+\.(?:js|cjs|mjs)):(\d+)/g;
  let m;
  while ((m = re.exec(String(detail)))) out.push({ 파일: m[1], 줄: Number(m[2]) });
  return out;
}

const 찾은자리 = new Map();

function 훑기(디렉, 이름, 깊이) {
  if (깊이 < 0) return null;
  let 목록 = [];
  try { 목록 = fs.readdirSync(디렉, { withFileTypes: true }); } catch { return null; }
  for (const e of 목록) {
    const p = path.join(디렉, e.name);
    if (e.isFile() && e.name === 이름) return p;
    if (e.isDirectory() && e.name !== 'node_modules') {
      const r = 훑기(p, 이름, 깊이 - 1);
      if (r) return r;
    }
  }
  return null;
}

/**
 * 적힌 파일 이름으로 **진짜 파일을 찾는다.** 기록에는 짧게 적혀 있다(`src/db.js`) —
 * 어느 쪽 `src` 인지는 모른다. 꼬리부터 맞춰 보고, 안 되면 이름만으로 훑는다
 */
function 파일찾기(짧은이름) {
  if (찾은자리.has(짧은이름)) return 찾은자리.get(짧은이름);
  const 꼬리 = 짧은이름.replace(/^.*?((?:src|scripts)\/)/, '$1');
  let 답 = null;
  for (const t of ['backend', 'frontend', '.']) {
    const p = path.join(ROOT, t, 꼬리);
    if (fs.existsSync(p)) { 답 = path.relative(ROOT, p).replace(/\\/g, '/'); break; }
  }
  if (!답) {
    const 이름 = path.basename(꼬리);
    for (const t of ['backend/src', 'frontend/src', 'backend/scripts', 'frontend/scripts']) {
      const 찾음 = 훑기(path.join(ROOT, t), 이름, 4);
      if (찾음) { 답 = path.relative(ROOT, 찾음).replace(/\\/g, '/'); break; }
    }
  }
  찾은자리.set(짧은이름, 답);
  return 답;
}

/** 그 줄과 위아래 두 줄 — **코드를 직접 보여준다** */
function 그줄(파일, 줄) {
  let 글;
  try { 글 = fs.readFileSync(path.join(ROOT, 파일), 'utf-8').split(/\r?\n/); } catch { return null; }
  const 처음 = Math.max(0, 줄 - 3);
  const 끝 = Math.min(글.length, 줄 + 2);
  const 줄들 = [];
  for (let i = 처음; i < 끝; i++) 줄들.push({ no: i + 1, 글: 글[i], 그자리: i + 1 === 줄 });
  return 줄들;
}

/** 그 파일을 **마지막에 바꾼 커밋** */
function 마지막손(파일) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%h|%ad|%s', '--date=short', '--', 파일],
      { cwd: ROOT, encoding: 'utf-8' }).trim();
    if (!out) return null;
    const 쪽 = out.split('|');
    return { 해시: 쪽[0], 날: 쪽[1], 말: 쪽.slice(2).join('|').slice(0, 80) };
  } catch { return null; }
}

/**
 * **그 자리를 보는 자가 있는가.** 자 이름이 아니라 **자가 그 파일을 읽는가**로 본다 —
 * 이 앱의 자들은 대개 소스를 읽어 꼴을 견주거나 그 손을 직접 부른다
 */
let 자목록 = null;
function 자있나(파일) {
  if (!자목록) {
    자목록 = [];
    for (const d of ['backend/scripts', 'frontend/scripts', 'scripts']) {
      const 터 = path.join(ROOT, d);
      let 목록 = [];
      try { 목록 = fs.readdirSync(터); } catch { continue; }
      for (const f of 목록) {
        if (!/^check-.*\.cjs$/.test(f)) continue;
        try { 자목록.push({ 이름: d + '/' + f, 글: fs.readFileSync(path.join(터, f), 'utf-8') }); }
        catch { /* 못 읽으면 건너뛴다 */ }
      }
    }
  }
  const 이름 = path.basename(파일);
  return 자목록.filter((z) => z.글.includes(이름)).map((z) => z.이름);
}

// ── 기록을 읽는다 ───────────────────────────────────────────────────────────
const storage = require(path.join(ROOT, 'backend/src/storage.js'));

storage.init().then(() => {
  const { recentErrors, groupErrors } = require(path.join(ROOT, 'backend/src/utils/errorLog.js'));
  const 전체 = recentErrors(300);
  const 묶음 = groupErrors(전체).map((g) => Object.assign({}, g, { 출처: '서버' }));

  // ── **화면에서 난 것도 읽는다** ── (2026-11-26 · 맵시)
  //
  // 처음 판은 **서버 기록만** 봤다. 그런데 사람이 겪는 고장의 큰 쪽은 화면에서 난다 —
  // **흰 화면**이 그것이고, 서버에는 한 줄도 안 남는다. 그 길은 따로 있었다:
  // `ErrorBoundary` → `POST /api/client-error` → `db.addClientError`(백 건 보관).
  // 읽지 않으면 이 관리자가 「오류 0건」이라고 말하는데 화면은 흰 채로 있다.
  //
  // 묶는 열쇠는 **메시지**다(`path` 는 붙여만 둔다) — 같은 까닭이 화면마다 따로 세면
  // 몇 번 났는지가 흩어진다.
  const 화면묶음 = (() => {
    let rows = [];
    try { rows = require(path.join(ROOT, 'backend/src/db.js')).getClientErrors() || []; }
    catch { return []; }
    const by = new Map();
    for (const r of rows) {
      const 열쇠 = String(r.message || '').trim();
      if (!열쇠) continue;
      if (!by.has(열쇠)) {
        by.set(열쇠, { what: 열쇠, count: 0, first: r.at, last: r.at, 출처: '화면', 화면들: new Set(), 스택: r.stack || null });
      }
      const g = by.get(열쇠);
      g.count += 1;
      if (r.at < g.first) g.first = r.at;
      if (r.at > g.last) g.last = r.at;
      if (r.path) g.화면들.add(r.path);
      if (!g.스택 && r.stack) g.스택 = r.stack;
    }
    return [...by.values()].map((g) => Object.assign(g, { 화면들: [...g.화면들].slice(0, 5) }));
  })();
  const 화면건수 = 화면묶음.reduce((n, g) => n + g.count, 0);

  // 사람 수 — 한 사람만 겪는 것과 모두가 겪는 것은 **다른 일**이다
  const 사람수 = new Map();
  for (const e of 전체) {
    const 열쇠 = e.detail.replace(/ · u\d+ · /, ' · ').replace(/^[a-z]+ · /, '');
    const u = (e.detail.match(/ · u(\d+) · /) || [])[1];
    if (!사람수.has(열쇠)) 사람수.set(열쇠, new Set());
    if (u) 사람수.get(열쇠).add(u);
  }

  const 건들 = [...묶음, ...화면묶음].map((g) => {
    const 규칙 = matchRule(g.what, g.출처) || fallback(g.what);
    const 자리 = 자리들(g.what).map((z) => {
      const 참파일 = 파일찾기(z.파일);
      return {
        적힌이름: z.파일, 파일: 참파일, 줄: z.줄,
        코드: 참파일 ? 그줄(참파일, z.줄) : null,
        마지막손: 참파일 ? 마지막손(참파일) : null,
        자: 참파일 ? 자있나(참파일) : [],
      };
    });
    const 사람 = (사람수.get(g.what) || new Set()).size;
    // 순서 — **급함이 먼저**다. 같은 급함 안에서 빈도 · 사람 수로 가른다
    const 무게 = (5 - 규칙.급함) * 1000 + Math.min(g.count, 99) * 5 + Math.min(사람, 50);
    return Object.assign({}, g, { 사람, 규칙, 자리, 무게 });
  }).sort((a, b) => b.무게 - a.무게);

  const 보고서 = {
    언제: new Date().toISOString(),
    어디: process.env.DATABASE_URL ? '라이브(Postgres)' : '내 컴퓨터(파일)',
    오류수: 전체.length,
    가지수: 건들.length,
    모르는꼴: 건들.filter((b) => b.규칙.모름).length,
    자없는자리: 건들.filter((b) => b.자리.some((z) => z.파일 && z.자.length === 0)).length,
    화면오류수: 화면건수,
    건들: 건들.map((b) => ({
      무엇: b.what, 출처: b.출처, 담당: b.규칙.담당 || '부총재',
      갈래: b.규칙.갈래, 급함: b.규칙.급함, 횟수: b.count, 사람: b.사람,
      화면들: b.화면들 || null, 볼곳: b.규칙.볼곳,
      처음: b.first, 마지막: b.last, 까닭: b.규칙.까닭, 다음: b.규칙.다음,
      사람에게: b.규칙.사람,
      자리: b.자리.map((z) => ({ 파일: z.파일 || z.적힌이름, 줄: z.줄, 자: z.자, 마지막손: z.마지막손 })),
    })),
  };

  const 보고서길 = path.join(__dirname, 'last-report.json');
  try { fs.writeFileSync(보고서길, JSON.stringify(보고서, null, 2), 'utf-8'); } catch { /* 못 써도 찍는다 */ }
  if (JSON_ONLY) { console.log(JSON.stringify(보고서, null, 2)); process.exit(0); }

  // ── 사람이 읽는 한 장 ────────────────────────────────────────────────────
  const 선 = '─'.repeat(74);
  console.log('');
  console.log(선);
  console.log('  부총재 오류 관리자 — ' + 보고서.어디 + ' · ' + 한국시(보고서.언제));
  console.log(선);

  if (전체.length === 0 && 화면건수 === 0) {
    console.log('');
    console.log('  터진 기록이 없다 (서버 · 화면 둘 다). 라이브를 보려면 DATABASE_URL 을 주고 돌린다.');
    console.log('');
    process.exit(0);
  }

  console.log('');
  console.log('  오류 ' + (보고서.오류수 + 화면건수) + '건(서버 ' + 보고서.오류수 + ' · 화면 ' + 화면건수 + ') · ' + 보고서.가지수 + '가지'
    + ' · 모르는 꼴 ' + 보고서.모르는꼴 + '가지 · 자 없는 자리 ' + 보고서.자없는자리 + '가지');
  console.log('');
  console.log('  급함: 1 사람 기록이 걸린다 · 2 사람이 막힌다 · 3 보기 흉하다 · 4 곁일');

  const 보일것 = 전부 ? 건들 : 건들.slice(0, 8);
  보일것.forEach((b, i) => {
    console.log('');
    console.log(선);
    console.log('  ' + (i + 1) + '. [급함 ' + b.규칙.급함 + ' · ' + b.출처 + ' · ' + (b.규칙.담당 || '부총재') + '] ' + b.규칙.갈래
      + '  —  ' + b.count + '번' + (b.사람 ? ' · 사람 ' + b.사람 + '명' : ''));
    console.log(선);
    console.log('  무엇   ' + b.what.slice(0, 160));
    console.log('  언제   ' + 한국시(b.first) + ' ~ ' + 한국시(b.last));
    console.log('  까닭   ' + b.규칙.까닭);
    console.log('  사람   ' + b.규칙.사람);
    console.log('  볼곳   ' + b.규칙.볼곳);
    console.log('  다음   ' + b.규칙.다음);
    if (b.화면들 && b.화면들.length) console.log('  화면   ' + b.화면들.join(' · '));
    if (b.출처 === '화면' && b.스택) console.log('  스택   ' + String(b.스택).slice(0, 200));
    for (const z of b.자리) {
      if (!z.파일) {
        console.log('');
        console.log('  자리   ' + z.적힌이름 + ':' + z.줄 + ' — 그 파일을 못 찾았다');
        continue;
      }
      console.log('');
      console.log('  자리   ' + z.파일 + ':' + z.줄
        + (z.마지막손 ? '   (마지막 손 ' + z.마지막손.해시 + ' · ' + z.마지막손.날 + ')' : ''));
      if (z.마지막손) console.log('         ' + z.마지막손.말);
      console.log('  자     ' + (z.자.length ? z.자.join(' · ') : '★ 없다 — 고치면 자를 같이 만든다'));
      if (z.코드) {
        console.log('');
        for (const c of z.코드) {
          console.log('    ' + (c.그자리 ? '▶' : ' ') + ' ' + String(c.no).padStart(5)
            + ' │ ' + (c.글 || '').slice(0, 100));
        }
      }
    }
  });

  if (!전부 && 건들.length > 보일것.length) {
    console.log('');
    console.log('  … ' + (건들.length - 보일것.length) + '가지 더 있다 (--전부)');
  }
  console.log('');
  console.log(선);
  console.log('  위에서부터 고친다. 고침 하나에 **자 하나** · 되돌려-FAIL 까지가 한 건이다.');
  console.log('  보고서: ' + path.relative(ROOT, 보고서길).replace(/\\/g, '/'));
  console.log(선);
  console.log('');
  process.exit(0);
}).catch((err) => {
  console.error('저장소를 열지 못했다:', err.message);
  process.exit(1);
});
