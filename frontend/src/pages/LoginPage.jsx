import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { toast } from '../components/Toast';
import SplashScreen from '../components/SplashScreen';
import PasswordResetModal from '../components/PasswordResetModal';
import client from '../api/client';
import { readLS, removeLS, saveLS } from '../data/safeStorage';

const API_URL = import.meta.env.VITE_API_URL || '/api';
// 백엔드 URL (OAuth 리다이렉트용)
const BACKEND_BASE = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL.replace(/\/api$/, '');

// autoLogin 실패 시 정리할 키
const AUTO_LOGIN_KEYS = ['token', 'auto_login', 'nickname', 'ironlog_email', 'ironlog_role'];

export default function LoginPage() {
  const [email, setEmail] = useState(readLS('saved_id') || '');
  const [password, setPassword] = useState('');
  const savedNickname = readLS('saved_nickname') || '';
  const [autoLogin, setAutoLogin] = useState(!!readLS('auto_login'));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [oauthNickStep, setOauthNickStep] = useState(false);
  const [oauthNick, setOauthNick] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [nickSaving, setNickSaving] = useState(false);
  const [nickError, setNickError] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 세션 만료 알림
  useEffect(() => {
    if (readLS('session_expired')) {
      removeLS('session_expired');
      toast('세션이 만료되었어요. 다시 로그인해주세요.', 'warning');
    }
  }, []);

  // 소셜 로그인 — 서버는 넷을 다 지원하는데 화면에는 구글 하나뿐이었다.
  // 8/24 에 네 곳의 state 등록 버그를 고쳐놓고도 버튼을 안 만들었다.
  //
  // 제공자마다 열쇠가 따로 있어서, 없는 것을 누르면 오류로 되돌아온다.
  // **못 하는 것을 누를 수 있게 두지 않는다** — 서버에 물어서 되는 것만 그린다
  const [providers, setProviders] = useState(null);
  useEffect(() => {
    client.get('/oauth/providers')
      .then(({ data }) => setProviders(data))
      // 못 물어봤으면 구글만 보여준다. 하나도 안 보여주는 것보다 낫다
      .catch(() => setProviders({ google: true }));
  }, []);

  const startOauth = (provider) => {
    window.location.href = `${BACKEND_BASE}/api/oauth/${provider}`;
  };

  // 자동 로그인 (쿠키 기반 + /auth/me 검증)
  useEffect(() => {
    if (autoLogin) {
      // 쿠키 또는 localStorage 토큰이 있으면 서버에 검증
      const hasCookie = document.cookie.includes('sb_csrf=');
      const hasToken = !!readLS('token');
      if (hasCookie || hasToken) {
        client.get('/auth/me').then(() => {
          setShowSplash(true);
        }).catch(() => {
          // 자동 로그인 실패 — 모든 관련 키 정리
          AUTO_LOGIN_KEYS.forEach(k => removeLS(k));
          setAutoLogin(false);
        });
      }
    }
  }, []);

  // 소셜 로그인이 실패해서 되돌아왔을 때 뭐라고 할까.
//
// 예전에는 무엇이 잘못됐든 「다시 시도해주세요」였다. 그런데 열쇠가 설정 안 된
// 제공자는 **다시 시도해도 영영 안 된다** — 될 것처럼 말하면 안 된다.
function oauthErrorText(code) {
  const PROVIDER = { google: '구글', naver: '네이버', facebook: '페이스북', instagram: '인스타그램' };
  const [name, kind] = String(code || '').split(/_(.+)/);
  const label = PROVIDER[name] || '소셜';

  if (kind === 'not_configured') {
    return `${label} 로그인은 아직 준비 중이에요. 다른 방법으로 들어와 주세요.`;
  }
  if (code === 'invalid_state') {
    // state 는 1회용이라, 뒤로 가기나 오래된 링크로 다시 오면 여기로 떨어진다
    return '로그인 링크가 만료됐어요. 처음부터 다시 눌러주세요.';
  }
  return `${label} 로그인에 실패했어요. 다시 시도해주세요.`;
}

// OAuth 콜백 처리 (쿠키 기반 — 서버가 httpOnly 쿠키를 설정해서 리다이렉트)
  useEffect(() => {
    const oauthSuccess = searchParams.get('oauth');
    const nick = searchParams.get('nickname');
    const emailParam = searchParams.get('email');
    const err = searchParams.get('error');

    if (oauthSuccess === 'success' && nick) {
      const sanitizedNick = nick.replace(/[<>"'&`\\\/\(\)\[\]\{\}]/g, '').slice(0, 30);
      const sanitizedEmail = emailParam ? emailParam.replace(/[<>"'&`]/g, '').slice(0, 100) : null;
      saveLS('nickname', sanitizedNick);
      if (sanitizedEmail) saveLS('ironlog_email', sanitizedEmail);
      useAuthStore.setState({ nickname: sanitizedNick, isLoggedIn: true });
      // 구글 로그인 후 닉네임 설정 단계 — 이전 로그인 실패 메시지 정리
      setError('');
      setNickError('');
      setOauthNick(sanitizedNick);
      setOauthNickStep(true);
    }
    if (err) {
      setError(oauthErrorText(err));
    }
  }, [searchParams, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // 아이디/닉네임 저장
      saveLS('saved_id', email);
      saveLS('saved_nickname', useAuthStore.getState().nickname || '');
      // 자동 로그인
      if (autoLogin) {
        saveLS('auto_login', 'true');
      } else {
        removeLS('auto_login');
      }
      setShowSplash(true);
    } catch (err) {
      setError(err.response?.data?.error || '아이디(이메일) 또는 비밀번호가 틀렸어요');
    } finally {
      setLoading(false);
    }
  };

  // 구글 로그인 후 닉네임 설정 화면
  if (oauthNickStep) {
    const saveOauthNick = async () => {
      const nick = oauthNick.trim();
      if (!nick) { setNickError('닉네임을 입력해주세요'); return; }
      if (nick.length > 30) { setNickError('닉네임은 30자 이하여야 해요'); return; }
      setNickSaving(true);
      setNickError('');
      try {
        await client.put('/auth/nickname', { nickname: nick });
        saveLS('nickname', nick);
        useAuthStore.setState({ nickname: nick });
        toast('닉네임이 저장됐어요!');
        setOauthNickStep(false);
        setShowSplash(true);
      } catch (err) {
        setNickError(err.response?.data?.error || '닉네임 저장에 실패했어요');
      } finally {
        setNickSaving(false);
      }
    };
    return (
      <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: 400, padding: 'var(--padding-x)', textAlign: 'center' }}>
          <h1 className="display-xl" style={{ color: 'var(--accent)', marginBottom: 8 }}>STEEL BODY</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 32 }}>닉네임을 설정해주세요</p>
          <input
            className="input"
            type="text"
            value={oauthNick}
            onChange={(e) => { setOauthNick(e.target.value); setNickError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && saveOauthNick()}
            placeholder="사용할 닉네임"
            maxLength={30}
            autoFocus
            style={{ textAlign: 'center', fontSize: 18, marginBottom: 8 }}
          />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            {oauthNick.length}/30자
          </div>
          {nickError && (
            <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 8 }}>{nickError}</div>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            구글 이름이 기본 설정됩니다. 원하는 닉네임으로 변경하세요.
          </p>
          <button className="btn-primary" onClick={saveOauthNick} disabled={nickSaving} style={{ width: '100%' }}>
            {nickSaving ? '저장 중...' : '시작하기'}
          </button>
          <button
            onClick={() => { setOauthNickStep(false); setShowSplash(true); }}
            style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}
          >
            기본 이름으로 시작
          </button>
        </div>
      </div>
    );
  }

  if (showSplash) {
    return <SplashScreen onDone={() => navigate('/home')} />;
  }

  return (
    <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 'var(--padding-x)' }}>
        <h1 className="display-xl" style={{ textAlign: 'center', color: 'var(--accent)', marginBottom: 8 }}>
          STEEL BODY
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 32 }}>
          당신의 운동을 기록하세요
        </p>

        {/* 소셜 로그인 — 서버가 쓸 수 있다고 한 것만 그린다 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {providers?.google && (
            <button
              onClick={() => startOauth('google')}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '12px 16px',
                border: '1px solid #dadce0', borderRadius: 'var(--radius)',
                background: '#ffffff', color: '#3c4043',
                fontSize: 14, fontWeight: 600, fontFamily: "'Barlow', sans-serif",
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              Google 로 계속하기
            </button>
          )}

          {/* 나머지 셋은 한 줄에 나란히. 세로로 쌓으면 로그인 칸이 화면 밖으로 밀린다 */}
          {(providers?.naver || providers?.facebook || providers?.instagram) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {providers?.naver && (
                <button
                  onClick={() => startOauth('naver')}
                  disabled={loading}
                  style={{
                    flexGrow: 1, padding: '11px 0', border: 'none', borderRadius: 'var(--radius)',
                    background: '#03C75A', color: '#ffffff',
                    fontSize: 13, fontWeight: 700, fontFamily: "'Barlow', sans-serif",
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >네이버</button>
              )}
              {providers?.facebook && (
                <button
                  onClick={() => startOauth('facebook')}
                  disabled={loading}
                  style={{
                    flexGrow: 1, padding: '11px 0', border: 'none', borderRadius: 'var(--radius)',
                    background: '#1877F2', color: '#ffffff',
                    fontSize: 13, fontWeight: 700, fontFamily: "'Barlow', sans-serif",
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >페이스북</button>
              )}
              {providers?.instagram && (
                <button
                  onClick={() => startOauth('instagram')}
                  disabled={loading}
                  style={{
                    flexGrow: 1, padding: '11px 0', border: 'none', borderRadius: 'var(--radius)',
                    background: 'linear-gradient(45deg, #F58529, #DD2A7B, #8134AF)', color: '#ffffff',
                    fontSize: 13, fontWeight: 700, fontFamily: "'Barlow', sans-serif",
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >인스타그램</button>
              )}
            </div>
          )}
        </div>

        {/* 구분선 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 1 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* 닉네임 표시 (이전 로그인 기록 있을 때) */}
        {savedNickname && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>돌아오셨군요!</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, color: 'var(--accent)', marginTop: 4 }}>
              {savedNickname}
            </div>
          </div>
        )}

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} autoComplete="on">
          <label className="label" htmlFor="login-id">아이디 또는 이메일</label>
          <input
            id="login-id"
            name="username"
            autoComplete="username"
            inputMode="email"
            className="input"
            type="text"
            placeholder="아이디 또는 이메일"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
            style={{ marginBottom: 2 }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
            가입 시 설정한 아이디 또는 이메일 주소
          </div>

          <label className="label" htmlFor="login-password">비밀번호</label>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              id="login-password"
              name="password"
              autoComplete="current-password"
              className="input"
              type={showPw ? 'text' : 'password'}
              placeholder="비밀번호"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
              style={{ paddingRight: 40 }}
            />
            <button type="button" onClick={() => setShowPw(!showPw)} aria-label="비밀번호 표시 토글" style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
            }}>{showPw ? '🙈' : '👁'}</button>
          </div>

          {/* 자동 로그인 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoLogin}
              onChange={(e) => setAutoLogin(e.target.checked)}
              style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>자동 로그인</span>
          </label>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>
          )}

          <button className="btn-primary" type="submit" disabled={loading || !email || !password} style={{ marginTop: 8 }}>
            {loading ? '처리 중...' : '로그인'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setShowReset(true)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12,
              cursor: 'pointer', textDecoration: 'underline', padding: 4,
            }}
          >비밀번호를 잊으셨나요?</button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>계정이 없나요? </span>
          <Link to="/register" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>회원가입</Link>
        </div>
      </div>

      {showReset && <PasswordResetModal onClose={() => setShowReset(false)} />}
    </div>
  );
}
