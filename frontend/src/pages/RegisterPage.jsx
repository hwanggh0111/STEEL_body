import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import client from '../api/client';
import { toast } from '../components/Toast';

// 백엔드와 동일한 비밀번호 정책
const PW_MIN = 8;
const PW_MAX = 100;
const isValidPw = (pw) => pw.length >= PW_MIN && pw.length <= PW_MAX && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);

export default function RegisterPage() {
  const navigate = useNavigate();
  const navTimerRef = useRef(null);
  const emailCheckTimerRef = useRef(null);
  useEffect(() => () => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
    if (emailCheckTimerRef.current) clearTimeout(emailCheckTimerRef.current);
  }, []);

  const [username, setUsername] = useState('');
  const [usernameOk, setUsernameOk] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState('');
  const [usernameHint, setUsernameHint] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [emailOk, setEmailOk] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailChecking, setEmailChecking] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuthStore();

  // ── 이메일: 형식 검증 + 중복 확인 (debounced) ──
  const validateEmail = (val) => {
    setEmail(val);
    setEmailOk(false);
    setEmailError('');
    if (error) setError('');
    if (emailCheckTimerRef.current) clearTimeout(emailCheckTimerRef.current);
    if (!val) return;
    const formatOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    if (!formatOk) {
      setEmailError('올바른 이메일 형식이 아니에요');
      return;
    }
    // 600ms 후 중복 확인
    emailCheckTimerRef.current = setTimeout(async () => {
      setEmailChecking(true);
      try {
        const { data } = await client.post('/auth/check-email', { email: val });
        setEmailOk(data.available);
        setEmailError(data.available ? '' : data.message);
      } catch (err) {
        setEmailError(err.response?.data?.error || '확인 실패');
      } finally {
        setEmailChecking(false);
      }
    }, 600);
  };

  // ── 비밀번호 강도 (백엔드 정책 기준) ──
  const getPasswordStrength = () => {
    if (!password) return null;
    let score = 0;
    if (password.length >= PW_MIN) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { label: '약함', color: 'var(--danger)', pct: 33 };
    if (score <= 3) return { label: '보통', color: 'var(--warning)', pct: 66 };
    return { label: '강함', color: 'var(--success)', pct: 100 };
  };
  const pwStrength = getPasswordStrength();

  // ── 아이디 ──
  const updateUsernameHint = (val) => {
    setUsername(val.toLowerCase());
    setUsernameOk(false);
    setUsernameMsg('');
    if (error) setError('');
    if (!val) { setUsernameHint(''); return; }
    if (val.length < 4) { setUsernameHint('4자 이상 입력해주세요'); return; }
    if (val.length > 20) { setUsernameHint('20자 이하로 입력해주세요'); return; }
    if (!/^[a-zA-Z0-9!@#$%^&*._-]+$/.test(val)) { setUsernameHint('영문, 숫자, 특수문자(!@#$%^&*._-)만 가능'); return; }
    setUsernameHint('중복확인 버튼을 눌러주세요');
  };

  const checkUsername = async () => {
    if (!username) return;
    if (!/^[a-zA-Z0-9!@#$%^&*._-]{4,20}$/.test(username)) {
      setUsernameMsg('영문+숫자+특수문자 4~20자');
      setUsernameOk(false);
      return;
    }
    try {
      const { data } = await client.post('/auth/check-username', { username });
      setUsernameOk(data.available);
      setUsernameMsg(data.message);
    } catch (err) {
      setUsernameMsg(err.response?.data?.error || '확인 실패');
      setUsernameOk(false);
    }
  };

  const pwMatch = password && passwordConfirm && password === passwordConfirm;
  const pwMismatch = passwordConfirm && password !== passwordConfirm;
  const pwValid = isValidPw(password);
  const canSubmit = usernameOk && nickname.trim() && emailOk && pwValid && pwMatch && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;

    setLoading(true);
    try {
      await register(email, password, nickname, username);
      localStorage.setItem('saved_nickname', nickname);
      localStorage.setItem('saved_id', email);
      toast('회원가입 완료! 자동 로그인됐어요');
      // 자동 로그인 상태 → 홈으로
      navTimerRef.current = setTimeout(() => navigate('/home'), 600);
    } catch (err) {
      setError(err.response?.data?.error || '회원가입에 실패했어요');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 'var(--padding-x)' }}>
        <h1 className="display-xl" style={{ textAlign: 'center', color: 'var(--accent)', marginBottom: 8 }}>
          STEEL BODY
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 32 }}>
          회원가입
        </p>

        <form onSubmit={handleSubmit} autoComplete="on">
          {/* 아이디 */}
          <label className="label" htmlFor="reg-username">아이디</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <input
              id="reg-username"
              name="username"
              autoComplete="username"
              className="input"
              type="text"
              placeholder="영문+숫자 4~20자"
              value={username}
              onChange={(e) => updateUsernameHint(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={checkUsername}
              disabled={usernameOk || !username}
              className="btn-primary"
              style={{
                width: 'auto', padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap',
                background: usernameOk ? 'var(--success)' : undefined,
              }}
            >
              {usernameOk ? '확인완료' : '중복확인'}
            </button>
          </div>
          {usernameMsg && (
            <div style={{ fontSize: 12, marginBottom: 8, color: usernameOk ? 'var(--success)' : 'var(--danger)' }}>
              {usernameMsg}
            </div>
          )}
          {!usernameMsg && usernameHint && (
            <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--text-muted)' }}>
              {usernameHint}
            </div>
          )}
          {!usernameMsg && !usernameHint && <div style={{ marginBottom: 8 }} />}

          {/* 닉네임 */}
          <label className="label" htmlFor="reg-nickname">닉네임</label>
          <input
            id="reg-nickname"
            name="nickname"
            autoComplete="nickname"
            className="input"
            type="text"
            placeholder="사용할 닉네임"
            value={nickname}
            onChange={(e) => { setNickname(e.target.value); if (error) setError(''); }}
            maxLength={30}
            style={{ marginBottom: 12 }}
          />

          {/* 이메일 */}
          <label className="label" htmlFor="reg-email">이메일</label>
          <input
            id="reg-email"
            name="email"
            autoComplete="email"
            inputMode="email"
            className="input"
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => validateEmail(e.target.value)}
            style={{
              marginBottom: emailError || emailOk || emailChecking ? 4 : 12,
              borderColor: email
                ? (emailError ? 'var(--danger)' : emailOk ? 'var(--success)' : 'var(--border)')
                : 'var(--border)',
            }}
          />
          {emailChecking && (
            <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--text-muted)' }}>중복 확인 중...</div>
          )}
          {!emailChecking && emailError && (
            <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--danger)' }}>{emailError}</div>
          )}
          {!emailChecking && !emailError && emailOk && (
            <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--success)' }}>사용 가능한 이메일이에요</div>
          )}

          {/* 비밀번호 */}
          <label className="label" htmlFor="reg-password">비밀번호</label>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              id="reg-password"
              name="new-password"
              autoComplete="new-password"
              className="input"
              type={showPw ? 'text' : 'password'}
              placeholder="영문+숫자 8자 이상"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
              maxLength={PW_MAX}
              style={{ paddingRight: 40 }}
            />
            <button type="button" onClick={() => setShowPw(!showPw)} aria-label="비밀번호 표시 토글" style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
            }}>{showPw ? '🙈' : '👁'}</button>
          </div>
          {pwStrength && (
            <div style={{ fontSize: 12, marginBottom: 4, marginTop: -8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)' }}>
                <div style={{
                  height: '100%', borderRadius: 2, background: pwStrength.color,
                  width: `${pwStrength.pct}%`,
                  transition: 'width 0.2s, background 0.2s',
                }} />
              </div>
              <span style={{ color: pwStrength.color, whiteSpace: 'nowrap' }}>{pwStrength.label}</span>
            </div>
          )}
          {password && !pwValid && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              영문+숫자 조합 {PW_MIN}자 이상 필수
            </div>
          )}

          {/* 비밀번호 확인 */}
          <label className="label" htmlFor="reg-password-confirm">비밀번호 확인</label>
          <input
            id="reg-password-confirm"
            name="new-password-confirm"
            autoComplete="new-password"
            className="input"
            type={showPw ? 'text' : 'password'}
            placeholder="비밀번호 다시 입력"
            value={passwordConfirm}
            onChange={(e) => { setPasswordConfirm(e.target.value); if (error) setError(''); }}
            maxLength={PW_MAX}
            style={{
              marginBottom: 4,
              borderColor: passwordConfirm ? (pwMatch ? 'var(--success)' : 'var(--danger)') : 'var(--border)',
            }}
          />
          {pwMatch && <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--success)' }}>비밀번호가 일치합니다</div>}
          {pwMismatch && <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--danger)' }}>비밀번호가 일치하지 않습니다</div>}
          {!passwordConfirm && <div style={{ marginBottom: 12 }} />}

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>
          )}

          <button className="btn-primary" type="submit" disabled={!canSubmit} style={{ marginTop: 4 }}>
            {loading ? '처리 중...' : '회원가입'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>이미 계정이 있나요? </span>
          <Link to="/login" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>로그인</Link>
        </div>
      </div>
    </div>
  );
}
