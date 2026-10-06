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
  // ── 메일 인증 ──
  // 주소를 적을 수 있는 것과 그 주소의 주인인 것은 다르다. 적은 주소로 번호를 보내고,
  // 그 번호를 **가입 단추를 누를 때 같이 보낸다**(서버가 가입 받는 자리에서 확인한다)
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [codeInfo, setCodeInfo] = useState('');
  const [codeError, setCodeError] = useState('');
  // 메일이 나갈 수 있는 상태인가. null 은 아직 모른다는 뜻 — 모르는 동안 막으면
  // 되는 서버에서도 가입을 못 한다 (비밀번호 찾기와 같은 판단)
  const [mailReady, setMailReady] = useState(null);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuthStore();

  // 막힌 단추는 누르기 전에 막힌 줄 알려준다 (`PasswordResetModal` 과 같은 길)
  useEffect(() => {
    let alive = true;
    client.get('/auth/mail-status')
      .then(({ data }) => { if (alive) setMailReady(!!data?.canSend); })
      .catch(() => { if (alive) setMailReady(null); });
    return () => { alive = false; };
  }, []);

  // ── 이메일: 형식 검증 + 중복 확인 (debounced) ──
  const validateEmail = (val) => {
    setEmail(val);
    setEmailOk(false);
    setEmailError('');
    if (error) setError('');
    // 주소를 고쳤으면 **앞 주소로 받은 번호는 버린다.** 안 버리면 A 로 번호를 받고
    // B 로 가입하는 모양이 되는데, 서버는 B 의 번호를 보므로 그냥 틀렸다고만 나온다
    if (codeSent || code) { setCodeSent(false); setCode(''); setCodeInfo(''); setCodeError(''); }
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

  const sendCode = async () => {
    setCodeError(''); setCodeInfo(''); setError('');
    if (!emailOk) { setCodeError('먼저 쓸 수 있는 이메일을 입력해주세요'); return; }
    if (mailReady === false) { setCodeError('지금은 메일을 보낼 수 없어요. 관리자에게 문의해주세요'); return; }
    setCodeSending(true);
    try {
      const { data } = await client.post('/auth/send-code', { email: email.trim() });
      setCodeSent(true);
      // 내 컴퓨터(SMTP 없음)에서는 번호가 응답에 실려 온다 — 그때만 화면에 띄운다
      setCodeInfo(data?.code ? `[개발 모드] 인증번호: ${data.code}` : '인증번호를 메일로 보냈어요 (5분 안에 입력)');
    } catch (err) {
      setCodeError(err.response?.data?.error || '인증번호 발송에 실패했어요');
    } finally {
      setCodeSending(false);
    }
  };

  const pwMatch = password && passwordConfirm && password === passwordConfirm;
  const pwMismatch = passwordConfirm && password !== passwordConfirm;
  const pwValid = isValidPw(password);
  const codeOk = codeSent && code.length === 6;
  const canSubmit = usernameOk && nickname.trim() && emailOk && codeOk && pwValid && pwMatch && !loading;

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
    : !codeSent ? '이메일로 인증번호를 받아주세요'
    : code.length !== 6 ? '메일로 받은 6자리 인증번호를 입력하세요'
    : !pwValid ? '비밀번호는 영문+숫자 8자 이상이어야 해요'
    : !pwMatch ? '비밀번호 확인이 일치하지 않아요'
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;

    setLoading(true);
    try {
      await register(email, password, nickname, username, code.trim());
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
    <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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

          {/* ── 이메일 인증번호 ──
              주소 칸이 초록이 된 다음에만 보인다. 형식도 안 맞는 주소에 「인증번호 받기」가
              먼저 떠 있으면, 눌러보고 나서야 안 된다는 말을 듣는다 */}
          {emailOk && (
            <div style={{
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              padding: '12px 12px 10px', marginBottom: 12,
            }}>
              <label className="label" htmlFor="reg-code" style={{ marginBottom: 6 }}>이메일 인증</label>

              {mailReady === false ? (
                <div role="alert" style={{ fontSize: 12.5, color: 'var(--danger)', lineHeight: 1.6 }}>
                  지금은 <strong>메일을 보낼 수 없어요.</strong> 메일 보내기가 아직 연결되지 않아
                  직접 만드는 가입은 잠시 막혀 있습니다 — 위의 <strong>Google 로 가입하기</strong>를
                  쓰시거나 관리자에게 문의해주세요.
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--accent)' }}>{email}</strong> 가 본인 메일인지 확인해요.
                    받은 6자리를 넣어주세요.
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                    <input
                      id="reg-code"
                      name="one-time-code"
                      autoComplete="one-time-code"
                      className="input"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.replace(/\D/g, ''));
                        if (codeError) setCodeError('');
                        if (error) setError('');
                      }}
                      disabled={!codeSent}
                      style={{
                        flex: 1, marginBottom: 0, letterSpacing: 4, textAlign: 'center', fontSize: 17,
                        borderColor: code.length === 6 ? 'var(--success)' : 'var(--border)',
                        opacity: codeSent ? 1 : 0.5,
                      }}
                    />
                    <button
                      type="button"
                      onClick={sendCode}
                      disabled={codeSending}
                      style={{
                        background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)',
                        padding: '0 14px', cursor: codeSending ? 'default' : 'pointer', fontSize: 13,
                        borderRadius: 'var(--radius)', whiteSpace: 'nowrap',
                        fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", letterSpacing: 1.2,
                        opacity: codeSending ? 0.6 : 1,
                      }}
                    >{codeSending ? '발송 중...' : codeSent ? '다시 받기' : '인증번호 받기'}</button>
                  </div>
                  {codeInfo && (
                    <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 8, lineHeight: 1.5 }}>{codeInfo}</div>
                  )}
                  {codeError && (
                    <div role="alert" style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{codeError}</div>
                  )}
                </>
              )}
            </div>
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
