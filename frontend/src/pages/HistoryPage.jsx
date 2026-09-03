import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import { eul } from '../data/particle';
import { useInbodyStore } from '../store/inbodyStore';
import StatBox from '../components/StatBox';
import WeightChart from '../components/WeightChart';
import WorkoutCard from '../components/WorkoutCard';
import MonthCalendar from '../components/MonthCalendar';
import DaySheet from '../components/DaySheet';
import client from '../api/client';
import { plansByDate, upcoming, missedCount, dayLabel, untilLabel } from '../data/plans';
import { toast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmModal';
import { readLS } from '../data/safeStorage';
import { shiftMonth, monthSummary, monthsWithRecords } from '../data/monthGrid';
import { useToday } from '../data/useToday';

// 히스토리.
//
// 이름도 「히스토리」고 앱 소개에도 **「달력으로 되짚는다 — 빠진 날이 눈에 보여야
// 안 빠진다」**고 적어뒀는데, 정작 화면은 날짜별 목록이었다.
// **빠진 날은 아예 안 그려지니 눈에 보일 수가 없었다.**
//
// 달력을 앞에 세웠다. 날짜를 누르면 그날 것만 보고, 안 누르면 그 달 전체를 본다.
// 거르기와 CSV 내보내기는 그대로 뒀다 — 되던 것을 없애지 않는다.
//
// **앞으로 할 것도 여기서 정한다** (2026-09-02). 달력은 되짚는 자리이면서
// 「이번 주에 언제 갈까」를 **정하는 자리**이기도 한데, 앞날을 눌러도
// 「이 날은 쉬셨네요」만 나왔다 — 아직 오지도 않은 날인데.
// 계획은 기록과 **따로** 저장한다(`/api/plans`). 섞으면 「이 달에 몇 일 나왔나」에
// 아직 하지도 않은 날이 같이 세어진다.
export default function HistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { workouts, loading: wLoading, fetchAll: fetchWorkouts, deleteWorkout } = useWorkoutStore();
  const { records, loading: iLoading, fetchAll: fetchInbody } = useInbodyStore();

  useEffect(() => {
    fetchWorkouts();
    fetchInbody();
  }, []);

  // 켜둔 채 자정을 넘기면 「오늘」이 어제에 멈춘다 — 앞날인지 지난 날인지가 뒤집힌다
  const today = useToday();

  const [filterExercise, setFilterExercise] = useState('');

  // ── 앞으로 할 것 ──
  const [plans, setPlans] = useState([]);
  const [myRoutines, setMyRoutines] = useState([]);
  const [addingPlan, setAddingPlan] = useState(false);

  useEffect(() => {
    // 못 불러와도 화면은 그대로 돈다 — 계획은 이 화면의 곁다리다
    client.get('/plans').then(({ data }) => setPlans(Array.isArray(data) ? data : [])).catch(() => {});
    client.get('/my-routines').then(({ data }) => setMyRoutines(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  // ── 그날 메모 ──
  //
  // **보고 있는 달만 한 번에 받는다.** 칸마다 물어보면 서른 번이고, 통째로 받으면
  // 몇 년치를 들고 온다. 달을 넘길 때마다 그 달치를 받는다 (`?month=YYYY-MM`).
  const [dayNotes, setDayNotes] = useState({});
  const [savingNote, setSavingNote] = useState(false);

  const saveDayNote = async (date, body, done) => {
    if (savingNote) return;
    setSavingNote(true);
    try {
      const { data } = await client.post('/notes', { body, date });
      setDayNotes(prev => ({ ...prev, [date]: data }));
      done?.();   // **성공했을 때만 닫는다** — 실패하고 닫히면 적던 것이 사라진다
      toast('메모를 저장했어요');
    } catch (err) {
      toast(err.response?.data?.error || '저장하지 못했어요', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const removeDayNote = async (note) => {
    const ok = await confirmDialog(`${dayLabel(note.date)} 메모를 지울까요?`,
      { title: '메모 지우기', confirmText: '지웁니다', danger: true });
    if (!ok) return;
    try {
      await client.delete(`/notes/${note.id}`);
      setDayNotes(prev => {
        const next = { ...prev };
        delete next[note.date];
        return next;
      });
      toast('지웠어요');
    } catch (err) {
      // 없어서 못 지운 것은 실패가 아니다 (두 번 눌렀거나 다른 기기에서 이미 지웠다)
      if (err.response?.status === 404) {
        setDayNotes(prev => { const next = { ...prev }; delete next[note.date]; return next; });
        return;
      }
      toast('지우지 못했어요. 다시 열면 그대로 있어요', 'error');
    }
  };

  const addPlan = async (plan) => {
    if (addingPlan) return;
    setAddingPlan(true);
    try {
      const { data } = await client.post('/plans', plan);
      setPlans(prev => [...prev, data]);
      toast(`${dayLabel(plan.date)}에 담았어요`);
    } catch (err) {
      toast(err.response?.data?.error || '담지 못했어요', 'error');
    } finally {
      setAddingPlan(false);
    }
  };

  // 먼저 화면에서 빼고 서버에 알린다. 실패하면 되돌린다 —
  // 지운 줄 알았는데 새로고침하면 살아 있는 것이 제일 나쁘다
  const removePlan = async (id) => {
    const prev = plans;
    setPlans(prev.filter(p => p.id !== id));
    try {
      await client.delete(`/plans/${id}`);
    } catch (err) {
      // **없어서 못 지운 것은 실패가 아니다.** 두 번 눌렀거나 다른 기기에서 이미
      // 뺐으면 404 가 온다 — 그때 「빼지 못했어요」를 띄우고 목록을 되돌리면
      // 방금 뺀 것이 눈앞에서 되살아난다
      if (err.response?.status === 404) return;
      setPlans(prev);
      toast('빼지 못했어요', 'error');
    }
  };

  const handleExportCSV = (type = 'workouts') => {
    const filename = type === 'inbody' ? 'blackiron_inbody.csv' : 'blackiron_workouts.csv';
    const baseURL = import.meta.env.VITE_API_URL || '/api';
    const token = readLS('token');
    fetch(`${baseURL}/export/${type}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('Export failed');
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        // 문서에 붙이지 않은 링크는 클릭해도 아무 일이 안 일어나는 브라우저가 있다.
        // 그리고 곧바로 revoke 하면 내려받기가 시작되기 전에 주소가 사라져 빈 파일이 된다
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast(`${type === 'inbody' ? '인바디' : '운동'} CSV 내보내기 완료!`);
      })
      .catch(() => toast('내보내기에 실패했어요', 'error'));
  };

  const allExercises = useMemo(() => [...new Set(Object.values(workouts).flat().map(w => w.exercise).filter(Boolean))].sort(), [workouts]);

  const dates = useMemo(() => workouts ? Object.keys(workouts).sort().reverse() : [], [workouts]);

  // 보고 있는 달. 처음에는 이번 달을 연다.
  //
  // 홈의 주간 달력에서 날짜를 눌러 오면 그 날을 들고 온다 (`state.date`).
  // 데려다 놓고 이번 달 전체를 펴주면 무엇을 눌렀는지가 사라진다
  const incoming = location.state?.date || null;
  const now = incoming ? new Date(`${incoming}T00:00:00`) : new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });

  // **`ym` 보다 아래에 둔다.** 이 효과는 보고 있는 달을 읽는데, `const` 는 선언 줄에
  // 닿기 전에는 못 읽는다(TDZ) — 위에 두면 화면을 여는 순간 터진다.
  // 9/2 에 이 화면을 흰 화면으로 만든 자리가 정확히 이것이고, `npm run screens` 가
  // 오늘 또 잡아줬다
  useEffect(() => {
    const month = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
    let dropped = false;
    client.get('/notes', { params: { month } })
      .then(({ data }) => {
        if (dropped) return;   // 달을 빨리 넘기면 늦게 온 답이 새 달을 덮는다
        const map = {};
        for (const n of Array.isArray(data) ? data : []) if (n && n.date) map[n.date] = n;
        setDayNotes(map);
      })
      // 못 불러와도 화면은 그대로 돈다. 메모는 이 화면의 곁다리다
      .catch(() => {});
    return () => { dropped = true; };
  }, [ym.year, ym.month]);
  const [selectedDate, setSelectedDate] = useState(incoming);

  // ── 계획을 화면 값으로 빚는 자리 ──
  //
  // **`ym` 아래에 둔다.** 위에 뒀다가 흰 화면을 봤다 — `missed` 가 `ym` 을 읽는데
  // `const` 는 선언 줄에 닿기 전에는 못 읽는다(TDZ). 빌드는 통과한다. 화면을 열어야
  // 터지고, 터지면 에러 경계가 「새로고침해 주세요」를 띄운다.
  // **읽는 값보다 뒤에 두는 것이 규칙이다.**
  // 달력이 칸마다 꺼내 쓴다
  const planMap = useMemo(() => plansByDate(plans), [plans]);
  // 아직 안 한 것 중 가까운 것 셋. 날짜를 안 고른 동안 한 줄로 알려준다
  const next = useMemo(() => upcoming(plans, today, workouts, 3), [plans, today, workouts]);
  // 보고 있는 달에서 하기로 해놓고 못 한 것
  const missed = useMemo(() => {
    const prefix = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
    return missedCount(plans.filter(p => p.date.startsWith(prefix)), today, workouts);
  }, [plans, today, workouts, ym]);

  useEffect(() => {
    const date = location.state?.date;
    if (!date) return;
    const d = new Date(`${date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    setYm({ year: d.getFullYear(), month: d.getMonth() + 1 });
    setSelectedDate(date);
  }, [location.state?.date]);

  const summary = useMemo(() => monthSummary(workouts, ym.year, ym.month), [workouts, ym]);
  // 기록이 있는 달만 안다. 텅 빈 달을 화살표로 계속 넘기지 않게 「기록이 있는 달로」를 준다
  const monthsWith = useMemo(() => monthsWithRecords(workouts), [workouts]);
  const thisYm = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
  const nearestWith = monthsWith.find(m => m < thisYm) || monthsWith[0] || null;

  const goMonth = (by) => {
    setYm(prev => shiftMonth(prev.year, prev.month, by));
    setSelectedDate(null);
  };

  // 걸러낸 결과를 미리 세운다.
  // 예전에는 날짜를 돌면서 빈 날을 null 로 건너뛰기만 했다. 그래서 고른 운동이
  // 한 번도 없으면 목록 자리가 통째로 비어서 화면이 죽은 것처럼 보였다
  // 고른 날이 있으면 그 하루만, 없으면 보고 있는 달 전체.
  // 예전에는 언제나 전 기간을 쏟아냈다 — 기록이 쌓일수록 아래로 끝없이 늘어졌다
  const shownDates = useMemo(() => {
    const prefix = `${ym.year}-${String(ym.month).padStart(2, '0')}-`;
    const pool = selectedDate ? [selectedDate] : dates.filter(d => d.startsWith(prefix));
    return pool
      .map(date => [date, filterExercise
        ? (workouts[date] || []).filter(w => w.exercise === filterExercise)
        : (workouts[date] || [])])
      .filter(([, list]) => list.length > 0);
  }, [dates, workouts, filterExercise, ym, selectedDate]);
  const totalDays = dates.length;
  const totalWorkouts = useMemo(() => workouts ? Object.values(workouts).flat().length : 0, [workouts]);

  // 카드가 memo 라, 이 함수가 매 렌더 새로 만들어지면 memo 가 아무 일도 못 한다
  const handleDelete = useCallback(async (id) => {
    try {
      await deleteWorkout(id);
      toast('삭제 완료!');
    } catch {
      toast('삭제하지 못했어요', 'error');
    }
  }, [deleteWorkout]);

  const loading = wLoading || iLoading;

  return (
    <div>
      {/* ── 달력 ── */}
      <div className="section-title">
        <div className="accent-bar" />
        운동 달력
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button className="btn-secondary" onClick={() => goMonth(-1)} aria-label="지난 달">‹</button>
        <div style={{
          flexGrow: 1, textAlign: 'center',
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2,
          color: 'var(--text-primary)',
        }}>{ym.year}년 {ym.month}월</div>
        <button className="btn-secondary" onClick={() => goMonth(1)} aria-label="다음 달">›</button>
      </div>

      <MonthCalendar
        year={ym.year}
        month={ym.month}
        workouts={workouts}
        plans={planMap}
        notes={dayNotes}
        selected={selectedDate}
        onSelect={setSelectedDate}
        onSaveNote={(body, done) => saveDayNote(selectedDate, body, done)}
        onDeleteNote={removeDayNote}
        savingNote={savingNote}
      />

      {/* 날짜를 고르면 그날 할 것을 정한다. 안 골랐으면 **다가오는 것 한 줄**만 —
          달력 아래를 늘 폼으로 채워두면 되짚으러 온 사람의 길을 막는다 */}
      {/* 메모는 **달력 안에서** 적는다(그 주 아래). 여기는 한 것 · 할 것이다.
          안 골랐으면 「다음에 할 것」 한 줄만. 달력 아래를 늘 폼으로 채워두면
          되짚으러 온 사람의 길을 막는다 */}
      {selectedDate ? (
        <DaySheet
          date={selectedDate}
          today={today}
          plans={planMap[selectedDate] || []}
          dayWorkouts={workouts[selectedDate]}
          myRoutines={myRoutines}
          onAddPlan={addPlan}
          onDeletePlan={removePlan}
          addingPlan={addingPlan}
          onSeeRecords={() => document.getElementById('history-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
      ) : next.length > 0 ? (
        <div className="card" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ minWidth: 0, flexGrow: 1 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: 1 }}>다음에 할 것</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-primary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {next[0].name}
              <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
                {' · '}{untilLabel(next[0].date, today)}
                {next.length > 1 ? ` · 외 ${next.length - 1}개` : ''}
              </span>
            </div>
          </div>
          <button
            className="btn-secondary"
            style={{ width: 'auto', flexShrink: 0, padding: '7px 14px', fontSize: 12.5 }}
            onClick={() => { setYm({ year: Number(next[0].date.slice(0, 4)), month: Number(next[0].date.slice(5, 7)) }); setSelectedDate(next[0].date); }}
          >보기</button>
        </div>
      ) : null}

      {/* 그 달 요약 — 아무것도 없으면 기록이 있는 달로 데려다준다 */}
      {summary.days > 0 ? (
        <div className="card" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
            이 달에 <span style={{ color: 'var(--accent)' }}>{summary.days}일</span> 나오셨어요
            <span style={{ color: 'var(--text-muted)' }}> · {summary.count}건 · {summary.sets}세트</span>
          </div>
          {summary.volumeKg > 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              총 볼륨 {summary.volumeKg >= 1000 ? `${(summary.volumeKg / 1000).toFixed(1)}톤` : `${summary.volumeKg}kg`}
              {summary.bodyweightSets > 0 && (
                <span style={{ color: 'var(--text-muted)' }}> · 맨몸 {summary.bodyweightSets}세트는 빠짐</span>
              )}
            </div>
          )}
          {summary.parts.length > 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {summary.parts.slice(0, 4).map(p => `${p.part} ${Math.round(p.ratio * 100)}%`).join(' · ')}
            </div>
          )}
          {/* 하기로 해놓고 못 한 날. **혼내지 않는다** — 몇 건인지만 적는다.
              0 이면 이 줄 자체가 안 나온다 (「못 한 것 0건」은 알릴 이유가 없다) */}
          {missed > 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              하기로 했는데 못 한 날 {missed}건
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flexGrow: 1, fontSize: 13, color: 'var(--text-muted)' }}>
            이 달에는 기록이 없어요.
          </div>
          {nearestWith && (
            <button
              className="btn-secondary"
              style={{ flexShrink: 0 }}
              onClick={() => {
                const [y, m] = nearestWith.split('-').map(Number);
                setYm({ year: y, month: m });
                setSelectedDate(null);
              }}
            >{nearestWith.replace('-', '년 ')}월로</button>
          )}
        </div>
      )}

      {/* 그날 한 장의 「아래에서 보기」가 여기로 데려온다 */}
      <div className="section-title" id="history-list" style={{ marginTop: 24, scrollMarginTop: 70 }}>
        <div className="accent-bar" />
        {selectedDate ? `${selectedDate.slice(5).replace('-', '월 ')}일 기록` : `${ym.month}월 기록`}
        {selectedDate && (
          <button
            className="btn-secondary"
            style={{ marginLeft: 'auto', padding: '4px 10px' }}
            onClick={() => setSelectedDate(null)}
          >이 달 전체</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <select className="input" value={filterExercise} onChange={e => setFilterExercise(e.target.value)}
          style={{ flex: 1, fontSize: 13 }}>
          <option value="">전체 운동</option>
          {allExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </select>
        {filterExercise && (
          <button onClick={() => setFilterExercise('')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        )}
        <button
          onClick={() => handleExportCSV('workouts')}
          className="btn-secondary"
          style={{ fontSize: 12, padding: '8px 14px', whiteSpace: 'nowrap' }}
        >
          운동 CSV
        </button>
        <button
          onClick={() => handleExportCSV('inbody')}
          className="btn-secondary"
          style={{ fontSize: 12, padding: '8px 14px', whiteSpace: 'nowrap' }}
        >
          인바디 CSV
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          로딩 중...
        </div>
      ) : dates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">기록 없음</div>
          <div className="empty-state-desc">아직 운동 기록이 없어요</div>
          <button className="btn-primary" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate('/workout')}>+ 첫 운동 기록하기</button>
        </div>
      ) : shownDates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">기록 없음</div>
          <div className="empty-state-desc">
            {filterExercise
              ? `여기서는 ${eul(`'${filterExercise}'`)} 한 기록이 없어요`
              : selectedDate ? '이 날은 쉬셨네요' : '이 달에는 기록이 없어요'}
          </div>
          {filterExercise && (
            <button className="btn-secondary" style={{ marginTop: 12, fontSize: 13 }} onClick={() => setFilterExercise('')}>거르기 풀기</button>
          )}
        </div>
      ) : (
        shownDates.map(([date, filtered]) => {
          return (
            <div key={date} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 6, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1.5 }}>
                {date}
              </div>
              {filtered.map((w) => (
                <WorkoutCard key={w.id} workout={w} onDelete={handleDelete} />
              ))}
            </div>
          );
        })
      )}

      {/* 통계와 체중 변화는 되짚는 재료지 본론이 아니다. 달력 아래로 내렸다 */}
      <div style={{ height: 8 }} />
      <div className="section-title">
        <div className="accent-bar" />
        통계
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
        <StatBox number={totalDays} label="운동일" />
        <StatBox number={totalWorkouts} label="총 운동" />
        <StatBox number={records.length} label="인바디" />
      </div>

      <div className="section-title">
        <div className="accent-bar" />
        체중 변화
      </div>
      <div className="card" style={{ marginBottom: 24, padding: 12 }}>
        <WeightChart records={records} />
      </div>

    </div>
  );
}
