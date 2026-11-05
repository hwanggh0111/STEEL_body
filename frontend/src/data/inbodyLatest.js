// **가장 최근 인바디**를 고르는 손 (2026-11-05).
//
// ── 무엇이 틀렸었나 ──
//
// 서버는 인바디 날짜를 **하루 넉넉하게** 받는다 — 시차와 자정 무렵을 위해 일부러
// 그렇게 뒀다(`backend/src/utils/dayRange.js`). 그래서 **내일 날짜 줄이 실제로
// 들어온다.** 그리고 서버가 주는 목록은 **날짜 내림차순**이다(`db.ROW_CMP.inbody`).
//
// 그래서 화면 셋이 각자 `records[0]` 를 집고 있었는데, 그것이 **앞날 줄**이 되면 —
//
//   · 홈의 「최근 체중」이 **아직 안 잰 값**을 크게 적는다
//   · 그 옆의 날 수가 **「-1일 전」**이 된다 (`daysBetween(앞날, 오늘)` 이 음수다)
//   · 「지난 기록보다 +0.4kg」도 앞날 값 기준이 된다
//   · 인바디 화면의 **체성분 도넛 · 읽는 표**도 그 줄로 그려진다
//
// 몸 지도 · 체형 · 최고 기록 · 목표 · 주간 요약 · 달 요약은 전부 `date > today` 를
// 건너뛴다. **인바디 쪽에만 그 줄이 없었다.**
//
// ── 왜 목록은 안 걸러내나 ──
//
// 목록(인바디 화면의 줄들)에는 **그대로 보여야 한다** — 잘못 적은 앞날 줄을 **사람이
// 찾아 고칠 자리**가 거기뿐이다. 조용히 숨기면 고칠 길이 없어진다.
// 걸러내는 것은 **「가장 최근 것 하나」를 고르는 자리**뿐이다.
import { dateKey } from './dateKey';

/** 날짜가 'YYYY-MM-DD' 모양이고 오늘까지인가 */
const upto = (r, today) => {
  const d = r && typeof r.date === 'string' ? r.date : null;
  if (!d) return false;
  return !today || d <= today;
};

/**
 * 오늘까지의 기록만 **날짜 내림차순**으로.
 *
 * 서버가 이미 그 차례로 주지만(색인이 든다) **여기서 다시 세운다** — 기기에 담아둔
 * 사본이나 지하에서 꽂은 줄이 섞이면 차례가 흐트러질 수 있고, 이 손을 쓰는 쪽은
 * 「첫 줄이 가장 최근」임에 기댄다.
 */
export function inbodyUpto(records, today = dateKey()) {
  return (Array.isArray(records) ? records : [])
    .filter((r) => upto(r, today))
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * 가장 최근 인바디와 그 앞의 것.
 *
 * 돌려주는 것: `{ latest, prev, ahead }`
 *   ahead — **앞날에 적힌 줄 수.** 화면이 그 사실을 말할 수 있게 같이 준다
 *           (조용히 빼면 「내가 적은 것이 어디 갔나」가 된다)
 */
export function latestInbody(records, today = dateKey()) {
  const list = inbodyUpto(records, today);
  const all = Array.isArray(records) ? records : [];
  return {
    latest: list[0] || null,
    prev: list[1] || null,
    ahead: all.filter((r) => r && typeof r.date === 'string' && today && r.date > today).length,
  };
}
