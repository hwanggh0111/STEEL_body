import { useRefreshTick } from '../store/refreshStore';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { useWorkoutStore } from '../store/workoutStore';
import { useRoutineSessionStore } from '../store/routineSessionStore';
import { useRestTimerStore, formatLeft } from '../store/restTimerStore';
import RestTimer from '../components/RestTimer';
import ExerciseFinder from '../components/ExerciseFinder';
import VoiceSet from '../components/VoiceSet';
import PersonalRecordBanner from '../components/PersonalRecordBanner';
import { toast } from '../components/Toast';
import { showFinish } from '../components/SessionFinish';
import { buildSummary } from '../data/sessionSummary';
import { confirmDialog } from '../components/ConfirmModal';
import { primeAudio } from '../data/alertSound';
import { useToday } from '../data/useToday';
import { dateKey } from '../data/dateKey';
import { bestRecords, checkRecord } from '../data/personalRecord';
import { useWakeLock } from '../data/useWakeLock';
import GymSetting from '../components/GymSetting';
import { useGymStore } from '../store/gymStore';

// 운동 — 5차 리모델링(2026-09-04).
//
// **한 번 운동하는 데 화면 넷을 오갔다.** 루틴에서 고르고, 기록에서 적고, 이름이
// 생각 안 나면 운동 검색으로 나갔다 오고, 장비 없이 할 때는 기능성운동으로 갔다.
// 그래서 화면들이 서로를 흉내내며 메우고 있었다 — 기록 화면에 운동 사전을 한 벌 더
// 들이고(「적으려던 것을 도중에 끊는 셈이다」), 기능성운동은 결과를 기록 화면의
// 필수 칸에 맞춰 넘기고(「세트와 횟수를 지어내야 했다」), 히스토리는 날짜를 넘겼다.
//
// 1~4차는 그때마다 옳게 고쳤다. 그런데 **네 번 모두 경계는 그대로 두고 안쪽을
// 늘렸다.** 그래서 기록 화면이 823줄이 됐다. 5차는 경계를 다시 긋는다 —
// 「고르고 · 찾고 · 적는다」를 한 화면에 둔다.
//
// **적는 단위는 앱의 것을 그대로 쓴다.** 시안에는 세트를 하나씩 적는 것으로 그렸는데,
// 이 앱은 한 줄이 「운동 + 무게 + 세트수 + 횟수」다. 적는 단위를 바꾸면 지난 기록 ·
// 최고 기록 · 볼륨 · 그래프가 전부 딸려 온다. **화면을 다시 짜는 일과 데이터를 다시
// 짜는 일은 다른 일이다.** 오늘은 화면만 한다.

const isBodyweight = (v) => v === '맨몸' || v === 'Bodyweight';

// 무게 칸은 비워도 된다 — 맨몸 운동이다
const asWeight = (v) => (String(v).trim() ? String(v).trim() : '맨몸');

export default function TrainPage() {
  const navigate = useNavigate();
  const today = useToday();

  const workouts = useWorkoutStore((s) => s.workouts);
  const fetchAll = useWorkoutStore((s) => s.fetchAll);
  const addWorkout = useWorkoutStore((s) => s.addWorkout);
  const updateWorkout = useWorkoutStore((s) => s.updateWorkout);
  const deleteWorkout = useWorkoutStore((s) => s.deleteWorkout);

  const session = useRoutineSessionStore((s) => s.session);
  const sessionLoaded = useRoutineSessionStore((s) => s.loaded);
  const fetchSession = useRoutineSessionStore((s) => s.fetch);
  const startSession = useRoutineSessionStore((s) => s.start);
  const markItem = useRoutineSessionStore((s) => s.mark);
  const stopSession = useRoutineSessionStore((s) => s.stop);

  const restLeft = useRestTimerStore((s) => s.leftMs);
  const restDeadline = useRestTimerStore((s) => s.deadline);
  const restPaused = useRestTimerStore((s) => s.pausedLeft);

  const [routines, setRoutines] = useState([]);
  const [routinesFailed, setRoutinesFailed] = useState(false);
  // 몸 지도에서 「등 운동 찾기」로 들어오면 그 부위를 찾아둔 채로 연다.
  // **한 번만 연다** — 뒤로 갔다 오면 state 가 남아 있어, 매번 열면 사람이 닫아도 다시 열린다
  const navState = useLocation().state;
  const enteredState = navState?.part || '';
  // 진행표를 벗어나 직접 고른 운동. 루틴을 하다가 하나 끼워 넣을 때도 이 자리다.
  //
  // **이름을 들고 오는 길도 있다** (`state.exercise`) — 홈의 「이 운동 적기」 ·
  // 운동 검색 · 기능성운동이 그렇게 보낸다. 여태 그 길들은 옛 기록 화면으로 갔는데,
  // 거기가 걷히므로 여기가 받는다. 부위(`part`)는 찾는 자리를 펴는 것이고
  // 이름은 **이미 고른 것**이다 — 한 번 더 고르게 하면 안 된다
  const [picked, setPicked] = useState(
    navState?.exercise ? String(navState.exercise).trim() : null,
  );
  const [searchParams] = useSearchParams();

  // ── 주소로도 들고 올 수 있다 (`/train?q=벤치프레스`) ── (2026-09-17)
  //
  // 홈페이지(`/site`)에서 운동을 찾아 「기록 ›」을 누르면 여기로 온다. 그런데
  // **그 사람은 대개 아직 로그인 전**이다 — 로그인 화면을 거쳐 돌아오는데,
  // `state` 로 실어 보내면 그 사이에 **사라진다**(`PrivateRoute` 가 들려 보내는 것은
  // 주소뿐이다). 주소에 실으면 로그인을 거쳐도 그대로 온다.
  //
  // 길이를 자른다 — 주소창은 아무나 무엇이든 적는 자리다.
  const qParam = (searchParams.get('q') || '').slice(0, 40).trim();
  const enteredPart = enteredState || qParam;
  const [finding, setFinding] = useState(Boolean(enteredPart));
  // **세트·횟수까지 들고 오는 길도 있다** — 기능성운동이 「이 판을 기록하기」로
  // 보낼 때 그렇다(한 운동 = 한 세트, 횟수 1). 이름만 받으면 사람이 세트와 횟수를
  // 지어내야 했다. 들고 온 값은 아래 미리 채우기가 **덮지 않는다**
  const brought = navState?.exercise ? navState : null;
  const [weight, setWeight] = useState(brought?.weight != null ? String(brought.weight) : '');
  const [sets, setSets] = useState(brought?.sets != null ? String(brought.sets) : '');
  const [reps, setReps] = useState(brought?.reps != null ? String(brought.reps) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [record, setRecord] = useState(null);
  const [showTimer, setShowTimer] = useState(false);

  // ── 어느 날에 적는가 ── (2026-09-18)
  //
  // **어제 것을 오늘 적는 일이 실제로 잦다.** 여태 이 화면은 `today` 를 박아 넣고
  // 「고치고 지우고 지난 날짜에 적는 것은 옛 기록 화면에서」라고 적어 뒀다 —
  // 그래서 같은 일을 하는 길이 두 벌이었다. 오늘 그 둘을 하나로 만든다.
  //
  // 대부분은 오늘을 적으므로 **접어 둔다** — 오늘이 아닐 때만 펴진다.
  const [date, setDate] = useState(today);
  const [pickDay, setPickDay] = useState(false);

  // ── 고치는 중인 기록 ── (2026-09-18)
  //
  // 고치기는 **적는 폼을 그대로 쓴다.** 고치는 폼을 따로 그리면 칸 여섯이 두 벌이
  // 되고, 두 벌이 되면 한쪽만 고쳐지는 날이 온다 (기구 세팅에서 같은 이유로
  // 「여기서는 안 고친다」를 골랐다). 대신 **고치는 중임을 화면에 크게 적는다** —
  // 폼이 같으니 그 말이 없으면 새로 적는 것과 구분이 안 된다
  const [editingId, setEditingId] = useState(null);
  const [editingWas, setEditingWas] = useState(null);   // 원래 날짜 (옮겼는지 보려고)

  // 사람이 날짜를 골랐으면 자정을 넘겨도 건드리지 않는다. 안 그러면 어제 것을
  // 적는 중에 날짜가 오늘로 튄다 (`useToday` 는 1분마다 날짜를 다시 본다).
  // 고치는 중일 때도 마찬가지다 — 그 기록의 날짜를 들고 있는 칸이다
  const datePicked = useRef(false);
  useEffect(() => {
    if (datePicked.current || editingId) return;
    setDate((prev) => (prev === today ? prev : today));
  }, [today, editingId]);

  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateKey(d);
  }, [today]);   // 자정을 넘기면 어제도 하루 밀린다

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchSession(); }, [fetchSession]);

  // 머리의 새로고침이 올리는 값. deps 에 넣는 것만으로 다시 받는다
  const refreshTick = useRefreshTick();

  useEffect(() => {
    client.get('/my-routines')
      .then(({ data }) => setRoutines(Array.isArray(data) ? data : []))
      // **못 불러온 것과 없는 것은 다르다.** 없다고 하면 「루틴을 만드세요」가 뜨는데,
      // 만들어 둔 사람에게 그 말은 틀린 말이다
      .catch(() => setRoutinesFailed(true));
    // 기구 세팅도 같이 받는다. 못 받아와도 조용히 넘어간다 — 카드가 안 그려질 뿐이다
    useGymStore.getState().fetch();
  }, [refreshTick]);

  // ── 지금 할 운동 ──
  //
  // 진행표가 가리키는 칸이 기본이고, 사람이 직접 고르면 그것이 이긴다.
  const current = session && session.current >= 0 ? session.items[session.current] : null;

  // 루틴을 도는 동안 화면을 안 재운다 (2026-09-17).
  //
  // **이 화면에 있을 때만이다.** 진행 중인 루틴은 서버에 남아 있어서 끝내기를 안
  // 누르면 밤새 「진행 중」이다 — 그것만 보고 잠그면 폰을 놔둔 채 자도 화면이 켜져
  // 있다. 이 화면을 벗어나면 놓고, 쉬는 동안은 아래 띠(`RestBar`)가 이어받는다
  useWakeLock(Boolean(session));
  const exercise = picked ?? current?.name ?? '';

  // 이 운동을 마지막으로 한 기록. 미리 채울 값이고 화면에도 적는다
  const lastRecord = useMemo(() => {
    if (!exercise) return null;
    const name = exercise.trim();
    let found = null;
    for (const date of Object.keys(workouts).sort().reverse()) {
      const hit = (workouts[date] || []).find((w) => w.exercise?.trim() === name);
      if (hit) { found = { ...hit, date }; break; }
    }
    return found;
  }, [workouts, exercise]);

  // 최고 기록. **`bestRecords` 는 Map 이고 열쇠가 `이름::갈래`다** — 같은 운동이라도
  // 무게로 든 것과 맨몸으로 한 것을 따로 센다. 무게 쪽만 화면에 적는다.
  //
  // ── 표는 기록이 바뀔 때만 만든다 ── (2026-09-18)
  //
  // 여태 `[workouts, exercise]` 로 걸려 있어서 **운동을 고를 때마다 기록 전체를
  // 다시 훑었다.** 표는 운동과 아무 상관이 없다 — 다 만든 표에서 한 칸을 꺼낼 뿐이다.
  //
  // 재보면 5년치(29,200줄)에서 한 번에 **17.4ms** 다. PC 에서 그렇고 폰은 더 걸린다.
  // 루틴을 돌면 운동을 고르는 일이 판마다 일어나고, 그때마다 한 프레임이 버려졌다.
  // 저장할 때도 같은 표를 한 번 더 만들고 있었다(아래 `save`) — 그것도 이걸 쓴다.
  const bestMap = useMemo(() => bestRecords(workouts), [workouts]);
  const best = useMemo(() => {
    if (!exercise) return null;
    return bestMap.get(`${exercise.trim()}::weighted`) || null;
  }, [bestMap, exercise]);

  // 같은 칸은 한 번만 채운다. 안 그러면 사람이 고쳐놓은 값을 다시 덮어쓴다
  const filledFor = useRef(null);
  // 들고 온 세트·횟수가 아직 칸에 있는가 (한 번만 비켜주려고 든다)
  const broughtValues = useRef(brought?.sets != null || brought?.reps != null);
  useEffect(() => {
    // **고치는 중에는 손대지 않는다.** 고치기는 그 기록의 값을 칸에 얹어 두는 것인데,
    // 여기서 미리 채우기가 한 번 더 돌면 사람이 고치려던 값이 지난 기록으로 덮인다
    if (editingId) { filledFor.current = null; return; }
    if (!exercise) { filledFor.current = null; return; }
    const key = `${session?.startedAt ?? 'free'}#${exercise}#${picked ? 'p' : session?.current}`;
    if (filledFor.current === key) return;
    filledFor.current = key;

    // 들고 온 값이 있으면 **그것이 이긴다.** 한 번만 비켜준다 — 다음에 다른 운동을
    // 고르면 평소처럼 지난 기록으로 채운다
    if (broughtValues.current) { broughtValues.current = false; return; }

    // **지난 기록이 먼저다.** 루틴에 적힌 「4세트 10~12회」보다 지난번에 실제로 든
    // 무게가 오늘 쓸모 있다. 지난 기록이 없으면 루틴 값을 쓴다
    if (lastRecord) {
      setWeight(isBodyweight(lastRecord.weight) ? '' : String(lastRecord.weight ?? ''));
      setSets(String(lastRecord.sets ?? ''));
      setReps(String(lastRecord.reps ?? ''));
    } else {
      setWeight('');
      setSets(current?.sets != null ? String(current.sets) : '');
      setReps(current?.reps != null ? String(current.reps) : '');
    }
    setError('');
  }, [exercise, lastRecord, current, session, picked, editingId]);

  // 아래 목록은 **적고 있는 날**을 따라간다. 어제로 옮겨 적는 사람에게 오늘 목록을
  // 보여주면 방금 적은 것이 어디로 갔는지 알 수 없다
  const dayList = workouts[date] || [];
  const isToday = date === today;

  // 「9/17」처럼 짧게. 오늘·어제는 이름으로 부른다 — 날짜를 읽어 헤아리게 하지 않는다
  const dayLabel = (d) =>
    d === today ? '오늘' : d === yesterday ? '어제' : d.slice(5).replace('-', '/');

  // ── 적는다 ──
  const save = async () => {
    if (saving) return;
    const name = exercise.trim();
    if (!name) { setError('무슨 운동인지 골라주세요'); return; }
    if (!sets || !reps) { setError('세트와 횟수를 적어주세요'); return; }
    if (Number(sets) > 100 || Number(reps) > 1000) { setError('숫자가 너무 큽니다'); return; }

    setSaving(true);
    setError('');
    try {
      const payload = { date, exercise: name, weight: asWeight(weight), sets: Number(sets), reps: Number(reps) };

      // ── 고치는 중이면 그 줄을 고친다 ──
      //
      // 최고 기록 배너 · 휴식 타이머 · 진행표 넘기기는 **여기서 하지 않는다.**
      // 고치는 것은 새로 한 세트가 아니다 — 고쳤다고 쉬라고 하면 틀린 말이고,
      // 진행표가 한 칸 넘어가면 안 한 운동이 끝난 것이 된다
      if (editingId) {
        await updateWorkout(editingId, payload);
        toast('고쳤어요');
        setRecord(null);
        // **고친 날에 그대로 서 있는다** — 어제 것을 고치고 오늘로 돌아가면
        // 방금 고친 줄이 화면에서 사라져서 고쳐졌는지 확인할 자리가 없다
        stopEditing({ keepDay: true });
        return;
      }

      // 최고 기록은 **넣기 전** 것과 견준다. 저장한 뒤에 세면 방금 넣은 것이 이미
      // 목록에 있어서 무엇을 넣어도 경신이 아니게 된다.
      //
      // **위에서 만들어 둔 표가 곧 「넣기 전」이다** — 이 함수가 도는 동안에는
      // `workouts` 가 아직 안 바뀌었다(바뀌면 리렌더가 새 표를 만든다).
      // 여기서 또 만들면 5년치에서 17ms 를 저장 단추 누르는 순간에 쓴다
      const before = bestMap;
      const saved = await addWorkout(payload);
      toast(saved?.queued
        ? '신호가 없어 이 기기에 적어뒀어요. 연결되면 저절로 올라가요'
        : isToday ? '적었어요' : `${dayLabel(date)} 자리에 적었어요`);
      setRecord(checkRecord(before, payload));

      // **지난 날짜에 적을 때는 쉬라고 하지 않고 진행표도 안 넘긴다.**
      // 어제 한 운동을 오늘 적어 넣는 중인데 휴식 타이머가 돌면 틀린 말이고,
      // 지금 하고 있는 루틴의 칸이 어제 기록으로 넘어가면 안 한 운동이 끝난 것이 된다
      if (isToday) {
        // 세트를 저장했으니 휴식이 시작된다. 타이머를 안 쓰는 제일 큰 이유는 부정확해서가
        // 아니라 **누르는 걸 잊어서**다 — 저장은 어차피 누른다.
        // 소리는 사람이 누른 이 순간에 준비해야 브라우저가 막지 않는다
        primeAudio();
        const started = useRestTimerStore.getState().autoStartAfterSet(`${name} ${payload.sets}세트`);
        if (started) setShowTimer(true);

        await advance('done', name);
      }
      setPicked(null);
    } catch (err) {
      setError(err.response?.data?.error || '저장하지 못했어요');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 진행표의 지금 칸을 넘긴다.
   *
   * 저장한 운동 이름이 그 칸과 **다르면 넘기지 않는다.** 루틴을 하다가 중간에 다른
   * 운동을 하나 적을 수 있는데, 그걸로 칸이 넘어가면 안 한 운동이 끝난 것이 된다.
   *
   * 실패해도 조용히 넘어간다 — 기록은 이미 저장됐다. 진행표가 한 칸 안 넘어간 것
   * 때문에 「저장 실패」라고 하면 거짓말이다.
   */
  const advance = async (state, savedExercise) => {
    const s = useRoutineSessionStore.getState().session;
    if (!s || s.current < 0) return;
    const item = s.items[s.current];
    if (!item) return;
    if (savedExercise != null && item.name.trim() !== String(savedExercise).trim()) return;
    try {
      const res = await markItem(s.current, state);
      if (res?.finished) {
        // **마친 자리에서 하루치를 한 장으로 보여준다** (2026-09-16).
        // 여태 토스트 한 줄이 4초 지나가고 끝이었다 — 하루 중 제일 뿌듯한 순간이
        // 제일 조용했다. 기록은 이 위에서 이미 저장됐으므로 스토어에서 바로 꺼낸다
        showFinish(buildSummary(useWorkoutStore.getState().workouts, today, res.name));
      }
    } catch {
      /* 진행표만 못 넘겼다 */
    }
  };

  const skip = async () => {
    if (picked) { setPicked(null); return; }   // 끼워 넣은 운동은 그냥 물린다
    await advance('skip', null);
  };

  const begin = async (routineId) => {
    try {
      await startSession(routineId);
      setPicked(null);
      toast('시작했어요');
    } catch (err) {
      toast(err.response?.data?.error || '시작하지 못했어요', 'error');
    }
  };

  const end = async () => {
    const ok = await confirmDialog('하던 루틴을 끝낼까요? 적어둔 기록은 그대로 남습니다.',
      { title: '루틴 끝내기', confirmText: '끝냅니다' });
    if (!ok) return;
    try { await stopSession(); toast('끝냈어요'); } catch { toast('끝내지 못했어요', 'error'); }
  };

  const pick = useCallback((name) => {
    setPicked(String(name || '').trim());
    setFinding(false);
  }, []);

  // ── 고치기 · 지우기 ── (2026-09-18)
  //
  // 옛 기록 화면이 하던 일을 여기로 들여온다. 서버에는 `PUT`·`DELETE` 가 이미 있고
  // 스토어에도 `updateWorkout`·`deleteWorkout` 이 있다 — **화면만 없었다.**
  const startEditing = (w) => {
    setEditingId(w.id);
    setEditingWas(w.date);
    datePicked.current = true;   // 그 기록의 날짜를 지킨다 (자정을 넘겨도)
    setDate(w.date);
    setPicked(w.exercise);
    setWeight(isBodyweight(w.weight) ? '' : String(w.weight ?? ''));
    setSets(String(w.sets ?? ''));
    setReps(String(w.reps ?? ''));
    setFinding(false);
    setError('');
    setRecord(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * 고치기를 끝낸다.
   *
   * `keepDay` — 고친 날에 그대로 서 있는다 (2026-09-18 리뷰에서 잡았다).
   * 어제 것을 고치고 나서 오늘로 돌아가 버리면 **방금 고친 줄이 화면에서 사라진다** —
   * 고쳐졌는지 눈으로 확인할 자리가 없어진다. 「그만두기」로 물릴 때는 오늘로 돌아간다
   * (고치려던 것을 안 고쳤으니 적는 자리로 돌아오는 것이 맞다).
   */
  const stopEditing = ({ keepDay = false } = {}) => {
    setEditingId(null);
    setEditingWas(null);
    if (keepDay) {
      // 고친 날에 서 있는다. 오늘이면 자정 넘김을 다시 따라가게 풀어둔다
      datePicked.current = date !== today;
      setPicked(null);
      setWeight('');
      setSets('');
      setReps('');
      setError('');
      return;
    }
    datePicked.current = false;
    setDate(today);
    setPicked(null);
    setWeight('');
    setSets('');
    setReps('');
    setError('');
  };

  // **한 번 묻는다.** 지운 기록은 되돌릴 데가 없다 (서버에도 휴지통이 없다)
  const removeRecord = async (w) => {
    const ok = await confirmDialog(
      `「${w.exercise} ${isBodyweight(w.weight) ? '맨몸' : w.weight + 'kg'} × ${w.sets}×${w.reps}」 를 지울까요?

지운 기록은 되돌릴 수 없습니다.`,
      { title: '이 줄을 지울까요', confirmText: '지웁니다', danger: true },
    );
    if (!ok) return;
    try {
      await deleteWorkout(w.id);
      if (editingId === w.id) stopEditing();
      toast('지웠어요');
    } catch {
      toast('지우지 못했어요', 'error');
    }
  };

  const restRunning = restDeadline != null || restPaused != null;

  return (
    <div>
      {/* ── 머리 ── 쉬는 중이면 남은 시간이 여기 붙는다. 화면을 내려도 안 사라진다 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div className="section-title" style={{ marginBottom: 0, flexGrow: 1 }}>
          <div className="accent-bar" />
          운동
        </div>
        <button
          onClick={() => { primeAudio(); setShowTimer((v) => !v); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: restRunning ? 'var(--accent-dim)' : 'none',
            border: `1px solid ${restRunning ? 'var(--accent)' : 'var(--border-hover)'}`,
            borderRadius: 'var(--radius)', padding: '5px 11px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            stroke={restRunning ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="13" r="8" /><path d="M12 9.5V13l2.3 1.6M9 2h6" />
          </svg>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1.5,
            color: restRunning ? 'var(--accent)' : 'var(--text-muted)',
          }}>{restRunning ? formatLeft(restLeft) : '휴식'}</span>
        </button>
      </div>

      {showTimer && <RestTimer />}

      {/* ── 하는 중 ── */}
      {session ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: 1 }}>하는 중</span>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{session.name}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--accent)' }}>
              {session.done} / {session.total}
            </span>
          </div>

          <div style={{ height: 3, background: 'var(--bg-primary)', marginBottom: 12 }}>
            <div style={{
              width: `${session.total ? (session.done / session.total) * 100 : 0}%`,
              height: 3, background: 'var(--accent)', transition: 'width 0.2s',
            }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {session.items.map((item, i) => {
              const isNow = i === session.current;
              const done = item.state === 'done';
              const skipped = item.state === 'skip';
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: isNow ? '9px 10px' : '7px 10px',
                  background: isNow ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                  border: `1px solid ${isNow ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                }}>
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)"
                      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 12.5 9.5 18 20 6.5" />
                    </svg>
                  ) : (
                    <span style={{
                      width: 6, height: 6, flexShrink: 0,
                      background: isNow ? 'var(--accent)' : 'none',
                      border: isNow ? 'none' : '1px solid var(--border-hover)',
                    }} />
                  )}
                  <span style={{
                    fontSize: isNow ? 13.5 : 13, flexGrow: 1,
                    color: done || skipped ? 'var(--text-muted)' : isNow ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textDecoration: skipped ? 'line-through' : 'none',
                  }}>{item.name}</span>
                  <span style={{ fontSize: 11.5, color: isNow ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {done ? '완료' : skipped ? '건너뜀' : item.sets ? `${item.sets}세트` : ''}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            onClick={end}
            className="btn-secondary"
            style={{ width: 'auto', marginTop: 11, padding: '5px 14px', fontSize: 12 }}
          >루틴 끝내기</button>
        </div>
      ) : sessionLoaded && (
        /* ── 시작하는 자리 ──
           예전에는 루틴 화면에서 시작하고 기록 화면으로 건너와야 했다.
           고르는 것도 적는 것도 여기다 */
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="label">무엇을 하시겠어요</div>
          {routines.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
              {/* 줄 하나에 **시작**과 **고치기**가 같이 있다. 단추 안에 단추를 넣을 수
                  없어서 줄을 div 로 두고 둘을 나란히 놓는다.
                  고치는 자리는 루틴 화면이다 — 폼을 여기 한 벌 더 그리면 두 벌이 된다 */}
              {routines.slice(0, 4).map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '4px 4px 4px 12px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  }}
                >
                  <button
                    onClick={() => begin(r.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left',
                      flexGrow: 1, padding: '6px 0', background: 'none', border: 'none',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: 13.5, color: 'var(--text-primary)', flexGrow: 1 }}>{r.name}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {(r.exercises || []).length}개
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--accent)' }}>시작</span>
                  </button>
                  <button
                    onClick={() => navigate('/routine', { state: { editId: r.id } })}
                    aria-label={`${r.name} 루틴 고치기`}
                    title="루틴 고치기"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, flexShrink: 0,
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                      stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 20h4L20 8l-4-4L4 16v4Z" /><path d="M14.5 5.5 18.5 9.5" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.7 }}>
              {routinesFailed
                ? '루틴을 못 불러왔어요. 아래에서 바로 적으실 수 있습니다.'
                : '짜둔 루틴이 없어요. 아래에서 운동을 골라 바로 적으셔도 됩니다.'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 7 }}>
            <button className="btn-secondary" style={{ flexGrow: 1, fontSize: 12.5, padding: '9px 0' }}
              onClick={() => navigate('/routine')}>루틴 짜기</button>
            <button className="btn-secondary" style={{ flexGrow: 1, fontSize: 12.5, padding: '9px 0' }}
              onClick={() => navigate('/homeworkout')}>기능성운동</button>
          </div>
        </div>
      )}

      {/* ── 지금 적는 자리 ── */}
      <div className="card" style={{
        marginBottom: 14,
        borderColor: editingId ? 'var(--warning)' : exercise ? 'var(--accent)' : 'var(--border)',
      }}>
        {/* **고치는 중임을 맨 위에 적는다.** 폼이 새로 적는 것과 같으므로,
            이 말이 없으면 「이 운동 적기」를 눌렀을 때 한 줄이 더 생기는지
            고쳐지는지 알 수 없다. 그만둘 길도 같은 줄에 둔다 */}
        {editingId && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            padding: '8px 10px', background: 'var(--bg-secondary)',
            border: '1px solid var(--border-hover)', borderRadius: 'var(--radius)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexGrow: 1 }}>
              적어둔 줄을 고치는 중
              {editingWas && editingWas !== date && (
                <span style={{ color: 'var(--danger)' }}> · {dayLabel(editingWas)} → {dayLabel(date)} 로 옮깁니다</span>
              )}
            </span>
            <button
              onClick={stopEditing}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', font: 'inherit' }}
            >그만두기</button>
          </div>
        )}

        {exercise ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span className="display-sm" style={{ color: 'var(--text-primary)' }}>{exercise}</span>
              {picked && !editingId && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>끼워 넣은 운동</span>
              )}
            </div>

            {/* 지난 기록은 **미리 채우기만 하고 끝내지 않는다.** 무엇을 보고 채웠는지
                적어줘야 오늘 올릴지 말지를 사람이 정한다 */}
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.7 }}>
              {lastRecord ? (
                <>지난번 <span style={{ color: 'var(--text-primary)' }}>
                  {isBodyweight(lastRecord.weight) ? '맨몸' : `${lastRecord.weight} kg`} &times; {lastRecord.reps}회
                </span> ({lastRecord.date.slice(5).replace('-', '/')})</>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>처음 하는 운동이에요</span>
              )}
              {best?.weight != null && (
                <> &nbsp;&middot;&nbsp; 최고 <span style={{ color: 'var(--text-primary)' }}>{best.weight} kg</span></>
              )}
            </div>

            {/* ── 기구 세팅 ── (2026-09-17)
                기구 앞에서 **매번 다시 맞춘다** — 시트 몇 번, 발판 몇 칸, 그립 어디.
                한두 번 틀리게 맞춘 뒤에야 몸이 기억해내고, 그 사이에 세트 한두 개를 버린다.

                **운동 이름 바로 아래다.** 처음에는 이 카드 위에 따로 뒀는데, 캡처로 빼보니
                **세팅을 먼저 보고 그 다음에 무슨 운동인지 알게 되는** 차례였다 —
                「시트 4번」이 무엇의 시트인지 모르는 채로 먼저 읽힌다.
                기구를 맞추는 일은 무게를 적는 일보다 먼저이되, **어느 운동인지 안 다음**이다 */}
            <GymSetting exercise={exercise} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
              <div>
                <label className="label" htmlFor="tr-w">무게 kg</label>
                <input id="tr-w" className="input" inputMode="decimal" value={weight}
                  onChange={(e) => setWeight(e.target.value)} placeholder="맨몸" />
              </div>
              <div>
                <label className="label" htmlFor="tr-s">세트</label>
                <input id="tr-s" className="input" inputMode="numeric" value={sets}
                  onChange={(e) => setSets(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="tr-r">횟수</label>
                <input id="tr-r" className="input" inputMode="numeric" value={reps}
                  onChange={(e) => setReps(e.target.value)} />
              </div>
            </div>

            {/* 목소리로 적기 (2026-09-16). **폼을 채우는 데까지**만 한다 —
                헬스장은 시끄럽고 알아듣기는 틀린다. 곧바로 저장하면 틀린 기록이
                조용히 쌓이고, 그러면 이 앱의 모든 숫자를 못 믿게 된다.
                알아듣기가 안 되는 브라우저에서는 단추가 아예 안 나온다 */}
            <div style={{ marginBottom: 10 }}>
              <VoiceSet onFill={(v) => {
                // 안 들은 칸은 그대로 둔다. 비우면 지난 기록으로 채워둔 값이 날아간다
                if (v.weight !== null) setWeight(v.weight === '맨몸' ? '' : String(v.weight));
                if (v.reps !== null) setReps(String(v.reps));
                if (v.sets !== null) setSets(String(v.sets));
                setError('');
              }} />
            </div>

            {/* ── 어느 날 것인가 ── (2026-09-18)
                **접혀 있다.** 오늘을 적는 사람은 여기를 볼 일이 없어야 한다 —
                한 줄이 늘면 매일 한 번씩 읽어야 하는 것이 한 줄 늘어난다.
                오늘이 아니면 펴진 채로 있고, 무슨 날인지 글자로 적힌다 */}
            {(isToday && !pickDay && !editingId) ? (
              <button
                onClick={() => setPickDay(true)}
                style={{
                  background: 'none', border: 'none', padding: 0, marginBottom: 10,
                  color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', font: 'inherit',
                }}
              >지난 날짜에 적기</button>
            ) : (
              <div style={{ marginBottom: 10 }}>
                <div className="label">어느 날 한 것</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 7 }}>
                  {[today, yesterday].map((d) => (
                    <button
                      key={d}
                      className="btn-secondary"
                      onClick={() => { datePicked.current = true; setDate(d); }}
                      style={{
                        width: 'auto', padding: '6px 13px', fontSize: 12.5,
                        ...(date === d ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--on-accent)' } : null),
                      }}
                    >{dayLabel(d)}</button>
                  ))}
                  <input
                    className="input"
                    type="date"
                    value={date}
                    max={today}
                    /* **아래 테두리도 있다** — `max` 만 걸면 연도를 직접 칠 수 있어서
                       2026 대신 1026 이 들어간다. 한 번 들어간 줄은 1년 벽 · 달력 ·
                       이어온 주에 계속 남는다 (서버도 같은 값으로 막는다) */
                    min="2000-01-01"
                    aria-label="다른 날"
                    onChange={(e) => {
                      // 빈 값으로 오면 무시한다 — 달력을 열었다 닫기만 해도 빈 값이 온다.
                      // 그대로 받으면 날짜 없는 기록을 보내게 된다
                      if (!e.target.value) return;
                      datePicked.current = true;
                      setDate(e.target.value);
                    }}
                    style={{ width: 'auto', flexGrow: 1, minWidth: 130, padding: '6px 10px', fontSize: 12.5 }}
                  />
                </div>
                {!isToday && (
                  <div style={{ fontSize: 11.5, color: 'var(--warning)' }}>
                    오늘이 아닌 {dayLabel(date)} 자리에 적습니다
                  </div>
                )}
              </div>
            )}

            {error && (
              <div style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 10 }}>{error}</div>
            )}

            <button className="btn-primary" disabled={saving} onClick={save}>
              {saving
                ? (editingId ? '고치는 중…' : '적는 중…')
                : editingId ? '이대로 고치기' : isToday ? '이 운동 적기' : `${dayLabel(date)} 자리에 적기`}
            </button>

            {/* 고치는 중에는 **운동을 바꾸거나 건너뛰지 않는다.** 그 줄이 어느 운동이었는지가
                고치는 일의 전제다 — 이름을 바꾸려면 지우고 새로 적는 것이 맞다 */}
            {!editingId && (
              <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
                <button className="btn-secondary" style={{ flexGrow: 1, fontSize: 12, padding: '8px 0' }}
                  onClick={() => setFinding((v) => !v)}>
                  {finding ? '닫기' : '운동 바꾸기'}
                </button>
                {(current || picked) && (
                  <button className="btn-secondary" style={{ flexGrow: 1, fontSize: 12, padding: '8px 0' }}
                    onClick={skip}>{picked ? '물리기' : '건너뛰기'}</button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="label">무슨 운동을 하셨나요</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 10 }}>
              이름을 찾아 고르면 지난 기록이 저절로 채워집니다.
            </div>
            <button className="btn-primary" onClick={() => setFinding(true)}>운동 찾기</button>
          </>
        )}

        {/* **찾는 자리가 이 화면 안에 있다.** 예전에는 이름이 생각 안 나면 운동 검색
            화면으로 나갔다 들어와야 했다 — 적으려던 것을 도중에 끊는 셈이었다 */}
        {finding && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <ExerciseFinder onPick={pick} pickLabel="이걸로" autoFocus compact initialQuery={enteredPart} />
          </div>
        )}
      </div>

      {/* 최고 기록을 넘겼을 때만 뜬다. **기록 화면이 쓰던 그 배너를 그대로 쓴다** —
          같은 일을 두 벌로 그리면 한쪽만 고치는 날이 온다 */}
      <PersonalRecordBanner record={record} onClose={() => setRecord(null)} />

      {/* ── 그 날 적은 것 ── 목록은 위에서 고른 날을 따라간다 */}
      <div className="section-title">
        <div className="accent-bar" />
        {isToday ? '오늘 적은 것' : `${dayLabel(date)} 에 적은 것`}
        {dayList.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Barlow', sans-serif", letterSpacing: 0 }}>
            {dayList.length}개
          </span>
        )}
      </div>

      {dayList.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          {isToday
            ? '아직 없어요. 위에서 한 개 적으면 여기 쌓입니다.'
            : `${dayLabel(date)} 에 적은 것이 없어요.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {dayList.map((w) => (
            <div key={w.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
              background: 'var(--card-bg)',
              border: `1px solid ${editingId === w.id ? 'var(--warning)' : 'var(--border)'}`,
              boxShadow: 'var(--card-edge)', borderRadius: 'var(--radius)',
              opacity: w.pending ? 0.7 : 1,
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', flexGrow: 1 }}>{w.exercise}</span>
              {w.failed && (
                <span style={{ fontSize: 11, color: 'var(--danger)' }}>못 올림</span>
              )}
              {w.pending && !w.failed && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>이 기기에</span>
              )}
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {isBodyweight(w.weight) ? '맨몸' : `${w.weight}`} &times; {w.sets}&times;{w.reps}
              </span>

              {/* ── 고치기 · 지우기 ── (2026-09-18)
                  **글자가 아니라 그림으로 둔다** — 줄마다 「고치기 · 지우기」를 적으면
                  기록 스무 줄에 같은 말이 마흔 번 적힌다. 손가락 자리(36px)는 지킨다.
                  못 올린 줄도 고치고 지울 수 있다 — 줄에 세워둔 것은 스토어가 알아서
                  기기 안에서 고친다(`isLocalId`) */}
              <button
                onClick={() => startEditing(w)}
                aria-label={`${w.exercise} 고치기`}
                title="고치기"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, flexShrink: 0, marginLeft: 2,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                  stroke={editingId === w.id ? 'var(--warning)' : 'var(--text-muted)'}
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20h4L20 8l-4-4L4 16v4Z" /><path d="M14.5 5.5 18.5 9.5" />
                </svg>
              </button>
              <button
                onClick={() => removeRecord(w)}
                aria-label={`${w.exercise} 지우기`}
                title="지우기"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, flexShrink: 0,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                  stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
