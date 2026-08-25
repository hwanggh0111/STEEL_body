import { useMemo } from 'react';
import { useLangStore } from '../store/langStore';
import { dateKey } from '../data/dateKey';

const T = {
  ko: {
    daily: '일일 미션',
    weekly: '주간 미션',
    challenge: '도전 미션',
    completed: '완료',
    progress: '진행',
  },
  en: {
    daily: 'Daily Missions',
    weekly: 'Weekly Missions',
    challenge: 'Challenge',
    completed: 'Done',
    progress: 'Progress',
  },
};

function getDailyMissions(lang, todayWorkouts, todayInbody) {
  const workoutCount = todayWorkouts.length;
  const totalSets = todayWorkouts.reduce((sum, w) => sum + (w.sets || 0), 0);
  const totalReps = todayWorkouts.reduce((sum, w) => sum + ((w.sets || 0) * (w.reps || 0)), 0);
  const parts = new Set(todayWorkouts.map(w => w.exercise));

  return [
    {
      id: 'd1',
      title: lang === 'ko' ? '오늘 운동 1회 기록' : 'Log 1 workout today',
      icon: '💪',
      current: workoutCount,
      goal: 1,
      done: workoutCount >= 1,
    },
    {
      id: 'd2',
      title: lang === 'ko' ? '오늘 운동 3회 기록' : 'Log 3 workouts today',
      icon: '🔥',
      current: workoutCount,
      goal: 3,
      done: workoutCount >= 3,
    },
    {
      id: 'd3',
      title: lang === 'ko' ? '총 10세트 이상' : 'Complete 10+ sets',
      icon: '🏋️',
      current: totalSets,
      goal: 10,
      done: totalSets >= 10,
    },
    {
      id: 'd4',
      title: lang === 'ko' ? '2가지 이상 운동' : '2+ different exercises',
      icon: '🎯',
      current: parts.size,
      goal: 2,
      done: parts.size >= 2,
    },
  ];
}

function getWeeklyMissions(lang, workouts, records, weekDates) {
  const weekWorkoutDays = weekDates.filter(d => workouts[d] && workouts[d].length > 0).length;
  const weekTotalWorkouts = weekDates.reduce((sum, d) => sum + (workouts[d] ? workouts[d].length : 0), 0);
  const thisWeekInbody = records.filter(r => weekDates.includes(r.date)).length;

  return [
    {
      id: 'w1',
      title: lang === 'ko' ? '이번 주 3일 운동' : 'Work out 3 days this week',
      icon: '📅',
      current: weekWorkoutDays,
      goal: 3,
      done: weekWorkoutDays >= 3,
    },
    {
      id: 'w2',
      title: lang === 'ko' ? '이번 주 5일 운동' : 'Work out 5 days this week',
      icon: '⭐',
      current: weekWorkoutDays,
      goal: 5,
      done: weekWorkoutDays >= 5,
    },
    {
      id: 'w3',
      title: lang === 'ko' ? '이번 주 운동 15회 기록' : '15 workouts this week',
      icon: '🏆',
      current: weekTotalWorkouts,
      goal: 15,
      done: weekTotalWorkouts >= 15,
    },
    {
      id: 'w4',
      title: lang === 'ko' ? '이번 주 인바디 측정' : 'Measure InBody this week',
      icon: '📊',
      current: thisWeekInbody,
      goal: 1,
      done: thisWeekInbody >= 1,
    },
  ];
}

function getChallengeMissions(lang, totalWorkouts, totalInbody) {
  return [
    {
      id: 'c1',
      title: lang === 'ko' ? '총 운동 50회 달성' : 'Reach 50 total workouts',
      icon: '🎖️',
      current: totalWorkouts,
      goal: 50,
      done: totalWorkouts >= 50,
    },
    {
      id: 'c2',
      title: lang === 'ko' ? '총 운동 100회 달성' : 'Reach 100 total workouts',
      icon: '💎',
      current: totalWorkouts,
      goal: 100,
      done: totalWorkouts >= 100,
    },
    {
      id: 'c3',
      title: lang === 'ko' ? '총 운동 300회 달성' : 'Reach 300 total workouts',
      icon: '👑',
      current: totalWorkouts,
      goal: 300,
      done: totalWorkouts >= 300,
    },
    {
      id: 'c4',
      title: lang === 'ko' ? '인바디 5회 측정' : 'Measure InBody 5 times',
      icon: '📈',
      current: totalInbody,
      goal: 5,
      done: totalInbody >= 5,
    },
  ];
}

function MissionItem({ mission, t }) {
  const pct = Math.min((mission.current / mission.goal) * 100, 100);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0',
      opacity: mission.done ? 0.5 : 1,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
        background: mission.done ? 'var(--success-dim)' : 'var(--bg-tertiary)',
        border: `1px solid ${mission.done ? 'var(--success)' : 'var(--border)'}`,
        flexShrink: 0,
      }}>
        {mission.done ? '✓' : mission.icon}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 12, fontWeight: 500,
          color: mission.done ? 'var(--success)' : 'var(--text-primary)',
          textDecoration: mission.done ? 'line-through' : 'none',
          marginBottom: 4,
        }}>
          {mission.title}
        </div>
        <div style={{
          height: 4, borderRadius: 2, background: 'var(--bg-tertiary)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${pct}%`,
            background: mission.done ? 'var(--success)' : 'var(--accent)',
            transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            {mission.current}/{mission.goal}
          </span>
          {/* 예전에는 여기에 「+N EXP」가 있었다. 레벨을 없앤 뒤로는 줄 것이 없는데
              계속 약속하고 있었다. 남은 개수만 말한다 */}
          <span style={{ fontSize: 9, color: mission.done ? 'var(--success)' : 'var(--text-muted)' }}>
            {mission.done ? t.completed : `${Math.max(0, mission.goal - mission.current)} 남음`}
          </span>
        </div>
      </div>
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

  const daily = useMemo(() => getDailyMissions(lang, todayWorkouts), [lang, todayWorkouts]);
  const weekly = useMemo(() => getWeeklyMissions(lang, workouts, records, weekDates), [lang, workouts, records, weekDates]);
  const challenge = useMemo(() => getChallengeMissions(lang, totalWorkouts, totalInbody), [lang, totalWorkouts, totalInbody]);

  const dailyDone = daily.filter(m => m.done).length;
  const weeklyDone = weekly.filter(m => m.done).length;
  const challengeDone = challenge.filter(m => m.done).length;

  return (
    <div className="card" style={{ marginBottom: 16, padding: 14 }}>
      {/* 일일 미션 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5,
          color: 'var(--accent)',
        }}>
          {t.daily}
        </div>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius)',
          background: dailyDone === daily.length ? 'var(--success-dim)' : 'var(--bg-tertiary)',
          color: dailyDone === daily.length ? 'var(--success)' : 'var(--text-muted)',
          fontWeight: 600,
        }}>
          {dailyDone}/{daily.length}
        </span>
      </div>
      {daily.map(m => <MissionItem key={m.id} mission={m} t={t} />)}

      {/* 주간 미션 */}
      <div style={{
        borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5,
          color: '#4a9aff',
        }}>
          {t.weekly}
        </div>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius)',
          background: weeklyDone === weekly.length ? 'var(--success-dim)' : 'var(--bg-tertiary)',
          color: weeklyDone === weekly.length ? 'var(--success)' : 'var(--text-muted)',
          fontWeight: 600,
        }}>
          {weeklyDone}/{weekly.length}
        </span>
      </div>
      {weekly.map(m => <MissionItem key={m.id} mission={m} t={t} />)}

      {/* 도전 미션 */}
      <div style={{
        borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5,
          color: '#ffd700',
        }}>
          {t.challenge}
        </div>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius)',
          background: challengeDone === challenge.length ? 'var(--success-dim)' : 'var(--bg-tertiary)',
          color: challengeDone === challenge.length ? 'var(--success)' : 'var(--text-muted)',
          fontWeight: 600,
        }}>
          {challengeDone}/{challenge.length}
        </span>
      </div>
      {challenge.map(m => <MissionItem key={m.id} mission={m} t={t} />)}
    </div>
  );
}
