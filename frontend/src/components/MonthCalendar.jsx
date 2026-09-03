import { useMemo, useState, useEffect, useRef } from 'react';
import { monthGrid, DAY_LABELS, partOfDay } from '../data/monthGrid';
import { dateKey } from '../data/dateKey';

// 한 달 달력.
//
// **빠진 날을 보여주는 것이 목적이다.** 그래서 옆 달 날짜를 흐리게 채우지 않고,
// 운동한 날과 안 한 날의 차이를 한눈에 두었다.
//
// 칸에 부위 이름을 적는다 — 「했다」보다 「무엇을 했다」가 되짚는 데 쓸모 있다.
// 칸이 좁아서 한 글자만 들어가는데, 부위 이름이 대부분 한 글자다 (가슴 → 가, 등 → 등).
//
// **앞으로 할 것도 같이 그린다** (2026-09-02). 달력은 되짚는 자리이면서 **정하는
// 자리**이기도 하다 — 「이번 주에 언제 갈까」를 보는 곳이 여기다.
// 한 날과 할 날은 **테두리로** 가른다: 한 날은 채운 금색, 할 날은 **점선**이다.
// 색으로만 가르면 둘 다 금색이라 구별이 안 된다.
//
// ── 메모는 **달력 안에서** 쓴다 (2026-09-03) ──
//
// 처음에는 달력 아래에 카드를 하나 더 놓았다. 그런데 「달력에 메모하게 해달라」는 말은
// **달력에 적는다**는 뜻이었다 — 벽에 걸린 달력에 연필로 적듯이. 그래서 안으로 넣었다.
//
//   1. 적어둔 날은 **그 주 아래에 한 줄씩** 보인다 — 「4일 · 어깨가 안 좋아 가볍게」
//   2. 날짜를 누르면 **그 주 바로 아래에서** 곧바로 쓴다. 아래로 내려갈 필요가 없다
//
// **칸 안에 글을 넣어봤다가 물렀다.** 재보니 칸 폭이 폰에서 33~49px 이다
// (320 · 375 · 430px 화면 기준, 일곱 칸에 여백을 빼고). 10px 글자로도 **두세 글자**밖에
// 안 들어간다 — 글이 아니라 얼룩이다. **작게 넣느니 안 넣는 편이 낫다.**
// 그래서 칸에는 **메모가 있다는 표시**(아래쪽 짧은 줄)만 두고, 글은 주 아래에서
// 화면 폭을 다 써서 보여준다. 벽에 걸린 달력에 적어둔 것과 같은 자리다.
//
// 칸은 72px 로 키웠다 — 날짜 · 부위 · 표시가 겹치지 않게.

const SHORT = { 가슴: '가', 등: '등', 어깨: '어', 하체: '하', 팔: '팔', 코어: '코', 기타: '·' };

// 메모의 첫 줄만. 칸은 한 줄이고, 첫 줄이 곧 그날의 제목이다
const firstLine = (body) => {
  const line = String(body || '').split('\n').find((l) => l.trim());
  return line ? line.trim() : '';
};

export default function MonthCalendar({
  year, month, workouts, plans = {}, notes = {}, selected, onSelect,
  onSaveNote, onDeleteNote, savingNote,
}) {
  const today = dateKey();
  const weeks = useMemo(() => monthGrid(year, month), [year, month]);

  const [draft, setDraft] = useState('');
  const [writing, setWriting] = useState(false);
  const areaRef = useRef(null);

  // 날짜를 옮기면 쓰던 것을 닫는다 — **다른 날 메모가 이 날에 붙으면 안 된다**
  useEffect(() => { setWriting(false); setDraft(''); }, [selected]);

  const note = selected ? notes?.[selected] : null;

  const startWriting = () => {
    setDraft(note ? note.body : '');
    setWriting(true);
    setTimeout(() => areaRef.current?.focus(), 0);
  };
  const save = () => {
    const body = draft.trim();
    if (!body || savingNote) return;
    onSaveNote?.(body, () => setWriting(false));
  };

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {DAY_LABELS.map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 12, fontWeight: 600,
            color: i >= 5 ? 'var(--text-secondary)' : 'var(--text-muted)',
          }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {weeks.map((week, wi) => {
          // 고른 날이 이 주에 있으면 **그 주 바로 아래**에 적는 자리를 편다
          const openHere = !!selected && week.some((c) => c && c.key === selected);
          return (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {week.map((cell, ci) => {
                  if (!cell) return <div key={ci} />;
                  const list = workouts?.[cell.key] || [];
                  const done = list.length > 0;
                  const planned = (plans?.[cell.key] || []).length;
                  // 계획해둔 날인데 그날 기록이 없다 — 오늘부터면 「할 것」, 지났으면 「못 한 것」
                  const todo = !done && planned > 0 && cell.key >= today;
                  const missed = !done && planned > 0 && cell.key < today;
                  const memo = firstLine(notes?.[cell.key]?.body);
                  const isToday = cell.key === today;
                  const isSelected = cell.key === selected;
                  const part = done ? partOfDay(list) : null;

                  return (
                    <button
                      key={cell.key}
                      onClick={() => onSelect(isSelected ? null : cell.key)}
                      aria-label={`${month}월 ${cell.day}일`
                        + (done ? ` · 기록 ${list.length}건` : ' · 기록 없음')
                        + (planned ? ` · 할 것 ${planned}개${missed ? ' (못 함)' : ''}` : '')
                        + (memo ? ` · 메모: ${memo}` : '')}
                      aria-pressed={isSelected}
                      style={{
                        minHeight: 72,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'flex-start', gap: 3,
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        background: done ? 'var(--accent-dim)' : 'var(--bg-primary)',
                        border: isSelected
                          ? '2px solid var(--accent)'
                          : todo
                            ? '1px dashed var(--accent)'
                            : missed
                              ? '1px dashed var(--border-hover)'
                              : isToday
                                ? '1px solid var(--text-muted)'
                                : `1px solid ${done ? 'var(--accent)' : 'var(--border)'}`,
                        color: done || todo ? 'var(--accent)' : 'var(--text-muted)',
                        fontFamily: "'Barlow', sans-serif",
                        padding: '7px 3px 5px',
                        overflow: 'hidden',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: isToday ? 700 : 400, lineHeight: 1 }}>{cell.day}</span>
                      {part ? (
                        <span style={{ fontSize: 10.5, lineHeight: 1, opacity: 0.85 }}>{SHORT[part] || '·'}</span>
                      ) : planned ? (
                        // 할 것이 있는 날은 개수를 적는다. 이름은 칸에 안 들어간다
                        <span style={{ fontSize: 10.5, lineHeight: 1, opacity: missed ? 0.5 : 0.85 }}>
                          {planned}개
                        </span>
                      ) : null}
                      {/* 메모가 있다는 **표시**. 글은 주 아래에서 읽는다 —
                          칸에 넣으면 두세 글자에서 잘려 얼룩이 된다.
                          쉰 날에도 메모는 있을 수 있어서(「출장이라 쉼」) 흐린 색으로 둔다 */}
                      {memo && (
                        <span aria-hidden="true" style={{
                          marginTop: 'auto', width: 14, height: 2, borderRadius: 1,
                          background: done || todo ? 'var(--accent)' : 'var(--text-muted)',
                          opacity: 0.85,
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── 그 주에 적어둔 것들 ──
                  **화면 폭을 다 써서 보여준다.** 달력을 펼치기만 해도 그 주에 무슨 일이
                  있었는지가 읽힌다. 누르면 그 날이 열린다 */}
              {week.filter((c) => c && firstLine(notes?.[c.key]?.body)).map((c) => (
                <button
                  key={'note-' + c.key}
                  onClick={() => onSelect(c.key === selected ? null : c.key)}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 7, width: '100%',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '2px 3px', textAlign: 'left', fontFamily: 'inherit',
                    opacity: c.key === selected ? 1 : 0.9,
                  }}
                >
                  <span style={{
                    fontSize: 11, color: 'var(--text-muted)', flexShrink: 0,
                    fontFamily: "'Barlow', sans-serif",
                  }}>{c.day}일</span>
                  <span style={{
                    fontSize: 12, color: 'var(--text-secondary)', minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{firstLine(notes[c.key].body)}</span>
                </button>
              ))}

              {/* ── 그 주 아래에서 바로 적는다 ── */}
              {openHere && (
                <div style={{
                  border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
                  padding: '10px 11px', background: 'var(--bg-primary)',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: 1 }}>
                      {Number(selected.slice(5, 7))}월 {Number(selected.slice(8, 10))}일 메모
                    </span>
                    {!writing && (
                      <button onClick={startWriting} style={{ ...ghost, marginLeft: 'auto' }}>
                        {note ? '고치기' : '적기'}
                      </button>
                    )}
                    {!writing && note && (
                      <button onClick={() => onDeleteNote?.(note)} style={ghost}>지우기</button>
                    )}
                  </div>

                  {writing ? (
                    <>
                      <textarea
                        ref={areaRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={2000}
                        placeholder="어깨가 안 좋아 가볍게 · 벤치 5kg 올림 · 출장이라 쉼"
                        style={{
                          width: '100%', minHeight: 74, padding: 9, fontSize: 13, lineHeight: 1.7,
                          background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                          fontFamily: 'inherit', resize: 'vertical',
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{draft.length}/2000</span>
                        <button onClick={() => setWriting(false)} style={{ ...ghost, marginLeft: 'auto' }}>취소</button>
                        <button
                          onClick={save}
                          disabled={savingNote}
                          className="btn-primary"
                          style={{ width: 'auto', padding: '6px 15px', fontSize: 12.5 }}
                        >{savingNote ? '저장 중…' : '저장'}</button>
                      </div>
                    </>
                  ) : note ? (
                    // 적은 그대로 보여준다 — 줄바꿈이 곧 그 사람의 메모다
                    <div style={{
                      fontSize: 12.5, lineHeight: 1.8, color: 'var(--text-secondary)',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>{note.body}</div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      그날 어땠는지 적어두면 달력 칸에 그대로 보여요.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ghost = {
  background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
  padding: '3px 10px', fontSize: 11.5, borderRadius: 'var(--radius)',
  cursor: 'pointer', fontFamily: 'inherit',
};
