import { useMemo, useState } from 'react';
import { useLangStore } from '../store/langStore';
import { dateKey } from '../data/dateKey';

// 미션.
//
// 8/25 에 게임 층을 걷어내면서 「남은 것은 주간 미션 하나다」라고 적어뒀던 자리다.
// 열두 줄을 홈에 통째로 펼치고 있었고, 읽어보니 문제가 둘이었다.
//
// **1. 열두 개 중 서로 다른 것을 세는 것은 여섯뿐이다.**
//    일일의 「운동 1회」와 「3회」는 같은 수(오늘 기록 수)를 보고,
//    주간의 「3일」과 「5일」도 같은 수를 본다. 도전의 50 · 100 · 300회도 마찬가지다.
//    그래서 「3일」을 채우는 순간 「5일」이 이미 60% 차 있는 채로 옆에 서 있었다 —
//    **채웠는데 안 채운 것이 같이 보이는** 이상한 화면이다.
//
// **2. 도전 미션은 홈에 매일 있을 이유가 없다.** 300회는 몇 년짜리다.
//
// 그래서 갈래마다 **다음에 닿을 것 하나**만 내놓는다. 문턱이 여러 개인 미션은
// 자연히 하나만 보인다 — 3일을 채우면 그다음은 5일 하나다.
// 다 보고 싶으면 갈래를 눌러 편다. 열두 줄 → 세 줄이 됐다.

const T = {
  ko: {
    daily: '오늘',
    weekly: '이번 주',
    challenge: '길게 보는 것',
    allDone: '다 했어요',
    left: '남음',
    open: '전부 보기',
    close: '접기',
  },
  en: {
    daily: 'Today',
    weekly: 'This week',
    challenge: 'Long haul',
    allDone: 'All done',
    left: 'to go',
    open: 'Show all',
    close: 'Hide',
  },
};

function getDailyMissions(lang, todayWorkouts) {
  const workoutCount = todayWorkouts.length;
  const totalSets = todayWorkouts.reduce((sum, w) => sum + (w.sets || 0), 0);
  // 예전 이름은 `parts` 였는데 세는 것은 부위가 아니라 **운동 이름**이다.
  // 이름이 거짓이면 다음에 여는 사람이 부위별 미션인 줄 안다
  const kinds = new Set(todayWorkouts.map(w => w.exercise));

  return [
    { id: 'd1', title: lang === 'ko' ? '오늘 운동 1회 기록' : 'Log 1 workout today', icon: '💪', current: workoutCount, goal: 1 },
    { id: 'd2', title: lang === 'ko' ? '오늘 운동 3회 기록' : 'Log 3 workouts today', icon: '🔥', current: workoutCount, goal: 3 },
    { id: 'd3', title: lang === 'ko' ? '총 10세트 이상' : 'Complete 10+ sets', icon: '🏋️', current: totalSets, goal: 10 },
    { id: 'd4', title: lang === 'ko' ? '2가지 이상 운동' : '2+ different exercises', icon: '🎯', current: kinds.size, goal: 2 },
  ];
}

function getWeeklyMissions(lang, workouts, records, weekDates) {
  const weekWorkoutDays = weekDates.filter(d => workouts[d] && workouts[d].length > 0).length;
  const weekTotalWorkouts = weekDates.reduce((sum, d) => sum + (workouts[d] ? workouts[d].length : 0), 0);
  const thisWeekInbody = records.filter(r => weekDates.includes(r.date)).length;

  return [
    { id: 'w1', title: lang === 'ko' ? '이번 주 3일 운동' : 'Work out 3 days this week', icon: '📅', current: weekWorkoutDays, goal: 3 },
    { id: 'w2', title: lang === 'ko' ? '이번 주 5일 운동' : 'Work out 5 days this week', icon: '⭐', current: weekWorkoutDays, goal: 5 },
    { id: 'w3', title: lang === 'ko' ? '이번 주 운동 15회 기록' : '15 workouts this week', icon: '🏆', current: weekTotalWorkouts, goal: 15 },
    { id: 'w4', title: lang === 'ko' ? '이번 주 인바디 측정' : 'Measure InBody this week', icon: '📊', current: thisWeekInbody, goal: 1 },
  ];
}

function getChallengeMissions(lang, totalWorkouts, totalInbody) {
  return [
    { id: 'c1', title: lang === 'ko' ? '총 운동 50회 달성' : 'Reach 50 total workouts', icon: '🎖️', current: totalWorkouts, goal: 50 },
    { id: 'c2', title: lang === 'ko' ? '총 운동 100회 달성' : 'Reach 100 total workouts', icon: '💎', current: totalWorkouts, goal: 100 },
    { id: 'c3', title: lang === 'ko' ? '총 운동 300회 달성' : 'Reach 300 total workouts', icon: '👑', current: totalWorkouts, goal: 300 },
    { id: 'c4', title: lang === 'ko' ? '인바디 5회 측정' : 'Measure InBody 5 times', icon: '📈', current: totalInbody, goal: 5 },
  ];
}

const withDone = (list) => list.map(m => ({ ...m, done: m.current >= m.goal }));

/** 다음에 닿을 것 하나. 아직 안 한 것 중 **가장 가까운** 것을 고른다. */
function nextOf(list) {
  const todo = list.filter(m => !m.done);
  if (todo.length === 0) return null;
  return todo.reduce((best, m) => {
    const left = m.goal - m.current;
    const bestLeft = best.goal - best.current;
    return left < bestLeft ? m : best;
  });
}

function MissionItem({ mission, t, dim }) {
  const pct = Math.min((mission.current / mission.goal) * 100, 100);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 0',
      opacity: dim && mission.done ? 0.45 : 1,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 17,
        background: mission.done ? 'var(--success-dim)' : 'var(--bg-tertiary)',
        border: `1px solid ${mission.done ? 'var(--success)' : 'var(--border)'}`,
        flexShrink: 0,
      }} aria-hidden="true">
        {mission.done ? '✓' : mission.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500,
          color: mission.done ? 'var(--success)' : 'var(--text-primary)',
          textDecoration: mission.done ? 'line-through' : 'none',
          marginBottom: 5,
        }}>
          {mission.title}
        </div>
        <div className="progress-bg" style={{ height: 5 }}>
          <div style={{
            height: 5, borderRadius: 'var(--radius)',
            width: `${pct}%`,
            background: mission.done ? 'var(--success)' : 'var(--accent)',
            transition: 'width 0.4s ease',
          }} />
        </div>
        {/* 예전에는 이 줄이 9px 이었다. 앱의 다른 곳은 11px 아래로 안 내려간다.
            그리고 여기에 「+N EXP」가 있었다 — 레벨을 없앤 뒤로는 줄 것이 없는데
            계속 약속하고 있었다 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {mission.current}/{mission.goal}
          </span>
          <span style={{ fontSize: 11, color: mission.done ? 'var(--success)' : 'var(--text-muted)' }}>
            {mission.done ? '완료' : `${Math.max(0, mission.goal - mission.current)} ${t.left}`}
          </span>
        </div>
      </div>
    </div>
  );
}

function Group({ title, color, list, t }) {
  const [open, setOpen] = useState(false);
  const done = list.filter(m => m.done).length;
  const next = nextOf(list);
  const allDone = done === list.length;

  return (
    <div style={{ paddingTop: 10 }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}
      >
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5, color,
        }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius)',
            background: allDone ? 'var(--success-dim)' : 'var(--bg-tertiary)',
            color: allDone ? 'var(--success)' : 'var(--text-muted)',
            fontWeight: 600,
          }}>{done}/{list.length}</span>
          <span style={{
            fontSize: 11.5, color: 'var(--text-muted)',
            transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s',
          }}>+</span>
        </span>
      </button>

      {/* 접혀 있으면 **다음에 닿을 것 하나**만. 다 했으면 그렇다고 한 줄 */}
      {open ? (
        list.map(m => <MissionItem key={m.id} mission={m} t={t} dim />)
      ) : next ? (
        <MissionItem mission={next} t={t} />
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--success)', padding: '11px 0 3px' }}>
          {t.allDone}
        </div>
      )}
    </div>
  );
}

export default function MissionSystem({ workouts, records, weekDates }) {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;

  const today = dateKey();
  const todayWorkouts = workouts[today] || [];
  const totalWorkouts = useMemo(() => Object.values(workouts).flat().length, [workouts]);
  const totalInbody = records.length;

  const daily = useMemo(() => withDone(getDailyMissions(lang, todayWorkouts)), [lang, todayWorkouts]);
  const weekly = useMemo(() => withDone(getWeeklyMissions(lang, workouts, records, weekDates)), [lang, workouts, records, weekDates]);
  const challenge = useMemo(() => withDone(getChallengeMissions(lang, totalWorkouts, totalInbody)), [lang, totalWorkouts, totalInbody]);

  return (
    <div className="card" style={{ marginBottom: 16, padding: '4px 14px 14px' }}>
      <Group title={t.daily} color="var(--accent)" list={daily} t={t} />
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 10 }} />
      <Group title={t.weekly} color="var(--info)" list={weekly} t={t} />
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 10 }} />
      {/* 「도전 미션」은 몇 년짜리다. 이름부터 매일 닦달하는 말이 아니게 바꿨고,
          색도 지운 게임이 쓰던 금색(#ffd700) 대신 토큰을 쓴다 */}
      <Group title={t.challenge} color="var(--text-secondary)" list={challenge} t={t} />
    </div>
  );
}
