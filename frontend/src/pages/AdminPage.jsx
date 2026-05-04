import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import SecurityPanel from '../components/SecurityPanel';
import HackingSecurityPanel from '../components/HackingSecurityPanel';
import AiAdminPanel from '../components/AiAdminPanel';
import AiNoticeWriter from '../components/AiNoticeWriter';
import NoticeAdmin from '../components/admin/NoticeAdmin';
import MaintAdmin from '../components/admin/MaintAdmin';
import SecurityScan from '../components/admin/SecurityScan';

import { isAdmin as checkAdmin } from '../data/admin';

export default function AdminPage() {
  const { nickname } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState('notice');

  const isAdmin = checkAdmin();

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
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

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
          letterSpacing: 2, color: 'var(--accent)', margin: 0, marginBottom: 4,
        }}>ADMIN</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          공지사항 · 점검 · 보안 · 해킹보안 관리
        </p>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'notice', label: '공지사항 관리', icon: '📢' },
          { key: 'maint', label: '점검 스케줄', icon: '🔧' },
          { key: 'security', label: '보안 관리', icon: '🛡️' },
          { key: 'hacking', label: '해킹 보안', icon: '🔒' },
          { key: 'ai', label: 'AI 관리자', icon: '🤖' },
          { key: 'ainotice', label: 'AI 공지', icon: '📝' },
          { key: 'scan', label: '보안 검사', icon: '🔍' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px', borderRadius: 'var(--radius)',
              border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              borderColor: tab === t.key ? 'var(--accent)' : 'var(--border)',
              background: tab === t.key ? 'var(--accent)' : 'transparent',
              color: tab === t.key ? '#000' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === 'notice' && <NoticeAdmin />}
      {tab === 'maint' && <MaintAdmin />}
      {tab === 'security' && <SecurityPanel />}
      {tab === 'hacking' && <HackingSecurityPanel />}
      {tab === 'ai' && <AiAdminPanel />}
      {tab === 'ainotice' && <AiNoticeWriter />}
      {tab === 'scan' && <SecurityScan />}
    </div>
  );
}
