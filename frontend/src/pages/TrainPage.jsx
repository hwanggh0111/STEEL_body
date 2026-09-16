import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useWorkoutStore } from '../store/workoutStore';
import { useRoutineSessionStore } from '../store/routineSessionStore';
import { useRestTimerStore, formatLeft } from '../store/restTimerStore';
import RestTimer from '../components/RestTimer';
import ExerciseFinder from '../components/ExerciseFinder';
import PersonalRecordBanner from '../components/PersonalRecordBanner';
import { toast } from '../components/Toast';
import { showFinish } from '../components/SessionFinish';
import { buildSummary } from '../data/sessionSummary';
import { confirmDialog } from '../components/ConfirmModal';
import { primeAudio } from '../data/alertSound';
import { useToday } from '../data/useToday';
import { bestRecords, checkRecord } from '../data/personalRecord';

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
  // 진행표를 벗어나 직접 고른 운동. 루틴을 하다가 하나 끼워 넣을 때도 이 자리다
  const [picked, setPicked] = useState(null);
  // 몸 지도에서 「등 운동 찾기」로 들어오면 그 부위를 찾아둔 채로 연다.
  // **한 번만 연다** — 뒤로 갔다 오면 state 가 남아 있어, 매번 열면 사람이 닫아도 다시 열린다
  const enteredPart = useLocation().state?.part || '';
  const [finding, setFinding] = useState(Boolean(enteredPart));
  const [weight, setWeight] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [record, setRecord] = useState(null);
  const [showTimer, setShowTimer] = useState(false);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchSession(); }, [fetchSession]);

  useEffect(() => {
    client.get('/my-routines')
      .then(({ data }) => setRoutines(Array.isArray(data) ? data : []))
      // **못 불러온 것과 없는 것은 다르다.** 없다고 하면 「루틴을 만드세요」가 뜨는데,
      // 만들어 둔 사람에게 그 말은 틀린 말이다
      .catch(() => setRoutinesFailed(true));
  }, []);

  // ── 지금 할 운동 ──
  //
  // 진행표가 가리키는 칸이 기본이고, 사람이 직접 고르면 그것이 이긴다.
  const current = session && session.current >= 0 ? session.items[session.current] : null;
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
  // 무게로 든 것과 맨몸으로 한 것을 따로 센다. 무게 쪽만 화면에 적는다
  const best = useMemo(() => {
    if (!exercise) return null;
    return bestRecords(workouts).get(`${exercise.trim()}::weighted`) || null;
  }, [workouts, exercise]);

  // 같은 칸은 한 번만 채운다. 안 그러면 사람이 고쳐놓은 값을 다시 덮어쓴다
  const filledFor = useRef(null);
  useEffect(() => {
    if (!exercise) { filledFor.current = null; return; }
    const key = `${session?.startedAt ?? 'free'}#${exercise}#${picked ? 'p' : session?.current}`;
    if (filledFor.current === key) return;
    filledFor.current = key;

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
  }, [exercise, lastRecord, current, session, picked]);

  const todayList = workouts[today] || [];

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
      const payload = { date: today, exercise: name, weight: asWeight(weight), sets: Number(sets), reps: Number(reps) };
      // 최고 기록은 **넣기 전** 것과 견준다. 저장한 뒤에 세면 방금 넣은 것이 이미
      // 목록에 있어서 무엇을 넣어도 경신이 아니게 된다
      const before = bestRecords(workouts);
      const saved = await addWorkout(payload);
      toast(saved?.queued
        ? '신호가 없어 이 기기에 적어뒀어요. 연결되면 저절로 올라가요'
        : '적었어요');
      setRecord(checkRecord(before, payload));

      // 세트를 저장했으니 휴식이 시작된다. 타이머를 안 쓰는 제일 큰 이유는 부정확해서가
      // 아니라 **누르는 걸 잊어서**다 — 저장은 어차피 누른다.
      // 소리는 사람이 누른 이 순간에 준비해야 브라우저가 막지 않는다
      primeAudio();
      const started = useRestTimerStore.getState().autoStartAfterSet(`${name} ${payload.sets}세트`);
      if (started) setShowTimer(true);

      await advance('done', name);
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
              {routines.slice(0, 4).map((r) => (
                <button
                  key={r.id}
                  onClick={() => begin(r.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left',
                    padding: '10px 12px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 13.5, color: 'var(--text-primary)', flexGrow: 1 }}>{r.name}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {(r.exercises || []).length}개
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--accent)' }}>시작</span>
                </button>
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
      <div className="card" style={{ marginBottom: 14, borderColor: exercise ? 'var(--accent)' : 'var(--border)' }}>
        {exercise ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span className="display-sm" style={{ color: 'var(--text-primary)' }}>{exercise}</span>
              {picked && (
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

            {error && (
              <div style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 10 }}>{error}</div>
            )}

            <button className="btn-primary" disabled={saving} onClick={save}>
              {saving ? '적는 중…' : '이 운동 적기'}
            </button>

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

      {/* ── 오늘 적은 것 ── */}
      <div className="section-title">
        <div className="accent-bar" />
        오늘 적은 것
        {todayList.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Barlow', sans-serif", letterSpacing: 0 }}>
            {todayList.length}개
          </span>
        )}
      </div>

      {todayList.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          아직 없어요. 위에서 한 개 적으면 여기 쌓입니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {todayList.map((w) => (
            <div key={w.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
              background: 'var(--card-bg)', border: '1px solid var(--border)',
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
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.8, marginTop: 16 }}>
        고치고 지우는 것은 <button
          onClick={() => navigate('/workout')}
          style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', font: 'inherit' }}
        >기록 화면</button>에서 합니다. 5차를 마치면 그것도 이리로 옵니다.
      </div>
    </div>
  );
}
