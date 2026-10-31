// 브라우저에 남기는 **열쇠 이름이 한 곳에만 있는가** (2026-10-27)
//
//   npm run keys     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// `data/localKeys.js` 의 첫 줄이 그 까닭을 적어두고 있다 —
//
// > **왜 한 곳에 모으는가.** 로그아웃할 때 지울 목록과, 실제로 저장하는 화면이
// > **따로 적어두고 있었다.** 그러면 새 키를 만든 사람이 목록에 넣는 것을 잊는다.
// > 실제로 잊혔다 — 몸 사진 둘 · 검색 기록 · 답변 확인 시각.
//
// **그래놓고 여덟이 두 벌이었다** (10/27 에 찾았다) — 휴식 타이머 여섯과 앱 잠금,
// 그리고 휴식 알림 하나는 **목록에 아예 없었다.** 같은 글자가 두 곳에 있으면
// 한쪽만 고치는 날이 오고, 그날 쓰던 사람의 설정과 잠금이 통째로 사라진다.
//
// 그래서 **접두사가 붙은 열쇠 글자**를 앱 전체에서 찾아, `localKeys.js` 밖에
// 있으면 FAIL 한다. 옛 기능의 죽은 열쇠를 쓸어내는 목록은 예외다 — 거기 적힌 것은
// **지우려고** 적어둔 이름이고, 다시 쓰지 않는다.

const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const yes = (name, cond, why) => {
  if (!cond) bad += 1;
  console.log((cond ? 'OK   ' : 'FAIL ') + name + (cond ? '' : ' — ' + why));
};

const SRC = path.join(__dirname, '..', 'src');
const KEYS_FILE = path.join(SRC, 'data', 'localKeys.js');

const walk = (d, out = []) => {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(n)) out.push(p);
  }
  return out;
};

// 주석은 안 센다 — 이 집은 열쇠 이름을 주석에 자주 적는다
const codeLines = (src) => {
  let inBlock = false;
  return src.split('\n').map((raw) => {
    let line = raw;
    if (inBlock) {
      const e = line.indexOf('*/');
      if (e < 0) return '';
      line = line.slice(e + 2); inBlock = false;
    }
    for (;;) {
      const o = line.indexOf('/*');
      if (o < 0) break;
      const c = line.indexOf('*/', o + 2);
      if (c < 0) { line = line.slice(0, o); inBlock = true; break; }
      line = line.slice(0, o) + ' ' + line.slice(c + 2);
    }
    const s = line.indexOf('//');
    return s < 0 ? line : line.slice(0, s);
  });
};

// 이 앱이 쓰는 접두사들. 접두사가 없는 것(`token` · `nickname`)은 **여기서는** 안
// 본다 — 그 글자가 열쇠인지 응답의 칸 이름인지(`data.token`) 줄만 보고 가를 수 없다.
// **대신 아래 「이름이 있는데 글자로 적은 자리」가 본다** (2026-10-28).
// 10/27 에 이 둘에도 이름을 줬는데(`TOKEN_KEY`·`NICKNAME_KEY`) 이 주석이
// 「PER_USER_KEYS 가 **글자로** 들고 있다」고 적힌 채로 남아 있었고, 그 사이
// **`TOKEN_KEY` 를 쓰는 자리가 0** 이었다 — 스물한 자리가 글자를 또 적었다
const PREFIX = /'((?:steelbody_|ironlog_|shape:|parts:|breath:|gym:)[\w:]*)'/g;

// **옛 기능의 죽은 열쇠를 쓸어내는 목록**은 예외다. 지우려고 적어둔 이름이고,
// 그 이름을 `localKeys.js` 에 되살려 두면 「아직 쓰는 것」으로 읽힌다
const SWEEP = 'REMOVED_GAME_KEYS';

const keysSrc = fs.readFileSync(KEYS_FILE, 'utf8');
const declared = new Set();
for (const m of codeLines(keysSrc).join('\n').matchAll(PREFIX)) declared.add(m[1]);

const outside = [];
const swept = new Set();
for (const f of walk(SRC)) {
  if (path.resolve(f) === path.resolve(KEYS_FILE)) continue;
  const rel = path.relative(SRC, f).replace(/\\/g, '/');
  const lines = codeLines(fs.readFileSync(f, 'utf8'));
  // 쓸어내는 목록의 범위를 먼저 잡는다 (`const REMOVED_GAME_KEYS = [ … ];`)
  let sweepFrom = -1; let sweepTo = -1;
  lines.forEach((l, i) => {
    if (l.includes(SWEEP) && l.includes('[')) sweepFrom = i;
    if (sweepFrom >= 0 && sweepTo < 0 && i >= sweepFrom && l.includes('];')) sweepTo = i;
  });
  lines.forEach((line, i) => {
    PREFIX.lastIndex = 0;
    for (const m of line.matchAll(PREFIX)) {
      if (sweepFrom >= 0 && i >= sweepFrom && i <= sweepTo) { swept.add(m[1]); continue; }
      outside.push(`${rel}:${i + 1}  ${m[1]}`);
    }
  });
}

console.log('── 열쇠 이름은 한 곳에만 ──');
console.log(`     localKeys.js 가 든 이름 ${declared.size}개 · 옛 기능 쓸어내기 ${swept.size}개`);
ok('밖에 또 적힌 열쇠', outside, []);

// 쓸어내는 목록의 이름이 **아직 쓰는 열쇠와 겹치면** 앱이 뜰 때마다 제 설정을 지운다
const clash = [...swept].filter((k) => declared.has(k));
ok('쓸어낼 이름이 아직 쓰는 것과 겹치지 않는다', clash, []);

// ── 지우는 목록이 **빠짐없는가** ──
//
// 이 파일의 약속이 「새 키를 여기 만들면 지우는 일은 저절로 따라온다」다. 그런데
// 따라오는지는 **아무도 안 보고 있었다** — 실제로 잊힌 적이 있다(몸 사진 둘 ·
// 검색 기록 · 답변 확인 시각). 10/27 에 또 하나가 빠져 있었다(관리자가 새 오류를
// 언제까지 봤나).
//
// 「── 기기의 것」 줄 **앞**에 내보낸 것은 사람의 것이다 — 그것들이 `PER_USER_KEYS`
// 안에 다 있어야 한다.
console.log('');
yes('사람의 것은 PER_USER_KEYS 가 든다', /PER_USER_KEYS = \[/.test(keysSrc),
  '지우는 목록이 없어지면 다음에 로그인한 사람이 앞 사람 것을 본다');
{
  const code = codeLines(keysSrc);
  // 가르는 줄은 **주석**이라 걷힌 쪽에는 없다 — 날글에서 찾는다
  // (줄 수는 그대로라 번호가 맞는다)
  const split = keysSrc.split('\n').findIndex((l) => l.includes('기기의 것'));
  const listAt = code.findIndex((l) => l.includes('PER_USER_KEYS = ['));
  const listEnd = code.findIndex((l, i) => i > listAt && l.trim() === '];');
  const list = code.slice(listAt, listEnd + 1).join('\n');
  const mine = [];
  code.slice(0, split < 0 ? code.length : split).forEach((l) => {
    const m = l.match(/^export const (\w+) = '/);
    // 바(`BAR_KEY`)는 사람의 것이 아니다 — 그 헬스장에 어떤 바가 있느냐다
    if (m && m[1] !== 'BAR_KEY') mine.push(m[1]);
  });
  const left = mine.filter((n) => !new RegExp('\\b' + n + '\\b').test(list));
  console.log(`     사람의 것 ${mine.length}개`);
  ok('지우는 목록에서 빠진 것', left, []);
}
yes('지우는 쪽이 그 목록을 그대로 쓴다',
  /LOGOUT_KEYS = PER_USER_KEYS/.test(fs.readFileSync(path.join(SRC, 'store', 'authStore.js'), 'utf8')),
  '나가는 쪽이 따로 나열하면 한쪽에만 새 줄이 생기는 날이 온다');

// ──────────────────────────────────────────────────────────────
// **이름을 줬는데 글자로 적은 자리** (2026-10-28)
// ──────────────────────────────────────────────────────────────
//
// 10/27 에 「누구인지를 적어두는 다섯에도 이름을 준다」고 `TOKEN_KEY` ·
// `NICKNAME_KEY` 를 만들었다. 그런데 **절반만 됐다** —
//
//   · `TOKEN_KEY` 를 쓰는 자리가 **0** 이었다 (이름만 만들고 아무도 안 썼다)
//   · `readLS('token')` 처럼 글자를 또 적은 자리가 **스물하나**
//   · `AUTO_LOGIN_KEYS` 한 줄에 **이름 셋과 글자 둘이 섞여** 있었다
//
// 위의 접두사 검사는 이 둘을 일부러 건너뛰므로 **아무도 안 보고 있었다.**
// 열쇠로 쓰이는 자리는 **집의 손을 부르는 자리**(`readLS`·`saveLS`·`removeLS`)와
// **열쇠 목록**뿐이라, 거기서만 글자를 찾으면 `data.token` 같은 칸 이름과 안 섞인다.
console.log('\n── 이름을 줬는데 글자로 적지 않았나 ──');
{
  // localKeys.js 가 내보낸 이름 → 그 값
  const named = new Map();
  for (const m of keysSrc.matchAll(/^export const (\w+) = '([^']+)';/gm)) named.set(m[2], m[1]);

  const literal = [];
  const unused = [];
  for (const f of walk(SRC)) {
    if (path.resolve(f) === path.resolve(KEYS_FILE)) continue;
    const rel = path.relative(SRC, f).replace(/\\/g, '/');
    codeLines(fs.readFileSync(f, 'utf8')).forEach((line, i) => {
      // 집의 손에 글자를 바로 넣는 자리
      for (const m of line.matchAll(/(?:read|save|remove)LS\(\s*'([^']+)'/g)) {
        if (named.has(m[1])) literal.push(rel + ':' + (i + 1) + '  ' + m[1] + ' → ' + named.get(m[1]));
      }
      // 열쇠 목록 줄에 글자가 섞인 자리 (`const …_KEYS = [ … ]`)
      if (/_KEYS\s*=\s*\[/.test(line)) {
        for (const m of line.matchAll(/'([^']+)'/g)) {
          if (named.has(m[1])) literal.push(rel + ':' + (i + 1) + '  목록에 글자 ' + m[1] + ' → ' + named.get(m[1]));
        }
      }
    });
  }
  ok('이름이 있는데 글자로 적은 자리', literal, []);

  // **이름만 만들고 아무도 안 쓰는 것**도 같이 본다 — 그것이 위 상태의 짝이다
  const all = walk(SRC).filter((f) => path.resolve(f) !== path.resolve(KEYS_FILE))
    .map((f) => codeLines(fs.readFileSync(f, 'utf8')).join('\n')).join('\n');
  for (const name of named.values()) {
    if (!new RegExp('\\b' + name + '\\b').test(all) && !new RegExp('\\b' + name + '\\b').test(
      codeLines(keysSrc).join('\n').replace(new RegExp("export const " + name + " = '[^']+';"), ''))) {
      unused.push(name);
    }
  }
  ok('  부르는 자리가 0 인 이름', unused, []);
}

// ──────────────────────────────────────────────────────────────
// **집의 손으로 읽고 적는가** (2026-10-27)
// ──────────────────────────────────────────────────────────────
//
// `data/safeStorage.js` 의 첫 줄이 그 까닭을 적어두고 있다 —
//
// > 쿠키·사이트 데이터를 막아둔 브라우저에서는 localStorage 를 **「읽는 것」조차**
// > SecurityError 를 던진다. 던진 자리가 모듈 최상위나 요청 인터셉터면 앱 전체가
// > 흰 화면이 된다.
//
// 그래놓고 다섯 자리가 `localStorage` 를 바로 만지고 있었다. 전부 `try` 로
// 감싸 있어서 흰 화면은 안 됐지만, **휴식 알림은 그 때문에 한 번도 안 물었다** —
// 던진 것을 바깥 `catch` 가 받아 `return false` 로 끝났다. 그 브라우저에서는
// 기능이 **조용히 없는 것**이 됐다. 집의 손은 못 읽으면 `null` 을 준다.
console.log('\n── 집의 손으로 읽고 적는다 ──');
{
  const raw = [];
  for (const f of walk(SRC)) {
    const rel = path.relative(SRC, f).replace(/\\/g, '/');
    // 그 손이 사는 자리와 개발용 도우미는 뺀다
    if (rel === 'data/safeStorage.js' || rel.startsWith('dev/')) continue;
    codeLines(fs.readFileSync(f, 'utf8')).forEach((line, i) => {
      if (/localStorage\.(getItem|setItem|removeItem)\s*\(/.test(line)) raw.push(`${rel}:${i + 1}`);
    });
  }
  ok('바로 만지는 자리', raw, []);
}

// ── **기기에만 남는 「사람이 적은 값」은 못 담으면 말하는가** ── (2026-10-31)
//
// `saveLS` 는 못 담으면 터지지 않고 `false` 를 준다. 그 답을 **안 보는 자리가
// 여럿이었다.** 담아두면 좋은 값(검색 기록 · 바 무게 · 만든 소리)은 조용히 잃어도
// 되고 그 자리들은 주석에 그렇게 적어뒀다. 다른 것은 **그 사람이 적은 것이 기기에만
// 있고 그것이 앱의 말을 바꾸는 자리**다 — 10/27 ⑯ 이 그 꼴이었다
// (쿠키를 막아둔 브라우저에서 **기능이 조용히 없는 것이 됐다**).
//
// 아래 자리는 `keepLocal` 을 지나야 한다(한 판에 한 번 말한다). 새 자리를 넣는
// 일은 사람이 정할 일이지만, **적어둔 자리가 조용해지면** 그때 FAIL 한다
console.log('');
console.log('── 못 담으면 말하는가 ──');
const 말해야하는자리 = {
  'pages/PartsPage.jsx': '아픈 곳 — 담기지 않으면 아픈 부위를 또 추천한다',
  'pages/HomeworkoutPage.jsx': '하던 자리 — 없으면 멈춘 적이 없는 것처럼 보인다',
};
const 조용한자리 = [];
for (const [f, why] of Object.entries(말해야하는자리)) {
  if (!fs.readFileSync(path.join(SRC, f), 'utf-8').includes('keepLocal(')) 조용한자리.push(`${f} — ${why}`);
}
ok('못 담아도 조용한 자리', 조용한자리, []);
// **잠금과 체형은 제 자리에서 적는다** (토스트가 아니라 화면에 남는 말이다)
ok('잠금은 담은 뒤 읽어서 확인한다',
  fs.readFileSync(path.join(SRC, 'data/appLock.js'), 'utf-8').includes('!readLock()'), true);
ok('체형은 못 담았으면 그 자리에 적는다',
  fs.readFileSync(path.join(SRC, 'pages/ShapePage.jsx'), 'utf-8').includes('kept === false'), true);

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
