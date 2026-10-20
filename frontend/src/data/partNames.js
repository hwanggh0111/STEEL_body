// 부위 이름 일곱 (2026-10-16).
//
// **사전(`exerciseDict.js`)에서 떼어냈다.** 홈페이지(`/site`)는 이 일곱 글자만 쓰는데
// (「부위로도 찾을 수 있어요 — 가슴 · 등 …」), 그걸 쓰려고 **운동 사전 조각
// 35KB(gzip 10KB)를 첫 화면에서 같이 받고 있었다.** 거기는 로그인도 앱 설치도 없이
// 처음 오는 사람이 보는 자리다.
//
// 사전은 **칠 때 받는다** — 두 글자를 치거나 부위 이름을 치면 그때 온다.
//
// **두 벌이 되지 않게** 사전이 이것을 그대로 다시 내보낸다(`exerciseDict.js` 의
// `export { PARTS }`). 고치는 자리는 여기 하나다.
export const PARTS = ['가슴', '등', '어깨', '하체', '팔', '코어', '전신 · 유산소'];

/** 친 글이 부위 이름인가. 사전 없이도 답할 수 있는 물음이라 여기 둔다. */
export function isPartName(query) {
  const t = String(query || '').trim();
  if (!t) return false;
  return PARTS.some((p) => p === t || p.split(' · ').includes(t));
}
