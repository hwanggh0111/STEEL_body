import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import client from '../api/client';
import { toast } from '../components/Toast';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [usernameOk, setUsernameOk] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [usernameHint, setUsernameHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuthStore();
  const navigate = useNavigate();

  // Email validation
  const validateEmail = (val) => {
    setEmail(val);
    if (!val) { setEmailError(''); return; }
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    setEmailError(valid ? '' : '올바른 이메일 형식이 아닙니다');
  };

  // Password strength
  const getPasswordStrength = () => {
    if (!password) return null;
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { label: '약함', color: 'var(--danger)' };
    if (score <= 3) return { label: '보통', color: 'var(--warning)' };
    return { label: '강함', color: 'var(--success)' };
  };
  const pwStrength = getPasswordStrength();

  // Username hint
  const updateUsernameHint = (val) => {
    setUsername(val.toLowerCase());
    setUsernameOk(false);
    setUsernameMsg('');
    if (!val) { setUsernameHint(''); return; }
    if (val.length < 4) { setUsernameHint('4자 이상 입력해주세요'); return; }
    if (val.length > 20) { setUsernameHint('20자 이하로 입력해주세요'); return; }
    if (!/^[a-zA-Z0-9!@#$%^&*._-]+$/.test(val)) { setUsernameHint('영문, 숫자, 특수문자(!@#$%^&*._-)만 가능'); return; }
    setUsernameHint('중복확인 버튼을 눌러주세요');
  };

  const pwMatch = password && passwordConfirm && password === passwordConfirm;
  const pwMismatch = passwordConfirm && password !== passwordConfirm;
  const canSubmit = usernameOk && nickname.trim() && email && password.length >= 6 && pwMatch;

  // 아이디 중복 확인
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;

    setLoading(true);
    try {
      await register(email, password, nickname, username);
      localStorage.setItem('saved_nickname', nickname);
      localStorage.setItem('saved_id', email);
      toast('회원가입 완료!');
      setTimeout(() => navigate('/login'), 1000);
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

        <form onSubmit={handleSubmit}>
          {/* 아이디 */}
          <label className="label">아이디</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <input
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
              disabled={usernameOk}
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
          <label className="label">닉네임</label>
          <input
            className="input"
            type="text"
            placeholder="사용할 닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            style={{ marginBottom: 12 }}
          />

          {/* 이메일 */}
          <label className="label">이메일</label>
          <input
            className="input"
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => validateEmail(e.target.value)}
            style={{
              marginBottom: emailError ? 4 : 12,
              borderColor: email ? (emailError ? 'var(--danger)' : 'var(--success)') : 'var(--border)',
            }}
          />
          {emailError && (
            <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--danger)' }}>{emailError}</div>
          )}

          {/* 비밀번호 */}
          <label className="label">비밀번호</label>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              className="input"
              type={showPw ? 'text' : 'password'}
              placeholder="6자 이상"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: 40 }}
            />
            <button type="button" onClick={() => setShowPw(!showPw)} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
            }}>{showPw ? '🙈' : '👁'}</button>
          </div>
          {pwStrength && (
            <div style={{ fontSize: 12, marginBottom: 4, marginTop: -8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)' }}>
                <div style={{
                  height: '100%', borderRadius: 2, background: pwStrength.color,
                  width: pwStrength.label === '약함' ? '33%' : pwStrength.label === '보통' ? '66%' : '100%',
                  transition: 'width 0.2s, background 0.2s',
                }} />
              </div>
              <span style={{ color: pwStrength.color, whiteSpace: 'nowrap' }}>{pwStrength.label}</span>
            </div>
          )}

          {/* 비밀번호 확인 */}
          <label className="label">비밀번호 확인</label>
          <input
            className="input"
            type={showPw ? 'text' : 'password'}
            placeholder="비밀번호 다시 입력"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
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

          <button className="btn-primary" type="submit" disabled={loading || !canSubmit} style={{ marginTop: 4 }}>
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
