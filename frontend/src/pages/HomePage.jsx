import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useWorkoutStore } from '../store/workoutStore';
import { useInbodyStore } from '../store/inbodyStore';
import { useRoutineSessionStore } from '../store/routineSessionStore';
import { toast } from '../components/Toast';
import { LogoMark, LogoWord } from '../components/Logo';
import WeeklyReport from '../components/WeeklyReport';
import HomeSearch from '../components/home/HomeSearch';
import TodayCard from '../components/home/TodayCard';
import { dateKey } from '../data/dateKey';
import { useToday } from '../data/useToday';
import { daysBetween } from '../data/personalRecord';
import { mondayOf, weekKeys } from '../data/weeklyReport';
import NavIcon from '../components/NavIcon';

// 홈.
//
// 매일 여는 화면인데 **오늘 뭘 할지는 아무 데도 없었다.** 위에서부터 로고 · 검색 ·
// 오늘의 요약 · 통계 셋 · 주간 달력 · 주간 요약 · 빠른 이동 여러 덩어리가
// 순서 없이 쌓여 있었다. 다시 짜면서 세 가지를 바꿨다.
//
// **1. 하던 것을 안다.** 루틴을 시작해두고 홈에 오면 진행표가 기록 화면에만 있어서
// 홈은 「아직 오늘 운동 기록이 없어요」라고 했다. 시작해둔 사람에게 시작하라고 하고
// 있었다. 이제 홈도 `/routine-session` 을 보고 「이어서 하기」를 맨 위에 준다.
//
// **2. 같은 주를 세 번 그리지 않는다.** 통계의 「이번 주 n/7」, 주간 달력,
// 주간 요약의 「운동한 날」이 전부 같은 수였다. WeeklyReport 에는 「같은 주를 두 번
// 안 그린다」고 주석까지 적혀 있는데 그 위의 통계 상자가 세 번째였다. 상자를 걷어냈다.
//
// **3. 아래 탭바를 다시 그리지 않는다.** 「빠른 이동」 일곱 칸 중 기록 · 인바디 ·
// 루틴은 아래 탭바에 늘 떠 있다 — 한 번에 닿는 것을 홈에서 또 그릴 이유가 없다.
// 두 번 눌러야 하는 더보기 안의 것만 남겼다 (빠져 있던 운동 알림을 넣었다).

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

// 아래 탭바(홈 · 기록 · 인바디 · 루틴)에 없는 것들. 더보기를 열어야 닿는 자리다
// 아이콘은 길찾기와 같은 것을 쓴다 (NavIcon.jsx). 같은 자리로 가는 길인데 홈에서만
// 다른 그림이면 두 번 익혀야 한다
const SHORTCUTS = [
  { icon: 'homegym', label: '기능성운동', path: '/homeworkout' },
  { icon: 'search', label: '운동 검색', path: '/search' },
  { icon: 'ruler', label: '측정', path: '/measure' },
  { icon: 'calendar', label: '히스토리', path: '/history' },
  { icon: 'bell', label: '운동 알림', path: '/reminders' },
  { icon: 'chat', label: '고객센터', path: '/support' },
];

// 이 날짜 이후로 인바디를 안 적었으면 한 번 짚어준다
const INBODY_STALE_DAYS = 14;

function SectionTitle({ id, children }) {
  return (
    <div className="section-title" id={id} style={{ scrollMarginTop: 16 }}>
      <div className="accent-bar" />
      {children}
    </div>
  );
}

// 최근 체중 한 줄.
//
// 예전에는 36px 통계 상자에 「최근 체중」 하나가 들어 있었고, 기록이 없으면 `-` 를
// 크게 띄웠다. 없는 것을 크게 띄우는 자리는 없앤다 — 기록이 없으면 안 그린다.
function BodyLine({ records, onGo }) {
  if (!records || records.length === 0) return null;
  const latest = records[0];
  const prev = records[1];
  const gap = daysBetween(latest.date, dateKey());
  const delta = prev != null && latest.weight != null && prev.weight != null
    ? Number((latest.weight - prev.weight).toFixed(1))
    : null;
  const stale = gap !== null && gap >= INBODY_STALE_DAYS;

  return (
    // 눌리는 카드는 단추처럼 다뤄야 한다 — 안 그러면 자판만 쓰는 사람은 닿을 수가 없다
    <div
      className="card clickable"
      role="button"
      tabIndex={0}
      onClick={() => onGo(stale)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGo(stale); } }}
      style={{
      marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
        <span className="label" style={{ marginBottom: 0 }}>최근 체중</span>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1.5, color: 'var(--accent)' }}>
          {latest.weight}kg
        </span>
        {delta !== null && delta !== 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            지난 기록보다 {delta > 0 ? '+' : ''}{delta}kg
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: stale ? 'var(--warning)' : 'var(--text-muted)', flexShrink: 0, textAlign: 'right' }}>
        {gap === 0 ? '오늘' : gap !== null ? `${gap}일 전` : ''}
        {stale && <><br />기록하러 가기 ›</>}
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { workouts, loading: wLoading, fetchAll: fetchWorkouts } = useWorkoutStore();
  const { records, loading: iLoading, fetchAll: fetchInbody } = useInbodyStore();
  const session = useRoutineSessionStore(s => s.session);
  const fetchSession = useRoutineSessionStore(s => s.fetch);
  const startSession = useRoutineSessionStore(s => s.start);

  const [myRoutines, setMyRoutines] = useState([]);
  // 달력에서 오늘 하기로 담아둔 것. 없으면 카드가 아예 안 갈라진다
  const [plans, setPlans] = useState([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetchWorkouts();
    fetchInbody();
    fetchSession();
    // 홈에서 루틴을 곧바로 시작하려면 목록이 있어야 한다.
    // 못 받아와도 조용히 넘어간다 — 홈이 토스트로 시끄러워질 자리가 아니다
    client.get('/my-routines')
      .then(({ data }) => setMyRoutines(Array.isArray(data) ? data : []))
      .catch(() => {});
    // 달력에서 미리 정해둔 것. 못 받아와도 조용히 넘어간다 —
    // 계획이 없는 사람에게는 원래 안 보이는 자리다
    client.get('/plans')
      .then(({ data }) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // 켜둔 채 날이 바뀌어도 오늘을 가리킨다 (useToday 주석 참고)
  const today = useToday();
  const todayWorkouts = workouts[today] || [];
  // 오늘 담아둔 것만. 지난 것과 앞날 것은 달력이 맡는다
  const todayPlans = useMemo(() => plans.filter(p => p.date === today), [plans, today]);
  // 매 렌더 새 배열을 만들면 아래 useMemo 의 deps 가 늘 달라져 memo 가 무의미해진다.
  // deps 를 비워두면 마운트할 때의 주를 붙들고 있어 일요일 밤을 못 넘긴다 —
  // `today` 를 본다 (하루 안에서는 같은 값이라 memo 는 그대로 유지된다)
  const weekDates = useMemo(() => weekKeys(mondayOf()), [today]);
  const weekDone = useMemo(() => weekDates.filter(d => workouts[d]?.length > 0).length, [weekDates, workouts]);
  const totalWorkouts = useMemo(() => Object.values(workouts).flat().length, [workouts]);

  const loading = wLoading || iLoading;

  // 하던 것이 있으면 TodayCard 가 「이어서 하기」로 갈라지므로 여기까지 오지 않는다.
  // 그래서 「하던 걸 바꿀까요」를 물을 일이 없다 (루틴 화면은 물어야 한다)
  const startRoutine = async (routine) => {
    if (starting) return;
    setStarting(true);
    try {
      await startSession(routine.id ?? routine._id);
      navigate('/workout');
    } catch (err) {
      toast(err.response?.data?.error || '루틴을 시작하지 못했어요', 'error');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
      {/* 머리 — 앱 이름은 매일 오는 사람이 이미 안다. 한 줄로 줄이고 자리를 내준다 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <LogoMark size={34} />
        <div style={{ minWidth: 0 }}>
          <LogoWord cap={20} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>
      </div>

      <HomeSearch />

      {loading ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)' }}>
          <div style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 13 }}>기록을 불러오는 중…</span>
        </div>
      ) : (
        <>
          <SectionTitle id="home-today">오늘</SectionTitle>
          <TodayCard
            todayPlans={todayPlans}
            session={session}
            todayWorkouts={todayWorkouts}
            myRoutines={myRoutines}
            onStartRoutine={startRoutine}
            starting={starting}
          />

          {/* 오래 안 적었으면 인바디에 가서 폼까지 열어준다 —
              「기록하러 가기」를 눌렀는데 또 단추를 찾게 두지 않는다 */}
          <BodyLine
            records={records}
            onGo={(stale) => navigate('/inbody', stale ? { state: { write: true } } : undefined)}
          />

          <SectionTitle id="home-week">이번 주 운동</SectionTitle>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
              {weekDates.map((d, i) => {
                const done = workouts[d]?.length > 0;
                const isToday = d === today;
                const future = d > today;
                return (
                  <div
                    key={d}
                    onClick={() => { if (done) navigate('/history', { state: { date: d } }); }}
                    style={{ padding: '6px 0', cursor: done ? 'pointer' : 'default' }}
                    title={done ? `${d} 기록 보기` : undefined}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{DAYS[i]}</div>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', margin: '0 auto',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: isToday ? 700 : 400,
                      background: done ? 'var(--accent)' : isToday ? 'var(--bg-tertiary)' : 'none',
                      color: done ? 'var(--on-accent)' : isToday ? 'var(--accent)' : future ? 'var(--border-hover)' : 'var(--text-muted)',
                      border: isToday && !done ? '1px solid var(--accent)' : 'none',
                    }}>
                      {d.slice(8)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
              이번 주 {weekDone}일 · 지금까지 통틀어 {totalWorkouts}회 기록
            </div>
          </div>

          <WeeklyReport workouts={workouts} />

          <SectionTitle>바로 가기</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {SHORTCUTS.map(s => (
              <div
                key={s.path}
                className="card clickable"
                onClick={() => navigate(s.path)}
                style={{ textAlign: 'center', padding: '14px 6px' }}
              >
                <div style={{ marginBottom: 4, color: 'var(--accent)', display: 'flex', justifyContent: 'center' }} aria-hidden="true">
                  <NavIcon name={s.icon} size={22} />
                </div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, letterSpacing: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
