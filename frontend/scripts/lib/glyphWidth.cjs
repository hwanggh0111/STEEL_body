// ── **「숫자 한 자가 몇 px 인가」를 글꼴 파일에 물어서 답한다** ── (2026-11-19 · 정석)
//
// `narrow-measure.cjs` 가 비워 둔 그 한 줄에 끼우는 조각이다. 맵시의 판단이 맞다 —
// 어림값(Barlow 14px ≈ 7.7px)을 자에 박으면 그때부터 그 자는 「지금」이 아니라
// **짐작을 베낀다**. 그래서 어디에도 폭을 적지 않고 **그 자리에서 읽는다** —
//
//   ⑴ `.input`(또는 부르는 쪽이 준 고르개)의 `font-family` · `font-size` 를 **CSS 에서**
//   ⑵ 글자 사이 간격(`letter-spacing`)을 `body` 에서 — 이 앱은 0.1px 을 깔고 있고
//      **상속되므로** 칸 안 숫자에도 붙는다. 다섯 자면 0.5px 다
//   ⑶ 그 글꼴 이름 · 굵기에 걸린 **woff2 파일 주소를 `@font-face` 에서**
//   ⑷ 그 파일을 열어 **숫자의 advance** 를 읽는다
//
// ★ 왜 「숫자 하나」로 말할 수 있나 — `globals.css` 가 `font-variant-numeric:
//   tabular-nums` 를 **전역**으로 깔고 있다. 그래서 0~9 가 전부 같은 폭(`tnum` 글리프)
//   이다. 그 줄이 사라지면 숫자 폭이 **350~565 로 21.5% em** 벌어지므로(11/16 에 그래서
//   잠금 화면의 초가 떨렸다) 이 조각은 **그 줄이 살아 있는지 먼저 보고**, 없으면
//   `tabular` 를 `false` 로 주고 **가장 넓은 숫자**로 셈한다 — 모를 때는 우는 쪽이다.
//
// ★ 세 가지 끝 —
//   · **python fontTools 가 없으면 `건너뜀`** 을 돌려준다(부르는 쪽이 한 줄 적고 통과도
//     실패도 하지 않는다). 거짓 PASS 를 만들지 않는다 — `check-font` 가 쓰는 그 선이다
//   · **읽기 실패는 던진다**(글꼴 파일이 없다 · `@font-face` 를 못 찾았다 · 숫자가
//     글꼴에 없다). 부르는 쪽은 그것을 **FAIL** 로 적는다 — 11/17 에 정한 「모를 때는
//     우는 쪽으로 틀린다」
//   · 값을 캐지 않는다. 글꼴을 갈면 다음 번에 바로 다른 값이 나온다
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');          // frontend/

const 읽기 = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** CSS 묶음 하나에서 속성 하나를 집어낸다. 못 찾으면 던진다 */
function 집어내기(글, 식, 무엇) {
  const m = 식.exec(글);
  if (!m) throw new Error(무엇 + ' 을 CSS 에서 못 찾았다 — 자가 짐작하면 안 된다');
  return m[1];
}

/**
 * 고르개(`.input` 같은) 한 개의 글꼴 사정을 CSS 에서 읽는다.
 * @returns {{family:string, size:number, weight:number, letterSpacing:number, tabular:boolean}}
 */
function 글꼴사정(고르개 = '.input', cssRel = 'src/styles/globals.css') {
  const css = 읽기(cssRel);
  const 묶음식 = new RegExp(고르개.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([\\s\\S]*?)\\}');
  const 묶음 = 집어내기(css, 묶음식, 고르개 + ' 묶음');

  const family = 집어내기(묶음, /font-family:\s*'([^']+)'/, 고르개 + ' 의 font-family')
  const size = +집어내기(묶음, /font-size:\s*([\d.]+)px/, 고르개 + ' 의 font-size');
  // 굵기는 적혀 있을 때만 — 없으면 본문 굵기를 따른다
  const 굵기m = /font-weight:\s*(\d+)/.exec(묶음);
  const bodyBlock = 집어내기(css, /\bbody\s*\{([\s\S]*?)\n\}/, 'body 묶음');
  const weight = 굵기m ? +굵기m[1]
    : +집어내기(bodyBlock, /font-weight:\s*(\d+)/, 'body 의 font-weight');

  // 글자 사이 간격은 **상속된다** — 고르개에 없으면 body 의 것이 붙는다
  const 간격m = /letter-spacing:\s*([\d.-]+)px/.exec(묶음);
  const letterSpacing = 간격m ? +간격m[1]
    : (+(/letter-spacing:\s*([\d.-]+)px/.exec(bodyBlock) || [0, 0])[1] || 0);

  // 숫자가 고정폭인가 — 이 줄이 죽으면 가장 넓은 숫자로 셈해야 한다
  const tabular = /font-variant-numeric:\s*[^;]*tabular-nums/.test(bodyBlock);

  return { family, size, weight, letterSpacing, tabular };
}

/** `@font-face` 에서 그 이름·굵기의 woff2 파일 주소를 찾는다 */
function 글꼴파일(family, weight, cssRel = 'src/styles/fonts.gen.css') {
  const css = 읽기(cssRel);
  const 벌 = [];
  for (const m of css.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)) {
    const 속 = m[1];
    const f = (/font-family:\s*'([^']+)'/.exec(속) || [])[1];
    const w = +(/font-weight:\s*(\d+)/.exec(속) || [])[1];
    const u = (/url\('([^']+)'\)/.exec(속) || [])[1];
    // 쪼갠 벌(`-rest-`)은 한글 뒷덩이다 — 숫자는 앞벌이 든다
    if (f === family && u && !/-rest-/.test(u)) 벌.push({ weight: w, url: u });
  }
  if (!벌.length) throw new Error(`@font-face 에 '${family}' 가 없다`);
  // 굵기가 딱 맞는 것, 없으면 가장 가까운 것
  벌.sort((a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight));
  const 고른것 = 벌[0];
  const p = path.join(ROOT, 'src', 'styles', 고른것.url);
  if (!fs.existsSync(p)) throw new Error('글꼴 파일이 없다: ' + 고른것.url);
  return { 파일: p, 굵기: 고른것.weight, 주소: 고른것.url };
}

const PY = [
  'import sys, json',
  'from fontTools.ttLib import TTFont',
  't = TTFont(sys.argv[1])',
  'upm = t["head"].unitsPerEm',
  'cmap = t.getBestCmap()',
  'hmtx = t["hmtx"]',
  'def adv(ch):',
  '    cp = ord(ch)',
  '    return hmtx[cmap[cp]][0] if cp in cmap else None',
  'digits = {d: adv(d) for d in "0123456789"}',
  'tnum = None',
  'try:',
  '    g = t["GSUB"].table',
  '    for fr in g.FeatureList.FeatureRecord:',
  '        if fr.FeatureTag != "tnum":',
  '            continue',
  '        for li in fr.Feature.LookupListIndex:',
  '            for st in g.LookupList.Lookup[li].SubTable:',
  '                mp = getattr(st, "mapping", None)',
  '                z = cmap.get(ord("0"))',
  '                if mp and z in mp:',
  '                    tnum = hmtx[mp[z]][0]',
  'except Exception:',
  '    tnum = None',
  'print(json.dumps({"upm": upm, "digits": digits, "tnum": tnum, "dot": adv(".")}))',
].join('\n');

// ── ★ **「손이 없다」와 「읽다 실패했다」는 다른 끝이다** ── (2026-11-19 · 정석)
//
// 처음에 이 조각은 `python` 이 0 이 아닌 값을 내면 **무엇이든** `null`(건너뜀)로
// 돌렸다. 그러면 **글꼴 파일이 없어도 「건너뜀」**이 되어 조용히 지나간다 — 벼림이
// 못 박은 선(⒝ 손이 없으면 건너뜀 · ⒞ **읽기 실패는 FAIL**)이 섞여버린다.
// 스스로 찔러 보고 잡았다(없는 파일을 먹였더니 던지지 않고 `null` 이 나왔다).
// 그래서 **손이 있는지를 따로 묻는다** — 그 뒤의 실패는 전부 던진다.
function 파이썬있나() {
  try {
    execFileSync('python', ['-c', 'import fontTools'],
      { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch { return false; }
}

/** woff2 를 열어 글리프 폭(em 단위 그대로)을 읽는다. 손이 없으면 `null`, 읽기 실패는 **던진다** */
function 글리프폭(파일) {
  if (!파이썬있나()) return null;         // 손이 없다 — 부르는 쪽이 건너뜀으로 적는다
  if (!fs.existsSync(파일)) throw new Error('글꼴 파일이 없다: ' + 파일);
  let 날것;
  try {
    날것 = execFileSync('python', ['-c', PY, 파일],
      { encoding: 'utf-8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    throw new Error('글꼴을 열다 실패했다 (' + 파일 + ') — ' + e.message.split('\n')[0]);
  }
  let v;
  try { v = JSON.parse(날것); } catch { throw new Error('글꼴을 읽었는데 값이 깨졌다'); }
  if (!v.upm || !v.digits || v.digits['0'] == null) {
    throw new Error('글꼴에 숫자가 없다 — 이 글꼴로는 숫자를 그릴 수 없다');
  }
  if (v.dot == null) throw new Error('글꼴에 소수점(`.`)이 없다');
  return v;
}

/**
 * **부르는 쪽이 쓰는 손.** 고르개 하나의 숫자 한 자 폭(px)과 글 재는 함수를 준다.
 *
 * @param {object} [o]
 * @param {string} [o.고르개]  기본 `.input`
 * @returns {{건너뜀?:string, 글자폭?:number, 소수점폭?:number, 사정?:object, 글폭?:(s:string)=>number}}
 */
function 숫자폭(o = {}) {
  const 사정 = 글꼴사정(o.고르개 || '.input');
  const f = 글꼴파일(사정.family, 사정.weight);
  const g = 글리프폭(f.파일);
  if (g === null) {
    return { 건너뜀: 'woff2 를 열 손이 없다 (python fontTools — 생성기가 쓰는 그 손이다)' };
  }
  const px = (adv) => (adv / g.upm) * 사정.size;

  // 고정폭이면 `tnum` 글리프, 그 줄이 죽었으면 **가장 넓은 숫자**로 센다
  const 숫자adv = 사정.tabular
    ? (g.tnum != null ? g.tnum : Math.max(...Object.values(g.digits)))
    : Math.max(...Object.values(g.digits));
  const 글자폭 = +px(숫자adv).toFixed(3);
  const 소수점폭 = +px(g.dot).toFixed(3);

  // 글 하나가 드는 자리 — **소수점을 어림하지 않는다**(맵시 틀은 숫자폭의 0.5 로 뒀다)
  const 글폭 = (s) => +[...String(s)].reduce((합, ch) => {
    if (ch >= '0' && ch <= '9') return 합 + 글자폭 + 사정.letterSpacing;
    if (ch === '.') return 합 + 소수점폭 + 사정.letterSpacing;
    throw new Error('숫자와 소수점만 잴 수 있다 — 받은 글자: ' + JSON.stringify(ch));
  }, 0).toFixed(3);

  return {
    글자폭, 소수점폭, 글폭,
    사정: {
      ...사정,
      글꼴파일: f.주소, 글꼴굵기: f.굵기,
      unitsPerEm: g.upm, 숫자advance: 숫자adv, 소수점advance: g.dot,
      고정폭: 사정.tabular && g.tnum != null,
    },
  };
}

module.exports = { 숫자폭, 글꼴사정, 글꼴파일, 글리프폭, 파이썬있나 };
