// ── 닉네임을 다루는 손은 **한 자리**다 ── (2026-11-18 · 정석)
//
// e25fc05 가 닉네임을 「친 그대로」 남기게 바꾸면서 `routes/auth.js` 안에 `keepNickname`
// 을 두었다. 정석 2차에서 둘이 걸렸다 —
//
//   1. **보이지 않는 이름이 통과했다.** 지우는 줄이 `sanitize.js` 의 `INVISIBLE` 과 같은
//      선(제어 문자 · 방향 뒤집는 글자)이라, 폭이 0 인 글자와 한글 채움 글자는 남았다:
//
//        「​」 ×30   → 통과 (빈 이름이 30자)
//        「ㅤ」(U+3164)   → 통과 (눈에는 빈칸 한 칸)
//        「철‏수」     → 통과 (방향 표시 글자가 끼어 있다)
//
//      `trim()` 은 이것들을 공백으로 안 본다. 관리자 목록 · 제보 화면에서 **이름이 없는
//      사람**이 생긴다.
//
//   2. **소셜 첫 이름은 옛 손**(`sanitize().slice(0, 30)`)이었다. 같은 사람이 가입하면
//      「I'm 강철」, 구글로 들어오면 다른 이름이 되고, `slice` 가 이모지를 반으로 자른다.
//
// 그래서 지우는 글자를 넓히고, 세 길(가입 · 이름 바꾸기 · 소셜 첫 이름)이 이 파일 하나를 부른다.
// 길이 선(`NICKNAME_MAX`)은 `routes/auth.js` 가 든다 — 자(`check-bounds`)가 거기서 읽는다.

// 지우는 것: **눈에 안 보이거나 남의 글 방향을 바꾸는 글자**.
//   제어 문자(줄바꿈 · 탭 제외) · U+00AD 줄임 하이픈 · U+061C 아랍 글자 표시
//   U+115F·U+1160·U+3164·U+FFA0 한글 채움 · U+180E · U+200B–U+200F 폭 0 · 방향 표시
//   U+202A–U+202E 방향 뒤집기 · U+2060–U+2064 · U+2066–U+2069 방향 격리 · U+FEFF
const NICK_INVISIBLE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F­؜ᅟᅠ᠎​-‏‪-‮⁠-⁤⁦-⁩ㅤ﻿ﾠ]/g;

function tidy(raw) {
  return raw.replace(NICK_INVISIBLE, '').replace(/[\t\r\n]/g, ' ').trim();
}

/** 사람이 친 닉네임. 맞지 않으면 `null` — 부르는 쪽이 까닭을 말한다 */
function keepNickname(raw, max) {
  if (typeof raw !== 'string') return null;
  const v = tidy(raw);
  if (!v || v.length > max) return null;
  return v;
}

/**
 * 제공자(구글 · 네이버 …)가 준 이름. **거절할 수 없다** — 사람이 친 것이 아니라서
 * 되물을 길이 없다. 그래서 태그 꺾쇠만 떼고, 길면 **글자 단위로** 자르고,
 * 비면 `fallback` 을 쓴다.
 */
function socialNickname(raw, max, fallback) {
  const v = tidy(String(raw ?? '')).replace(/[<>]/g, '').trim();
  let out = '';
  for (const ch of v) {            // 코드 포인트 단위 — 이모지를 반으로 안 자른다
    if (out.length + ch.length > max) break;
    out += ch;
  }
  return out.trim() || fallback;
}

module.exports = { keepNickname, socialNickname, NICK_INVISIBLE };
