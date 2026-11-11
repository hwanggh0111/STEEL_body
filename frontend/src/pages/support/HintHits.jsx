import { useState } from 'react';
import { onEnterSpace } from '../../data/pressKey';

// **「혹시 이걸 찾으시나요?」** — 제보를 치는 동안 답이 이미 있는 질문을 보여준다.
//
// 막지는 않는다 — 답이 아니면 그대로 마저 적으면 된다.
//
// ── 왜 떼어 뒀나 ── (2026-11-11)
//
// `ReportBox` 는 **825줄 한 파일**이었고, 그래서 「목록 한 줄을 고치려고 폼 400줄을
// 지나쳐야」 했다. 그때 셋으로 쪼개면서 **450줄 아래로** 두기로 하고 자를 박았다
// (`check-data.cjs` 의 「제보함이 한 파일에 몰려 있지 않다」).
//
// 11/11 에 이 블록의 접는 줄을 **자판으로도 닿게** 고치면서 파일이 그 선을 넘었다.
// 자를 느슨하게 하는 것이 아니라 **적어둔 대로 쪼갠다** — 이 블록은 제 상태(무엇이
// 펼쳐져 있나)만 들고 있고 바깥과 주고받는 것이 `hits` 하나뿐이라, 떼어내기 좋은
// 자리다. 폼이 그만큼 가벼워진다.
export default function HintHits({ hits }) {
  const [open, setOpen] = useState(null);
  if (!hits || hits.length === 0) return null;

  return (
    <div style={{
      border: '1px solid var(--border)', borderLeft: '2px solid var(--accent)',
      borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 16,
    }}>
      <div style={{ fontSize: 11.5, color: 'var(--accent)', marginBottom: 4 }}>
        혹시 이걸 찾으시나요?
      </div>
      {hits.map((f) => {
        const on = open === f.q;
        const toggle = () => setOpen(on ? null : f.q);
        return (
          <div key={f.q}>
            {/* 접는 줄이다 — **펼쳐져 있는지를 읽어준다**(`aria-expanded`).
                자판 손은 한 자리에서 온다 (`data/pressKey.js`) */}
            <div
              role="button" tabIndex={0} aria-expanded={on}
              onClick={toggle}
              onKeyDown={onEnterSpace(toggle)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{f.q}</span>
              <span style={{
                color: 'var(--text-muted)', fontSize: 13, flexShrink: 0,
                transform: on ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s',
              }}>+</span>
            </div>
            {on && (
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.8, padding: '0 0 8px' }}>
                {f.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
