// 글꼴 기능 — **넣은 것은 누가 부르고, 부르는 것은 글꼴에 있다** (2026-11-16).
//
//   npm run fontfeat      (npm run check 에도 들어 있다)
//
// 11/13 에 글꼴을 자급으로 바꾸면서(구글 CSS gzip 40.3KB → 0) 자르는 설정이
// `layout_features = []` 였다 — **커닝과 고정폭 숫자가 통째로 죽었다.** 11/16 에
// 되살렸다(`3d7106c`). 그런데 그때 짝이 안 맞는 자리가 둘 드러났다 —
//
//   · 글꼴에 **넣었는데 앱이 안 부르는** 기능 → 그만큼이 **값만 무게**다.
//     `tnum`(고정폭 숫자)은 브라우저가 **알아서 켜주지 않는다**. CSS 가
//     `font-variant-numeric: tabular-nums` 라고 **말해야** 켜진다
//     (`kern`·`liga` 는 기본으로 켜져 있어 말이 필요 없다)
//   · 앱이 **부르는데 글꼴에 없는** 기능 → 그 자리는 **조용히 아무 일도 안 한다.**
//     11/13~11/16 사이의 앱이 그 꼴이었다 — `tabular-nums` 를 두 자리에서
//     불렀지만 글꼴에 `tnum` 이 없었다
//
// 글꼴에 든 기능을 **세는 것**은 `fontTools`(python)가 있어야 한다. 없으면 그
// 걸음만 건너뛴다 — 설정과 부르는 자리를 맞대는 것은 python 없이도 한다.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const skip = (name, why) => console.log('건너뜀 ' + name + ' — ' + why);

// ── 생성기가 **무엇을 남기라고 적었나** ──
// 목록을 여기 베끼지 않는다 — 생성기에서 읽는다(11/16 에 자 셋이 베낀 탓에 거짓을 냈다)
const 생성기 = ['scripts/gen-sans.mjs', 'scripts/gen-serif.mjs'];
const 남긴기능 = new Set();
for (const g of 생성기) {
  const s = fs.readFileSync(path.join(ROOT, g), 'utf8');
  // `opts.layout_features = ['kern', 'liga', 'tnum']` — 주석 줄은 뺀다
  s.split('\n').filter((l) => !/^\s*(\/\/|\*|#)/.test(l)).forEach((l) => {
    const m = /layout_features\s*=\s*\[([^\]]*)\]/.exec(l);
    if (m) (m[1].match(/['"]([a-z0-9]{2,6})['"]/g) || []).forEach((q) => 남긴기능.add(q.slice(1, -1)));
  });
}
// 글꼴 파일마다 **숫자 열 자가 같은 폭인가.** `tnum` 이 없어도 되는 글꼴을
// 가리기 위한 것이다 (Bebas 는 0~9 가 전부 400 이라 `tnum` 의 짝이 아예 없다)
function 숫자폭() {
  const dir = path.join(SRC, 'assets/fonts');
  if (!fs.existsSync(dir)) return {};
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.woff2'));
  const py = [
    'import json,sys',
    'from fontTools.ttLib import TTFont',
    'out={}',
    'for f in sys.argv[1:]:',
    '    t=TTFont(f); h=t["hmtx"]; c=t.getBestCmap()',
    '    w={h[c[ord(d)]][0] for d in "0123456789" if ord(d) in c}',
    '    out[f.replace(chr(92),"/").split("/")[-1]]=(len(w)==1)',
    'print(json.dumps(out))',
  ].join('\n');
  try {
    return JSON.parse(execFileSync('python', ['-c', py, ...files.map((f) => path.join(dir, f))],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { return {}; }
}

// `파일:줄` 자리에 **실제로 쓰이는 글꼴 스택.** 같은 style 묶음(또는 같은 CSS 규칙)
// 안의 `fontFamily`/`font-family` 를 위로 스물다섯 줄까지 거슬러 찾고, 없으면 본문
// 글꼴(`globals.css` 의 `body`)로 본다 — 그것이 그 자리에 실제로 오는 글꼴이다
function 글꼴스택(자리) {
  const [rel, n] = 자리.split(':');
  const lines = fs.readFileSync(path.join(SRC, rel), 'utf8').split('\n');
  for (let i = Number(n) - 1; i >= 0 && i > Number(n) - 26; i -= 1) {
    const m = /font-?[Ff]amily:\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`|([^,;}]+(?:,[^;}]+)*))/.exec(lines[i]);
    if (m) {
      const 글 = m[1] || m[2] || m[3] || m[4] || '';
      return 글.split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    }
  }
  // 못 찾으면 본문 글꼴이다
  try {
    const g = fs.readFileSync(path.join(SRC, 'styles/globals.css'), 'utf8');
    const b = /body\s*\{[^}]*font-family:\s*([^;]+);/.exec(g);
    if (b) return b[1].split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  } catch { /* 없으면 빈손 */ }
  return [];
}

console.log('── 생성기가 남기라고 적은 기능 ──');
ok('기능을 하나라도 남긴다 (빈 목록이면 커닝까지 죽는다)', 남긴기능.size > 0, true);
console.log('       ' + [...남긴기능].sort().join(' '));

// ── **말해야 켜지는 기능**은 앱이 말하는가 ──
//
// 브라우저가 기본으로 켜는 것(`kern`·`liga`)은 말이 필요 없다. 그 밖의 것은
// CSS 가 불러야 한다 — 안 부르면 글꼴에 든 채 한 번도 안 쓰인다
const 말해야켜지는것 = {
  tnum: ['tabular-nums', "'tnum'", '"tnum"'],
  onum: ['oldstyle-nums', "'onum'", '"onum"'],
  frac: ['diagonal-fractions', "'frac'", '"frac"'],
  smcp: ['small-caps', "'smcp'", '"smcp"'],
};
const EXT = new Set(['.jsx', '.js', '.css']);
const walk = (dir, out = []) => {
  for (const n of fs.readdirSync(dir)) {
    const full = path.join(dir, n);
    if (fs.statSync(full).isDirectory()) { if (n !== 'dev') walk(full, out); }
    else if (EXT.has(path.extname(n))) out.push(full);
  }
  return out;
};
// **주석은 뺀다** — 「왜 그렇게 했는지」를 적은 머리글이 부르는 자리로 세어지면,
// 설명만 남고 기능은 죽은 꼴을 자가 통과시킨다 (11/16 에 실제로 그 꼴이었다:
// `AppLock.jsx` 주석이 `tabular-nums` 를 말하고 있었다)
//
// ★ **걷는 손이 코드를 먹었다** (2026-11-16 저녁에 고쳤다) — 처음에는
// `/\*[\s\S]*?\*\//` 한 줄로 걷었다. 그런데 `accept="image/*"` 처럼 **문자열 안에
// `/*` 가 있는 자리**가 넷이고, 거기서 주석이 시작된 것으로 읽혀 **다음 `*/` 까지
// 코드가 통째로 먹혔다** (`ComparePage.jsx:256` 에서 5,077자다). 먹힌 자리에 있던
// 호출은 자가 **못 본다** — 조용한 거짓 통과다.
//
// 그래서 **줄 단위로** 걷는다. 묶음 주석은 줄 머리에서만 시작으로 보고, 줄 수는
// 지킨다(지우면 `파일:줄` 이 밀린다). 줄 가운데의 `/* */` 는 남기는데, 남겨서
// 생기는 것은 **거짓 FAIL** 이고 먹어서 생기는 것은 **거짓 PASS** 다 — 둘 중
// 앞쪽이 낫다. 자는 울어야 사람이 본다.
function 주석걷기(raw) {
  let 안 = false;
  return raw.split('\n').map((l) => {
    if (안) { if (/\*\//.test(l)) 안 = false; return ''; }
    if (/^\s*\{?\/\*/.test(l)) { 안 = !/\*\//.test(l); return ''; }
    if (/^\s*\/\//.test(l)) return '';
    return l;
  }).join('\n');
}
const 코드 = walk(SRC).map((f) => {
  const s = 주석걷기(fs.readFileSync(f, 'utf8'));
  return {
    rel: path.relative(SRC, f).replace(/\\/g, '/'),
    줄: s.split('\n').map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => !/^\s*(\/\/|\*)/.test(l)),
  };
});
const 부르는자리 = (말들) => {
  const out = [];
  코드.forEach(({ rel, 줄 }) => 줄.forEach(({ l, n }) => {
    if (말들.some((w) => l.includes(w))) out.push(`${rel}:${n}`);
  }));
  return out;
};

console.log('');
console.log('── 넣었는데 아무도 안 부르는 기능 ──');
const 죽은기능 = [];
for (const [feat, 말들] of Object.entries(말해야켜지는것)) {
  if (!남긴기능.has(feat)) continue;
  const 자리 = 부르는자리(말들);
  if (!자리.length) 죽은기능.push(feat);
  else console.log(`       ${feat} ← ${자리.join(' ')}`);
}
ok('부르는 자리가 없는 기능을 글꼴에 넣지 않는다', 죽은기능, []);

console.log('');
console.log('── 부르는데 글꼴에 없는 기능 ──');
const 없는기능 = [];
for (const [feat, 말들] of Object.entries(말해야켜지는것)) {
  const 자리 = 부르는자리(말들);
  if (자리.length && !남긴기능.has(feat)) 없는기능.push(`${feat} — ${자리.join(' ')}`);
}
ok('부르는 기능은 글꼴에 들어 있다', 없는기능, []);

// ── 산출 글꼴에 **실제로** 들었나 ──
//
// 설정은 「남기라」고만 한다. 글꼴 쪽에 그 기능의 짝이 없으면 `fontTools` 가
// 추려낸다 — 그것이 맞는 자리도 있다(Bebas 의 숫자는 이미 고정폭이라 `tnum` 의
// 짝이 없다). 그래서 **「전부 들어야 한다」가 아니라 「하나라도 들어야 한다」** 를 본다.
// 열셋 전부 비어 있으면 11/13 의 그 꼴이다 — 설정만 고치고 다시 안 뽑은 것이다
console.log('');
console.log('── 뽑아둔 글꼴에 실제로 들었나 ──');
const 글꼴들 = fs.existsSync(path.join(SRC, 'assets/fonts'))
  ? fs.readdirSync(path.join(SRC, 'assets/fonts')).filter((f) => f.endsWith('.woff2')) : [];
ok('뽑아둔 글꼴이 있다', 글꼴들.length > 0, true);
let 셈 = null;
try {
  const py = `
import json,sys
from fontTools.ttLib import TTFont
out={}
for f in sys.argv[1:]:
    t=TTFont(f); s=set()
    for tag in ('GSUB','GPOS'):
        if tag in t and t[tag].table.FeatureList:
            s |= {r.FeatureTag for r in t[tag].table.FeatureList.FeatureRecord}
    out[f.split('/')[-1].split('\\\\')[-1]]=sorted(s)
print(json.dumps(out))
`;
  const args = ['-c', py, ...글꼴들.map((f) => path.join(SRC, 'assets/fonts', f))];
  셈 = JSON.parse(execFileSync('python', args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }));
} catch { 셈 = null; }
if (!셈) {
  skip('글꼴에 든 기능 세기', 'python 의 fontTools 가 없다 (생성기가 쓰는 그 손이다)');
} else {
  const 든것 = Object.entries(셈).filter(([, v]) => v.length);
  Object.entries(셈).forEach(([f, v]) => console.log(`       ${f} ${v.length ? v.join(' ') : '(없음)'}`));
  ok('기능이 든 글꼴이 하나라도 있다 (설정만 고치고 안 뽑았나)', 든것.length > 0, true);
  // ── 부르는 자리의 **그 글꼴**이 그 기능을 쓸 수 있나 ──
  //
  // 「어딘가에 있다」로는 모자란다. `tabular-nums` 를 말해도 **그 자리에 쓰이는
  // 글꼴**에 `tnum` 이 없으면 아무 일도 안 난다. 다만 **이미 숫자 폭이 같은 글꼴**
  // (Bebas 는 전부 400)은 `tnum` 이 없는 것이 맞다 — 짝이 없어 추려진 것이다.
  // 그래서 **「기능이 있거나, 없어도 되는 글꼴이거나」** 를 본다.
  const 가족글꼴 = {};
  try {
    const css = fs.readFileSync(path.join(SRC, 'styles/fonts.gen.css'), 'utf8');
    let 가족 = null;
    css.split('\n').forEach((l) => {
      const f = /font-family:\s*['"]([^'"]+)['"]/.exec(l);
      if (f) 가족 = f[1];
      const u = /url\(['"][^'"]*\/([^/'"]+\.woff2)['"]\)/.exec(l);
      if (u && 가족) (가족글꼴[가족] = 가족글꼴[가족] || []).push(u[1]);
    });
  } catch { /* 없으면 아래에서 건너뛴다 */ }
  const 고정폭숫자 = 숫자폭();
  for (const feat of Object.keys(말해야켜지는것)) {
    const 자리들 = 부르는자리(말해야켜지는것[feat]);
    if (!자리들.length) continue;
    const 헛된자리 = [];
    for (const 자리 of 자리들) {
      const 스택 = 글꼴스택(자리);
      if (!스택.length) { 헛된자리.push(`${자리} (글꼴을 못 찾았다)`); continue; }
      // 스택에 든 글꼴 중 **하나라도** 그 기능을 쓸 수 있거나, 쓸 필요가 없으면 된다
      const 된다 = 스택.some((가족) => (가족글꼴[가족] || []).some((f) => {
        if ((셈[f] || []).includes(feat)) return true;
        // `tnum` 은 숫자 폭이 이미 같으면 없어도 된다
        return feat === 'tnum' && 고정폭숫자[f] === true;
      }));
      if (!된다) 헛된자리.push(`${자리} [${스택.join(' → ')}]`);
    }
    ok(`  부르는 \`${feat}\` 이 그 자리의 글꼴에서 쓰인다`, 헛된자리, []);
  }

  // ── 넣었는데 **그 글꼴로 부르는 자리가 없는** 기능 ──
  //
  // 위의 「아무도 안 부른다」는 **말이 있나**만 봤다. 여기서는 **그 글꼴을 쓰는
  // 자리에서** 부르는지 본다. Barlow 에 `tnum` 을 넣어두고 `tabular-nums` 는
  // Bebas 자리에서만 말하면, Barlow 의 `tnum` 은 **한 번도 안 쓰인다.**
  // 이것은 「고치시오」가 아니라 **알리는 줄**이다 — 어느 수를 고정폭으로 세울지는
  // 꼴을 보는 사람이 정한다(FAIL 로 세우지 않는다)
  for (const feat of Object.keys(말해야켜지는것)) {
    if (!남긴기능.has(feat)) continue;
    const 자리들 = 부르는자리(말해야켜지는것[feat]);
    const 쓰이는가족 = new Set();
    자리들.forEach((자리) => 글꼴스택(자리).forEach((가족) => 쓰이는가족.add(가족)));
    const 안쓰이는 = Object.entries(가족글꼴)
      .filter(([가족, 파일들]) => 파일들.some((f) => (셈[f] || []).includes(feat)) && !쓰이는가족.has(가족))
      .map(([가족]) => 가족);
    if (안쓰이는.length) {
      console.log(`알림   \`${feat}\` 이 들었는데 그 글꼴로 부르는 자리가 없다 — ${안쓰이는.join(' · ')}`);
      console.log('       (그만큼이 값만 무게다. 어느 수를 고정폭으로 세울지는 꼴을 보는 사람이 정한다)');
    }
  }
}

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
