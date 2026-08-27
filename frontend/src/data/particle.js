// 한국어 조사 고르기.
//
// 이름 뒤에 붙는 조사는 **앞 글자에 받침이 있느냐**로 갈린다.
// 「등이」 · 「하체가」, 「스쿼트를」 · 「풀업을」.
//
// 그동안 세 자리가 이걸 그냥 넘겼다.
//   - 주간 요약: `${부위}가 2주째 없어요` → **「등가 2주째 없어요」**
//   - 히스토리 · 루틴: `${운동명} 을(를)` → 괄호가 그대로 화면에 나온다
//
// 「을(를)」은 틀린 말은 아니지만, 앱이 사람에게 말을 거는 자리마다 괄호가 끼면
// 기계가 찍어낸 티가 난다. 이 앱은 화면 문구를 공들여 다듬어 왔는데 여기만 남았다.

// 마지막 글자에 받침이 있나.
//
// 한글 음절은 0xAC00 부터 28개씩 묶여 있고, 그 묶음의 첫 번째가 받침 없는 글자다.
// 숫자로 끝나면 읽는 소리로 본다 — 「1(일)」 「3(삼)」 「6(육)」 「7(칠)」 「8(팔)」 「0(영)」 은 받침이 있다.
// 그 밖(영문 등)은 받침이 없는 것으로 친다. 「row 를」 「bench 를」 처럼 읽히는 쪽이다.
export function hasFinalConsonant(word) {
  const s = String(word ?? '').trim();
  if (!s) return false;
  const last = s[s.length - 1];
  const code = last.charCodeAt(0);

  if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 !== 0;
  if (last >= '0' && last <= '9') return '0136780'.includes(last);
  return false;
}

/**
 * 앞말에 맞는 조사를 돌려준다.
 *
 *   particle('등', '이', '가')      → '이'
 *   particle('하체', '이', '가')    → '가'
 *   particle('스쿼트', '을', '를')  → '를'
 */
export function particle(word, withFinal, withoutFinal) {
  return hasFinalConsonant(word) ? withFinal : withoutFinal;
}

/** 자주 쓰는 세 쌍. 앞말과 조사를 붙여서 돌려준다. */
export const eul = (w) => `${w}${particle(w, '을', '를')}`;
export const i = (w) => `${w}${particle(w, '이', '가')}`;
export const eun = (w) => `${w}${particle(w, '은', '는')}`;
