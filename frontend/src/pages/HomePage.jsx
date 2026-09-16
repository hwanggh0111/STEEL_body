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
import { buildHeat } from '../data/bodyHeat';
import { buildSummary } from '../data/sessionSummary';
import { showFinish } from '../components/SessionFinish';
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

// **「바로 가기」 격자를 걷었다** (5차 리모델링, 2026-09-04).
//
// 4차에 이미 절반을 걷었다 — 일곱 칸 중 기록 · 인바디 · 루틴은 아래 탭바에 늘 떠
// 있어서 홈에서 또 그릴 이유가 없었다. 그런데 남은 여섯도 같은 문제였다.
// 히스토리는 이제 탭바의 「기록」이고, 측정은 「몸」 안에, 운동 검색은 「운동」 안에
// 있다. 남는 셋(기능성운동 · 운동 알림 · 고객센터)만 두려고 격자 한 판을 그리면,
// **길이 세 벌**이 된다 — 탭바 · 더보기 · 홈 격자.
//
// 홈은 「오늘 무엇을 하면 되는가」 하나만 말한다. 가는 길은 탭바와 서랍이 맡는다.

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

// ── 오늘 할 곳 ── (2026-09-16, 6차)
//
// 「오늘」 탭의 **첫 카드**다. 앞서는 홈이 「오늘 기록이 없어요 · 루틴을 만드세요」
// 까지만 말했다 — **무엇을 할지는 끝내 안 말해줬다.** 부위별 마지막 자극일은 운동
// 기록에 이미 다 들어 있었는데 아무 데서도 안 꺼내 썬다.
//
// 계산은 몸 지도와 **같은 것 하나**(`data/bodyHeat.js`)를 본다 — 두 벌로 두면
// 홈과 지도가 서로 다른 부위를 말하는 날이 온다.
//
// **몸을 작게 같이 그린다.** 글자만 있으면 다른 운동 기록 앱의 안내 문구와 구별이
// 안 된다. 식은 자리를 눈으로 짚어주는 것이 이 앱이 하는 말이다.
function TodayFocus({ workouts, today, onGo }) {
  const heat = useMemo(() => buildHeat(workouts, today), [workouts, today]);
  // 기록이 아예 없으면 안 그린다 — 처음 온 사람에게 빈 몸을 보여줄 자리가 아니다
  if (!heat.any || !heat.coldest) return null;

  const cold = heat.coldest;
  const hot = heat.list.filter((p) => p.level > 0).slice(0, 2);
  // 달아오른 정도 → 칠. 지도와 같은 규칙이다 — 식은 곳은 칠하지 않는다
  const paint = (lv) => (lv >= 3
    ? { fill: '#eeb77d', o: 0.72 }
    : lv === 2 ? { fill: '#d29a5f', o: 0.42 } : { fill: '#d29a5f', o: 0.18 });
  const P = (part) => {
    const lv = heat.byPart[part]?.level || 0;
    return lv > 0 ? paint(lv) : null;
  };

  return (
    <div
      className="card clickable"
      role="button"
      tabIndex={0}
      onClick={onGo}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGo(); } }}
      style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}
    >
      {/* 작은 몸 — 지도와 같은 모양을 줄여 쓴다 */}
      <svg width="58" height="138" viewBox="0 0 120 240" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <g fill="#1c1813" stroke="#2b251c" strokeWidth="0.9">
          <circle cx="60" cy="17" r="11" /><rect x="54" y="27" width="12" height="8" rx="3" />
          <ellipse cx="38" cy="45" rx="11.5" ry="9" /><ellipse cx="82" cy="45" rx="11.5" ry="9" />
          <rect x="44" y="49" width="32" height="24" rx="6" /><rect x="49" y="73" width="22" height="36" rx="5" />
          <ellipse cx="30" cy="70" rx="7.5" ry="15" /><ellipse cx="90" cy="70" rx="7.5" ry="15" />
          <ellipse cx="48" cy="142" rx="12.5" ry="31" /><ellipse cx="72" cy="142" rx="12.5" ry="31" />
          <ellipse cx="46" cy="195" rx="8.5" ry="21" /><ellipse cx="74" cy="195" rx="8.5" ry="21" />
        </g>
        {P('가슴') && <rect x="44" y="49" width="32" height="24" rx="6" fill={P('가슴').fill} fillOpacity={P('가슴').o} />}
        {P('어깨') && (
          <>
            <ellipse cx="38" cy="45" rx="11.5" ry="9" fill={P('어깨').fill} fillOpacity={P('어깨').o} />
            <ellipse cx="82" cy="45" rx="11.5" ry="9" fill={P('어깨').fill} fillOpacity={P('어깨').o} />
          </>
        )}
        {P('팔') && (
          <>
            <ellipse cx="30" cy="70" rx="7.5" ry="15" fill={P('팔').fill} fillOpacity={P('팔').o} />
            <ellipse cx="90" cy="70" rx="7.5" ry="15" fill={P('팔').fill} fillOpacity={P('팔').o} />
          </>
        )}
        {P('코어') && <rect x="49" y="73" width="22" height="36" rx="5" fill={P('코어').fill} fillOpacity={P('코어').o} />}
        {P('하체') && (
          <>
            <ellipse cx="48" cy="142" rx="12.5" ry="31" fill={P('하체').fill} fillOpacity={P('하체').o} />
            <ellipse cx="72" cy="142" rx="12.5" ry="31" fill={P('하체').fill} fillOpacity={P('하체').o} />
          </>
        )}
      </svg>

      <div style={{ minWidth: 0, flexGrow: 1 }}>
        <div className="serif-display" style={{ fontSize: 18, lineHeight: 1.5 }}>
          {cold.days === null ? (
            <><span style={{ color: 'var(--accent)' }}>{cold.part}</span>은(는) 아직<br />한 번도 안 했습니다</>
          ) : cold.level === 0 ? (
            <><span style={{ color: 'var(--accent)' }}>{cold.part}</span>이(가) {cold.days}일째<br />식어 있습니다</>
          ) : (
            <>몸 전체가 아직<br />고루 달아 있습니다</>
          )}
        </div>
        {hot.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            {hot.map((p) => `${p.part} ${p.days === 0 ? '오늘' : `${p.days}일 전`}`).join(' · ')}
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 10 }}>몸 지도 펼치기 ›</div>
      </div>
    </div>
  );
}

// ── 오늘 결산 다시 보기 ── (2026-09-16, 6차)
//
// 결산은 루틴을 마치면 저절로 떴다가 닫으면 **그날 안에 다시 볼 길이 없었다.**
// 길찾기 어디에도 자리가 없었기 때문이다. 오늘 적은 것이 있으면 여기서 다시 열다.
// **루틴을 안 쓴 사람도 볼 수 있다** — 결산은 루틴의 상이 아니라 그날의 상이다.
function FinishAgain({ workouts, today }) {
  const summary = useMemo(() => {
    const list = workouts?.[today] || [];
    if (list.length === 0) return null;
    return buildSummary(workouts, today);
  }, [workouts, today]);
  if (!summary) return null;

  return (
    <button
      onClick={() => showFinish(summary)}
      className="card clickable"
      style={{
        width: '100%', marginBottom: 20, textAlign: 'left', fontFamily: 'inherit',
        borderColor: 'var(--accent)', background: 'var(--accent-dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span className="label" style={{ marginBottom: 0, color: 'var(--accent)' }}>오늘 결산</span>
        <span style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
          {summary.kg > 0 ? `${summary.kg.toLocaleString()}kg · ` : ''}{summary.sets}세트
          {summary.record ? ' · 새 최고기록 1' : ''}
        </span>
      </span>
      <span style={{ fontSize: 12, color: 'var(--accent)', flexShrink: 0 }}>다시 보기 ›</span>
    </button>
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
          {/* **오늘 할 곳이 맨 앞이다.** 「오늘」 탭의 질문은 「오늘 뭐 하지」이고,
              그 답은 하던 루틴보다도 먼저 와야 한다 — 루틴이 없는 사람에게도 답이 있어야 한다 */}
          <SectionTitle id="home-focus">오늘 할 곳</SectionTitle>
          <TodayFocus workouts={workouts} today={today} onGo={() => navigate('/map')} />

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

          {/* 방금 끝난 운동의 결산. 닫았어도 그날 안에는 여기서 다시 본다 */}
          <FinishAgain workouts={workouts} today={today} />

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

          {/* ── 홈페이지로 ── (2026-09-16 에 다시 썼다)
              **새 화면으로 연다.** 앱 안에 탭으로 끼워 넣었다가 걷었다 — 운동을 적다가
              읽을 것을 보러 갔다 오면 **적던 자리가 그대로 있어야** 한다.
              `rel` 은 새 창이 이 화면을 건드리지 못하게 막는다 */}
          <a
            href="/site"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 11,
              marginTop: 18, padding: '15px 16px', textDecoration: 'none',
              background: 'var(--card-bg)', border: '1px solid var(--border)',
              boxShadow: 'var(--card-edge)', borderRadius: 'var(--radius)',
            }}
          >
            <NavIcon name="body" size={20} />
            <span style={{ flexGrow: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, color: 'var(--text-primary)' }}>블랙아이언 소개</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                이 앱이 무엇을 하는지 · 새 화면으로 열려요
              </span>
            </span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
          </a>

        </>
      )}
    </div>
  );
}
