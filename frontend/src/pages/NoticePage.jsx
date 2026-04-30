import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { NOTICES, NOTICE_BADGE, getReadNotices, markNoticeRead } from '../data/notices';
import { toast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmModal';
import { isAdmin } from '../data/admin';

export default function NoticePage() {
  const navigate = useNavigate();
  const expandTimerRef = useRef(null);
  useEffect(() => () => { if (expandTimerRef.current) clearTimeout(expandTimerRef.current); }, []);
  const [filter, setFilter] = useState('전체');
  const [expandedId, setExpandedId] = useState(null);
  const [writing, setWriting] = useState(false);
  const [editing, setEditing] = useState(null); // { id, title, type, content }
  const [form, setForm] = useState({ title: '', type: '공지', content: '' });
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiTopic, setAiTopic] = useState('');
  const [aiType, setAiType] = useState('update');
  const [aiLoading, setAiLoading] = useState(false);
  const admin = isAdmin();

  // 서버에서 공지 로드, 실패 시 로컬 데이터 폴백
  useEffect(() => {
    client.get('/notices')
      .then(({ data }) => setNotices(data.length ? data : NOTICES))
      .catch(() => setNotices(NOTICES))
      .finally(() => setLoading(false));
  }, []);

  const types = ['전체', '공지', '긴급공지', '업데이트', '신기능', '이벤트'];
  const sorted = [...notices].reverse();
  const filtered = filter === '전체' ? sorted : sorted.filter(n => n.type === filter);
  const [readList, setReadList] = useState(() => getReadNotices());

  const handleExpand = (id) => {
    markNoticeRead(id);
    setReadList(getReadNotices());
    setExpandedId(expandedId === id ? null : id);
  };

  // 공지 등록
  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast('제목과 내용을 입력하세요');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data } = await client.post('/notices', { date: today, ...form });
      const newNotice = { id: data.id, date: today, ...form };
      setNotices(prev => [...prev, newNotice]);
      markNoticeRead(data.id);
      setReadList(getReadNotices());
      setForm({ title: '', type: '공지', content: '' });
      setWriting(false);
      setFilter('전체');
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
      expandTimerRef.current = setTimeout(() => {
        setExpandedId(data.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
      toast('공지가 등록됐습니다');
    } catch {
      toast('공지 등록에 실패했어요');
    }
  };

  // 공지 수정
  const handleUpdate = async () => {
    if (!editing) return;
    try {
      await client.put(`/notices/${editing.id}`, {
        title: editing.title,
        type: editing.type,
        content: editing.content,
      });
      setNotices(prev => prev.map(n => n.id === editing.id
        ? { ...n, title: editing.title, type: editing.type, content: editing.content }
        : n
      ));
      setEditing(null);
      toast('공지가 수정됐습니다');
    } catch {
      toast('수정에 실패했어요');
    }
  };

  // 공지 삭제
  const handleDelete = async (id) => {
    try {
      await client.delete(`/notices/${id}`);
      setNotices(prev => prev.filter(n => n.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast('공지가 삭제됐습니다');
    } catch {
      toast('삭제에 실패했어요');
    }
  };

  // AI 공지 생성
  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) { toast('주제를 입력하세요'); return; }
    setAiLoading(true);
    try {
      const { data } = await client.post('/notices/ai-generate', { topic: aiTopic, type: aiType });
      setForm({ title: data.title, type: aiType === 'event' ? '이벤트' : aiType === 'update' ? '업데이트' : aiType === 'maintenance' ? '긴급공지' : '공지', content: data.content });
      setAiTopic('');
      toast('AI가 공지를 작성했어요! 수정 후 등록하세요');
    } catch {
      toast('AI 생성에 실패했어요');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 20,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            fontSize: 20, cursor: 'pointer', padding: 0,
          }}
        >←</button>
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
          letterSpacing: 2, color: 'var(--accent)', margin: 0,
        }}>NOTICES</h2>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
          총 {filtered.length}건
        </span>
        {admin && (
          <button
            onClick={() => { setWriting(!writing); setEditing(null); }}
            style={{
              background: writing ? 'var(--border)' : 'var(--accent)',
              border: 'none', color: writing ? 'var(--text-secondary)' : '#000',
              padding: '6px 14px', fontSize: 12, fontWeight: 700,
              borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
          >{writing ? '취소' : '+ 공지 작성'}</button>
        )}
      </div>

      {/* 공지 작성 폼 (관리자만) */}
      {writing && admin && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)', padding: 16, marginBottom: 16,
        }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5,
            color: 'var(--accent)', marginBottom: 12,
          }}>새 공지 작성</div>

          {/* AI 생성 */}
          <div style={{
            background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 12, marginBottom: 14,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
              AI 공지 생성
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input
                className="input"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="주제 입력 (예: 새 루틴 기능)"
                style={{ flex: 1, fontSize: 12 }}
              />
              <select
                className="input"
                value={aiType}
                onChange={(e) => setAiType(e.target.value)}
                style={{ width: 100, fontSize: 12 }}
              >
                <option value="update">업데이트</option>
                <option value="event">이벤트</option>
                <option value="notice">공지</option>
                <option value="maintenance">점검</option>
              </select>
            </div>
            <button
              onClick={handleAiGenerate}
              disabled={aiLoading}
              style={{
                background: 'var(--info)', border: 'none', color: '#fff',
                padding: '6px 14px', fontSize: 12, fontWeight: 700,
                borderRadius: 'var(--radius)', cursor: 'pointer',
                opacity: aiLoading ? 0.6 : 1,
              }}
            >{aiLoading ? '생성 중...' : 'AI로 작성하기'}</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">제목</label>
              <input
                className="input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="공지 제목"
              />
            </div>
            <div style={{ width: 120 }}>
              <label className="label">유형</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                style={{ height: 38 }}
              >
                {['공지', '긴급공지', '업데이트', '신기능', '이벤트'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="label">내용</label>
          <textarea
            className="input"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="공지 내용을 입력하세요"
            rows={4}
            style={{ resize: 'vertical', marginBottom: 12 }}
          />

          <button
            onClick={handleCreate}
            style={{
              background: 'var(--accent)', border: 'none', color: '#000',
              padding: '8px 20px', fontSize: 13, fontWeight: 700,
              borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
          >등록</button>
        </div>
      )}

      {/* 수정 폼 */}
      {editing && admin && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--warning)',
          borderRadius: 'var(--radius)', padding: 16, marginBottom: 16,
        }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5,
            color: 'var(--warning)', marginBottom: 12,
          }}>공지 수정</div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">제목</label>
              <input
                className="input"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </div>
            <div style={{ width: 120 }}>
              <label className="label">유형</label>
              <select
                className="input"
                value={editing.type}
                onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                style={{ height: 38 }}
              >
                {['공지', '긴급공지', '업데이트', '신기능', '이벤트'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="label">내용</label>
          <textarea
            className="input"
            value={editing.content}
            onChange={(e) => setEditing({ ...editing, content: e.target.value })}
            rows={4}
            style={{ resize: 'vertical', marginBottom: 12 }}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleUpdate}
              style={{
                background: 'var(--warning)', border: 'none', color: '#000',
                padding: '8px 20px', fontSize: 13, fontWeight: 700,
                borderRadius: 'var(--radius)', cursor: 'pointer',
              }}
            >수정 저장</button>
            <button
              onClick={() => setEditing(null)}
              style={{
                background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                padding: '8px 16px', fontSize: 13, borderRadius: 'var(--radius)', cursor: 'pointer',
              }}
            >취소</button>
          </div>
        </div>
      )}

      {/* 필터 탭 */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 16,
        overflowX: 'auto', paddingBottom: 4,
      }}>
        {types.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius)',
              border: '1px solid',
              borderColor: filter === t ? 'var(--accent)' : 'var(--border)',
              background: filter === t ? 'var(--accent)' : 'transparent',
              color: filter === t ? '#000' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >{t}</button>
        ))}
      </div>

      {/* 로딩 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          로딩 중...
        </div>
      )}

      {/* 공지 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(n => {
          const isRead = readList.includes(n.id);
          const isExpanded = expandedId === n.id;

          return (
            <div
              key={n.id}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid',
                borderColor: isExpanded ? 'var(--accent)' : 'var(--border)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
                overflow: 'hidden',
              }}
            >
              {/* 제목 행 */}
              <div
                onClick={() => handleExpand(n.id)}
                style={{
                  padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                {!isRead && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--accent)', flexShrink: 0,
                  }} />
                )}
                <span className={NOTICE_BADGE[n.type] || 'badge badge-accent'}
                  style={{ flexShrink: 0 }}>{n.type}</span>
                <span style={{
                  fontSize: 14, color: 'var(--text-primary)',
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  opacity: isRead ? 0.7 : 1,
                }}>{n.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {n.date}
                </span>
                <span style={{
                  fontSize: 12, color: 'var(--text-muted)',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.2s',
                }}>▼</span>
              </div>

              {/* 펼쳐진 내용 */}
              {isExpanded && (
                <div style={{
                  padding: '0 16px 16px',
                  borderTop: '1px solid var(--border)',
                  paddingTop: 14,
                }}>
                  <p style={{
                    fontSize: 13, color: 'var(--text-secondary)',
                    lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line',
                  }}>{n.content}</p>

                  {/* 관리자 액션 버튼 */}
                  {admin && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing({ id: n.id, title: n.title, type: n.type, content: n.content });
                          setWriting(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        style={{
                          background: 'var(--warning)', border: 'none', color: '#000',
                          padding: '6px 14px', fontSize: 12, fontWeight: 700,
                          borderRadius: 'var(--radius)', cursor: 'pointer',
                        }}
                      >수정</button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirmDialog('이 공지를 삭제할까요?', { title: '공지 삭제', confirmText: '삭제' });
                          if (ok) handleDelete(n.id);
                        }}
                        style={{
                          background: 'var(--danger)', border: 'none', color: '#fff',
                          padding: '6px 14px', fontSize: 12, fontWeight: 700,
                          borderRadius: 'var(--radius)', cursor: 'pointer',
                        }}
                      >삭제</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!loading && filtered.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 0',
          color: 'var(--text-muted)', fontSize: 14,
        }}>해당 유형의 공지가 없습니다.</div>
      )}


    </div>
  );
}
