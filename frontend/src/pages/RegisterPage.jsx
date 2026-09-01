import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import client from '../api/client';
import Logo from '../components/Logo';
import { toast } from '../components/Toast';
import SocialLoginButtons from '../components/SocialLoginButtons';
import { saveLS } from '../data/safeStorage';

// 백엔드와 동일한 비밀번호 정책
const PW_MIN = 8;
const PW_MAX = 100;
const isValidPw = (pw) => pw.length >= PW_MIN && pw.length <= PW_MAX && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);

export default function RegisterPage() {
  const navigate = useNavigate();
  const navTimerRef = useRef(null);
  const emailCheckTimerRef = useRef(null);
  const usernameCheckTimerRef = useRef(null);
  useEffect(() => () => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
    if (emailCheckTimerRef.current) clearTimeout(emailCheckTimerRef.current);
    if (usernameCheckTimerRef.current) clearTimeout(usernameCheckTimerRef.current);
  }, []);

  const [username, setUsername] = useState('');
  const [usernameOk, setUsernameOk] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState('');
  const [usernameHint, setUsernameHint] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
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
  //
  // 같은 화면에서 **이메일은 치는 대로 알아서 확인**하는데 아이디만 「중복확인」 단추를
  // 눌러야 했다. 안 누르면 가입 단추가 영영 안 눌렸고, 그것 하나 때문에 「아이디 옆
  // 중복확인을 눌러주세요」라는 안내를 따로 적어둬야 했다.
  //
  // 안내로 메울 것이 아니라 이메일과 같게 만든다 — 치면 알아서 확인한다.
  const updateUsernameHint = (val) => {
    const next = val.toLowerCase();
    setUsername(next);
    setUsernameOk(false);
    setUsernameMsg('');
    if (error) setError('');
    if (usernameCheckTimerRef.current) clearTimeout(usernameCheckTimerRef.current);
    setUsernameChecking(false);

    if (!next) { setUsernameHint(''); return; }
    if (next.length < 4) { setUsernameHint('4자 이상 입력해주세요'); return; }
    if (next.length > 20) { setUsernameHint('20자 이하로 입력해주세요'); return; }
    if (!/^[a-zA-Z0-9!@#$%^&*._-]+$/.test(next)) { setUsernameHint('영문, 숫자, 특수문자(!@#$%^&*._-)만 가능'); return; }

    setUsernameHint('');
    usernameCheckTimerRef.current = setTimeout(async () => {
      setUsernameChecking(true);
      try {
        const { data } = await client.post('/auth/check-username', { username: next });
        setUsernameOk(data.available);
        setUsernameMsg(data.message);
      } catch (err) {
        setUsernameMsg(err.response?.data?.error || '확인 실패');
        setUsernameOk(false);
      } finally {
        setUsernameChecking(false);
      }
    }, 600);
  };

  const pwMatch = password && passwordConfirm && password === passwordConfirm;
  const pwMismatch = passwordConfirm && password !== passwordConfirm;
  const pwValid = isValidPw(password);
  const canSubmit = usernameOk && nickname.trim() && emailOk && pwValid && pwMatch && !loading;

  // 버튼이 왜 안 눌리는지 화면에 알려준다.
  // 조건이 다섯이나 되는데 그동안은 회색으로 죽어 있기만 해서, 특히 "아이디 중복확인"을
  // 누르지 않은 경우 아무 표시 없이 영영 안 눌렸다 — 무엇이 남았는지 알 방법이 없었다.
  const blockReason = loading ? null
    : !username.trim() ? '아이디를 입력하세요'
    : usernameChecking ? '아이디를 확인하는 중이에요'
    : !usernameOk ? '아이디를 확인하는 중이거나 쓸 수 없는 아이디예요'
    : !nickname.trim() ? '닉네임을 입력하세요'
    : !email.trim() ? '이메일을 입력하세요'
    : !emailOk ? '이메일을 확인하는 중이거나 쓸 수 없는 주소예요'
    : !pwValid ? '비밀번호는 영문+숫자 8자 이상이어야 해요'
    : !pwMatch ? '비밀번호 확인이 일치하지 않아요'
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;

    setLoading(true);
    try {
      await register(email, password, nickname, username);
      saveLS('saved_nickname', nickname);
      saveLS('saved_id', email);
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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          {/* 처음 보는 자리라 부제까지 편다 */}
          <Logo cap={34} variant="stack" />
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 32 }}>
          회원가입
        </p>

        {/* 소셜로 들어오면 계정이 저절로 만들어진다. 예전에는 이 자리가 비어 있어서,
            구글로 가입하려면 「로그인」 쪽으로 가야 한다는 걸 알아내야 했다 */}
        <SocialLoginButtons disabled={loading} googleLabel="Google 로 가입하기" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ flexGrow: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>또는 직접 만들기</span>
          <div style={{ flexGrow: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <form onSubmit={handleSubmit} autoComplete="on">
          {/* 아이디 */}
          <label className="label" htmlFor="reg-username">아이디</label>
          <input
            id="reg-username"
            name="username"
            autoComplete="username"
            className="input"
            type="text"
            placeholder="영문+숫자 4~20자"
            value={username}
            onChange={(e) => updateUsernameHint(e.target.value)}
            style={{
              marginBottom: 4,
              borderColor: username
                ? (usernameOk ? 'var(--success)' : usernameMsg ? 'var(--danger)' : 'var(--border)')
                : 'var(--border)',
            }}
          />
          {usernameChecking && (
            <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--text-muted)' }}>중복 확인 중...</div>
          )}
          {!usernameChecking && usernameMsg && (
            <div style={{ fontSize: 12, marginBottom: 8, color: usernameOk ? 'var(--success)' : 'var(--danger)' }}>
              {usernameMsg}
            </div>
          )}
          {!usernameChecking && !usernameMsg && usernameHint && (
            <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--text-muted)' }}>
              {usernameHint}
            </div>
          )}
          {!usernameChecking && !usernameMsg && !usernameHint && <div style={{ marginBottom: 8 }} />}

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
          {blockReason && (
            <div style={{
              marginTop: 6, textAlign: 'center',
              fontSize: 12, color: 'var(--text-muted)',
            }}>
              {blockReason}
            </div>
          )}
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>이미 계정이 있나요? </span>
          <Link to="/login" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>로그인</Link>
        </div>
      </div>
    </div>
  );
}
