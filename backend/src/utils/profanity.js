// ─────────────────────────────────────────────────────────────
// 욕설 · 비하 표현 판정
//
// 세 단계로 나눈다.
//   mild   — 짜증에서 나오는 말. 막지 않는다. 안 되는 걸 겪고 화가 난 사람을
//            문법으로 걸러내면 제보 자체가 안 들어온다. 기록만 남긴다
//   severe — 대놓고 하는 욕. 막고, 누적해서 처벌 수위를 올린다
//   hate   — 비하·혐오·패드립. 누적을 안 기다린다. 첫 번에 제일 무겁게 간다
//
// 우회를 막는 게 절반이다. 사람은 시*발, 시 발, 시이이발, ㅅㅂ 로 쓴다.
// 그래서 원문을 세 가지 꼴로 만들어 전부 대조한다.
//   plain — 한글·영문·숫자만 남기고 나머지를 지운 것 (시*발 → 시발)
//   jamo  — 자모로 풀어헤친 것 (시발 → ㅅㅣㅂㅏㄹ). 받침 섞기 우회를 잡는다
//   초성  — 초성만 뽑은 것 (시발 → ㅅㅂ). 초성체를 잡는다
//
// 늘여 쓰기(시이이발)는 자모 꼴에서 "앞 모음과 같은 ㅇ+모음"을 지워 잡는다.
// ─────────────────────────────────────────────────────────────

const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

// 숫자·기호로 글자를 흉내 낸 것들
const LEET = { '0': 'ㅇ', '1': 'ㅣ', '4': 'ㅅ', '8': 'ㅂ', '@': 'ㅇ', '$': 'ㅅ' };

// ── 숫자는 **한글에 붙어 있을 때만** 글자로 읽는다 ── (2026-10-21)
//
// 여태 `0148@$` 를 **글 전체에서** 자모로 바꿨다. 그래서 이 앱에서 가장 흔한 숫자가
// 욕이 됐다 — 돌려보고 찾았다:
//
//     "48kg 들었는데 기록이 안 돼요"   → ㅅㅂ   → severe
//     "벤치 84kg 에서 멈춰요"          → ㅂㅅ   → severe
//     "148kg 데드리프트"              → ㅣㅅㅂ → severe
//     "184cm 84kg"                   → ㅂㅅ ×2 → severe
//     "스쿼트 48회" · "점심 48분에"     → ㅅㅂ   → severe
//
// **여기는 운동 기록 앱이다.** 48kg · 84kg · 148kg · 184cm 는 제보에 가장 자연스럽게
// 들어가는 숫자다. 그 제보가 **막히고**, 욕설 누적이 쌓여 두 번째에 1일 정지,
// 네 번째에 7일 정지였다. 쓴 사람은 숫자를 적었을 뿐이다.
//
// 흉내를 잡으려던 것은 `시8발` · `ㅅ1발` 처럼 **글자 사이에 숫자를 끼운 것**이다.
// 그러니 **양옆 중 한쪽이라도 한글일 때만** 바꾼다 — `48kg` 은 양옆이 한글이 아니라
// 숫자로 남고, 아래에서 기호와 함께 지워진다.
const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
function leetize(s) {
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    const sub = LEET[ch];
    if (sub && (HANGUL.test(s[i - 1] || '') || HANGUL.test(s[i + 1] || ''))) out += sub;
    else out += ch;
  }
  return out;
}

function toPlain(str) {
  const s = leetize(String(str).toLowerCase().normalize('NFC'));
  // 한글(음절/자모)·영문만 남긴다. 공백·기호·이모지로 끊어 쓰는 우회를 없앤다
  return s.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z]/g, '');
}

function toJamo(plain) {
  let out = '';
  for (const ch of plain) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code >= 0 && code <= 11171) {
      out += CHO[Math.floor(code / 588)] + JUNG[Math.floor((code % 588) / 28)] + JONG[code % 28];
    } else {
      out += ch;
    }
  }
  // 늘여 쓰기: 앞 모음과 같은 'ㅇ+모음' 을 지운다 (시이이발 → 시발, 개애새끼 → 개새끼)
  let prev;
  do { prev = out; out = out.replace(/([ㅏ-ㅣ])(ㅇ\1)+/g, '$1'); } while (out !== prev);
  // 같은 자모가 세 번 이상 이어지면 하나로 (ㅅㅅㅅㅂ → ㅅㅂ)
  return out.replace(/(.)\1{2,}/g, '$1');
}

// 초성체는 "사람이 자모만 쳐서 쓴 것" 이다.
// 음절을 풀어서 초성을 뽑으면 안 된다 — '사부작' 이 ㅅㅂ 가 되어 걸린다.
// 원문에 자모로 적혀 있는 덩어리만 모은다.
//
// ── **숫자가 바뀐 자모는 안 본다** ── (2026-10-21)
//
// `plain` 에는 흉내 치환으로 **우리가 만든 자모**가 섞여 있었다(`4`→ㅅ, `8`→ㅂ).
// 「사람이 직접 친 것만 본다」는 바로 위의 약속이 그 자리에서 깨졌다 —
// 「48」이 「ㅅㅂ」이 되어 걸렸다. 그래서 **원문을 받아** 거기 적힌 자모만 모은다.
// (치환 자체도 한글에 붙었을 때만 하게 고쳤지만, 두 자리 다 지켜야 한다.)
function toCho(raw) {
  const s = String(raw ?? '').toLowerCase().normalize('NFC');
  // 자모 사이의 공백·기호만 지운다 — 「ㅅ ㅂ」 · 「ㅅ.ㅂ」 처럼 끊어 쓰는 우회를 잡는다
  const kept = s.replace(/[^ㄱ-ㅎㅏ-ㅣ]+/g, (m, off) => {
    const before = s[off - 1];
    const after = s[off + m.length];
    const joins = before && after && /[ㄱ-ㅎㅏ-ㅣ]/.test(before) && /[ㄱ-ㅎㅏ-ㅣ]/.test(after);
    return joins && /^[\s.,·*_~-]+$/.test(m) ? '' : ' ';
  });
  return (kept.match(/[ㄱ-ㅎ]+/g) || []).join(' ');
}

// ── 멀쩡한 말인데 욕이 안에 든 것 ── (2026-10-21)
//
// 돌려보고 둘을 찾았다 —
//
//     "시발점에서 다시 시작했어요"     → 시발  → severe   (始發點)
//     "3개년 계획으로 하고 있어요"     → 개년  → severe   (個年)
//
// 사전은 **글 안에 들어 있으면** 걸리게 돼 있다(우회를 막으려고 그렇게 뒀다).
// 그래서 욕을 품은 멀쩡한 낱말은 **보기 전에 걷어낸다.** 받침 섞기 우회로 쓰이는
// 꼴이 아니라 **그 자체로 다른 뜻인 낱말**만 넣는다.
const INNOCENT = [
  /시발(점|역|차|지|선)/g,          // 始發 — 시발점 · 시발역
  /\d+\s*개년/g,                    // 個年 — 3개년 계획
];
function dropInnocent(str) {
  let s = String(str ?? '');
  for (const re of INNOCENT) s = s.replace(re, ' ');
  return s;
}

// ── 사전 ──
//
// 여기 없는 말은 안 걸린다. 완전할 수 없고, 완전하려 들면 멀쩡한 제보가 막힌다.
// 놓친 것은 관리자 화면에서 보고 손으로 처리한다.

// 비하 · 혐오 · 패드립 — 누적을 안 기다린다
const HATE = [
  '병신', '븅신', '빙신', '애자', '앉은뱅이', '벙어리', '귀머거리', '절름발이',
  '느금마', '느그애미', '니애미', '니애비', '늬애미', '애미없', '애비없', '엄창',
  '한남충', '김치녀', '된장녀', '맘충', '급식충', '틀딱', '노인네틀딱', '연금충',
  '흑형', '짱깨', '쪽바리', '쪽발이', '깜둥이', '조센징',
  '전라디언', '홍어새끼', '과메기',
  '창녀', '걸레년', '보슬아치', '군바리새끼',
  '정신병자새끼', '장애인새끼',
];

// 대놓고 하는 욕 — 누적해서 수위를 올린다
const SEVERE = [
  '씨발', '시발', '씨팔', '시팔', '씨바', '쒸발', '씹할', '십새', '씹새끼', '씨발놈', '씨발년',
  '개새끼', '개색기', '개시키', '개자식', '새끼야', '개년', '개놈',
  '지랄', '염병', '옘병', '개지랄',
  // 홀로 쓰면 멀쩡한 말을 잡는다 — '보지도 못했어요' · '씹어 먹었어요' · '자지 않고'.
  // 욕으로만 쓰이는 꼴로만 둔다
  '좆같', '좆밥', '개좆', '씹새', '씹창', '보지년', '자지새끼',
  '니미', '니미럴', '제미랄', '니애미뒤졌',
  '미친놈', '미친년', '또라이새끼', '돌아이새끼',
  // '꺼져' · '뒤져' · '죽어라' 는 뺐다.
  // '화면이 꺼져요' · '기록을 뒤져봐도' · '죽어라 눌러도' 가 전부 정상적인 제보다
  '뒈져', '죽여버', '죽여버린다',
  'fuck', 'shit', 'bitch', 'asshole', 'motherfucker',
];

// 짜증에서 나오는 말 — 막지 않는다. 기록만 남긴다
const MILD = [
  '짜증', '개짜증', '빡친', '빡쳐', '빡치', '열받', '열뻗',
  '젠장', '망할', '엿같', '드럽게', '더럽게', '어이없', '기가막',
  '개같', '개판', '개떡', '똥같', '거지같', '꼴같', '병맛',
  '미친', '또라이', '돌아이', '멍청', '한심', 'damn', 'crap',
];

// 초성체 — 초성 꼴에서만 본다. 짧아서 오탐이 나기 쉬우니 확실한 것만 넣는다
const CHO_SEVERE = ['ㅅㅂ', 'ㅄ', 'ㅂㅅ', 'ㅈㄹ', 'ㄲㅈ', 'ㅆㅂ', 'ㅁㅊㄴ', 'ㅈㄴㄱ'];

function prep(list) {
  return list.map(w => {
    const plain = toPlain(w);
    return { word: w, plain, jamo: toJamo(plain) };
  });
}

const DICT = {
  hate: prep(HATE),
  severe: prep(SEVERE),
  mild: prep(MILD),
};

// ── 음절 사이에 끼운 자모는 **덧댄 것**이다 ── (2026-10-21)
//
// `시8발` 은 여태 안 걸렸다(이 고침 전에도 그랬다). 숫자를 자모로 바꾸면 `시ㅂ발` 이
// 되는데, 자모 꼴로는 `ㅅㅣㅂㅂㅏㄹ` 이라 사전의 `ㅅㅣㅂㅏㄹ` 과 안 맞는다.
//
// **음절과 음절 사이에 혼자 선 자모**는 사람이 끼워 넣은 것이다 — 그것만 뺀 꼴을
// 하나 더 만들어 같이 본다. 혼자 서 있는 초성체(`ㅅㅂ`)는 **음절 사이가 아니라서**
// 건드리지 않는다. 멀쩡한 글에서는 오타(`기록ㅇ이`)뿐이고, 그건 빼도 뜻이 같다.
// **저장되는 글은 안 건드린다** — 맞춰보는 꼴만 하나 더 만드는 것이다.
const stripPad = (plain) => plain.replace(/(?<=[가-힣])[ㄱ-ㅎㅏ-ㅣ]+(?=[가-힣])/g, '');

function hits(forms, entries) {
  const found = [];
  for (const e of entries) {
    if (!e.plain) continue;
    if (forms.plain.includes(e.plain)
      || forms.jamo.includes(e.jamo)
      || forms.padless.includes(e.plain)) found.push(e.word);
  }
  return found;
}

/**
 * 글을 보고 단계를 매긴다.
 * @returns {{ level: 'clean'|'mild'|'severe'|'hate', hits: string[] }}
 */
function inspect(text) {
  if (typeof text !== 'string' || !text.trim()) return { level: 'clean', hits: [] };

  // 멀쩡한 낱말(始發點 · 3個年)을 먼저 걷는다 — 위 `INNOCENT` 머리글
  const raw = dropInnocent(text);
  const plain = toPlain(raw);
  // 초성체는 **원문**에서 본다 (우리가 바꾼 자모를 보지 않게 — `toCho` 머리글)
  const forms = { plain, jamo: toJamo(plain), cho: toCho(raw), padless: stripPad(plain) };

  const hate = hits(forms, DICT.hate);
  if (hate.length) return { level: 'hate', hits: hate };

  const severe = hits(forms, DICT.severe);
  // 초성체는 초성 꼴에서만 본다. 'ㅅㅂ' 을 본문 전체에서 찾으면 '사부작' 같은 말이 걸린다
  for (const c of CHO_SEVERE) {
    if (forms.cho.includes(c)) severe.push(c);
  }
  if (severe.length) return { level: 'severe', hits: [...new Set(severe)] };

  const mild = hits(forms, DICT.mild);
  if (mild.length) return { level: 'mild', hits: mild };

  return { level: 'clean', hits: [] };
}

module.exports = { inspect, toPlain, toJamo, toCho };
