// 펼친 자리에 무엇을 적을까 — **상태는 넷이다** (2026-11-09).
//
// `FeedList` 안에 두었다가 **따로 뺐다**: 그 파일 머리글이 「한 파일이 컴포넌트만
// 내보내야 Fast Refresh 가 붙는다」고 적어뒀고(그래서 데이터를 `feedData.js` 로
// 뺀 것이다), 거기에 함수를 하나 더 내보내면 **개발 중에 그 화면이 통째로 다시
// 그려진다.** 규칙을 적어둔 파일에서 그 규칙을 깨지 않는다.
/**
 * 펼친 자리에 무엇을 적을까 — **상태는 넷이다.**
 *
 *   본문이 있다        → 그 글
 *   묶음이 아직 안 왔다 → 「불러오는 중…」
 *   못 받았다           → 「못 불러왔어요 · 다시」
 *   ★ 묶음은 왔는데 그 줄이 없다 → **「본문이 아직 안 올라왔어요」**
 *
 * 넷째 줄이 11/09 에 라이브에서 빠져 있던 자리다. **공지함 찾기 쪽도 같은 손을
 * 쓴다**(`NoticeArchive` 가 이 `FeedList` 를 쓴다) — 두 벌로 적으면 한쪽만 고쳐진다.
 */
export default function FeedDetailBody({ itemKey, details, failed, retry }) {
  const muted = { color: 'var(--text-muted)' };
  const again = (
    <button
      type="button"
      onClick={retry}
      style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent)', cursor: 'pointer' }}
    >다시</button>
  );
  const body = details?.[itemKey];
  if (body) return body;
  if (failed) return <span style={muted}>지금은 본문을 못 불러왔어요 · {again}</span>;
  // ★ **묶음은 왔다.** 그러면 더 기다릴 것이 없다 — 없다고 말하고 길을 준다
  if (details) {
    return (
      <span style={muted}>
        이 줄은 본문이 아직 안 올라왔어요 — 바뀐 내용은 위 한 줄이 전부입니다. · {again}
      </span>
    );
  }
  return <span style={muted}>불러오는 중…</span>;
}

