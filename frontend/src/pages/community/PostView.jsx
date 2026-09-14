import { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';
import { toast } from '../../components/Toast';
import { confirmDialog } from '../../components/ConfirmModal';
import { whenLabel } from '../CommunityPage';

// 글 하나 + 댓글.
//
// **길을 따로 내지 않았다.** 목록에서 글을 열면 같은 자리에서 바뀐다 —
// 주소를 하나 더 내면 뒤로 가기 · 새로고침 · 공유가 다 딸려오는데, 남에게 보이는
// 글이 처음 생긴 오늘 그것까지 같이 하면 볼 것이 너무 많아진다.
// 지금은 **읽고 · 쓰고 · 지우는 것**만 제대로 되게 한다.
//
// 지우는 힘은 둘이다 — 쓴 사람과 관리자. 관리자가 내린 것은 「관리자가 내렸어요」로
// 남는다. 소리 없이 사라지면 쓴 사람은 자기 글이 안 올라간 줄 알고 또 쓴다.

export default function PostView({ id, onBack }) {
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get(`/community/${id}`);
      setPost(data?.post || null);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
      setFailed(false);
    } catch (err) {
      // 없어진 글과 못 불러온 것은 다르다
      setFailed(err.response?.status === 404 ? 'gone' : true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const { data } = await client.post(`/community/${id}/comments`, { body });
      // **성공했을 때만 비운다** — 실패하고 비면 쓰던 것이 사라진다
      setComments((prev) => [...prev, data.comment]);
      setText('');
    } catch (err) {
      setError(err.response?.data?.error || '달지 못했어요');
    } finally {
      setSending(false);
    }
  };

  const removePost = async () => {
    const ok = await confirmDialog('이 글을 지울까요? 달린 댓글도 같이 사라집니다.',
      { title: '글 지우기', confirmText: '지웁니다', danger: true });
    if (!ok) return;
    try {
      await client.delete(`/community/${id}`);
      toast('지웠어요');
      onBack();
    } catch {
      toast('지우지 못했어요', 'error');
    }
  };

  // 공감. 서버가 돌려준 수로 맞춘다 — 두 기기에서 누르면 내 화면 숫자가 어긋난다
  const toggleLike = async () => {
    try {
      const { data } = post.liked
        ? await client.delete(`/community/${id}/like`)
        : await client.post(`/community/${id}/like`);
      setPost((p) => ({ ...p, likes: data.likes, liked: data.liked }));
    } catch (err) {
      toast(err.response?.data?.error || '누르지 못했어요', 'error');
    }
  };

  // 신고. **까닭을 고르는 칸은 누른 다음에야 펼친다** — 늘 펼쳐두면 글보다 신고가 크게 보인다
  const [reporting, setReporting] = useState(false);
  const report = async (reason) => {
    try {
      const { data } = await client.post(`/community/${id}/report`, { reason });
      toast(data?.message || '알려주셔서 고맙습니다');
      setReporting(false);
    } catch (err) {
      toast(err.response?.data?.error || '신고하지 못했어요', 'error');
    }
  };

  // ── 고치기 ──
  //
  // 서버는 처음부터 받고 있었는데(`PUT /community/:id`) **화면에 길이 없었다.** 오타 하나를
  // 고치려면 지우고 다시 써야 했고, 그러면 달린 댓글과 공감이 같이 날아갔다.
  // 갈래는 여기서 안 바꾼다 — 「질문」을 「자유」로 옮기는 일은 드물고, 칸이 늘면 고치러 온
  // 사람이 볼 것이 는다
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const startEdit = () => {
    setEditTitle(post.title || '');
    setEditBody(post.body || '');
    setEditError('');
    setReporting(false);
    setEditing(true);
  };

  // **성공했을 때만 닫는다** — 실패하고 닫히면 고치던 글이 사라진다
  const saveEdit = async () => {
    if (editSaving) return;
    if (!editTitle.trim()) { setEditError('제목을 적어주세요'); return; }
    if (!editBody.trim()) { setEditError('내용을 적어주세요'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      const { data } = await client.put(`/community/${id}`, { title: editTitle.trim(), body: editBody.trim() });
      setPost((p) => ({ ...p, title: data.post.title, body: data.post.body, updated_at: data.post.updated_at }));
      setEditing(false);
      toast('고쳤어요');
    } catch (err) {
      setEditError(err.response?.data?.error || '고치지 못했어요');
    } finally {
      setEditSaving(false);
    }
  };

  // 관리자가 남의 글을 내린다. 지우지 않고 「관리자가 내렸어요」로 남는다
  const takeDown = async () => {
    const ok = await confirmDialog('이 글을 내릴까요? 쓴 사람에게는 「관리자가 내렸어요」로 보입니다.',
      { title: '글 내리기', confirmText: '내립니다', danger: true });
    if (!ok) return;
    try {
      await client.delete(`/community/${id}`);
      toast('내렸어요');
      load();
    } catch {
      toast('내리지 못했어요', 'error');
    }
  };

  const removeComment = async (cid) => {
    const ok = await confirmDialog('이 댓글을 지울까요?',
      { title: '댓글 지우기', confirmText: '지웁니다', danger: true });
    if (!ok) return;
    try {
      await client.delete(`/community/comments/${cid}`);
      setComments((prev) => prev.filter((c) => c.id !== cid));
    } catch {
      toast('지우지 못했어요', 'error');
    }
  };

  const back = (
    <button
      onClick={onBack}
      className="btn-secondary"
      style={{ width: 'auto', padding: '6px 14px', fontSize: 12.5, marginBottom: 14 }}
    >← 목록</button>
  );

  if (loading) {
    return <div>{back}<div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>불러오는 중…</div></div>;
  }
  if (failed === 'gone' || !post) {
    return (
      <div>{back}
        <div className="card">
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>없는 글이에요</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>쓴 사람이 지웠거나 관리자가 내렸습니다.</div>
        </div>
      </div>
    );
  }
  if (failed) {
    return (
      <div>{back}
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>글을 못 불러왔어요</div>
          <button className="btn-secondary" style={{ width: 'auto', marginTop: 9, fontSize: 12, padding: '6px 14px' }}
            onClick={load}>다시 불러오기</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {back}

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 7 }}>
          {/* 공지는 목록에서처럼 채운 딱지 — 목록에서 본 것과 열어서 본 것이 같아야 한다 */}
          <span style={{
            fontSize: 10.5,
            color: post.notice ? 'var(--on-accent)' : 'var(--accent)',
            background: post.notice ? 'var(--accent)' : 'none',
            border: `1px solid ${post.notice ? 'var(--accent)' : 'var(--border-hover)'}`,
            padding: '1px 7px',
          }}>{post.kind}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)' }}>
            {whenLabel(post.created_at)}
          </span>
        </div>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <input
              className="input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value.slice(0, 80))}
              aria-label="제목"
            />
            <textarea
              className="input"
              value={editBody}
              onChange={(e) => setEditBody(e.target.value.slice(0, 4000))}
              aria-label="내용"
              style={{ minHeight: 150, lineHeight: 1.75, resize: 'vertical', fontFamily: 'inherit' }}
            />
            {editError && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>{editError}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{editBody.length}/4000</span>
              <button className="btn-secondary" style={{ width: 'auto', marginLeft: 'auto', fontSize: 12.5, padding: '8px 16px' }}
                onClick={() => setEditing(false)}>취소</button>
              <button className="btn-primary" style={{ width: 'auto', fontSize: 13, padding: '8px 20px' }}
                disabled={editSaving} onClick={saveEdit}>{editSaving ? '고치는 중…' : '고치기'}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="display-sm" style={{ color: 'var(--text-primary)', marginBottom: 5 }}>{post.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 13 }}>
              {post.nickname}
              {/* 고친 글은 고쳤다고 적는다 — 댓글이 고치기 전 글에 단 것일 수 있다 */}
              {!post.taken_down && post.updated_at && post.updated_at !== post.created_at && (
                <span style={{ color: 'var(--text-muted)' }}> · 고침</span>
              )}
            </div>

            {post.taken_down ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--danger)', lineHeight: 1.8 }}>
                  관리자가 내린 글이에요.
                </div>
                {/* 쓴 사람과 관리자에게는 서버가 본문을 준다 — 무엇이 내려갔는지는 알아야 한다 */}
                {post.body && (
                  <div style={{
                    fontSize: 13, lineHeight: 1.8, color: 'var(--text-muted)', marginTop: 8,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    borderLeft: '2px solid var(--border)', paddingLeft: 10,
                  }}>{post.body}</div>
                )}
              </>
            ) : (
              // 적은 그대로 보여준다 — 줄바꿈이 곧 그 사람의 글이다
              <div style={{
                fontSize: 14, lineHeight: 1.85, color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>{post.body}</div>
            )}
          </>
        )}

        {/* 내려간 내 글도 지울 수는 있어야 한다 — 예전에는 단추째 사라져서 못 지웠다 */}
        {!editing && (post.mine || !post.taken_down) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {post.mine ? (
              <>
                {!post.taken_down && (
                  <button
                    className="btn-secondary"
                    style={{ width: 'auto', fontSize: 12, padding: '6px 14px' }}
                    onClick={startEdit}
                  >고치기</button>
                )}
                <button
                  className="btn-secondary"
                  style={{ width: 'auto', fontSize: 12, padding: '6px 14px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  onClick={removePost}
                >지우기</button>
                {post.likes > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent)' }}>공감 {post.likes}</span>
                )}
              </>
            ) : (
              <>
                {/* 내 글에는 안 그린다 — 누를 수 없는 것을 그려두면 눌러보고 안 된다 */}
                <button
                  onClick={toggleLike}
                  aria-pressed={!!post.liked}
                  aria-label={post.liked ? '공감 취소' : '공감'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${post.liked ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)', padding: '6px 14px',
                    color: post.liked ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 12.5,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"
                    fill={post.liked ? 'currentColor' : 'none'} stroke="currentColor"
                    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19.4S4.6 15.2 4.6 10.2a3.9 3.9 0 0 1 7.4-1.8 3.9 3.9 0 0 1 7.4 1.8c0 5-7.4 9.2-7.4 9.2z" />
                  </svg>
                  공감{post.likes > 0 ? ` ${post.likes}` : ''}
                </button>
                {post.canModerate && (
                  <button
                    onClick={takeDown}
                    style={{
                      background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)',
                      borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: 12,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >내리기</button>
                )}
                {!post.notice && (
                  <button
                    onClick={() => setReporting((v) => !v)}
                    aria-expanded={reporting}
                    style={{
                      marginLeft: 'auto', background: 'none', border: 'none', padding: 0,
                      fontSize: 11.5, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >{reporting ? '닫기' : '신고'}</button>
                )}
              </>
            )}
          </div>
        )}

        {reporting && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              무엇이 문제인가요? 누가 신고했는지는 쓴 사람에게 알리지 않아요.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Array.isArray(post.reasons) ? post.reasons : []).map((r) => (
                <button
                  key={r}
                  className="btn-secondary"
                  style={{ width: 'auto', padding: '5px 12px', fontSize: 12 }}
                  onClick={() => report(r)}
                >{r}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="section-title">
        <div className="accent-bar" />
        댓글
        {comments.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Barlow', sans-serif", letterSpacing: 0 }}>
            {comments.length}개
          </span>
        )}
      </div>

      {comments.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
          아직 댓글이 없어요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {comments.map((c) => (
            <div key={c.id} className="card" style={{ padding: '11px 13px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.nickname}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{whenLabel(c.created_at)}</span>
                {/* 관리자는 남의 댓글도 지운다. 서버는 받는데 화면에 단추가 없었다 */}
                {(c.mine || post.canModerate) && (
                  <button
                    onClick={() => removeComment(c.id)}
                    style={{
                      marginLeft: 'auto', background: 'none', border: 'none', padding: 0,
                      fontSize: 11.5, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >지우기</button>
                )}
              </div>
              <div style={{
                fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>{c.body}</div>
            </div>
          ))}
        </div>
      )}

      {!post.taken_down && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <textarea
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            placeholder="댓글을 적어주세요"
            aria-label="댓글"
            style={{ minHeight: 70, lineHeight: 1.75, resize: 'vertical', fontFamily: 'inherit' }}
          />
          {error && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{text.length}/500</span>
            <button
              className="btn-primary"
              style={{ width: 'auto', marginLeft: 'auto', fontSize: 13, padding: '8px 20px' }}
              disabled={sending || !text.trim()}
              onClick={send}
            >{sending ? '다는 중…' : '달기'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
