import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { toast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmModal';
import { useRoutineSessionStore } from '../store/routineSessionStore';

const PARTS_MAP = {
  '머신': ['가슴', '등', '어깨', '하체', '팔'],
  '맨몸': ['가슴', '등', '어깨', '하체', '팔'],
  '홈트': ['전신', '가슴', '등', '어깨', '하체', '코어'],
};

export default function RoutinePage() {
  const [type, setType] = useState('머신');
  const [part, setPart] = useState('가슴');
  const [routines, setRoutines] = useState({});
  const [loading, setLoading] = useState(false);
  const [openIdx, setOpenIdx] = useState(null);
  const [myRoutines, setMyRoutines] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  // 고치는 중인 루틴 id. null 이면 새로 만드는 중
  const [editingId, setEditingId] = useState(null);
  const [newRoutine, setNewRoutine] = useState({ name: '', exercises: [{ name: '', sets: '', reps: '' }] });
  const navigate = useNavigate();
  const session = useRoutineSessionStore(s => s.session);
  const startSession = useRoutineSessionStore(s => s.start);
  const fetchSession = useRoutineSessionStore(s => s.fetch);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  // 루틴을 시작하면 기록 화면으로 데려간다 — 시작해놓고 아무 데도 안 가면
  // 무엇이 달라졌는지 알 수 없다.
  //
  // 하던 것이 있으면 먼저 물어본다. 서버는 그냥 덮어쓰지만, 사람에게는
  // 하던 걸 지운다고 말해야 한다
  const runRoutine = async (routine) => {
    const id = routine._id || routine.id;
    if (session && session.routineId !== id) {
      const ok = await confirmDialog(
        `지금 「${session.name}」을 ${session.done}/${session.total} 까지 하고 계세요.

그걸 그만두고 「${routine.name}」을 시작합니다. 저장한 운동 기록은 그대로 남습니다.`,
        { title: '하던 루틴을 바꿀까요', confirmText: '바꾸기' },
      );
      if (!ok) return;
    }
    try {
      await startSession(id);
      navigate('/workout');
    } catch (err) {
      toast(err.response?.data?.error || '루틴을 시작하지 못했어요', 'error');
    }
  };

  // Fetch my routines from server
  useEffect(() => {
    client.get('/my-routines')
      .then(({ data }) => setMyRoutines(data))
      .catch(() => toast('루틴을 불러오지 못했어요', 'error'));
  }, []);

  // 저장 · 수정 · 삭제는 **여기서만 알린다.**
  //
  // 예전에는 이 함수가 성공/실패를 알리고, 부르는 쪽에서 또 `toast('저장됐습니다')` 를
  // 띄웠다. 토스트 자리는 하나라 나중 것이 앞 것을 덮는데, **부르는 쪽 것이 먼저**
  // 뜬다 — `await` 없이 부르고 바로 성공을 띄웠기 때문이다.
  // 그래서 서버 저장이 실패해도 「저장됐습니다!」가 한 번 번쩍이고 나서
  // 「실패했어요」로 바뀌었다. 알리는 자리를 하나로 모은다.
  const saveMyRoutine = async (routine) => {
    try {
      const { data: saved } = await client.post('/my-routines', routine);
      // 서버가 정한 id 가 뒤에 와야 한다. routine 을 뒤에 펴면 id 가 덮인다
      setMyRoutines(prev => [...prev, { ...routine, id: saved.id }]);
      toast('루틴이 저장됐습니다!');
      return true;
    } catch (err) {
      toast(err.response?.data?.error || '루틴 저장에 실패했어요', 'error');
      return false;
    }
  };

  // 루틴 고치기.
  //
  // **만들고 지우는 것만 있었다.** 운동 하나를 빼거나 세트 수를 바꾸려면 통째로 지우고
  // 다시 만들어야 했다 — 매일 쓰는 것인데 그렇다. 서버에는 `PUT /my-routines/:id` 가
  // 처음부터 있었고, 화면에서 부르는 곳은 「루틴에 운동 하나 더 넣기」 하나뿐이었다.
  const updateMyRoutine = async (id, routine) => {
    try {
      await client.put(`/my-routines/${id}`, { name: routine.name, exercises: routine.exercises });
      setMyRoutines(prev => prev.map(r => ((r.id ?? r._id) === id ? { ...r, ...routine } : r)));
      toast('루틴을 고쳤습니다');
      return true;
    } catch (err) {
      toast(err.response?.data?.error || '고치지 못했어요', 'error');
      return false;
    }
  };

  // 이미 있는 루틴에 운동 하나를 더 넣는다.
  //
  // 예전에는 이 길이 없었다. 같은 이름의 루틴이 있으면 "이미 포함된 운동이에요" 라고
  // 돌려보냈는데, 실제로 그 운동이 들어 있는지는 보지도 않았다. 그래서 `머신 가슴 루틴`을
  // 한 번 만들고 나면 거기에 두 번째 운동을 영영 못 넣었다.
  const addToRoutine = async (routine, exercise) => {
    const id = routine.id ?? routine._id;
    const list = Array.isArray(routine.exercises) ? routine.exercises : [];
    if (list.some(e => (typeof e === 'string' ? e : e?.name) === exercise.name)) {
      toast(`"${routine.name}"에 이미 있는 운동이에요`);
      return;
    }
    const next = [...list, exercise];
    try {
      await client.put(`/my-routines/${id}`, { exercises: next });
      setMyRoutines(prev => prev.map(r => ((r.id ?? r._id) === id ? { ...r, exercises: next } : r)));
      toast(`"${routine.name}"에 ${exercise.name} 을(를) 넣었어요`);
    } catch {
      toast('루틴에 넣지 못했어요', 'error');
    }
  };

  const deleteMyRoutine = async (id) => {
    try {
      await client.delete(`/my-routines/${id}`);
      setMyRoutines(prev => prev.filter(r => (r._id || r.id) !== id));
      toast('루틴을 지웠어요');
    } catch {
      toast('루틴 삭제에 실패했어요', 'error');
    }
  };

  const parts = PARTS_MAP[type] || PARTS_MAP['머신'];

  useEffect(() => {
    setLoading(true);
    setOpenIdx(null);
    setPart(PARTS_MAP[type]?.[0] || '가슴');
    client.get(`/routines/${type}`)
      .then(({ data }) => setRoutines(data))
      .catch(() => { setRoutines({}); toast('루틴을 불러오지 못했어요', 'error'); })
      .finally(() => setLoading(false));
  }, [type]);

  useEffect(() => { setOpenIdx(null); }, [part]);

  const exercises = routines[part] || [];

  return (
    <div>
      {/* ─── 나만의 루틴 ─── */}
      <div className="section-title">
        <div className="accent-bar" />
        나만의 루틴
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.7 }}>
        루틴을 만들어두면 <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>순서를 따라가며 기록</b>할 수 있어요.
        지난번에 든 무게를 미리 채워둡니다.
      </p>

      {myRoutines.length === 0 && !showCreate && (
        <div className="empty-state" style={{ padding: '28px 0' }}>
          <div className="empty-state-title">루틴 없음</div>
          <div className="empty-state-desc">
            아직 만든 루틴이 없어요.<br />
            아래 추천에서 골라 담거나, 직접 만들 수 있습니다.
          </div>
        </div>
      )}

      {myRoutines.length > 0 && myRoutines.map((r, i) => (
        <div key={r._id || r.id || i} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5, color: 'var(--accent)' }}>{r.name}</span>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={() => {
                setEditingId(r.id ?? r._id);
                setNewRoutine({
                  name: r.name,
                  exercises: (Array.isArray(r.exercises) ? r.exercises : []).map(ex => (
                    typeof ex === 'string'
                      ? { name: ex, sets: '', reps: '' }
                      : { name: ex.name || '', sets: ex.sets ?? '', reps: ex.reps ?? '' }
                  )),
                });
                setShowCreate(true);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
            >수정</button>
            <button
              onClick={async () => {
                const ok = await confirmDialog(`"${r.name}" 루틴을 삭제할까요?`, { title: '루틴 삭제', confirmText: '삭제' });
                if (!ok) return;
                // 알리는 것은 deleteMyRoutine 이 한다. 여기서 또 띄우면
                // 실패해도 「삭제 완료」가 먼저 번쩍인다
                deleteMyRoutine(r._id || r.id);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}
            >삭제</button>
            </span>
          </div>
          {r.exercises.map((ex, j) => (
            <div key={j} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '3px 0' }}>
              {ex.name} {ex.sets && `· ${ex.sets}세트`} {ex.reps && `· ${ex.reps}회`}
            </div>
          ))}
          {session && session.routineId === (r._id || r.id) ? (
            <button
              className="btn-secondary active"
              style={{ width: '100%', marginTop: 10 }}
              onClick={() => navigate('/workout')}
            >이어서 하기 · {session.done}/{session.total}</button>
          ) : (
            <button
              className="btn-primary"
              style={{ marginTop: 10, fontSize: 14, padding: '10px 20px' }}
              onClick={() => runRoutine(r)}
            >이 루틴으로 운동 시작</button>
          )}
        </div>
      ))}

      {!showCreate ? (
        <button
          onClick={() => { setEditingId(null); setNewRoutine({ name: '', exercises: [{ name: '', sets: '', reps: '' }] }); setShowCreate(true); }}
          className="btn-primary"
          style={{ width: '100%', marginTop: 8 }}
        >+ 새 루틴 만들기</button>
      ) : (
        <div className="card" style={{ marginTop: 8, borderColor: 'var(--accent)' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5, color: 'var(--accent)', marginBottom: 12 }}>
            {editingId ? '루틴 고치기' : '새 루틴 만들기'}
          </div>

          <label className="label">루틴 이름</label>
          <input
            className="input"
            value={newRoutine.name}
            onChange={(e) => setNewRoutine({ ...newRoutine, name: e.target.value })}
            placeholder="예: 월요일 가슴+삼두"
            style={{ marginBottom: 12 }}
          />

          <label className="label">운동 목록</label>
          {newRoutine.exercises.map((ex, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input
                className="input" placeholder="운동명"
                value={ex.name}
                onChange={(e) => {
                  const updated = [...newRoutine.exercises];
                  updated[i] = { ...updated[i], name: e.target.value };
                  setNewRoutine({ ...newRoutine, exercises: updated });
                }}
                style={{ flex: 2 }}
              />
              <input
                className="input" placeholder="세트" type="number"
                value={ex.sets}
                onChange={(e) => {
                  const updated = [...newRoutine.exercises];
                  updated[i] = { ...updated[i], sets: e.target.value };
                  setNewRoutine({ ...newRoutine, exercises: updated });
                }}
                style={{ flex: 1 }}
              />
              <input
                className="input" placeholder="회" type="number"
                value={ex.reps}
                onChange={(e) => {
                  const updated = [...newRoutine.exercises];
                  updated[i] = { ...updated[i], reps: e.target.value };
                  setNewRoutine({ ...newRoutine, exercises: updated });
                }}
                style={{ flex: 1 }}
              />
              {newRoutine.exercises.length > 1 && (
                <button
                  onClick={() => setNewRoutine({ ...newRoutine, exercises: newRoutine.exercises.filter((_, j) => j !== i) })}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 16, cursor: 'pointer', padding: 0 }}
                >✕</button>
              )}
            </div>
          ))}
          <button
            onClick={() => setNewRoutine({ ...newRoutine, exercises: [...newRoutine.exercises, { name: '', sets: '', reps: '' }] })}
            style={{
              background: 'none', border: '1px dashed var(--border)', color: 'var(--text-muted)',
              padding: '8px', width: '100%', cursor: 'pointer', fontSize: 12, borderRadius: 'var(--radius)',
              marginBottom: 12,
            }}
          >+ 운동 추가</button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={async () => {
                if (!newRoutine.name.trim()) { toast('루틴 이름을 입력하세요'); return; }
                if (!newRoutine.exercises.some(e => e.name.trim())) { toast('운동을 하나 이상 입력하세요'); return; }
                const filtered = { ...newRoutine, exercises: newRoutine.exercises.filter(e => e.name.trim()) };
                // 성공했을 때만 폼을 닫는다. 실패했는데 닫히면 쓰던 것이 통째로 사라진다
                const ok = editingId
                  ? await updateMyRoutine(editingId, filtered)
                  : await saveMyRoutine(filtered);
                if (!ok) return;
                setNewRoutine({ name: '', exercises: [{ name: '', sets: '', reps: '' }] });
                setEditingId(null);
                setShowCreate(false);
              }}
              className="btn-primary"
              style={{ flex: 1 }}
            >{editingId ? '고치기' : '저장'}</button>
            <button
              onClick={() => { setShowCreate(false); setEditingId(null); setNewRoutine({ name: '', exercises: [{ name: '', sets: '', reps: '' }] }); }}
              style={{
                background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                padding: '10px 16px', cursor: 'pointer', fontSize: 13, borderRadius: 'var(--radius)',
              }}
            >취소</button>
          </div>
        </div>
      )}

      {/* 추천은 아래다. 내가 만든 것을 먼저 본다 */}
      <div className="section-title" style={{ marginTop: 32 }}>
        <div className="accent-bar" />
        운동 루틴 추천
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['머신', '맨몸', '홈트'].map((t) => (
          <button
            key={t}
            className={`btn-secondary${type === t ? ' active' : ''}`}
            onClick={() => setType(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {parts.map((p) => (
          <button
            key={p}
            className={`btn-secondary${part === p ? ' active' : ''}`}
            onClick={() => setPart(p)}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          로딩 중...
        </div>
      ) : exercises.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">데이터 없음</div>
          <div className="empty-state-desc">루틴 데이터가 없어요</div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>다른 운동 유형이나 부위를 선택해 보세요</div>
        </div>
      ) : (
        exercises.map((ex, idx) => {
          const name = typeof ex === 'string' ? ex : ex.name;
          const sets = ex.sets || null;
          const reps = ex.reps || null;
          const tip = ex.tip || null;
          const desc = ex.desc || null;
          const isOpen = openIdx === idx;

          return (
            <div
              key={name}
              className="card"
              style={{ marginBottom: 8, borderColor: isOpen ? 'var(--accent)' : 'var(--border)', cursor: 'pointer' }}
            >
              {/* 헤더 (클릭 시 설명 토글) */}
              <div
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5 }}>{name}</span>
                    <span style={{ fontSize: 11, color: isOpen ? 'var(--accent)' : 'var(--text-muted)', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                  </div>
                  {sets && reps && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <span className="badge badge-accent">{sets}</span>
                      <span className="badge badge-accent">{reps}</span>
                    </div>
                  )}
                  {tip && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                      💡 {tip}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: 8 }}>{type} · {part}</span>
              </div>

              {/* 운동 설명 (펼쳤을 때) */}
              {isOpen && desc && (
                <div style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)',
                }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1.5, color: 'var(--accent)', marginBottom: 8 }}>
                    운동 방법
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    {desc}
                  </div>
                  <button
                    className="btn-primary"
                    style={{ marginTop: 12, fontSize: 14, padding: '10px 20px' }}
                    onClick={(e) => { e.stopPropagation(); navigate('/workout', { state: { exercise: name } }); }}
                  >
                    이 운동 기록하기
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ marginTop: 8, fontSize: 13, padding: '8px 16px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const exercise = { name, sets: sets || '3', reps: reps || '10' };
                      const routineName = `${type} ${part} 루틴`;
                      const existing = myRoutines.find(r => r.name === routineName);
                      if (existing) addToRoutine(existing, exercise);
                      else saveMyRoutine({ name: routineName, exercises: [exercise] });
                    }}
                  >
                    + 내 루틴에 추가
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}

    </div>
  );
}
