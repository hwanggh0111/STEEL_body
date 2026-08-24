import { useEffect, useMemo } from 'react';
import { useWorkoutStore } from '../../store/workoutStore';
import { useInbodyStore } from '../../store/inbodyStore';
import { usePachinkoStore } from '../../store/pachinkoStore';
import {
  calcExp, getLevelInfo, expForLevel, MAX_LEVEL, EXP_PER,
  TRANSCEND, GENESIS, TRANSCEND_TIERS, GENESIS_TIERS,
} from '../../components/LevelSystem';
import { TICKET_RULE, LADDER, UL_TICKET } from '../../data/pachinkoData';
import { PLATE_RULE, BASE_DAILY_PLAYS } from '../../data/plateData';
import { dateKey } from '../../data/dateKey';

// 고객센터가 보여주는 숫자를 한 군데서 만든다.
// 화면마다 따로 계산하면 어느 순간 한 곳만 옛날 값을 보여주게 된다.
// 상한·비용·교환비는 전부 실제 상수에서 읽는다 — 밸런스를 바꾸면 화면이 따라온다.

export const FEATURES = [
  { name: '운동 기록',   path: '/workout',     icon: '🏋️', short: '무게 · 횟수 · 세트',      long: '무게 · 횟수 · 세트를 남긴다. 지난 기록이 옆에 떠서 오늘 얼마나 올릴지 바로 안다' },
  { name: '인바디',      path: '/inbody',      icon: '📊', short: '체중 · 체지방 · 골격근',  long: '체중 · 체지방 · 골격근을 넣으면 그래프로 이어진다. BMI 와 변화량을 같이 본다' },
  { name: '루틴 추천',   path: '/routine',     icon: '📋', short: '2 · 3 · 5분할',           long: '2분할 · 3분할 · 5분할. 무엇을 할지 정하는 데 시간을 쓰지 않게' },
  { name: '홈트레이닝',  path: '/homeworkout', icon: '🏠', short: '기구 없이 맨몸으로',      long: '기구 없이 하는 맨몸 운동. 집에서도 기록이 끊기지 않는다' },
  { name: '측정 시스템', path: '/measure',     icon: '📐', short: '사이즈 · 1RM · 체력',     long: '전신 사이즈 · 1RM · 체력 테스트 · 심박수 존 · 스톱워치까지 한곳에' },
  { name: '히스토리',    path: '/history',     icon: '📅', short: '달력으로 되짚기',         long: '달력으로 되짚는다. 빠진 날이 눈에 보여야 안 빠진다' },
];

// 등급 이름도 표에서 읽는다. 손으로 적으면 어긋난다 —
// 일반 만렙 등급을 '신화' 로 적어뒀었는데 실제로는 '이름 없는 것' 이었다.
const firstGeneralTier = getLevelInfo(0);
const lastGeneralTier = getLevelInfo(expForLevel(MAX_LEVEL));
const last = arr => arr[arr.length - 1];

export const LEVEL_ROWS = [
  {
    name: '일반', lo: 0, hi: MAX_LEVEL, unit: 'EXP', opens: '처음부터',
    tiers: lastGeneralTier.tier,
    first: firstGeneralTier.tierInfo?.name?.ko,
    last: lastGeneralTier.tierInfo?.name?.ko,
  },
  {
    name: TRANSCEND.name.ko, lo: 0, hi: TRANSCEND.maxLevel, unit: 'EXP',
    opens: `LV ${MAX_LEVEL} 도달`,
    tiers: TRANSCEND_TIERS.length,
    first: TRANSCEND_TIERS[0].name.ko,
    last: last(TRANSCEND_TIERS).name.ko,
  },
  {
    name: GENESIS.name.ko, lo: 0, hi: GENESIS.maxLevel, unit: 'UL EXP',
    opens: `${TRANSCEND.name.ko} 만렙`,
    tiers: GENESIS_TIERS.length,
    first: GENESIS_TIERS[0].name.ko,
    last: last(GENESIS_TIERS).name.ko,
  },
];

export const TICKET_ROWS = [
  { name: '파칭코',   cost: '🎫 1',                  desc: '한 판씩. 낮은 확률로 크게 터진다' },
  { name: '사다리',   cost: `🎫 ${LADDER.cost}`,     desc: '판돈이 큰 대신 기대값은 파칭코와 같다' },
  { name: '미니게임', cost: '무료',                  desc: '원판을 주워 모으면 티켓으로 바꾼다' },
  { name: '교환소',   cost: `🎫 ${UL_TICKET.rate}`,  desc: '울트라 티켓으로 바꿔 개벽 파칭코를 돌린다' },
];

export const TICKET_LINE = `운동 ${TICKET_RULE.perWorkouts}회당 1장, 인바디 ${TICKET_RULE.perInbody}회당 1장`;
// 원판 피하기로도 티켓을 산다. 하루 판 수(dailyPlays)는 개발 빌드에서 풀려 있어 여기 적지 않는다
export const PLATE_LINE = `원판 ${PLATE_RULE.perTicket}개를 모으면 티켓 1장`;
export const EXP_LINE = `운동 기록 하나에 ${EXP_PER.workout}, 인바디 하나에 ${EXP_PER.inbody}`;
// 하루 판 수는 운영 값을 읽는다 (PLATE_RULE.dailyPlays 는 개발 빌드에서 풀려 있다)
export const PLAY_LINE = `하루 ${BASE_DAILY_PLAYS}판, 한 판에 부활 ${PLATE_RULE.revives}번`;

export function useIntroStats() {
  const { workouts, fetchAll: fetchWorkouts } = useWorkoutStore();
  const { records, fetchAll: fetchInbody } = useInbodyStore();
  const pachinkoExp = usePachinkoStore(s => s.gained);

  useEffect(() => { fetchWorkouts(); fetchInbody(); }, []);

  const totalWorkouts = useMemo(() => Object.values(workouts).flat().length, [workouts]);
  const totalInbody = records.length;

  const week = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = dateKey(d);
      return { key, done: !!workouts[key]?.length };
    });
  }, [workouts]);

  const lv = getLevelInfo(calcExp(totalWorkouts, totalInbody, pachinkoExp));

  return {
    totalWorkouts, totalInbody,
    latest: records[0] || null,
    week, weekDays: week.filter(d => d.done).length,
    lv, maxLevel: MAX_LEVEL,
    todayDone: !!workouts[dateKey()]?.length,
  };
}
