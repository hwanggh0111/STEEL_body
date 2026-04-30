import { useState, useEffect } from 'react';
import client from '../api/client';

export default function PasswordResetModal({ onClose }) {
  const [step, setStep] = useState(1); // 1: 이메일, 2: 인증번호+새 비번, 3: 완료
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sendCode = async (e) => {
    e?.preventDefault();
    setError(''); setInfo('');
    if (!email.trim()) { setError('이메일을 입력해주세요'); return; }
    setLoading(true);
    try {
      const { data } = await client.post('/auth/send-code', { email: email.trim() });
      setStep(2);
      setInfo(data.code ? `[개발 모드] 인증번호: ${data.code}` : '인증번호가 이메일로 발송됐어요');
    } catch (err) {
      setError(err.response?.data?.error || '인증번호 발송 실패');
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e) => {
    e?.preventDefault();
    setError(''); setInfo('');
    if (!code.trim() || code.length !== 6) { setError('6자리 인증번호를 입력해주세요'); return; }
    if (newPw.length < 8 || newPw.length > 100) { setError('비밀번호는 8~100자여야 해요'); return; }
    if (!/[A-Za-z]/.test(newPw) || !/[0-9]/.test(newPw)) { setError('비밀번호는 영문+숫자 조합이어야 해요'); return; }
    if (newPw !== newPw2) { setError('새 비밀번호가 일치하지 않아요'); return; }
    setLoading(true);
    try {
      await client.post('/auth/reset-password', { email: email.trim(), code: code.trim(), newPassword: newPw });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || '비밀번호 재설정 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="비밀번호 재설정"
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 380, width: '100%',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, color: 'var(--accent)' }}>
            비밀번호 재설정
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >✕</button>
        </div>

        {step === 1 && (
          <form onSubmit={sendCode}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
              가입 시 사용한 이메일을 입력해주세요. 인증번호를 보내드려요.
            </p>
            <label className="label" htmlFor="reset-email">이메일</label>
            <input
              id="reset-email"
              name="email"
              autoComplete="email"
              inputMode="email"
              className="input" type="email" autoFocus
              placeholder="user@email.com" value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
              style={{ marginBottom: 12 }}
            />
            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? '발송 중...' : '인증번호 받기'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitReset}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--accent)' }}>{email}</strong>로 발송된 6자리 인증번호와 새 비밀번호를 입력해주세요.
            </p>
            {info && (
              <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', padding: '8px 12px',
                borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--accent)', marginBottom: 12 }}>
                {info}
              </div>
            )}
            <label className="label" htmlFor="reset-code">인증번호</label>
            <input
              id="reset-code"
              name="one-time-code"
              autoComplete="one-time-code"
              className="input" type="text" inputMode="numeric" maxLength={6} autoFocus
              placeholder="123456" value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); if (error) setError(''); }}
              style={{ marginBottom: 12, letterSpacing: 4, textAlign: 'center', fontSize: 18 }}
            />

            <label className="label" htmlFor="reset-new-pw">새 비밀번호</label>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input
                id="reset-new-pw"
                name="new-password"
                autoComplete="new-password"
                className="input" type={showPw ? 'text' : 'password'}
                placeholder="영문+숫자 8자 이상" value={newPw}
                onChange={(e) => { setNewPw(e.target.value); if (error) setError(''); }}
                maxLength={100}
                style={{ paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} aria-label="비밀번호 표시 토글" style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
              }}>{showPw ? '🙈' : '👁'}</button>
            </div>

            <label className="label" htmlFor="reset-new-pw2">새 비밀번호 확인</label>
            <input
              id="reset-new-pw2"
              name="new-password-confirm"
              autoComplete="new-password"
              className="input" type={showPw ? 'text' : 'password'}
              placeholder="다시 입력" value={newPw2}
              onChange={(e) => { setNewPw2(e.target.value); if (error) setError(''); }}
              maxLength={100}
              style={{ marginBottom: 12 }}
            />

            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => { setStep(1); setCode(''); setNewPw(''); setNewPw2(''); setError(''); setInfo(''); }}
                style={{
                  background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)',
                  padding: '11px 16px', cursor: 'pointer', fontSize: 14, borderRadius: 'var(--radius)',
                  fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1.5,
                }}
              >이전</button>
              <button className="btn-primary" type="submit" disabled={loading} style={{ flex: 1 }}>
                {loading ? '재설정 중...' : '비밀번호 재설정'}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, color: 'var(--success)', marginBottom: 8 }}>
              재설정 완료!
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              새 비밀번호로 로그인해주세요.
            </p>
            <button className="btn-primary" onClick={onClose}>로그인 화면으로</button>
          </div>
        )}
      </div>
    </div>
  );
}
