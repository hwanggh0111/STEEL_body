import { bodyPartOf } from './bodyPart';
import { heatLevel, MAP_PARTS } from './bodyHeat';
import { isSore } from './sorePart';

// 이 운동을 하면 어디가 달아오르나 — **하기 전에** 본다 (2026-09-30).
//
// 몸 지도는 **한 뒤에** 달아오른다. 그런데 사람이 고르는 것은 하기 전이다.
// 운동 이름을 받아 **어느 부위를 달굴지**와 **그 부위가 며칠째 식었는지**를 말한다.
//
// ── 새로 지어내는 값이 없다 ──
//
// 부위는 운동 사전에 이미 적혀 있고(9/29 에 151개에 적었다), 식은 날수는 몸 지도가
// 이미 센다(`bodyHeat`). 여기는 **둘을 잇는 일**만 한다.
//
// ── 시안에서 한 칸 걷어냈다 ──
//
// 처음 그린 시안에는 「등 **주로** · 팔 **거들어요**」가 있었다. 그런데 **사전은 부위를
// 하나만 안다** — 거들는 부위는 우리가 가진 값이 아니다. 그리는 순간 짐작을 사실처럼
// 적는 것이 되므로(이 앱이 거절해온 바로 그것) **아는 하나만 말한다.**
//
// 이 파일은 화면을 모른다 — `npm run sore` 가 값으로 본다.

/** 이만큼 지나면 「식었다」고 본다 (`heatLevel` 이 0 이 되는 자리와 같은 선). */
export const COLD_DAYS = 6;

/**
 * 운동 하나를 미리 본다.
 *
 * exercise 이름, heat 는 `buildHeat` 가 준 것, sore 는 아픔 목록.
 *
 * 돌려주는 것:
 *   name    다듬은 이름
 *   part    달아오를 부위 ('기타' 면 `known: false`)
 *   known   사전이 이 이름의 부위를 아는가
 *   days    그 부위를 마지막으로 한 뒤 며칠 (한 번도 안 했으면 `null`)
 *   level   몸 지도와 **같은 뜨거움 값** (0~3)
 *   cold    식었나
 *   sore    아프다고 적어둔 부위인가
 */
export function previewPart(exercise, heat, sore) {
  const name = String(exercise || '').trim();
  if (!name) return null;
  const part = bodyPartOf(name);
  const known = MAP_PARTS.includes(part);
  const slot = known ? heat?.byPart?.[part] : null;
  const days = slot ? slot.days : null;
  return {
    name,
    part,
    known,
    days,
    // 몸 지도가 쓰는 자를 그대로 쓴다 — 두 화면이 다른 색을 내면 안 된다
    level: known ? (slot ? slot.level : heatLevel(null)) : 0,
    cold: known && (days === null || days >= COLD_DAYS),
    sore: known && isSore(sore, part),
  };
}

/**
 * 미리보기 한 줄.
 *
 * **모르는 것은 모른다고 한다.** 사전에 부위를 안 적어둔 이름이면 부위를 짐작하지 않는다 —
 * 거기서 아무 부위나 골라 적으면 몸 지도가 그 뒤로 틀린 색을 낸다.
 */
export function previewLine(p) {
  if (!p) return null;
  if (!p.known) return '어디를 달굴지 아직 몰라요 — 사전에 부위를 안 적어둔 이름이에요.';
  if (p.days === null) return `${p.part} — 8주 안에 한 번도 안 했어요.`;
  if (p.days === 0) return `${p.part} — 오늘 이미 했어요.`;
  if (p.cold) return `${p.part} — ${p.days}일째 식어 있어요.`;
  return `${p.part} — ${p.days}일 전에 했어요.`;
}

/** 아픈 부위를 고른 사람에게 할 말. 아니면 `null`. **막지는 않는다.** */
export function soreWarn(p) {
  if (!p || !p.sore) return null;
  return `${p.part}는 아프다고 적어두셨어요. 하실 거면 하셔도 되지만, 적어둔 건 알려드려요.`;
}
