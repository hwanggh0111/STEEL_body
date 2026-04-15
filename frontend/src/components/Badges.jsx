import { useState, useEffect } from 'react';
import LegendCeremony from './LegendCeremony';
import ImmortalCeremony from './ImmortalCeremony';
import client from '../api/client';

const BADGE_DEFS = [
  { id: 'first_workout', icon: '🏋️', name: '첫 운동', desc: '첫 운동 기록 완료', condition: (w) => Object.values(w).flat().length >= 1 },
  { id: 'workout_10', icon: '💪', name: '10회 달성', desc: '운동 기록 10회 완료', condition: (w) => Object.values(w).flat().length >= 10 },
  { id: 'workout_50', icon: '🔥', name: '50회 달성', desc: '운동 기록 50회 완료', condition: (w) => Object.values(w).flat().length >= 50 },
  { id: 'workout_100', icon: '🏆', name: '100회 달성', desc: '운동 기록 100회 완료', condition: (w) => Object.values(w).flat().length >= 100 },
  { id: 'week_3', icon: '📅', name: '주 3회', desc: '이번 주 3일 이상 운동', condition: (w) => { const d = getWeekDates(); return d.filter(dd => w[dd]?.length > 0).length >= 3; } },
  { id: 'week_5', icon: '🗓️', name: '주 5회', desc: '이번 주 5일 이상 운동', condition: (w) => { const d = getWeekDates(); return d.filter(dd => w[dd]?.length > 0).length >= 5; } },
  { id: 'week_7', icon: '👑', name: '매일 운동', desc: '이번 주 7일 모두 운동!', condition: (w) => { const d = getWeekDates(); return d.filter(dd => w[dd]?.length > 0).length >= 7; } },
  { id: 'streak_3', icon: '🔗', name: '3일 연속', desc: '3일 연속 운동 달성', condition: (w) => getStreak(w) >= 3 },
  { id: 'streak_7', icon: '⚡', name: '7일 연속', desc: '7일 연속 운동 달성', condition: (w) => getStreak(w) >= 7 },
  { id: 'streak_30', icon: '💎', name: '30일 연속', desc: '30일 연속 운동 달성!', condition: (w) => getStreak(w) >= 30 },
  { id: 'inbody_first', icon: '📊', name: '첫 측정', desc: '인바디 첫 기록', conditionInbody: (r) => r.length >= 1 },
  { id: 'inbody_5', icon: '📈', name: '5회 측정', desc: '인바디 5회 기록', conditionInbody: (r) => r.length >= 5 },
  { id: 'legend', icon: '⚜️', name: '전설의 리프터', desc: '모든 뱃지 달성 + 시작일로부터 1000일 + 12월 31일 운동 기록. 진정한 전설만이 받을 수 있는 칭호.', isLegend: true },
  { id: 'immortal', icon: '🔱', name: '불멸의 리프터', desc: '전설을 넘어선 자. 시간과 고통을 초월한 강철의 의지. 이 칭호를 가진 자는 영원히 기억된다.', isImmortal: true },
];

function toLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekDates() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return toLocalDate(d);
  });
}

function getStreak(workouts) {
  let streak = 0;
  const today = new Date();
  const todayKey = toLocalDate(today);
  // 오늘 운동 안 했으면 어제부터 카운트 시작
  const start = (workouts[todayKey]?.length > 0) ? 0 : 1;
  for (let i = start; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toLocalDate(d);
    if (workouts[key]?.length > 0) streak++;
    else break;
  }
  return streak;
}

import { isAdmin } from '../data/admin';

export default function Badges({ workouts, inbodyRecords }) {
  const [showAll, setShowAll] = useState(false);
  const [showCeremony, setShowCeremony] = useState(false);
  const admin = isAdmin();

  const normalBadges = BADGE_DEFS.filter(b => !b.isLegend && !b.isImmortal);
  const legendBadge = BADGE_DEFS.find(b => b.isLegend);
  const immortalBadge = BADGE_DEFS.find(b => b.isImmortal);

  const earnedNormal = admin ? normalBadges : normalBadges.filter(b =>
    b.condition ? b.condition(workouts || {}) : b.conditionInbody ? b.conditionInbody(inbodyRecords || []) : false
  );

  // 전설 조건: 모든 뱃지 + 1000일 경과 + 12월 31일 운동
  const [firstDate] = useState(() => {
    const stored = localStorage.getItem('steelbody_first_date');
    if (!stored) {
      const today = toLocalDate(new Date());
      localStorage.setItem('steelbody_first_date', today);
      return today;
    }
    return stored;
  });
  const daysSinceStart = firstDate ? (() => {
    const [y, m, d] = firstDate.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.floor((now - start) / 86400000);
  })() : 0;
  const hasNewYearsEve = Object.keys(workouts || {}).some(d => d.endsWith('-12-31') && workouts[d]?.length > 0);
  const legendEarned = admin || (earnedNormal.length === normalBadges.length && daysSinceStart >= 1000 && hasNewYearsEve);

  // 불멸 조건
  const allWorkouts = Object.values(workouts || {}).flat();
  const totalCount = allWorkouts.length;
  const hasNewYears = Object.keys(workouts || {}).some(d => d.endsWith('-01-01') && workouts[d]?.length > 0);
  const [myRoutines, setMyRoutines] = useState([]);
  useEffect(() => { client.get('/my-routines').then(({ data }) => setMyRoutines(data)).catch(() => {}); }, []);
  const exerciseCounts = {};
  allWorkouts.forEach(w => { if (w.exercise) exerciseCounts[w.exercise] = (exerciseCounts[w.exercise] || 0) + 1; });
  const maxExerciseCount = Math.max(0, ...Object.values(exerciseCounts));
  // 한 달 개근 횟수 계산
  const monthlyPerfect = (() => {
    const months = {};
    Object.keys(workouts || {}).forEach(d => {
      if (workouts[d]?.length > 0) {
        const ym = d.slice(0, 7);
        months[ym] = (months[ym] || 0) + 1;
      }
    });
    return Object.entries(months).filter(([ym, cnt]) => {
      const [y, m] = ym.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      return cnt >= daysInMonth;
    }).length;
  })();
  // 최장 연속 기록
  const maxStreak = (() => {
    const dates = Object.keys(workouts || {}).filter(d => workouts[d]?.length > 0).sort();
    if (dates.length === 0) return 0;
    let max = 1, cur = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const next = new Date(dates[i]);
      if (Math.round((next - prev) / 86400000) === 1) { cur++; max = Math.max(max, cur); }
      else cur = 1;
    }
    return max;
  })();

  const immortalChecks = {
    legend: legendEarned,
    workout1000: totalCount >= 1000,
    streak365: maxStreak >= 365,
    inbody20: (inbodyRecords || []).length >= 20,
    newYearBoth: hasNewYearsEve && hasNewYears,
    routines5: myRoutines.length >= 5,
    days2000: daysSinceStart >= 2000,
    exercise100: maxExerciseCount >= 100,
    monthPerfect3: monthlyPerfect >= 3,
  };
  const immortalEarned = admin || Object.values(immortalChecks).every(Boolean);

  let earned = [...earnedNormal];
  if (legendEarned) earned.push(legendBadge);
  if (immortalEarned) earned.push(immortalBadge);

  const [ceremonyType, setCeremonyType] = useState(null);

  useEffect(() => {
    // 전설 달성 체크
    if (legendEarned && localStorage.getItem('steelbody_legend_seen') !== 'true5') {
      localStorage.setItem('steelbody_legend', 'true');
      localStorage.setItem('steelbody_legend_seen', 'true5');
      if (immortalEarned) {
        localStorage.setItem('steelbody_immortal', 'true');
        localStorage.setItem('steelbody_immortal_seen', 'true4');
      }
      setCeremonyType('legend');
      setShowCeremony(true);
    } else if (immortalEarned && localStorage.getItem('steelbody_immortal_seen') !== 'true4') {
      localStorage.setItem('steelbody_immortal', 'true');
      localStorage.setItem('steelbody_immortal_seen', 'true4');
      setCeremonyType('immortal');
      setShowCeremony(true);
    } else {
      if (legendEarned) localStorage.setItem('steelbody_legend', 'true');
      if (immortalEarned) localStorage.setItem('steelbody_immortal', 'true');
    }
  }, [legendEarned, immortalEarned]);
  const display = showAll ? BADGE_DEFS : BADGE_DEFS.slice(0, 6);

  return (
    <div>
      {showCeremony && ceremonyType === 'legend' && <LegendCeremony onDone={() => {
        if (immortalEarned) { setCeremonyType('immortal'); } else { setShowCeremony(false); }
      }} />}
      {showCeremony && ceremonyType === 'immortal' && <ImmortalCeremony onDone={() => setShowCeremony(false)} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {earned.length}/{BADGE_DEFS.length} 달성
        </div>
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            background: 'none', border: 'none', color: 'var(--accent)',
            fontSize: 11, cursor: 'pointer', fontWeight: 600,
          }}
        >{showAll ? '접기' : '전체 보기'}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {display.map(b => {
          const isEarned = earned.includes(b);
          const isLegend = b.isLegend;
          const isImmortal = b.isImmortal;

          // 불멸 뱃지 카드
          if (isImmortal) return (
            <div key={b.id} style={{
              gridColumn: '1 / -1',
              background: isEarned ? 'linear-gradient(135deg, #0a0020, #150030, #0a0020)' : 'var(--bg-secondary)',
              border: '2px solid', borderColor: isEarned ? '#8060ff' : 'var(--border)',
              borderRadius: 'var(--radius)', padding: '16px 12px',
              textAlign: 'center', opacity: isEarned ? 1 : 0.25,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ fontSize: 36, marginBottom: 6, filter: isEarned ? 'drop-shadow(0 0 8px rgba(100,50,255,0.5))' : 'grayscale(1)' }}>🔱</div>
              <div style={{
                fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, letterSpacing: 3,
                color: isEarned ? '#c0a0ff' : 'var(--text-muted)', marginBottom: 4,
              }}>𓆩 불멸의 리프터 𓆪</div>
              <div style={{ fontSize: 10, color: isEarned ? '#c0a0ff' : 'var(--text-muted)', lineHeight: 1.5, marginBottom: 6, maxWidth: 280, margin: '0 auto' }}>
                {b.desc}
              </div>
              {isEarned ? (
                <div style={{
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  background: 'linear-gradient(135deg, #6040cc, #8060ff)',
                  padding: '4px 14px', borderRadius: 'var(--radius)',
                  display: 'inline-block', marginTop: 4, letterSpacing: 2,
                }}>IMMORTAL</div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>해금 조건:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                    {[
                      ['전설 달성', immortalChecks.legend],
                      ['운동 1000회', immortalChecks.workout1000],
                      ['365일 연속', immortalChecks.streak365],
                      ['인바디 20회', immortalChecks.inbody20],
                      ['1/1 + 12/31 운동', immortalChecks.newYearBoth],
                      ['루틴 5개 저장', immortalChecks.routines5],
                      ['2000일 경과', immortalChecks.days2000],
                      ['같은 운동 100회', immortalChecks.exercise100],
                      ['월 개근 3회', immortalChecks.monthPerfect3],
                    ].map(([label, done]) => (
                      <span key={label} style={{ fontSize: 9, color: done ? 'var(--success)' : 'var(--text-muted)' }}>
                        {done ? '✅' : '⬜'} {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );

          if (isLegend) return (
            <div key={b.id} style={{
              gridColumn: '1 / -1',
              background: isEarned ? 'linear-gradient(135deg, #1a1000, #2a1800, #1a1000)' : 'var(--bg-secondary)',
              border: '2px solid', borderColor: isEarned ? '#ffd700' : 'var(--border)',
              borderRadius: 'var(--radius)', padding: '16px 12px',
              textAlign: 'center', opacity: isEarned ? 1 : 0.3,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ fontSize: 36, marginBottom: 6, filter: isEarned ? 'drop-shadow(0 0 8px rgba(255,215,0,0.5))' : 'grayscale(1)' }}>⚜️</div>
              <div style={{
                fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, letterSpacing: 3,
                color: isEarned ? '#ffd700' : 'var(--text-muted)', marginBottom: 4,
              }}>𓆩 전설의 리프터 𓆪</div>
              <div style={{ fontSize: 10, color: isEarned ? '#ffd700' : 'var(--text-muted)', lineHeight: 1.5, marginBottom: 4 }}>
                {b.desc}
              </div>
              {isEarned ? (
                <div style={{
                  fontSize: 10, fontWeight: 700, color: '#000',
                  background: 'linear-gradient(135deg, #ffd700, #ff6b1a)',
                  padding: '3px 12px', borderRadius: 'var(--radius)',
                  display: 'inline-block', marginTop: 4, letterSpacing: 1,
                }}>LEGENDARY</div>
              ) : (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>해금 조건:</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                    <span style={{ fontSize: 9, color: earnedNormal.length === normalBadges.length ? 'var(--success)' : 'var(--text-muted)' }}>
                      {earnedNormal.length === normalBadges.length ? '✅' : '⬜'} 뱃지 {earnedNormal.length}/{normalBadges.length}
                    </span>
                    <span style={{ fontSize: 9, color: daysSinceStart >= 1000 ? 'var(--success)' : 'var(--text-muted)' }}>
                      {daysSinceStart >= 1000 ? '✅' : '⬜'} {daysSinceStart}/1000일
                    </span>
                    <span style={{ fontSize: 9, color: hasNewYearsEve ? 'var(--success)' : 'var(--text-muted)' }}>
                      {hasNewYearsEve ? '✅' : '⬜'} 12/31 운동
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
          return (
            <div key={b.id} style={{
              background: 'var(--bg-secondary)', border: '1px solid',
              borderColor: isEarned ? 'var(--accent)' : 'var(--border)',
              borderRadius: 'var(--radius)', padding: '10px 8px',
              textAlign: 'center', opacity: isEarned ? 1 : 0.4,
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 24, marginBottom: 4, filter: isEarned ? 'none' : 'grayscale(1)' }}>{b.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: isEarned ? 'var(--accent)' : 'var(--text-muted)', marginBottom: 2 }}>{b.name}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.4 }}>{b.desc}</div>
              {isEarned && <div style={{ fontSize: 8, color: 'var(--success)', marginTop: 3, fontWeight: 600 }}>달성!</div>}
            </div>
          );
        })}
      </div>

    </div>
  );
}
