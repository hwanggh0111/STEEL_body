// 제보함 목록이 쓰는 계산.
//
// 화면 안에 두면 눈으로만 확인된다. **여기는 눈으로 봐서 틀린 것을 못 잡는 자리다** —
// 답이 달린 제보가 목록에서 다른 것들과 똑같이 생겼으면, 아무도 안 터지고 사람만
// 여섯 장을 다 눌러본다.

/** 답이 달렸나. **상태와 다른 것이다** — 「확인중」인데 답이 달린 제보가 실제로 있다 */
export const hasReply = (item) => !!(item && item.reply);

/**
 * 아직 안 본 답인가.
 *
 * `seenAt` 은 **이 기기에서 마지막으로 본 답의 시각**이다(`SEEN_REPLY_KEY`).
 * 고객센터가 제보함을 펼치는 순간 그 값을 지금으로 올리기 때문에, 목록은 **처음
 * 그릴 때 읽어둔 값**을 끝까지 쓴다 — 안 그러면 펼치자마자 전부 읽은 것이 된다.
 */
export const isNewReply = (item, seenAt) =>
  hasReply(item) && !!item.reply_at && String(item.reply_at) > String(seenAt || '');

// 거르는 말은 **사람의 말**로 둔다.
//
// 예전에는 서버의 상태 넷(접수 · 확인중 · 처리완료 · 보류)을 그대로 탭으로 내놨다.
// 그건 **관리자가 쓰는 말**이다. 제보한 사람이 여기 다시 오는 이유는 하나다 —
// **답이 왔나 보려고.** 「접수」와 「확인중」의 차이는 그 사람에게 아무 뜻이 없다.
export const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'answered', label: '답변 옴' },
  { key: 'waiting', label: '기다리는 중' },
];

/** 그 제보가 이 거름망에 걸리나 */
export function matchFilter(item, key) {
  if (key === 'answered') return hasReply(item);
  if (key === 'waiting') return !hasReply(item);
  return true;
}

/**
 * 보여줄 순서.
 *
 * **안 본 답이 맨 위다.** 그다음은 최신 순. 여기 다시 온 사람이 제일 먼저 볼 것을
 * 제일 위에 둔다 — 예전에는 무조건 id 역순이라, 답이 달린 옛 제보가 아래에 묻혔다.
 */
export function sortReports(items, seenAt) {
  return [...(items || [])].sort((a, b) => {
    const an = isNewReply(a, seenAt) ? 1 : 0;
    const bn = isNewReply(b, seenAt) ? 1 : 0;
    if (an !== bn) return bn - an;
    return b.id - a.id;
  });
}

/** 거르고 세운 목록 */
export function viewReports(items, filterKey, seenAt) {
  const list = (items || []).filter((i) => matchFilter(i, filterKey));
  return sortReports(list, seenAt);
}

/** 거름망마다 몇 건인가 (탭에 적는다) */
export function filterCounts(items) {
  const list = items || [];
  return FILTERS.reduce((acc, f) => {
    acc[f.key] = list.filter((i) => matchFilter(i, f.key)).length;
    return acc;
  }, {});
}

/** 아직 안 본 답이 몇 건인가. 0 이면 화면은 그 줄을 안 그린다 */
export const newReplyCount = (items, seenAt) =>
  (items || []).filter((i) => isNewReply(i, seenAt)).length;
