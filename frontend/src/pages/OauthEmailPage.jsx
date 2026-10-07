import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import client from '../api/client';
import Logo from '../components/Logo';
import { toast } from '../components/Toast';

// 메일 주소를 받는 걸음 (2026-10-07 · 시안 B안).
//
// ── 왜 이 화면이 있나 ──
//
// **인스타그램과 트위터(X)는 메일 주소를 주지 않는다.** 이 앱이 계정을 잇는 열쇠는
// 이메일 하나다(`emailKey`) — 그래서 그 둘은 그냥 붙일 수가 없다.
//
// 전임 코드는 `ig_<번호>@instagram.com` 을 지어냈다. 계정은 만들어지지만
// **비밀번호 찾기가 영구히 막히고**, 그 사람이 나중에 진짜 메일로 가입하면
// **운동 기록이 두 계정으로 갈라진다.** 그래서 지어내지 않고 한 번 묻는다.
//
// ── 왜 가입 화면으로 보내지 않나 (시안의 A안) ──
//
// 가입 1걸음이 이미 이메일 + 인증번호를 받는다. 그런데 그쪽으로 보내면
// 「**회원가입**」이라고 적힌 화면에 떨어진다 — 인스타로 **들어왔는데** 왜 또
// 가입인지 알 수 없고, 2걸음에서 이름 · 아이디 · 비밀번호를 또 묻는다.
// 소셜로 들어온 사람은 **자기 비밀번호를 모른다**(서버가 난수로 만든다).
// 걸음 하나를 더하는 일인데 가입 전체를 다시 걷게 되는 셈이다.
//
// ── 왜 덮개(모달)가 아닌가 (시안의 C안) ──
//
// 가입을 두 걸음으로 나눈 까닭이 「**폰에서 열면 자판이 화면의 절반을 덮는다**」였다.
// 칸 둘에 단추 하나를 덮개에 넣으면 같은 함정을 다시 밟는다.
//
// ── 묻는 것은 메일 하나뿐이다 ──
//
// 이름은 제공자가 준 것을 쓰고(`@keyboard_gh`), 아이디는 저절로 지어지고
// (`instagram_1a2b3c4d`), 비밀번호는 애초에 안 쓴다. **왜 필요한지도 한 줄 적는다** —
// 「메일 주소를 알려주세요」만 있으면 왜 주는지 모른 채로 적게 된다.
//
// ── 끝나는 자리 ──
//
// 서버(`POST /api/oauth/email`)가 번호를 보고 그때 계정을 만든다. **이미 쓰는
// 메일이면 그 계정으로 들어간다** — 그래야 기록이 안 갈라진다.

const LABEL = {
  instagram: '인스타그램',
  twitter: '트위터(X)',
};

// 제공자 쪽 색을 그대로 쓴다 — 어디로 들어왔는지가 **글자보다 먼저** 읽힌다
const MARK = {
  instagram: { text: 'in', bg: 'linear-gradient(45deg, #f58529, #dd2a7b, #8134af)', fg: '#ffffff' },
  twitter: { text: '𝕏', bg: '#000000', fg: '#ffffff' },
};

export default function OauthEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const provider = params.get('provider') || '';
  const label = LABEL[provider] || '소셜 로그인';
  const mark = MARK[provider] || { text: '·', bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' };
  // 제공자가 준 이름. 서버가 이미 sanitize 해서 보내지만 **주소줄로 오는 값**이라
  // 여기서 한 번 더 깎는다 (가입·로그인 화면이 닉네임을 다루는 것과 같은 모양)
  const who = (params.get('name') || '').replace(/[<>"'&`\\/()[\]{}]/g, '').slice(0, 30);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  // 메일을 보낼 수 있는 자리인가. **누르기 전에** 알려준다 (10/1 에 비밀번호 찾기를
  // 그렇게 고쳤다 — 막힌 것을 눌러보고 나서야 아는 쪽이 틀렸다)
  const [mailReady, setMailReady] = useState(null);
  const codeRef = useRef(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    // 제공자 없이 이 주소를 직접 열면 할 수 있는 일이 없다 — 로그인으로 돌려보낸다
    if (!LABEL[provider]) navigate('/login', { replace: true });
  }, [provider, navigate]);

  useEffect(() => {
    let alive = true;
    client.get('/auth/mail-status')
      .then(({ data }) => { if (alive) setMailReady(data?.canSend !== false); })
      // 못 물어봤으면 막지 않는다 — 눌러보면 서버가 답한다
      .catch(() => { if (alive) setMailReady(true); })
    return () => { alive = false; };
  }, []);

  // 번호 칸이 생기면 **그 칸으로 커서를 옮긴다.** 폰에서 자판이 이미 올라와 있는데
  // 손으로 칸을 다시 짚게 하면 걸음이 하나 더 는다
  useEffect(() => {
    if (sent && codeRef.current) codeRef.current.focus();
  }, [sent]);

  const sendCode = async () => {
    if (!emailOk || sending) return;
    setSending(true);
    setError('');
    try {
      const { data } = await client.post('/auth/send-code', { email: email.trim() });
      setSent(true);
      setInfo(data?.code
        ? `[개발 모드] 인증번호: ${data.code}`
        : '번호를 보냈어요 (5분 안에 입력)');
    } catch (err) {
      setError(err.response?.data?.error || '번호를 보내지 못했어요');
    } finally {
      setSending(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!emailOk || code.length !== 6 || saving) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await client.post('/oauth/email', { email: email.trim(), code });
      useAuthStore.getState().socialLoggedIn({ nickname: data?.nickname, email: data?.email });
      if (data?.restored) toast('계정이 되살아났어요');
      navigate('/home', { replace: true });
    } catch (err) {
      const res = err.response?.data;
      // **다시 로그인부터 해야 하는 경우를 따로 다룬다.** 15분이 지났거나 쪽지가
      // 없는 것이고, 그때 「번호가 틀렸어요」로 뭉개면 번호를 다시 받으러 간다 —
      // 받아서 넣어도 같은 자리에서 또 막힌다
      if (res?.restart) {
        toast('시간이 지났어요. 다시 로그인해주세요');
        navigate('/login', { replace: true });
        return;
      }
      setError(res?.error || '계정을 만들지 못했어요');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 'var(--padding-x)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <Logo cap={34} variant="stack" />
        </div>

        <h1 style={{
          fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif",
          fontSize: 30, lineHeight: 1.1, margin: '0 0 6px', color: 'var(--text-primary)',
        }}>거의 다 됐어요</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.6 }}>
          메일 주소만 알려주시면 끝납니다
        </p>

        {/* 어디로 들어왔는지 — **왜 메일을 묻는지가 설명 없이 읽힌다** */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', marginBottom: 18,
        }}>
          <div aria-hidden="true" style={{
            width: 28, height: 28, borderRadius: 8, flex: '0 0 28px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, background: mark.bg, color: mark.fg,
          }}>{mark.text}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            {who && <strong style={{ color: 'var(--text-primary)' }}>@{who}</strong>}
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)' }}>
              {label}으로 들어왔어요
            </span>
          </div>
        </div>

        {/* 메일이 안 나가는 자리면 **누르기 전에** 말한다 */}
        {mailReady === false && (
          <div role="alert" style={{
            border: '1px solid var(--danger)', borderRadius: 'var(--radius)',
            padding: '12px 13px', marginBottom: 16,
            fontSize: 12.5, color: 'var(--danger)', lineHeight: 1.7,
          }}>
            지금은 <strong>메일을 보낼 수 없어요.</strong> {label}은 메일 주소를 알려주지 않아서
            이 걸음이 꼭 필요합니다 — <Link to="/login" style={{ color: 'var(--accent)' }}>
            Google 이나 네이버</Link>로 들어와 주세요.
          </div>
        )}

        {mailReady !== false && (
          <form onSubmit={submit}>
            <label className="label" htmlFor="oe-email">이메일</label>
            <input
              id="oe-email"
              name="email"
              autoComplete="email"
              inputMode="email"
              className="input"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                // 주소를 고치면 받아둔 번호는 **그 주소의 것이 아니다**
                if (sent) { setSent(false); setCode(''); setInfo(''); }
                if (error) setError('');
              }}
              disabled={saving}
              style={{
                marginBottom: 4,
                borderColor: email ? (emailOk ? 'var(--success)' : 'var(--border)') : 'var(--border)',
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.6 }}>
              여기로 번호를 보냅니다
            </div>

            {!sent ? (
              <button
                type="button"
                className="btn-primary"
                onClick={sendCode}
                disabled={!emailOk || sending}
              >{sending ? '보내는 중...' : '번호 받기'}</button>
            ) : (
              <>
                <label className="label" htmlFor="oe-code">메일로 온 번호</label>
                <input
                  id="oe-code"
                  ref={codeRef}
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
                    if (error) setError('');
                  }}
                  disabled={saving}
                  style={{
                    marginBottom: 8, letterSpacing: 6, textAlign: 'center', fontSize: 19,
                    borderColor: code.length === 6 ? 'var(--success)' : 'var(--border)',
                  }}
                />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--accent)' }}>{email.trim()}</strong> 로 보냈어요.
                  안 왔으면{' '}
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={sending}
                    style={{
                      background: 'none', border: 'none', padding: 0, font: 'inherit',
                      color: 'var(--accent)', cursor: sending ? 'default' : 'pointer',
                      textDecoration: 'underline',
                    }}
                  >{sending ? '보내는 중...' : '다시 보내기'}</button>
                </div>
                <button
                  className="btn-primary"
                  type="submit"
                  disabled={code.length !== 6 || saving}
                >{saving ? '만드는 중...' : '시작하기'}</button>
              </>
            )}

            {info && !error && (
              <div role="status" style={{
                fontSize: 12, color: 'var(--success)', marginTop: 10, lineHeight: 1.6,
              }}>{info}</div>
            )}
            {error && (
              <div role="alert" style={{
                fontSize: 12.5, color: 'var(--danger)', marginTop: 10, lineHeight: 1.6,
              }}>{error}</div>
            )}
          </form>
        )}

        {/* **왜 주는지 적는다.** 이 줄이 없으면 「왜 메일을 달라는 거지」로 멈춘다 */}
        <div style={{
          marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)',
          fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7,
        }}>
          비밀번호를 찾을 때, 그리고 운동 알림을 보낼 때 씁니다.
          <strong style={{ color: 'var(--text-secondary)' }}> 이미 이 메일로 쓰는 계정이 있으면
          그 계정으로 들어갑니다</strong> — 기록이 둘로 갈라지지 않습니다.
        </div>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link to="/login" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            다른 방법으로 들어가기
          </Link>
        </div>
      </div>
    </div>
  );
}
