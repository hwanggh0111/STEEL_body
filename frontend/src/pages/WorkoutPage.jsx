import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import { useLangStore } from '../store/langStore';
import WorkoutCard from '../components/WorkoutCard';
import RestTimer from '../components/RestTimer';
import { toast } from '../components/Toast';

const TEXT = {
  ko: {
    title: '운동 기록',
    date: '날짜',
    exerciseName: '운동명',
    weight: '무게',
    sets: '세트',
    reps: '횟수',
    bodyweight: '맨몸',
    save: '기록 저장',
    saving: '저장 중...',
    saved: '운동 기록 저장!',
    deleted: '삭제 완료!',
    deleteFail: '삭제 실패',
    saveFail: '저장 실패',
    required: '운동명, 세트, 횟수를 입력해주세요',
    minVal: '세트와 횟수는 1 이상이어야 해요',
    records: '기록',
    loading: '로딩 중...',
    noRecords: '이 날짜의 운동 기록이 없어요',
    autofilled: '지난 기록에서 불러왔어요',
    placeholderExercise: '벤치프레스',
    placeholderWeight: '60kg',
    placeholderSets: '4',
    placeholderReps: '12',
  },
  en: {
    title: 'Workout Log',
    date: 'Date',
    exerciseName: 'Exercise',
    weight: 'Weight',
    sets: 'Sets',
    reps: 'Reps',
    bodyweight: 'Bodyweight',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Workout saved!',
    deleted: 'Deleted!',
    deleteFail: 'Delete failed',
    saveFail: 'Save failed',
    required: 'Please enter exercise, sets and reps',
    minVal: 'Sets and reps must be at least 1',
    records: 'Records',
    loading: 'Loading...',
    noRecords: 'No workout records for this date',
    autofilled: 'Auto-filled from last session',
    placeholderExercise: 'Bench Press',
    placeholderWeight: '60kg',
    placeholderSets: '4',
    placeholderReps: '12',
  },
};

export default function WorkoutPage() {
  const location = useLocation();
  const { lang } = useLangStore();
  const t = TEXT[lang] || TEXT.ko;

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [date, setDate] = useState(today);
  const [exercise, setExercise] = useState(location.state?.exercise || '');
  const [weight, setWeight] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [autofilled, setAutofilled] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingOriginalDate, setEditingOriginalDate] = useState(null);
  const blurTimerRef = useRef(null);

  const { workouts, loading, fetchAll, addWorkout, updateWorkout, deleteWorkout } = useWorkoutStore();

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => () => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); }, []);

  // 운동별 최근 기록 인덱스 (O(1) 조회)
  const exerciseIndex = useMemo(() => {
    const idx = new Map();
    const sortedDates = Object.keys(workouts).sort((a, b) => a.localeCompare(b));
    for (const d of sortedDates) {
      for (const r of workouts[d]) {
        idx.set(r.exercise.trim().toLowerCase(), r);
      }
    }
    return idx;
  }, [workouts]);

  const findLastRecord = useCallback((name) => {
    if (!name) return null;
    return exerciseIndex.get(name.trim().toLowerCase()) || null;
  }, [exerciseIndex]);

  // 운동명 자동완성 후보 (workouts 변경 시에만 재계산)
  const allExercises = useMemo(
    () => [...new Set(Object.values(workouts).flat().map(w => w.exercise).filter(Boolean))],
    [workouts]
  );

  // 운동명 변경 시 이전 기록 자동 채우기 + 자동완성 제안
  const handleExerciseChange = (e) => {
    const val = e.target.value;
    setExercise(val);
    setAutofilled(false);
    const filtered = allExercises.filter(ex => ex.toLowerCase().includes(val.toLowerCase()));
    setSuggestions(val ? filtered.slice(0, 5) : []);
  };

  const handleExerciseBlur = () => {
    // 드롭다운 클릭을 허용하기 위해 약간의 딜레이 후 닫기
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => setSuggestions([]), 150);
    if (!exercise.trim()) return;
    const last = findLastRecord(exercise);
    if (last) {
      // 이미 사용자가 값을 입력한 필드는 덮어쓰지 않음 (모두 비어있을 때만 자동 채우기)
      if (!weight && !sets && !reps) {
        setWeight(last.weight === (lang === 'en' ? 'Bodyweight' : '맨몸') ? '' : String(last.weight));
        setSets(String(last.sets));
        setReps(String(last.reps));
        setAutofilled(true);
      }
    }
  };

  const handleSuggestionClick = (name) => {
    setExercise(name);
    setSuggestions([]);
    // 자동 채우기 트리거
    const last = findLastRecord(name);
    if (last && !weight && !sets && !reps) {
      setWeight(last.weight === (lang === 'en' ? 'Bodyweight' : '맨몸') ? '' : String(last.weight));
      setSets(String(last.sets));
      setReps(String(last.reps));
      setAutofilled(true);
    }
  };

  const todayWorkouts = workouts[date] || [];

  // 수정 중인데 폼 날짜를 바꾼 경우, 수정 카드를 list에서 잃지 않도록 원본 날짜의 카드도 노출
  const displayedWorkouts = useMemo(() => {
    if (!editingId || !editingOriginalDate || date === editingOriginalDate) return todayWorkouts;
    const editingRecord = (workouts[editingOriginalDate] || []).find(w => w.id === editingId);
    if (!editingRecord) return todayWorkouts;
    return [editingRecord, ...todayWorkouts];
  }, [todayWorkouts, editingId, editingOriginalDate, date, workouts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!exercise || !sets || !reps) {
      setError(t.required);
      return;
    }
    if (Number(sets) < 1 || Number(reps) < 1) {
      setError(t.minVal);
      return;
    }
    if (Number(sets) > 100 || Number(reps) > 1000) {
      setError(lang === 'en' ? 'Sets max 100, reps max 1000' : '세트는 100 이하, 횟수는 1000 이하여야 해요');
      return;
    }
    setSaving(true);
    try {
      const payload = { date, exercise, weight: weight || t.bodyweight, sets: Number(sets), reps: Number(reps) };
      if (editingId) {
        await updateWorkout(editingId, payload);
        toast(lang === 'en' ? 'Updated!' : '수정 완료!');
        setEditingId(null);
        setEditingOriginalDate(null);
      } else {
        await addWorkout(payload);
        toast(t.saved);
      }
      setWeight('');
      setSets('');
      setReps('');
      setAutofilled(false);
    } catch (err) {
      setError(err.response?.data?.error || t.saveFail);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (w) => {
    setEditingId(w.id);
    setEditingOriginalDate(w.date);
    setDate(w.date);
    setExercise(w.exercise);
    setWeight(w.weight === t.bodyweight || w.weight === '맨몸' || w.weight === 'Bodyweight' ? '' : String(w.weight));
    setSets(String(w.sets));
    setReps(String(w.reps));
    setAutofilled(false);
    setError('');
    setSuggestions([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingOriginalDate(null);
    setExercise('');
    setWeight('');
    setSets('');
    setReps('');
    setAutofilled(false);
    setError('');
  };

  const handleDelete = async (id) => {
    try {
      await deleteWorkout(id);
      toast(t.deleted);
    } catch {
      toast(t.deleteFail);
    }
  };

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        {t.title}
      </div>

      {editingId && (
        <div style={{
          background: 'var(--accent-dim)', border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
              ✎ {lang === 'en' ? `Editing: ${exercise}` : `수정 중: ${exercise}`}
            </span>
            <button
              onClick={cancelEdit}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                padding: '4px 10px', cursor: 'pointer', fontSize: 11, borderRadius: 'var(--radius)' }}
            >{lang === 'en' ? 'Cancel' : '취소'}</button>
          </div>
          {editingOriginalDate && date !== editingOriginalDate && (
            <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 6 }}>
              ⚠ {lang === 'en'
                ? `Date will be moved: ${editingOriginalDate} → ${date}`
                : `날짜가 이동돼요: ${editingOriginalDate} → ${date}`}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <label className="label">{t.exerciseName}</label>
        <div style={{ position: 'relative' }}>
          <input
            className="input"
            placeholder={t.placeholderExercise}
            value={exercise}
            onChange={handleExerciseChange}
            onBlur={handleExerciseBlur}
            style={{ marginBottom: 4 }}
          />
          {suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              background: 'var(--bg-secondary)', border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)', overflow: 'hidden', marginTop: 2,
            }}>
              {suggestions.map(s => (
                <div key={s} onClick={() => handleSuggestionClick(s)}
                  style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >{s}</div>
              ))}
            </div>
          )}
        </div>
        {autofilled && (
          <div style={{
            fontSize: 12,
            color: 'var(--accent)',
            marginBottom: 8,
            fontFamily: "'Bebas Neue', sans-serif",
            letterSpacing: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{ fontSize: 14 }}>&#8635;</span> {t.autofilled}
          </div>
        )}
        {!autofilled && <div style={{ marginBottom: 10 }} />}
        {exercise && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { setExercise(''); setAutofilled(false); }}
            style={{ fontSize: 11, padding: '4px 10px', marginBottom: 10 }}
          >{lang === 'en' ? 'Different exercise' : '다른 운동'}</button>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="label">{t.weight}</label>
            <input className="input" placeholder={t.placeholderWeight} value={weight} onChange={(e) => { setWeight(e.target.value); setAutofilled(false); }} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">{t.sets}</label>
            <input className="input" type="number" placeholder={t.placeholderSets} value={sets} onChange={(e) => { setSets(e.target.value); setAutofilled(false); }} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">{t.reps}</label>
            <input className="input" type="number" placeholder={t.placeholderReps} value={reps} onChange={(e) => { setReps(e.target.value); setAutofilled(false); }} />
          </div>
        </div>

        <label className="label">{t.date}</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 10 }} />

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}

        <button className="btn-primary" type="submit" disabled={saving}>
          {saving
            ? (editingId ? (lang === 'en' ? 'Updating...' : '수정 중...') : t.saving)
            : (editingId ? (lang === 'en' ? 'Update' : '수정 완료') : t.save)}
        </button>
      </form>

      {/* 휴식 타이머 */}
      <RestTimer />

      <div className="section-title">
        <div className="accent-bar" />
        {date} {t.records}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          {t.loading}
        </div>
      ) : displayedWorkouts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">기록 없음</div>
          <div className="empty-state-desc">{t.noRecords}</div>
          <button className="btn-primary" style={{ marginTop: 12, fontSize: 13 }} onClick={() => { document.querySelector('form input')?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>+ 운동 기록하기</button>
        </div>
      ) : (
        displayedWorkouts.map((w) => (
          <WorkoutCard key={w.id} workout={w} onDelete={handleDelete} onEdit={handleEdit} />
        ))
      )}

    </div>
  );
}
