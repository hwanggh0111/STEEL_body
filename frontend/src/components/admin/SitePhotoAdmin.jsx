import { useState, useEffect, useRef } from 'react';
import client from '../../api/client';
import { toast } from '../Toast';
import { confirmDialog } from '../ConfirmModal';
import { shrinkImage } from '../../data/shrinkImage';
import { PHOTO_MAX_LABEL } from '../../data/photoLimit';
import NavIcon from '../NavIcon';

// 홈페이지 사진 — **관리자가 거는 자리.**
//
// 커뮤니티를 걷어낸 뒤(2026-09-16) 「남이 올린 것」은 앱에 없다. 이것도 그 규칙을
// 안 깬다 — **올리는 사람은 여기 들어온 관리자 하나뿐**이다. 그래서 신고도 내리기도
// 욕설 검사도 없다. 여럿이 올리는 자리를 만들면 그 셋이 전부 따라온다.
//
// **폰 사진을 그대로 고를 수 있다.** 요즘 폰 사진은 한 장에 3~8MB 인데 서버는 2MB
// 까지 받는다 — 「줄여 오세요」라고 하면 아무도 안 올린다. `shrinkImage` 가 긴 변을
// 1280px 로 줄여 올린다 (전·후 사진에서 쓰던 그것이다).
//
// 지우는 것은 **되돌릴 수 없다.** 그래서 한 번 묻는다.
const MAX_COUNT = 12;

export default function SitePhotoAdmin() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);   // { id, caption }
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await client.get('/site-photos');
      setPhotos(Array.isArray(data) ? data : []);
      setFailed(false);
    } catch {
      // **못 불러온 것과 없는 것은 다르다.** 없다고 하면 「사진을 올리세요」가 뜨는데,
      // 걸어둔 사람에게 그 말은 틀린 말이다
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    // 같은 사진을 다시 고를 수 있어야 한다 — 값을 안 비우면 두 번째부터 아무 일도 안 난다
    e.target.value = '';
    if (!file || busy) return;

    setBusy(true);
    try {
      const { data, shrunk } = await shrinkImage(file);
      const res = await client.post('/site-photos', { data, caption: '' });
      setPhotos((prev) => [...prev, res.data.photo]);
      toast(shrunk ? '사진을 줄여서 걸었어요' : '사진을 걸었어요');
    } catch (err) {
      toast(err.response?.data?.error || `사진을 못 올렸어요 (${PHOTO_MAX_LABEL} 아래로 줄여보세요)`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const move = async (id, dir) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await client.patch(`/site-photos/${id}`, { move: dir });
      // 서버가 새 차례로 목록을 통째로 준다. **배열이 아니면 안 쓴다** —
      // 모양이 다른 것이 들어가면 아래 map 에서 화면이 통째로 죽는다
      const next = Array.isArray(data?.photos) ? data.photos : null;
      if (next) setPhotos(next);
    } catch {
      toast('순서를 못 바꿨어요', 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveCaption = async () => {
    if (!editing || busy) return;
    setBusy(true);
    try {
      const { data } = await client.patch(`/site-photos/${editing.id}`, { caption: editing.caption });
      setPhotos((prev) => prev.map((p) => (p.id === editing.id ? data.photo : p)));
      setEditing(null);
      toast('설명을 바꿨어요');
    } catch {
      toast('설명을 못 바꿨어요', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    const ok = await confirmDialog(
      '이 사진을 홈페이지에서 내립니다.\n\n되돌릴 수 없어요.',
      { title: '사진을 내릴까요', confirmText: '내리기' },
    );
    if (!ok) return;
    setBusy(true);
    try {
      await client.delete(`/site-photos/${id}`);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      toast('내렸어요');
    } catch {
      toast('못 내렸어요', 'error');
    } finally {
      setBusy(false);
    }
  };

  const full = photos.length >= MAX_COUNT;

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 16 }}>
        여기 건 사진이 <b style={{ color: 'var(--text-primary)' }}>홈페이지(/site)</b>에 그대로 나옵니다.
        로그인 안 한 사람도 봅니다.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <button
          className="btn-primary"
          style={{ width: 'auto', minWidth: 150 }}
          disabled={busy || full}
          onClick={() => fileRef.current?.click()}
        >{busy ? '올리는 중…' : '사진 고르기'}</button>
        <span style={{ fontSize: 12, color: full ? 'var(--warning)' : 'var(--text-muted)' }}>
          {photos.length} / {MAX_COUNT}장{full ? ' · 지워야 더 걸 수 있어요' : ''}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={pick}
          style={{ display: 'none' }}
        />
      </div>

      {loading && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>불러오는 중…</div>
      )}

      {!loading && failed && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>사진 목록을 못 불러왔어요.</div>
          <button className="btn-secondary" onClick={load}>다시 해보기</button>
        </div>
      )}

      {!loading && !failed && photos.length === 0 && (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <div style={{ fontSize: 13 }}>아직 걸어둔 사진이 없어요.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {photos.map((p, i) => (
          <div key={p.id} className="card" style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
            <img
              src={p.data}
              alt={p.caption || '홈페이지 사진'}
              style={{
                width: 92, height: 92, objectFit: 'cover', flexShrink: 0,
                borderRadius: 'var(--radius)', border: '1px solid var(--border)',
              }}
            />
            <div style={{ minWidth: 0, flexGrow: 1 }}>
              {editing?.id === p.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    className="input"
                    value={editing.caption}
                    maxLength={60}
                    autoFocus
                    placeholder="한 줄 설명 (안 적어도 됩니다)"
                    onChange={(e) => setEditing({ ...editing, caption: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveCaption(); if (e.key === 'Escape') setEditing(null); }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-secondary" style={{ flex: 1 }} disabled={busy} onClick={saveCaption}>저장</button>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditing(null)}>취소</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13.5, color: p.caption ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.6 }}>
                    {p.caption || '설명 없음'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => setEditing({ id: p.id, caption: p.caption || '' })}>설명</button>
                    <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}
                      disabled={busy || i === 0} onClick={() => move(p.id, 'up')} aria-label="위로">↑</button>
                    <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}
                      disabled={busy || i === photos.length - 1} onClick={() => move(p.id, 'down')} aria-label="아래로">↓</button>
                    <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      disabled={busy} onClick={() => remove(p.id)}>내리기</button>
                  </div>
                </>
              )}
            </div>
            <div style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
              <NavIcon name="camera" size={16} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
