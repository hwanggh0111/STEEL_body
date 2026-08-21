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

function toPlain(str) {
  let s = String(str).toLowerCase().normalize('NFC');
  s = s.replace(/[0148@$]/g, ch => LEET[ch] || ch);
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
function toCho(plain) {
  return (plain.match(/[ㄱ-ㅎ]+/g) || []).join(' ');
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

function hits(forms, entries) {
  const found = [];
  for (const e of entries) {
    if (!e.plain) continue;
    if (forms.plain.includes(e.plain) || forms.jamo.includes(e.jamo)) found.push(e.word);
  }
  return found;
}

/**
 * 글을 보고 단계를 매긴다.
 * @returns {{ level: 'clean'|'mild'|'severe'|'hate', hits: string[] }}
 */
function inspect(text) {
  if (typeof text !== 'string' || !text.trim()) return { level: 'clean', hits: [] };

  const plain = toPlain(text);
  const forms = { plain, jamo: toJamo(plain), cho: toCho(plain) };

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
