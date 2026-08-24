import { useState, useEffect } from 'react';
import { useLangStore } from '../store/langStore';
import client from '../api/client';
import { toast } from './Toast';

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
    remove: '삭제',
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
    remove: 'Delete',
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

// '15m' · '2h' · '7d' 를 분으로 바꾼다.
// parseInt 만 쓰면 단위를 못 보고 15분짜리를 15시간으로 읽어, 안전한 설정을 '주의' 로 띄운다
function expiryMinutes(expiry) {
  const m = /^(\d+)\s*([smhd])?$/.exec(String(expiry ?? '').trim());
  if (!m) return null;
  const per = { s: 1 / 60, m: 1, h: 60, d: 1440 };
  return Number(m[1]) * per[m[2] || 'm'];
}

function getJwtStatus(expiry) {
  const mins = expiryMinutes(expiry);
  if (mins === null) return 'warning';
  if (mins <= 60) return 'safe';
  if (mins <= 24 * 60) return 'warning';
  return 'danger';
}

function getAlgoStatus(algo) {
  if (!algo) return 'warning';
  if (algo.startsWith('HS512') || algo.startsWith('RS')) return 'safe';
  if (algo === 'HS256') return 'warning';
  return 'danger';
}

// 횟수만 보면 창 길이를 못 본다 — 15분에 20회와 1분에 20회는 전혀 다르다.
// 분당 몇 번인지로 판단한다
function getRateLimitStatus(limit) {
  if (!limit?.max || !limit?.windowMs) return 'danger';
  const perMin = limit.max / (limit.windowMs / 60000);
  if (perMin <= 5) return 'safe';
  if (perMin <= 30) return 'warning';
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
  // 지울 대상. 이메일을 그대로 적어야 지워진다
  const [deleting, setDeleting] = useState(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [removing, setRemoving] = useState(false);

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

  // 계정과 모든 기록을 지운다. 되돌릴 수 없다.
  //
  // 서버가 세 가지를 요구한다 — 관리자가 아닐 것, 이미 막혀 있을 것,
  // 이메일을 정확히 적을 것. 화면도 같은 순서로 막는다.
  const removeUser = async () => {
    if (!deleting || removing) return;
    setRemoving(true);
    try {
      await client.delete(`/security/user/${deleting.id}`, { data: { confirmEmail } });
      setUsers(prev => prev.filter(u => u.id !== deleting.id));
      toast(`${deleting.email} 계정과 기록을 모두 지웠어요`);
      setDeleting(null);
      setConfirmEmail('');
    } catch (e) {
      toast(e?.response?.data?.error || '지우지 못했어요', 'error');
    } finally {
      setRemoving(false);
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
      // 조용히 넘어가면 목록이 그대로라 성공한 줄 안다. 사람을 차단하는 자리다
      toast(e?.response?.data?.error || '처리하지 못했어요', 'error');
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
          <StatusBadge status={getRateLimitStatus(rateLimit?.login)} label={t[getRateLimitStatus(rateLimit?.login)]} />
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
                    {/* 지우기는 이미 막아둔 사람에게만 보인다.
                        멀쩡한 사람 옆에 삭제 버튼이 늘 붙어 있으면 언젠가 눌린다 */}
                    {user.role === 'blocked' && (
                      <button
                        onClick={() => { setDeleting(user); setConfirmEmail(''); }}
                        style={{
                          padding: '3px 8px',
                          fontSize: 10,
                          fontWeight: 600,
                          border: '1px solid #ff174450',
                          borderRadius: 'var(--radius)',
                          background: 'transparent',
                          color: '#ff1744',
                          cursor: 'pointer',
                        }}
                      >
                        {t.remove}
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

      {/* ── 계정 삭제 확인 ──
          되돌릴 수 없다. 그래서 '정말요?' 한 번으로 끝내지 않고 이메일을 그대로 적게 한다.
          누구를 지우는지 눈으로 보고 손으로 옮겨 적어야 버튼이 살아난다. */}
      {deleting && (
        <div
          onClick={() => !removing && setDeleting(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.75)', zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="계정 삭제"
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-lg)', padding: 22, maxWidth: 400, width: '100%',
            }}
          >
            <h3 style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2,
              color: 'var(--danger)', marginBottom: 10,
            }}>계정 삭제</h3>

            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.8, margin: '0 0 6px' }}>
              <b>{deleting.nickname}</b>
              <span style={{ color: 'var(--text-muted)' }}> · {deleting.email}</span>
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 14px' }}>
              이 사람의 <b style={{ color: 'var(--danger)' }}>운동 기록 · 인바디 · 측정 · 루틴 · 사진 · 제보</b>가
              전부 사라집니다. <b style={{ color: 'var(--danger)' }}>되돌릴 수 없습니다.</b>
            </p>

            <label className="label">확인을 위해 이메일을 그대로 적어주세요</label>
            <input
              className="input"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={deleting.email}
              autoFocus
              style={{ marginBottom: 14 }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setDeleting(null)}
                disabled={removing}
                style={{
                  flex: 1, background: 'none', border: '1px solid var(--border-hover)',
                  color: 'var(--text-secondary)', padding: '10px 14px',
                  borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13,
                }}
              >그만두기</button>
              <button
                onClick={removeUser}
                disabled={removing || confirmEmail.trim().toLowerCase() !== String(deleting.email).toLowerCase()}
                style={{
                  flex: 1, border: '1px solid var(--danger)',
                  background: confirmEmail.trim().toLowerCase() === String(deleting.email).toLowerCase() ? 'var(--danger)' : 'transparent',
                  color: confirmEmail.trim().toLowerCase() === String(deleting.email).toLowerCase() ? '#fff' : 'var(--text-muted)',
                  padding: '10px 14px', borderRadius: 'var(--radius)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700,
                }}
              >{removing ? '지우는 중…' : '지웁니다'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
