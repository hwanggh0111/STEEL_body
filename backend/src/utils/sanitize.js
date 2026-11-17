/**
 * 입력값 새니타이즈 유틸리티
 * HTML 태그, 이벤트 핸들러, javascript: URI, 위험 패턴 모두 제거
 */

// 위험 패턴 (이벤트 핸들러, javascript URI, 스크립트 관련)
const DANGEROUS_PATTERNS = [
  /on\w+\s*=/gi,           // onerror=, onclick=, onfocus= 등
  /javascript\s*:/gi,      // javascript: URI
  /vbscript\s*:/gi,        // vbscript: URI
  /expression\s*\(/gi,     // CSS expression()
  /eval\s*\(/gi,           // eval()
  /alert\s*\(/gi,          // alert()
  /document\s*\./gi,       // document.cookie 등
  /window\s*\./gi,         // window.location 등
  /\.innerHTML/gi,         // innerHTML
  /\.outerHTML/gi,         // outerHTML
  /\.fromCharCode/gi,      // String.fromCharCode
  /data\s*:\s*text\/html/gi, // data:text/html
  /formaction\s*=/gi,      // form action hijack
  /srcdoc\s*=/gi,          // iframe srcdoc
  /xlink:href/gi,          // SVG xlink
  /xmlns/gi,               // XML namespace injection
  /base\s+href/gi,         // base tag hijack
  /meta\s+http-equiv/gi,   // meta refresh/redirect
  /action\s*=\s*["']?javascript/gi, // form action javascript
];

function sanitize(str) {
  if (typeof str !== 'string') return '';
  // 0단계: URL 인코딩 디코딩 (이중 인코딩 우회 방지)
  let clean = str;
  try {
    let decoded = decodeURIComponent(clean);
    while (decoded !== clean) { clean = decoded; decoded = decodeURIComponent(clean); }
  } catch {}
  // ── 1단계: **태그 모양만** 지운다 ── (2026-11-03 에 고쳤다)
  //
  // 여태 `[<>"'&`]` 를 **글자째 지웠다.** 태그를 막으려던 것인데, 사람이 적은 글을
  // **조용히 다른 뜻으로** 바꿨다 — 자르는 것보다 나쁘다 —
  //
  //   메모 「무게 60>65」      → **「무게 6065」**   (숫자가 붙어 뜻이 사라진다)
  //   메모 「벤치 60 -> 65」   → 「벤치 60 - 65」    (올린 것이 뺄셈으로 보인다)
  //   메모 「허리 각도 < 45도」 → 「허리 각도 45도」  (**반대로 읽힌다**)
  //   메모 「벤치 & 스쿼트」    → 「벤치 스쿼트」
  //   이름 「don't」           → 「dont」
  //
  // **그 값이 HTML 로 들어가는 자리가 없다** — 11/03 에 다 찾아봤다:
  //   · 화면에 `dangerouslySetInnerHTML` 이 **한 자리도 없다**. React 는 글자를
  //     그릴 때 알아서 이스케이프한다
  //   · 메일은 **이미 이스케이프한다**(`utils/mailer.js` 의 `[<>&]` → `&lt;`)
  //   · CSV 는 따옴표를 `""` 로 감싸고 수식으로 읽히는 앞글자도 막는다(`utils/csv.js`)
  //   · 푸시 · DB 는 JSON 이다
  //
  // 그래서 **태그 꼴일 때만** 지운다 — `<` 뒤에 영문자 · `/` · `!` · `?` 가 오는 것.
  // 홀로 쓰인 꺾쇠(`60>65` · `< 45도` · `3 <- 4`)는 사람이 적은 글자라 남긴다.
  // 아래 2단계(`onerror=` · `javascript:` …)는 그대로 돈다 — 그쪽이 진짜 막는 자다
  //
  // 꼴 둘을 본다 — `<` 뒤에 **영문자**(`<b` · `<script`)이거나, `<` 뒤에
  // **`/` · `!` · `?`**(`</b` · `<!--` · `<?php`). 주석(`<!--`)도 지운다:
  // 화면이 `innerHTML` 을 안 쓰니 지금은 해가 없지만 **방어를 얇게 두지 않는다**.
  // `<-` 와 `< 45` 는 둘 중 어느 꼴도 아니라 그대로 남는다
  //
  // **더 지울 것이 없을 때까지 돌린다.** 한 번만 돌리면 겹쳐 쓴 꼴에서 조각이
  // 남는다 — `<<script>x</script>` 는 맨 앞 `<` 가 꼴에 안 맞아 그대로 있고,
  // 뒤의 태그만 지워져 **`<x`** 가 된다(또 태그 꼴이다). 위의 URL 디코딩이
  // 같은 까닭으로 고리를 돌고 있다. 횟수를 묶어 둔다 — 안 그러면 긴 글에서 오래 돈다
  // ── ★ **거절하지 않기로 한 것은 걷지도 않는다** ── (2026-11-17 · 정석)
  //
  // 이 식이 `<\s*…>?` 였다. `\s*` 와 `>?` 때문에 **닫는 꺾쇠가 없어도, 띄어 써도**
  // 매치된다 — `L < R` 에서 `< R` 이 통째로 지워져 **「L」** 이 됐다.
  //
  // 11/17 에 이름 칸은 `tagLike` 로 **거절**하게 됐다(주인 결정: 「거절하고 까닭을
  // 말한다」). 그리고 그 까닭은 **「「L < R」 처럼 띄어 주세요」**다. 띄어 쓴 것을
  // 거절하지 않기로 했으면 **여기서 조용히 잘라서도 안 된다** — 그러면 사람은
  // 안내대로 고쳐 넣고 **또 잘린 값**을 받는다. 11/03 에 막은 그 자리로 돌아간다.
  //
  // 그래서 둘을 맞춘다 — `<` **바로 뒤**에 글자가 와야 하고(브라우저도 그래야 태그로
  // 읽는다) **닫는 `>` 를 기다린다.**
  //
  //     <script>a</script>  → 「a」      (태그 둘이 걷힌다)
  //     L<R                 → 안 걷는다  (이름 칸은 `tagLike` 가 **거절**한다)
  //     L < R               → 안 걷는다  ← **안내가 가리키는 길**
  //     무게 60>65 · < 45도  → 안 걷는다  (11/03 의 그 선)
  //
  // 닫는 `>` 가 없는 `<script` 가 긴 글에 남을 수 있다. 위 머리글의 근거가 그대로
  // 선다 — 이 값이 HTML 로 들어가는 자리가 **한 곳도 없고**(React 가 이스케이프 ·
  // 메일은 이미 치환 · CSV 는 감싼다 · 푸시와 DB 는 JSON), 공격 모양은 `aiGuard` 가
  // 라우트 앞에서 막는다. **이름 칸은 `tagLike` 가 거절한다.**
  // ── ★ **닫는 `>` 를 기다린다 — 긴 글의 꺾쇠를 남긴다** ── (2026-11-17, 주인 결정)
  //
  // 위 주석이 「닫는 `>` 를 기다린다」고 적어두고도 식은 `>?` 였다 — 그래서 긴 글
  // (메모 · 제보)에서는 아직 **`L<R 불균형이 심함` → 「L」**로 걷히고 있었다.
  // 이름 칸은 `tagLike` 가 거절해 막혔지만 **긴 글은 거절하지 않는 자리**라,
  // 거절도 안 하면서 조용히 자르는 **가장 나쁜 꼴**이 거기 남아 있었다.
  // 주인이 「긴 글은 걷지 말고 남긴다」로 정했다(11/17).
  //
  //     메모 「L<R 불균형이 심함」   → **그대로**
  //     메모 「<b>어깨</b> 아픔」    → 「어깨 아픔」   (닫힌 태그는 걷는다)
  //     메모 「<script>x</script>」  → 「x」
  //
  // **겹쳐 쓴 꼴은 반 토막이 남는다** — `<<script>alert(1)</script>` 는 닫힌 태그
  // 둘이 걷히고 `<alert(1)` 이 되며, 2단계가 `alert(` 를 지워 **`<1)`** 이 남는다.
  // 여태는 통째로 지워져 **빈 글 → 거절**이었다. 남는 글자가 있으면 담기는 것이
  // 맞다 — 거절의 뜻은 「태그만 적어서 **남는 글자가 없다**」이고(`<b></b>` ·
  // `<div><span></span></div>` 는 그대로 거절된다), 그 값이 HTML 로 들어가는 자리는
  // 한 곳도 없다(위 머리글의 전수 확인). 공격 모양은 2단계와 `aiGuard` 가 막는다.
  const TAG = /<(?:[/!?][^>]*|[a-zA-Z][^>]*)>/g;
  for (let i = 0; i < 8; i += 1) {
    const next = clean.replace(TAG, '');
    if (next === clean) break;
    clean = next;
  }
  // 2단계: 위험 패턴 제거
  for (const pattern of DANGEROUS_PATTERNS) {
    clean = clean.replace(pattern, '');
  }
  // 3단계: 연속 공백 정리
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

// 여러 줄을 받는 칸용.
//
// 위의 sanitize 는 3단계에서 연속 공백을 하나로 눌러버린다. 한 줄짜리 이름에는
// 맞지만 여러 줄에는 안 맞는다 — 버그 재현 절차를 줄로 나눠 적으면 한 덩어리가 되고,
// 관리자 답변도 문단이 통째로 뭉개진다. 화면은 줄바꿈을 살려 그리고 있는데
// 저장하는 쪽에서 지우고 있었다.
//
// 줄 단위로 sanitize 를 돌리고 줄바꿈만 되살린다. 빈 줄이 세 줄 넘게 이어지면
// 두 줄로 줄인다 — 여백으로 목록을 밀어내지 못하게.
function sanitizeMultiline(str) {
  if (typeof str !== 'string') return '';
  return str
    .split(/\r?\n/)
    .map(line => sanitize(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 사람이 붙이는 이름 한 줄 — 운동명 · 루틴명 · 닉네임.
//
// 이 칸들은 저마다 `!name` 과 `name.length > N` 으로만 막고 있었다. 셋 다 샌다:
//   - `'   '` 는 `!name` 을 통과하고, 새니타이즈가 빈 문자열로 만들어 **이름 없는 기록**이 남는다
//   - 배열은 `.length` 가 있어서 길이 검사도 통과한다 (`['a','b'].length === 2`)
//   - `.trim()` 을 먼저 부르는 자리(닉네임)는 배열을 받으면 그대로 **500** 이 났다
//   - `'<<<>>>'` 처럼 새니타이즈하면 아무것도 안 남는 글자도 빈 이름이 된다
//
// 바로 옆의 무게 칸은 같은 이유로 이미 막아뒀는데(`normalizeWeight`) 이름 칸만 무방비였다.
// 새니타이즈까지 끝낸 뒤에 비었는지 보는 것이 요점이다 — 검사와 저장이 같은 값을 봐야 한다.
//
// 쓸 수 있으면 다듬은 이름을, 아니면 null 을 준다. 부르는 쪽이 왜 안 되는지를 말한다.
function cleanName(raw, maxLen) {
  if (typeof raw !== 'string') return null;
  if (raw.length > maxLen) return null;
  const clean = sanitize(raw);
  return clean || null;
}

// 남이 읽는 글 — 커뮤니티 제목 · 본문 · 댓글 (2026-09-14).
//
// 위의 sanitize 는 `' " & < >` 를 지운다. 이름 한 줄에는 맞지만 글에는 안 맞는다 —
// 「I'm」은 「Im」, 「벤치 & 스쿼트」는 「벤치 스쿼트」, 「<3」은 「3」이 됐다.
// 쓴 사람은 지워진 줄도 모른다.
//
// 이 글은 **화면이 글자로만 그린다**(React 가 이스케이프한다, dangerouslySetInnerHTML 없음).
// 알림도 글자다. 그래서 글자를 지울 이유가 없다. 진짜 공격 모양(`<script` · `onerror=`)은
// 라우트에 오기 전에 aiGuard 가 막는다.
//
// 지우는 것은 둘뿐이다 —
//   제어 문자 (줄바꿈 · 탭은 남긴다)
//   방향을 뒤집는 글자 (U+202A–202E · U+2066–2069) — 남의 닉네임 옆에서 글을 거꾸로 보이게 해
//   다른 사람이 쓴 것처럼 꾸밀 수 있다
const INVISIBLE = /[ --‪-‮⁦-⁩]/g;

function plainText(str) {
  if (typeof str !== 'string') return '';
  return str.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
}

// 여러 줄. 줄마다 공백을 정리하고 줄바꿈은 살린다 — sanitizeMultiline 과 같은 모양이다
function plainMultiline(str) {
  if (typeof str !== 'string') return '';
  return str
    .split(/\r?\n/)
    .map(line => plainText(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeObj(obj) {
  if (typeof obj === 'string') return sanitize(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObj);
  if (typeof obj === 'object' && obj !== null) {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      // 위험한 키 이름 제거
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      clean[sanitize(k)] = sanitizeObj(v);
    }
    return clean;
  }
  return obj;
}

// ── ★ **이름 칸은 조용히 잘리지 않는다 — 거절하고 까닭을 말한다** ── (2026-11-17)
//
// 위 1단계는 태그 꼴을 지울 때 **닫는 `>` 를 안 기다린다**(`>?`). 겹쳐 쓴 꼴에서
// 조각이 남는 것을 막으려고 그렇게 뒀는데, 그 바람에 **`<` 뒤에 영문자가 오면 그
// 줄의 나머지가 통째로 사라진다** —
//
//   이름 「L<R 불균형」  → **「L」**        좌우 불균형을 적는 사람이 쓰는 꼴이다
//   이름 「덤벨 L<R」    → **「덤벨 L」**
//   이름 「a<b 스쿼트」  → **「a」**
//
// 거절도 알림도 없다. 운동 이름이면 **사전에 없는 이름**이 되어 그 운동이 몸 지도와
// 최고 기록에서 영영 빠진다(`RoutinePage` 머리글이 적어둔 그 위험이다).
// 11/03 에 「사람이 적은 글을 조용히 다른 뜻으로 바꾸지 않는다」로 세운 선이
// **영문자 하나 때문에 새던 자리**다.
//
// 방어를 얇게 하지 않고(닫히지 않은 꼴도 그대로 지운다) **사람 글도 안 바꾸는** 길은
// 하나다 — **거절하고 까닭을 말한다**(2026-11-17, 주인 결정). 사람은 띄어 쓰면 된다.
//
// **이름 칸에만** 쓴다. 메모 · 제보 · 관리자 답변 같은 **긴 글**은 여태처럼 걷는다 —
// 거기는 붙여 쓴 태그가 섞여 올 수 있고, 11/03 의 선이 이미 서 있다.
// ── ★ **띄어 쓴 꺾쇠는 태그가 아니다** ── (2026-11-17 · 정석)
//
// 이 식에 `\s*` 가 있어서 **`L < R` 도 걸렸다.** 그런데 거절 문구(`ANGLE_WHY`)는
// **「「L < R」 처럼 띄어 주세요」**라고 안내한다 — **안내대로 해도 또 막힌다.**
// 사람이 빠져나갈 길이 없는 꼴이고, 주인이 고른 「거절하고 까닭을 말한다」는
// **그 까닭이 가리키는 길이 통할 때만** 지켜진다.
//
// 띄어 쓴 것을 걸 이유도 없다 — HTML 파서는 `<` **바로 뒤**에 ASCII 글자가 와야
// tag open 으로 읽는다. `< a` 는 그냥 글자다(명세대로다). 그리고 이 값이 화면에
// 닿을 때 React 가 글자로 내보내므로 뿌려질 일도 없다.
//
// 그래서 `\s*` 를 뺀다 —
//
//     L<R        → 걸린다 (거절하고 까닭을 말한다)
//     L < R      → 안 걸린다  ← **안내가 가리키는 길**
//     </div> · <!-- · <?php → 걸린다
//
// 걷는 쪽(`cleanName`)도 같은 식을 쓴다. 띄어 쓴 꺾쇠는 **걷지도 않는다** —
// 거절하지 않기로 한 것을 조용히 잘라내면 11/03 의 그 자리로 돌아간다.
const TAG_LIKE = /<[/!?a-zA-Z]/;

/** 태그처럼 읽히는 꼴이 있나 — `<` 뒤에 영문자 · `/` · `!` · `?` */
function tagLike(raw) {
  return typeof raw === 'string' && TAG_LIKE.test(raw);
}

/** 그때 사람에게 적어주는 말. **한 자리에만** 둔다 (화면도 서버 말을 그대로 보여준다) */
const ANGLE_WHY = '꺾쇠 뒤에 글자를 붙여 쓸 수 없어요 — 「L < R」 처럼 띄어 주세요';

module.exports = {
  sanitize, sanitizeMultiline, sanitizeObj, cleanName, plainText, plainMultiline,
  tagLike, ANGLE_WHY,
};
