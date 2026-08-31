import { useEffect, useState } from 'react';
import client from '../api/client';
import { toast } from './Toast';
import NavIcon from './NavIcon';

// ─────────────────────────────────────────────────────────────
// 계정 삭제.
//
// 지금까지 앱에 이 길이 없었다. 「제보함에 남겨주시면 지워드립니다」로 받고 있었다 —
// 자기 계정을 지우는 데 남의 손을 빌려야 했고, 그 사람이 볼 때까지 기다려야 했다.
//
// **바로 지우지 않는다. 30일 잠가두고, 그 안에 다시 로그인하면 되살아난다.**
// 홧김에 누른 사람과 잘못 누른 사람을 구하려고 두는 시간이다. 대신 그동안
// 서버에 남아 있는 것은 사실이므로 **그렇게 적는다** — 「즉시 삭제됩니다」라고
// 적어놓고 30일 들고 있으면 그게 거짓말이다.
//
// 묻는 것이 사람마다 다르다. 이메일로 가입한 사람에게는 비밀번호를,
// 소셜로만 들어온 사람에게는 **자기 이메일을 손으로 적게** 한다 —
// 그 사람들은 자기 비밀번호를 모른다(가입할 때 난수가 들어간다).
// ─────────────────────────────────────────────────────────────

export default function AccountDeleteModal({ onClose, onDeleted }) {
  const [me, setMe] = useState(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sure, setSure] = useState(false);

  // 무엇을 물어야 하는지는 서버가 안다 (소셜인지 · 유예가 며칠인지)
  useEffect(() => {
    let alive = true;
    client.get('/auth/me')
      .then(({ data }) => { if (alive) setMe(data); })
      .catch(() => { if (alive) setError('계정 정보를 못 불러왔어요. 잠시 뒤에 다시 해주세요'); });
    return () => { alive = false; };
  }, []);

  const social = !!me?.is_social;
  const days = me?.grace_days ?? 30;
  const isAdmin = me?.role === 'admin';
  const canSubmit = !!me && !isAdmin && sure && answer.trim() && !saving;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      const body = social ? { confirmEmail: answer.trim() } : { password: answer };
      const { data } = await client.post('/auth/delete', body);
      onDeleted?.(data);
    } catch (err) {
      setError(err.response?.data?.error || '지금은 처리하지 못했어요. 잠시 뒤에 다시 해주세요');
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
        aria-label="계정 삭제"
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 380, width: '100%',
          maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2,
            color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <NavIcon name="ban" size={19} />계정 삭제
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >✕</button>
        </div>

        {isAdmin ? (
          // 관리자가 자기 계정을 지우면 남은 사람의 제보를 아무도 못 보고,
          // 정지된 사람을 아무도 못 풀어준다 — 서비스가 잠긴다
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            관리자 계정은 앱에서 지울 수 없어요.<br />
            지우면 제보에 답할 사람도, 정지를 풀어줄 사람도 없어집니다.
          </div>
        ) : (
          <form onSubmit={submit}>
            {/* 무엇이 사라지는지 먼저 적는다. 누르고 나서 알게 하면 안 된다 */}
            <div style={{
              fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.8,
              background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)',
              padding: '12px 14px', marginBottom: 14,
            }}>
              <b style={{ color: 'var(--text-primary)' }}>{days}일 뒤에 지워집니다.</b><br />
              그 안에 다시 로그인하시면 <b style={{ color: 'var(--accent)' }}>그대로 되살아나요.</b>
              아무것도 하지 않으시면 {days}일 뒤에 아래가 전부 사라지고, 그때는 되돌릴 수 없습니다.
              <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>
                운동 기록 · 인바디 · 측정 · 루틴 · 사진 · 제보와 답변 · 별점 · 알림 설정
              </div>
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 14 }}>
              지우기 전에 기록을 남겨두고 싶으시면, 먼저 <b style={{ color: 'var(--text-secondary)' }}>기록 화면에서 내려받기</b>를
              해두세요. 지운 뒤에는 저희도 꺼내 드릴 수 없습니다.
            </div>

            {!me ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>불러오는 중…</div>
            ) : (
              <>
                <label className="label" htmlFor="del-answer">
                  {social ? '쓰시는 이메일을 그대로 적어주세요' : '비밀번호를 한 번 더 확인할게요'}
                </label>
                <input
                  id="del-answer"
                  name={social ? 'confirm-email' : 'current-password'}
                  autoComplete={social ? 'off' : 'current-password'}
                  className="input"
                  type={social ? 'email' : 'password'}
                  placeholder={social ? me.email : ''}
                  value={answer}
                  onChange={(e) => { setAnswer(e.target.value); if (error) setError(''); }}
                  style={{ marginBottom: 14 }}
                />

                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
                  fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14,
                }}>
                  <input
                    type="checkbox"
                    checked={sure}
                    onChange={(e) => setSure(e.target.checked)}
                    style={{ marginTop: 2, accentColor: 'var(--danger)' }}
                  />
                  {days}일이 지나면 되돌릴 수 없다는 것을 알고 있습니다
                </label>
              </>
            )}

            {error && (
              <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10, lineHeight: 1.6 }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%', padding: '12px 0', cursor: canSubmit ? 'pointer' : 'not-allowed',
                borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600,
                border: '1px solid var(--danger)',
                background: canSubmit ? 'var(--danger-strong)' : 'transparent',
                color: canSubmit ? '#fff' : 'var(--text-muted)',
                opacity: canSubmit ? 1 : 0.6, transition: 'all 0.15s',
              }}
            >
              {saving ? '처리하는 중…' : '계정 삭제하기'}
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%', marginTop: 8, padding: '10px 0', cursor: 'pointer',
                background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13,
              }}
            >
              그만두기
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
