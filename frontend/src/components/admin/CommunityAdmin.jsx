import { useState, useEffect } from 'react';
import client from '../../api/client';
import { toast } from '../Toast';
import { confirmDialog } from '../ConfirmModal';

// ─────────────────────────────────────────────────────────────
// 커뮤니티 — 신고함과 짜증 섞인 말로 올라온 글.
//
// 신고 API 는 서버에 있었는데 **여기 화면이 없었다.** 사람이 신고를 눌러도
// 관리자는 볼 길이 없었다 — 받기만 하고 안 읽는 우편함이다.
//
// **여럿이 눌렀다고 글이 저절로 내려가지 않는다.** 내리는 것은 여기서 사람이 한다.
// 할 수 있는 것은 둘이다 —
//   내리기  — 글은 「관리자가 내렸어요」로 남는다. 소리 없이 사라지면 쓴 사람이 또 쓴다
//   확인함  — 봤고 둘 만하다. 목록에서 흐려진다
// ─────────────────────────────────────────────────────────────

const day = iso => (typeof iso === 'string' ? iso.slice(0, 10) : '');

export default function CommunityAdmin() {
  const [rows, setRows] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [loading, setLoading] = useState(true);
  // **못 불러온 것과 없는 것은 다르다** — 신고함이 비었다고 읽게 두면 안 된다
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, f] = await Promise.all([
        client.get('/community/admin/reports'),
        client.get('/community/admin/flagged'),
      ]);
      setRows(Array.isArray(r.data) ? r.data : []);
      setFlagged(Array.isArray(f.data) ? f.data : []);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // 한 글에 달린 신고를 한 번에 확인한다. 신고 하나씩 누르게 두면 셋이면 세 번 누른다
  const review = async (row) => {
    setBusy(row.postId);
    try {
      await Promise.all(row.ids.map(id => client.patch('/community/admin/reports/' + id)));
      setRows(prev => prev.map(x => (x.postId === row.postId ? { ...x, open: 0 } : x)));
      toast('확인했어요');
    } catch (err) {
      toast(err.response?.data?.error || '바꾸지 못했어요', 'error');
      load();
    } finally {
      setBusy(null);
    }
  };

  const takeDown = async (postId, title) => {
    const ok = await confirmDialog(`「${title}」을 내릴까요? 쓴 사람에게는 「관리자가 내렸어요」로 보입니다.`,
      { title: '글 내리기', confirmText: '내립니다', danger: true });
    if (!ok) return;
    setBusy(postId);
    try {
      await client.delete('/community/' + postId);
      toast('내렸어요');
      load();
    } catch (err) {
      toast(err.response?.data?.error || '내리지 못했어요', 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>불러오는 중…</div>;
  }
  if (failed) {
    return (
      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>커뮤니티 신고함을 못 불러왔어요</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>신고가 없는 것과는 다릅니다</div>
        <button className="btn-secondary" style={{ width: 'auto', marginTop: 9, fontSize: 12, padding: '6px 14px' }}
          onClick={load}>다시 불러오기</button>
      </div>
    );
  }

  const open = rows.filter(r => r.open > 0).length;

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        신고함
        <span style={{ marginLeft: 'auto', fontSize: 12, color: open > 0 ? 'var(--danger)' : 'var(--text-muted)', fontFamily: "'Barlow', sans-serif", letterSpacing: 0 }}>
          {open > 0 ? `확인 안 함 ${open}` : '다 봤어요'}
        </span>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22 }}>들어온 신고가 없어요.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
          {rows.map(r => (
            <div key={r.postId} className="card" style={{
              padding: '12px 14px',
              opacity: r.open === 0 ? 0.55 : 1,
              borderColor: r.open > 0 && r.loud ? 'var(--danger)' : undefined,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{
                  fontSize: 10.5, padding: '1px 7px', borderRadius: 'var(--radius)',
                  color: r.loud ? 'var(--danger)' : 'var(--warning)',
                  border: `1px solid ${r.loud ? 'var(--danger)' : 'var(--warning)'}`,
                }}>신고 {r.count}</span>
                {r.takenDown && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>내린 글</span>}
                {r.gone && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>쓴 사람이 지움</span>}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{day(r.last)}</span>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>{r.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3 }}>
                {r.nickname ? r.nickname + ' · ' : ''}{r.reasons.join(' / ')}
              </div>

              {r.open > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {!r.gone && !r.takenDown && (
                    <button
                      className="btn-secondary"
                      style={{ width: 'auto', fontSize: 12, padding: '6px 13px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                      disabled={busy === r.postId}
                      onClick={() => takeDown(r.postId, r.title)}
                    >내리기</button>
                  )}
                  <button
                    className="btn-secondary"
                    style={{ width: 'auto', fontSize: 12, padding: '6px 13px' }}
                    disabled={busy === r.postId}
                    onClick={() => review(r)}
                  >{r.gone || r.takenDown ? '확인함' : '둘 만하다 · 확인함'}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="section-title">
        <div className="accent-bar" />
        짜증 섞인 말로 올라온 글
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.7 }}>
        막지는 않았습니다. 남이 읽는 자리라 흐름만 봅니다.
      </div>
      {flagged.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>없어요.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {flagged.map(p => (
            <div key={p.id} className="card" style={{ padding: '11px 14px', opacity: p.taken_down ? 0.55 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 10.5, color: 'var(--accent)' }}>{p.kind}</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{day(p.created_at)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{p.nickname}</span>
                {p.taken_down ? (
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>내린 글</span>
                ) : (
                  <button
                    onClick={() => takeDown(p.id, p.title)}
                    disabled={busy === p.id}
                    style={{
                      marginLeft: 'auto', background: 'none', border: '1px solid var(--border)',
                      color: 'var(--danger)', padding: '3px 10px', fontSize: 11,
                      borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >내리기</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
