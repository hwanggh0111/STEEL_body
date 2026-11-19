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
// `gen-changelog.mjs` 의 `SECRET_SCOPE` 를 **그 파일에서 읽어** 쓴다.
// 자에 상수를 베끼면 갈래가 늘 때 자만 모른다 (2026-11-16 · 벼림 지적).
let _비밀갈래 = undefined;
function 비밀갈래() {
  if (_비밀갈래 !== undefined) return _비밀갈래;
  _비밀갈래 = null;
  try {
    const src = fs.readFileSync(path.join(ROOT, 'frontend/scripts/gen-changelog.mjs'), 'utf8');
    const m = /const\s+SECRET_SCOPE\s*=\s*\/(.+?)\/([a-z]*)\s*;/.exec(src);
    if (m) _비밀갈래 = new RegExp(m[1], m[2]);
  } catch { /* 못 읽으면 보안 줄 판정을 건너뛴다 — 거짓 FAIL 보다 낫다 */ }
  return _비밀갈래;
}
// 묶음 조각의 목록 줄을 끊어 읽는다 — **열쇠를 긁는 것이 아니다**.
//
// 전에는 `key:"…"` 를 전부 긁어 「본문 없음」을 셌다. 그런데 11/13 부터
// **갈래에 「보안」이 든 커밋은 본문을 통째로 뺀다** (`gen-changelog.mjs` 의
// `SECRET_SCOPE`). 그런 줄은 묶음에도 `has` 가 아예 안 붙는다 — 눌러도 본문을
// 안 받는다. `has` 를 안 보면 **없는 것이 당연한 줄**을 FAIL 로 낸다
// (11/16 에 `bbe7372`·`ea80aef` 로 실제로 났다 — 내 자의 거짓이었다).
//
// 그래서 **`has` 가 붙은 줄만** 본문을 요구하고, 거꾸로 **보안 줄에 본문이
// 있으면** 그것을 FAIL 로 낸다 — 그쪽이 진짜 사고다 (11/13 뿌리 `85783ec`).
function 묶음줄(조각글, 비밀) {
  const 줄 = [...조각글.matchAll(/key:"([^"]+)"((?:(?!key:")[\s\S]){0,800})/g)]
    .map((m) => ({ key: m[1], 뒤: m[2] }));
  return {
    줄,
    열쇠: [...new Set(줄.filter((r) => /has:(?:!0|true)/.test(r.뒤)).map((r) => r.key))],
    보안줄: !비밀 ? [] : 줄.filter((r) => {
      const m = /scope:"([^"]*)"/.exec(r.뒤);
      return m && 비밀.test(m[1]);
    }).map((r) => r.key),
  };
}

// ── 되돌려-FAIL ── `--되돌려` 로 돈다.
// 고쳐 놓고 「PASS 가 떴다」로 끝내면 자가 장식이 된다. 일부러 어긋난 묶음을
// 먹여 **FAIL 이 보이는지**까지 본다 (2026-11-16 · 벼림 요청).
function 되돌려() {
  const 비밀 = 비밀갈래();
  if (!비밀) { console.log('되돌려: SECRET_SCOPE 를 못 읽었다 — 자부터 고쳐라'); return 1; }
  const 보안줄글 = 'key:"aaa1111",date:"2026-11-13",text:"t",label:"고침",scope:"보안"';
  const 보통줄글 = 'key:"bbb2222",date:"2026-11-13",text:"t",label:"고침",scope:"가져오기",has:!0';
  const 본문없는보통 = 'key:"ccc3333",date:"2026-11-13",text:"t",label:"고침",scope:"꼴",has:!0';
  const 판 = [];
  const 보다 = (이름, 조건) => { 판.push([이름, 조건]); console.log(`  ${조건 ? 'OK  ' : 'FAIL'} ${이름}`); };

  // ① 보안 줄은 본문이 없어야 PASS — `has` 가 없으니 「빠진」에도 안 들어간다
  let r = 묶음줄([보안줄글, 보통줄글].join(','), 비밀);
  보다('보안 줄은 본문을 요구하지 않는다', !r.열쇠.includes('aaa1111') && r.보안줄.includes('aaa1111'));
  보다('보안 줄 없는 본문이 FAIL 을 안 만든다', r.열쇠.filter((k) => !(k in { bbb2222: 1 })).length === 0);

  // ② 보안 줄에 본문이 **있으면** FAIL 이어야 한다 (11/13 뿌리)
  보다('보안 줄 본문이 실리면 잡는다', r.보안줄.filter((k) => k in { aaa1111: 1 }).length === 1);

  // ③ 보통 줄이 본문을 잃으면 FAIL 이어야 한다 — 자가 눈 감으면 안 된다
  r = 묶음줄([보통줄글, 본문없는보통].join(','), 비밀);
  보다('has 붙은 줄이 본문을 잃으면 잡는다', r.열쇠.filter((k) => !(k in { bbb2222: 1 })).join() === 'ccc3333');

  // ④ 갈래가 늘어도 자가 따라간다 — 상수를 베끼지 않았는지
  보다('SECRET_SCOPE 를 원본에서 읽는다', 비밀.test('관리자·보안') && !비밀.test('가져오기'));

  // ── ⑤ **셈 0 은 통과가 아니다 — 류 식이 살아 있는가** ── (2026-11-19 · 정석)
  //
  // 11/19 에 네 류의 식을 조여 후보 **46 → 3** 으로 내렸다(읽어 보니 46 이 다 거짓이었다).
  // 그런데 조이다가 **다 꺼버리면** 「후보 0」이 통과처럼 보인다. 그래서 **가짜 조각
  // 넷**을 같은 식에 먹여, 식이 **진짜 결함은 잡는지** 본다.
  const 걸린것 = 류훑기(가짜조각);
  const 잡나 = (류, 자리) => (걸린것[류] ? 걸린것[류].후보 : []).some((p) => p.startsWith(자리));
  보다('가짜 분모 0 을 잡는다 (`합 / 값들.length`)', 잡나('E 분모 0', '가짜/분모0.js'));
  보다('안 치우는 타이머를 잡는다 (`setInterval` 뒤 `clearInterval` 없음)', 잡나('D 구독·타이머 누수', '가짜/누수.jsx'));
  보다('받은 글을 그대로 푸는 `JSON.parse` 를 잡는다', 잡나('B JSON.parse 무방비', '가짜/파스.js'));
  보다('`.catch` 없는 화면 부르기를 잡는다', 잡나('A 조용한 실패', '가짜/조용히.jsx'));

  const 진 = 판.filter(([, ok]) => !ok);
  console.log(진.length ? `되돌려: ${진.length}건이 안 잡힌다 — 자가 거짓이다` : `되돌려: ${판.length}건 전부 잡는다`);
  return 진.length ? 1 : 0;
}

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

  // ── ★ **「정지됨」은 FAIL 이 아니다 — 측정 불가다** ── (2026-11-19 · 정석)
  //
  // 11/17 에 Render 무료 750시간을 다 썼다(같은 저장소에 묶인 무료 서비스가 넷이었고
  // `keepWarm` 이 그걸 다 깨워뒀다). 주인이 셋을 지워 `steel-body` 하나만 남았고,
  // **12/1 에 시간이 리셋되며 다시 뜬다.** 그동안 Render 는 「Service Suspended」를
  // **503** 으로 돌려준다(봇 막이에 걸리면 **429** + Cloudflare 챌린지다).
  //
  // 그걸 FAIL 로 적으면 **매 세션 거짓 FAIL 이 하나씩 붙고 결함비율이 오염된다** —
  // 「자가 지금을 베끼면 거짓이 된다」류다. 코드에는 고칠 것이 없고, 대시보드는
  // 주인 손이다. 그래서 **따로 적고 셈에서 뺀다.** 아래 전수는 index 가 없으면
  // 아무것도 볼 수 없으므로 여기서 멈추는 것은 그대로다.
  const 정지됨 = idx && (idx.status === 503 || idx.status === 429);
  if (정지됨) {
    add('실물', '라이브 전수', 'SKIP',
      `Render 정지(${idx.status}) — 무료 750시간 소진, **12/1 에 리셋되며 다시 뜬다**. 코드 쪽 할 일 없음`);
    say(`  측정 불가 라이브 — Render 정지(${idx.status}). 무료 750시간 소진 · 12/1 리셋`);
    say('            FAIL 이 아니다 — 코드에 고칠 것이 없고 대시보드는 주인 손이다');
    say('            쌓인 커밋의 라이브 도달 확인은 **12/1 에 일괄**로 한다');
    return;
  }
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
    // ── 열쇠를 **줄 단위로** 끊어 읽는다 ── (2026-11-16 고침 · 정석)
    // 전에는 `key:"…"` 를 전부 긁어 「본문 없음」을 셌다. 그런데 11/13 부터
    // **갈래에 「보안」이 든 커밋은 본문을 통째로 뺀다** (`gen-changelog.mjs:109`
    // SECRET_SCOPE). 그런 줄은 묶음에도 `has` 가 아예 안 붙는다 — 눌러도 본문을
    // 안 받는다. 그래서 `has` 를 안 보면 **없는 것이 당연한 둘**을 FAIL 로 낸다
    // (11/16 에 `bbe7372`·`ea80aef` 로 실제로 났다 — 내 자의 거짓이었다).
    // 이제 **`has` 가 붙은 줄만** 본문을 요구하고, 거꾸로 **보안 줄에 본문이
    // 있으면** 그것을 FAIL 로 낸다 — 그쪽이 진짜 사고다(11/13 뿌리).
    const 비밀 = 비밀갈래();
    const { 열쇠, 보안줄 } = 묶음줄(목록조각.t, 비밀);
    if (!detJ) {
      add('실물', '라이브 본문', 'FAIL', `${주소} 이 ${det ? det.status : '무응답'}`);
      say(`  FAIL ${주소} — ${det ? det.status : '무응답'}`);
    } else {
      const 빠진 = 열쇠.filter((k) => !(k in detJ));
      const 새어나온것 = [...new Set(보안줄.filter((k) => k in detJ))];
      const 보안판정 = !비밀 ? 'SKIP' : (새어나온것.length ? 'FAIL' : 'PASS');
      add('실물', '보안 갈래는 본문이 없어야 한다', 보안판정,
        !비밀 ? '`gen-changelog.mjs` 에서 SECRET_SCOPE 를 못 읽었다 — 규칙이 바뀌었나'
          : 새어나온것.length ? `라이브 본문에 보안 커밋 본문이 실렸다 — ${새어나온것.join(' ')}`
            : `보안 줄 ${보안줄.length}건 전부 제목만 (${비밀})`);
      say(`  ${보안판정 === 'SKIP' ? '건너뜀' : 보안판정 === 'FAIL' ? 'FAIL' : 'OK  '} 보안 갈래는 제목만 — `
        + (!비밀 ? 'SECRET_SCOPE 를 못 읽었다' : `보안 줄 ${보안줄.length}건`)
        + (새어나온것.length ? ` · **본문 실림 ${새어나온것.length}** [${새어나온것.join(' ')}]` : ''));
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
//
// ── ★ **본사 자가 이미 보는 것을 내가 또 세고 있었다** ── (2026-11-19 · 정석)
//
// 여기서 「받았는데 비었다를 로딩으로 삼키는 자리」를 세어 매번 **후보 서른둘**을
// 뱉고 있었다. 11/19 에 그 서른둘을 **전수로 읽었다 — 확정 결함 0 이었다.**
// 주석 · `STAGE` 상수 표 · 단추 글자(`busy ? '떠받는 중…'`) · **맞게 가른
// 세 상태**(`loading ? … : failed ? … : …`)였고, `FeedDetailBody` 는 네 상태를
// 차례까지 맞게 들고 있었다.
//
// 그리고 이 류에는 **이미 제 자가 있다** — `frontend/scripts/check-threestate.cjs`
// (11/09 에 세운 그 자다). 두 벌로 세면 **거짓 후보만 서른둘 늘고** 진짜를 보는 눈이
// 둔해진다. 그래서 세는 것은 그쪽에 맡기고, **11/19 에 그 자에 없던 것을 거기에
// 보탰다** — 「로딩 문구를 가진 화면 **전수**」. 그 자가 파일 **넷만 이름으로** 보고
// 있었고 모집단은 **스물일곱**이었다(스물셋은 자 밖이라, 새로 어긋나거나 **새 화면이
// 붙으면** 아무도 몰랐다).
//
// 여기 남기는 것은 **그 자가 살아 있는지** 보는 한 줄이다. 남이 지우거나 모집단
// 섹션이 사라지면 **내 검사소가 그것을 안다** — 자가 자를 지킨다.
function 분기() {
  say('\n── 3. 분기 — 「받았는데 비었다」는 `check-threestate` 가 본다 ──');
  const p = path.join(ROOT, 'frontend/scripts/check-threestate.cjs');
  if (!fs.existsSync(p)) {
    add('분기', '세 상태 자', 'FAIL', 'check-threestate.cjs 가 없다 — 이 류를 보는 자가 사라졌다');
    say('  FAIL check-threestate.cjs 가 없다 — 이 류를 보는 자가 사라졌다');
    return;
  }
  const 글 = fs.readFileSync(p, 'utf8');
  const 모집단섹션 = /모집단 — 로딩 문구를 가진 화면 전수/.test(글)
    && /readdirSync/.test(글)
    && /셈 0 은 통과가 아니다/.test(글);
  add('분기', '세 상태 자 + 모집단 전수', 모집단섹션 ? 'PASS' : 'FAIL',
    모집단섹션 ? 'check-threestate 가 로딩 문구 화면을 **걸어서** 전수로 본다'
      : '그 자가 모집단을 이름으로만 든다 — 새 화면이 붙으면 아무도 모른다 (11/19 에 붙인 섹션이 사라졌다)');
  say(`  ${모집단섹션 ? 'OK  ' : 'FAIL'} check-threestate 가 모집단을 전수로 본다` +
    (모집단섹션 ? '' : '  ← 11/19 에 붙인 섹션이 사라졌다'));
}

// ─── 4. 류 ────────────────────────────────────────────────────────────────
//
// ── ★ **마흔여섯 번 울어서 0건이면 그 자는 죽은 자다** ── (2026-11-19 · 정석)
//
// 11/19 에 이 네 류의 후보 **마흔여섯을 전수로 읽었다**(A 11 · B 2 · D 7 · E 26).
// **확정된 결함은 0 이었다.** 왜 거짓이었는지 하나하나 적는다 —
//
//   E 분모 0 — 스물여섯 중 **열일곱이 정규식 리터럴**이었다(`/<script/i` 의 `/` 를
//     나눗셈으로 읽었다). 남은 아홉은 가드가 있었다 — `session.total ?` ·
//     `weeks >= 1 ?` · `span === 0 ?` · `count ?` 는 **같은 줄**이고,
//     `if (!weight) return null`(composition) · `Number(ratio) > 0 ?`(overlayShot) 는
//     창(±4줄) **바로 밖**이었다. `useWidth` 의 `step` 은 `[1,2,2.5,5,10].find(…)` 라
//     **0 이 될 수 없고**(`raw/mag` 가 1~10 사이라 10 이 늘 참이다), `useBreath` 의
//     `buf.length` 는 `new Uint8Array(1024)` 다
//   D 누수 — 일곱 다 **일부러 끝까지 두는 것**이었다. 서버 타이머는 `unref()` 를 걸어
//     프로세스를 안 붙잡고(`aiGuard`), `Toast` 의 `keydown`·`pointerdown` 은 앱이 사는
//     동안 하나만 붙고, `useBreath` 의 것은 `timerRef` 로 들고 **내려갈 때 치운다**
//     (92행·205행 — 창 35줄 밖이었다)
//   B JSON.parse — 둘 다 **박아 둔 글자**다(보안 자기 점검의 `'{"__proto__":…}'`)
//   A 조용한 실패 — 스토어 안의 `await client.*` 는 **부르는 쪽이 받는다**
//     (`GoalPage` 가 `try/catch` 로 감싸 토스트를 띄운다). `RoutinePage` 의 것은
//     `.catch` 가 **16줄 아래**라 창(14줄) 밖이었다
//
// 마흔여섯 번 울고 0건이면 **다음 세션의 나는 이 목록을 안 읽는다.** 그렇게 자가
// 죽는다. 그래서 식을 조인다 —
//
//   · **정규식 리터럴을 먼저 걷어낸다** (E 후보의 65%가 그것이었다)
//   · **가드를 같은 줄부터** 본다 — 이 앱의 가드는 `x ? a / x : 0` 꼴이 많다
//   · 창을 **4 → 14줄**로 넓힌다 (`if (!x) return` 은 함수 머리에 있다)
//   · 타이머는 **치우는 짝이 그 파일 어디에든 있으면** 넘긴다 — `unref()` ·
//     `clearInterval(들고있던것)` · `removeEventListener`
//   · **모듈 꼭대기에 한 번 붙는 것은 누수가 아니다** — 앱·프로세스가 사는 동안 하나다
//   · `JSON.parse('…')` 처럼 **박아 둔 글자**는 세지 않는다
//   · A 는 **스토어 파일을 안 센다.** 부르는 쪽을 봐야 판정이 되는데 이 자는 파일 하나만
//     본다 — **못 보는 것을 본 척하지 않는다.** 화면 파일만 보고 창도 30줄로 넓힌다
//
// 그리고 **셈 0 은 통과가 아니다.** `--되돌려` 에서 **가짜 조각**을 먹여 식이 살아 있는지
// 본다(진짜 분모 0 · 안 치우는 타이머 · 받은 글을 그대로 푸는 `JSON.parse` ·
// `.catch` 없는 화면). 지금 코드에서 0건이고 **가짜에서 넷 다 잡히면** 그때 「0건」이 사실이다.
function 류() {
  say('\n── 4. 결함류 후보 (숫자는 결함 수가 아니다 — 읽어야 할 자리 수다) ──');
  const files = 파일들(['frontend/src', 'backend/src'], /\.(js|jsx|mjs)$/);
  const 류들 = 류훑기(files.map((f) => ({ 이름: rel(f), 글: fs.readFileSync(f, 'utf8') })));
  for (const [k, v] of Object.entries(류들)) {
    add('류', k, v.후보.length ? 'READ' : 'PASS', `자리 ${v.자리} · 후보 ${v.후보.length}` +
      (v.후보.length ? ` — ${v.후보.slice(0, 12).join(' ')}${v.후보.length > 12 ? ' …' : ''}` : ''));
    say(`  ${v.후보.length ? 'READ' : 'OK  '} ${k} — 자리 ${v.자리} · 후보 ${v.후보.length}`);
    if (v.후보.length) say('        ' + v.후보.slice(0, 12).join('  ') + (v.후보.length > 12 ? '  …' : ''));
  }
  add('류', '훑은 운영 파일', 'PASS', `${files.length}개`);
}

// 정규식 리터럴을 글자로 바꿔 없앤다 — `/<script/i` 의 `/` 는 나눗셈이 아니다.
// 앞에 오는 것으로 가른다: `(` · `,` · `=` · `[` · `:` · 셈씨 · 줄머리 뒤의 `/` 는
// **정규식의 시작**이다 (나눗셈은 이름 · `)` · `]` · 숫자 뒤에 온다)
function 정규식걷기(line) {
  // **줄 끝 주석도 걷는다** — `// data:text/html` 의 `/` 를 나눗셈으로 읽는다
  // (11/19 에 `sanitize.js` 두 줄이 그 꼴로 남았다). 식을 먼저 걷으면 주석 속
  // `//` 가 식으로 안 먹히므로 **식 → 주석** 차례다
  // 한 줄에서 열고 닫는 주석(`{/* 작성/수정 폼 */}`)과 **열고 안 닫은 꼬리**도 걷는다 —
  // 줄을 넘어가는 것은 부르는 쪽이 따라가고, **그 줄 안의 것**은 여기서 걷는다
  const 주석없는것 = line.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\*.*$/, ' ');
  const 식없는것 = 식걷기(주석없는것);
  const i = 식없는것.indexOf('//');
  return i >= 0 ? 식없는것.slice(0, i) : 식없는것;
}

function 식걷기(line) {
  return line.replace(
    /(^\s*|[(,=[:!?&|+\-*{;]\s*)\/(?![/*])(?:\\.|\[(?:\\.|[^\]])*\]|[^/\\\n])+\/[gimsuy]*/g,
    (_, pre) => pre + '«식»'
  );
}

/** 그 줄(또는 창)에 분모를 지키는 손이 있나 */
const 가드있나 = (s) => /\|\|\s*1|Math\.max|>\s*0|<=\s*0|===\s*0|!==\s*0|isFinite|\.length\s*\?|\w\s*\?[^.]|&&|!\w+\)\s*return|return\s+null/.test(s);

/**
 * 네 류를 훑는다.
 * @param {{이름:string, 글:string}[]} 볼것  파일 대신 **글을 받는다** — `--되돌려` 가
 *   가짜 조각을 같은 식에 먹일 수 있어야 한다(자가 자기를 시험한다)
 */
function 류훑기(볼것) {
  const near = (L, i, re, s) => L.slice(Math.max(0, i - s), i + s + 1).some((l) => re.test(l));
  const 류들 = {
    'A 조용한 실패': { 자리: 0, 후보: [] },
    'B JSON.parse 무방비': { 자리: 0, 후보: [] },
    'D 구독·타이머 누수': { 자리: 0, 후보: [] },
    'E 분모 0': { 자리: 0, 후보: [] },
  };

  for (const { 이름, 글 } of 볼것) {
    const L = 글.split('\n');
    const 화면파일 = /\.jsx$/.test(이름);
    const 스토어파일 = /(^|[\\/])store[\\/]/.test(이름);
    const 치우는짝 = /clearInterval\(|removeEventListener\(|\.unref\s*\(\)/.test(글);
    // ── ★ **주석 안은 코드가 아니다** ── (2026-11-19 · 정석)
    //
    // 식이 한글 이름을 보게 되자(`합 / 값들.length`) **한글 주석의 `/` 가 쏟아졌다** —
    // 「작성/수정 폼」 · 「그만 / 두기」 · 「접기/펼치기」 · 「769px / 안쪽 폭 236px」.
    // 여섯이 전부 `{/* … */}` **여러 줄 주석의 가운데 줄**이라 줄머리만 봐서는 못 걸렀다.
    // 그래서 블록 주석을 **줄을 넘어가며** 따라간다.
    let 주석안 = false;
    L.forEach((line, i) => {
      const t = line.trim();
      const 열림 = line.lastIndexOf('/*');
      const 닫힘 = line.lastIndexOf('*/');
      const 이줄이주석안 = 주석안;
      if (열림 >= 0 && 열림 > 닫힘) 주석안 = true;
      else if (닫힘 >= 0 && 닫힘 > 열림) 주석안 = false;
      if (이줄이주석안) return;
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
      const at = `${이름}:${i + 1}`;

      // ── A. 받아만 두고 **못 받았을 때를 안 그리는** 자리 ──
      if (/\bclient\.(get|post|put|patch|delete)\(/.test(line) && !스토어파일) {
        류들['A 조용한 실패'].자리++;
        if (화면파일 && !near(L, i, /\.catch\(|catch\s*\(|try\s*\{/, 30)) {
          류들['A 조용한 실패'].후보.push(at);
        }
      }

      // ── B. **받은** 글을 그대로 푸는 자리 (박아 둔 글자는 세지 않는다) ──
      if (/JSON\.parse\(/.test(line) && !/JSON\.parse\(\s*['"`]/.test(line)) {
        류들['B JSON.parse 무방비'].자리++;
        if (!near(L, i, /try\s*\{|catch\s*\(|safeParse|tryParse/, 12)) {
          류들['B JSON.parse 무방비'].후보.push(at);
        }
      }

      // ── D. 붙여 두고 **안 떼는** 자리 ──
      if (/addEventListener\(|setInterval\(/.test(line)) {
        류들['D 구독·타이머 누수'].자리++;
        const 꼭대기 = /^\s{0,2}\S/.test(line);     // 모듈 꼭대기 — 사는 동안 하나다
        // **한 번만 울고 끝나는 것**은 누수가 아니다 — `load` · `DOMContentLoaded` ·
        // `{ once: true }`. `main.jsx` 의 서비스워커 등록이 그 꼴이다(11/19 에 읽었다)
        const 한번만 = /addEventListener\(\s*['"](?:load|DOMContentLoaded)['"]|once:\s*true/.test(line);
        if (!꼭대기 && !치우는짝 && !한번만) 류들['D 구독·타이머 누수'].후보.push(at);
      }

      // ── E. 분모가 0 일 수 있는 자리 ──
      const 깬줄 = 정규식걷기(line);
      // ★ **이름에 한글이 들어간다** (2026-11-19 · 되돌려 시험이 잡았다).
      // 식이 `[A-Za-z_$]` 로 시작하는 이름만 봐서 `합 / 값들.length` 를 **아예 못 봤다** —
      // 이 저장소는 한글 이름을 많이 쓴다(`합` · `값들` · `잰것` …). 글자 종류로 본다
      const m = /([\p{L}_$][\p{L}\p{N}_$.[\]]*)\s*\/\s*([\p{L}_$][\p{L}\p{N}_$.()[\]]*)/u.exec(깬줄);
      if (m && !/['"`]/.test(깬줄) && !/require|import|https?:/.test(깬줄)) {
        류들['E 분모 0'].자리++;
        if (!가드있나(깬줄)
          && !near(L, i, /\|\|\s*1|Math\.max|>\s*0|<=\s*0|===\s*0|isFinite|!\w+\)\s*return|return\s+null/, 14)) {
          류들['E 분모 0'].후보.push(at);
        }
      }
    });
  }
  return 류들;
}

/** `--되돌려` 가 먹이는 **가짜 조각 넷** — 식이 살아 있으면 넷 다 잡힌다 */
const 가짜조각 = [
  {
    이름: '가짜/분모0.js',
    글: [
      'function 평균(값들) {',
      '  const 합 = 값들.reduce((s, v) => s + v, 0);',
      '  return 합 / 값들.length;',          // 빈 배열이면 NaN — 가드가 없다
      '}',
    ].join('\n'),
  },
  {
    이름: '가짜/누수.jsx',
    글: [
      'export default function 화면() {',
      '  useEffect(() => {',
      '    setInterval(() => 똑딱(), 1000);',  // 치우는 짝이 없다
      '  }, []);',
      '}',
    ].join('\n'),
  },
  {
    이름: '가짜/파스.js',
    글: [
      'export function 읽기(받은것) {',
      '  const v = JSON.parse(받은것);',       // 박은 글이 아니다 · try 가 없다
      '  return v;',
      '}',
    ].join('\n'),
  },
  {
    이름: '가짜/조용히.jsx',
    글: [
      'export default function 목록() {',
      '  useEffect(() => {',
      '    client.get(\'/things\').then(({ data }) => set(data));',   // `.catch` 가 없다
      '  }, []);',
      '}',
    ].join('\n'),
  },
];

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
  if (process.argv.includes('--되돌려') || process.argv.includes('--selftest')) {
    say('정석 자 되돌려-FAIL — 일부러 어긋난 묶음을 먹인다');
    process.exit(되돌려());
  }
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
