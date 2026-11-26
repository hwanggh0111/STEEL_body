import { useEffect, useRef, useState } from 'react';
import { useBlockStore } from '../store/blockStore';
import { useAuthStore } from '../store/authStore';
import NavIcon from './NavIcon';
// 영구 정지에는 「풀린 뒤」가 없다 — 앱 밖의 연락처가 유일한 길이다 (한 곳에 있다)
import { SUPPORT_EMAIL } from '../data/contact';
import Logo from './Logo';
import Emphasis from './Emphasis';
import { euroJosa } from '../data/particle';
import { useModalFocus } from '../data/useModalFocus';
import { LAYER } from '../data/layers';
// 긴 정지를 하루짜리 자 여럿으로 나누는 판단 (2026-11-26) — 까닭은 그 파일에 있다
import { nextWake } from '../data/blockWake';

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
  const boxRef = useRef(null);
  const block = useBlockStore((s) => s.block);
  const clear = useBlockStore((s) => s.clear);
  const logout = useAuthStore((s) => s.logout);
  // 긴 정지를 **하루짜리 자 여럿**으로 나눠 센다 (아래 머리글). 깨어날 때마다 올린다
  const [wakeup, setWakeup] = useState(0);

  // **기한이 지나면 저절로 열린다.** 점검 화면이 그렇게 한다 — 여기서 안 하면
  // 7일이 지난 사람이 「풀리는 때」가 지난 화면을 보면서 새로고침을 모른 채 기다린다
  const until = block?.until;
  useEffect(() => {
    // 무엇을 할지 **정하는 자는 `data/blockWake.js` 한 곳**이다 — 그 자리에 왜
    // 하루씩 나눠 거는지(32비트로 접히는 자) 적어뒀고, `npm run check` 가 60일
    // 정지를 먹여 값으로 본다. 여기는 그 답대로 풀거나 자를 걸기만 한다
    const todo = nextWake(until);
    if (todo.kind === 'none') return undefined;
    if (todo.kind === 'open') { clear(); window.location.reload(); return undefined; }
    const timer = setTimeout(() => {
      const again = nextWake(until);
      if (again.kind === 'open') { clear(); window.location.reload(); return; }
      // 아직 남았다 — 이 자리를 다시 세운다 (하루짜리 자를 또 건다)
      setWakeup((n) => n + 1);
    }, todo.wait);
    return () => clearTimeout(timer);
  }, [until, clear, wakeup]);

  // 떠 있는 동안 ⑴ 뒤가 안 밀리게 ⑵ 탭이 뒤로 안 새게 한다 (2026-11-16 · 맵시).
  //
  // 이 화면은 `App.jsx:126` 에서 **라우터와 나란히** 그려진다 — 덮기만 하고
  // **뒤에 앱이 그대로 서 있다.** 그래서 탭을 누르면 가려진 화면의 단추로 초점이
  // 넘어가고, 거기서 엔터를 치면 **막아둔 사람이 앱을 쓴다.** 잠금이 2026-09-18 에
  // 막은 것과 같은 구멍이고, 여기만 안 막혀 있었다.
  //
  // **`onClose` 는 안 준다** — Esc 로 닫을 수 있으면 막은 것이 막은 것이 아니다.
  // 갈고리는 이른 되돌림보다 위에 둔다
  useModalFocus(boxRef, !!block);

  if (!block) return null;

  // **기한이 있나로 가른다** (2026-10-26). 여태 `kind === 'suspended'` 만 경고색이었다 —
  // 종류를 하나 더 읽게 되면서(주소 차단) 3일 뒤 풀리는 것이 영구 정지와 같은 색이 됐다.
  // 지금까지의 셋은 그대로다: 정지=기한 있음(경고) · 영구 정지·차단=기한 없음(위험)
  const tone = block.forever ? 'var(--danger)' : 'var(--warning)';

  return (
    // **읽어주는 기계에 「덮개가 떴다」고 알린다** (2026-11-16 · 맵시).
    // 덮개 열하나 중 `role` 이 없는 둘 중 하나였다. `alertdialog` 로 적는다 —
    // 사람이 부른 창이 아니라 **막혔다고 알리는** 창이다. **Esc 는 안 준다**:
    // 닫을 수 있으면 막은 것이 막은 것이 아니다
    <div role="alertdialog" aria-modal="true" aria-label="계정이 막혔습니다" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-primary)',
      backgroundImage: 'var(--bg-glow)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: LAYER.막힘, padding: 20, overflow: 'auto',
    }}>
      {/* ── **내용이 길면 위가 잘린 채 못 내려간다** ── (2026-11-16 · 맵시)
          겉은 `align-items: center` 로 가운데 세우는 칸이다. 그 안의 것이 화면보다
          길어지면 **넘치는 쪽이 위로 밀려나고, 위로 밀려난 자리는 스크롤로 닿지
          않는다**(flex 가운데 정렬의 오래된 함정이다). 「정지 기한 · 푸는 길」이
          적힌 윗줄이 그렇게 사라질 수 있었다.
          `role` 을 달면서 `check-modal.cjs` 가 이 자리를 보기 시작해 잡혔다 —
          집안 꼴대로 **속 상자가 제 안에서 내려간다** */}
      <div ref={boxRef} style={{
        textAlign: 'center', maxWidth: 380, width: '100%',
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        <Logo cap={16} style={{ marginBottom: 28 }} />

        <div style={{ marginBottom: 14, color: tone, display: 'flex', justifyContent: 'center' }} aria-hidden="true">
          <NavIcon name="ban" size={40} />
        </div>

        <div style={{
          fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif",
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
              fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif",
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
