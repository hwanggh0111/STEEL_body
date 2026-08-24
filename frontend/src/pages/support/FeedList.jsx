import { useState } from 'react';
import { fmtDate } from './feedData';

// 한 줄씩 세운 목록. 세부 내용이 있는 줄만 눌러서 펼친다.
//
// 예전에는 목록 데이터(FEED)와 이 컴포넌트가 한 파일에 있었다. 그러면 개발 중에
// Fast Refresh 가 매번 포기하고 화면을 통째로 새로 그린다 — 한 파일이 컴포넌트만
// 내보내야 붙는 기능이다. 데이터는 feedData.js 로 뺐다.

export default function FeedList({ items }) {
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
