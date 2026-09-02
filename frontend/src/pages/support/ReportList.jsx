import { useState, useMemo } from 'react';
import NavIcon from '../../components/NavIcon';
import { readLS } from '../../data/safeStorage';
import { SEEN_REPLY_KEY } from '../../data/localKeys';
import { kindOf, FREQ, WORKAROUND, STATUS, dayOf } from './reportMeta';
import { FILTERS, viewReports, filterCounts, hasReply, isNewReply, newReplyCount } from './reportView';

// 내 제보 목록.
//
// **825줄짜리 제보함에서 떼어냈다** (2026-09-02). 8/26 에 리메이크하면서 들어가는
// 길(갈래를 밖에서 고르기)만 바꾸고 안쪽은 그대로 뒀는데, 목록 한 줄을 고치려고
// 폼 400줄을 지나쳐야 했다.
//
// 떼어내면서 **여기 다시 오는 이유**에 맞게 다시 짰다. 사람이 제보함에 두 번째로
// 오는 이유는 하나다 — **답이 왔나 보려고.**
//
//   · **답이 어느 것에 달렸는지 목록에서 안 보였다.** 상태 배지(접수 · 확인중 ·
//     처리완료)는 있었지만 **상태와 답변은 다른 것이다** — 「확인중」인데 답이 달린
//     제보가 실제로 있다. 여섯 장을 다 눌러봐야 어느 것에 답이 왔는지 알았다
//   · **거르는 탭이 관리자의 말이었다** — 접수 · 확인중 · 처리완료 · 보류.
//     제보한 사람에게 「접수」와 「확인중」의 차이는 아무 뜻이 없다.
//     **전체 · 답변 옴 · 기다리는 중** 셋으로 줄였다
//   · **안 본 답을 맨 위로.** 예전에는 무조건 최신 순이라 답이 달린 옛 제보가
//     아래에 묻혔다
export default function ReportList({ items, loading, loadFailed, onDelete }) {
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  // **처음 그릴 때 한 번만 읽는다.** 고객센터가 제보함을 펼치는 순간 이 값을 지금으로
  // 올리기 때문에, 다시 읽으면 펼치자마자 전부 「읽은 것」이 된다.
  // 자식이 먼저 그려지고 부모의 effect 가 나중에 도니 여기서는 옛 값이 잡힌다
  const [seenAt] = useState(() => readLS(SEEN_REPLY_KEY) || '');

  const shown = useMemo(() => viewReports(items, filter, seenAt), [items, filter, seenAt]);
  const counts = useMemo(() => filterCounts(items), [items]);
  const newCount = useMemo(() => newReplyCount(items, seenAt), [items, seenAt]);

  return (
    <>
      <div className="section-title">
        <div className="accent-bar" />
        내 제보
        <span style={{
          fontFamily: "'Barlow', sans-serif", fontSize: 12, letterSpacing: 0,
          color: 'var(--text-muted)', marginLeft: 'auto',
        }}>{items.length}건</span>
      </div>

      {/* 답이 왔으면 목록을 훑기 전에 먼저 말한다. 없으면 이 줄 자체가 안 나온다 —
          「새 답변 없음」을 굳이 알릴 이유가 없다 */}
      {newCount > 0 && (
        <div className="card" style={{
          marginBottom: 10, padding: '10px 13px',
          borderLeft: '2px solid var(--accent)',
          fontSize: 12.5, color: 'var(--accent)',
        }}>
          답변이 {newCount}건 왔습니다. 아래 맨 위에 있어요.
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map(({ key, label }) => {
          const on = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              aria-pressed={on}
              style={{
                padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                borderRadius: 'var(--radius)',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                background: on ? 'var(--accent)' : 'transparent',
                color: on ? 'var(--on-accent)' : 'var(--text-secondary)',
                fontWeight: on ? 700 : 400, transition: 'all 0.15s',
              }}
            >{label} {counts[key] || 0}</button>
          );
        })}
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '34px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
          불러오는 중…
        </div>
      ) : loadFailed ? (
        // 못 불러온 것과 없는 것은 다르다. 없어진 줄 알면 다시 적는다
        <div className="card" style={{ textAlign: 'center', padding: '34px 20px' }}>
          <div style={{ marginBottom: 10, opacity: 0.4, display: 'flex', justifyContent: 'center' }} aria-hidden="true"><NavIcon name="signal" size={30} /></div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            제보를 불러오지 못했습니다.<br />없어진 게 아니라 못 가져온 것이니, 새로고침해 주세요.
          </div>
        </div>
      ) : shown.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '34px 20px' }}>
          <div style={{ marginBottom: 10, opacity: 0.4, display: 'flex', justifyContent: 'center' }} aria-hidden="true"><NavIcon name="inbox" size={30} /></div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            {filter === 'all'
              ? '아직 보낸 제보가 없습니다.'
              : filter === 'answered'
                ? '아직 답이 달린 제보가 없습니다.'
                : '답을 기다리는 제보가 없습니다.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(item => {
            const st = STATUS[item.status] || STATUS.received;
            const kd = kindOf(item.kind);
            const isOpen = open === item.id;
            const isNew = isNewReply(item, seenAt);
            // 유형마다 받은 게 다르니 목록에 붙는 꼬리표도 다르다
            const tags = [];
            if (item.kind === 'bug') {
              if (item.meta?.screen) tags.push(item.meta.screen);
              const f = FREQ.find(x => x.key === item.meta?.freq);
              if (f) tags.push(f.label);
            } else if (item.kind === 'idea') {
              const w = WORKAROUND.find(x => x.key === item.meta?.workaround);
              if (w) tags.push(w.label);
            }
            return (
              <div
                key={item.id}
                className="card clickable"
                onClick={() => { setOpen(isOpen ? null : item.id); setConfirmDel(null); }}
                style={{
                  padding: 14,
                  borderColor: isNew ? 'var(--accent)' : isOpen ? 'var(--border-hover)' : 'var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
                  {/* **답변 유무를 상태와 따로 적는다.** 「확인중」인데 답이 달린 제보가
                      있다 — 상태 배지만 보고는 답이 온 줄 모른다 */}
                  {hasReply(item) && (
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
                      padding: '2px 7px', borderRadius: 'var(--radius)',
                      background: isNew ? 'var(--accent)' : 'var(--accent-dim)',
                      color: isNew ? 'var(--on-accent)' : 'var(--accent)',
                      border: '1px solid var(--accent)',
                    }}>{isNew ? '새 답변' : '답변 옴'}</span>
                  )}
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
                    padding: '2px 7px', borderRadius: 'var(--radius)',
                    background: st.dim, color: st.color, border: `1px solid ${st.color}`,
                  }}>{st.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <NavIcon name={kd.icon} size={13} />{kd.label}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{dayOf(item.created_at)}</span>
                  {/* 펼치지 않고도 지울 수 있게 카드 줄에 둔다.
                      카드 클릭이 접기/펼치기라 stopPropagation 이 필요하다 */}
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDel(confirmDel === item.id ? null : item.id); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0 2px 4px',
                      color: confirmDel === item.id ? 'var(--danger)' : 'var(--text-muted)',
                      fontSize: 11.5, flexShrink: 0,
                    }}
                  >지우기</button>
                </div>

                <div style={{
                  fontSize: 14.5, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.45,
                  ...(isOpen ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
                }}>{item.title}</div>

                {/* 접힌 채로도 답의 첫 줄을 보여준다 — 어느 것에 무슨 답이 왔는지
                    알려면 여섯 장을 다 눌러봐야 했다 */}
                {!isOpen && hasReply(item) && (
                  <div style={{
                    fontSize: 12, color: 'var(--text-secondary)', marginTop: 5, lineHeight: 1.6,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    <span style={{ color: 'var(--accent)' }}>답 </span>
                    {String(item.reply).split('\n')[0]}
                  </div>
                )}

                {/* 확인 단계 — 접힌 채로도 여기서 끝낼 수 있다.
                    되돌릴 수 없는 일이라 한 번 더 묻는다 */}
                {confirmDel === item.id && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
                    padding: '9px 10px', background: 'var(--danger-dim)',
                    border: '1px solid var(--danger)', borderRadius: 'var(--radius)',
                  }}>
                    <span style={{ fontSize: 11.5, color: 'var(--danger)', marginRight: 'auto' }}>
                      지우면 되돌릴 수 없습니다
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDel(null); }}
                      style={{
                        background: 'none', border: '1px solid var(--border-hover)',
                        color: 'var(--text-secondary)', fontSize: 11.5,
                        padding: '5px 11px', borderRadius: 'var(--radius)', cursor: 'pointer',
                      }}
                    >취소</button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDel(null); onDelete(item.id); }}
                      style={{
                        background: 'var(--danger-strong)', border: '1px solid var(--danger-strong)',
                        color: '#fff', fontSize: 11.5, fontWeight: 700,
                        padding: '5px 11px', borderRadius: 'var(--radius)', cursor: 'pointer',
                      }}
                    >지웁니다</button>
                  </div>
                )}

                {tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                    {tags.map(t => (
                      <span key={t} style={{
                        fontSize: 10.5, color: 'var(--text-muted)',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2px 7px',
                      }}>{t}</span>
                    ))}
                  </div>
                )}

                {isOpen && (
                  <>
                    {item.body && (
                      <div style={{
                        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75,
                        marginTop: 10, whiteSpace: 'pre-wrap',
                      }}>{item.body}</div>
                    )}

                    {hasReply(item) ? (
                      <div style={{
                        marginTop: 14, padding: '12px 14px',
                        background: 'var(--bg-tertiary)',
                        borderLeft: '2px solid var(--accent)', borderRadius: 'var(--radius)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <span style={{
                            fontFamily: "'Bebas Neue', sans-serif", fontSize: 13,
                            letterSpacing: 1.5, color: 'var(--accent)',
                          }}>답변</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dayOf(item.reply_at)}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                          {item.reply}
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        marginTop: 12, fontSize: 12, color: 'var(--text-muted)',
                        borderTop: '1px solid var(--border)', paddingTop: 10,
                      }}>
                        아직 답변이 없습니다. 확인하는 대로 여기에 답니다.
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
