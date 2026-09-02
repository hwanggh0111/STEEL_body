import { useState, useMemo, useEffect } from 'react';
import client from '../../api/client';
import { useReportStore } from '../../store/reportStore';
import { matchFaq } from './faq';
import pkg from '../../../package.json';
import NavIcon from '../../components/NavIcon';
import { KINDS, kindOf, SCREENS, FREQ, WORKAROUND } from './reportMeta';
import ReportList from './ReportList';
import AskFirst from './AskFirst';

// ─────────────────────────────────────────────────────────────
// 제보함
//
// 고객센터(/support) 맨 아래에 embedded 로 얹힌다. embedded 를 빼면
// 제목을 달고 혼자 선다.
//
// 저장은 서버가 한다. GET/POST/DELETE /api/reports 를 쓰고, 답변과 상태는
// 관리자만 바꾼다. 로그인해야 열린다 — 누가 보냈는지 모르면 답을 달 곳이 없다.
//
// 유형을 고르면 그 다음이 달라진다.
//   버그 — 찾으려면 재현 정보가 필요하다. 어느 화면인지 · 다시 해도 그런지를 묻고,
//          기기 정보도 기본으로 붙인다. 물어볼 게 제일 많다
//   문의 — 답만 하면 되므로 제일 짧다. 기기 정보도 안 붙인다
//   건의 — 무엇을 원하는지보다 "지금 어떻게 하고 있는지" 가 더 쓸모 있다. 그걸 묻는다
// 셋을 같은 폼으로 받으면 버그는 정보가 모자라고 문의는 쓸데없이 길어진다.
// ─────────────────────────────────────────────────────────────


// 제보에 붙는 기기 정보. 체크했을 때만 보낸다.
// 재현에 실제로 쓰는 것만 담는다 — 무엇을 보내는지 화면에 그대로 적어둔다.
function useDeviceInfo() {
  return useMemo(() => ({
    appVersion: pkg.version,
    browser: `${navigator.userAgent} · ${window.innerWidth}x${window.innerHeight}`,
  }), []);
}


// ── 먼저 여쭤보는 자리 ──
//
// 유형을 고르기 전에 한 번 묻는다. 답이 이미 있는 질문을 제보로 받으면 물어보신 분은
// 며칠을 기다리고, 답하는 쪽은 같은 답을 또 쓴다. 여기서 끝나면 둘 다 안 한다.
//
// 두 가지를 지킨다.
//   1. 막지 않는다 — 「찾는 게 없다」를 눌러야 폼이 열리는 관문은 사람을 돌려보내는 데만 쓰인다
//   2. 몰아세우지 않는다 — 처음 화면은 사무적인 안내문이었다. 무엇을 쳐야 할지 모르는
//      사람에게 빈 칸만 들이밀고 "못 찾으면 위에서 고르세요" 라고 하면 쫓아내는 말로 읽힌다.
//      그래서 주제를 눌러서 바로 볼 수 있게 두고, 문장도 여쭙는 말로 바꿨다
export default function ReportBox({ embedded = false, initialKind = '' }) {
  const [kind, setKind] = useState(initialKind);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [screen, setScreen] = useState('');
  const [freq, setFreq] = useState('');
  const [workaround, setWorkaround] = useState('');
  const [attach, setAttach] = useState(true);
  // 목록은 store 가 들고 있다 — 접혀 있을 때 제목줄이 「새 답변」을 보여주려면
  // 고객센터도 같은 목록을 봐야 한다. 각자 부르면 요청이 두 번 나간다
  const items = useReportStore(s => s.items);
  const loading = useReportStore(s => s.loading);
  const loadFailed = useReportStore(s => s.failed);
  const setItems = useReportStore(s => s.setItems);
  const setLoadFailed = useReportStore(s => s.setFailed);
  const fetchReports = useReportStore(s => s.fetchAll);
  const [sending, setSending] = useState(false);
  const device = useDeviceInfo();
  const [sent, setSent] = useState(false);
  // 제목을 치는 동안 답이 이미 있는 질문인지 찾아본다
  const [openHint, setOpenHint] = useState(null);

  const k = kind ? kindOf(kind) : null;

  // 제목에서 자주 묻는 것을 찾는다. 두 개까지만 — 세 개가 넘으면 폼 위에 답이 쌓여
  // 무엇을 적으러 왔는지가 가려진다
  const titleHits = useMemo(() => matchFaq(title, 2), [title]);

  // 고객센터가 이미 불러왔으면 진행 중인 요청에 얹힌다 (store 가 하나로 묶는다)
  useEffect(() => { fetchReports(); }, [fetchReports]);

  // 열려 있는 채로 밖에서 다른 갈래를 누르면 그쪽으로 옮겨간다.
  // 빈 값으로는 되돌리지 않는다 — 고르고 쓰던 것을 밖에서 지워버리면 안 된다
  useEffect(() => { if (initialKind) setKind(initialKind); }, [initialKind]);

  // 유형을 바꾸면 그 유형에만 있던 답은 버린다.
  // 남겨두면 버그로 골랐다가 문의로 바꿨을 때 엉뚱한 화면 이름이 같이 간다.
  useEffect(() => {
    setScreen(''); setFreq(''); setWorkaround('');
    if (kind) setAttach(kindOf(kind).attachDefault);
  }, [kind]);

  // 진짜로 막는 것은 둘뿐이다 — 유형과 제목.
  // 화면·빈도·내용은 있으면 좋지만 없다고 못 보낼 이유가 없다.
  // 넷을 다 채워야 눌리게 해뒀더니 제목을 쓰고도 버튼이 죽어 있었다.
  // 못 보내게 막는 것보다 부실하게라도 받아서 되묻는 편이 낫다.
  const blockReason = useMemo(() => {
    if (!kind) return '무엇에 대한 제보인지 먼저 골라주세요';
    if (!title.trim()) return `${k.titleLabel} — 한 줄만 적어주시면 보낼 수 있습니다`;
    return '';
  }, [kind, k, title]);

  // 막지는 않지만, 있으면 훨씬 도움이 되는 것들. 버튼 아래에 회색으로만 알려준다
  const hints = useMemo(() => {
    if (!kind || !title.trim()) return [];
    const out = [];
    if (kind === 'bug') {
      if (!screen) out.push('어느 화면인지');
      if (!freq) out.push('다시 해도 그런지');
    }
    if (kind === 'idea' && !workaround) out.push('지금은 어떻게 하고 계신지');
    if (body.trim().length < k.minBody) out.push(k.bodyLabel);
    return out;
  }, [kind, k, title, body, screen, freq, workaround]);

  // 뭔가 쓴 게 있나 — 지우기 버튼을 띄울지 판단한다
  const dirty = !!(title || body || screen || freq || workaround);

  const clearForm = () => {
    setTitle(''); setBody(''); setScreen(''); setFreq(''); setWorkaround('');
    setAttach(kind ? kindOf(kind).attachDefault : true);
  };

  const [sendError, setSendError] = useState('');

  // 먼저 화면에서 지우고 서버에 알린다. 실패하면 되돌린다 —
  // 지운 줄 알았는데 새로고침하면 살아 있는 것이 제일 나쁘다
  const removeItem = async (id) => {
    const prev = items;
    setItems(prev.filter(i => i.id !== id));
    try {
      await client.delete(`/reports/${id}`);
    } catch {
      setItems(prev);
      setSendError('지우지 못했어요. 잠시 뒤에 다시 해주세요');
      setTimeout(() => setSendError(''), 4000);
    }
  };

  // 서버가 id 와 날짜를 정한다. 화면에서 미리 만들어 붙였다가 나중에 맞춰 넣으면
  // 실패했을 때 목록에 유령이 남는다 — 돌아온 레코드를 그대로 쓴다
  const submit = async () => {
    if (blockReason || sending) return;
    setSendError('');
    setSending(true);
    try {
      const { data } = await client.post('/reports', {
        kind,
        title: title.trim(),
        body: body.trim(),
        meta: kind === 'bug' ? { screen, freq } : kind === 'idea' ? { workaround } : {},
        device: attach ? device : undefined,
      });
      setItems(prev => [data, ...prev]);
      setKind(''); setTitle(''); setBody('');
      setSent(true);
      setTimeout(() => setSent(false), 2600);
      setLoadFailed(false);
    } catch (err) {
      const data = err.response?.data;
      setSendError(data?.error || '보내지 못했어요. 잠시 뒤에 다시 눌러주세요');
      // 욕설로 걸린 안내는 길고, 읽고 고쳐야 하는 글이다. 4초 만에 지우면 못 읽는다.
      // 다음에 다시 누를 때까지 남겨둔다
      if (!data?.abuse) setTimeout(() => setSendError(''), 4000);
    } finally {
      setSending(false);
    }
  };

  // 고른 것 / 안 고른 것 한 벌 — 유형 칩, 화면 칩, 빈도 칩이 전부 같은 모양을 쓴다
  const chip = (on) => ({
    padding: '7px 12px', fontSize: 12.5, cursor: 'pointer',
    borderRadius: 'var(--radius)',
    border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
    background: on ? 'var(--accent-dim)' : 'transparent',
    color: on ? 'var(--accent)' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  });

  return (
    <div>
      {!embedded && (
        <>
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ color: 'var(--accent)', display: 'flex' }} aria-hidden="true"><NavIcon name="inbox" size={26} /></span>
              <h2 style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 3,
                color: 'var(--accent)', margin: 0,
              }}>제보함</h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              안 되는 것, 이상한 것, 있었으면 하는 것을 알려주세요. 확인하면 여기에 답을 답니다.
            </p>
          </div>
        </>
      )}

      <div className="section-title">
        <div className="accent-bar" />
        제보하기
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <label className="label">무엇에 대한 제보인가요</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: kind ? 20 : 4, flexWrap: 'wrap' }}>
          {KINDS.map(x => {
            const on = kind === x.key;
            return (
              <button
                key={x.key}
                onClick={() => setKind(on ? '' : x.key)}
                style={{
                  flex: '1 1 100px', textAlign: 'left',
                  background: on ? 'var(--accent-dim)' : 'transparent',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', padding: '10px 12px',
                  cursor: 'pointer', transition: 'all 0.15s',
                  opacity: kind && !on ? 0.45 : 1,
                }}
              >
                <div style={{ marginBottom: 3, display: 'flex', justifyContent: 'center', color: on ? 'var(--accent)' : 'var(--text-secondary)' }} aria-hidden="true">
                  <NavIcon name={x.icon} size={19} />
                </div>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1.5,
                  color: on ? 'var(--accent)' : 'var(--text-primary)',
                }}>{x.label}</div>
                {!kind && (
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{x.desc}</div>
                )}
              </button>
            );
          })}
        </div>

        {/* 유형을 고르기 전에는 아래를 열지 않는다 — 무엇을 물을지가 유형마다 다르다 */}
        {!kind ? (
          <AskFirst />
        ) : (
          <>
            <label className="label">{k.titleLabel}</label>
            <input
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, 60))}
              placeholder={k.titleHint}
              style={{ marginBottom: titleHits.length ? 10 : 16 }}
            />

            {/* 치는 동안 답이 이미 있는 질문인지 알려준다.
                막지는 않는다 — 답이 아니면 그대로 마저 적으면 된다 */}
            {titleHits.length > 0 && (
              <div style={{
                border: '1px solid var(--border)', borderLeft: '2px solid var(--accent)',
                borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 11.5, color: 'var(--accent)', marginBottom: 4 }}>
                  혹시 이걸 찾으시나요?
                </div>
                {titleHits.map(f => {
                  const on = openHint === f.q;
                  return (
                    <div key={f.q}>
                      <div
                        onClick={() => setOpenHint(on ? null : f.q)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '5px 0', cursor: 'pointer',
                        }}
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
            )}

            {/* ── 버그 전용 ── */}
            {kind === 'bug' && (
              <>
                <label className="label">어느 화면에서 그랬나요</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {SCREENS.map(sc => (
                    <button key={sc} onClick={() => setScreen(screen === sc ? '' : sc)} style={chip(screen === sc)}>
                      {sc}
                    </button>
                  ))}
                </div>

                <label className="label">다시 해도 그런가요</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {FREQ.map(f => (
                    <button key={f.key} onClick={() => setFreq(freq === f.key ? '' : f.key)} style={chip(freq === f.key)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── 건의 전용 ── */}
            {kind === 'idea' && (
              <>
                <label className="label">지금은 어떻게 하고 계신가요</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {WORKAROUND.map(w => (
                    <button key={w.key} onClick={() => setWorkaround(workaround === w.key ? '' : w.key)} style={chip(workaround === w.key)}>
                      {w.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            <label className="label">
              {k.bodyLabel}
              <span style={{ float: 'right', textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)' }}>
                {body.length}/600
              </span>
            </label>
            <textarea
              className="input"
              value={body}
              onChange={e => setBody(e.target.value.slice(0, 600))}
              placeholder={k.bodyHint}
              rows={kind === 'ask' ? 3 : 5}
              style={{ marginBottom: 14, resize: 'vertical', lineHeight: 1.6, fontFamily: "'Barlow', sans-serif" }}
            />

            <div
              onClick={() => setAttach(a => !a)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)',
                padding: '10px 12px', marginBottom: 16,
              }}
            >
              <div style={{
                width: 16, height: 16, flexShrink: 0, marginTop: 1,
                border: `1px solid ${attach ? 'var(--accent)' : 'var(--border-hover)'}`,
                background: attach ? 'var(--accent)' : 'transparent',
                borderRadius: 'var(--radius)', color: 'var(--on-accent)',
                fontSize: 11, lineHeight: '15px', textAlign: 'center',
              }}>{attach ? '✓' : ''}</div>
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 3 }}>
                  기기 정보를 같이 보냅니다
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  {k.attachNote} · 앱 버전 · 브라우저
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {/* 쓰던 것 비우기 — 아무것도 안 썼으면 나오지 않는다.
                  늘 띄워두면 보내기 옆에 회색 버튼이 상시로 붙어 눈이 간다 */}
              {dirty && (
                <button
                  onClick={clearForm}
                  style={{
                    background: 'none', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 15, letterSpacing: 1.5, padding: '13px 18px',
                    borderRadius: 'var(--radius)', cursor: 'pointer', flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >지우기</button>
              )}
              <button className="btn-primary" onClick={submit} disabled={!!blockReason || sending} style={{ flex: 1 }}>
                {sending ? '보내는 중…' : sent ? '보냈습니다' : k.send}
              </button>
            </div>
          </>
        )}

        {/* 보내고 나면 폼이 비워지므로 blockReason 이 곧바로 다시 켜진다.
            그대로 두면 성공한 직후에 "유형을 고르세요" 가 떠서 실패한 것처럼 읽힌다. */}
        {sendError ? (
          <div style={{
            fontSize: 12.5, color: 'var(--danger)', marginTop: 10, lineHeight: 1.75,
            background: 'var(--danger-dim)', border: '1px solid var(--danger)',
            borderRadius: 'var(--radius)', padding: '10px 13px', whiteSpace: 'pre-wrap',
          }}>
            {sendError}
          </div>
        ) : sent ? (
          <div style={{ fontSize: 12, color: 'var(--success)', textAlign: 'center', marginTop: 9 }}>
            접수됐습니다. 확인하면 아래 목록에 답이 달립니다.
          </div>
        ) : kind && blockReason ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 9 }}>
            {blockReason}
          </div>
        ) : kind && hints.length > 0 && (
          // 보낼 수는 있다. 다만 이게 있으면 더 빨리 찾는다는 것만 알려준다
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', marginTop: 9, lineHeight: 1.6 }}>
            {hints.join(' · ')} 까지 적어주시면 더 빨리 찾습니다
          </div>
        )}
      </div>

      <ReportList
        items={items}
        loading={loading}
        loadFailed={loadFailed}
        onDelete={removeItem}
      />

      <div style={{
        marginTop: 22, fontSize: 11.5, color: 'var(--text-muted)',
        textAlign: 'center', lineHeight: 1.8,
      }}>
        보낸 제보는 관리자만 봅니다. 다른 사람에게는 보이지 않습니다.
      </div>
    </div>
  );
}
