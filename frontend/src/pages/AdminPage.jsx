import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import SecurityPanel from '../components/SecurityPanel';
import HackingSecurityPanel from '../components/HackingSecurityPanel';
import AiAdminPanel from '../components/AiAdminPanel';
import MaintAdmin from '../components/admin/MaintAdmin';
import ReportAdmin from '../components/admin/ReportAdmin';
import SecurityScan from '../components/admin/SecurityScan';
import FaqGapAdmin from '../components/admin/FaqGapAdmin';
import { usePendingReports } from '../components/usePendingReports';

import { isAdmin as checkAdmin } from '../data/admin';

// 관리자.
//
// 예전에는 **탭 일곱 개가 한 줄로 늘어서서 줄바꿈**됐다. 「보안 관리」 · 「해킹 보안」 ·
// 「AI 관리자」 · 「보안 검사」 — 이름만 보고는 어느 것이 무엇을 하는지 알 수 없었고,
// 어디에 손볼 것이 남았는지는 **일곱 개를 다 눌러봐야** 알았다.
//
// 아래 탭바의 「관리자」에는 손볼 제보 수가 뱃지로 붙어 있었는데, 정작 관리자 화면
// 안에는 그 수가 없었다. 여기까지 들어온 사람이 제일 먼저 알아야 할 숫자다.
//
// 다시 짜면서 셋을 바꿨다.
//
// **1. 할 일을 맨 위에 적는다.** 답을 기다리는 제보와 확인 안 한 욕설 신고를 세어
// 머리에 붙인다. 없으면 없다고 말한다 — 빈 목록을 보고 짐작하게 두지 않는다.
// **아직 안 받아온 0 과 정말 0 은 다르다**. 받아오기 전에는 아무 말도 안 한다.
//
// **2. 항목마다 무엇을 하는 곳인지 한 줄씩.** 측정 시스템을 다시 만들 때와 같은
// 방법이다 — 이름만으로 구별이 안 되는 것들이라 설명이 이름보다 중요하다.
//
// **3. 두 무리로 나눈다.** 사람이 기다리는 것(제보 · 못 찾은 말 · 점검)과
// 지켜보는 것(보안 넷). 앞의 셋은 안 보면 사람이 기다리고, 뒤의 넷은 아무 일
// 없으면 안 열어도 된다. 성격이 다른 것을 한 줄에 섞어놨었다.
//
// 열리는 탭은 그대로 제보다 — 사람이 기다리고 있는 목록이라 한 번도 안 눌러서 닿아야
// 한다 (8/24 에 고객센터를 앱에 붙이면서 maint 에서 바꿨다). 나머지는 「관리 항목」에서 고른다.
const GROUPS = [
  {
    title: '사람이 기다리는 것',
    items: [
      { key: 'report', label: '제보 관리', icon: '📮', desc: '들어온 제보에 답하고, 욕설·비하로 걸린 기록을 판정한다' },
      { key: 'faqgap', label: '못 찾은 말', icon: '🔎', desc: '고객센터에서 답을 못 찾고 나간 검색어' },
      { key: 'maint', label: '점검 스케줄', icon: '🔧', desc: '점검 시각을 예약하고 안내 화면을 띄운다' },
    ],
  },
  {
    title: '지켜보는 것',
    items: [
      { key: 'security', label: '보안 관리', icon: '🛡️', desc: '가입자 목록 · 차단 · 해제, JWT · CORS 설정' },
      { key: 'hacking', label: '해킹 보안', icon: '🔒', desc: '로그인 실패 · 차단된 요청 · 보안 로그' },
      { key: 'ai', label: 'AI 관리자', icon: '🤖', desc: '자동으로 막힌 IP 를 보고 풀거나 더 막는다' },
      { key: 'scan', label: '보안 검사', icon: '🔍', desc: '지금 한 번 훑어서 약한 곳을 찾는다' },
    ],
  },
];

const ALL = GROUPS.flatMap(g => g.items);

const PANELS = {
  report: ReportAdmin,
  maint: MaintAdmin,
  faqgap: FaqGapAdmin,
  security: SecurityPanel,
  hacking: HackingSecurityPanel,
  ai: AiAdminPanel,
  scan: SecurityScan,
};

function Todo({ pending, onGo }) {
  if (!pending.loaded) return null;

  const none = pending.total === 0;
  return (
    <div
      className={none ? 'card' : 'card clickable'}
      onClick={none ? undefined : onGo}
      style={{
        marginBottom: 20,
        borderColor: none ? 'var(--border)' : 'var(--accent)',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}
    >
      {none ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>지금 손볼 것은 없어요.</div>
      ) : (
        <>
          {pending.open > 0 && (
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 2, color: 'var(--accent)', lineHeight: 1 }}>
                {pending.open}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>답을 기다리는 제보</div>
            </div>
          )}
          {pending.abuse > 0 && (
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 2, color: 'var(--danger)', lineHeight: 1 }}>
                {pending.abuse}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>확인 안 한 욕설 신고</div>
            </div>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>제보 관리로 ›</div>
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { nickname } = useAuthStore();
  const navigate = useNavigate();
  const pending = usePendingReports();
  const [tab, setTab] = useState('report');
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = checkAdmin();

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">🔒</div>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
          letterSpacing: 2, color: 'var(--danger)', marginBottom: 8,
        }}>ACCESS DENIED</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
          관리자 전용 페이지입니다.
          <br />접근 권한이 없습니다.
        </div>
        <button
          onClick={() => navigate('/home')}
          className="btn-primary"
          style={{ width: 'auto', padding: '10px 24px' }}
        >홈으로 돌아가기</button>
      </div>
    );
  }

  const current = ALL.find(t => t.key === tab);
  const Panel = PANELS[tab];
  const badgeOf = (key) => (key === 'report' ? pending.total : 0);

  const open = (key) => {
    setTab(key);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <h2 style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
            letterSpacing: 2, color: 'var(--accent)', margin: '0 0 4px',
          }}>ADMIN</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            제보 · 점검 · 보안
          </p>
        </div>
        {/* 예전에는 이 닉네임을 꺼내놓고 어디에도 안 썼다.
            관리자 계정이 둘 이상일 수 있으니 지금 누구로 보고 있는지는 적혀 있어야 한다 */}
        {nickname && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
            {nickname} 님으로 보는 중
          </div>
        )}
      </div>

      <Todo pending={pending} onGo={() => open('report')} />

      {/* 지금 보고 있는 것 + 항목 고르기 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button
          className="btn-secondary"
          style={{ flexShrink: 0 }}
          onClick={() => setMenuOpen(v => !v)}
          aria-expanded={menuOpen}
        >{menuOpen ? '× 닫기' : '☰ 관리 항목'}</button>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 1.5,
          color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{current?.label}</div>
      </div>

      {menuOpen && (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {GROUPS.map(group => (
            <div key={group.title}>
              <div className="label" style={{ marginBottom: 8 }}>{group.title}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {group.items.map(t => {
                  const active = t.key === tab;
                  const badge = badgeOf(t.key);
                  return (
                    <button
                      key={t.key}
                      onClick={() => open(t.key)}
                      className="card clickable"
                      style={{
                        textAlign: 'left', minHeight: 84, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
                        fontFamily: "'Barlow', sans-serif",
                        borderColor: active ? 'var(--accent)' : 'var(--border)',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span aria-hidden="true">{t.icon}</span>
                        <span style={{
                          fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1.5,
                          color: active ? 'var(--accent)' : 'var(--text-primary)',
                        }}>{t.label}</span>
                        {badge > 0 && <span className="badge badge-accent">{badge}</span>}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {Panel && <Panel />}
    </div>
  );
}
