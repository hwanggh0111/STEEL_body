import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import { useLangStore } from '../store/langStore';
import WorkoutCard from '../components/WorkoutCard';
import RestTimer from '../components/RestTimer';
import PersonalRecordBanner from '../components/PersonalRecordBanner';
import RoutineRun from '../components/RoutineRun';
import BestRecords from '../components/BestRecords';
import { toast } from '../components/Toast';
import { dateKey } from '../data/dateKey';
import { useToday } from '../data/useToday';
import { bestRecords, checkRecord } from '../data/personalRecord';
import { volumeOf } from '../data/weeklyReport';
import { useRoutineSessionStore } from '../store/routineSessionStore';
import { useRestTimerStore } from '../store/restTimerStore';
import { primeAudio } from '../data/alertSound';

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
    minVal: '세트와 횟수는 1 이상의 정수여야 해요',
    records: '기록',
    loading: '로딩 중...',
    noRecords: '이 날짜의 운동 기록이 없어요',
    autofilled: '지난 기록에서 불러왔어요',
    placeholderExercise: '벤치프레스',
    placeholderWeight: '60kg',
    placeholderSets: '4',
    placeholderReps: '12',
    today: '오늘',
    yesterday: '어제',
    otherDay: '다른 날',
    backToToday: '오늘로',
    todayRecords: '오늘 기록',
    noRecordsTitle: '기록 없음',
    addRecord: '+ 운동 기록하기',
    clearExercise: '운동 이름 지우기',
    editingOne: '수정 중',
    cancel: '취소',
    update: '수정 완료',
    updating: '수정 중...',
    updated: '수정 완료!',
    dateMove: '날짜가 옮겨져요',
    tooBig: '세트는 100 이하, 횟수는 1000 이하여야 해요',
    sets_: '세트',
    saveAndNext: '기록하고 다음',
    otherExercise: '다른 운동 적기',
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
    minVal: 'Sets and reps must be whole numbers, at least 1',
    records: 'Records',
    loading: 'Loading...',
    noRecords: 'No workout records for this date',
    autofilled: 'Auto-filled from last session',
    placeholderExercise: 'Bench Press',
    placeholderWeight: '60kg',
    placeholderSets: '4',
    placeholderReps: '12',
    today: 'Today',
    yesterday: 'Yesterday',
    otherDay: 'Other day',
    backToToday: 'Back to today',
    todayRecords: "Today's records",
    noRecordsTitle: 'No records',
    addRecord: '+ Log a workout',
    clearExercise: 'Clear exercise',
    editingOne: 'Editing',
    cancel: 'Cancel',
    update: 'Update',
    updating: 'Updating...',
    updated: 'Updated!',
    dateMove: 'Date will be moved',
    tooBig: 'Sets max 100, reps max 1000',
    sets_: 'sets',
    saveAndNext: 'Save and next',
    otherExercise: 'Log a different exercise',
  },
};

export default function WorkoutPage() {
  const location = useLocation();
  const { lang } = useLangStore();
  const t = TEXT[lang] || TEXT.ko;

  // 같은 식을 손으로 또 적지 않는다 — 이 자리가 8/21 에 새벽 기록이 사라지던 버그의 출처였다
  const today = useToday();
  const [date, setDate] = useState(today);
  // 사람이 날짜를 직접 골랐나. 골랐으면 건드리지 않는다 (아래 자정 넘김 처리에서 쓴다)
  const datePickedRef = useRef(false);
  const [exercise, setExercise] = useState(location.state?.exercise || '');
  // 운동을 지정해서 들어왔나 (운동 검색 · 홈트의 「이 운동 기록하기」).
  // 한 번 저장하고 나면 풀어준다 — 그다음부터는 루틴을 따라가면 된다
  const cameForExerciseRef = useRef(!!location.state?.exercise);
  const [weight, setWeight] = useState('');
  // 홈트를 끝내고 넘어오면 세트·횟수도 같이 온다.
  // 예전에는 운동명만 넘어와서, 시간으로 한 운동에 **세트와 횟수를 지어내야** 했다
  // (둘 다 필수 칸이다). 홈트는 「한 운동 = 한 세트」로 세서 미리 채운다
  const [sets, setSets] = useState(location.state?.sets || '');
  const [reps, setReps] = useState(location.state?.reps || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [autofilled, setAutofilled] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  // 키보드로 훑을 때 어디에 있나. -1 은 아직 아무것도 안 고른 것
  const [suggestIdx, setSuggestIdx] = useState(-1);
  const [editingId, setEditingId] = useState(null);
  const [editingOriginalDate, setEditingOriginalDate] = useState(null);
  // 방금 넘긴 최고 기록. 저장 직후 한 번 띄우고, 근거가 된 기록이 바뀌면 내린다
  const [record, setRecord] = useState(null);

  // 진행 중인 루틴
  const session = useRoutineSessionStore(s => s.session);
  const fetchSession = useRoutineSessionStore(s => s.fetch);
  const markItem = useRoutineSessionStore(s => s.mark);
  // 폼을 미리 채운 자리를 기억해 둔다 — 같은 칸을 두 번 채우면
  // 사용자가 고친 값을 도로 덮어쓴다
  const filledForRef = useRef(null);
  const blurTimerRef = useRef(null);

  const { workouts, loading, fetchAll, addWorkout, updateWorkout, deleteWorkout } = useWorkoutStore();

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { fetchSession(); }, [fetchSession]);
  useEffect(() => () => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); }, []);

  // 켜둔 채 자정을 넘기면 날짜 칸이 어제에 멈춰 있다. 그대로 저장하면 어제 기록이
  // 되고, 오늘 목록에 안 보이니 「저장이 안 됐다」고 읽힌다 (useToday 주석 참고).
  //
  // 오늘로 맞추되 **사람이 직접 고른 날짜는 건드리지 않는다** — 지난 운동을 몰아
  // 적는 중일 수 있다. 그건 고른 사람의 뜻이다. 고치는 중일 때도 그대로 둔다.
  useEffect(() => {
    if (datePickedRef.current || editingId) return;
    setDate(prev => (prev === today ? prev : today));
  }, [today, editingId]);

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

  // 루틴이 가리키는 칸이 바뀌면 폼을 미리 채운다.
  //
  // 채우는 값은 **지난 기록이 먼저**다 — 루틴에 적힌 '4세트 10~12회' 보다
  // 지난번에 실제로 든 무게가 오늘 쓸모 있다. 지난 기록이 없으면 루틴 값을 쓴다.
  //
  // 같은 칸은 한 번만 채운다. 안 그러면 사용자가 고쳐놓은 값을 다시 덮어쓴다.
  //
  // 손대지 않는 자리가 둘 있다.
  //   1. 고치는 중 — 수정하던 폼을 루틴이 빼앗으면 안 된다
  //   2. **운동을 지정해서 들어온 경우** — 운동 검색이나 홈트에서 「이 운동 기록하기」로
  //      들어오면 그 운동을 적으러 온 것이다. 루틴이 있다고 그 칸을 바꿔 놓으면,
  //      누른 것과 다른 운동이 적혀 있게 된다
  useEffect(() => {
    if (editingId) return;
    if (cameForExerciseRef.current) return;
    const idx = session?.current;
    if (session == null || idx == null || idx < 0) { filledForRef.current = null; return; }

    const key = `${session.startedAt}#${idx}`;
    if (filledForRef.current === key) return;
    filledForRef.current = key;

    const item = session.items[idx];
    if (!item) return;

    setExercise(item.name);
    setSuggestions([]);
    const last = findLastRecord(item.name);
    if (last) {
      setWeight(last.weight === (lang === 'en' ? 'Bodyweight' : '맨몸') ? '' : String(last.weight));
      setSets(String(last.sets));
      setReps(String(last.reps));
      setAutofilled(true);
    } else {
      setWeight('');
      setSets(item.sets != null ? String(item.sets) : '');
      setReps(item.reps != null ? String(item.reps) : '');
      setAutofilled(false);
    }
  }, [session, editingId, findLastRecord, lang]);

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
    setSuggestIdx(-1);
  };

  // 자동완성을 **키보드로도** 고를 수 있게.
  //
  // 예전에는 `<div onClick>` 다섯 줄이 전부였다. 폰에서는 되지만 컴퓨터로 치는
  // 사람은 손을 자판에서 떼야 했고, 화면 읽기 프로그램에는 그냥 글자 덩어리였다.
  // 이 앱의 다른 자리(휴식 타이머 토글)는 이미 키보드를 받는다 — 여기만 남아 있었다.
  //
  // ↓↑ 로 훑고 Enter 로 고른다. Esc 로 닫는다. 아무것도 안 골랐을 때(-1) 의 Enter 는
  // 그대로 두어 폼이 저장되게 한다 — 치자마자 저장하는 사람의 길을 막지 않는다
  const handleExerciseKeyDown = (e) => {
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestIdx(n => (n + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestIdx(n => (n <= 0 ? suggestions.length : n) - 1);
    } else if (e.key === 'Enter' && suggestIdx >= 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[suggestIdx]);
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setSuggestIdx(-1);
    }
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
    setSuggestIdx(-1);
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

  // 어느 날을 적고 있는지.
  //
  // 예전에는 날짜 칸이 **폼 맨 아래**에 있었다. 어제 것을 적으려면 운동 · 무게 ·
  // 세트 · 횟수를 다 적고 나서야 날짜를 만났고, 그 값이 아래 목록의 날짜까지 겸해서
  // **바꾸는 순간 오늘 목록이 통째로 사라졌다.** 무슨 일이 일어난 건지 알 수 없다.
  //
  // 날짜를 폼 맨 위로 올리고, 오늘이 아니면 그렇다고 적고 돌아갈 길을 준다.
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateKey(d);
  }, []);
  const isToday = date === today;
  const [pickDay, setPickDay] = useState(false);
  const exerciseInputRef = useRef(null);

  // 그 날 한 것 한 줄. 기록이 없으면 안 그린다
  const dayStat = useMemo(() => {
    const list = workouts[date] || [];
    if (list.length === 0) return null;
    const setCount = list.reduce((n, w) => n + (Number(w.sets) || 0), 0);
    return { count: list.length, sets: setCount, kg: volumeOf(list).kg };
  }, [workouts, date]);

  const dayLabel = (d) => {
    if (d === today) return t.today;
    if (d === yesterday) return t.yesterday;
    return d;
  };

  // 쉬는 중인가. 쉬는 동안에는 타이머가 맨 위로 오고, 폼은 「다음 운동」 한 장으로 줄어든다.
  //
  // 8/25 시안 C 에 있던 것인데 안 넣었던 자리다. 쉬는 동안 화면에 있어야 할 것은
  // 남은 시간과 **다음에 뭘 몇 개 할지**뿐이다 — 운동명 · 날짜 · 자동완성까지 다 펼친
  // 폼을 그대로 두면 쉬는 사이에 볼 것이 아니라 지나칠 것이 된다.
  const restDeadline = useRestTimerStore(s => s.deadline);
  const restPausedLeft = useRestTimerStore(s => s.pausedLeft);
  const resting = restDeadline != null || restPausedLeft != null;

  // 쉬는 중에도 다른 운동을 적을 수 있어야 한다. 누르면 원래 폼으로 돌아간다
  const [freeForm, setFreeForm] = useState(false);
  useEffect(() => { if (!resting) setFreeForm(false); }, [resting]);

  const nextItem = session && session.current >= 0 ? session.items?.[session.current] : null;
  const showNextCard = resting && !editingId && !freeForm && !!nextItem && !!exercise;

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
    // 공백만 친 것은 안 친 것이다. `!exercise` 로만 보면 '   ' 가 통과해서
    // **이름 없는 기록**이 목록에 남는다
    const trimmedExercise = exercise.trim();
    if (!trimmedExercise || !sets || !reps) {
      setError(t.required);
      return;
    }
    if (!Number.isInteger(Number(sets)) || !Number.isInteger(Number(reps))
        || Number(sets) < 1 || Number(reps) < 1) {
      setError(t.minVal);
      return;
    }
    if (Number(sets) > 100 || Number(reps) > 1000) {
      setError(t.tooBig);
      return;
    }
    setSaving(true);
    try {
      const payload = { date, exercise: trimmedExercise, weight: weight || t.bodyweight, sets: Number(sets), reps: Number(reps) };
      if (editingId) {
        await updateWorkout(editingId, payload);
        toast(t.updated);
        setRecord(null);
        setEditingId(null);
        setEditingOriginalDate(null);
        setDate(today);
      } else {
        // 최고 기록은 **넣기 전** 의 것과 견뎌야 한다. 저장한 뒤에 세면 방금 넣은
        // 것이 이미 목록에 있어서 무엇을 넣어도 경신이 아니게 된다.
        const before = bestRecords(workouts);
        await addWorkout(payload);
        toast(t.saved);
        setRecord(checkRecord(before, payload));
        cameForExerciseRef.current = false;

        // 세트를 저장했으니 휴식이 시작된다. 타이머를 안 쓰는 제일 큰 이유는
        // 부정확해서가 아니라 **누르는 걸 잊어서**다 — 저장은 어차피 누른다.
        // 소리는 사람이 누른 이 순간에 준비해야 브라우저가 막지 않는다
        primeAudio();
        useRestTimerStore.getState().autoStartAfterSet(
          `${payload.exercise} ${payload.sets}세트`
        );

        await advanceRoutine('done', payload.exercise);
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

  /**
   * 루틴의 지금 칸을 끝냄(done)이나 건너뜀(skip)으로 넘긴다.
   *
   * 저장한 운동 이름이 루틴의 그 칸과 **다르면 넘기지 않는다.** 루틴을 하다가
   * 중간에 다른 운동을 하나 적을 수 있는데, 그걸로 칸이 넘어가면 안 한 운동이
   * 끝난 것이 된다.
   *
   * 실패해도 조용히 넘어간다 — 기록은 이미 저장됐다. 진행표가 한 칸 안 넘어간 것
   * 때문에 「저장 실패」라고 하면 거짓말이다.
   */
  const advanceRoutine = async (state, savedExercise) => {
    const s = useRoutineSessionStore.getState().session;
    if (!s || s.current < 0) return;
    const item = s.items[s.current];
    if (!item) return;
    if (savedExercise != null && item.name.trim() !== String(savedExercise).trim()) return;
    try {
      const res = await markItem(s.current, state);
      if (res?.finished) {
        toast(`${res.name} 완료! ${res.total}개를 마쳤어요`);
      }
    } catch {
      /* 진행표만 못 넘겼다. 기록은 저장됐다 */
    }
  };

  const skipRoutineItem = async () => {
    await advanceRoutine('skip', null);
  };

  // 카드가 memo 라 핸들러가 매 렌더 바뀌면 memo 가 걸리지 않는다
  const handleEdit = useCallback((w) => {
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
  }, [t]);

  const cancelEdit = () => {
    setEditingId(null);
    setEditingOriginalDate(null);
    setDate(today);
    setExercise('');
    setWeight('');
    setSets('');
    setReps('');
    setAutofilled(false);
    setError('');
  };

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteWorkout(id);
      toast(t.deleted);
      setRecord(null);
    } catch {
      toast(t.deleteFail, 'error');
    }
  }, [deleteWorkout, t]);

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        {t.title}
      </div>

      <RoutineRun onSkip={skipRoutineItem} />

      <PersonalRecordBanner record={record} onClose={() => setRecord(null)} />

      {editingId && (
        <div style={{
          background: 'var(--accent-dim)', border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
              ✎ {t.editingOne}: {exercise}
            </span>
            <button
              onClick={cancelEdit}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                padding: '4px 10px', cursor: 'pointer', fontSize: 11, borderRadius: 'var(--radius)' }}
            >{t.cancel}</button>
          </div>
          {editingOriginalDate && date !== editingOriginalDate && (
            <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 6 }}>
              ⚠ {t.dateMove}: {editingOriginalDate} → {date}
            </div>
          )}
        </div>
      )}

      {/* 그 날 한 것 — 폼 위에 한 줄. 홈에서 「기록 더하기」로 들어와도
          지금까지 뭘 했는지 목록까지 내려가지 않고 알 수 있다 */}
      {dayStat && !editingId && (
        <div style={{
          fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12,
          display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap',
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>{dayLabel(date)}</span>
          <span>{dayStat.count}개 · {dayStat.sets}{t.sets_}{dayStat.kg > 0 ? ` · ${dayStat.kg.toLocaleString()}kg` : ''}</span>
        </div>
      )}

      {/* 쉬는 중이면 타이머가 맨 위다 — 지금 보고 있어야 할 것이 그것이다 */}
      {resting && <RestTimer />}

      {showNextCard ? (
        <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <div className="label">다음 운동</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              fontSize: 16, fontWeight: 600, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{exercise}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <div>
                <label className="label">{t.weight}</label>
                <input className="input" inputMode="decimal" placeholder={t.placeholderWeight} value={weight} onChange={(e) => { setWeight(e.target.value); setAutofilled(false); }} />
              </div>
              <div>
                <label className="label">{t.sets}</label>
                <input className="input" type="number" inputMode="numeric" step="1" min="1" max="100" placeholder={t.placeholderSets} value={sets} onChange={(e) => { setSets(e.target.value); setAutofilled(false); }} />
              </div>
              <div>
                <label className="label">{t.reps}</label>
                <input className="input" type="number" inputMode="numeric" step="1" min="1" max="1000" placeholder={t.placeholderReps} value={reps} onChange={(e) => { setReps(e.target.value); setAutofilled(false); }} />
              </div>
            </div>

            {autofilled && (
              <div style={{ fontSize: 11.5, color: 'var(--accent)' }}>↻ {t.autofilled}</div>
            )}
            {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? t.saving : t.saveAndNext}
            </button>
            <button
              type="button"
              onClick={() => setFreeForm(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 12.5, color: 'var(--text-muted)',
              }}
            >{t.otherExercise}</button>
          </div>
        </form>
      ) : (
      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        {/* 날짜가 맨 위다. 대부분은 오늘을 적으므로 누를 일이 없고,
            어제 것을 적으러 온 사람은 시작하자마자 고른다 */}
        <label className="label">{t.date}</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: pickDay || !isToday ? 8 : 14, flexWrap: 'wrap' }}>
          {[today, yesterday].map(d => (
            <button
              key={d}
              type="button"
              className="btn-secondary"
              onClick={() => { datePickedRef.current = true; setDate(d); setPickDay(false); }}
              style={{
                width: 'auto', padding: '7px 14px', fontSize: 12.5,
                ...(date === d ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#000' } : null),
              }}
            >{dayLabel(d)}</button>
          ))}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPickDay(v => !v)}
            style={{
              width: 'auto', padding: '7px 14px', fontSize: 12.5,
              ...(date !== today && date !== yesterday
                ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#000' }
                : null),
            }}
          >{t.otherDay}</button>
        </div>
        {(pickDay || (date !== today && date !== yesterday)) && (
          <input
            className="input"
            type="date"
            value={date}
            max={today}
            onChange={(e) => { datePickedRef.current = true; setDate(e.target.value); }}
            style={{ marginBottom: 14 }}
          />
        )}

        <label className="label">{t.exerciseName}</label>
        <div style={{ position: 'relative' }}>
          <input
            ref={exerciseInputRef}
            className="input"
            placeholder={t.placeholderExercise}
            value={exercise}
            onChange={handleExerciseChange}
            onBlur={handleExerciseBlur}
            onKeyDown={handleExerciseKeyDown}
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="exercise-suggestions"
            aria-activedescendant={suggestIdx >= 0 ? `exercise-suggestion-${suggestIdx}` : undefined}
            autoComplete="off"
            style={{ marginBottom: 4, paddingRight: exercise ? 36 : undefined }}
          />
          {/* 예전에는 입력칸 아래에 「다른 운동」이라는 단추가 따로 있었다.
              하는 일은 이 칸을 비우는 것뿐인데 이름만 봐서는 알 수 없다.
              지우는 자리는 칸 안이 제자리다 */}
          {exercise && (
            <button
              type="button"
              onClick={() => {
                setExercise(''); setAutofilled(false); setSuggestions([]);
                exerciseInputRef.current?.focus();
              }}
              aria-label={t.clearExercise}
              style={{
                position: 'absolute', right: 8, top: 'calc(50% - 2px)', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 14, padding: 6, lineHeight: 1,
              }}
            >✕</button>
          )}
          {suggestions.length > 0 && (
            <div
              id="exercise-suggestions"
              role="listbox"
              style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              background: 'var(--bg-secondary)', border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)', overflow: 'hidden', marginTop: 2,
            }}>
              {suggestions.map((s, idx) => (
                <div
                  key={s}
                  id={`exercise-suggestion-${idx}`}
                  role="option"
                  aria-selected={idx === suggestIdx}
                  // 누르는 순간 입력칸이 포커스를 잃으면 blur 가 목록을 닫아 클릭이 샌다.
                  // mousedown 을 막아 포커스를 잡아두고, 클릭은 그대로 받는다
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSuggestionClick(s)}
                  onMouseEnter={() => setSuggestIdx(idx)}
                  style={{
                    padding: '10px 12px', cursor: 'pointer', fontSize: 13,
                    borderBottom: '1px solid var(--border)',
                    background: idx === suggestIdx ? 'var(--bg-tertiary)' : 'transparent',
                  }}
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

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label className="label">{t.weight}</label>
            <input className="input" inputMode="decimal" placeholder={t.placeholderWeight} value={weight} onChange={(e) => { setWeight(e.target.value); setAutofilled(false); }} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">{t.sets}</label>
            <input className="input" type="number" inputMode="numeric" step="1" min="1" max="100" placeholder={t.placeholderSets} value={sets} onChange={(e) => { setSets(e.target.value); setAutofilled(false); }} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">{t.reps}</label>
            <input className="input" type="number" inputMode="numeric" step="1" min="1" max="1000" placeholder={t.placeholderReps} value={reps} onChange={(e) => { setReps(e.target.value); setAutofilled(false); }} />
          </div>
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}

        <button className="btn-primary" type="submit" disabled={saving}>
          {saving
            ? (editingId ? t.updating : t.saving)
            : (editingId ? t.update : t.save)}
        </button>
      </form>
      )}

      {/* 쉬는 중이 아니면 폼 아래에 둔다 — 고르고 누르는 자리다 */}
      {!resting && <RestTimer />}

      {/* 목록의 날짜는 폼의 날짜와 같은 값이다. 그래서 오늘이 아니면
          그렇다고 적고 돌아갈 길을 준다 — 예전에는 날짜만 바뀌고 아무 말이 없었다 */}
      <div className="section-title">
        <div className="accent-bar" />
        {isToday ? t.todayRecords : `${date} ${t.records}`}
        {!isToday && (
          <button
            className="btn-secondary"
            onClick={() => { datePickedRef.current = false; setDate(today); setPickDay(false); }}
            style={{ width: 'auto', padding: '5px 12px', fontSize: 11.5, marginLeft: 'auto' }}
          >{t.backToToday}</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          {t.loading}
        </div>
      ) : displayedWorkouts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">{t.noRecordsTitle}</div>
          <div className="empty-state-desc">{t.noRecords}</div>
          {/* 예전에는 `document.querySelector('form input')` 으로 첫 칸을 찾았다.
              폼 맨 위에 날짜 칸이 생기면 엉뚱한 곳에 초점이 간다 — ref 로 짚는다 */}
          <button
            className="btn-primary"
            style={{ marginTop: 12, fontSize: 13, width: 'auto', padding: '10px 20px' }}
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              exerciseInputRef.current?.focus();
            }}
          >{t.addRecord}</button>
        </div>
      ) : (
        displayedWorkouts.map((w) => (
          <WorkoutCard key={w.id} workout={w} onDelete={handleDelete} onEdit={handleEdit} />
        ))
      )}

      <BestRecords workouts={workouts} />

    </div>
  );
}
