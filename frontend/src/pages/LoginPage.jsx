import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Toast, { toast } from '../components/Toast';
import SplashScreen from '../components/SplashScreen';

const API_URL = import.meta.env.VITE_API_URL || '/api';
// 백엔드 URL (OAuth 리다이렉트용)
const BACKEND_BASE = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL.replace(/\/api$/, '');
import client from '../api/client';

export default function LoginPage() {
  const [email, setEmail] = useState(localStorage.getItem('saved_id') || '');
  const [password, setPassword] = useState('');
  const [savedNickname, setSavedNickname] = useState(localStorage.getItem('saved_nickname') || '');
  const [autoLogin, setAutoLogin] = useState(!!localStorage.getItem('auto_login'));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [oauthNickStep, setOauthNickStep] = useState(false);
  const [oauthNick, setOauthNick] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleGoogleLogin = () => {
    window.location.href = `${BACKEND_BASE}/api/oauth/google`;
  };

  // 자동 로그인 (쿠키 기반 + /auth/me 검증)
  useEffect(() => {
    if (autoLogin) {
      // 쿠키 또는 localStorage 토큰이 있으면 서버에 검증
      const hasCookie = document.cookie.includes('sb_csrf=');
      const hasToken = !!localStorage.getItem('token');
      if (hasCookie || hasToken) {
        client.get('/auth/me').then(() => {
          setShowSplash(true);
        }).catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('auto_login');
        });
      }
    }
  }, []);

  // OAuth 콜백 처리 (쿠키 기반 — 서버가 httpOnly 쿠키를 설정해서 리다이렉트)
  useEffect(() => {
    const oauthSuccess = searchParams.get('oauth');
    const nick = searchParams.get('nickname');
    const emailParam = searchParams.get('email');
    const err = searchParams.get('error');

    if (oauthSuccess === 'success' && nick) {
      const sanitizedNick = nick.replace(/[<>"'&`\\\/\(\)\[\]\{\}]/g, '').slice(0, 30);
      const sanitizedEmail = emailParam ? emailParam.replace(/[<>"'&`]/g, '').slice(0, 100) : null;
      localStorage.setItem('nickname', sanitizedNick);
      if (sanitizedEmail) localStorage.setItem('ironlog_email', sanitizedEmail);
      useAuthStore.setState({ nickname: sanitizedNick, isLoggedIn: true });
      // 구글 로그인 후 닉네임 설정 단계
      setOauthNick(sanitizedNick);
      setOauthNickStep(true);
    }
    if (err) {
      setError('소셜 로그인에 실패했어요. 다시 시도해주세요.');
    }
  }, [searchParams, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // 아이디/닉네임 저장
      localStorage.setItem('saved_id', email);
      localStorage.setItem('saved_nickname', useAuthStore.getState().nickname || '');
      // 자동 로그인
      if (autoLogin) {
        localStorage.setItem('auto_login', 'true');
      } else {
        localStorage.removeItem('auto_login');
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
    const [nickSaving, setNickSaving] = useState(false);
    const [nickError, setNickError] = useState('');
    const saveOauthNick = async () => {
      const nick = oauthNick.trim();
      if (!nick) { setNickError('닉네임을 입력해주세요'); return; }
      if (nick.length > 30) { setNickError('닉네임은 30자 이하여야 해요'); return; }
      setNickSaving(true);
      setNickError('');
      try {
        await client.put('/auth/nickname', { nickname: nick });
        localStorage.setItem('nickname', nick);
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

        {/* Google 로그인 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #333',
              borderRadius: 'var(--radius)',
              background: '#ffffff',
              color: '#333',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'Barlow', sans-serif",
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Google으로 로그인
          </button>
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
        <form onSubmit={handleSubmit}>
          <label className="label">아이디 또는 이메일</label>
          <input
            className="input"
            type="text"
            placeholder="username 또는 user@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginBottom: 2 }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
            가입 시 설정한 아이디 또는 이메일 주소
          </div>

          <label className="label">비밀번호</label>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              className="input"
              type={showPw ? 'text' : 'password'}
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: 40 }}
            />
            <button type="button" onClick={() => setShowPw(!showPw)} style={{
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

          <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? '처리 중...' : '로그인'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>계정이 없나요? </span>
          <Link to="/register" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>회원가입</Link>
        </div>
      </div>
      <Toast />
    </div>
  );
}
