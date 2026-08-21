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
