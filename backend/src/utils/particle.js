// 한국어 조사 고르기 (서버가 **사람에게 보내는 말**에 쓴다).
//
// 화면 쪽에 같은 것이 있다 — `frontend/src/data/particle.js`. 두 패키지라 가져다
// 쓸 수가 없어서 규칙만 옮겨 적었다. **두 벌인 것이 맞는 자리는 아니다** — 그래서
// `scripts/check-reminder.cjs` 가 두 표의 답이 같은지 센다. 어긋나면 거기서 걸린다.
//
// ── 왜 서버에도 있어야 하나 ── (2026-10-21)
//
// 운동 알림 제목이 이랬다 —
//
//     "등이(가) 9일째 식었어요"      ← 괄호가 **폰 알림에 그대로 뜬다**
//     "어깨이(가) …" "하체이(가) …"  ← 받침 없는 부위는 「가」가 맞다
//
// 여섯 부위 중 셋(어깨 · 코어 · 하체)이 받침이 없다. 화면 문구는 2026-10-20 에
// 조사를 다 맞췄는데, **폰에 뜨는 말만 괄호로 남아 있었다.**

/**
 * 마지막 글자에 받침이 있나.
 *
 * 한글 음절은 0xAC00 부터 28개씩 묶여 있고, 그 묶음의 첫 번째가 받침 없는 글자다.
 * 숫자로 끝나면 읽는 소리로 본다 — 1(일) 3(삼) 6(육) 7(칠) 8(팔) 0(영) 은 받침이 있다.
 * 그 밖(영문 등)은 받침이 없는 것으로 친다.
 */
function hasFinalConsonant(word) {
  const s = String(word ?? '').trim();
  if (!s) return false;
  const last = s[s.length - 1];
  const code = last.charCodeAt(0);

  if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 !== 0;
  if (last >= '0' && last <= '9') return '0136780'.includes(last);
  return false;
}

/** particle('등', '이', '가') → '이' · particle('하체', '이', '가') → '가' */
function particle(word, withFinal, withoutFinal) {
  return hasFinalConsonant(word) ? withFinal : withoutFinal;
}

/** 앞말과 조사를 붙여서 돌려준다 */
const i = (w) => `${w}${particle(w, '이', '가')}`;
const eun = (w) => `${w}${particle(w, '은', '는')}`;
const eul = (w) => `${w}${particle(w, '을', '를')}`;

module.exports = { hasFinalConsonant, particle, i, eun, eul };
