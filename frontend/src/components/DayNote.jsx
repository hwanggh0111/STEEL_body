import { useState, useEffect, useRef } from 'react';
import { dayLabel } from '../data/plans';

// 그날의 메모 — 달력에서 날짜를 고르면 「할 것」 아래에 붙는다.
//
// 달력에는 지금까지 **숫자만** 있었다. 몇 개 했고 무슨 부위였는지는 기록에서 나오지만,
// **왜 그랬는지는 아무 데도 안 남았다** — 「어깨가 안 좋아서 가볍게」 · 「무게 5kg 올림」 ·
// 「출장이라 쉼」 같은 것. 한 달 뒤에 달력을 보면 그 이유가 제일 궁금하다.
//
// **하루 한 장이다.** 그날 일은 한 덩어리로 적는 것이 자연스럽고, 여러 장이면 달력 칸에
// 몇 장인지를 또 그려야 한다.
//
// **적기 전에는 접혀 있다.** 달력 아래를 늘 입력칸으로 채워두면, 되짚으러 온 사람의
// 길을 막는다 (「할 것」에서 이미 겪은 자리다).
export default function DayNote({ date, note, onSave, onDelete, saving }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const areaRef = useRef(null);

  // 다른 날짜로 옮기면 쓰던 것을 닫는다 — 안 그러면 **다른 날 메모가 이 날에 붙는다**
  useEffect(() => { setEditing(false); setDraft(''); }, [date]);

  const start = () => {
    setDraft(note?.body || '');
    setEditing(true);
    setTimeout(() => areaRef.current?.focus(), 0);
  };

  const save = () => {
    const body = draft.trim();
    if (!body || saving) return;
    onSave(body, () => setEditing(false));
  };

  const ghost = {
    background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
    padding: '4px 11px', fontSize: 11.5, borderRadius: 'var(--radius)', cursor: 'pointer',
  };

  return (
    <div className="card" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{dayLabel(date)} 메모</span>
        {!editing && (
          <button onClick={start} style={{ ...ghost, marginLeft: 'auto' }}>
            {note ? '고치기' : '적기'}
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            ref={areaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            placeholder={'그날 있었던 일을 적어두세요.\n어깨가 안 좋아 가볍게 · 벤치 5kg 올림 · 출장이라 쉼'}
            style={{
              width: '100%', minHeight: 92, padding: 11, fontSize: 13.5, lineHeight: 1.75,
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              fontFamily: 'inherit', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{draft.length}/2000</span>
            <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <button onClick={() => setEditing(false)} style={ghost}>취소</button>
              <button
                onClick={save}
                className="btn-primary"
                disabled={saving}
                style={{ width: 'auto', padding: '5px 15px', fontSize: 12.5 }}
              >{saving ? '저장 중…' : '저장'}</button>
            </span>
          </div>
        </>
      ) : note ? (
        <>
          {/* 적은 그대로 보여준다 — 줄바꿈이 곧 그 사람의 메모다 */}
          <div style={{
            fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>{note.body}</div>
          <button
            onClick={() => onDelete(note)}
            style={{ ...ghost, alignSelf: 'flex-start', fontSize: 11 }}
          >지우기</button>
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          그날 어땠는지 적어두면 다음에 볼 때 이유가 남아요.
        </div>
      )}
    </div>
  );
}
