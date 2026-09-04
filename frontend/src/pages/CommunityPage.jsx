import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { toast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmModal';
import PostView from './community/PostView';

// 커뮤니티 — 같이 하는 사람들이 쓰는 자리.
//
// **이 앱에서 남에게 보이는 첫 글이다.** 그동안 사람이 쓴 글은 전부 자기만 보는
// 것이었다 — 운동 기록 · 그날 메모 · 루틴 메모 · 제보(본인과 관리자만).
// 그래서 화면 규칙 하나가 새로 필요하다: **누가 썼는지가 보여야 한다.**
//
// 목록에 본문을 안 싣는다. 스무 개의 본문을 다 실으면 목록 한 번에 몇십 KB 다.
// 서버가 첫 줄만 잘라 보낸다(`excerpt`).
//
// **쪽 번호를 안 쓴다.** 글이 하나 올라오면 번호가 밀려서 같은 글을 두 번 본다.
// 마지막으로 본 글보다 앞엣것을 달라고 한다(`?before=`).

const KIND_ALL = '전체';

// 언제 썼나. **몇 시 몇 분까지 안 적는다** — 목록에서 필요한 것은 「최근인가」다
function whenLabel(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const min = Math.floor((Date.now() - then.getTime()) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return `${then.getMonth() + 1}월 ${then.getDate()}일`;
}

// `embedded` — 홈페이지의 「커뮤니티」 갈래로 들어가 있다 (`pages/SitePage.jsx`).
// 그때는 제목을 홈페이지가 들고 있다
export default function CommunityPage({ embedded = false }) {
  const [posts, setPosts] = useState([]);
  const [kinds, setKinds] = useState([]);
  const [kind, setKind] = useState(KIND_ALL);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  // **못 불러온 것과 없는 것은 다르다.** 없다고 하면 「첫 글을 써보세요」가 뜨는데,
  // 글이 있는 사람에게 그 말은 틀린 말이다
  const [failed, setFailed] = useState(false);

  const [openId, setOpenId] = useState(null);
  const [writing, setWriting] = useState(false);

  const load = useCallback(async (k = kind, before = null) => {
    setLoading(true);
    try {
      const params = {};
      if (k !== KIND_ALL) params.kind = k;
      if (before) params.before = before;
      const { data } = await client.get('/community', { params });
      // **막는 것을 부르는 자리에 둔다.** 서버가 배열이 아닌 것을 주면 목록을
      // 그리는 쪽이 통째로 죽는다 — 이 앱에서 세 번 나온 종류다
      const list = Array.isArray(data?.posts) ? data.posts : [];
      if (before) setPosts((prev) => [...prev, ...list]);
      else setPosts(list);
      setMore(!!data?.more);
      setKinds(Array.isArray(data?.kinds) ? data.kinds : []);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => { load(kind, null); }, [kind]);   // eslint-disable-line

  const pickKind = (k) => { setPosts([]); setKind(k); };

  if (openId != null) {
    return (
      <PostView
        id={openId}
        onBack={() => { setOpenId(null); load(kind, null); }}
      />
    );
  }

  return (
    <div>
      {!embedded && (
        <div className="section-title">
          <div className="accent-bar" />
          커뮤니티
        </div>
      )}

      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 14 }}>
        같이 하는 사람들이 쓰는 자리예요. <span style={{ color: 'var(--text-secondary)' }}>여기 쓴 글은 남이 읽습니다.</span>
      </div>

      {/* 갈래 — 적게 둔다. 많으면 어디에 쓸지 고르다 안 쓴다 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {[KIND_ALL, ...kinds].map((k) => (
          <button
            key={k}
            className={`btn-secondary${kind === k ? ' active' : ''}`}
            style={{ width: 'auto', padding: '6px 14px', fontSize: 12.5 }}
            aria-pressed={kind === k}
            onClick={() => pickKind(k)}
          >{k}</button>
        ))}
      </div>

      {writing ? (
        <PostForm
          kinds={kinds}
          onClose={() => setWriting(false)}
          onDone={() => { setWriting(false); load(kind, null); }}
        />
      ) : (
        <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => setWriting(true)}>
          글 쓰기
        </button>
      )}

      {loading && posts.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          불러오는 중…
        </div>
      ) : failed ? (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>글을 못 불러왔어요</div>
          <button className="btn-secondary" style={{ width: 'auto', marginTop: 9, fontSize: 12, padding: '6px 14px' }}
            onClick={() => load(kind, null)}>다시 불러오기</button>
        </div>
      ) : posts.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
          {kind === KIND_ALL
            ? '아직 글이 없어요. 첫 글을 써보세요.'
            : `「${kind}」에 아직 글이 없어요.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {posts.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpenId(p.id)}
              className="card clickable"
              style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 4 }}>
                <span style={{
                  fontSize: 10.5, color: 'var(--accent)',
                  border: '1px solid var(--border-hover)', padding: '1px 7px',
                }}>{p.kind}</span>
                {p.mine && (
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>내 글</span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                  {whenLabel(p.created_at)}
                </span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{p.title}</div>
              {p.excerpt && (
                <div style={{
                  fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{p.excerpt}</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{p.nickname}</span>
                {p.comments > 0 && (
                  <span style={{ fontSize: 11.5, color: 'var(--accent)' }}>댓글 {p.comments}</span>
                )}
              </div>
            </button>
          ))}

          {more && (
            <button
              className="btn-secondary"
              style={{ marginTop: 4, padding: '10px 0', fontSize: 13 }}
              disabled={loading}
              onClick={() => load(kind, posts[posts.length - 1]?.id)}
            >{loading ? '불러오는 중…' : '더 보기'}</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── 쓰는 칸 ──
//
// **성공했을 때만 닫는다** — 실패하고 닫히면 쓰던 글이 사라진다.
// 이 앱이 메모 · 이름 바꾸기에서 지켜온 규칙이고, 여기는 글이 더 길어서 더 아프다.
function PostForm({ kinds, onClose, onDone }) {
  const [kind, setKind] = useState(kinds[0] || '자유');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (saving) return;
    if (!title.trim()) { setError('제목을 적어주세요'); return; }
    if (!body.trim()) { setError('내용을 적어주세요'); return; }
    setSaving(true);
    setError('');
    try {
      await client.post('/community', { kind, title: title.trim(), body: body.trim() });
      toast('올렸어요');
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || '올리지 못했어요');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {kinds.map((k) => (
          <button
            key={k}
            className={`btn-secondary${kind === k ? ' active' : ''}`}
            style={{ width: 'auto', padding: '5px 13px', fontSize: 12 }}
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >{k}</button>
        ))}
      </div>

      <input
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, 80))}
        placeholder="제목"
        aria-label="제목"
      />
      <textarea
        className="input"
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 4000))}
        placeholder="무슨 이야기든 좋아요. 오늘 뭘 했는지, 뭐가 안 되는지."
        aria-label="내용"
        style={{ minHeight: 130, lineHeight: 1.75, resize: 'vertical', fontFamily: 'inherit' }}
      />

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{body.length}/4000</span>
        <button className="btn-secondary" style={{ width: 'auto', marginLeft: 'auto', fontSize: 12.5, padding: '8px 16px' }}
          onClick={onClose}>취소</button>
        <button className="btn-primary" style={{ width: 'auto', fontSize: 13, padding: '8px 20px' }}
          disabled={saving} onClick={submit}>{saving ? '올리는 중…' : '올리기'}</button>
      </div>
    </div>
  );
}

export { whenLabel };
