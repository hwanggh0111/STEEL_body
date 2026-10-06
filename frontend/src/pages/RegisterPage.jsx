import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import client from '../api/client';
import Logo from '../components/Logo';
import { toast } from '../components/Toast';
import SocialLoginButtons from '../components/SocialLoginButtons';
import { saveLS } from '../data/safeStorage';

// 가입 — 다시 짰다 (2026-10-06).
//
// ── 왜 ──
//
// 앱에서 **리메이크를 한 번도 안 한 화면이 둘**이었다. 로그인과 이 화면이다.
// 10/2 에 메일 인증, 10/5 에 소셜 가입을 **덧붙이기만** 해서, 경계는 그대로 두고
// 안쪽만 늘었다 — 한 화면에 칸 여섯(아이디 · 닉네임 · 이메일 · 인증번호 ·
// 비밀번호 · 비밀번호 확인)에 `useState` 가 스물하나였다.
//
// 처음 온 사람이 **자기가 뭘 해야 끝나는지** 모른다. 칸 여섯이 한꺼번에 보이는데
// 그중 둘은 서버에 물어봐야 채워지고, 어디까지 왔는지도 안 보인다. 폰에서 열면
// 자판이 올라와 화면의 절반을 덮는다.
//
// ── 두 걸음으로 나눈다 ──
//
// **왕복이 생기는 자리에서만 끊는다.**
//
//   1걸음 **메일 확인** — 이메일 · 인증번호
//   2걸음 **계정 만들기** — 이름 · 아이디 · 비밀번호
//
// 메일이 유일하게 「기다려야 하는」 자리다. 그리고 **거기서 막히면 뒤 칸을 채운
// 것이 다 헛수고가 된다.** 그래서 그것만 앞으로 뺀다. 나머지 셋은 혼자서 바로
// 채우는 것이라 한 화면에 둬도 막히지 않는다 — 걸음을 더 나누면 화면 전환만 늘고
// 뒤로 가기를 그만큼 더 만들어야 한다.
//
// **서버는 받는 것이 그대로다** — `email + password + nickname + username + code`.
// 바뀐 것은 사람이 한 번에 보는 양이다. 화면을 다시 짜는 일과 데이터를 다시 짜는
// 일은 다른 일이다.
//
// ── 1걸음에서 번호가 맞는지 **말해준다** ──
//
// 앞서는 번호를 **가입할 때** 한 번만 봤다. 걸음만 나누고 확인을 미루면, 2걸음의
// 칸을 다 채운 **마지막에** 「번호가 틀렸어요」가 뜬다 — 걸음을 나눈 까닭이 바로
// 그 헛수고를 없애려는 것인데 그대로 남는다. 그래서 번호만 보는 자리를 서버에
// 더했다(`POST /auth/verify-code`). 번호를 지우지 않으므로 가입 때 또 본다.
//
// 그 과정에서 **맞은 번호가 시도 횟수를 깎고 있던 것**도 고쳤다 (`checkCode`).
//
// ── 아이디를 없애지 않는다 ──
//
// 서버가 필수로 받고, 이미 아이디로 로그인하는 사람이 있다. 대신 **메일 앞부분으로
// 미리 채워주고 고칠 수 있게** 둔다 — 「아이디를 또 생각해내야 하는」 자리가 없어진다.
//
// ── 비밀번호 확인 칸을 뺐다 ──
//
// 「보기」 단추가 이미 있다. 두 번 적게 하는 것은 **같은 일을 두 벌로 시키는 것**이다 —
// 틀렸는지 보려면 눈으로 보면 된다.
//
// ── 줄어든 것은 상태가 아니다 ──
//
// 솔직히 적어둔다. `useState` 는 **21개에서 22개로 늘었다** — `passwordConfirm` 이
// 없어졌지만 걸음(`step`)과 확인 중(`verifying`)이 생겼다. 줄어든 것은
// **사람이 한 번에 보는 칸**이다: 여섯에서 **둘 → 셋**으로.
//
// 상태 수는 이 화면의 문제가 아니었다. 문제는 처음 온 사람이 칸 여섯을 한꺼번에
// 보면서 **자기가 뭘 해야 끝나는지 모르는 것**이었다.

// 백엔드와 동일한 비밀번호 정책
const PW_MIN = 8;
const PW_MAX = 100;
const isValidPw = (pw) => pw.length >= PW_MIN && pw.length <= PW_MAX && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);

/**
 * 메일 앞부분 → 쓸 만한 아이디.
 *
 * 서버 규칙은 `영문+숫자+!@#$%^&*._-` 4~20자다. 메일 앞부분에는 점과 밑줄이
 * 흔히 들어가는데 그건 그대로 쓸 수 있다. 4자가 안 되면 **제안하지 않는다** —
 * 못 쓸 것을 채워두면 사람이 그것을 고치는 일부터 해야 한다.
 */
function suggestUsername(email) {
  const head = String(email || '').split('@')[0].toLowerCase();
  const cleaned = head.replace(/[^a-z0-9._-]/g, '');
  return cleaned.length >= 4 ? cleaned.slice(0, 20) : '';
}

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

  // ── 걸음은 **주소가 들고 있다** ── (2026-10-06, 같은 날 고쳤다)
  //
  // 오늘 이 화면을 두 걸음으로 나눌 때 `useState('mail')` 로 짰다. **그게 구멍이었다.**
  //
  // 폰에서 2걸음에 서서 「어, 메일을 잘못 적었나」 하고 **뒤로를 누르면 1걸음이
  // 아니라 가입 화면을 통째로 나간다** — 적은 것이 다 사라진다. 「고치기」 단추를
  // 뒀지만 사람은 뒤로를 누른다. 그게 폰에서 뒤로의 뜻이기 때문이다.
  //
  // 그래서 걸음을 주소에 남긴다(`?step=account`). **갈래와 반대로 히스토리를 쌓는다** —
  // 오늘 몸·기록·루틴의 갈래는 `replace` 로 뒀는데(갈래마다 쌓으면 화면을 나가려고
  // 다섯 번 눌러야 한다), **걸음은 되돌아가는 것이 자연스럽다.** 1걸음은 2걸음의
  // 앞이지 옆이 아니다.
  //
  // ── 새로고침은 1걸음으로 되돌린다 ──
  //
  // 주소에 `step=account` 가 남아 있어도 **메일 확인은 화면의 상태**다(`code` ·
  // `emailOk`). 새로고침하면 그것이 사라지므로, 주소만 믿고 2걸음을 그리면
  // **아무것도 확인되지 않은 2걸음**이 뜬다 — 거기서 저장을 누르면 서버가
  // 「인증번호를 먼저 발송해주세요」로 거절한다. 그래서 상태가 없으면 되돌린다.
  const [params, setParams] = useSearchParams();
  const step = params.get('step') === 'account' ? 'account' : 'mail';
  const setStep = (next) => {
    const p = new URLSearchParams(params);
    // 1걸음은 주소에 안 적는다 — `/register` 와 `/register?step=mail` 이 같은 화면이다
    if (next === 'mail') p.delete('step');
    else p.set('step', next);
    // **쌓는다**(replace 아님) — 뒤로가 걸음을 되돌려야 한다
    setParams(p);
  };

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
  // **1걸음에서 그 번호가 맞는지 확인한 뒤** 2걸음으로 넘어간다. 가입할 때도 같이
  // 보내므로 서버가 한 번 더 본다
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [codeInfo, setCodeInfo] = useState('');
  const [codeError, setCodeError] = useState('');
  const [verifying, setVerifying] = useState(false);
  // 메일이 나갈 수 있는 상태인가. null 은 아직 모른다는 뜻 — 모르는 동안 막으면
  // 되는 서버에서도 가입을 못 한다 (비밀번호 찾기와 같은 판단)
  const [mailReady, setMailReady] = useState(null);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuthStore();

  // 주소에 `step=account` 가 남아 있는데 **메일 확인이 안 돼 있으면** 1걸음으로
  // 되돌린다 (위 주석 참고). 새로고침이나 북마크로 바로 들어온 길이다.
  //
  // `replace` 로 되돌린다 — 쌓으면 뒤로가 **못 쓰는 2걸음으로** 데려온다.
  // 아무 말 없이 되돌리지 않는다: 왜 1걸음인지 한 줄 적는다
  const [bounced, setBounced] = useState(false);
  useEffect(() => {
    if (step !== 'account') return;
    if (emailOk && code.length === 6) return;
    const p = new URLSearchParams(params);
    p.delete('step');
    setParams(p, { replace: true });
    setBounced(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, emailOk, code]);

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

  // ── 1걸음 끝 — 번호가 맞는지 **지금** 본다 ──
  //
  // 여기서 안 보고 넘기면 2걸음의 칸을 다 채운 마지막에 틀렸다는 말을 듣는다.
  // 넘어가면서 **아이디를 메일 앞부분으로 채워준다** — 2걸음에서 할 일이 그만큼 줄고,
  // 중복 확인도 그 자리에서 같이 돈다.
  const verifyAndNext = async () => {
    setCodeError(''); setError('');
    if (code.length !== 6) { setCodeError('메일로 받은 6자리를 넣어주세요'); return; }
    setVerifying(true);
    try {
      await client.post('/auth/verify-code', { email: email.trim(), code: code.trim() });
      const guess = suggestUsername(email);
      if (guess && !username) updateUsernameHint(guess);
      setStep('account');
    } catch (err) {
      setCodeError(err.response?.data?.error || '인증번호를 확인하지 못했어요');
    } finally {
      setVerifying(false);
    }
  };

  // 메일을 고치러 1걸음으로 돌아간다. **번호는 그대로 둔다** — 주소를 실제로
  // 고치면 `validateEmail` 이 버린다. 돌아왔다가 그냥 다시 넘어오는 길을 막지 않는다
  const backToMail = () => { setError(''); setStep('mail'); };

  const pwValid = isValidPw(password);
  const canSubmit = usernameOk && nickname.trim() && emailOk && code.length === 6 && pwValid && !loading;

  // 버튼이 왜 안 눌리는지 화면에 알려준다. 회색으로 죽어 있기만 하면
  // 무엇이 남았는지 알 방법이 없다
  const blockReason = loading ? null
    : !nickname.trim() ? '뭐라고 부를지 적어주세요'
    : !username.trim() ? '아이디를 입력하세요'
    : usernameChecking ? '아이디를 확인하는 중이에요'
    : !usernameOk ? '아이디를 확인하는 중이거나 쓸 수 없는 아이디예요'
    : !pwValid ? `비밀번호는 영문+숫자 ${PW_MIN}자 이상이어야 해요`
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
      // 번호가 틀렸거나 식었으면 **1걸음으로 돌려보낸다.** 2걸음에 머물면
      // 고칠 칸이 화면에 없는 잘못을 보여주는 셈이 된다
      const msg = err.response?.data?.error || '회원가입에 실패했어요';
      if (/인증번호|시도 횟수/.test(msg)) {
        setStep('mail');
        setCodeError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── 걸음 자 ──
  //
  // **얼마나 남았는지**를 말한다. 「1 / 2」라는 글자와 막대 둘뿐이다 —
  // 걸음이 둘일 때 동그라미와 선으로 그린 길을 그리면 그림이 말보다 커진다.
  const rail = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 5, flexGrow: 1 }}>
        <span style={{
          flex: 1, height: 2, borderRadius: 1,
          background: step === 'mail' ? 'var(--accent)' : 'var(--accent-low)',
        }} />
        <span style={{
          flex: 1, height: 2, borderRadius: 1,
          background: step === 'account' ? 'var(--accent)' : 'var(--bg-tertiary)',
        }} />
      </div>
      <span style={{
        fontSize: 11, letterSpacing: 1.2, color: 'var(--text-muted)', flexShrink: 0,
        fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif",
      }}>
        {step === 'mail' ? '1 / 2 메일 확인' : '2 / 2 계정 만들기'}
      </span>
    </div>
  );

  return (
    <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 'var(--padding-x)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          {/* 처음 보는 자리라 부제까지 편다 */}
          <Logo cap={34} variant="stack" />
        </div>

        {rail}

        {/* ══════════ 1걸음 · 메일 확인 ══════════ */}
        {step === 'mail' && (
          <>
            {/* 소셜로 들어오면 계정이 저절로 만들어진다 — **제일 빠른 길이라 맨 위에
                둔다.** 예전에는 이 자리가 비어 있어서, 구글로 가입하려면 「로그인」
                쪽으로 가야 한다는 걸 알아내야 했다 */}
            <SocialLoginButtons disabled={codeSending || verifying} googleLabel="Google 로 가입하기" />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
              <div style={{ flexGrow: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>또는 메일로 만들기</span>
              <div style={{ flexGrow: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* 새로고침으로 되돌아온 사람에게 **왜 처음인지** 말한다.
                아무 말 없이 1걸음을 보여주면 적은 것이 그냥 사라진 것으로 보인다 */}
            {bounced && (
              <div role="status" style={{
                border: '1px solid var(--border-hover)', borderRadius: 'var(--radius)',
                background: 'var(--bg-secondary)', padding: '10px 12px', marginBottom: 14,
                fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7,
              }}>
                메일 확인부터 다시 해주세요 — 화면을 새로 열면 받은 번호는 남지 않아요.
                <strong style={{ color: 'var(--text-primary)' }}> 가입은 아직 안 됐습니다.</strong>
              </div>
            )}

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
                marginBottom: 4,
                borderColor: email
                  ? (emailError ? 'var(--danger)' : emailOk ? 'var(--success)' : 'var(--border)')
                  : 'var(--border)',
              }}
            />
            {emailChecking && (
              <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--text-muted)' }}>중복 확인 중...</div>
            )}
            {!emailChecking && emailError && (
              <div role="alert" style={{ fontSize: 12, marginBottom: 12, color: 'var(--danger)' }}>{emailError}</div>
            )}
            {!emailChecking && !emailError && emailOk && (
              <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--success)' }}>사용 가능한 이메일이에요</div>
            )}
            {!emailChecking && !emailError && !emailOk && (
              <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--text-muted)' }}>
                여기로 번호를 보냅니다
              </div>
            )}

            {/* 주소 칸이 초록이 된 다음에만 보인다. 형식도 안 맞는 주소에
                「인증번호 받기」가 먼저 떠 있으면, 눌러보고 나서야 안 된다는 말을 듣는다 */}
            {emailOk && mailReady === false && (
              <div role="alert" style={{
                border: '1px solid var(--danger)', borderRadius: 'var(--radius)',
                padding: '12px 13px', fontSize: 12.5, color: 'var(--danger)', lineHeight: 1.7,
              }}>
                지금은 <strong>메일을 보낼 수 없어요.</strong> 메일 보내기가 아직 연결되지 않아
                직접 만드는 가입은 잠시 막혀 있습니다 — 위의 <strong>Google 로 가입하기</strong>를
                쓰시거나 관리자에게 문의해주세요.
              </div>
            )}

            {emailOk && mailReady !== false && (
              <>
                {!codeSent ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={sendCode}
                    disabled={codeSending}
                  >{codeSending ? '보내는 중...' : '번호 받기'}</button>
                ) : (
                  <>
                    <label className="label" htmlFor="reg-code">메일로 온 번호</label>
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
                      style={{
                        marginBottom: 8, letterSpacing: 6, textAlign: 'center', fontSize: 19,
                        borderColor: code.length === 6 ? 'var(--success)' : 'var(--border)',
                      }}
                    />
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--accent)' }}>{email}</strong> 로 보냈어요.
                      안 왔으면{' '}
                      <button
                        type="button"
                        onClick={sendCode}
                        disabled={codeSending}
                        style={{
                          background: 'none', border: 'none', padding: 0, font: 'inherit',
                          color: 'var(--accent)', cursor: codeSending ? 'default' : 'pointer',
                          textDecoration: 'underline',
                        }}
                      >{codeSending ? '보내는 중...' : '다시 보내기'}</button>
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={verifyAndNext}
                      disabled={verifying || code.length !== 6}
                    >{verifying ? '확인 중...' : '확인하고 다음'}</button>
                    {!verifying && code.length !== 6 && (
                      <div style={{ marginTop: 6, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                        6자리를 다 넣어주세요
                      </div>
                    )}
                  </>
                )}
                {codeInfo && (
                  <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 10, lineHeight: 1.5 }}>{codeInfo}</div>
                )}
                {codeError && (
                  <div role="alert" style={{ fontSize: 12, color: 'var(--danger)', marginTop: 10 }}>{codeError}</div>
                )}
              </>
            )}
          </>
        )}

        {/* ══════════ 2걸음 · 계정 만들기 ══════════ */}
        {step === 'account' && (
          <form onSubmit={handleSubmit} autoComplete="on">
            {/* 확인이 끝난 주소. **고치는 길을 같이 둔다** — 주소를 잘못 적은 것이
                여기서 보이는데 돌아갈 길이 없으면 처음부터 다시 해야 한다 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18,
              border: '1px solid var(--success)', borderRadius: 'var(--radius)',
              background: 'var(--bg-secondary)', padding: '9px 11px',
            }}>
              <span style={{ fontSize: 12, color: 'var(--success)', flexShrink: 0 }}>확인됨</span>
              <span style={{
                fontSize: 12.5, color: 'var(--text-primary)', minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{email}</span>
              <button
                type="button"
                onClick={backToMail}
                style={{
                  marginLeft: 'auto', flexShrink: 0, background: 'none', border: 'none',
                  padding: 0, font: 'inherit', fontSize: 11.5, color: 'var(--accent-low)',
                  cursor: 'pointer', textDecoration: 'underline',
                }}
              >고치기</button>
            </div>

            {/* 닉네임이 먼저다 — **온 앱에 나오는 이름**이고, 사람이 가장 쉽게
                답하는 질문이다. 「닉네임」이라는 말 대신 묻는 말로 적는다 */}
            <label className="label" htmlFor="reg-nickname">뭐라고 부를까요</label>
            <input
              id="reg-nickname"
              name="nickname"
              autoComplete="nickname"
              className="input"
              type="text"
              placeholder="앱에서 쓸 이름"
              value={nickname}
              onChange={(e) => { setNickname(e.target.value); if (error) setError(''); }}
              maxLength={30}
              style={{ marginBottom: 14 }}
            />

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
              <div style={{ fontSize: 12, marginBottom: 14, color: 'var(--text-muted)' }}>중복 확인 중...</div>
            )}
            {!usernameChecking && usernameMsg && (
              <div style={{ fontSize: 12, marginBottom: 14, color: usernameOk ? 'var(--success)' : 'var(--danger)' }}>
                {usernameMsg}
              </div>
            )}
            {!usernameChecking && !usernameMsg && usernameHint && (
              <div style={{ fontSize: 12, marginBottom: 14, color: 'var(--text-muted)' }}>{usernameHint}</div>
            )}
            {/* 메일 앞부분으로 채워준 것이면 그렇다고 말한다 — 안 말하면
                「내가 안 적었는데 왜 적혀 있지」가 된다 */}
            {!usernameChecking && !usernameMsg && !usernameHint && (
              <div style={{ fontSize: 12, marginBottom: 14, color: 'var(--text-muted)' }}>
                {username && username === suggestUsername(email)
                  ? '메일 앞부분으로 채웠어요 · 고쳐도 됩니다'
                  : '로그인할 때 쓰는 이름이에요'}
              </div>
            )}

            <label className="label" htmlFor="reg-password">비밀번호</label>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input
                id="reg-password"
                name="new-password"
                autoComplete="new-password"
                className="input"
                type={showPw ? 'text' : 'password'}
                placeholder={`영문+숫자 ${PW_MIN}자 이상`}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                maxLength={PW_MAX}
                style={{ paddingRight: 56, marginBottom: 0 }}
              />
              {/* 「확인」 칸을 뺐으니 **이 단추가 그 일을 한다.** 눈으로 보고 넘긴다 */}
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
              <div style={{ fontSize: 12, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
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
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              {password && !pwValid
                ? `영문+숫자 조합 ${PW_MIN}자 이상 필수`
                : '한 번만 적습니다 · 「보기」로 확인하세요'}
            </div>

            {error && (
              <div role="alert" style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>
            )}

            <button className="btn-primary" type="submit" disabled={!canSubmit}>
              {loading ? '처리 중...' : '시작하기'}
            </button>
            {blockReason && (
              <div style={{ marginTop: 6, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                {blockReason}
              </div>
            )}
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>이미 계정이 있나요? </span>
          <Link to="/login" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>로그인</Link>
        </div>
      </div>
    </div>
  );
}
