import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { toast } from '../components/Toast';

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
  const [newRoutine, setNewRoutine] = useState({ name: '', exercises: [{ name: '', sets: '', reps: '' }] });
  const navigate = useNavigate();

  // Fetch my routines from server
  useEffect(() => {
    client.get('/my-routines')
      .then(({ data }) => setMyRoutines(data))
      .catch(() => toast('루틴을 불러오지 못했어요'));
  }, []);

  const saveMyRoutine = async (routine) => {
    try {
      const { data: saved } = await client.post('/my-routines', routine);
      setMyRoutines(prev => [...prev, { id: saved.id, ...routine }]);
      toast('루틴이 저장됐습니다!');
    } catch {
      toast('루틴 저장에 실패했어요');
    }
  };

  const deleteMyRoutine = async (id) => {
    try {
      await client.delete(`/my-routines/${id}`);
      setMyRoutines(prev => prev.filter(r => (r._id || r.id) !== id));
    } catch {
      toast('루틴 삭제에 실패했어요');
    }
  };

  const parts = PARTS_MAP[type] || PARTS_MAP['머신'];

  useEffect(() => {
    setLoading(true);
    setOpenIdx(null);
    setPart(PARTS_MAP[type]?.[0] || '가슴');
    client.get(`/routines/${type}`)
      .then(({ data }) => setRoutines(data))
      .catch(() => { setRoutines({}); toast('루틴을 불러오지 못했어요'); })
      .finally(() => setLoading(false));
  }, [type]);

  useEffect(() => { setOpenIdx(null); }, [part]);

  const exercises = routines[part] || [];

  return (
    <div>
      <div className="section-title">
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
                      if (existing) {
                        toast(`이미 "${routineName}"에 포함된 운동이에요`);
                      } else {
                        saveMyRoutine({ name: routineName, exercises: [exercise] });
                      }
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

      {/* ─── 나만의 루틴 ─── */}
      <div className="section-title" style={{ marginTop: 28 }}>
        <div className="accent-bar" />
        나만의 루틴
      </div>

      {myRoutines.length > 0 && myRoutines.map((r, i) => (
        <div key={r._id || r.id || i} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5, color: 'var(--accent)' }}>{r.name}</span>
            <button
              onClick={() => { if (!confirm('정말 삭제하시겠어요?')) return; deleteMyRoutine(r._id || r.id); toast('루틴 삭제 완료'); }}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}
            >삭제</button>
          </div>
          {r.exercises.map((ex, j) => (
            <div key={j} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '3px 0' }}>
              {ex.name} {ex.sets && `· ${ex.sets}세트`} {ex.reps && `· ${ex.reps}회`}
            </div>
          ))}
        </div>
      ))}

      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary"
          style={{ width: '100%', marginTop: 8 }}
        >+ 새 루틴 만들기</button>
      ) : (
        <div className="card" style={{ marginTop: 8, borderColor: 'var(--accent)' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5, color: 'var(--accent)', marginBottom: 12 }}>
            새 루틴 만들기
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
              onClick={() => {
                if (!newRoutine.name.trim()) { toast('루틴 이름을 입력하세요'); return; }
                if (!newRoutine.exercises.some(e => e.name.trim())) { toast('운동을 하나 이상 입력하세요'); return; }
                const filtered = { ...newRoutine, exercises: newRoutine.exercises.filter(e => e.name.trim()) };
                saveMyRoutine(filtered);
                setNewRoutine({ name: '', exercises: [{ name: '', sets: '', reps: '' }] });
                setShowCreate(false);
                toast('나만의 루틴이 저장됐습니다!');
              }}
              className="btn-primary"
              style={{ flex: 1 }}
            >저장</button>
            <button
              onClick={() => { setShowCreate(false); setNewRoutine({ name: '', exercises: [{ name: '', sets: '', reps: '' }] }); }}
              style={{
                background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                padding: '10px 16px', cursor: 'pointer', fontSize: 13, borderRadius: 'var(--radius)',
              }}
            >취소</button>
          </div>
        </div>
      )}


    </div>
  );
}
