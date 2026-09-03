import { useState, useEffect, useRef } from 'react';
import client from '../../api/client';
import { toast } from '../../components/Toast';
import { confirmDialog } from '../../components/ConfirmModal';
import { noteTitle, countExercises, noteToRoutine } from '../../data/routineNote';

// 루틴 메모장.
//
// 루틴을 만들려면 이름 · 운동 · 세트 · 횟수를 **정해진 칸에** 넣어야 한다. 그런데 루틴은
// 그렇게 완성된 채로 떠오르지 않는다 — 헬스장 가는 길에 「월요일 가슴 / 벤치 5x5 /
// 인클라인 3x12쯤?」 하고 적어보다가 고친다. 그 단계를 담을 자리가 앱에 없었다.
//
// **제목 칸을 따로 두지 않는다.** 적으러 온 사람에게 제목부터 정하라고 하면 거기서
// 멈춘다. 첫 줄이 곧 제목이다.
//
// 다 짜였으면 「루틴으로 만들기」를 누른다. 적은 것을 **다시 칸에 옮겨 적게 하면
// 메모장을 만든 뜻이 없다** — 읽어서 만들기 폼에 채워준다. 곧바로 루틴을 만들지는
// 않는다. 우리가 잘못 읽었을 수 있고, 그건 사람이 폼에서 보고 고치면 된다.
export default function RoutineNotes({ onToRoutine }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openId, setOpenId] = useState(null);   // 펼쳐서 고치고 있는 메모
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [writing, setWriting] = useState(false);  // 새 메모를 적는 중
  const areaRef = useRef(null);

  const load = () => {
    setLoading(true);
    client.get('/notes')
      .then(({ data }) => { setNotes(Array.isArray(data) ? data : []); setLoadFailed(false); })
      // **못 불러온 것과 없는 것은 다르다.** 조용히 「아직 없어요」를 띄우면
      // 적어둔 것이 사라진 줄 안다
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const startNew = () => {
    setWriting(true);
    setOpenId(null);
    setDraft('');
    setTimeout(() => areaRef.current?.focus(), 0);
  };

  const open = (note) => {
    setWriting(false);
    setOpenId(note.id);
    setDraft(note.body);
  };

  const close = () => { setWriting(false); setOpenId(null); setDraft(''); };

  const save = async () => {
    const body = draft.trim();
    if (!body) { toast('메모 내용을 적어주세요'); return; }
    if (saving) return;   // 연타로 두 장이 생기던 자리 (측정 · 루틴에서 이미 겪었다)
    setSaving(true);
    try {
      if (writing) {
        const { data } = await client.post('/notes', { body });
        setNotes((prev) => [data, ...prev]);
        toast('메모를 저장했어요');
      } else {
        const { data } = await client.put(`/notes/${openId}`, { body });
        setNotes((prev) => prev.map((n) => (n.id === openId ? data : n)));
        toast('고쳤어요');
      }
      close();
    } catch (err) {
      toast(err.response?.data?.error || '저장하지 못했어요', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (note) => {
    const ok = await confirmDialog(`"${noteTitle(note.body)}" 메모를 지울까요?`,
      { title: '메모 지우기', confirmText: '지웁니다', danger: true });
    if (!ok) return;
    try {
      await client.delete(`/notes/${note.id}`);
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      if (openId === note.id) close();
      toast('지웠어요');
    } catch (err) {
      // 「지웠다」가 거짓말이면 안 된다. 다음에 열면 되살아난다
      toast(err.response?.data?.error || '지우지 못했어요. 다시 열면 그대로 있어요', 'error');
    }
  };

  // 적은 것을 루틴 만들기 폼에 채워 보낸다
  const toRoutine = (body) => {
    const routine = noteToRoutine(body);
    if (routine.exercises.length === 0) {
      toast('운동으로 읽을 줄이 없어요. 「벤치프레스 5x10」처럼 한 줄에 하나씩 적어주세요', 'warning');
      return;
    }
    onToRoutine(routine);
  };

  const box = {
    width: '100%', minHeight: 160, padding: 12, fontSize: 13.5, lineHeight: 1.8,
    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    fontFamily: 'inherit', resize: 'vertical',
  };
  const ghost = {
    background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
    padding: '5px 11px', fontSize: 11.5, borderRadius: 'var(--radius)', cursor: 'pointer',
  };

  return (
    <>
      <div className="section-title">
        <div className="accent-bar" />
        루틴 메모
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.7 }}>
        떠오르는 대로 적어두는 곳이에요. <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>한 줄에 운동 하나</b>씩
        적어두면 그대로 <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>루틴으로 만들 수</b> 있어요.
        {' '}첫 줄은 루틴 이름이 됩니다.
      </p>

      {!writing && openId === null && (
        <button
          onClick={startNew}
          className="btn-secondary"
          style={{ width: '100%', marginBottom: 14, fontSize: 13 }}
        >+ 메모 적기</button>
      )}

      {(writing || openId !== null) && (
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <textarea
            ref={areaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            placeholder={'월요일 가슴 · 삼두\n벤치프레스 5x10\n인클라인 덤벨 3세트 12회\n케이블 푸시다운 4x15'}
            style={box}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {/* 몇 줄이 운동으로 읽히는지 **적는 동안** 보여준다.
                누르고 나서야 빈 루틴이 나오면 무엇이 잘못됐는지 알 길이 없다 */}
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              운동 {countExercises(draft)}개로 읽혀요 · {draft.length}/2000
            </span>
            <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <button onClick={close} style={ghost}>취소</button>
              <button
                onClick={save}
                className="btn-primary"
                disabled={saving}
                style={{ width: 'auto', padding: '6px 16px', fontSize: 12.5 }}
              >{saving ? '저장 중…' : '저장'}</button>
            </span>
          </div>
        </div>
      )}

      {loading && <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>불러오는 중…</p>}

      {!loading && loadFailed && (
        <div className="card" style={{ padding: 14, borderColor: 'var(--danger)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>메모를 못 불러왔어요</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
            적어두신 것이 사라진 것은 아니에요. 잠시 뒤에 다시 해주세요.
          </div>
          <button onClick={load} style={{ ...ghost, marginTop: 9 }}>다시 불러오기</button>
        </div>
      )}

      {!loading && !loadFailed && notes.length === 0 && !writing && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.8 }}>
          아직 적어둔 메모가 없어요.<br />
          운동하다 떠오른 것을 적어두면 다음에 루틴으로 만들 수 있어요.
        </p>
      )}

      {!loadFailed && notes.map((note) => (
        <div key={note.id} className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ minWidth: 0, flexGrow: 1, cursor: 'pointer' }} onClick={() => open(note)}>
              <div style={{
                fontSize: 13.5, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{noteTitle(note.body)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                운동 {countExercises(note.body)}개 · {String(note.updated_at || '').slice(0, 10)}
              </div>
            </div>
            <button
              onClick={() => toRoutine(note.body)}
              style={{ ...ghost, borderColor: 'var(--accent)', color: 'var(--accent)', flexShrink: 0 }}
            >루틴으로</button>
            <button className="delete-btn" onClick={() => remove(note)}>✕</button>
          </div>
        </div>
      ))}
    </>
  );
}
