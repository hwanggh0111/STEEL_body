// ── 닉네임을 다루는 손은 **한 자리**다 ── (2026-11-18 · 정석)
//
// e25fc05 가 닉네임을 「친 그대로」 남기게 바꾸면서 `routes/auth.js` 안에 `keepNickname`
// 을 두었다. 정석 2차에서 둘이 걸렸다 —
//
//   1. **보이지 않는 이름이 통과했다.** 지우는 줄이 `sanitize.js` 의 `INVISIBLE` 과 같은
//      선(제어 문자 · 방향 뒤집는 글자)이라, 폭이 0 인 글자와 한글 채움 글자는 남았다:
//
//        U+200B ×30      → 통과 (빈 이름이 30자)
//        U+3164 한 글자  → 통과 (눈에는 빈칸 한 칸)
//        철 U+200F 수    → 통과 (방향 표시 글자가 끼어 있다)
//
//      `trim()` 은 이것들을 공백으로 안 본다. 관리자 목록 · 제보 화면에서 **이름이 없는
//      사람**이 생긴다.
//
//   2. **소셜 첫 이름은 옛 손**(`sanitize().slice(0, 30)`)이었다. 같은 사람이 가입하면
//      「I'm 강철」, 구글로 들어오면 다른 이름이 되고, `slice` 가 이모지를 반으로 자른다.
//
// 그래서 지우는 글자를 넓히고, 세 길(가입 · 이름 바꾸기 · 소셜 첫 이름)이 이 파일 하나를 부른다.
// 길이 선(`NICKNAME_MAX`)은 `routes/auth.js` 가 든다 — 자(`check-bounds`)가 거기서 읽는다.
//
// ── 2차에서 또 걸렸다: **지우기 전에 꼴을 검사했다** ── (2026-11-19 · 정석)
//
// 라우트는 `tagLike(raw)` 로 꺾쇠를 거절한 **뒤에** 이 파일이 보이지 않는 글자를 뗐다.
// 순서가 거꾸로라 꺾쇠 바로 뒤에 보이지 않는 글자 하나를 끼우면 그 선을 넘어간다 —
//
//        `<` U+200B `img src=x>` → tagLike 통과 → 지운 뒤 **`<img src=x>` 로 저장**
//        U+FEFF · U+00AD · U+3164 를 끼운 꼴도 모두 같다
//
// 화면은 React 가 글자로 그리니 **스크립트가 도는 일은 없다.** 깨지는 것은 두 가지다 —
// 주인이 11/18 에 정한 「**친 그대로**」(친 것과 다른 이름이 조용히 저장된다)와,
// 11/17 에 세운 「꺾쇠는 거절하고 까닭을 말한다」는 선이다.
// 같은 꼴이 **운동 한 줄 메모**(`utils/workoutFields.js`, 어제 붙은 f9fc09b)에도 복사돼
// 있었다. 그래서 **판정도 이 파일 한 자리**로 들인다 — `keepNickname` 이 지운 뒤에
// 꺾쇠를 보고, `nicknameWhy` 가 그 까닭을 말한다. 라우트의 `tagLike` 줄은 그대로 둔다
// (맨몸 태그를 더 이른 자리에서 거절하는 쪽이 낫다 — 겹쳐 막는 것은 손해가 아니다).
//
// 같이 닫은 것 넷 —
//   · **U+2800 빈 점형**이 남았다. 브라유 글자지만 이 하나는 눈에 아무것도 없다
//     → 1번 결함의 나머지였다. 점이 있는 U+2801 이후는 **남긴다** (진짜 글자다)
//   · **U+2028 · U+2029** 가 남아 이름 안에서 줄이 깨졌다 → 다른 줄바꿈과 같이 공백으로
//   · **태그 글자 U+E0000–U+E007F** 가 남았다. 눈에 안 보이면서 글을 실어 보낼 수 있다
//   · **빈칸만 친 이름의 까닭이 틀렸다.** U+3164 는 바로잡혔는데 U+1680 · U+2000대 ·
//     U+3000 · 그냥 빈칸은 `raw.trim()` 이 먼저 비어서 「1~30자여야 해요」로 떨어졌다
//     → 비어 보이는 이름은 **전부** 같은 까닭으로 답한다
//
// 겹쳐 쓰는 표시(U+0300대 …)가 줄줄이 붙으면 이름이 **위아래 줄을 덮는다**. 한글·라틴·
// 베트남어 어디에도 넷이 이어 붙는 꼴은 없어서 그 선에서 거절한다.
//
// **이 파일의 정규식은 글자를 박아 넣지 않고 `\u` 로 적는다** — U+2028 을 정규식 안에
// 날글자로 두면 **JS 가 파일을 못 읽는다**(줄 끝으로 본다). 11/19 에 한 번 밟았다.
// 자(`check-nickname.cjs`)가 이 선을 지킨다.

// 지우는 것: **눈에 안 보이거나 남의 글 방향을 바꾸는 글자**.
//   제어 문자(줄바꿈 · 탭 제외) · U+00AD 줄임 하이픈 · U+061C 아랍 글자 표시
//   U+115F·U+1160·U+3164·U+FFA0 한글 채움 · U+180E · U+200B–U+200F 폭 0 · 방향 표시
//   U+202A–U+202E 방향 뒤집기 · U+2060–U+2064 · U+2066–U+2069 방향 격리 · U+FEFF
//   U+2800 빈 점형 · U+E0000–U+E007F 태그 글자 (2026-11-19)
// 표는 `utils/invisible.js` 한 자리에 있다 — 이 파일과 `sanitize.js` 가 **같은 것**을
// 쓴다. 11/18 에는 선이 둘이어서 닉네임만 닫히고 운동 · 루틴 · 계획 이름이 샜다
const { invisibleRe } = require('./invisible');
const NICK_INVISIBLE = invisibleRe();

// 줄을 깨는 글자 — 탭 · 줄바꿈과 **U+2028 줄 구분 · U+2029 문단 구분**
const NICK_BREAKS = new RegExp('[\\t\\r\\n\\u2028\\u2029]', 'g');

// 겹쳐 쓰는 표시가 넷 이상 이어 붙은 자리 (위아래 줄을 덮는 이름)
const NICK_STACKED = /\p{M}{4,}/u;

// 꺾쇠 바로 뒤에 글자가 붙은 꼴 — `sanitize.js` 의 `TAG_LIKE` 와 같은 선이다.
// 여기서 다시 세우지 않고 그 파일에서 가져온다 (선이 둘이 되면 갈린다)
const { tagLike, ANGLE_WHY } = require('./sanitize');

function tidy(raw) {
  return raw.replace(NICK_INVISIBLE, '').replace(NICK_BREAKS, ' ').trim();
}

/** 사람이 친 닉네임. 맞지 않으면 `null` — 부르는 쪽이 까닭을 말한다 */
function keepNickname(raw, max) {
  if (typeof raw !== 'string') return null;
  const v = tidy(raw);
  if (!v || v.length > max) return null;
  if (tagLike(v)) return null;          // **지운 뒤**에 본다 (위 머리글 2026-11-19)
  if (NICK_STACKED.test(v)) return null;
  return v;
}

/**
 * `keepNickname` 이 `null` 을 낸 **까닭**. U+3164 같은 이름은 눈에는 한 글자인데
 * 「1~30자여야 해요」라고 답하면 사람은 무엇이 틀렸는지 모른다 (2026-11-18 · 정석, bb0ed7a 검사).
 * 소셜 첫 화면은 건너뛰기가 없어서 **까닭이 틀리면 나갈 길을 못 찾는다.**
 */
function nicknameWhy(raw, max) {
  if (typeof raw === 'string' && raw.length > 0) {
    const v = tidy(raw);
    if (!v) return '보이지 않는 글자만으로는 이름을 쓸 수 없어요';
    if (v.length <= max && tagLike(v)) return ANGLE_WHY;
    if (v.length <= max && NICK_STACKED.test(v)) {
      return '겹쳐 쓰는 표시를 너무 많이 붙일 수 없어요';
    }
  }
  return `닉네임은 1~${max}자여야 해요`;
}

/**
 * 제공자(구글 · 네이버 …)가 준 이름. **거절할 수 없다** — 사람이 친 것이 아니라서
 * 되물을 길이 없다. 그래서 태그 꺾쇠만 떼고, 길면 **글자 단위로** 자르고,
 * 비면 `fallback` 을 쓴다. 겹쳐 쓰는 표시도 거절 대신 **걷어낸다**.
 */
function socialNickname(raw, max, fallback) {
  let v = tidy(String(raw ?? '')).replace(/[<>]/g, '').trim();
  if (NICK_STACKED.test(v)) v = v.replace(/\p{M}{4,}/gu, '').trim();
  let out = '';
  for (const ch of v) {            // 코드 포인트 단위 — 이모지를 반으로 안 자른다
    if (out.length + ch.length > max) break;
    out += ch;
  }
  return out.trim() || fallback;
}

module.exports = {
  keepNickname, nicknameWhy, socialNickname,
  NICK_INVISIBLE, NICK_BREAKS, NICK_STACKED, tidy,
};
