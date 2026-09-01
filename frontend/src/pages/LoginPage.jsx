import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { toast } from '../components/Toast';
import SocialLoginButtons from '../components/SocialLoginButtons';
import SplashScreen from '../components/SplashScreen';
import PasswordResetModal from '../components/PasswordResetModal';
import client from '../api/client';
import Logo from '../components/Logo';
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
  // 계정 삭제를 막 예약하고 여기로 온 경우. 언제까지 되살릴 수 있는지 적어준다 —
  // 「예약됐습니다」만 띄우고 보내면 며칠이 남았는지 알 길이 없다
  const deleted = useLocation().state?.deleted;
  const [searchParams] = useSearchParams();

  // 세션 만료 알림
  useEffect(() => {
    if (readLS('session_expired')) {
      removeLS('session_expired');
      toast('세션이 만료되었어요. 다시 로그인해주세요.', 'warning');
    }
  }, []);

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
      const res = await login(email, password);
      // 지우기로 해뒀던 계정으로 다시 들어온 사람. 아무 말도 안 하면 **지워졌는지
      // 살아 있는지 모르는 채로** 앱을 쓰게 된다 — 되살아났다고 분명히 말한다
      if (res?.restored) toast.success('계정이 되살아났어요. 삭제 예약이 취소됐습니다');
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
          <Logo cap={24} variant="stack" style={{ marginBottom: 14 }} />
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

  // 돌아온 사람인가.
  //
  // 예전에는 누구에게나 **소셜 버튼 넷이 먼저**였고, 아이디·비밀번호는 「OR」 아래였다.
  // 「돌아오셨군요! 근호」라는 인사도 그 아래에 파묻혀서, 늘 쓰던 사람이 매번
  // 소셜 넷을 지나 아래로 내려가야 했다.
  //
  // 전에 들어온 적이 있으면 **쓰던 길을 위로** 올린다. 처음 온 사람에게는 소셜이
  // 위다 — 가입까지 한 번에 끝나기 때문이다. 없애는 것은 없고 순서만 바꾼다.
  const returning = !!savedNickname || !!email;

  const social = <SocialLoginButtons disabled={loading} />;
  const divider = (label) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, marginTop: label === 'OR' ? 0 : 24 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: 1 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );

  const blockReason = !email ? '아이디 또는 이메일을 적어주세요'
    : !password ? '비밀번호를 적어주세요'
      : '';

  return (
    <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 'var(--padding-x)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          {/* 처음 보는 자리라 부제까지 편다 — 이 앱이 무엇인지 한 줄로 말해준다 */}
          <Logo cap={26} variant="stack" />
        </div>

        {deleted && (
          <div style={{
            border: '1px solid var(--danger)', borderRadius: 'var(--radius)',
            background: 'var(--bg-secondary)', padding: '13px 15px', marginBottom: 18,
            fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.8,
          }}>
            <b style={{ color: 'var(--text-primary)' }}>계정 삭제를 예약했어요.</b><br />
            {String(deleted.delete_due_at || '').slice(0, 10)} 까지는 <b style={{ color: 'var(--accent)' }}>다시 로그인만 하시면
            그대로 되살아납니다.</b> 그 뒤에는 기록이 전부 지워지고 되돌릴 수 없어요.
          </div>
        )}
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: returning ? 24 : 32 }}>
          당신의 운동을 기록하세요
        </p>

        {/* 인사는 폼 바로 위에. 예전에는 소셜 버튼 넷 아래에 있었다 */}
        {savedNickname && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>돌아오셨군요!</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, color: 'var(--accent)', marginTop: 4 }}>
              {savedNickname}
            </div>
          </div>
        )}

        {!returning && (
          <>
            {social}
            {divider('OR')}
          </>
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
            {/* 🙈 / 👁 은 지금 보이는 상태를 말하는지 누르면 될 상태를 말하는지가
                사람마다 반대로 읽힌다. 누르면 무엇이 되는지를 글자로 적는다 */}
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: 12, padding: 4,
              }}
            >{showPw ? '숨기기' : '보기'}</button>
          </div>

          {/* 자동 로그인 — 켜면 이 기기에 남는다는 말을 적어둔다.
              체크박스 이름만으로는 공용 기기에서 켜도 되는지 알 수 없다 */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoLogin}
              onChange={(e) => setAutoLogin(e.target.checked)}
              style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
            />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)' }}>자동 로그인</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
                다음부터 이 기기에서는 바로 들어옵니다. 공용 기기에서는 꺼주세요.
              </span>
            </span>
          </label>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>
          )}

          <button className="btn-primary" type="submit" disabled={loading || !email || !password} style={{ marginTop: 8 }}>
            {loading ? '처리 중...' : '로그인'}
          </button>
          {/* 왜 안 눌리는지 적는다 — 죽어 있는 단추만 보고 이유를 짐작하게 두지 않는다 */}
          {blockReason && !loading && (
            <div style={{ marginTop: 6, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              {blockReason}
            </div>
          )}
        </form>

        {returning && (
          <>
            {divider('다른 방법으로')}
            {social}
          </>
        )}

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
