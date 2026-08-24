// 손으로 적은 공지 + 커밋에서 자동으로 뽑은 것을 한 줄로 세운다.
// 홈페이지의 '최근 바뀐 것' 과 공지함이 같은 목록을 본다 — 두 곳이 어긋날 수 없다.
import CHANGELOG from '../../data/changelog.json';
import NOTICES from '../../data/notices.json';

// 손으로 적는 notices.json 에서 date 나 id 를 빠뜨려도 화면이 죽지 않게 한다.
// 한 줄이 모자란 것과 목록 전체가 안 뜨는 것은 무게가 다르다.
export const fmtDate = d => (typeof d === 'string' && d.length >= 10 ? d.slice(5).replace('-', '. ') : '');

// 고정한 공지가 맨 위, 그 다음은 날짜 역순. 같은 날이면 공지를 먼저 —
// 커밋은 무슨 일이 있었는지를, 공지는 그게 무슨 뜻인지를 말한다
export const FEED = [
  ...(NOTICES.items || []).map((n, i) => ({
    key: n.id ?? `notice-${i}`, date: n.date || '', label: '공지', text: n.text, scope: null,
    detail: n.detail || null, notice: true, pinned: !!n.pinned,
  })),
  ...(CHANGELOG.items || []).map((c, i) => ({
    key: c.hash ?? `change-${i}`, date: c.date || '', label: c.label, text: c.text, scope: c.scope,
    detail: c.detail || null, notice: false, pinned: false,
  })),
].sort((a, b) => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (a.notice === b.notice) ? 0 : (a.notice ? -1 : 1);
});
