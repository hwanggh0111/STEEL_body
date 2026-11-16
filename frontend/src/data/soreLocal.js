import { readLS } from './safeStorage';
import { keepLocal } from './keepLocal';
import { SORE_KEY } from './localKeys';
import { cleanSore } from './sorePart';

// 아픈 곳을 **기기에서 읽고 쓰는 손 한 벌** (2026-11-16).
//
// ── 손이 두 벌로 베껴져 있었다 ──
//
// 아픈 곳은 서버에 안 보낸다 — 그 사람이 제 몸에 대해 적은 것이라 그 기기에만 담긴다
// (`sorePart.js` 머리글). 그래서 읽는 쪽이 저마다 같은 세 줄을 적고 있었다:
//
//   `HomePage.jsx:333`   try { cleanSore(JSON.parse(readLS(SORE_KEY) || 'null')) } catch { [] }
//   `PartsPage.jsx:43`   같은 세 줄
//
// 세 번째 화면(적는 자리)이 그것을 쓰기 시작하는 날이 왔으니, **셋째 벌을 만들지
// 않고 한 손으로 묶는다.** 11/10 에 `TrainPage` 에서 같은 일을 했다 —
// 「**무게를 읽는 손이 또 한 벌이었다**」(`TrainPage.jsx:415`). 베낀 손은 어느 날
// 한 벌만 고쳐지고, 그러면 **같은 화면에서 둘이 다른 것을 보게 된다.**
//
// ── 못 읽어도 화면은 떠야 한다 ──
//
// 쿠키를 막아둔 브라우저에서는 `readLS` 가 빈손으로 온다. 그때는 **빈 목록**이다 —
// 아픈 곳을 모르는 것이지 화면이 깨질 일이 아니다(홈이 그 때문에 안 뜨면 안 된다).
// 깨진 글자가 담겨 있어도 같다: `cleanSore` 가 쓸 수 있는 칸만 걸러낸다.
//
// `sorePart.js` 에 넣지 않은 이유는 그 파일 머리글에 박혀 있다 —
// 「**이 파일은 화면도 저장소도 모른다**」. 그 선을 넘으면 `npm run sore` 가 값으로
// 보던 셈이 브라우저를 알아야 하는 셈이 된다.

/** 기기에 담긴 아픈 곳. 못 읽으면 빈 목록. */
export function readSore() {
  try {
    return cleanSore(JSON.parse(readLS(SORE_KEY) || 'null'));
  } catch {
    return [];
  }
}

/**
 * 아픈 곳을 담는다. **못 담으면 무엇이 안 남는지 한 번 말한다**(`keepLocal`) —
 * 조용히 잃으면 아픈 부위를 또 추천하게 된다.
 *
 * @returns {boolean} 담겼나
 */
export function writeSore(list) {
  return keepLocal(SORE_KEY, JSON.stringify(list), '아픈 곳');
}
