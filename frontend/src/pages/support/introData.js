import { useEffect, useMemo } from 'react';
import { useWorkoutStore } from '../../store/workoutStore';
import { useInbodyStore } from '../../store/inbodyStore';
import { dateKey } from '../../data/dateKey';

// 고객센터가 보여주는 숫자를 한 군데서 만든다.
// 화면마다 따로 계산하면 어느 순간 한 곳만 옛날 값을 보여주게 된다.

// 무엇을 할 수 있나. **가는 주소가 실재해야 한다** —
// 5차 리모델링(2026-09-04)에서 화면 자리가 바뀌었다. 목록이 옛 주소를 가리키면
// 소개를 읽고 눌러본 사람이 없어진 자리로 간다.
//   기록 · 검색 · 기능성운동 → 「운동」  ·  인바디 · 측정 → 「몸」  ·  달력 → 「기록」
export const FEATURES = [
  { name: '운동 기록',   path: '/train',   icon: 'dumbbell',  short: '무게 · 횟수 · 세트',     long: '무게 · 횟수 · 세트를 남긴다. 지난 기록이 옆에 떠서 오늘 얼마나 올릴지 바로 안다' },
  { name: '루틴 따라가기', path: '/train', icon: 'clipboard', short: '고르고 · 이어서',        long: '짜둔 루틴을 그 자리에서 시작한다. 지금 할 운동이 진행표에 뜨고, 한 번 적으면 다음으로 넘어간다' },
  { name: '운동 검색',   path: '/train',   icon: 'search',    short: '이름 · 초성 · 부위로',   long: '앱 안의 운동 사전에서 바로 찾는다. 초성으로도, 부위 이름으로도 찾는다. 적던 것은 안 끊긴다' },
  { name: '기능성운동',  path: '/homeworkout', icon: 'homegym', short: '집에 있는 것으로',     long: '운동기구 없이 의자 · 수건 · 배낭으로 한다. 무엇이 필요한지를 고르기 전에 적어둔다' },
  { name: '인바디',      path: '/body',    icon: 'chart',     short: '체중 · 체지방 · 골격근', long: '체중 하나만 적어도 그래프가 이어진다. 지난번과 견줘 무엇이 어느 쪽으로 갔는지 말해준다' },
  { name: '재는 도구',   path: '/body',    icon: 'ruler',     short: '사이즈 · 1RM · 체력',    long: '전신 사이즈 · 1RM · 체력 테스트 · 유연성까지 한곳에', state: { tab: 'measure' } },
  { name: '기록 달력',   path: '/history', icon: 'calendar',  short: '되짚고, 미리 정하기',    long: '달력으로 되짚는다. 빠진 날이 눈에 보여야 안 빠진다. 그 날을 눌러 그 자리에서 적을 수도 있다' },
  { name: '운동 알림',   path: '/reminders', icon: 'bell',    short: '정한 요일과 시각에',     long: '정한 요일과 시각에 알린다. 그날 이미 적었으면 보내지 않는다' },
];

export function useIntroStats() {
  const { workouts, fetchAll: fetchWorkouts } = useWorkoutStore();
  const { records, fetchAll: fetchInbody } = useInbodyStore();

  // 한 화면에서 이 훅을 두 곳이 쓴다 — 고객센터 본문과 제보함의 기기 정보.
  // 각자 부르면 /workouts · /inbody 가 두 번씩 나가고, 늦게 온 응답이 먼저 온 것을 덮는다.
  // fetchAll 은 시작하면서 loading 을 켜므로, 켜져 있으면 진행 중인 요청에 얹힌다
  useEffect(() => {
    if (!useWorkoutStore.getState().loading) fetchWorkouts();
    if (!useInbodyStore.getState().loading) fetchInbody();
  }, []);

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

  return {
    totalWorkouts, totalInbody,
    latest: records[0] || null,
    week, weekDays: week.filter(d => d.done).length,
    todayDone: !!workouts[dateKey()]?.length,
  };
}
