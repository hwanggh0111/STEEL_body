import { useEffect } from 'react';
import { useBlockStore } from '../store/blockStore';
import { useAuthStore } from '../store/authStore';
import NavIcon from './NavIcon';
// 영구 정지에는 「풀린 뒤」가 없다 — 앱 밖의 연락처가 유일한 길이다 (한 곳에 있다)
import { SUPPORT_EMAIL } from '../data/contact';
import Logo from './Logo';
import Emphasis from './Emphasis';
import { euroJosa } from '../data/particle';

// 계정이 막혔을 때 **앱을 덮고 까닭을 말한다** (2026-10-24).
//
// 여태 정지된 사람이 보는 것은 **까닭 없이 되돌아오는 로그인 화면**이었다 —
// 서버는 403 에 까닭과 기한을 적어 보내는데 읽는 자리가 없었다(`data/accountBlock.js`
// 머리글에 그 길을 적어뒀다). 자동으로 벌을 주는 앱은 벌받은 사람에게 **무엇 때문에
// 언제까지인지**를 말해야 한다. 오판이면 더 그렇다.
//
// **점검 화면(`MaintenanceScreen`)과 같은 결로 덮는다** — 반쯤 가리면 그 틈으로
// 「불러오지 못했어요」가 섞여 보이고, 그게 바로 여태의 모습이다.
export default function AccountBlocked() {
  const block = useBlockStore((s) => s.block);
  const clear = useBlockStore((s) => s.clear);
  const logout = useAuthStore((s) => s.logout);

  // **기한이 지나면 저절로 열린다.** 점검 화면이 그렇게 한다 — 여기서 안 하면
  // 7일이 지난 사람이 「풀리는 때」가 지난 화면을 보면서 새로고침을 모른 채 기다린다
  const until = block?.until;
  useEffect(() => {
    if (!until) return undefined;
    const left = new Date(until).getTime() - Date.now();
    if (Number.isNaN(left)) return undefined;
    if (left <= 0) { clear(); window.location.reload(); return undefined; }
    const timer = setTimeout(() => { clear(); window.location.reload(); }, left + 1000);
    return () => clearTimeout(timer);
  }, [until, clear]);

  if (!block) return null;

  // **기한이 있나로 가른다** (2026-10-26). 여태 `kind === 'suspended'` 만 경고색이었다 —
  // 종류를 하나 더 읽게 되면서(주소 차단) 3일 뒤 풀리는 것이 영구 정지와 같은 색이 됐다.
  // 지금까지의 셋은 그대로다: 정지=기한 있음(경고) · 영구 정지·차단=기한 없음(위험)
  const tone = block.forever ? 'var(--danger)' : 'var(--warning)';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-primary)',
      backgroundImage: 'var(--bg-glow)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999998, padding: 20, overflow: 'auto',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 380, width: '100%' }}>
        <Logo cap={16} style={{ marginBottom: 28 }} />

        <div style={{ marginBottom: 14, color: tone, display: 'flex', justifyContent: 'center' }} aria-hidden="true">
          <NavIcon name="ban" size={40} />
        </div>

        <div style={{
          fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif",
          fontSize: 22, letterSpacing: 2, color: tone, marginBottom: 22,
        }}>
          {block.title}
        </div>

        {/* **언제 풀리나**가 여기 온 사람이 제일 알고 싶은 것이다. 제일 크게 둔다.
            영구 정지에는 이 칸을 아예 안 그린다 — 없는 기한을 적을 수 없다 */}
        {!block.forever && block.untilLabel && (
          <div style={{
            background: 'var(--bg-secondary)', border: `1px solid ${tone}`,
            borderRadius: 'var(--radius)', padding: '18px 16px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>풀리는 때</div>
            <div style={{
              fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif",
              fontSize: 26, letterSpacing: 1, color: tone, lineHeight: 1.2,
            }}>
              {block.untilLabel}
            </div>
            {block.left && (
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 10 }}>{block.left}</div>
            )}
          </div>
        )}

        {/* 자동 판정이 적어둔 까닭. 관리자가 손으로 건 것에는 없을 수 있다 */}
        {block.reason && (
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '12px 14px',
            fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7,
            textAlign: 'left', marginBottom: 16, whiteSpace: 'pre-wrap',
          }}>
            <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>까닭</span>
            {/* 서버는 이 글에 `**굵게**` 를 적어 보낸다. 그리는 자리가 관리자 화면
                한 곳뿐이어서, **벌받은 사람만 별표를 글자로 읽고 있었다**
                (2026-10-26. 「잘못 걸렸다고 생각되면 **풀린 뒤에**…」) */}
            <Emphasis text={block.reason} />
          </div>
        )}

        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.9, marginBottom: 20 }}>
          {block.tail}
          <br />
          {/* **지금은 제보도 막혀 있다.** 보낼 수 없는 길을 가리키지 않는다 —
              고객센터 답변도 「풀린 뒤에 알려주세요」로 적혀 있다 (`support/faq.js`) */}
          {block.forever ? (
            <>
              {/* **닿을 수 있는 길을 적는다.** 제보함은 지금 막혀 있고(403),
                  영구 정지에는 「풀린 뒤」도 없다 — 남는 길은 이 주소뿐이다 */}
              잘못 걸렸다고 생각되시면{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--text-secondary)' }}>{SUPPORT_EMAIL}</a>
              {/* 조사를 고르는 손 (2026-10-27). 메일 주소가 `<a>` 안에 있어 조사만 가져온다 */}
              {' '}{euroJosa(SUPPORT_EMAIL)} 알려주세요. 확인해서 되돌립니다.
            </>
          ) : '지금은 제보도 보낼 수 없습니다. 풀린 뒤에 고객센터로 알려주시면 확인합니다.'}
        </div>

        {/* **계정 일일 때만 로그아웃을 둔다** (2026-10-26). 주소가 막힌 것은
            로그아웃해도 안 풀린다 — 누르면 그 요청도 막히고(403) 화면은 그대로다.
            할 수 없는 일을 단추로 내놓지 않는다. 대신 **다시 해보는** 길을 둔다:
            기한이 지났으면 그 자리에서 열린다 */}
        {block.account ? (
          <button
            onClick={async () => { await logout(); clear(); }}
            style={{
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-muted)', padding: '9px 18px', fontSize: 13,
              borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
          >로그아웃</button>
        ) : !block.forever && (
          <button
            onClick={() => { clear(); window.location.reload(); }}
            style={{
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-muted)', padding: '9px 18px', fontSize: 13,
              borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
          >다시 해보기</button>
        )}
      </div>
    </div>
  );
}
