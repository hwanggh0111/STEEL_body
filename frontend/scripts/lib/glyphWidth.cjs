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

// ── ★ **D 안으로 가면 자가 보는 것이 바뀐다** ── (2026-11-19 · 주인 결정)
//
// 주인이 고른 D 안은 칸 바닥을 `flex: 1 1 calc(5ch + 88px)` 로 깔고 **자리가 모자라면
// 브라우저가 알아서 줄을 바꾼다.** 즉 **폭을 숫자로 가르는 경계가 없다** — 그러니
// 「320·360·390·430 네 점에서 들어가는가」를 보는 자는 **D 를 검사할 수 없다**
// (브라우저가 `ch` 로 재는 것을 자가 흉내낼 수 없다). 지켜야 하는 것이 바뀐다 —
//
//   ⒜ 칸 바닥이 `calc(<n>ch + <m>px)` 꼴로 **적혀 있는가**
//   ⒝ 그 `m` 이 **코드에서 읽은 합**과 같은가 (생글자로 박히면 FAIL)
//   ⒞ `n` 이 「100.5」 다섯 자를 **담는가** ← 글꼴을 읽는 조각이 쓰이는 자리
//
// ★ `ch` 는 `tnum` 폭이 아니다. CSS 의 `1ch` 는 그 글꼴 **「0」 글리프의 advance** 다
//   (Barlow 400 에서 565/1000 em). 화면에 그려지는 숫자는 `tabular-nums` 때문에
//   527 이라 **`ch` 가 더 넓다** — 즉 `ch` 로 깐 바닥은 **안전한 쪽으로 넉넉하다.**
//   이 차이를 모르고 `ch` 를 7.378 로 세면 바닥을 **모자라게** 깔게 된다.

/** CSS `1ch` 가 몇 px 인가 — 그 글꼴 「0」 의 advance 다 (`tnum` 이 아니다) */
function ch폭(o = {}) {
  const 사정 = 글꼴사정(o.고르개 || '.input');
  const f = 글꼴파일(사정.family, 사정.weight);
  const g = 글리프폭(f.파일);
  if (g === null) {
    return { 건너뜀: 'woff2 를 열 손이 없다 (python fontTools — 생성기가 쓰는 그 손이다)' };
  }
  if (g.digits['0'] == null) throw new Error('글꼴에 「0」 이 없다 — `ch` 를 잴 수 없다');
  return {
    ch: +((g.digits['0'] / g.upm) * 사정.size).toFixed(3),
    사정: { ...사정, 영advance: g.digits['0'], unitsPerEm: g.upm, 글꼴파일: f.주소 },
  };
}

/** `calc(<n>ch + <m>px)` 를 읽는다. 그 꼴이 아니면 `null` — 부르는 쪽이 FAIL 로 적는다 */
function 바닥식읽기(글) {
  const m = /calc\(\s*([\d.]+)ch\s*\+\s*([\d.]+)px\s*\)/.exec(String(글 || ''));
  return m ? { n: +m[1], m: +m[2] } : null;
}

/**
 * ⒞ `n`ch 가 그 글을 담는가. 담는 자리는 `ch` 로 재고, 드는 자리는 **그려지는 폭**
 * (`tnum`)으로 잰다 — 두 단위가 다른 것이 이 셈의 요점이다
 */
function 담기나(글, n, o = {}) {
  const c = ch폭(o);
  if (c.건너뜀) return c;
  const w = 숫자폭(o);
  if (w.건너뜀) return w;
  const 있는것 = +(c.ch * n).toFixed(3);
  const 필요 = +w.글폭(글);
  return { 드나: 있는것 >= 필요, 있는것, 필요, ch: c.ch, 여유: +(있는것 - 필요).toFixed(3) };
}

/**
 * ⒝ `m` 이 몇이어야 하는가 — **코드에서 읽은 값만** 더한다.
 * 부르는 쪽(`narrow-measure.cjs` 의 `상수()`)이 이미 읽어 온 것을 받는다 —
 * 같은 값을 두 자리에서 읽으면 한쪽만 고쳐지는 날이 온다
 *
 * @param {{단추폭:number,단추틈:number,칸안여백:number,테두리?:number}} c
 * @param {{단추:number}} [꼴]  ± 가 몇 개인가 (무게·횟수 2 · 세트 0)
 */
function 더할값(c, 꼴 = {}) {
  const 단추수 = 꼴.단추 === undefined ? 2 : 꼴.단추;
  const 테두리 = c.테두리 === undefined ? 1 : c.테두리;
  for (const k of ['단추폭', '단추틈', '칸안여백']) {
    if (typeof c[k] !== 'number' || Number.isNaN(c[k])) {
      throw new Error('`' + k + '` 을 못 읽었다 — 자가 짐작하면 안 된다');
    }
  }
  // 단추 둘 · 그 사이 틈 둘 · 칸 안 좌우 여백 · 칸 테두리 좌우
  return c.단추폭 * 단추수 + c.단추틈 * 단추수 + c.칸안여백 * 2 + 테두리 * 2;
}

module.exports = {
  숫자폭, 글꼴사정, 글꼴파일, 글리프폭, 파이썬있나,
  ch폭, 바닥식읽기, 담기나, 더할값,
};
