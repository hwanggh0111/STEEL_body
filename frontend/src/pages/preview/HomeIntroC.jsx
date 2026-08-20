import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useIntroStats, FEATURES, TICKET_LINE } from './introData';

// ─────────────────────────────────────────────────────────────
// C안 — 대시보드형
//
// 소개를 거의 하지 않는다. 매일 여는 사람에게 "오늘 뭐 할 차례인지" 만 보여준다.
// 처음 오는 사람용 얼굴이 아니라, 이미 쓰는 사람의 첫 화면에 가깝다.
// ─────────────────────────────────────────────────────────────

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export default function HomeIntroC() {
  const navigate = useNavigate();
  const { nickname } = useAuthStore();
  const s = useIntroStats();

  const hour = new Date().getHours();
  const greet = hour < 5 ? '아직 안 주무셨나요' : hour < 11 ? '좋은 아침입니다' : hour < 18 ? '오늘도 하루' : '오늘 마무리';

  return (
    <div>
      <div style={{
        fontSize: 11.5, color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 24,
      }}>시안 C · 대시보드형 — 아직 앱에 붙어 있지 않습니다</div>

      {/* 인사 + 오늘 상태 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{greet},</div>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: 2,
          color: 'var(--text-primary)', marginTop: 4,
        }}>{nickname || '회원'}</div>
      </div>

      {/* 오늘 할 일 — 가장 크게 */}
      <div style={{
        border: `1px solid ${s.todayDone ? 'var(--success)' : 'var(--accent)'}`,
        background: s.todayDone ? 'var(--success-dim)' : 'var(--accent-dim)',
        borderRadius: 'var(--radius)', padding: '20px 18px', marginBottom: 10,
      }}>
        <div style={{
          fontSize: 12, letterSpacing: 1, marginBottom: 8,
          color: s.todayDone ? 'var(--success)' : 'var(--accent)',
        }}>{s.todayDone ? '오늘 완료' : '오늘 아직'}</div>
        <div style={{ fontSize: 17, color: 'var(--text-primary)', fontWeight: 700, marginBottom: 16 }}>
          {s.todayDone ? '오늘 것은 남겼습니다' : '오늘 기록이 비어 있습니다'}
        </div>
        <button
          onClick={() => navigate('/workout')}
          className="btn-primary"
          style={{ width: 'auto', padding: '11px 24px' }}
        >{s.todayDone ? '기록 더 남기기' : '지금 기록하기'}</button>
      </div>

      {/* 이번 주 7칸 */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>이번 주</span>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1, color: 'var(--accent)',
          }}>{s.weekDays} / 7</span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {s.week.map((d, i) => (
            <div key={d.key} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 34, borderRadius: 'var(--radius)',
                background: d.done ? 'var(--accent)' : 'var(--bg-tertiary)',
                border: `1px solid ${d.done ? 'var(--accent)' : 'var(--border)'}`,
              }} />
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 5 }}>{DAYS[i]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 레벨 진행 */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {s.lv.tierInfo?.name?.ko || '입문'} · LV {s.lv.level}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            {s.lv.next ? `다음 레벨까지 ${Math.max(0, s.lv.needExp - s.lv.exp).toLocaleString()} EXP` : 'MAX'}
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div style={{ width: `${s.lv.progress}%`, height: '100%', background: 'var(--accent)' }} />
        </div>
      </div>

      {/* 숫자 두 개 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
        {[
          { l: '총 운동', v: s.totalWorkouts.toLocaleString(), u: '회' },
          { l: '최근 체중', v: s.latest ? s.latest.weight : '—', u: s.latest ? 'kg' : '' },
        ].map(x => (
          <div key={x.l} className="card" style={{ flex: 1, textAlign: 'center', padding: '14px 8px' }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 1, color: 'var(--text-primary)',
            }}>{x.v}<span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 2 }}>{x.u}</span></div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 5 }}>{x.l}</div>
          </div>
        ))}
      </div>

      {/* 빠른 이동 */}
      <div className="section-title"><div className="accent-bar" />바로 가기</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
        {FEATURES.map(f => (
          <div
            key={f.path}
            className="card clickable"
            onClick={() => navigate(f.path)}
            style={{ textAlign: 'center', padding: '14px 6px' }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{f.name}</div>
          </div>
        ))}
      </div>

      {/* 티켓 한 줄 */}
      <div
        className="card clickable"
        onClick={() => navigate('/pachinko')}
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}
      >
        <span style={{ fontSize: 20 }}>🎫</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 600 }}>티켓 쓰러 가기</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{TICKET_LINE}</div>
        </div>
        <span style={{ color: 'var(--text-muted)' }}>›</span>
      </div>

      {/* 제보 한 줄 */}
      <div
        className="card clickable"
        onClick={() => navigate('/preview/report')}
        style={{ display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <span style={{ fontSize: 20 }}>📮</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 600 }}>제보함</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>안 되는 것 · 이상한 것 · 있었으면 하는 것</div>
        </div>
        <span style={{ color: 'var(--text-muted)' }}>›</span>
      </div>
    </div>
  );
}
