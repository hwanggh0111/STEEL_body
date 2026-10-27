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

// 이 앱이 쓰는 접두사들. 접두사가 없는 것(`token` · `nickname`)은 너무 흔해서 안 본다 —
// 그쪽은 `PER_USER_KEYS` 가 글자로 들고 있고, 바꿀 일이 없는 이름이다
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

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
