// 비밀번호 규칙 — **서버와 같은 자** (2026-10-31).
//
// 10/28 에 **서버** 셋의 `8~100` 을 `config/security.js` 로 묶었다. 그런데 **규칙**은
// 그대로 세 자리(가입 · 찾기 · 바꾸기)에 두 줄씩 남아 있었고, **화면 셋**은 그때
// 아예 안 봤다 —
//
//   · 가입(`RegisterPage`)  수를 그 파일에 또 적고 규칙도 제 함수로 들었다
//   · 바꾸기(`PasswordChangeModal`)  `8`·`100` 과 글자 조합을 또 적었다
//   · 찾기(`PasswordResetModal`)  같은 것을 **두 줄로 나눠** 적었다
//
// 다 같은 수 · 같은 규칙이라 **오늘은 틀린 데가 없었다.** 틀릴 자리가 여섯이라는
// 것이 문제다 — 10/28 에 서버 셋을 고치면서 화면 셋을 안 본 그 모양 그대로다.
//
// 서버는 `badPassword` 한 자리로 묶었다. 길이는 `data/limits.js` 가 같은 이름으로
// 들고(`npm run twins`), 글자 규칙은 `npm run bounds` 가 양쪽에서 떼어 맞춘다.
import { PW_MAX, PW_MIN } from './limits';

const PW_CHARS = [/[A-Za-z]/, /[0-9]/];

/** 규칙에 맞나 — 단추를 켤지 끌지 정할 때 쓴다 */
export function isValidPw(pw) {
  return passwordError(pw) === null;
}

/**
 * 안 맞으면 **왜인지**를 돌려준다. 맞으면 null.
 * `head` 로 말머리만 받는다 — 「비밀번호는」 · 「새 비밀번호는」
 */
export function passwordError(pw, head = '비밀번호는') {
  const s = String(pw ?? '');
  if (s.length < PW_MIN || s.length > PW_MAX) return `${head} ${PW_MIN}~${PW_MAX}자여야 해요`;
  if (!PW_CHARS.every((re) => re.test(s))) return `${head} 영문+숫자 조합이어야 해요`;
  return null;
}

/**
 * 비밀번호 세기. **규칙과는 다른 일이다** — 규칙은 통과/거절이고 이것은 더 단단히
 * 만들라는 권유다. 그래서 여기 같이 둔다(규칙이 바뀌면 이것도 같이 봐야 한다).
 */
export function pwStrength(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= PW_MIN) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 1) return { label: '약함', color: 'var(--danger)', pct: 33 };
  if (score <= 3) return { label: '보통', color: 'var(--warning)', pct: 66 };
  return { label: '강함', color: 'var(--success)', pct: 100 };
}
