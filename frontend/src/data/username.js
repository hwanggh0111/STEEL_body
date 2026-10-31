// 아이디 규칙 — **서버와 같은 자** (2026-10-31).
//
// 서버는 같은 정규식을 세 자리(중복 확인 · 가입 · 바꾸기)에 들고 있었고 거절하는
// 말이 **셋 다 달랐다**. 화면 둘(`RegisterPage` · `SettingsPage`)도 또 적고 있었다 —
// 다섯째 벌이었다. 서버는 `routes/auth.js` 의 `badUsername` 한 자리로 묶었다.
//
// 화면과 서버는 따로 지어지니 한쪽을 불러 쓸 수 없다. 대신 **길이는 같은 이름**으로
// 들어(`npm run twins` 가 값을 견준다) 글자 규칙은 **`npm run bounds` 가 양쪽에서
// 떼어 맞춰본다** — 한쪽을 고치는 날 FAIL 한다.
//
// **말은 치는 동안 돕는 쪽으로 쪼갠다.** 서버는 한 문장으로 거절하면 되지만
// 화면은 지금 무엇이 모자란지 짚어줘야 한다 — 「4자 이상」 · 「20자 이하」 ·
// 「쓸 수 없는 글자」. 서버 말을 그대로 쓰면 네 글자 친 사람에게 특수문자 이야기를 한다.
import { USERNAME_MAX, USERNAME_MIN } from './limits';

const USERNAME_CHARS = /^[a-zA-Z0-9!@#$%^&*._-]+$/;

/** 아이디가 규칙에 안 맞으면 **무엇이 모자란지**를 돌려준다. 맞으면 null */
export function usernameHint(v) {
  const s = String(v ?? '');
  if (!s) return null;
  if (s.length < USERNAME_MIN) return `${USERNAME_MIN}자 이상 입력해주세요`;
  if (s.length > USERNAME_MAX) return `${USERNAME_MAX}자 이하로 입력해주세요`;
  if (!USERNAME_CHARS.test(s)) return '영문, 숫자, 특수문자(!@#$%^&*._-)만 가능';
  return null;
}
