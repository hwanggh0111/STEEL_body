// **내 기록 전부 받기 — 남의 것이 섞여 나가지 않는가** (2026-11-19 · 시안 1119 ⑥)
//
//   npm run takeall
//   node scripts/check-takeall.cjs --되돌려     일부러 어긋낸 꼴 여덜을 먹여 본다
//
// ── 왜 이 자가 생겼나 ──
//
// `GET /api/export/all` 은 **밖으로 나가는 장**을 만든다. 이 앱에서 `user_id` 로 거르는
// 자리는 스무 곳이 넘고, **하나만 빠지면 남의 기록이 그 장에 실린다.** 한 번 나가면
// 되돌릴 수 없다.
//
// ★ **코드 읽기로 통과시키지 않는다** (정석 지시서 ④). 스무 곳 중 한 곳만 `!==` 로
// 적혀도 코드는 멀쩡해 보인다. 그래서 **임시 DB 에 사람 둘을 만들고 `USER_COLLECTIONS`
// 의 모든 갈래에 각자 줄을 넣어 본다** — 그리고 A 의 묶음에 B 의 줄이 하나라도 있으면 FAIL.
//
// ── 무엇을 보는가 ──
//
//   ⑴ **두 사람 섞임** — 모든 갈래에서 실제로 센다. **되돌려**: 거르는 한 줄을 끄면 잡힌다
//   ⑵ **모집단** — 담는 것 + 뺀 것 = `db.USER_COLLECTIONS`. 목록을 **읽어서** 맞댄다
//   ⑶ **거르는 일을 그 길이 스스로 하지 않는다** — `rawSnapshot` 을 안 부르고,
//      거르는 식이 `exportAll.js` 에 한 줄도 없다. 문지기는 `auth`(관리자 길이 아니다)
//   ⑷ **화면과 열쇠가 같은가** — `ExportAll.jsx` 의 `PARTS` 와 맞댄다. 갈리면 빠진 줄을
//      아무도 모른다(11/17 에 받는 파일 이름이 양쪽에서 갈렸다)
//   ⑸ **안 담기로 한 것의 까닭이 파일 안에 적히는가** · **「되넣는 길 없음」 한 줄**
//   ⑹ **머리글에 ASCII 가 아닌 글자가 없는가** — 11/19 에 붙이자마자 500 이 났다
//   ⑺ **묶음 크기 상한**이 코드에 있는가 (넘기는 날은 조각내야 하는 날이다)
//
// 읽기에 실패하면 **통과가 아니라 FAIL** 이다.
const fs = require('fs');
const path = require('path');

// ── 임시 DB 로 시작한다 ──────────────────────────────────────
// **진짜 DB 를 건드리지 않는다** — 트리를 셋이 쓰고 개발 서버가 켜져 있다
const TMP = path.join(__dirname, '..', '.check-takeall.json');
process.env.DB_FILE = TMP;
const db = require('../src/db');
require('./_tmpdb.cjs')(TMP);

const SRC = path.join(__dirname, '..', 'src');
const 길글 = fs.readFileSync(path.join(SRC, 'routes', 'exportAll.js'), 'utf8');
const db글 = fs.readFileSync(path.join(SRC, 'db.js'), 'utf8');

// ★ **주석을 걷고 본다.** 처음 꼴은 글 전체를 봤고, 머리글에 적어둔 설명
// (「rawSnapshot() 은 부르지 않는다」 · 「role 은 담지 않는다」) 때문에 **자가 거짓으로
// 울었다.** 자는 **코드가 하는 일**을 봐야 한다 — 적어둔 말이 아니다
const 블록주석 = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const 줄주석 = new RegExp(String.raw`^\s*//.*$`, 'gm');
const 주석걷기 = (글) => 글.replace(블록주석, '').replace(줄주석, '');
const 길코드 = 주석걷기(길글);

const NL = String.fromCharCode(10);
let bad = 0;
const 본다 = (이름, 받은것, 바라던것) => {
  const g = JSON.stringify(받은것);
  const w = JSON.stringify(바라던것);
  const 같다 = g === w;
  if (!같다) bad += 1;
  console.log((같다 ? 'OK   ' : 'FAIL ') + 이름 + ' → ' + g + (같다 ? '' : ' (기대: ' + w + ')'));
};

// ── 글을 받는 손들 (되돌려 꼴이 여기에 가짜 글을 먹인다) ──────
const 식 = {
  /** 그 길이 스스로 거르나 — `user_id ===` · `.filter(` 처럼 */
  // **`user_id` 를 견주는 자리만** 센다. 처음 꼴은 `.filter(` 를 같이 셌는데
  // `parts` 를 가르는 `.filter(Boolean)` 까지 집어 **거짓으로 울었다**
  거르는식(글) { return (글.match(/user_id\s*[!=]==/g) || []).length; },
  /** 모든 사람의 것을 집는 손을 부르나 */
  통째손(글) { return /rawSnapshot\s*\(/.test(글); },
  /** 그 길이 지나는 문지기들 */
  문지기(글) { return [...글.matchAll(/router\.get\('([^']+)',\s*([A-Za-z]+)/g)].map((m) => [m[1], m[2]]); },
  /** 머리글에 적는 값에 ASCII 가 아닌 글자가 있나 (11/19 의 그 500) */
  머리글에한글(글) {
    // **`;` 로 끊지 않는다** — 머리글 값 안에 `;` 가 있다(`attachment; filename=...`).
    // 처음 꼴이 `[^;]*?` 여서 값의 앞토막만 보고 **한글을 못 집었다**(되돌려가 잡았다)
    const 줄들 = [...글.matchAll(/setHeader\((.*?)\)\s*;/gs)].map((m) => m[1]);
    return 줄들.filter((s) => /[^\x00-\x7F]/.test(
      s.replace(/encodeURIComponent\([^)]*\)/g, '').replace(/\$\{[^}]*\}/g, ''))).length;
  },
  /** `db` 에서 한 사람 줄을 고르는 식이 **몇 군데**인가 — 하나여야 한다 */
  거르는자리수(글) {
    const m = 글.match(/userRows\(userId, keys\)[\s\S]{0,900}?\n  \},/);
    return m ? (m[0].match(/r\.user_id === userId/g) || []).length : null;
  },
};

// ── ⑴ ★ 사람 둘을 만들어 본다 ────────────────────────────────
console.log('── 사람 둘을 만들어 섞이나 본다 ──');
const 통전체 = db.USER_COLLECTIONS;
const snap = db.snapshot();
const A = 101;
const B = 202;
for (const key of 통전체) {
  snap[key] = [
    { id: 1, user_id: A, 표: 'A 의 줄' },
    { id: 2, user_id: B, 표: 'B 의 줄' },
  ];
}
db.flushNow ? db.flushNow() : null;

const A것 = db.userRows(A, 통전체);
본다('갈래를 다 셌다 (0 이면 셈이 안 돈 것이다)', Object.keys(A것).length, 통전체.length);
본다('A 의 묶음에 B 의 줄이 든 갈래',
  Object.entries(A것).filter(([, 줄들]) => 줄들.some((r) => r.user_id !== A)).map(([k]) => k), []);
본다('A 의 줄은 빠짐없이 왔다',
  Object.entries(A것).filter(([, 줄들]) => 줄들.length !== 1).map(([k]) => k), []);
본다('거르는 식이 `db` 에 한 군데뿐이다', 식.거르는자리수(db글), 1);

// ── ⑵ 모집단 ─────────────────────────────────────────────────
console.log(NL + '── 모집단 — 담는 것 + 뺀 것 = 지우는 목록 ──');
// 목록을 **그 파일에서 읽는다** — 베껴 적으면 갈래가 늘 때 자만 옛 목록을 본다
const 담은통 = [...길글.matchAll(/통: \[([^\]]+)\]/g)]
  .flatMap((m) => m[1].split(',').map((s) => s.trim().replace(/'/g, '')))
  .filter((k) => k !== 'photos');
// **`뺀다` 블록 안에서만** 읽는다 — 글 전체에서 두 칸짜리 묶음을 찾으면
// `통: ['myRoutines', 'plans']` 까지 집어 셈이 하나 늘었다
const 뺀블록 = (/const 뺀다 = \[([\s\S]*?)\n\];/.exec(길글) || [, ''])[1];
const 뺀통 = [...뺀블록.matchAll(/\['(\w+)',/g)].map((m) => m[1]);
본다('담는 갈래를 읽었다', 담은통.length > 0, true);
본다('뺀 갈래를 읽었다', 뺀통.length > 0, true);
본다('안 다룬 갈래', 통전체.filter((k) => !담은통.includes(k) && !뺀통.includes(k)), []);
본다('목록에 없는 갈래를 담지 않는다',
  [...담은통, ...뺀통].filter((k) => !통전체.includes(k)), []);

// ── ⑶ 거르는 일을 그 길이 스스로 하지 않는다 ─────────────────
console.log(NL + '── 그 길은 거르지 않는다 ──');
본다('거르는 식이 한 줄도 없다', 식.거르는식(길코드), 0);
본다('모든 사람의 것을 집는 손을 안 부른다', 식.통째손(길코드), false);
본다('문지기는 auth 다 (adminAuth 가 아니다)', 식.문지기(길글), [['/all', 'auth']]);

// ── ⑷ 화면과 열쇠가 같은가 ───────────────────────────────────
console.log(NL + '── 화면과 열쇠가 같은가 ──');
const 화면길 = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'ExportAll.jsx');
if (!fs.existsSync(화면길)) {
  // **없는 것을 통과로 두지 않는다** — 화면이 아직 안 붙었으면 그렇게 적고 센다
  console.log('건너뜀 화면이 아직 없다 (`components/ExportAll.jsx`) — 붙는 날 이 줄이 산다');
} else {
  const 화면글 = fs.readFileSync(화면길, 'utf8');
  const 화면열쇠 = [...화면글.matchAll(/key: '(\w+)'/g)].map((m) => m[1]);
  const 서버열쇠 = [...길글.matchAll(/^  (\w+): \{ 이름:/gm)].map((m) => m[1]);
  본다('화면 열쇠를 읽었다', 화면열쇠.length > 0, true);
  본다('화면이 보내는 열쇠를 서버가 다 안다',
    화면열쇠.filter((k) => !서버열쇠.includes(k)), []);
}

// ── ⑸ 까닭을 파일 안에 적는가 ────────────────────────────────
console.log(NL + '── 빠진 것과 되넣기를 파일 안에 적는가 ──');
본다('빠진 것을 목록으로 적는다', /빠진것/.test(길글), true);
본다('뺀 갈래마다 까닭이 붙어 있다',
  [...뺀블록.matchAll(/\['(\w+)', '([^']*)'\]/g)].filter((m) => !m[2]).map((m) => m[1]), []);
본다('뺀 갈래가 하나라도 있다 (0 이면 읽기가 샌 것이다)', 뺀통.length > 0, true);
본다('「되넣는 길 없음」을 적는다', /되넣기:/.test(길글), true);
본다('사진은 고르지 않으면 안 담는다', /기본꺼짐: true/.test(길글), true);

console.log(NL + '── 안 담기로 한 것 ──');
for (const 못나갈것 of ['refreshTokens', 'pushSubs', 'suspensions', 'abuseLogs']) {
  본다(`${못나갈것} 은 뺀 쪽에 있다`, 뺀통.includes(못나갈것), true);
  본다(`  담는 쪽에는 없다`, 담은통.includes(못나갈것), false);
}
본다('비밀번호 해시는 프로필에 없다', /password/.test(길코드), false);
본다('role 도 없다', /\brole\b/.test(길코드), false);

// ── ⑹⑺ 머리글 · 크기 상한 ───────────────────────────────────
console.log(NL + '── 머리글과 크기 ──');
본다('한글이 든 머리글 값', 식.머리글에한글(길코드), 0);
본다('못 읽는 기기용 ASCII 이름도 같이 적는다', /filename="[\x20-\x7E]+"/.test(길글), true);
본다('한글 이름은 RFC 5987 로 적는다', /filename\*=UTF-8''/.test(길글), true);
본다('묶음 크기 상한이 있다', /큰묶음/.test(길글), true);

// ── 되돌려 보기 ──────────────────────────────────────────────
if (process.argv.includes('--되돌려')) {
  console.log(NL + '── 되돌려 보기 ──');
  let 못집은것 = 0;
  const 꼴 = [
    // ★ 거르는 한 줄을 끄면 **섞인다** — 이 자의 뼈대다
    ['거르는 줄을 끄면 남의 줄이 섞인다',
      () => {
        const 끈것 = {};
        for (const key of 통전체) 끈것[key] = db.snapshot()[key];   // 안 거른 것
        return Object.values(끈것).some((줄들) => 줄들.some((r) => r.user_id !== A));
      }, true],
    ['  지금 길은 안 섞인다',
      () => Object.values(db.userRows(A, 통전체)).some((줄들) => 줄들.some((r) => r.user_id !== A)), false],
    ['`db` 에 거르는 식이 둘이면 집는다',
      () => 식.거르는자리수('  userRows(userId, keys) {\n    r.user_id === userId;\n    r.user_id === userId;\n  },'), 2],
    ['거르는 식을 못 찾으면 null 이다 (통과가 아니다)', () => 식.거르는자리수('아무 글도 아니다'), null],
    ['그 길이 스스로 거르면 집는다', () => 식.거르는식('rows.filter((r) => r.user_id === u)'), 1],
    ['  `!==` 로 적어도 집는다', () => 식.거르는식('rows.filter((r) => r.user_id !== u)'), 1],
    ['  `.filter(Boolean)` 은 거르는 것이 아니다', () => 식.거르는식("parts.split(',').filter(Boolean)"), 0],
    ['통째 손을 부르면 집는다', () => 식.통째손('const d = db.rawSnapshot();'), true],
    ['문지기가 adminAuth 면 집는다',
      () => 식.문지기("router.get('/all', adminAuth, (req, res) => {"), [['/all', 'adminAuth']]],
    ['머리글에 한글을 넣으면 집는다',
      () => 식.머리글에한글("res.setHeader('Content-Disposition', 'attachment; filename=\"내기록.json\"');"), 1],
    ['  퍼센트 인코딩은 글자로 안 센다',
      () => 식.머리글에한글("res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('내기록.json')}`);"), 0],
  ];
  for (const [이름, 부르기, 어긋난값] of 꼴) {
    const 받은것 = 부르기();
    const 집었다 = JSON.stringify(받은것) === JSON.stringify(어긋난값);
    if (!집었다) 못집은것 += 1;
    console.log((집었다 ? 'OK   잡는다: ' : 'FAIL 샌다  : ') + 이름 + ' → ' + JSON.stringify(받은것)
      + (집었다 ? '' : ' (기대: ' + JSON.stringify(어긋난값) + ')'));
  }
  bad += 못집은것;
  console.log(못집은것 ? '  ↑ **어긋난 꼴을 자가 못 집었다.**' : '  어긋낸 꼴 ' + 꼴.length + '개를 다 집었다');
}

console.log(NL + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
