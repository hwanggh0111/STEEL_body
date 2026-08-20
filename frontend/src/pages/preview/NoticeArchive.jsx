import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEED, FeedList } from './feed';

// ─────────────────────────────────────────────────────────────
// 공지함 — 지금까지 올라온 것을 전부 본다.
//
// 홈페이지의 '최근 바뀐 것' 은 여섯 줄만 보여준다. 그 아래 '공지함' 으로 들어오면
// 전부 있고, 종류로 걸러 볼 수 있다. 두 화면이 같은 목록(feed.jsx)을 본다.
// ─────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all',    label: '전체' },
  { key: 'notice', label: '공지' },
  { key: '새 기능', label: '새 기능' },
  { key: '고침',   label: '고침' },
  { key: '빨라짐', label: '빨라짐' },
];

export default function NoticeArchive() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');

  const counts = useMemo(() => {
    const c = { all: FEED.length, notice: FEED.filter(f => f.notice).length };
    for (const t of ['새 기능', '고침', '빨라짐']) c[t] = FEED.filter(f => !f.notice && f.label === t).length;
    return c;
  }, []);

  const shown = tab === 'all' ? FEED
    : tab === 'notice' ? FEED.filter(f => f.notice)
    : FEED.filter(f => !f.notice && f.label === tab);

  // 날짜별로 묶는다. 한 줄씩 흘려보내면 언제 일인지가 안 잡힌다
  const byDate = useMemo(() => {
    const map = new Map();
    for (const item of shown) {
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date).push(item);
    }
    return [...map.entries()];
  }, [shown]);

  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{
        fontSize: 11.5, color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 30,
      }}>시안 · 공지함 — 아직 앱에 붙어 있지 않습니다</div>

      <button
        onClick={() => navigate('/preview/homepage-d')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: 'var(--text-muted)', fontSize: 12.5, marginBottom: 18,
        }}
      >← 돌아가기</button>

      <div style={{ marginBottom: 26 }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 3,
          color: 'var(--accent)', margin: '0 0 8px',
        }}>공지함</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
          지금까지 바뀐 것이 전부 있습니다. 줄을 누르면 무엇을 왜 그랬는지 나옵니다.
        </p>
      </div>

      {/* 종류 거르기 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                borderRadius: 'var(--radius)',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                background: on ? 'var(--accent)' : 'transparent',
                color: on ? '#000' : 'var(--text-secondary)',
                fontWeight: on ? 700 : 400, transition: 'all 0.15s',
              }}
            >{t.label} {counts[t.key] || 0}</button>
          );
        })}
      </div>

      {byDate.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>
          여기에 해당하는 것이 없습니다.
        </div>
      ) : byDate.map(([date, items]) => (
        <div key={date} style={{ marginBottom: 26 }}>
          <div style={{
            fontSize: 11, letterSpacing: 2, color: 'var(--text-muted)',
            marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border)',
          }}>{date.replace(/-/g, '. ')}</div>
          <FeedList items={items} />
        </div>
      ))}

      <div style={{
        marginTop: 10, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.8,
      }}>
        화면이 바뀌지 않는 변경(문서 정리, 내부 구조 손질)은 올리지 않습니다.
      </div>
    </div>
  );
}
