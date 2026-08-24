import { useState, useMemo, useEffect } from 'react';
import client from '../../api/client';
import { useReportStore } from '../../store/reportStore';
import { FAQ, matchFaq } from './faq';
import { useIntroStats } from './introData';
import { usePachinkoStore } from '../../store/pachinkoStore';
import { usePlateStore } from '../../store/plateStore';
import { earnedTickets, ticketsAvailable, ticketText } from '../../data/pachinkoData';
import pkg from '../../../package.json';

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

const KINDS = [
  {
    key: 'bug', label: '버그', icon: '🐞', desc: '안 되거나 이상하게 나오는 것',
    titleLabel: '무슨 일이 있었나요',
    titleHint: '한 줄로 요약해 주세요',
    bodyLabel: '어떻게 하면 그렇게 되나요',
    bodyHint: '언제, 어디서, 무엇을 했더니 어떻게 됐는지 적어주시면 훨씬 빨리 찾습니다.\n예) 파칭코에서 10판 연속으로 돌리다가 결과창 확인 버튼이 안 먹었어요',
    minBody: 10, send: '버그 보내기', attachDefault: true,
    attachNote: '기기와 화면 정보가 있으면 재현이 훨씬 빠릅니다',
  },
  {
    key: 'ask', label: '문의', icon: '💬', desc: '어떻게 쓰는지 모르겠는 것',
    titleLabel: '무엇이 궁금한가요',
    titleHint: '예) 초월 레벨은 어떻게 여나요?',
    bodyLabel: '덧붙일 말 (없으면 비워두세요)',
    bodyHint: '더 설명할 게 있으면 적어주세요. 없으면 비워두셔도 됩니다.',
    minBody: 0, send: '문의 보내기', attachDefault: false,
    attachNote: '문의에는 보통 필요 없습니다',
  },
  {
    key: 'idea', label: '건의', icon: '💡', desc: '이렇게 됐으면 하는 것',
    titleLabel: '무엇이 있었으면 하나요',
    titleHint: '예) 루틴에 메모를 남기고 싶어요',
    bodyLabel: '왜 필요한가요',
    bodyHint: '어떤 상황에서 아쉬웠는지 적어주시면 판단이 쉽습니다.',
    minBody: 5, send: '건의 보내기', attachDefault: false,
    attachNote: '건의에는 보통 필요 없습니다',
  },
];

const kindOf = key => KINDS.find(k => k.key === key) || KINDS[0];

// 버그 전용 — 어느 화면인지
const SCREENS = ['홈', '기록', '인바디', '루틴', '홈트', '측정', '히스토리', '파칭코', '미니게임', '그 밖에'];

// 버그 전용 — 다시 해도 그런지. 한 번뿐이면 우선순위가 다르다
const FREQ = [
  { key: 'always',    label: '매번 그래요' },
  { key: 'sometimes', label: '가끔 그래요' },
  { key: 'once',      label: '한 번만 그랬어요' },
];

// 건의 전용 — 지금은 어떻게 버티고 있는지. 대안이 있으면 급하지 않다
const WORKAROUND = [
  { key: 'none',   label: '방법이 없어요' },
  { key: 'clumsy', label: '불편하게 돌려서 해요' },
  { key: 'okay',   label: '그냥 없어도 돼요' },
];

const STATUS = {
  received: { label: '접수',     color: 'var(--info)',       dim: 'var(--info-dim)' },
  checking: { label: '확인중',   color: 'var(--warning)',    dim: 'var(--warning-dim)' },
  done:     { label: '처리완료', color: 'var(--success)',    dim: 'var(--success-dim)' },
  held:     { label: '보류',     color: 'var(--text-muted)', dim: 'var(--bg-tertiary)' },
};

// 서버가 주는 날짜는 ISO 문자열이다. 화면에는 날짜만 쓴다
const dayOf = iso => (typeof iso === 'string' ? iso.slice(0, 10) : '');

// 제보에 붙는 기기 정보. 체크했을 때만 보낸다.
// 재현에 실제로 쓰는 것만 담는다 — 무엇을 보내는지 화면에 그대로 적어둔다.
function useDeviceInfo() {
  const stats = useIntroStats();
  const used = usePachinkoStore(s => s.used);
  const purchased = usePlateStore(s => s.purchased);
  const unlimited = usePlateStore(s => s.unlimited);
  return useMemo(() => {
    const earned = earnedTickets(stats.totalWorkouts, stats.totalInbody, purchased);
    return {
      appVersion: pkg.version,
      browser: `${navigator.userAgent} · ${window.innerWidth}x${window.innerHeight}`,
      level: String(stats.lv?.level ?? ''),
      tickets: ticketText(ticketsAvailable({ earned, used, unlimited }), unlimited),
    };
  }, [stats.totalWorkouts, stats.totalInbody, stats.lv, used, purchased, unlimited]);
}


// ── 먼저 물어본다 ──
//
// 유형을 고르기 전에 한 번 묻는다. 답이 이미 있는 질문을 제보로 받으면 물어본 사람은
// 며칠을 기다리고, 답하는 쪽은 같은 답을 또 쓴다. 여기서 끝나면 둘 다 안 한다.
//
// 막지는 않는다 — 답을 못 찾았으면 그대로 유형을 골라 적으면 된다.
// 「찾는 게 없다」 를 누르게 하지도 않는다. 그런 관문은 사람을 돌려보내는 데만 쓰인다.
function AskFirst() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const typed = q.trim().length >= 2;
  const hits = typed ? matchFaq(q) : [];
  const list = typed ? hits : (showAll ? FAQ : []);

  return (
    <div style={{ paddingTop: 18 }}>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
        무엇이 궁금하세요?
      </div>
      <input
        className="input"
        value={q}
        onChange={e => setQ(e.target.value.slice(0, 40))}
        placeholder="예) 티켓, 레벨, 기록이 사라졌어요"
        style={{ marginBottom: 10 }}
      />

      {typed && hits.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.75, padding: '4px 0 8px' }}>
          여기에는 답이 없네요. 위에서 유형을 고르고 적어주시면 확인하고 답을 답니다.
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
          onClick={() => setShowAll(v => !v)}
          style={{
            background: 'none', border: 'none', padding: '6px 0 0', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 12.5,
          }}
        >{showAll ? '접기' : `자주 묻는 것 ${FAQ.length}가지 펼쳐보기`}</button>
      )}

      <div style={{
        fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.75,
        borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 12,
      }}>
        여기서 못 찾으셨으면 위에서 유형을 골라주세요.<br />
        버그는 재현할 정보를, 문의는 질문만, 건의는 아쉬웠던 상황을 받습니다.
      </div>
    </div>
  );
}

// embedded — 고객센터 안에 한 섹션으로 얹을 때 쓴다.
export default function ReportBox({ embedded = false }) {
  const [kind, setKind] = useState('');
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
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sent, setSent] = useState(false);
  // 제목을 치는 동안 답이 이미 있는 질문인지 찾아본다
  const [openHint, setOpenHint] = useState(null);

  const k = kind ? kindOf(kind) : null;

  // 제목에서 자주 묻는 것을 찾는다. 두 개까지만 — 세 개가 넘으면 폼 위에 답이 쌓여
  // 무엇을 적으러 왔는지가 가려진다
  const titleHits = useMemo(() => matchFaq(title, 2), [title]);

  // 고객센터가 이미 불러왔으면 진행 중인 요청에 얹힌다 (store 가 하나로 묶는다)
  useEffect(() => { fetchReports(); }, [fetchReports]);

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

  // 보낸 제보 지우기. 한 번 더 묻는다 — 되돌릴 수 없고, 카드를 누르면 펼쳐지는
  // 화면이라 손가락이 스칠 자리다
  const [confirmDel, setConfirmDel] = useState(null);
  const [sendError, setSendError] = useState('');

  // 먼저 화면에서 지우고 서버에 알린다. 실패하면 되돌린다 —
  // 지운 줄 알았는데 새로고침하면 살아 있는 것이 제일 나쁘다
  const removeItem = async (id) => {
    const prev = items;
    setItems(prev.filter(i => i.id !== id));
    setConfirmDel(null);
    if (open === id) setOpen(null);
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
      setOpen(data.id);
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

  // 목록은 최신이 위다. 예시 세 건이 날짜 오름차순으로 적혀 있는데 새 제보는 맨 위에 붙어서,
  // 하나만 보내도 순서가 섞였다. 보여줄 때 한 번 세운다 — 서버에 붙이면 서버가 정렬해 준다.
  const shown = useMemo(() => {
    const list = filter === 'all' ? items : items.filter(i => i.status === filter);
    return [...list].sort((a, b) => b.id - a.id);
  }, [items, filter]);
  const counts = useMemo(() => {
    const c = { all: items.length };
    for (const key of Object.keys(STATUS)) c[key] = items.filter(i => i.status === key).length;
    return c;
  }, [items]);

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
              <span style={{ fontSize: 26 }}>📮</span>
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
                <div style={{ fontSize: 17, marginBottom: 3 }}>{x.icon}</div>
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
                borderRadius: 'var(--radius)', color: '#000',
                fontSize: 11, lineHeight: '15px', textAlign: 'center',
              }}>{attach ? '✓' : ''}</div>
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 3 }}>
                  기기 정보를 같이 보냅니다
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  {k.attachNote} · 앱 버전 · 브라우저 · 레벨 · 티켓 수
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

      {/* ─── 내 제보 ─── */}
      <div className="section-title">
        <div className="accent-bar" />
        내 제보
        <span style={{
          fontFamily: "'Barlow', sans-serif", fontSize: 12, letterSpacing: 0,
          color: 'var(--text-muted)', marginLeft: 'auto',
        }}>{items.length}건</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['all', '전체'], ...Object.entries(STATUS).map(([key, v]) => [key, v.label])].map(([key, label]) => {
          const on = filter === key;
          const color = key === 'all' ? 'var(--accent)' : STATUS[key].color;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                borderRadius: 'var(--radius)',
                border: `1px solid ${on ? color : 'var(--border)'}`,
                background: on ? color : 'transparent',
                color: on ? '#000' : 'var(--text-secondary)',
                fontWeight: on ? 700 : 400, transition: 'all 0.15s',
              }}
            >
              {label} {counts[key] || 0}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '34px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
          불러오는 중…
        </div>
      ) : loadFailed ? (
        <div className="card" style={{ textAlign: 'center', padding: '34px 20px' }}>
          <div style={{ fontSize: 30, marginBottom: 10, opacity: 0.4 }}>📡</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            제보를 불러오지 못했습니다.<br />없어진 게 아니라 못 가져온 것이니, 새로고침해 주세요.
          </div>
        </div>
      ) : shown.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '34px 20px' }}>
          <div style={{ fontSize: 30, marginBottom: 10, opacity: 0.4 }}>📭</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            {filter === 'all' ? '아직 보낸 제보가 없습니다.' : `'${STATUS[filter].label}' 인 제보가 없습니다.`}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(item => {
            const st = STATUS[item.status];
            const kd = kindOf(item.kind);
            const isOpen = open === item.id;
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
                style={{ padding: 14, borderColor: isOpen ? 'var(--border-hover)' : 'var(--border)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
                    padding: '2px 7px', borderRadius: 'var(--radius)',
                    background: st.dim, color: st.color, border: `1px solid ${st.color}`,
                  }}>{st.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{kd.icon} {kd.label}</span>
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
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = confirmDel === item.id ? 'var(--danger)' : 'var(--text-muted)'; }}
                  >지우기</button>
                </div>

                <div style={{
                  fontSize: 14.5, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.45,
                  ...(isOpen ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
                }}>{item.title}</div>

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
                      onClick={e => { e.stopPropagation(); removeItem(item.id); }}
                      style={{
                        background: 'var(--danger)', border: '1px solid var(--danger)',
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

                    {item.reply ? (
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

      <div style={{
        marginTop: 22, fontSize: 11.5, color: 'var(--text-muted)',
        textAlign: 'center', lineHeight: 1.8,
      }}>
        보낸 제보는 관리자만 봅니다. 다른 사람에게는 보이지 않습니다.
      </div>
    </div>
  );
}
