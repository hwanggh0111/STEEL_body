import { useState, useEffect } from 'react';
import { NOTICES, NOTICE_BADGE, getReadNotices } from '../data/notices';

// 공지사항 배너 (홈 상단 슬라이드)
export default function NoticeBanner({ onOpenPopup, onGoNotice }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const readList = getReadNotices();
  const unread = NOTICES.filter(n => !readList.includes(n.id));

  useEffect(() => {
    if (NOTICES.length <= 1) return;
    if (paused) return;
    const timer = setInterval(() => {
      setIdx(prev => (prev + 1) % NOTICES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [paused]);

  const notice = NOTICES[idx];
  if (!notice) return null;

  return (
    <div
      onClick={() => onOpenPopup(notice)}
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '10px 14px',
        marginBottom: 16,
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; setPaused(true); }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; setPaused(false); }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, overflow: 'hidden' }}>
        <span className={NOTICE_BADGE[notice.type] || 'badge badge-accent'} style={{ flexShrink: 0 }}>{notice.type}</span>
        <span style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {notice.title}
        </span>
        {unread.length > 0 && (
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0,
          }} />
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{idx + 1}/{NOTICES.length}</span>
        <span
          onClick={(e) => { e.stopPropagation(); onGoNotice(); }}
          style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
        >전체</span>
      </div>
    </div>
  );
}

// 공지사항 팝업
export function NoticePopup({ notice, onClose, onGoNotice, remaining }) {
  if (!notice) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          width: '100%',
          maxWidth: 440,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, color: 'var(--accent)' }}>
            {notice?.title}
          </div>
          <button onClick={onClose} className="delete-btn" style={{ fontSize: 18, padding: '8px 12px', minWidth: 40, minHeight: 40 }}>✕</button>
        </div>

        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span className={NOTICE_BADGE[notice?.type] || 'badge badge-accent'}>{notice?.type}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{notice?.date}</span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{notice?.content}</div>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onGoNotice}
            style={{
              background: 'none', border: 'none', color: 'var(--accent)',
              fontSize: 13, cursor: 'pointer', fontFamily: "'Barlow', sans-serif",
            }}
          >
            전체 공지 보기
          </button>
          {remaining > 0 && (
            <button
              onClick={onClose}
              style={{
                background: 'var(--accent)', border: 'none', color: '#000',
                fontSize: 12, cursor: 'pointer', fontWeight: 700,
                padding: '6px 14px', borderRadius: 'var(--radius)',
              }}
            >
              다음 공지 ({remaining}개 남음)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
