import { useState } from 'react';

// 손으로 적은 공지 + 커밋에서 자동으로 뽑은 것을 한 줄로 세운다.
// 홈페이지의 '최근 바뀐 것' 과 공지함이 같은 목록을 본다 — 두 곳이 어긋날 수 없다.
import CHANGELOG from '../../data/changelog.json';
import NOTICES from '../../data/notices.json';

// 손으로 적는 notices.json 에서 date 나 id 를 빠뜨려도 화면이 죽지 않게 한다.
// 한 줄이 모자란 것과 목록 전체가 안 뜨는 것은 무게가 다르다.
const fmtDate = d => (typeof d === 'string' && d.length >= 10 ? d.slice(5).replace('-', '. ') : '');

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

export function FeedList({ items }) {
  const [open, setOpen] = useState(null);

  if (!items.length) {
    return (
      <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '14px 0' }}>
        여기에 해당하는 것이 없습니다.
      </div>
    );
  }

  return items.map(c => {
    const on = open === c.key;
    return (
      <div key={c.key} style={{ borderBottom: '1px solid var(--border)' }}>
        <div
          onClick={() => c.detail && setOpen(on ? null : c.key)}
          style={{
            display: 'flex', gap: 12, alignItems: 'baseline',
            padding: '11px 0', cursor: c.detail ? 'pointer' : 'default',
          }}
        >
          <span style={{
            fontSize: 11, color: 'var(--text-muted)', width: 46, flexShrink: 0, letterSpacing: 0.3,
          }}>{fmtDate(c.date)}</span>
          {/* 공지는 색을 준다 — 커밋에서 온 줄과 성격이 다르다 */}
          <span style={{
            fontSize: 10.5, flexShrink: 0, borderRadius: 'var(--radius)', padding: '1px 6px',
            color: c.notice ? 'var(--accent)' : 'var(--text-muted)',
            border: `1px solid ${c.notice ? 'var(--accent)' : 'var(--border)'}`,
            background: c.notice ? 'var(--accent-dim)' : 'transparent',
          }}>{c.label}</span>
          <span style={{
            fontSize: 14, lineHeight: 1.6, fontWeight: 300, flex: 1,
            color: c.notice ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}>
            {c.scope && <span style={{ color: 'var(--text-muted)' }}>{c.scope} · </span>}
            {c.text}
          </span>
          {/* 세부 내용이 있는 줄만 열린다. 없으면 표시도 안 한다 */}
          {c.detail && (
            <span style={{
              color: 'var(--text-muted)', fontSize: 14, flexShrink: 0,
              transform: on ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s',
            }}>+</span>
          )}
        </div>
        {on && c.detail && (
          <div style={{
            fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.85,
            whiteSpace: 'pre-wrap', padding: '2px 0 16px', paddingLeft: 58, maxWidth: 460,
          }}>{c.detail}</div>
        )}
      </div>
    );
  });
}
