import { useEffect, useState, useRef } from 'react';
import { useModalFocus } from '../data/useModalFocus';
import client from '../api/client';
import NavIcon from './NavIcon';
import { LAYER } from '../data/layers';
import { exportAll } from '../data/exportCsv';
import { PARTS } from './ExportAll';
import { toast } from './Toast';

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
  // 덮개 안에 자판을 가둔다 — 안 가두면 탭이 뒤 화면으로 새서
  // **보이지도 않는 단추가 눌린다** (`data/useModalFocus.js`)
  const boxRef = useRef(null);
  useModalFocus(boxRef, true, { onClose: onClose });
  const [me, setMe] = useState(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sure, setSure] = useState(false);
  // 지우기 전에 **이 자리에서** 받는다 (위 ★ 의 까닭). 담을 것은 설정의 그 목록
  // 그대로다 — `PARTS` 한 자리에서 읽어 **열쇠를 두 벌로 두지 않는다**
  const [busy, setBusy] = useState(false);
  const 받아두기 = () => {
    if (busy) return;
    setBusy(true);
    exportAll(PARTS.map((p) => p.key))
      .then((name) => toast(`${name} 으로 받았어요`, 'success'))
      // 사진까지 담으므로 묶음이 커서 끊길 수 있다 — **무엇을 해보라고** 말한다
      .catch(() => toast('받지 못했어요. 설정 › 기록 챙기기에서 사진을 빼고 해보세요', 'error'))
      .finally(() => setBusy(false));
  };

  // 무엇을 물어야 하는지는 서버가 안다 (소셜인지 · 유예가 며칠인지)
  useEffect(() => {
    let alive = true;
    client.get('/auth/me')
      .then(({ data }) => { if (alive) setMe(data); })
      .catch(() => { if (alive) setError('계정 정보를 못 불러왔어요. 잠시 뒤에 다시 해주세요'); });
    return () => { alive = false; };
  }, []);


  // ── **자판으로 빠져나갈 길이 없었다** ── (2026-11-11)
  //
  // 닫는 길이 ⑴ 바깥을 누르기 ⑵ ✕ 를 누르기 둘뿐이었다. 둘 다 **눌러야** 하는
  // 길이라, 자판만 쓰는 사람은 이 창에 **갇혔다**(`ConfirmModal`·`PasswordResetModal`
  // 에는 `Escape` 가 이미 있었고 이 창에만 없었다 — 정석이 전수로 세어 짚었다).
  //
  // 창을 여는 자리마다 적지 않는다 — **창이 제 닫는 길을 안다.**
  //
  // 2026-11-13 — 그 손을 위의 `useModalFocus` 가 가져갔다. **두 벌로 두면 한쪽만
  // 고쳐진다** (오늘 탭 가두기가 딱 그 꼴로 한 자리만 돼 있었다).

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
        background: 'rgba(0,0,0,0.7)', zIndex: LAYER.모달,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        ref={boxRef}
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
            fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif", fontSize: 22, letterSpacing: 2,
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

            {/* ── ★ **여기가 꺼낼 수 있는 마지막 자리다** ── (2026-11-19 · 맵시)

                여태 이 줄은 「먼저 **기록 화면에서 내려받기**를 해두세요」였다. 그 길로
                가면 받는 것이 **셋**이고(운동 기록 · 인바디 · 측정) 메모 · 루틴 · 기구
                세팅 · 사진은 **받을 길이 없었다** — 11/19 에 설정에 「전부 받기」를 붙여
                그 넷을 열었다.

                그런데 ★ **지우기를 누른 뒤에는 그 설정 화면에 못 들어간다.** 예약된
                계정은 모든 API 가 401 이고(`middleware/auth.js`), 들어가려고 다시
                로그인하면 **그 로그인이 삭제를 취소한다**(`routes/auth.js`). 즉
                「30일 안에 꺼내세요」가 **길이 없는 말**이었다(정석이 찾았다).

                그래서 **이 자리에서 받게 한다.** 창을 떠나지 않고, 누르기 전에.
                받아야만 지울 수 있게 묶지는 않는다 — 그건 사람이 정할 일이다. */}
            <div style={{
              fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 14,
              background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', padding: '12px 14px',
              borderLeft: '2px solid var(--accent)',
            }}>
              <b style={{ color: 'var(--text-primary)' }}>받아두시겠어요?</b> 지우기를 누른 뒤에는
              이 앱에 들어올 수 없어서 <b style={{ color: 'var(--text-primary)' }}>여기가 꺼낼 수 있는
              마지막 자리</b>입니다. 지운 뒤에는 저희도 꺼내 드릴 수 없습니다.
              <button
                type="button"
                onClick={받아두기}
                disabled={busy}
                className="btn-secondary"
                style={{ width: '100%', marginTop: 10 }}
              >{busy ? '묶는 중…' : '내 기록 전부 받기 (사진까지)'}</button>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.7 }}>
                운동 기록 · 인바디 · 측정 · 메모 · 루틴 · 기구 세팅 · 사진을 한 묶음으로 받습니다.
                사진이 많으면 시간이 걸려요 — 와이파이에서 받으시는 게 좋습니다.
              </div>
            </div>

            {/* **못 받은 것과 아직 안 온 것을 가른다** (2026-11-09, 2차 검사).
                `/auth/me` 가 실패하면 `me` 는 영영 null 이라 여태 **「불러오는 중…」이
                그대로 돌았다** — 아래 `error` 줄이 「못 불러왔어요」라고 적는데 그 위에서
                아직 받는 중이라고 말하니, 한 화면이 두 말을 했다 */}
            {!me && error ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                위 내용을 확인하지 못했어요. 창을 닫고 잠시 뒤에 다시 열어주세요.
              </div>
            ) : !me ? (
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

            {/* **낭독기에 알린다** — 오류 글이 떠도 초점은 단추·칸에 그대로 있어서,
                  `role="alert"` 가 없으면 **아무 말도 안 하고 그냥 안 된다.**
                  `LoginPage` · `RegisterPage` 등 다섯은 이미 이 꼴이고 여덟 자리가
                  빠져 있었다 (2026-11-16 · 맵시) */}
            {error && (
              <div role="alert" style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10, lineHeight: 1.6 }}>{error}</div>
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
