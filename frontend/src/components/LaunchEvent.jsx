import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLangStore } from '../store/langStore';
import {
  LAUNCH_DATE, EVENT_DAYS,
  STORAGE_KEY_MISSIONS, STORAGE_KEY_ATTENDANCE,
  toLocalDate, dateDiffDays, getEventDay, getWeekIndex,
  T, WEEK_MISSIONS,
} from '../data/launchEventData';
import {
  bannerStyle, particleOverlayStyle, titleStyle, subtitleStyle, ddayStyle,
  progressBarOuter, sectionTitleStyle, cardStyle,
  weekCardStyle, missionRowStyle, checkCircle, expBadgeStyle,
  stampGridStyle, stampCellStyle, attendanceBadgeStyle,
  rewardCardStyle, rewardTitleStyle, rewardStatusStyle,
  infoBoxStyle, infoTextStyle, stampBtnStyle,
} from './launchEvent/styles';

export default function LaunchEvent({ workouts = {}, records = [] }) {
  const lang = useLangStore((s) => s.lang) || 'ko';
  const t = T[lang] || T.ko;

  const today = useMemo(() => toLocalDate(new Date()), []);
  const eventDay = useMemo(() => getEventDay(today), [today]);
  const currentWeek = useMemo(() => getWeekIndex(today), [today]);

  // Timer countdown (re-render every minute)
  const [, setNow] = useState(Date.now());
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

  const todayHasWorkout = useMemo(
    () => workouts[today] && workouts[today].length > 0,
    [workouts, today]
  );

  const todayStamped = attendance.includes(today);
  const canStamp = todayHasWorkout && !todayStamped && eventDay >= 0 && eventDay < EVENT_DAYS;

  const handleStamp = () => {
    if (!canStamp) return;
    saveAttendance([...attendance, today]);
  };

  const attendanceCount = attendance.length;

  // Total missions
  const totalMissionIds = WEEK_MISSIONS.flatMap((w) => w.missions.map((m) => m.id));
  const completedCount = totalMissionIds.filter((id) => completedMissions[id]).length;
  const allMissionsCleared = completedCount === totalMissionIds.length;

  const pioneerEarned = allMissionsCleared;
  const diamondEarned = attendanceCount >= 30;

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
          <div style={{ position: 'absolute', top: -10, left: 20, fontSize: 18, opacity: 0.5 }}>✦</div>
          <div style={{ position: 'absolute', top: -6, right: 28, fontSize: 14, opacity: 0.4, color: '#ffd700' }}>✧</div>
          <div style={{ position: 'absolute', bottom: 10, left: '15%', fontSize: 12, opacity: 0.3, color: '#ff6b1a' }}>✦</div>
          <div style={{ position: 'absolute', bottom: 16, right: '12%', fontSize: 16, opacity: 0.35, color: '#ffd700' }}>✧</div>

          <h1 style={titleStyle}>{t.title}</h1>
          <div style={subtitleStyle}>{t.subtitle}</div>
          <div style={ddayStyle}>{ddayText}</div>

          <div style={{ marginTop: 10, fontSize: 11, fontFamily: "'Barlow', sans-serif", color: 'var(--event-text-faded)', letterSpacing: 1 }}>
            {t.remaining}
          </div>
          <div style={progressBarOuter}>
            <div style={{
              width: `${progressPct}%`, height: '100%', borderRadius: 10,
              background: 'linear-gradient(90deg, #ff6b1a, #ffd700)',
              boxShadow: '0 0 8px rgba(255,215,0,0.4)',
              transition: 'width 0.6s ease',
            }} />
          </div>
          <div style={{ fontSize: 11, fontFamily: "'Barlow', sans-serif", color: 'var(--event-text-muted)', marginTop: 4 }}>
            {progressPct}%
          </div>
        </div>
      </div>

      {/* ===== Weekly Missions ===== */}
      <div className="card" style={cardStyle}>
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
              <div style={{ ...progressBarOuter, height: 5, margin: '0 0 10px' }}>
                <div style={{
                  width: `${prog}%`, height: '100%', borderRadius: 10,
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
                        fontFamily: "'Barlow', sans-serif", fontSize: 13,
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
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: 'var(--event-text-faded)' }}>
            {t.progress}: {completedCount}/{totalMissionIds.length}
          </span>
        </div>
      </div>

      {/* ===== Attendance ===== */}
      <div className="card" style={cardStyle}>
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

        <div style={{ textAlign: 'center' }}>
          <button style={stampBtnStyle(canStamp)} onClick={handleStamp} disabled={!canStamp}>
            {todayStamped ? `✓ ${t.stamped}` : t.stampToday}
          </button>
        </div>

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
      <div className="card" style={cardStyle}>
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
      <div className="card" style={{ ...cardStyle, marginBottom: 0 }}>
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
