import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEED } from './feedData';
import FeedList from './FeedList';

// ─────────────────────────────────────────────────────────────
// 공지함 — 지금까지 올라온 것을 전부 본다.
//
// 고객센터의 '최근 바뀐 것' 은 여섯 줄만 보여준다. 그 아래 '공지함' 으로 들어오면
// 전부 있고, 종류로 걸러 볼 수 있다. 두 화면이 같은 목록(feedData.js)을 본다.
//
// 다시 짜면서 셋을 고쳤다.
//
// **1. 찾을 길이 없었다.** 「그때 바뀐 그거」를 찾으려면 날짜를 눈으로 훑는 수밖에
// 없었다. 목록은 커밋이 쌓이는 만큼 계속 늘어난다 — 지금 40건이고 줄어들 일이 없다.
// 검색을 넣었다. 제목 · 세부 내용 · 무엇을 고쳤는지(scope) 를 같이 본다.
//
// **2. 전부를 한 번에 쏟아냈다.** 처음에는 최근 것만 펴고 「더 보기」로 넓힌다.
// 걸러 보거나 찾는 중일 때는 다 편다 — 찾은 것을 또 「더 보기」로 감추면 안 된다.
//
// **3. 0건인 갈래도 눌렸다.** 눌러봐야 「해당하는 것이 없습니다」가 나온다.
// 없는 갈래는 아예 안 그린다.
// ─────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all',    label: '전체' },
  { key: 'notice', label: '공지' },
  { key: '새 기능', label: '새 기능' },
  { key: '고침',   label: '고침' },
  { key: '빨라짐', label: '빨라짐' },
];

// 처음에 펴는 날짜 묶음 수. 검색하거나 갈래를 고르면 이 제한을 안 건다
const DATES_SHOWN = 6;

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');

export default function NoticeArchive() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);

  const counts = useMemo(() => {
    const c = { all: FEED.length, notice: FEED.filter(f => f.notice).length };
    for (const t of ['새 기능', '고침', '빨라짐']) c[t] = FEED.filter(f => !f.notice && f.label === t).length;
    return c;
  }, []);

  // 없는 갈래는 그리지 않는다
  const tabs = TABS.filter(t => (counts[t.key] || 0) > 0);

  const query = norm(q);
  const searching = query.length >= 2;

  const shown = useMemo(() => {
    const byTab = tab === 'all' ? FEED
      : tab === 'notice' ? FEED.filter(f => f.notice)
        : FEED.filter(f => !f.notice && f.label === tab);
    if (!searching) return byTab;
    // 제목뿐 아니라 세부 내용과 scope 까지 본다 — 무엇이 바뀌었는지는
    // 대개 제목이 아니라 펼쳐야 나오는 쪽에 적혀 있다
    return byTab.filter(f =>
      norm(f.text).includes(query)
      || norm(f.detail).includes(query)
      || norm(f.scope).includes(query)
      || norm(f.label).includes(query));
  }, [tab, query, searching]);

  // 날짜별로 묶는다. 한 줄씩 흘려보내면 언제 일인지가 안 잡힌다
  const byDate = useMemo(() => {
    const map = new Map();
    for (const item of shown) {
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date).push(item);
    }
    return [...map.entries()];
  }, [shown]);

  // 찾는 중이거나 갈래를 골랐으면 다 편다
  const limited = !searching && tab === 'all' && !showAll;
  const groups = limited ? byDate.slice(0, DATES_SHOWN) : byDate;
  const hiddenDates = byDate.length - groups.length;

  return (
    <div style={{ paddingBottom: 20 }}>
      <button
        onClick={() => navigate('/support')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: 'var(--text-muted)', fontSize: 12.5, marginBottom: 18,
        }}
      >← 고객센터로</button>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 3,
          color: 'var(--accent)', margin: '0 0 8px',
        }}>공지함</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
          지금까지 바뀐 것이 전부 있습니다. 줄을 누르면 무엇을 왜 그랬는지 나옵니다.
        </p>
      </div>

      {/* 찾기 */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input
          className="input"
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="찾아보기 (예: 알림, 타이머, 루틴)"
          style={{ paddingLeft: 36, paddingRight: q ? 34 : undefined, fontSize: 13.5 }}
        />
        <span style={{
          position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
          fontSize: 14, opacity: 0.7, pointerEvents: 'none',
        }} aria-hidden="true">🔍</span>
        {q && (
          <button
            onClick={() => setQ('')}
            aria-label="찾기 지우기"
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 13, padding: 6, lineHeight: 1,
            }}
          >✕</button>
        )}
      </div>

      {/* 종류 거르기 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {tabs.map(t => {
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
            >{t.label} {counts[t.key]}</button>
          );
        })}
      </div>

      {/* 무엇을 보고 있는지 적는다 */}
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 18 }}>
        {searching
          ? `「${q.trim()}」로 찾은 ${shown.length}건`
          : q.trim()
            ? '두 글자부터 찾습니다'
            : `${shown.length}건`}
      </div>

      {byDate.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0', lineHeight: 1.8 }}>
          찾으시는 것이 없습니다.
          <br />
          <button
            onClick={() => { setQ(''); setTab('all'); }}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              font: 'inherit', color: 'var(--accent)', borderBottom: '1px solid var(--accent)',
              marginTop: 8,
            }}
          >전체 보기</button>
        </div>
      ) : groups.map(([date, items]) => (
        <div key={date} style={{ marginBottom: 26 }}>
          <div style={{
            fontSize: 11, letterSpacing: 2, color: 'var(--text-muted)',
            marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border)',
          }}>{date.replace(/-/g, '. ')}</div>
          <FeedList items={items} />
        </div>
      ))}

      {limited && hiddenDates > 0 && (
        <button
          className="btn-secondary"
          onClick={() => setShowAll(true)}
        >지난 {hiddenDates}일치 더 보기</button>
      )}

      <div style={{
        marginTop: 20, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.8,
      }}>
        화면이 바뀌지 않는 변경(문서 정리, 내부 구조 손질)은 올리지 않습니다.
      </div>
    </div>
  );
}
