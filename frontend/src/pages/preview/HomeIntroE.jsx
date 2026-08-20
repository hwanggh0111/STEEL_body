import { useNavigate } from 'react-router-dom';
import { useIntroStats, FEATURES, LEVEL_ROWS, TICKET_ROWS } from './introData';

// ─────────────────────────────────────────────────────────────
// E안 — 타일형
//
// 모든 것을 같은 크기 타일로 놓는다. 읽는 페이지가 아니라 고르는 페이지다.
// 앱 런처에 가깝다 — 소개는 거의 없고, 손가락이 닿는 면적이 크다.
// ─────────────────────────────────────────────────────────────

function Tile({ children, span = 1, onClick, tone }) {
  const bg = tone === 'accent' ? 'var(--accent-dim)' : 'var(--bg-secondary)';
  const bd = tone === 'accent' ? 'var(--accent)' : 'var(--border)';
  return (
    <div
      onClick={onClick}
      style={{
        gridColumn: `span ${span}`, background: bg,
        border: `1px solid ${bd}`, borderRadius: 'var(--radius)',
        padding: 14, cursor: onClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        minHeight: 92, transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = 'var(--accent)'; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.borderColor = bd; }}
    >{children}</div>
  );
}

const Cap = ({ children }) => (
  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: 1 }}>{children}</div>
);

const Big = ({ children, color }) => (
  <div style={{
    fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 1,
    color: color || 'var(--text-primary)', lineHeight: 1,
  }}>{children}</div>
);

export default function HomeIntroE() {
  const navigate = useNavigate();
  const s = useIntroStats();

  return (
    <div>
      <div style={{
        fontSize: 11.5, color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 20,
      }}>시안 E · 타일형 — 아직 앱에 붙어 있지 않습니다</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

        {/* 오늘 — 가로 두 칸 */}
        <Tile span={2} tone="accent" onClick={() => navigate('/workout')}>
          <Cap>{s.todayDone ? '오늘 완료' : '오늘 아직'}</Cap>
          <div>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: 2,
              color: 'var(--accent)', margin: '10px 0 6px',
            }}>{s.todayDone ? '한 번 더' : '기록하기'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {s.todayDone ? '오늘 것은 남겼습니다' : '오늘 기록이 비어 있습니다'}
            </div>
          </div>
        </Tile>

        {/* 숫자 타일 4개 */}
        <Tile><Cap>총 운동</Cap><Big>{s.totalWorkouts.toLocaleString()}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>회</span></Big></Tile>
        <Tile><Cap>이번 주</Cap><Big>{s.weekDays}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/7</span></Big></Tile>
        <Tile><Cap>레벨</Cap><Big color="var(--accent)">{s.lv.level}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/{s.maxLevel}</span></Big></Tile>
        <Tile><Cap>최근 체중</Cap><Big>{s.latest ? s.latest.weight : '—'}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.latest ? 'kg' : ''}</span></Big></Tile>

        {/* 기능 6개 */}
        {FEATURES.map(f => (
          <Tile key={f.path} onClick={() => navigate(f.path)}>
            <div style={{ fontSize: 20 }}>{f.icon}</div>
            <div>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 600 }}>{f.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{f.short}</div>
            </div>
          </Tile>
        ))}

        {/* 레벨 세 단계 — 가로 두 칸 */}
        <Tile span={2}>
          <Cap>레벨은 세 단계로 쌓인다</Cap>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {LEVEL_ROWS.map(r => (
              <div key={r.name} style={{
                flex: 1, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', padding: '10px 8px',
              }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{r.name}</div>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 1,
                  color: 'var(--accent)', marginTop: 3,
                }}>{r.lo}–{r.hi}</div>
              </div>
            ))}
          </div>
        </Tile>

        {/* 티켓 — 가로 두 칸 */}
        <Tile span={2} onClick={() => navigate('/pachinko')}>
          <Cap>기록하면 티켓이 나온다</Cap>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {TICKET_ROWS.map(t => (
              <div key={t.name} style={{
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                padding: '6px 10px', fontSize: 11.5, color: 'var(--text-secondary)',
              }}>{t.name} <span style={{ color: 'var(--text-muted)' }}>{t.cost}</span></div>
            ))}
          </div>
        </Tile>

        {/* 제보 — 가로 두 칸 */}
        <Tile span={2} onClick={() => navigate('/preview/report')}>
          <Cap>제보함</Cap>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <span style={{ fontSize: 20 }}>📮</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 600 }}>안 되는 게 있으면 알려주세요</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>확인하고 답을 답니다</div>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>›</span>
          </div>
        </Tile>
      </div>
    </div>
  );
}
