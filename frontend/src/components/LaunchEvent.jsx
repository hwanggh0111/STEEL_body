import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLangStore } from '../store/langStore';

const LAUNCH_DATE = '2026-04-22';
const EVENT_END_DATE = '2026-05-22';
const EVENT_DAYS = 30;

const STORAGE_KEY_MISSIONS = 'steelbody_launch_missions';
const STORAGE_KEY_ATTENDANCE = 'steelbody_launch_attendance';

function toLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateDiffDays(a, b) {
  const msPerDay = 86400000;
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / msPerDay);
}

function getEventDay(today) {
  const diff = dateDiffDays(LAUNCH_DATE, today);
  return diff;
}

function getWeekIndex(today) {
  const day = getEventDay(today);
  if (day < 0) return -1;
  if (day <= 6) return 0;
  if (day <= 13) return 1;
  if (day <= 20) return 2;
  return 3;
}

const T = {
  ko: {
    title: 'STEEL BODY GRAND LAUNCH',
    subtitle: '정식 출시 기념 이벤트',
    dBefore: '출시까지',
    dAfter: '이벤트',
    remaining: '이벤트 남은 기간',
    ended: '이벤트 종료',
    weekMission: '주차별 미션',
    week: '주차',
    exp: 'EXP',
    complete: '완료',
    incomplete: '미완료',
    progress: '진행률',
    attendance: '출석 도장',
    attendanceDesc: '매일 운동하고 도장을 모으세요!',
    stampToday: '오늘 도장 찍기',
    stamped: '도장 완료',
    days: '일',
    badge7: '7일 달성 — 특별 뱃지',
    badge14: '14일 달성 — 골드 뱃지',
    badge30: '30일 달성 — 다이아몬드 뱃지',
    rewards: '한정판 보상',
    launchPioneer: 'LAUNCH PIONEER',
    launchPioneerDesc: '전체 미션 클리어 칭호',
    diamondMember: 'DIAMOND MEMBER',
    diamondMemberDesc: '30일 출석 달성 칭호',
    acquired: '획득',
    notAcquired: '미획득',
    info: '이벤트 안내',
    rule1: '이벤트 기간 내 미션을 완료하여 EXP와 보상을 획득하세요.',
    rule2: '출석 도장은 해당 날짜에 운동 기록이 있어야 인정됩니다.',
    rule3: '보상은 조건 달성 시 자동으로 부여됩니다.',
    period: '이벤트 기간',
    periodValue: '2026.04.22 ~ 2026.05.22 (30일)',
    missions: {
      w1m1: '첫 운동 기록하기',
      w1m2: '프로필 설정하기',
      w2m1: '5일 연속 출석',
      w2m2: '인바디 측정하기',
      w3m1: '운동 20회 달성',
      w3m2: '3가지 운동 기록',
      w4m1: '총 운동 50회',
      w4m2: '레벨 5 달성',
    },
  },
  en: {
    title: 'STEEL BODY GRAND LAUNCH',
    subtitle: 'Official Launch Event',
    dBefore: 'Until Launch',
    dAfter: 'Event',
    remaining: 'Event Time Left',
    ended: 'Event Ended',
    weekMission: 'Weekly Missions',
    week: 'Week',
    exp: 'EXP',
    complete: 'Done',
    incomplete: 'Not Done',
    progress: 'Progress',
    attendance: 'Attendance Stamps',
    attendanceDesc: 'Work out daily and collect stamps!',
    stampToday: 'Stamp Today',
    stamped: 'Stamped',
    days: 'days',
    badge7: '7 Days — Special Badge',
    badge14: '14 Days — Gold Badge',
    badge30: '30 Days — Diamond Badge',
    rewards: 'Limited Rewards',
    launchPioneer: 'LAUNCH PIONEER',
    launchPioneerDesc: 'Clear all missions',
    diamondMember: 'DIAMOND MEMBER',
    diamondMemberDesc: '30-day attendance',
    acquired: 'Acquired',
    notAcquired: 'Locked',
    info: 'Event Info',
    rule1: 'Complete missions during the event to earn EXP and rewards.',
    rule2: 'Attendance stamps require a workout log on that day.',
    rule3: 'Rewards are granted automatically upon meeting conditions.',
    period: 'Event Period',
    periodValue: '2026.04.22 ~ 2026.05.22 (30 days)',
    missions: {
      w1m1: 'Log First Workout',
      w1m2: 'Set Up Profile',
      w2m1: '5-Day Streak',
      w2m2: 'Measure InBody',
      w3m1: 'Complete 20 Workouts',
      w3m2: 'Log 3 Different Exercises',
      w4m1: '50 Total Workouts',
      w4m2: 'Reach Level 5',
    },
  },
};

const WEEK_MISSIONS = [
  {
    week: 1,
    dateRange: ['2026-04-22', '2026-04-28'],
    missions: [
      { id: 'w1m1', key: 'w1m1', exp: 50 },
      { id: 'w1m2', key: 'w1m2', exp: 30 },
    ],
  },
  {
    week: 2,
    dateRange: ['2026-04-29', '2026-05-05'],
    missions: [
      { id: 'w2m1', key: 'w2m1', exp: 100 },
      { id: 'w2m2', key: 'w2m2', exp: 50 },
    ],
  },
  {
    week: 3,
    dateRange: ['2026-05-06', '2026-05-12'],
    missions: [
      { id: 'w3m1', key: 'w3m1', exp: 150 },
      { id: 'w3m2', key: 'w3m2', exp: 80 },
    ],
  },
  {
    week: 4,
    dateRange: ['2026-05-13', '2026-05-22'],
    missions: [
      { id: 'w4m1', key: 'w4m1', exp: 300 },
      { id: 'w4m2', key: 'w4m2', exp: 200 },
    ],
  },
];

/* ===================== Styles ===================== */

const bannerStyle = {
  background: 'var(--event-banner-bg)',
  borderRadius: 18,
  padding: '36px 24px 28px',
  textAlign: 'center',
  position: 'relative',
  overflow: 'hidden',
  marginBottom: 18,
  border: '2px solid rgba(255,215,0,0.3)',
  boxShadow: 'var(--event-banner-shadow)',
};

const particleOverlayStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
  background: 'var(--event-banner-overlay)',
};

const titleStyle = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 38,
  letterSpacing: 4,
  background: 'linear-gradient(90deg, #ffd700 0%, #ff6b1a 50%, #ffd700 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  textShadow: 'none',
  filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.4))',
  margin: 0,
  lineHeight: 1.1,
};

const subtitleStyle = {
  fontFamily: "'Barlow', sans-serif",
  fontSize: 14,
  color: 'var(--event-text-mid)',
  marginTop: 6,
  letterSpacing: 2,
};

const ddayStyle = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 28,
  color: 'var(--accent)',
  marginTop: 16,
  textShadow: '0 0 16px rgba(255,215,0,0.5)',
};

const progressBarOuter = {
  background: 'var(--event-progress-track)',
  borderRadius: 10,
  height: 10,
  margin: '16px 0 0',
  overflow: 'hidden',
  border: '1px solid rgba(255,215,0,0.15)',
};

const sectionTitleStyle = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 22,
  letterSpacing: 2,
  color: 'var(--accent)',
  marginBottom: 14,
  textShadow: '0 0 8px rgba(255,215,0,0.3)',
};

const weekCardStyle = (isActive) => ({
  background: isActive
    ? 'linear-gradient(135deg, rgba(255,107,26,0.15), rgba(255,215,0,0.08))'
    : 'var(--event-soft-bg)',
  borderRadius: 14,
  padding: '16px 18px',
  marginBottom: 12,
  border: isActive ? '1px solid rgba(255,215,0,0.4)' : '1px solid var(--event-soft-border)',
  boxShadow: isActive ? '0 0 20px rgba(255,107,26,0.1)' : 'none',
  transition: 'all 0.3s',
});

const missionRowStyle = (done) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: '1px solid var(--event-mission-divider)',
  opacity: done ? 0.7 : 1,
});

const checkCircle = (done) => ({
  width: 26,
  height: 26,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 900,
  flexShrink: 0,
  background: done
    ? 'linear-gradient(135deg, #ffd700, #ff6b1a)'
    : 'var(--event-soft-bg)',
  color: done ? '#1a0a2e' : 'var(--event-stamp-text-locked)',
  border: done ? 'none' : '2px solid var(--event-text-ghost)',
  boxShadow: done ? '0 0 10px rgba(255,215,0,0.4)' : 'none',
});

const expBadgeStyle = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 14,
  color: 'var(--accent)',
  background: 'rgba(255,215,0,0.1)',
  borderRadius: 8,
  padding: '2px 10px',
  letterSpacing: 1,
};

const stampGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 6,
  marginTop: 12,
};

const stampCellStyle = (stamped, isToday) => ({
  width: '100%',
  aspectRatio: '1',
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: stamped ? 20 : 11,
  fontFamily: "'Barlow', sans-serif",
  fontWeight: 600,
  background: stamped
    ? 'linear-gradient(135deg, rgba(255,107,26,0.25), rgba(255,215,0,0.15))'
    : isToday
      ? 'rgba(255,215,0,0.08)'
      : 'var(--event-soft-bg)',
  color: stamped ? '#ffd700' : isToday ? '#ff6b1a' : 'var(--event-text-muted)',
  border: isToday && !stamped ? '1px solid rgba(255,107,26,0.5)' : stamped ? '1px solid rgba(255,215,0,0.3)' : '1px solid var(--event-mission-divider)',
  boxShadow: stamped ? '0 0 8px rgba(255,215,0,0.2)' : 'none',
  cursor: isToday && !stamped ? 'pointer' : 'default',
  transition: 'all 0.2s',
});

const attendanceBadgeStyle = (earned) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  borderRadius: 10,
  fontSize: 13,
  fontFamily: "'Barlow', sans-serif",
  fontWeight: 600,
  background: earned ? 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,107,26,0.1))' : 'var(--event-soft-bg)',
  color: earned ? '#ffd700' : 'var(--event-text-muted)',
  border: earned ? '1px solid rgba(255,215,0,0.3)' : '1px solid var(--event-soft-border)',
  boxShadow: earned ? '0 0 12px rgba(255,215,0,0.15)' : 'none',
});

const rewardCardStyle = (acquired) => ({
  background: acquired
    ? 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,107,26,0.08))'
    : 'var(--event-soft-bg)',
  borderRadius: 14,
  padding: '20px 18px',
  textAlign: 'center',
  border: acquired ? '2px solid rgba(255,215,0,0.4)' : '2px solid var(--event-soft-border)',
  boxShadow: acquired ? '0 0 24px rgba(255,215,0,0.15)' : 'none',
  flex: '1 1 0',
  minWidth: 140,
  transition: 'all 0.3s',
});

const rewardTitleStyle = (acquired) => ({
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 20,
  letterSpacing: 2,
  color: acquired ? '#ffd700' : 'var(--event-text-muted)',
  textShadow: acquired ? '0 0 10px rgba(255,215,0,0.4)' : 'none',
  marginBottom: 6,
});

const rewardStatusStyle = (acquired) => ({
  fontFamily: "'Barlow', sans-serif",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1,
  color: acquired ? '#ff6b1a' : 'var(--event-stamp-text-locked)',
  textTransform: 'uppercase',
  marginTop: 8,
  background: acquired ? 'rgba(255,107,26,0.12)' : 'var(--event-soft-bg)',
  display: 'inline-block',
  padding: '3px 12px',
  borderRadius: 6,
});

const infoBoxStyle = {
  background: 'var(--event-soft-bg)',
  borderRadius: 14,
  padding: '18px 18px',
  border: '1px solid var(--event-soft-border)',
};

const infoTextStyle = {
  fontFamily: "'Barlow', sans-serif",
  fontSize: 13,
  color: 'var(--event-text-soft)',
  lineHeight: 1.7,
  margin: 0,
};

const stampBtnStyle = (canStamp) => ({
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 16,
  letterSpacing: 2,
  padding: '10px 28px',
  borderRadius: 10,
  border: 'none',
  cursor: canStamp ? 'pointer' : 'default',
  background: canStamp
    ? 'linear-gradient(135deg, #ff6b1a, #ffd700)'
    : 'var(--event-soft-bg)',
  color: canStamp ? '#1a0a2e' : 'var(--event-text-muted)',
  fontWeight: 700,
  boxShadow: canStamp ? '0 0 16px rgba(255,107,26,0.4)' : 'none',
  marginTop: 12,
  transition: 'all 0.2s',
});

/* ===================== Component ===================== */

export default function LaunchEvent({ workouts = {}, records = [] }) {
  const lang = useLangStore((s) => s.lang) || 'ko';
  const t = T[lang] || T.ko;

  const today = useMemo(() => toLocalDate(new Date()), []);
  const eventDay = useMemo(() => getEventDay(today), [today]);
  const currentWeek = useMemo(() => getWeekIndex(today), [today]);

  // Timer countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  // Missions from localStorage
  const [completedMissions, setCompletedMissions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_MISSIONS)) || {};
    } catch { return {}; }
  });

  const saveMissions = useCallback((m) => {
    setCompletedMissions(m);
    localStorage.setItem(STORAGE_KEY_MISSIONS, JSON.stringify(m));
  }, []);

  // Attendance from localStorage
  const [attendance, setAttendance] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_ATTENDANCE)) || [];
    } catch { return []; }
  });

  const saveAttendance = useCallback((a) => {
    setAttendance(a);
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(a));
  }, []);

  // Auto-check missions based on data
  useEffect(() => {
    const allWorkouts = Object.values(workouts).flat();
    const totalWorkouts = allWorkouts.length;
    const uniqueExercises = new Set(allWorkouts.map((w) => w.exercise)).size;
    const profileSet = !!localStorage.getItem('steelbody_profile');
    const hasInbody = records.length > 0;

    // Streak calc
    const workoutDays = Object.keys(workouts).filter((d) => workouts[d]?.length > 0).sort();
    let maxStreak = 0;
    let cur = 1;
    for (let i = 1; i < workoutDays.length; i++) {
      if (dateDiffDays(workoutDays[i - 1], workoutDays[i]) === 1) {
        cur++;
      } else {
        cur = 1;
      }
      maxStreak = Math.max(maxStreak, cur);
    }
    if (workoutDays.length === 1) maxStreak = 1;

    // Level from localStorage
    let userLevel = 1;
    try {
      const lv = localStorage.getItem('steelbody_level');
      if (lv) userLevel = parseInt(lv, 10) || 1;
    } catch {}

    const updated = { ...completedMissions };
    let changed = false;

    const check = (id, condition) => {
      if (!updated[id] && condition) {
        updated[id] = true;
        changed = true;
      }
    };

    check('w1m1', totalWorkouts >= 1);
    check('w1m2', profileSet);
    check('w2m1', maxStreak >= 5);
    check('w2m2', hasInbody);
    check('w3m1', totalWorkouts >= 20);
    check('w3m2', uniqueExercises >= 3);
    check('w4m1', totalWorkouts >= 50);
    check('w4m2', userLevel >= 5);

    if (changed) saveMissions(updated);
  }, [workouts, records, completedMissions, saveMissions]);

  // D-day text
  const ddayText = useMemo(() => {
    if (eventDay < 0) return `${t.dBefore} D-${Math.abs(eventDay)}`;
    if (eventDay === 0) return 'D-DAY!';
    if (eventDay > EVENT_DAYS) return t.ended;
    return `${t.dAfter} D+${eventDay}`;
  }, [eventDay, t]);

  // Progress
  const progressPct = useMemo(() => {
    if (eventDay < 0) return 0;
    if (eventDay >= EVENT_DAYS) return 100;
    return Math.round((eventDay / EVENT_DAYS) * 100);
  }, [eventDay]);

  // Event dates array
  const eventDates = useMemo(() => {
    const dates = [];
    const start = new Date(LAUNCH_DATE + 'T00:00:00');
    for (let i = 0; i < EVENT_DAYS; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(toLocalDate(d));
    }
    return dates;
  }, []);

  // Has workout today
  const todayHasWorkout = useMemo(
    () => workouts[today] && workouts[today].length > 0,
    [workouts, today]
  );

  const todayStamped = attendance.includes(today);
  const canStamp = todayHasWorkout && !todayStamped && eventDay >= 0 && eventDay < EVENT_DAYS;

  const handleStamp = () => {
    if (!canStamp) return;
    const next = [...attendance, today];
    saveAttendance(next);
  };

  // Attendance count
  const attendanceCount = attendance.length;

  // Total missions
  const totalMissionIds = WEEK_MISSIONS.flatMap((w) => w.missions.map((m) => m.id));
  const completedCount = totalMissionIds.filter((id) => completedMissions[id]).length;
  const allMissionsCleared = completedCount === totalMissionIds.length;

  // Rewards
  const pioneerEarned = allMissionsCleared;
  const diamondEarned = attendanceCount >= 30;

  // Week mission progress
  const weekProgress = (weekIndex) => {
    const wk = WEEK_MISSIONS[weekIndex];
    if (!wk) return 0;
    const done = wk.missions.filter((m) => completedMissions[m.id]).length;
    return Math.round((done / wk.missions.length) * 100);
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 24px' }}>
      {/* ===== Banner ===== */}
      <div className="card" style={bannerStyle}>
        <div style={particleOverlayStyle} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Decorative sparkles */}
          <div style={{ position: 'absolute', top: -10, left: 20, fontSize: 18, opacity: 0.5 }}>✦</div>
          <div style={{ position: 'absolute', top: -6, right: 28, fontSize: 14, opacity: 0.4, color: '#ffd700' }}>✧</div>
          <div style={{ position: 'absolute', bottom: 10, left: '15%', fontSize: 12, opacity: 0.3, color: '#ff6b1a' }}>✦</div>
          <div style={{ position: 'absolute', bottom: 16, right: '12%', fontSize: 16, opacity: 0.35, color: '#ffd700' }}>✧</div>

          <h1 style={titleStyle}>{t.title}</h1>
          <div style={subtitleStyle}>{t.subtitle}</div>
          <div style={ddayStyle}>{ddayText}</div>

          {/* Progress bar */}
          <div style={{ marginTop: 10, fontSize: 11, fontFamily: "'Barlow', sans-serif", color: 'var(--event-text-faded)', letterSpacing: 1 }}>
            {t.remaining}
          </div>
          <div style={progressBarOuter}>
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                borderRadius: 10,
                background: 'linear-gradient(90deg, #ff6b1a, #ffd700)',
                boxShadow: '0 0 8px rgba(255,215,0,0.4)',
                transition: 'width 0.6s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 11, fontFamily: "'Barlow', sans-serif", color: 'var(--event-text-muted)', marginTop: 4 }}>
            {progressPct}%
          </div>
        </div>
      </div>

      {/* ===== Weekly Missions ===== */}
      <div className="card" style={{ background: 'var(--event-card-bg)', borderRadius: 16, padding: '20px 16px', marginBottom: 18, border: '1px solid var(--event-card-border)'}}>
        <div style={sectionTitleStyle}>🎯 {t.weekMission}</div>
        {WEEK_MISSIONS.map((wk, wi) => {
          const isActive = wi === currentWeek;
          const prog = weekProgress(wi);
          return (
            <div key={wk.week} style={weekCardStyle(isActive)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2, color: isActive ? '#ffd700' : 'var(--event-text-faded)' }}>
                  {wk.week}{t.week}
                  <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, fontWeight: 400, marginLeft: 8, color: 'var(--event-text-muted)', letterSpacing: 0 }}>
                    {wk.dateRange[0].slice(5)} ~ {wk.dateRange[1].slice(5)}
                  </span>
                </div>
                <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: isActive ? '#ff6b1a' : 'var(--event-stamp-text-locked)', fontWeight: 700 }}>
                  {prog}%
                </div>
              </div>
              {/* Week progress bar */}
              <div style={{ ...progressBarOuter, height: 5, margin: '0 0 10px' }}>
                <div style={{
                  width: `${prog}%`,
                  height: '100%',
                  borderRadius: 10,
                  background: isActive ? 'linear-gradient(90deg, #ff6b1a, #ffd700)' : 'var(--event-text-ghost)',
                  transition: 'width 0.4s',
                }} />
              </div>
              {wk.missions.map((m) => {
                const done = !!completedMissions[m.id];
                return (
                  <div key={m.id} style={missionRowStyle(done)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      <div style={checkCircle(done)}>{done ? '✓' : ''}</div>
                      <span style={{
                        fontFamily: "'Barlow', sans-serif",
                        fontSize: 13,
                        color: done ? 'var(--event-text-soft)' : 'var(--event-text-strong)',
                        textDecoration: done ? 'line-through' : 'none',
                        fontWeight: 500,
                      }}>
                        {t.missions[m.key]}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={expBadgeStyle}>+{m.exp} {t.exp}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        {/* Total progress */}
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: 'var(--event-text-faded)' }}>
            {t.progress}: {completedCount}/{totalMissionIds.length}
          </span>
        </div>
      </div>

      {/* ===== Attendance ===== */}
      <div className="card" style={{ background: 'var(--event-card-bg)', borderRadius: 16, padding: '20px 16px', marginBottom: 18, border: '1px solid var(--event-card-border)'}}>
        <div style={sectionTitleStyle}>🔥 {t.attendance}</div>
        <p style={{ ...infoTextStyle, fontSize: 12, marginBottom: 8 }}>{t.attendanceDesc}</p>
        <div style={{ fontSize: 13, fontFamily: "'Barlow', sans-serif", color: '#ff6b1a', fontWeight: 700, marginBottom: 6 }}>
          {attendanceCount} / {EVENT_DAYS} {t.days}
        </div>

        <div style={stampGridStyle}>
          {eventDates.map((date, i) => {
            const stamped = attendance.includes(date);
            const isToday = date === today;
            return (
              <div
                key={date}
                style={stampCellStyle(stamped, isToday)}
                onClick={() => { if (isToday && canStamp) handleStamp(); }}
                title={date}
              >
                {stamped ? '🔥' : (i + 1)}
              </div>
            );
          })}
        </div>

        {/* Stamp button */}
        <div style={{ textAlign: 'center' }}>
          <button style={stampBtnStyle(canStamp)} onClick={handleStamp} disabled={!canStamp}>
            {todayStamped ? `✓ ${t.stamped}` : t.stampToday}
          </button>
        </div>

        {/* Badge milestones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <div style={attendanceBadgeStyle(attendanceCount >= 7)}>
            <span style={{ fontSize: 18 }}>⭐</span>
            <span>{t.badge7}</span>
          </div>
          <div style={attendanceBadgeStyle(attendanceCount >= 14)}>
            <span style={{ fontSize: 18 }}>🥇</span>
            <span>{t.badge14}</span>
          </div>
          <div style={attendanceBadgeStyle(attendanceCount >= 30)}>
            <span style={{ fontSize: 18 }}>💎</span>
            <span>{t.badge30}</span>
          </div>
        </div>
      </div>

      {/* ===== Rewards ===== */}
      <div className="card" style={{ background: 'var(--event-card-bg)', borderRadius: 16, padding: '20px 16px', marginBottom: 18, border: '1px solid var(--event-card-border)'}}>
        <div style={sectionTitleStyle}>🏆 {t.rewards}</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={rewardCardStyle(pioneerEarned)}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{pioneerEarned ? '⚜️' : '🔒'}</div>
            <div style={rewardTitleStyle(pioneerEarned)}>{t.launchPioneer}</div>
            <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: 'var(--event-text-faded)', marginBottom: 4 }}>
              {t.launchPioneerDesc}
            </div>
            <div style={rewardStatusStyle(pioneerEarned)}>
              {pioneerEarned ? t.acquired : t.notAcquired}
            </div>
          </div>
          <div style={rewardCardStyle(diamondEarned)}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{diamondEarned ? '💎' : '🔒'}</div>
            <div style={rewardTitleStyle(diamondEarned)}>{t.diamondMember}</div>
            <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: 'var(--event-text-faded)', marginBottom: 4 }}>
              {t.diamondMemberDesc}
            </div>
            <div style={rewardStatusStyle(diamondEarned)}>
              {diamondEarned ? t.acquired : t.notAcquired}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Event Info ===== */}
      <div className="card" style={{ background: 'var(--event-card-bg)', borderRadius: 16, padding: '20px 16px', marginBottom: 0, border: '1px solid var(--event-card-border)' }}>
        <div style={sectionTitleStyle}>📋 {t.info}</div>
        <div style={infoBoxStyle}>
          <p style={infoTextStyle}>• {t.rule1}</p>
          <p style={infoTextStyle}>• {t.rule2}</p>
          <p style={infoTextStyle}>• {t.rule3}</p>
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,215,0,0.05)', borderRadius: 10, border: '1px solid rgba(255,215,0,0.1)' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: '#ffd700', letterSpacing: 1, marginBottom: 4 }}>
              {t.period}
            </div>
            <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: 'var(--event-text-soft)', fontWeight: 600 }}>
              {t.periodValue}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
