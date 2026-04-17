import { useState, useEffect } from 'react';
import { useLangStore } from '../store/langStore';
import client from '../api/client';

const T = {
  ko: {
    title: 'SECURITY DASHBOARD',
    totalUsers: '전체 유저',
    todaySignups: '오늘 가입',
    jwtSettings: 'JWT 설정',
    expiry: '만료시간',
    algorithm: '알고리즘',
    rateLimit: 'Rate Limit 설정',
    login: '로그인',
    authCode: '인증코드',
    helmet: 'Helmet',
    enabled: '활성화',
    disabled: '비활성화',
    cors: 'CORS 허용 도메인',
    bodyLimit: 'Body 크기 제한',
    nodeVersion: 'Node.js 버전',
    safe: '안전',
    warning: '주의',
    danger: '위험',
    userList: 'USER LIST',
    id: 'ID',
    email: '이메일',
    nickname: '닉네임',
    role: '역할',
    joinDate: '가입일',
    actions: '관리',
    block: '차단',
    unblock: '해제',
    grantAdmin: '관리자 부여',
    loading: '로딩 중...',
    error: '데이터를 불러올 수 없습니다.',
    perWindow: '/ 윈도우',
  },
  en: {
    title: 'SECURITY DASHBOARD',
    totalUsers: 'Total Users',
    todaySignups: 'Today Signups',
    jwtSettings: 'JWT Settings',
    expiry: 'Expiry',
    algorithm: 'Algorithm',
    rateLimit: 'Rate Limit Settings',
    login: 'Login',
    authCode: 'Auth Code',
    helmet: 'Helmet',
    enabled: 'Enabled',
    disabled: 'Disabled',
    cors: 'CORS Allowed Origins',
    bodyLimit: 'Body Size Limit',
    nodeVersion: 'Node.js Version',
    safe: 'Safe',
    warning: 'Warning',
    danger: 'Danger',
    userList: 'USER LIST',
    id: 'ID',
    email: 'Email',
    nickname: 'Nickname',
    role: 'Role',
    joinDate: 'Joined',
    actions: 'Actions',
    block: 'Block',
    unblock: 'Unblock',
    grantAdmin: 'Grant Admin',
    loading: 'Loading...',
    error: 'Failed to load data.',
    perWindow: '/ window',
  },
};

function StatusBadge({ status, label }) {
  const colors = {
    safe: { bg: '#00c85320', color: '#00c853', border: '#00c85350' },
    warning: { bg: '#ffab0020', color: '#ffab00', border: '#ffab0050' },
    danger: { bg: '#ff174420', color: '#ff1744', border: '#ff174450' },
  };
  const c = colors[status] || colors.safe;
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 'var(--radius)',
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
      letterSpacing: 0.5,
    }}>
      {label}
    </span>
  );
}

function getJwtStatus(expiry) {
  if (!expiry) return 'warning';
  const hours = parseInt(expiry);
  if (hours <= 1) return 'safe';
  if (hours <= 24) return 'warning';
  return 'danger';
}

function getAlgoStatus(algo) {
  if (!algo) return 'warning';
  if (algo.startsWith('HS512') || algo.startsWith('RS')) return 'safe';
  if (algo === 'HS256') return 'warning';
  return 'danger';
}

function getRateLimitStatus(limit) {
  if (!limit) return 'danger';
  if (limit <= 5) return 'safe';
  if (limit <= 20) return 'warning';
  return 'danger';
}

function getHelmetStatus(enabled) {
  return enabled ? 'safe' : 'danger';
}

function getNodeStatus(version) {
  if (!version) return 'warning';
  const major = parseInt(version.replace('v', ''));
  if (major >= 20) return 'safe';
  if (major >= 18) return 'warning';
  return 'danger';
}

export default function SecurityPanel() {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [dashRes, usersRes] = await Promise.all([
        client.get('/security/dashboard'),
        client.get('/security/users'),
      ]);
      setDashboard(dashRes.data);
      setUsers(usersRes.data);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (userId, action) => {
    const actionMap = {
      'block': 'block-user',
      'unblock': 'unblock-user',
      'grant-admin': 'make-admin',
      'revoke-admin': 'revoke-admin',
    };
    const endpoint = actionMap[action] || action;
    try {
      await client.post(`/security/${endpoint}/${userId}`);
      const res = await client.get('/security/users');
      setUsers(res.data);
    } catch (e) {
      console.error('Action failed:', e);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        {t.loading}
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', color: '#ff1744' }}>
        {t.error}
      </div>
    );
  }

  const { totalUsers, todaySignups, jwt, rateLimit, helmet, cors, bodyLimit, nodeVersion } = dashboard;

  const roleColor = (role) => {
    if (role === 'admin') return '#ffd700';
    if (role === 'blocked') return '#ff1744';
    return 'var(--text-secondary)';
  };

  return (
    <div>
      {/* Title */}
      <h2 style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 22,
        letterSpacing: 2,
        color: 'var(--accent)',
        marginBottom: 16,
      }}>
        {t.title}
      </h2>

      {/* Stats Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'Barlow', sans-serif", marginBottom: 4 }}>
            {t.totalUsers}
          </div>
          <div style={{ fontSize: 26, fontFamily: "'Bebas Neue', sans-serif", color: 'var(--accent)', letterSpacing: 1 }}>
            {totalUsers ?? '-'}
          </div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'Barlow', sans-serif", marginBottom: 4 }}>
            {t.todaySignups}
          </div>
          <div style={{ fontSize: 26, fontFamily: "'Bebas Neue', sans-serif", color: '#4a9aff', letterSpacing: 1 }}>
            {todaySignups ?? '-'}
          </div>
        </div>
      </div>

      {/* JWT Settings */}
      <div className="card" style={{ padding: 14, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5, color: 'var(--accent)' }}>
            {t.jwtSettings}
          </span>
          <StatusBadge status={getAlgoStatus(jwt?.algorithm)} label={t[getAlgoStatus(jwt?.algorithm)]} />
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, fontFamily: "'Barlow', sans-serif" }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>{t.expiry}: </span>
            <span style={{ color: getJwtStatus(jwt?.expiry) === 'safe' ? '#00c853' : getJwtStatus(jwt?.expiry) === 'warning' ? '#ffab00' : '#ff1744', fontWeight: 600 }}>
              {jwt?.expiry || '-'}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>{t.algorithm}: </span>
            <span style={{ fontWeight: 600 }}>{jwt?.algorithm || '-'}</span>
          </div>
        </div>
      </div>

      {/* Rate Limit */}
      <div className="card" style={{ padding: 14, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5, color: 'var(--accent)' }}>
            {t.rateLimit}
          </span>
          <StatusBadge status={getRateLimitStatus(rateLimit?.login?.max)} label={t[getRateLimitStatus(rateLimit?.login?.max)]} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontFamily: "'Barlow', sans-serif" }}>
          {rateLimit && Object.entries(rateLimit).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key}</span>
              <span style={{ fontWeight: 600 }}>
                {val?.max ?? '-'} req / {val?.windowMs ? `${val.windowMs / 60000}min` : '-'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Helmet, CORS, Body Limit, Node */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {/* Helmet */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1, color: 'var(--accent)' }}>
              {t.helmet}
            </span>
            <StatusBadge status={getHelmetStatus(helmet?.enabled)} label={t[getHelmetStatus(helmet?.enabled)]} />
          </div>
          <div style={{ fontSize: 12, fontFamily: "'Barlow', sans-serif", color: helmet?.enabled ? '#00c853' : '#ff1744', fontWeight: 600 }}>
            {helmet?.enabled ? t.enabled : t.disabled}
          </div>
        </div>

        {/* Node Version */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1, color: 'var(--accent)' }}>
              {t.nodeVersion}
            </span>
            <StatusBadge status={getNodeStatus(nodeVersion)} label={t[getNodeStatus(nodeVersion)]} />
          </div>
          <div style={{ fontSize: 12, fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>
            {nodeVersion || '-'}
          </div>
        </div>
      </div>

      {/* CORS */}
      <div className="card" style={{ padding: 14, marginBottom: 10 }}>
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5, color: 'var(--accent)' }}>
            {t.cors}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(cors?.origins || []).map((origin, i) => (
            <span key={i} style={{
              fontSize: 11,
              fontFamily: "'Barlow', sans-serif",
              padding: '3px 10px',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}>
              {origin}
            </span>
          ))}
          {(!cors?.origins || cors.origins.length === 0) && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>-</span>
          )}
        </div>
      </div>

      {/* Body Limit */}
      <div className="card" style={{ padding: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5, color: 'var(--accent)' }}>
            {t.bodyLimit}
          </span>
          <span style={{ fontSize: 13, fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>
            {bodyLimit || '-'}
          </span>
        </div>
      </div>

      {/* User List */}
      <h2 style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 20,
        letterSpacing: 2,
        color: 'var(--accent)',
        marginBottom: 12,
      }}>
        {t.userList}
      </h2>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 12,
          fontFamily: "'Barlow', sans-serif",
        }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {[t.id, t.email, t.nickname, t.role, t.joinDate, t.actions].map((h, i) => (
                <th key={i} style={{
                  padding: '8px 6px',
                  textAlign: 'left',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 6px', color: 'var(--text-muted)' }}>{user.id}</td>
                <td style={{ padding: '8px 6px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </td>
                <td style={{ padding: '8px 6px' }}>{user.nickname}</td>
                <td style={{ padding: '8px 6px' }}>
                  <span style={{
                    fontWeight: 700,
                    color: roleColor(user.role),
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: '8px 6px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 11 }}>
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                </td>
                <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {user.role !== 'blocked' ? (
                      <button
                        onClick={() => handleAction(user.id, 'block')}
                        style={{
                          padding: '3px 8px',
                          fontSize: 10,
                          fontWeight: 600,
                          border: '1px solid #ff174450',
                          borderRadius: 'var(--radius)',
                          background: '#ff174415',
                          color: '#ff1744',
                          cursor: 'pointer',
                        }}
                      >
                        {t.block}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction(user.id, 'unblock')}
                        style={{
                          padding: '3px 8px',
                          fontSize: 10,
                          fontWeight: 600,
                          border: '1px solid #00c85350',
                          borderRadius: 'var(--radius)',
                          background: '#00c85315',
                          color: '#00c853',
                          cursor: 'pointer',
                        }}
                      >
                        {t.unblock}
                      </button>
                    )}
                    {user.role !== 'admin' && (
                      <button
                        onClick={() => handleAction(user.id, 'grant-admin')}
                        style={{
                          padding: '3px 8px',
                          fontSize: 10,
                          fontWeight: 600,
                          border: '1px solid #ffd70050',
                          borderRadius: 'var(--radius)',
                          background: '#ffd70015',
                          color: '#ffd700',
                          cursor: 'pointer',
                        }}
                      >
                        {t.grantAdmin}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
