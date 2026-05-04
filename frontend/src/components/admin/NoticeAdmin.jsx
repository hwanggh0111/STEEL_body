import { useState } from 'react';
import { NOTICE_BADGE, NOTICE_READ_KEY, getAllNotices, addAdminNotice, deleteNotice as deleteNoticeFromStore } from '../../data/notices';
import { toast } from '../Toast';

export default function NoticeAdmin() {
  const [notices, setNotices] = useState(() => getAllNotices());
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', type: '공지', content: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const types = ['공지', '긴급공지', '업데이트', '신기능', '이벤트'];

  const reload = () => setNotices(getAllNotices());

  const startNew = () => {
    setForm({ title: '', type: '공지', content: '' });
    setEditing('new');
  };

  const startEdit = (notice) => {
    setForm({ title: notice.title, type: notice.type, content: notice.content });
    setEditing(notice.id);
  };

  const handleSave = () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast('제목과 내용을 입력하세요');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    if (editing === 'new') {
      const maxId = notices.reduce((max, n) => Math.max(max, n.id), 0);
      const newNotice = { id: maxId + 1, date: today, ...form };
      addAdminNotice(newNotice);
      toast('공지사항이 추가됐습니다! 공지사항 페이지에 바로 반영됩니다.');
    } else {
      // 수정: 기존 삭제 후 새로 추가
      deleteNoticeFromStore(editing);
      const updated = { id: editing, date: new Date().toISOString().split('T')[0], ...form };
      addAdminNotice(updated);
      toast('공지사항이 수정됐습니다');
    }
    setEditing(null);
    reload();
  };

  const handleDelete = (id) => {
    deleteNoticeFromStore(id);
    setConfirmDelete(null);
    reload();
    toast('공지사항이 삭제됐습니다');
  };

  const resetRead = () => {
    localStorage.removeItem(NOTICE_READ_KEY);
    localStorage.removeItem('ironlog_notice_count');
    toast('읽음 기록 초기화 완료! 홈에서 전체 공지 팝업이 다시 뜹니다');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-title" style={{ margin: 0 }}>
          <div className="accent-bar" />
          공지사항 목록 ({notices.length}개)
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={resetRead}
            style={{
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-muted)', padding: '6px 12px', fontSize: 11,
              borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
          >읽음 초기화</button>
          <button
            onClick={startNew}
            style={{
              background: 'var(--accent)', border: 'none', color: '#000',
              padding: '6px 14px', fontSize: 12, fontWeight: 700,
              borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
          >+ 새 공지</button>
        </div>
      </div>

      {/* 작성/수정 폼 */}
      {editing !== null && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5,
            color: 'var(--accent)', marginBottom: 12,
          }}>
            {editing === 'new' ? '새 공지 작성' : '공지 수정'}
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
                {types.map(t => <option key={t} value={t}>{t}</option>)}
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
            style={{ resize: 'vertical' }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={handleSave}
              style={{
                background: 'var(--accent)', border: 'none', color: '#000',
                padding: '8px 20px', fontSize: 13, fontWeight: 700,
                borderRadius: 'var(--radius)', cursor: 'pointer',
              }}
            >저장</button>
            <button
              onClick={() => setEditing(null)}
              style={{
                background: 'none', border: '1px solid var(--border)',
                color: 'var(--text-muted)', padding: '8px 16px', fontSize: 13,
                borderRadius: 'var(--radius)', cursor: 'pointer',
              }}
            >취소</button>
          </div>
        </div>
      )}

      {/* 공지 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...notices].reverse().map(n => (
          <div key={n.id} className="card" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={NOTICE_BADGE[n.type] || 'badge badge-accent'}>{n.type}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.date}</span>
                <button
                  onClick={() => startEdit(n)}
                  style={{
                    background: 'none', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', padding: '3px 8px', fontSize: 10,
                    borderRadius: 'var(--radius)', cursor: 'pointer',
                  }}
                >수정</button>
                {confirmDelete === n.id ? (
                  <>
                    <button
                      onClick={() => handleDelete(n.id)}
                      style={{
                        background: 'var(--danger)', border: 'none',
                        color: '#fff', padding: '3px 8px', fontSize: 10,
                        borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 700,
                      }}
                    >확인</button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      style={{
                        background: 'none', border: '1px solid var(--border)',
                        color: 'var(--text-muted)', padding: '3px 8px', fontSize: 10,
                        borderRadius: 'var(--radius)', cursor: 'pointer',
                      }}
                    >취소</button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(n.id)}
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      color: 'var(--danger)', padding: '3px 8px', fontSize: 10,
                      borderRadius: 'var(--radius)', cursor: 'pointer',
                    }}
                  >삭제</button>
                )}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{n.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
