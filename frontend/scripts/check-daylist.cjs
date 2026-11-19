// **날짜 묶음에 든 것이 줄 묶음인가 — 들어오는 자리에서 막는가** (2026-11-19)
//
//   npm run daylist
//   node scripts/check-daylist.cjs --되돌려     일부러 어긋낸 꼴 다섯을 먹여 본다
//
// ── 왜 이 자가 생겼나 ──
//
// 11/19 에 정석이 `pace.운동별평소` 에서 터지는 자리를 잡았다 —
// `{ '2026-11-18': '글자' }` 를 주면 `(list || []).filter is not a function` 이다.
// 화면 그리는 길에서 터지면 `ErrorBoundary` 가 받아 **그 화면이 통째로 사라진다.**
//
// ── 스물여덟에 적지 않는다 ──
//
// 이 묶음을 날짜별로 훑는 자리가 **스물여덟 곳**이다. 거기 각각 `Array.isArray` 를
// 적으면 그 규칙이 **스물여덟 벌**이 되고, 다음에 자리가 느는 날 또 한 곳이 빠진다.
// 그래서 **들어오는 자리**(`data/offline.js` 의 `readCache`)에서 막는다 — 담는 쪽
// (`saveCache`)은 이미 `Array.isArray(items)` 로 거르고 있었다. **한 쌍인데 한쪽만
// 보고 있던 것**이다.
//
// ── 무엇을 보는가 ──
//
//   ⑴ `readCache` 가 **날짜마다** 줄 묶음인지 본다 — 글자 · 수 · `null` 이 든 날은 뺀다
//   ⑵ `saveCache` 와 **짝**이다 (한쪽만 보면 또 샌다)
//   ⑶ 성한 날은 **그대로** 온다 (너무 조여 멀쩡한 것을 버리지 않는다)
//   ⑷ 겉모양도 그대로 본다 (묶음 · `null` · 글자가 오면 `null`)
//
// esbuild 로 ESM 을 걷어 **실제로 돌린다** — 글자 찾기로는 막히는지 알 수 없다.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const NL = String.fromCharCode(10);
let bad = 0;
const 본다 = (이름, 받은것, 바라던것) => {
  const g = JSON.stringify(받은것);
  const w = JSON.stringify(바라던것);
  const 같다 = g === w;
  if (!같다) bad += 1;
  console.log((같다 ? 'OK   ' : 'FAIL ') + 이름 + ' → ' + g + (같다 ? '' : ' (기대: ' + w + ')'));
};

/** `data/offline.js` 를 걷어 **기기 저장을 가짜로 쥐어** 불러온다 */
function 들여온다(저장 = {}) {
  const out = esbuild.buildSync({
    entryPoints: [path.join(ROOT, 'src/data/offline.js')],
    bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'error',
    external: ['./safeStorage'],
  });
  const 가짜저장 = {
    canStore: () => true,
    readLS: (k) => (k in 저장 ? 저장[k] : null),
    saveLS: (k, v) => { 저장[k] = String(v); },
    removeLS: (k) => { delete 저장[k]; },
    // `readJson` 이 이 파일 안에 있으면 안 쓰이고, 밖에 있으면 여기서 받는다
    readJson: (k, fallback) => { try { return JSON.parse(저장[k]); } catch { return fallback; } },
    saveJson: (k, v) => { 저장[k] = JSON.stringify(v); },
  };
  const m = { exports: {} };
  const 손 = (id) => (/safeStorage$/.test(id) ? 가짜저장 : require(id));
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', out.outputFiles[0].text)(m, m.exports, 손);
  return m.exports;
}

// 열쇠 이름을 **베끼지 않는다** — 그 파일에서 읽는다
const 저장글 = fs.readFileSync(path.join(ROOT, 'src/data/localKeys.js'), 'utf8');
const 열쇠 = (/WORKOUT_CACHE_KEY\s*=\s*'([^']+)'/.exec(저장글) || [])[1];

console.log('── 들어오는 자리에서 막는가 ──');
본다('담아두는 열쇠 이름을 읽었다', typeof 열쇠 === 'string' && 열쇠.length > 0, true);

const 담긴것 = (v) => ({ [열쇠]: JSON.stringify(v) });

{
  const O = 들여온다(담긴것({
    '2026-11-18': [{ exercise: '스쿼트' }],
    '2026-11-17': '글자',
    '2026-11-16': 3,
    '2026-11-15': null,
    '2026-11-14': { exercise: '묶음이 아니다' },
  }));
  const got = O.readCache();
  본다('줄 묶음인 날만 남는다', Object.keys(got || {}), ['2026-11-18']);
  본다('  성한 날은 그대로 온다', (got && got['2026-11-18'] || []).length, 1);
}
{
  const O = 들여온다(담긴것({ '2026-11-18': [{ a: 1 }], '2026-11-17': [{ b: 2 }] }));
  본다('성한 것만 있으면 다 온다', Object.keys(O.readCache() || {}).length, 2);
}
{
  본다('담긴 게 없으면 null', 들여온다({}).readCache(), null);
  본다('묶음이 담겨 있으면 null', 들여온다(담긴것([1, 2, 3])).readCache(), null);
  본다('글자가 담겨 있으면 null', 들여온다({ [열쇠]: '"글자"' }).readCache(), null);
  본다('깨진 글이면 null', 들여온다({ [열쇠]: '깨진 글' }).readCache(), null);
}

console.log(NL + '── 담는 쪽과 짝인가 ──');
{
  const 글 = fs.readFileSync(path.join(ROOT, 'src/data/offline.js'), 'utf8');
  const 코드 = 글.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const 담는쪽 = /export function saveCache[\s\S]*?\n\}/.exec(코드);
  const 읽는쪽 = /export function readCache[\s\S]*?\n\}/.exec(코드);
  본다('담는 쪽을 찾았다', !!담는쪽, true);
  본다('읽는 쪽을 찾았다', !!읽는쪽, true);
  본다('담는 쪽이 줄 묶음인지 본다', !!담는쪽 && /Array\.isArray\(/.test(담는쪽[0]), true);
  본다('읽는 쪽도 본다 (한쪽만 보면 또 샌다)', !!읽는쪽 && /Array\.isArray\(/.test(읽는쪽[0]), true);

  // ── ★ **문이 둘인데 자가 하나만 보고 있었다** ── (2026-11-19 · 정석 2차)
  //
  // 날짜 묶음이 화면으로 들어오는 길은 **둘**이다 —
  //
  //     기기에 담아둔 것   `readCache()`                    ← 이 자가 보던 문
  //     서버에서 온 것     `mergeQueue(server, queue)`      ← **안 보고 있었다**
  //       (`store/workoutStore.js` 의 `set({ workouts: mergeQueue(…) })`)
  //
  // 지금은 `mergeQueue` 도 `Array.isArray(items) ? […items] : []` 로 막고 있어 **구멍은
  // 없다.** 그런데 **자가 그것을 안 보므로**, 누가 그 한 줄을 지우면 스물여덟 자리가
  // 다시 무방비가 되고 **아무 자도 안 운다.** 「뿌리에서 막았다」는 말은 **그 뿌리가
  // 지켜질 때만** 참이다.
  //
  // 아침에 `check-threestate` 가 파일 넷만 이름으로 보던 것과 **같은 류**다 —
  // 자가 모집단의 **일부만** 본다.
  const 섞는쪽 = /export function mergeQueue[\s\S]*?\n\}/.exec(코드);
  본다('섞는 쪽(서버에서 온 길)을 찾았다', !!섞는쪽, true);
  // ★ **`Array.isArray(` 가 있나**로 보면 안 된다 — 이 함수 안에 그것이 **셋**이다
  // (`workouts` 가 묶음인가 · `queue` 가 묶음인가 · **날짜 값이 묶음인가**). 날짜 값을
  // 막는 그 한 줄만 지워도 **자는 통과한다.** 11/19 에 내가 그 느슨한 꼴로 한 번 세웠고,
  // 되돌려를 돌려 보다 잡았다 — **무엇을 막는 `Array.isArray` 인지**까지 본다
  본다('섞는 쪽이 **날짜 값**이 줄 묶음인지 본다 (문이 둘이다)',
    !!섞는쪽 && /Object\.entries\([\s\S]{0,120}?Array\.isArray\(\s*items\s*\)/.test(섞는쪽[0]), true);

  // 그리고 **화면이 그 둘 말고 다른 문으로 안 받는지** 본다 — 새 문이 생기면 운다
  const 가게 = fs.readFileSync(path.join(ROOT, 'src/store/workoutStore.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const 넣는자리 = [...가게.matchAll(/workouts:\s*([A-Za-z가-힣_$][\w가-힣_$.]*)\s*\(?/g)]
    .map((m) => m[1])
    .filter((n) => n !== 'workouts');
  본다('날짜 묶음을 세우는 손이 **아는 둘뿐**이다',
    [...new Set(넣는자리)].filter((n) => !['mergeQueue', 'readCache'].includes(n)), []);
}

// ── 되돌려 보기 ──────────────────────────────────────────────
if (process.argv.includes('--되돌려')) {
  console.log(NL + '── 되돌려 보기 ──');
  let 못집은것 = 0;
  // **옛 꼴을 그 자리에서 지어** 먹인다 — 파일을 고쳐 재지 않는다(트리를 셋이 쓴다)
  const 옛읽기 = (저장) => {
    try {
      const c = JSON.parse(저장[열쇠]);
      return c && typeof c === 'object' && !Array.isArray(c) ? c : null;
    } catch { return null; }
  };
  const 상한것 = 담긴것({ '2026-11-18': [{ a: 1 }], '2026-11-17': '글자' });
  const 꼴 = [
    ['옛 꼴은 글자가 든 날을 그대로 들여보낸다',
      () => Object.keys(옛읽기(상한것) || {}).length, 2],
    ['  지금 꼴은 그 날을 뺀다',
      () => Object.keys(들여온다(상한것).readCache() || {}).length, 1],
    ['옛 꼴로 받은 것은 거기서 터진다',
      () => { try { (옛읽기(상한것)['2026-11-17'] || []).filter(() => true); return '안 터진다'; }
              catch (e) { return '터진다'; } }, '터진다'],
    ['  지금 꼴로 받은 것은 안 터진다',
      () => { const g = 들여온다(상한것).readCache();
              return Object.values(g).every((v) => Array.isArray(v)) ? '안 터진다' : '터진다'; }, '안 터진다'],
    ['걷어낸 모듈이 실제로 돌았다 (글자 찾기가 아니다)',
      () => typeof 들여온다({}).readCache, 'function'],
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
