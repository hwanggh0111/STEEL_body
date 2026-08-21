import { useState, useEffect, useMemo } from 'react';
import client from '../../api/client';
import { toast } from '../Toast';

// ─────────────────────────────────────────────────────────────
// 제보 관리 — 들어온 버그 · 문의 · 건의를 보고 답을 단다.
//
// 사용자가 쓴 내용은 여기서 못 바꾼다. 바꿀 수 있는 건 상태와 답변뿐이다 —
// 제보를 고쳐 쓰기 시작하면 무엇을 받았는지가 남지 않는다.
// 지우기도 없다. 답을 달아야 할 대상이 관리자 손에서 사라지면 안 된다.
// ─────────────────────────────────────────────────────────────

const KIND = {
  bug:  { label: '버그', icon: '🐞', color: 'var(--danger)' },
  ask:  { label: '문의', icon: '💬', color: 'var(--info)' },
  idea: { label: '건의', icon: '💡', color: 'var(--warning)' },
};

const STATUS = {
  received: { label: '접수',     color: 'var(--info)',       dim: 'var(--info-dim)' },
  checking: { label: '확인중',   color: 'var(--warning)',    dim: 'var(--warning-dim)' },
  done:     { label: '처리완료', color: 'var(--success)',    dim: 'var(--success-dim)' },
  held:     { label: '보류',     color: 'var(--text-muted)', dim: 'var(--bg-tertiary)' },
};

const FREQ = { always: '매번 그래요', sometimes: '가끔 그래요', once: '한 번만 그랬어요' };
const WORKAROUND = { none: '방법이 없어요', clumsy: '불편하게 돌려서 해요', okay: '그냥 없어도 돼요' };

const day = iso => (typeof iso === 'string' ? iso.slice(0, 10) : '');

const ABUSE_LEVEL = {
  mild:   { label: '짜증', color: 'var(--text-muted)', note: '막지 않았습니다' },
  severe: { label: '욕설', color: 'var(--warning)',    note: '보내지 못하게 막았습니다' },
  hate:   { label: '비하', color: 'var(--danger)',     note: '첫 번에 7일 정지입니다' },
};

// ── 욕설 · 비하 기록 ──
//
// 판정은 자동이지만 확인은 사람이 한다. 사전은 완전할 수 없고,
// 잘못 잡히면 그 사람은 앱을 못 쓴다. 되돌릴 길이 없으면 자동 처벌을 걸면 안 된다.
//   확인함     — 봤다는 표시. 목록에서 흐려진다
//   사전이 틀렸음 — 누적에서 빼고, 그 때문에 걸린 정지도 같이 푼다
function AbuseLogs() {
  const [logs, setLogs] = useState([]);
  const [openList, setOpenList] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    client.get('/reports/abuse')
      .then(({ data }) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => {});
  };
  useEffect(load, []);

  const mark = async (id, fields, msg) => {
    setBusy(true);
    try {
      const { data } = await client.patch('/reports/abuse/' + id, fields);
      setLogs(prev => prev.map(a => (a.id === data.id ? { ...a, ...data } : a)));
      toast(data.unsuspended > 0 ? msg + ' · 정지도 풀었습니다' : msg);
      if (data.unsuspended > 0) load();
    } catch (err) {
      toast(err.response?.data?.error || '바꾸지 못했어요', 'error');
    } finally {
      setBusy(false);
    }
  };

  // 확인 안 한 것 중에 막힌 것만 센다. 짜증은 처벌이 아니라 참고다
  const pending = logs.filter(a => !a.reviewed && a.level !== 'mild').length;
  if (logs.length === 0) return null;

  return (
    <div className="card" style={{
      padding: '13px 15px', marginBottom: 14,
      borderColor: pending > 0 ? 'var(--danger)' : 'var(--border)',
    }}>
      <div
        onClick={() => setOpenList(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexWrap: 'wrap' }}
      >
        <span style={{ fontSize: 15 }}>🚫</span>
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>욕설 · 비하 기록</span>
        {pending > 0 && (
          <span style={{
            fontSize: 10.5, padding: '1px 7px', borderRadius: 'var(--radius)',
            color: 'var(--danger)', border: '1px solid var(--danger)',
          }}>확인 안 함 {pending}</span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          전체 {logs.length} · {openList ? '접기' : '펼치기'}
        </span>
      </div>

      {openList && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.map(a => {
            const lv = ABUSE_LEVEL[a.level] || ABUSE_LEVEL.severe;
            return (
              <div key={a.id} style={{
                borderTop: '1px solid var(--border)', paddingTop: 10,
                opacity: a.reviewed ? 0.5 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: lv.color }}>{lv.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.action}</span>
                  {a.dismissed && <span style={{ fontSize: 10.5, color: 'var(--success)' }}>오탐 처리됨</span>}
                  {a.suspended && !a.dismissed && <span style={{ fontSize: 10.5, color: 'var(--danger)' }}>정지 중</span>}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {a.nickname || ('회원 ' + a.user_id)} · {day(a.created_at)}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, wordBreak: 'break-all' }}>
                  {a.text}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  걸린 말: {(a.hits || []).join(', ')} · {lv.note}
                </div>
                {!a.dismissed && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {!a.reviewed && (
                      <button
                        disabled={busy}
                        onClick={() => mark(a.id, { reviewed: true }, '확인함으로 표시했습니다')}
                        style={{
                          background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                          padding: '4px 10px', fontSize: 11, borderRadius: 'var(--radius)', cursor: 'pointer',
                        }}
                      >확인함</button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => mark(a.id, { dismissed: true, reviewed: true }, '오탐으로 처리했습니다')}
                      style={{
                        background: 'none', border: '1px solid var(--success)', color: 'var(--success)',
                        padding: '4px 10px', fontSize: 11, borderRadius: 'var(--radius)', cursor: 'pointer',
                      }}
                    >사전이 틀렸음 (정지 해제)</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReportAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState('open');
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    client.get('/reports/all')
      .then(({ data }) => { setItems(Array.isArray(data) ? data : []); setFailed(false); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const counts = useMemo(() => {
    const c = { all: items.length, open: 0 };
    for (const key of Object.keys(STATUS)) c[key] = 0;
    for (const r of items) {
      c[r.status] = (c[r.status] || 0) + 1;
      // 아직 손대지 않은 것. 관리자가 제일 먼저 봐야 할 목록이라 기본 화면으로 둔다
      if (r.status === 'received' || r.status === 'checking') c.open++;
    }
    return c;
  }, [items]);

  const shown = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'open') return items.filter(r => r.status === 'received' || r.status === 'checking');
    return items.filter(r => r.status === filter);
  }, [items, filter]);

  // 상태와 답변은 같은 곳으로 보낸다. 돌아온 레코드로 그 줄만 갈아 끼운다
  const patch = async (id, fields, okMsg) => {
    setSaving(true);
    try {
      const { data } = await client.patch('/reports/' + id, fields);
      setItems(prev => prev.map(r => (r.id === data.id ? data : r)));
      toast(okMsg);
    } catch (err) {
      toast(err.response?.data?.error || '바꾸지 못했어요', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openItem = (r) => {
    const next = open === r.id ? null : r.id;
    setOpen(next);
    setDraft(next ? (r.reply || '') : '');
  };

  const chip = (on, color) => ({
    padding: '7px 12px', fontSize: 12.5, borderRadius: 'var(--radius)',
    border: '1px solid ' + (on ? (color || 'var(--accent)') : 'var(--border)'),
    background: on ? (color || 'var(--accent)') : 'transparent',
    color: on ? '#000' : 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.15s',
  });

  return (
    <div>
      {/* 욕설·비하로 걸린 기록. 자동으로 처리되지만 사람이 한 번 봐야 한다 —
          사전은 완전할 수 없고, 잘못 잡힌 사람은 앱을 못 쓴다 */}
      <AbuseLogs />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          전체 {counts.all}건 · 안 끝난 것 <b style={{ color: 'var(--accent)' }}>{counts.open}</b>건
        </div>
        <button
          onClick={load}
          style={{
            marginLeft: 'auto', background: 'none', border: '1px solid var(--border)',
            color: 'var(--text-muted)', padding: '5px 12px', fontSize: 11.5,
            borderRadius: 'var(--radius)', cursor: 'pointer',
          }}
        >새로 읽기</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['open', '안 끝난 것'], ['all', '전체'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={chip(filter === key)}>
            {label} {counts[key] ?? 0}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '30px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
          불러오는 중…
        </div>
      ) : failed ? (
        <div className="card" style={{ textAlign: 'center', padding: '30px 20px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          제보를 불러오지 못했습니다.<br />없어진 게 아니라 못 가져온 것입니다.
        </div>
      ) : shown.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '30px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
          여기에 해당하는 제보가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(r => {
            const kd = KIND[r.kind] || KIND.bug;
            const st = STATUS[r.status] || STATUS.received;
            const isOpen = open === r.id;

            // 유형마다 물어본 게 다르니 목록에 붙는 꼬리표도 다르다
            const tags = [];
            if (r.kind === 'bug') {
              if (r.meta?.screen) tags.push(r.meta.screen);
              if (FREQ[r.meta?.freq]) tags.push(FREQ[r.meta.freq]);
            } else if (r.kind === 'idea' && WORKAROUND[r.meta?.workaround]) {
              tags.push(WORKAROUND[r.meta.workaround]);
            }

            return (
              <div key={r.id} className="card" style={{ padding: '13px 15px' }}>
                <div onClick={() => openItem(r)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15 }}>{kd.icon}</span>
                    <span style={{ fontSize: 11.5, color: kd.color }}>{kd.label}</span>
                    <span style={{
                      fontSize: 10.5, padding: '1px 7px', borderRadius: 'var(--radius)',
                      color: st.color, background: st.dim, border: '1px solid ' + st.color,
                    }}>{st.label}</span>
                    {r.reply && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>답변함</span>}
                    {/* 짜증 섞인 말로 통과한 제보. 처벌한 게 아니라 눈에만 띄게 한다 */}
                    {r.flagged === 'mild' && (
                      <span style={{ fontSize: 10.5, color: 'var(--warning)' }}>말이 거칠음</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      #{r.id} · 회원 {r.user_id} · {day(r.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 14.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>{r.title}</div>
                  {tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                      {tags.map(t => (
                        <span key={t} style={{
                          fontSize: 10.5, color: 'var(--text-muted)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)', padding: '1px 6px',
                        }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    {r.body && (
                      <div style={{
                        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8,
                        whiteSpace: 'pre-wrap', marginBottom: 12,
                      }}>{r.body}</div>
                    )}

                    {/* 기기 정보 — 보낸 사람이 첨부에 동의했을 때만 있다 */}
                    {r.device && (
                      <div style={{
                        fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7,
                        background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)',
                        padding: '8px 11px', marginBottom: 12, wordBreak: 'break-all',
                      }}>
                        {[
                          r.device.appVersion && ('v' + r.device.appVersion),
                          r.device.level && ('LV ' + r.device.level),
                          r.device.tickets && ('🎫 ' + r.device.tickets),
                        ].filter(Boolean).join(' · ')}
                        {r.device.browser && <div style={{ marginTop: 4 }}>{r.device.browser}</div>}
                      </div>
                    )}

                    <div style={{ fontSize: 11, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 7 }}>상태</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                      {Object.entries(STATUS).map(([key, v]) => (
                        <button
                          key={key}
                          disabled={saving || r.status === key}
                          onClick={() => patch(r.id, { status: key }, v.label + ' 로 바꿨습니다')}
                          style={{ ...chip(r.status === key, v.color), cursor: r.status === key ? 'default' : 'pointer' }}
                        >{v.label}</button>
                      ))}
                    </div>

                    <div style={{ fontSize: 11, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 7 }}>
                      답변 {r.reply_at && <span style={{ letterSpacing: 0 }}>· 마지막 {day(r.reply_at)}</span>}
                    </div>
                    <textarea
                      className="input"
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      rows={4}
                      placeholder="확인한 내용을 그대로 적습니다. 이 글이 보낸 분 화면에 그대로 보입니다."
                      style={{ resize: 'vertical', lineHeight: 1.7, marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn-primary"
                        disabled={saving || !draft.trim() || draft.trim() === (r.reply || '')}
                        onClick={() => patch(r.id, { reply: draft.trim() }, '답변을 달았습니다')}
                        style={{ flex: 1 }}
                      >{saving ? '저장 중…' : r.reply ? '답변 고치기' : '답변 달기'}</button>
                      {r.reply && (
                        <button
                          disabled={saving}
                          onClick={() => { setDraft(''); patch(r.id, { reply: null }, '답변을 지웠습니다'); }}
                          style={{
                            background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                            padding: '0 16px', fontSize: 12, borderRadius: 'var(--radius)', cursor: 'pointer',
                          }}
                        >답변 지우기</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
