import { useState } from 'react';
import { fmtDate, useFeedDetails } from './feedData';
import FeedDetailBody from './FeedDetailBody';

// 한 줄씩 세운 목록. 세부 내용이 있는 줄만 눌러서 펼친다.
//
// 예전에는 목록 데이터(FEED)와 이 컴포넌트가 한 파일에 있었다. 그러면 개발 중에
// Fast Refresh 가 매번 포기하고 화면을 통째로 새로 그린다 — 한 파일이 컴포넌트만
// 내보내야 붙는 기능이다. 데이터는 feedData.js 로 뺐다.


export default function FeedList({ items }) {
  const [open, setOpen] = useState(null);
  // 본문은 **펼칠 때** 받는다 (2026-10-16). 묶음에는 목록만 실려 있다 —
  // 까닭과 잰 값은 `feedData.js` 머리글에 적어뒀다
  const { details, failed, retry } = useFeedDetails(open != null);

  if (!items.length) {
    return (
      <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '14px 0' }}>
        여기에 해당하는 것이 없습니다.
      </div>
    );
  }

  return items.map(c => {
    const on = open === c.key;
    return (
      <div key={c.key} style={{ borderBottom: '1px solid var(--border)' }}>
        <div
          onClick={() => c.hasDetail && setOpen(on ? null : c.key)}
          style={{
            display: 'flex', gap: 12, alignItems: 'baseline',
            padding: '11px 0', cursor: c.hasDetail ? 'pointer' : 'default',
          }}
        >
          <span style={{
            fontSize: 11, color: 'var(--text-muted)', width: 46, flexShrink: 0, letterSpacing: 0.3,
          }}>{fmtDate(c.date)}</span>
          {/* 공지는 색을 준다 — 커밋에서 온 줄과 성격이 다르다 */}
          <span style={{
            fontSize: 10.5, flexShrink: 0, borderRadius: 'var(--radius)', padding: '1px 6px',
            color: c.notice ? 'var(--accent)' : 'var(--text-muted)',
            border: `1px solid ${c.notice ? 'var(--accent)' : 'var(--border)'}`,
            background: c.notice ? 'var(--accent-dim)' : 'transparent',
          }}>{c.label}</span>
          <span style={{
            fontSize: 14, lineHeight: 1.6, fontWeight: 300, flex: 1,
            color: c.notice ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}>
            {c.scope && <span style={{ color: 'var(--text-muted)' }}>{c.scope} · </span>}
            {c.text}
          </span>
          {/* 세부 내용이 있는 줄만 열린다. 없으면 표시도 안 한다 */}
          {c.hasDetail && (
            <span style={{
              color: 'var(--text-muted)', fontSize: 14, flexShrink: 0,
              transform: on ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s',
            }}>+</span>
          )}
        </div>
        {on && (
          <div style={{
            fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.85,
            whiteSpace: 'pre-wrap', padding: '2px 0 16px', paddingLeft: 58, maxWidth: 460,
          }}>
            {/* ── ★ **상태는 셋인데 분기가 둘이었다** ── (2026-11-09, 라이브 검사)

                「아직 안 온 것」과 「못 받은 것」은 가려놨는데, **셋째가 비어
                있었다** — **묶음은 왔는데 그 줄의 본문이 없는 것.** 그러면 파일은
                200 으로 받아졌으니 `failed` 가 거짓이고, 열쇠가 없으니
                `undefined` 라 `??` 가 폴백으로 넘기고, 실패가 아니니
                **「불러오는 중…」이 영영 돈다.** 바로 위 주석이 스스로 경계한
                그 상황이다 — 영영 도는 「불러오는 중」 앞에서 사람은 기다린다.

                11/09 에 라이브에서 공지 두 줄이 그랬다(본문 파일이 이레 묵어
                열쇠가 없었다 — 뿌리는 `feedData.js` 의 `DETAIL_URL` 에서 막았다).
                그래도 이 자리를 막는다: **데이터가 다시 어긋나는 날 같은 증상이
                재발**하고, 그때 사람이 보는 것은 이 글자다 */}
            <FeedDetailBody itemKey={c.key} details={details} failed={failed} retry={retry} />
          </div>
        )}
      </div>
    );
  });
}
