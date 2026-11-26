// **늦게 온 답이 방금 올린 사진을 덮지 않게** (2026-11-26 · 정석, 근호 11/25 의심 목록)
//
// 비교 화면(`pages/ComparePage.jsx`)의 머리에는 새로고침 단추가 있다. 누르면
// `GET /photos` 가 날아가고, 돌아온 답으로 화면과 **기기(`localStorage`)** 를 갈아끼운다
// — 「한 장도 없다」는 답도 답이기 때문에 그 갈아끼우기는 맞는 일이다(다른 기기에서
// 지운 사진이 여기 남아 있으면 안 된다).
//
// ── ★ 그런데 그 답이 **내 손보다 늦게** 올 수 있다 ──
//
//   새로고침을 누른다 → `GET` 이 날아간다 → **그 사이에 사진을 올린다**(POST) →
//   `GET` 의 답이 돌아온다 → 그 답은 **내가 올린 것을 모르는 옛 판**이다
//   → 화면과 기기가 그 옛 판으로 덮인다
//
// 올린 사진은 화면에서 사라지고(서버에는 있다), **지운 사진은 되살아난다.**
// 몸 사진이라 특히 나쁘다 — 사람은 올린 것이 날아갔다고 본다.
//
// ── 가르는 법 ──
//
// **그 요청이 떠난 뒤에 손이 닿은 칸만** 지킨다. 나머지는 여태처럼 서버가 진실이다.
// 손이 닿은 칸의 진실은 아직 날아가고 있는 내 POST · DELETE 쪽이고, 그쪽이 끝나면
// 다음 받기에서 서버와 같아진다 (`store/session.js` 의 「나간 뒤에 온 답」과 같은 결).
//
// **판단만 여기 둔다** — 화면도 저장소도 안 만진다 (`npm run check` 가 돌려본다).

/** 이 화면이 다루는 칸 둘. 늘어나면 여기만 고친다 */
export const PHOTO_KEYS = ['before', 'after'];

/**
 * 서버 답을 지금 판에 얹는다.
 *
 * @param server    서버가 준 사진 (`{ before?, after? }`)
 * @param serverAt  서버가 준 올린 날 (`{ before?, after? }`)
 * @param local     지금 들고 있는 사진 (ref 의 값)
 * @param localAt   지금 들고 있는 올린 날
 * @param touchedAt 칸마다 **사람 손이 닿은 때** (`{ before?: ms, after?: ms }`)
 * @param sentAt    그 `GET` 이 **떠난 때** (ms)
 * @returns {{ photos, at, kept: string[] }} kept — 서버 값으로 안 덮은 칸
 */
export function mergeServerPhotos({ server, serverAt, local, localAt, touchedAt, sentAt }) {
  const 서버 = server && typeof server === 'object' ? server : {};
  const 서버날 = serverAt && typeof serverAt === 'object' ? serverAt : {};
  const 지금 = local && typeof local === 'object' ? local : {};
  const 지금날 = localAt && typeof localAt === 'object' ? localAt : {};
  const 닿은때 = touchedAt && typeof touchedAt === 'object' ? touchedAt : {};
  const 떠난때 = Number.isFinite(sentAt) ? sentAt : 0;

  const photos = { ...서버 };
  const at = { ...서버날 };
  const kept = [];
  for (const key of PHOTO_KEYS) {
    // **같은 밀리초는 지키는 쪽으로 틀린다** — 한 틱 안에 「떠남 → 손」이 일어나면
    // 그 손이 더 나중이다. 모를 때는 **사람 손을 믿는다**(덮어서 잃는 쪽이 더 나쁘다)
    if (!((닿은때[key] || 0) >= 떠난때 && 닿은때[key])) continue;
    kept.push(key);
    if (지금[key] !== undefined) {
      photos[key] = 지금[key];
      // 날짜도 지금 것을 둔다 — 서버가 아직 모르는 사진이라 서버 날짜는 옛것이다
      if (지금날[key] !== undefined) at[key] = 지금날[key];
      else delete at[key];
    } else {
      // 그 사이 지웠다 — 서버가 아직 들고 있어도 **되살리지 않는다**
      delete photos[key];
      delete at[key];
    }
  }
  return { photos, at, kept };
}
