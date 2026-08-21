import { useState, useMemo, useEffect } from 'react';
import { dateKey } from '../../data/dateKey';

// ─────────────────────────────────────────────────────────────
// 제보함 시안
//
// 아직 앱에 붙이지 않았다. /preview/report 로 따로 보거나,
// 홈페이지 시안 안에 embedded 로 얹힌다. 개발 빌드 전용.
//
// 저장은 전부 이 컴포넌트의 state 다 — 서버로 아무것도 안 보낸다.
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

const SEED = [
  {
    id: 24, kind: 'bug', status: 'done', date: '2026-08-18',
    title: '파칭코 결과창이 가끔 안 닫혀요',
    body: '연속으로 10판 돌리다가 결과창 확인 버튼이 안 먹었습니다. 새로고침하니까 티켓은 그대로였어요.',
    meta: { screen: '파칭코', freq: 'sometimes' },
    reply: { date: '2026-08-19', text: '연출 중에 페이지를 벗어나면 정산이 두 번 걸리던 문제였습니다. 고쳐서 올렸어요. 티켓은 정상 차감된 게 맞습니다.' },
  },
  {
    id: 23, kind: 'bug', status: 'checking', date: '2026-08-19',
    title: '교환소에서 최대를 꾹 누르면 안 멈춰요',
    body: '무한 티켓 상태에서 최대 버튼을 누르고 있으면 울트라 티켓이 계속 늘어납니다.',
    meta: { screen: '파칭코', freq: 'always' },
    reply: null,
  },
  {
    id: 22, kind: 'idea', status: 'received', date: '2026-08-20',
    title: '루틴에 메모를 남길 수 있으면 좋겠어요',
    body: '그날 컨디션이나 통증 같은 걸 세트 옆에 적어두고 싶습니다.',
    meta: { workaround: 'clumsy' },
    reply: null,
  },
];

// embedded — 홈페이지 시안 안에 한 섹션으로 얹을 때 쓴다.
export default function ReportPreview({ embedded = false }) {
  const [kind, setKind] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [screen, setScreen] = useState('');
  const [freq, setFreq] = useState('');
  const [workaround, setWorkaround] = useState('');
  const [attach, setAttach] = useState(true);
  const [items, setItems] = useState(SEED);
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sent, setSent] = useState(false);

  const k = kind ? kindOf(kind) : null;

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
  const removeItem = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setConfirmDel(null);
    if (open === id) setOpen(null);
  };

  const submit = () => {
    if (blockReason) return;
    const next = {
      id: (items[0]?.id || 0) + 1,
      kind, status: 'received',
      date: dateKey(),
      title: title.trim(), body: body.trim(), reply: null,
      meta: kind === 'bug' ? { screen, freq } : kind === 'idea' ? { workaround } : {},
    };
    setItems([next, ...items]);
    setKind(''); setTitle(''); setBody('');
    setOpen(next.id);
    setSent(true);
    setTimeout(() => setSent(false), 2600);
  };

  // 목록은 최신이 위다. 예시 세 건이 날짜 오름차순으로 적혀 있는데 새 제보는 맨 위에 붙어서,
  // 하나만 보내도 순서가 섞였다. 보여줄 때 한 번 세운다 — 서버에 붙이면 서버가 정렬해 준다.
  const shown = useMemo(() => {
    const list = filter === 'all' ? items : items.filter(i => i.status === filter);
    return [...list].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
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
          <div style={{
            background: 'var(--warning-dim)', border: '1px solid var(--warning)',
            borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 18,
            fontSize: 12, color: 'var(--warning)', lineHeight: 1.6,
          }}>
            ⚠️ <b>시안입니다.</b> 아직 앱에 붙어 있지 않고, 여기서 보낸 제보는 서버로 가지 않습니다 (새로고침하면 사라집니다).
          </div>
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
          <div style={{
            textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5,
            padding: '22px 10px 6px', lineHeight: 1.7,
          }}>
            고르시면 그에 맞춰 물어봅니다.<br />
            버그는 재현할 정보를, 문의는 질문만, 건의는 아쉬웠던 상황을 받습니다.
          </div>
        ) : (
          <>
            <label className="label">{k.titleLabel}</label>
            <input
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, 60))}
              placeholder={k.titleHint}
              style={{ marginBottom: 16 }}
            />

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
              <button className="btn-primary" onClick={submit} disabled={!!blockReason} style={{ flex: 1 }}>
                {sent ? '보냈습니다' : k.send}
              </button>
            </div>
          </>
        )}

        {/* 보내고 나면 폼이 비워지므로 blockReason 이 곧바로 다시 켜진다.
            그대로 두면 성공한 직후에 "유형을 고르세요" 가 떠서 실패한 것처럼 읽힌다. */}
        {sent ? (
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

      {shown.length === 0 ? (
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
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{item.date}</span>
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
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.reply.date}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.75 }}>
                          {item.reply.text}
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
