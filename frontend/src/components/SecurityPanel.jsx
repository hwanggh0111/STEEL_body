import { useState, useEffect } from 'react';
import { useLangStore } from '../store/langStore';
import client from '../api/client';
import { toast } from './Toast';
import { confirmDialog } from './ConfirmModal';
import { readLS } from '../data/safeStorage';

const T = {
  ko: {
    title: '보안 현황',
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
    userList: '사람 목록',
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

// 역할 거르기. 서버가 쓰는 값은 셋뿐이다 (user · admin · blocked)
const ROLE_TABS = [
  { key: 'all', label: '전체' },
  { key: 'user', label: '일반' },
  { key: 'admin', label: '관리자' },
  { key: 'blocked', label: '차단됨' },
];

function StatusBadge({ status, label }) {
  // 앱이 쓰는 색으로. 예전에는 `#00c853` · `#ff1744` 처럼 여기에만 있는 초록·빨강을
  // 박아둬서, 관리자 화면만 다른 앱처럼 보였다. 색 토큰은 `styles/globals.css` 에 있다
  const colors = {
    safe: { bg: 'var(--success-dim)', color: 'var(--success)', border: 'var(--success)' },
    warning: { bg: 'var(--warning-dim)', color: 'var(--warning)', border: 'var(--warning)' },
    danger: { bg: 'var(--danger-dim)', color: 'var(--danger)', border: 'var(--danger)' },
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
// 사람에게 하는 일 단추. 넷이 같은 모양을 쓴다 —
// 예전에는 네 곳에 스타일을 그대로 복붙해서, 색 하나를 고치려면 네 군데를 고쳐야 했다
function UserBtn({ tone, ghost, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        border: `1px solid var(--${tone})`,
        borderRadius: 'var(--radius)',
        background: ghost ? 'transparent' : `var(--${tone}-dim)`,
        color: `var(--${tone})`,
      }}
    >{children}</button>
  );
}

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
  // 찾기 · 역할 거르기 · 서버 설정 접기
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      // 서버는 배열을 준다. 다른 모양이 오면 빈 것으로 친다 (아래에서 map 으로 돈다)
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
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

  // 관리자 권한은 **주는 것도 내리는 것도 되돌리기 어려운 일**이다.
  // 사람 이름을 넣어 한 번 묻는다 — 목록에서 한 칸 밀려 눌리는 자리다
  const grantAdmin = async (user) => {
    const ok = await confirmDialog(
      `${user.nickname || user.email} 님에게 관리자 권한을 줍니다.\n관리자는 모든 사람의 기록과 제보를 볼 수 있어요.`,
      { confirmText: '관리자로', danger: true },
    );
    if (ok) handleAction(user.id, 'grant-admin');
  };

  const revokeAdmin = async (user) => {
    const ok = await confirmDialog(
      `${user.nickname || user.email} 님의 관리자 권한을 내립니다.\n관리자 화면에 못 들어가게 됩니다.`,
      { confirmText: '내립니다', danger: true },
    );
    if (ok) handleAction(user.id, 'revoke-admin');
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
      <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--danger)' }}>
        {t.error}
      </div>
    );
  }

  const { totalUsers, todaySignups, jwt, rateLimit, helmet, cors, bodyLimit, nodeVersion } = dashboard;

  // ── 사람 카드 ──
  //
  // **예전에는 여섯 칸짜리 표였다** — ID · 이메일 · 닉네임 · 역할 · 가입일 · 관리.
  // 폰에서는 가로로 밀렸고, **막기 · 지우기 · 관리자 부여가 화면 밖 오른쪽 끝**에 있었다.
  // 8/31 에 측정 시스템에서 「옆으로 밀리는 것」을 걷어냈고 앱의 다른 목록은 다 카드인데
  // 여기만 표로 남아 있었다.
  //
  // 그리고 **할 수 없는 일을 눌러보게 두고 있었다** — 관리자에게도 「차단」 단추를 그렸고,
  // 누르면 서버가 「관리자는 차단할 수 없어요」로 거절했다. 이제 할 수 있는 것만 그린다.
  const ROLE_LABEL = { admin: '관리자', blocked: '막힘', user: '일반' };
  const roleColor = (role) => {
    if (role === 'admin') return 'var(--accent)';
    if (role === 'blocked') return 'var(--danger)';
    return 'var(--text-secondary)';
  };

  const needle = q.trim().toLowerCase();
  const shownUsers = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (!needle) return true;
    return [u.email, u.nickname, u.username, String(u.id)]
      .some(v => String(v || '').toLowerCase().includes(needle));
  });

  // 나 자신에게는 위험한 단추를 안 그린다. 서버도 막지만(자기 관리자 권한은 못 내린다)
  // **못 하는 것을 눌러보게 두지 않는다**
  const myEmail = String(readLS('ironlog_email') || '').toLowerCase();
  const isMe = (u) => myEmail && String(u.email || '').toLowerCase() === myEmail;

  const blockedCount = users.filter(u => u.role === 'blocked').length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  // 서버 설정을 접어두면 **열어보기 전에는 위험한 것이 있는지 모른다.**
  // 접힌 단추에 몇 개가 걸려 있는지 적는다 — 없으면 안 열어도 된다
  const settingChecks = [
    getJwtStatus(jwt?.expiry), getAlgoStatus(jwt?.algorithm),
    getRateLimitStatus(rateLimit?.login), getHelmetStatus(helmet?.enabled),
    getNodeStatus(nodeVersion),
  ];
  const dangerN = settingChecks.filter(v => v === 'danger').length;
  const warnN = settingChecks.filter(v => v === 'warning').length;

  return (
    <div>
      {/* 제목. 앱의 다른 모든 화면이 한국어인데 여기만 영문이었다 —
          관리자 화면의 탭 이름도 「보안 관리」다 */}
      <h2 style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 20, letterSpacing: 2, color: 'var(--accent)', marginBottom: 6,
      }}>
        보안 관리
      </h2>
      {/* **여기 오는 이유는 사람 때문이다.** 무엇을 하는 자리인지 먼저 적고,
          겹쳐 보이는 옆 화면과 무엇이 다른지도 한 줄로 갈라둔다 —
          9/1 에 「해킹 보안」과 「AI 관리자」가 같은 것을 따로 그리던 것을 정리했다 */}
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.8, margin: '0 0 14px' }}>
        가입한 사람을 찾아 막고 풀고 권한을 주는 자리입니다.
        <br />
        주소(IP)를 막고 푸는 것은 <b style={{ color: 'var(--text-secondary)' }}>해킹 보안</b>이 맡습니다 —
        여기서 막는 것은 <b style={{ color: 'var(--text-secondary)' }}>계정</b>입니다.
      </p>

      {/* 손볼 것 한 줄 — 예전에는 「전체 유저」와 「오늘 가입」 두 카드였다.
          둘 다 **관리자가 무엇을 할지 정하는 데 쓰이지 않는 숫자**다.
          정작 볼 것은 지금 막혀 있는 사람이 몇인가다 */}
      <div className="card" style={{
        padding: '12px 14px', marginBottom: 14,
        display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'baseline',
        borderLeft: `2px solid ${blockedCount > 0 ? 'var(--danger)' : 'var(--border)'}`,
      }}>
        <span style={{ fontSize: 13, color: blockedCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
          막아둔 사람 <b style={{ fontSize: 15 }}>{blockedCount}</b>명
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          오늘 가입 <b style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{todaySignups ?? '-'}</b>명
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          관리자 <b style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{adminCount}</b>명
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          전체 {totalUsers ?? users.length}명
        </span>
      </div>

      {/* 찾기 — 예전에는 표를 통째로 뿌리기만 했다. 사람이 늘면 못 찾는다 */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <input
          className="input"
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이메일 · 닉네임 · 아이디로 찾기"
          style={{ fontSize: 13, paddingRight: q ? 34 : undefined }}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            aria-label="찾기 지우기"
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 13, padding: 6, lineHeight: 1,
            }}
          >&#10005;</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {ROLE_TABS.map(r => {
          const n = r.key === 'all' ? users.length : users.filter(u => u.role === r.key).length;
          const on = roleFilter === r.key;
          return (
            <button
              key={r.key}
              onClick={() => setRoleFilter(r.key)}
              aria-pressed={on}
              style={{
                padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                borderRadius: 'var(--radius)',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                background: on ? 'var(--accent)' : 'transparent',
                color: on ? 'var(--on-accent)' : 'var(--text-secondary)',
                fontWeight: on ? 700 : 400, transition: 'all 0.15s',
              }}
            >{r.label} {n}</button>
          );
        })}
      </div>

      {shownUsers.length === 0 && (
        <div className="card" style={{ padding: 20, textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
          {users.length === 0 ? '아직 가입한 사람이 없습니다.' : '찾으시는 사람이 없습니다.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shownUsers.map((user) => (
          <div key={user.id} className="card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{user.nickname || '(이름 없음)'}</span>
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
                color: roleColor(user.role),
                border: `1px solid ${roleColor(user.role)}`,
                borderRadius: 'var(--radius)', padding: '0 6px',
              }}>{ROLE_LABEL[user.role] || user.role}</span>
              {isMe(user) && (
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>나</span>
              )}
            </div>
            {/* 이메일은 길어서 표에서 잘려 있었다. 카드에서는 줄을 바꿔 다 보여준다 */}
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, wordBreak: 'break-all' }}>
              {user.email}
            </div>
            {/* 서버가 주는 이름은 `created_at` 인데 화면은 `createdAt` 을 읽고 있었다 —
                그래서 **가입일이 언제나 「-」**였다 (8/26 에 고쳤다) */}
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
              {user.created_at ? `${String(user.created_at).slice(0, 10)} 가입` : '가입일 모름'} · id {user.id}
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {/* 관리자는 서버가 차단을 거절한다. 그러니 단추를 안 그린다 */}
              {user.role === 'user' && (
                <UserBtn tone="danger" onClick={() => handleAction(user.id, 'block')}>막기</UserBtn>
              )}
              {user.role === 'blocked' && (
                <UserBtn tone="success" onClick={() => handleAction(user.id, 'unblock')}>차단 풀기</UserBtn>
              )}
              {/* 지우기는 이미 막아둔 사람에게만 보인다.
                  멀쩡한 사람 옆에 삭제 단추가 늘 붙어 있으면 언젠가 눌린다 */}
              {user.role === 'blocked' && (
                <UserBtn tone="danger" ghost onClick={() => { setDeleting(user); setConfirmEmail(''); }}>
                  계정 지우기
                </UserBtn>
              )}
              {user.role !== 'admin' && (
                <UserBtn tone="warning" onClick={() => grantAdmin(user)}>관리자로</UserBtn>
              )}
              {/* **관리자를 내리는 길이 화면에 없었다.** 서버에는 `revoke-admin` 이 있고
                  화면 코드에도 그 줄이 있는데 **아무도 부르지 않았다** — 잘못 준 순간
                  되돌릴 방법이 없었다. 자기 자신과 마지막 관리자는 서버가 막는다 */}
              {user.role === 'admin' && !isMe(user) && adminCount > 1 && (
                <UserBtn tone="warning" ghost onClick={() => revokeAdmin(user)}>관리자 내리기</UserBtn>
              )}
              {user.role === 'admin' && (isMe(user) || adminCount <= 1) && (
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', alignSelf: 'center' }}>
                  {isMe(user) ? '내 권한은 내가 못 내립니다' : '관리자가 한 명뿐이라 못 내립니다'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 서버 설정 — 접어서 아래로. 배포할 때 한 번 보는 것들이다.
          **접어두면 열어보기 전에는 위험한 것이 있는지 모른다** — 몇 개가 걸려 있는지
          단추에 적는다. 아무것도 안 걸렸으면 안 열어도 된다는 뜻이다 */}
      <button
        onClick={() => setSettingsOpen(v => !v)}
        aria-expanded={settingsOpen}
        style={{
          width: '100%', marginTop: 20, marginBottom: settingsOpen ? 12 : 0,
          background: 'none', border: '1px solid var(--border)', cursor: 'pointer',
          borderRadius: 'var(--radius)', padding: '11px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          color: 'var(--text-secondary)', fontSize: 13,
        }}
      >
        <span>서버 설정</span>
        <span style={{ fontSize: 11.5, color: dangerN ? 'var(--danger)' : warnN ? 'var(--warning)' : 'var(--text-muted)' }}>
          {dangerN ? `위험 ${dangerN}` : warnN ? `주의 ${warnN}` : '다 안전합니다'}
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 15, transform: settingsOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s' }}>+</span>
      </button>

      {settingsOpen && (
        <div style={{ marginBottom: 20 }}>
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
            <span style={{ color: getJwtStatus(jwt?.expiry) === 'safe' ? 'var(--success)' : getJwtStatus(jwt?.expiry) === 'warning' ? 'var(--warning)' : 'var(--danger)', fontWeight: 600 }}>
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
          <div style={{ fontSize: 12, fontFamily: "'Barlow', sans-serif", color: helmet?.enabled ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
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

        </div>
      )}

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
                  background: confirmEmail.trim().toLowerCase() === String(deleting.email).toLowerCase() ? 'var(--danger-strong)' : 'transparent',
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
