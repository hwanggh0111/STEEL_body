#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  정석 검사소 — 하청 검사기 (2026-11-09)
 *
 *    node agents/jeongseok/inspect.cjs            전부
 *    node agents/jeongseok/inspect.cjs --offline  라이브 호출 없이
 *    node agents/jeongseok/inspect.cjs --json     보고서 JSON 만 찍는다
 *
 *  ── 왜 따로 짰나 ──
 *
 *  본사 검사는 117개가 있고 **전부 초록이었다.** 그런데 그 초록이 뜬 바로 그때
 *  라이브에서는 고객센터 최신 공지 두 줄이 영영 「불러오는 중…」이었다.
 *  까닭은 검사의 질이 아니라 **보는 자리**다 —
 *
 *    본사 검사가 보는 것 : 작업 트리의 파일
 *    사람이 쓰는 것      : 커밋돼서 배포된 것
 *
 *  이 둘이 어긋나면 본사 검사는 **구조적으로** 못 본다. 작업 트리만 보니까.
 *  그래서 이 검사기는 본사 검사를 다시 하지 않는다. **본사 검사가 설 수 없는
 *  자리에만 선다** —
 *
 *    1. 대조   작업 트리 ↔ HEAD ↔ 라이브. 생성물이 미커밋이면 그것이 결함이다
 *    2. 실물   배포본이 가리키는 자원이 배포본에 실제로 있는가
 *    3. 분기   「받았는데 그 줄이 없음」을 로딩으로 삼키는 자리가 있는가
 *    4. 류     결함류별 후보 — 숫자는 결함 수가 아니라 **읽어야 할 자리 수**다
 *
 *  **후보와 결함을 가른다.** 4번이 뱉는 것은 후보다. 사람(정석)이 읽어서
 *  확정한 것만 결함으로 센다 — 후보를 결함으로 세면 비율이 거짓말을 한다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const LIVE = 'https://steel-body.onrender.com';
const OFFLINE = process.argv.includes('--offline');
const JSON_ONLY = process.argv.includes('--json');

const rows = [];
const add = (분류, id, 결과, 근거) => rows.push({ 분류, id, 결과, 근거 });
const say = (...a) => { if (!JSON_ONLY) console.log(...a); };

const git = (...args) => {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }); }
  catch { return null; }
};
const readJSON = (s) => { try { return JSON.parse(s); } catch { return null; } };
const live = async (p) => {
  if (OFFLINE) return null;
  try {
    const r = await fetch(LIVE + p, { signal: AbortSignal.timeout(20000) });
    return { status: r.status, text: await r.text(), type: r.headers.get('content-type') || '' };
  } catch (e) { return { status: 0, text: '', type: '', err: String(e.message || e) }; }
};

// ── 생성물 목록 ──
//
// **미커밋을 결함으로 세지 않는다** (2026-11-09 고침). 처음 판은 그렇게 셌는데 틀렸다 —
// 까닭 둘이다.
//
//   · 배포가 이것을 **다시 만든다.** `render.yaml` 의 `buildCommand` 가 `npm run build`
//     이고 그 `prebuild` 가 `gen-feed.mjs` 를 돌린다. 커밋된 본문은 애초에 실리지 않는다
//   · 공지 피드는 **커밋 해시로 열쇠를 매긴다.** 커밋은 제 해시를 제 안에 담을 수 없으니
//     커밋 N 의 줄은 N+1 에 실린다 — 빌드를 한 번 돌리면 **정상적으로** 더러워진다
//
// 그래서 더러운 것은 **적어만 둔다**(READ). 진짜로 깨져야 하는 자는 아래 「HEAD 짝」이다 —
// 그것이 어긋나면 한쪽만 커밋된 것이고, 사람이 눌러도 본문이 안 오는 줄이 생긴다.
const 생성물 = [
  'frontend/src/data/feedIndex.json',
  'frontend/public/feed-detail.json',
  'frontend/src/data/feedList.json',
  'frontend/src/data/changelog.json',
];

// ─── 1. 대조 ──────────────────────────────────────────────────────────────
function 대조() {
  say('\n── 1. 대조 — 작업 트리 ↔ HEAD ↔ 라이브 ──');

  const status = git('status', '--porcelain') || '';
  const 더러운 = status.split('\n').map(l => l.slice(3).trim()).filter(Boolean);

  for (const f of 생성물) {
    if (!fs.existsSync(path.join(ROOT, f))) { add('대조', `생성물:${f}`, 'SKIP', '파일 없음'); continue; }
    const 미커밋 = 더러운.includes(f);
    add('대조', `생성물:${f}`, 미커밋 ? 'READ' : 'PASS',
      미커밋 ? '미커밋 — 빌드를 돌렸으면 정상이다. 다음 커밋에 같이 올라가는지만 본다' : '작업 트리 = HEAD');
    say(`  ${미커밋 ? 'READ' : 'OK  '} ${f}${미커밋 ? '  ← 미커밋 (빌드 뒤라면 정상)' : ''}`);
  }

  // HEAD 기준 목록↔본문 짝. **배포되는 것이 HEAD 다**
  const idxH = readJSON(git('show', 'HEAD:frontend/src/data/feedIndex.json') || '');
  const detH = readJSON(git('show', 'HEAD:frontend/public/feed-detail.json') || '');
  if (idxH && detH) {
    const items = idxH.items || [];
    const 본문있다할것 = items.filter(r => r.has).map(r => r.key);
    const 빠진것 = 본문있다할것.filter(k => !(k in detH));
    const 고아 = Object.keys(detH).filter(k => !items.some(r => r.key === k));
    add('대조', 'HEAD 목록↔본문 짝', 빠진것.length || 고아.length ? 'FAIL' : 'PASS',
      빠진것.length ? `has:true 인데 본문 없음 — ${빠진것.join(' ')}` :
        고아.length ? `목록에 없는 본문 — ${고아.join(' ')}` : `${본문있다할것.length}건 전부 짝이 맞다`);
    say(`  ${빠진것.length || 고아.length ? 'FAIL' : 'OK  '} HEAD 목록↔본문 — has:true ${본문있다할것.length}건` +
      (빠진것.length ? `, 본문 없음 ${빠진것.length}건 [${빠진것.join(' ')}]` : '') +
      (고아.length ? `, 고아 본문 ${고아.length}건 [${고아.join(' ')}]` : ''));
  } else add('대조', 'HEAD 목록↔본문 짝', 'SKIP', 'HEAD 에서 못 읽음');
}

// ─── 2. 실물 ──────────────────────────────────────────────────────────────
async function 실물() {
  say('\n── 2. 실물 — 배포본이 가리키는 것이 배포본에 있는가 ──');
  if (OFFLINE) { add('실물', '라이브 전수', 'SKIP', '--offline'); say('  건너뜀 (--offline)'); return; }

  const idx = await live('/');
  if (!idx || idx.status !== 200) {
    add('실물', '라이브 index', 'FAIL', `index 가 ${idx ? idx.status : '무응답'}`);
    say(`  FAIL 라이브 index — ${idx ? idx.status : '무응답'}`); return;
  }
  add('실물', '라이브 index', 'PASS', `200 · ${idx.text.length}B`);

  const refs = [...new Set((idx.text.match(/(?:src|href)="(\/[^"]+)"/g) || [])
    .map(s => s.replace(/.*"(.*)"/, '$1')))];
  let main = '';
  for (const u of refs) {
    const r = await live(u);
    const ok = r && r.status === 200 && r.text.length > 0;
    if (ok && /\/assets\/index-.*\.js$/.test(u)) main = r.text;
    add('실물', `자원:${u}`, ok ? 'PASS' : 'FAIL', ok ? `200 · ${r.text.length}B` : `${r ? r.status : '무응답'}`);
    say(`  ${ok ? 'OK  ' : 'FAIL'} ${u}  ${r ? r.status : '-'}`);
  }

  // ── 라이브 본문 ↔ **묶음에 실린 목록** ── (2026-11-09 고침)
  //
  // 처음 판은 `index.html` 이 가리키는 조각 셋만 긁어서 **「키 0건」**이라 적었다.
  // 목록은 거기 없다 — 고객센터는 **느리게 받는 조각**이고(`FeedList-….js`), 그 이름은
  // 주 번들의 `__vite__mapDeps` 안에 있다. 내 자가 못 보는 자리를 「통과」로 적으면
  // 그것이 본사 검사와 똑같은 눈먼 자리다. 그래서 조각을 **전부** 걷는다.
  //
  // 그리고 받는 주소도 묶음이 부르는 그대로 쓴다 — 본문은 판이 붙은 주소로 받는다
  // (`/feed-detail.json?v=…`). 판 없이 받으면 이레 묵은 것이 와서 **라이브가 아니라
  // 내 캐시를 재는 것**이 된다.
  const chunks = [...new Set([
    ...(/m\.f=\[([^\]]+)\]/.exec(main) ? /m\.f=\[([^\]]+)\]/.exec(main)[1]
      .split(',').map((x) => x.trim().replace(/^"|"$/g, '')) : []),
    ...(main.match(/"\.\/[A-Za-z0-9_.-]+\.js"/g) || []).map((x) => 'assets/' + x.replace(/"|\.\//g, '')),
  ])];
  add('실물', '조각 목록', chunks.length ? 'PASS' : 'FAIL', `${chunks.length}개`);
  say(`  ${chunks.length ? 'OK  ' : 'FAIL'} 조각 ${chunks.length}개를 걷는다`);

  let 목록조각 = null; let 본문조각 = null;
  for (const c of chunks) {
    const r = await live('/' + c.replace(/^\/+/, ''));
    if (!r || r.status !== 200) continue;
    if (/feed-detail\.json/.test(r.text)) 본문조각 = { c, t: r.text };
    if (/key:"(?:[0-9a-f]{7}|n-20)/.test(r.text)) 목록조각 = { c, t: r.text };
    if (목록조각 && 본문조각) break;
  }

  if (!목록조각) {
    add('실물', '묶음 속 목록', 'SKIP', '조각에서 목록을 못 찾았다 — 묶음 모양이 바뀌었다');
    say('  건너뜀 묶음 속 목록 — 못 찾았다(묶음 모양이 바뀌었나)');
  } else {
    const 판 = (/[0-9a-f]{10}/.exec((/detailVersion:"([0-9a-f]{10})"/.exec(목록조각.t) || [])[1] || '') || [])[0]
      || ((/detailVersion:"([0-9a-f]{10})"/.exec(목록조각.t) || [])[1] || null);
    const 주소 = 판 ? `/feed-detail.json?v=${판}` : '/feed-detail.json';
    const det = await live(주소);
    const detJ = det && det.status === 200 ? readJSON(det.text) : null;
    const 열쇠 = [...new Set((목록조각.t.match(/key:"([^"]+)"/g) || []).map((x) => x.slice(5, -1)))];
    if (!detJ) {
      add('실물', '라이브 본문', 'FAIL', `${주소} 이 ${det ? det.status : '무응답'}`);
      say(`  FAIL ${주소} — ${det ? det.status : '무응답'}`);
    } else {
      const 빠진 = 열쇠.filter((k) => !(k in detJ));
      add('실물', '묶음 목록 ↔ 라이브 본문', 빠진.length ? 'FAIL' : 'PASS',
        `조각 ${목록조각.c} · 판 ${판 || '없음'} · 목록 열쇠 ${열쇠.length} · 본문 ${Object.keys(detJ).length}`
        + (빠진.length ? ` · **본문 없음 ${빠진.length}** — ${빠진.slice(0, 8).join(' ')}` : ' · 어긋남 0'));
      say(`  ${빠진.length ? 'FAIL' : 'OK  '} 묶음 목록 ↔ 본문 — 열쇠 ${열쇠.length} · 본문 ${Object.keys(detJ).length}`
        + (빠진.length ? ` · 없음 ${빠진.length} [${빠진.slice(0, 8).join(' ')}]` : ' · 어긋남 0')
        + `   (판 ${판 || '없음'})`);
    }
    // **판이 주소에 붙어 있는가** — 이것이 11/09 뿌리를 막은 손이다. 걷히면 이레가 돌아온다
    const 판붙음 = 본문조각 ? /feed-detail\.json\?v=/.test(본문조각.t) : false;
    add('실물', '본문 주소에 판이 붙는다', 판붙음 ? 'PASS' : 'FAIL',
      본문조각 ? `${본문조각.c}` : '본문을 받는 조각을 못 찾았다');
    say(`  ${판붙음 ? 'OK  ' : 'FAIL'} 본문 주소에 판이 붙는다 ${본문조각 ? '(' + 본문조각.c + ')' : ''}`);
  }

  const h = await live('/api/health');
  add('실물', 'api/health', h && h.status === 200 ? 'PASS' : 'FAIL', `${h ? h.status : '무응답'}`);
  say(`  ${h && h.status === 200 ? 'OK  ' : 'FAIL'} /api/health  ${h ? h.status : '-'}`);
}

// ─── 3. 분기 ──────────────────────────────────────────────────────────────
// 「아직 안 옴」·「못 받음」은 갈라놨는데 **「받았는데 그 줄이 없음」**이 없는 자리.
// 그 자리에서는 로딩 문구가 영영 돈다. 11/9 에 FeedList 가 그랬다.
function 분기() {
  say('\n── 3. 분기 — 「받았는데 비었다」를 로딩으로 삼키는 자리 ──');
  const 로딩말 = /불러오는 중|로딩 중|받는 중/;
  const 후보 = [];
  for (const f of 파일들(['frontend/src'], /\.jsx$/)) {
    const src = fs.readFileSync(f, 'utf8');
    if (!로딩말.test(src)) continue;
    const L = src.split('\n');
    L.forEach((line, i) => {
      if (!로딩말.test(line)) return;
      if (/^\s*(\/\/|\*)/.test(line)) return;
      // 그 로딩 문구가 **없음/빈 것** 분기와 같은 식 안에 있는가
      const 창 = L.slice(Math.max(0, i - 14), i + 8).join('\n');
      const 없음분기 = /없|비어|empty|length === 0|\?\?|: *null/.test(창);
      const 받음확인 = /loaded|details\s*&&|data\s*&&|!= *null|!== *null|Array\.isArray/.test(창);
      if (!(없음분기 && 받음확인)) 후보.push(`${rel(f)}:${i + 1}`);
    });
  }
  add('분기', '로딩 영구 후보', 후보.length ? 'READ' : 'PASS',
    후보.length ? 후보.join(' ') : '로딩 문구 자리 전부 받음·없음 분기를 같이 들고 있다');
  say(후보.length ? `  읽을 자리 ${후보.length}곳: ${후보.join('  ')}` : '  OK   삼키는 자리 없음');
}

// ─── 4. 류 ────────────────────────────────────────────────────────────────
function 류() {
  say('\n── 4. 결함류 후보 (숫자는 결함 수가 아니다 — 읽어야 할 자리 수다) ──');
  const files = 파일들(['frontend/src', 'backend/src'], /\.(js|jsx|mjs)$/);
  const near = (L, i, re, s) => L.slice(Math.max(0, i - s), i + s + 1).some(l => re.test(l));
  const 류들 = {
    'A 조용한 실패': { 자리: 0, 후보: [] },
    'B JSON.parse 무방비': { 자리: 0, 후보: [] },
    'D 구독·타이머 누수': { 자리: 0, 후보: [] },
    'E 분모 0': { 자리: 0, 후보: [] },
  };
  for (const f of files) {
    const L = fs.readFileSync(f, 'utf8').split('\n');
    L.forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*')) return;
      const at = `${rel(f)}:${i + 1}`;
      if (/\bclient\.(get|post|put|patch|delete)\(/.test(line)) {
        류들['A 조용한 실패'].자리++;
        if (!near(L, i, /\.catch\(|catch\s*\(|try\s*\{/, 14)) 류들['A 조용한 실패'].후보.push(at);
      }
      if (/JSON\.parse\(/.test(line)) {
        류들['B JSON.parse 무방비'].자리++;
        if (!near(L, i, /try\s*\{|catch\s*\(|safeParse|tryParse/, 12)) 류들['B JSON.parse 무방비'].후보.push(at);
      }
      if (/addEventListener\(|setInterval\(/.test(line)) {
        류들['D 구독·타이머 누수'].자리++;
        if (!near(L, i, /removeEventListener\(|clearInterval\(|stopTicker|return \(\) =>/, 35)) 류들['D 구독·타이머 누수'].후보.push(at);
      }
      const m = /([A-Za-z_$][\w$.\[\]]*)\s*\/\s*([A-Za-z_$][\w$.()\[\]]*)/.exec(line);
      if (m && !/['"`]/.test(line) && !/require|import|https?:/.test(line)) {
        류들['E 분모 0'].자리++;
        if (!near(L, i, /\|\|\s*1|Math\.max|> 0|<= 0|isFinite|length \?|&&|!\w+\) return/, 4)) 류들['E 분모 0'].후보.push(at);
      }
    });
  }
  for (const [k, v] of Object.entries(류들)) {
    add('류', k, v.후보.length ? 'READ' : 'PASS', `자리 ${v.자리} · 후보 ${v.후보.length}` +
      (v.후보.length ? ` — ${v.후보.slice(0, 12).join(' ')}${v.후보.length > 12 ? ' …' : ''}` : ''));
    say(`  ${v.후보.length ? 'READ' : 'OK  '} ${k} — 자리 ${v.자리} · 후보 ${v.후보.length}`);
    if (v.후보.length) say('        ' + v.후보.slice(0, 12).join('  ') + (v.후보.length > 12 ? '  …' : ''));
  }
  add('류', '훑은 운영 파일', 'PASS', `${files.length}개`);
}

// ── 거들이 ──
function 파일들(roots, re) {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
      else if (re.test(e.name)) out.push(p);
    }
  };
  roots.forEach(r => walk(path.join(ROOT, r)));
  return out;
}
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

// ─── 달리기 ───────────────────────────────────────────────────────────────
(async () => {
  say('정석 검사소 — ' + new Date().toISOString().slice(0, 16).replace('T', ' ') +
    (OFFLINE ? ' · offline' : ' · ' + LIVE));
  대조();
  await 실물();
  분기();
  류();

  const 판정 = (r) => rows.filter(x => x.결과 === r).length;
  const 센것 = rows.filter(x => x.결과 === 'PASS' || x.결과 === 'FAIL').length;
  const FAIL = 판정('FAIL');
  const 보고서 = {
    때: new Date().toISOString(),
    라이브: OFFLINE ? null : LIVE,
    HEAD: (git('rev-parse', '--short', 'HEAD') || '').trim(),
    센것, FAIL, READ: 판정('READ'), SKIP: 판정('SKIP'),
    결함비율: 센것 ? +(FAIL / 센것 * 100).toFixed(1) : 0,
    항목: rows,
  };
  fs.writeFileSync(path.join(__dirname, 'last-report.json'), JSON.stringify(보고서, null, 2), 'utf8');

  if (JSON_ONLY) { console.log(JSON.stringify(보고서, null, 2)); process.exit(FAIL ? 1 : 0); }

  const 줄 = '─'.repeat(62);
  say('\n' + 줄);
  say(`판정한 항목 ${센것} · PASS ${센것 - FAIL} · **FAIL ${FAIL}** · 읽을 자리 ${판정('READ')} · 건너뜀 ${판정('SKIP')}`);
  say(`결함비율 ${보고서.결함비율}%   (FAIL ÷ 판정한 항목)`);
  if (FAIL) rows.filter(x => x.결과 === 'FAIL').forEach(x => say(`  FAIL  [${x.분류}] ${x.id} — ${x.근거}`));
  say('읽을 자리(READ)는 결함이 아니다 — 정석이 읽어서 확정한다');
  say(줄);
  say(FAIL ? `${FAIL}건이 통과하지 못했다` : '대조·실물 전부 통과');
  process.exit(FAIL ? 1 : 0);
})();
