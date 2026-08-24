import { useState } from 'react';
import client from '../api/client';
import { toast } from './Toast';

// ─────────────────────────────────────────────────────────────
// 비밀번호 변경 — 로그인한 채로 바꾼다.
//
// 지금까지 이 화면이 없었다. 서버(`PUT /api/auth/password`)는 처음부터 있었는데
// 누를 곳이 어디에도 없어서, 로그인한 사람이 비밀번호를 바꿀 방법이 없었다.
// 로그인 화면의 '비밀번호를 잊으셨나요?' 는 **찾기**(이메일 인증)라서 다른 것이다.
//
// 바꾸면 서버가 그 계정의 refresh token 을 전부 지운다 — 다른 기기에서도 로그아웃된다.
// 그게 맞는 동작이고(비밀번호를 바꾸는 이유가 보통 그거다), 그래서 미리 말해준다.
// ─────────────────────────────────────────────────────────────

// 서버와 같은 규칙. 여기서 먼저 걸러 되돌아오는 시간을 아낀다
function checkNew(pw, current) {
  if (pw.length < 8 || pw.length > 100) return '새 비밀번호는 8~100자여야 해요';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return '새 비밀번호는 영문+숫자 조합이어야 해요';
  if (pw === current) return '지금 쓰는 것과 같아요';
  return '';
}

export default function PasswordChangeModal({ onClose, onChanged }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const localError = next ? checkNew(next, current) : '';
  const mismatch = again && next !== again;
  const canSubmit = current && next && again && !localError && !mismatch && !saving;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await client.put('/auth/password', { currentPassword: current, newPassword: next });
      toast('비밀번호를 바꿨어요. 다시 로그인해주세요');
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || '바꾸지 못했어요. 잠시 뒤에 다시 해주세요');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="비밀번호 변경"
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 380, width: '100%',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, color: 'var(--accent)' }}>
            비밀번호 변경
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >✕</button>
        </div>

        <form onSubmit={submit}>
          <label className="label" htmlFor="pw-current">지금 비밀번호</label>
          <input
            id="pw-current"
            name="current-password"
            autoComplete="current-password"
            className="input" type="password" autoFocus
            value={current}
            onChange={(e) => { setCurrent(e.target.value); if (error) setError(''); }}
            style={{ marginBottom: 14 }}
          />

          <label className="label" htmlFor="pw-new">새 비밀번호</label>
          <input
            id="pw-new"
            name="new-password"
            autoComplete="new-password"
            className="input" type="password"
            placeholder="영문 + 숫자, 8자 이상"
            value={next}
            onChange={(e) => { setNext(e.target.value); if (error) setError(''); }}
            style={{ marginBottom: localError ? 4 : 14 }}
          />
          {localError && (
            <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>{localError}</div>
          )}

          <label className="label" htmlFor="pw-again">새 비밀번호 다시</label>
          <input
            id="pw-again"
            name="new-password-again"
            autoComplete="new-password"
            className="input" type="password"
            value={again}
            onChange={(e) => { setAgain(e.target.value); if (error) setError(''); }}
            style={{ marginBottom: mismatch ? 4 : 14 }}
          />
          {mismatch && (
            <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>두 번 적은 것이 서로 달라요</div>
          )}

          <div style={{
            fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7,
            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)',
            padding: '10px 12px', marginBottom: 14,
          }}>
            바꾸면 <b style={{ color: 'var(--text-secondary)' }}>다른 기기에서도 모두 로그아웃</b>됩니다.
            새 비밀번호로 다시 들어오시면 됩니다.
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10, lineHeight: 1.6 }}>{error}</div>
          )}

          <button className="btn-primary" type="submit" disabled={!canSubmit}>
            {saving ? '바꾸는 중…' : '비밀번호 바꾸기'}
          </button>
        </form>
      </div>
    </div>
  );
}
