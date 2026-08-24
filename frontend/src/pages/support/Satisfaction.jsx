import { useEffect, useState } from 'react';
import client from '../../api/client';

// ─────────────────────────────────────────────────────────────
// 만족도 — 한 줄짜리 별점.
//
// 제보함과 따로 둔 이유가 있다. 제보는 할 말이 있는 사람만 쓴다. 그런데 대부분은
// 할 말까지는 없고 그냥 쓰고 있을 뿐이다 — 그 사람들의 온도는 제보함으로는 영영 안 온다.
// 누르는 데 1초면 되는 것을 하나 둬서 그 온도를 받는다.
//
// 이유는 묻지 않는다. 여기서까지 물으면 누르는 게 일이 되고, 제보함과 같은 것을
// 두 곳에서 묻게 된다. 대신 낮은 점수를 주면 제보함을 열어준다.
//
// 한 번 매기면 다음부터는 이 줄이 아예 안 나온다. 다만 매긴 직후에는 되돌릴 수
// 있어야 한다 — 별 하나를 잘못 눌러놓고 고칠 길이 없으면 안 된다.
// ─────────────────────────────────────────────────────────────

const STARS = [1, 2, 3, 4, 5];

const WORD = {
  1: '많이 아쉬우셨군요',
  2: '아쉬우셨군요',
  3: '그럭저럭이시군요',
  4: '괜찮으셨군요',
  5: '고맙습니다',
};

export default function Satisfaction({ onOpenReport }) {
  // null = 아직 모른다(불러오는 중), 'none' = 안 매겼다, 숫자 = 매긴 점수
  const [mine, setMine] = useState(null);
  const [hover, setHover] = useState(0);
  const [justRated, setJustRated] = useState(0);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    client.get('/ratings/me')
      .then(({ data }) => { if (alive) setMine(data?.score ?? 'none'); })
      // 못 불러왔으면 조용히 접는다. 별점을 못 물어본 것은 아무것도 망가뜨리지 않는다
      .catch(() => { if (alive) setMine('hidden'); });
    return () => { alive = false; };
  }, []);

  const send = async (score) => {
    if (sending) return;
    setSending(true);
    setFailed(false);
    try {
      await client.post('/ratings', { score });
      setJustRated(score);
      setMine(score);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  // 불러오는 중이거나, 예전에 이미 매겼거나, 실패했으면 자리를 차지하지 않는다
  if (mine === null || mine === 'hidden') return null;
  if (mine !== 'none' && !justRated) return null;

  // ── 방금 매긴 뒤 ──
  if (justRated) {
    return (
      <div style={{
        borderLeft: '2px solid var(--accent)', paddingLeft: 18, margin: '0 0 40px',
        fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.9,
      }}>
        <div style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--accent)' }}>{'★'.repeat(justRated)}</span>
          {' '}{WORD[justRated]}
        </div>
        {justRated <= 2 ? (
          <div style={{ fontSize: 13 }}>
            무엇이 아쉬웠는지 한 줄만 적어주시면 그걸 고칩니다 —{' '}
            <button
              onClick={onOpenReport}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                font: 'inherit', color: 'var(--accent)', borderBottom: '1px solid var(--accent)',
              }}
            >제보함 열기</button>
          </div>
        ) : (
          <div style={{ fontSize: 13 }}>기록하시는 데 도움이 되게 계속 손보겠습니다.</div>
        )}
        <button
          onClick={() => { setJustRated(0); setMine('none'); }}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 12, color: 'var(--text-muted)', marginTop: 2,
          }}
        >다시 매기기</button>
      </div>
    );
  }

  // ── 아직 안 매겼을 때 ──
  const shown = hover || 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
      padding: '14px 0', margin: '0 0 40px',
    }}>
      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
        이 앱, 쓰시기 어떠세요?
      </span>
      <div
        style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}
        onMouseLeave={() => setHover(0)}
      >
        {STARS.map(n => (
          <button
            key={n}
            onClick={() => send(n)}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            disabled={sending}
            aria-label={`별 ${n}개`}
            style={{
              background: 'none', border: 'none', cursor: sending ? 'default' : 'pointer',
              padding: '2px 3px', fontSize: 22, lineHeight: 1,
              color: n <= shown ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'color 0.12s ease, transform 0.08s ease',
            }}
          >{n <= shown ? '★' : '☆'}</button>
        ))}
      </div>
      {failed && (
        <span style={{ fontSize: 12, color: 'var(--danger)', width: '100%' }}>
          보내지 못했어요. 잠시 뒤에 다시 눌러주세요
        </span>
      )}
    </div>
  );
}
