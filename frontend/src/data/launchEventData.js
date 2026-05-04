export const LAUNCH_DATE = '2026-04-22';
export const EVENT_END_DATE = '2026-05-22';
export const EVENT_DAYS = 30;

export const STORAGE_KEY_MISSIONS = 'steelbody_launch_missions';
export const STORAGE_KEY_ATTENDANCE = 'steelbody_launch_attendance';

export function toLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateDiffDays(a, b) {
  const msPerDay = 86400000;
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / msPerDay);
}

export function getEventDay(today) {
  const diff = dateDiffDays(LAUNCH_DATE, today);
  return diff;
}

export function getWeekIndex(today) {
  const day = getEventDay(today);
  if (day < 0) return -1;
  if (day <= 6) return 0;
  if (day <= 13) return 1;
  if (day <= 20) return 2;
  return 3;
}

export const T = {
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

export const WEEK_MISSIONS = [
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
