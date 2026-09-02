import { useState } from 'react';
import NavIcon from '../../components/NavIcon';
import { FAQ, matchFaq } from './faq';

// 「자주 묻는 것」 먼저 찾아보기 — 제보하기 폼 위에 붙는다.
//
// **825줄짜리 제보함에서 떼어냈다** (2026-09-02). 제보를 받는 일과 이미 있는 답을
// 찾아주는 일은 성격이 다른데 한 파일에 같이 있었다.
//
// 여기가 있는 이유는 **답이 이미 있는 것을 제보로 받으면 양쪽이 다 기다리기** 때문이다.
// 다만 **막지는 않는다** — 답이 아니면 그대로 마저 적으면 된다.

export default function AskFirst() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const typed = q.trim().length >= 2;
  const hits = typed ? matchFaq(q) : [];
  const list = typed ? hits : (showAll ? FAQ : []);

  // 답이 하나도 안 나온 말을 남긴다. FAQ 를 무엇으로 늘릴지 감으로 정하지 않으려고.
  //
  // 치는 동안 스쳐 지나가는 글자까지 보내면 목록이 쓰레기가 된다. 그래서 **2초 멈춘 뒤**
  // 에 보낸다 — 그 정도 멈췄다는 것은 「여기에는 답이 없네요」를 읽었다는 뜻이다.
  // 같은 말은 이 화면이 살아 있는 동안 한 번만 보낸다.
  //
  // 남기는 것은 친 말뿐이다. 누가 쳤는지는 서버도 안 남긴다.
  // 실패해도 아무 일도 하지 않는다 — 이것 때문에 제보를 못 쓰게 되면 본말이 전도된다.
  const sentRef = useRef(new Set());
  useEffect(() => {
    if (!typed || hits.length > 0) return;
    const term = q.trim();
    if (sentRef.current.has(term)) return;
    const timer = setTimeout(() => {
      sentRef.current.add(term);
      client.post('/faq-gaps', { term }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [q, typed, hits.length]);

  // 주제를 누르면 그 자리에서 답까지 펼친다 — 한 번 더 누르게 하지 않는다
  const pickTopic = (item) => {
    setQ(item.topic);
    setOpen(item.q);
    setShowAll(false);
  };

  return (
    <div style={{ paddingTop: 20 }}>
      <div style={{
        background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)',
        borderLeft: '2px solid var(--accent)', padding: '16px 16px 14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ color: 'var(--accent)', display: 'flex' }} aria-hidden="true"><NavIcon name="chat" size={16} /></span>
          <span style={{ fontSize: 14.5, color: 'var(--text-primary)', fontWeight: 500 }}>
            먼저 하나만 여쭐게요
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 12px' }}>
          궁금해서 오신 거라면 여기서 바로 답을 드릴 수 있어요.<br />
          기다리지 않으셔도 되니까요.
        </p>

        <input
          className="input"
          value={q}
          onChange={e => { setQ(e.target.value.slice(0, 40)); setOpen(null); }}
          placeholder="어떤 게 궁금하신가요?"
          style={{ marginBottom: 10, background: 'var(--bg-secondary)' }}
        />

        {/* 무엇을 쳐야 할지 모르는 사람이 대부분이다. 눌러서 바로 볼 수 있게 둔다.
            다 늘어놓으면 네 줄이 되어 제보하러 온 사람의 길을 막는다 — 앞의 여섯 개만
            보여주고, 나머지는 아래 '모두 보기' 로 간다 */}
        {!typed && !showAll && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            {FAQ.slice(0, 6).map(f => (
              <button
                key={f.q}
                onClick={() => pickTopic(f)}
                style={{
                  padding: '6px 11px', fontSize: 12, cursor: 'pointer',
                  borderRadius: 'var(--radius)', border: '1px solid var(--border-hover)',
                  background: 'transparent', color: 'var(--text-secondary)',
                }}
              >{f.topic}</button>
            ))}
          </div>
        )}

        {typed && hits.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.8, padding: '2px 0 6px' }}>
            여기에는 딱 맞는 답이 없네요.<br />
            <span style={{ color: 'var(--text-muted)' }}>
              그 이야기는 제가 직접 듣는 게 낫겠습니다 — 위에서 유형만 골라주세요.
            </span>
          </div>
        )}

        {list.map((f) => {
          const on = open === f.q;
          return (
            <div key={f.q} style={{ borderBottom: '1px solid var(--border)' }}>
              <div
                onClick={() => setOpen(on ? null : f.q)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', cursor: 'pointer' }}
              >
                <span style={{ fontSize: 13.5, color: on ? 'var(--accent)' : 'var(--text-primary)', flex: 1 }}>
                  {f.q}
                </span>
                <span style={{
                  color: 'var(--text-muted)', fontSize: 14, flexShrink: 0,
                  transform: on ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s',
                }}>+</span>
              </div>
              {on && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.85, padding: '0 0 14px' }}>
                  {f.a}
                </div>
              )}
            </div>
          );
        })}

        {!typed && (
          <button
            onClick={() => { setShowAll(v => !v); setOpen(null); }}
            style={{
              background: 'none', border: 'none', padding: '10px 0 0', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 12.5,
            }}
          >{showAll ? '접기' : `자주 묻는 것 ${FAQ.length}가지 모두 보기`}</button>
        )}
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.85, padding: '14px 2px 0' }}>
        찾으시는 게 없어도 괜찮습니다. 위에서 유형만 골라주시면 나머지는 제가 여쭤볼게요 —
        버그는 <b style={{ color: 'var(--text-secondary)' }}>어떻게 하면 그렇게 되는지</b>,
        문의는 <b style={{ color: 'var(--text-secondary)' }}>궁금하신 것만</b>,
        건의는 <b style={{ color: 'var(--text-secondary)' }}>어떤 게 아쉬우셨는지</b> 여쭙습니다.
      </div>
    </div>
  );
}

// embedded — 고객센터 안에 한 섹션으로 얹을 때 쓴다.
// initialKind — 고객센터에서 「안 되는 게 있어요」처럼 갈래를 골라 들어오면 그 유형으로 연다.
// 그러면 유형 고르기 전에 나오는 `무엇이 궁금하세요?`(AskFirst)를 건너뛴다 —
// 고객센터의 자주 묻는 것을 이미 지나온 사람에게 같은 목록을 또 들이밀지 않는다
