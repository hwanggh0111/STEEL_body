import { useEffect, useMemo } from 'react';
// 「가장 최근」을 고르는 손 (2026-11-05)
import { latestInbody } from '../../data/inbodyLatest';
import { useWorkoutStore } from '../../store/workoutStore';
import { useInbodyStore } from '../../store/inbodyStore';
// `dateKey` 를 안 부른다 — 이 파일이 보는 오늘은 `useToday` 하나뿐이다 (2026-11-17)
import { upToToday, atDay } from '../../data/dateKey';
// 자정을 따라가는 오늘 · 주를 세는 자 — 홈과 **같은 손**을 쓴다 (2026-11-17)
import { useToday } from '../../data/useToday';
import { mondayOf, weekKeys } from '../../data/weeklyReport';

// 고객센터가 보여주는 숫자를 한 군데서 만든다.
// 화면마다 따로 계산하면 어느 순간 한 곳만 옛날 값을 보여주게 된다.

// 무엇을 할 수 있나. **가는 주소가 실재해야 한다** —
// 5차 리모델링(2026-09-04)에서 화면 자리가 바뀌었다. 목록이 옛 주소를 가리키면
// 소개를 읽고 눌러본 사람이 없어진 자리로 간다.
//   기록 · 검색 · 기능성운동 → 「운동」  ·  인바디 · 측정 → 「몸」  ·  달력 → 「기록」
export const FEATURES = [
  { name: '운동 기록',   path: '/train',   icon: 'dumbbell',  short: '무게 · 횟수 · 세트',     long: '무게 · 횟수 · 세트를 남긴다. 지난 기록이 옆에 떠서 오늘 얼마나 올릴지 바로 안다. 폰을 옆에 세워두면 횟수를 대신 세어준다' },
  { name: '루틴 따라가기', path: '/train', icon: 'clipboard', short: '고르고 · 이어서',        long: '짜둔 루틴을 그 자리에서 시작한다. 지금 할 운동이 진행표에 뜨고, 한 번 적으면 다음으로 넘어간다' },
  { name: '운동 검색',   path: '/train',   icon: 'search',    short: '이름 · 초성 · 부위로',   long: '앱 안의 운동 사전에서 바로 찾는다. 초성으로도, 부위 이름으로도 찾는다. 적던 것은 안 끊긴다' },
  { name: '기능성운동',  path: '/homeworkout', icon: 'homegym', short: '집에 있는 것으로',     long: '운동기구 없이 의자 · 수건 · 배낭으로 한다. 무엇이 필요한지를 고르기 전에 적어둔다' },
  // 몸 지도는 「몸」이 아니라 제 화면이다 (2026-09-16). 오늘 할 일을 말하는 화면이라
  // 「오늘」 탭 첫 카드에서 들어간다
  { name: '몸 지도',     path: '/map',     icon: 'body',      short: '어디가 식었나',          long: '최근에 자극한 부위가 금빛으로 달아 있고 며칠 지나면 식는다. 오늘 어디를 할지 몸을 보고 정한다' },
  { name: '인바디',      path: '/body',    icon: 'chart',     short: '체중 · 체지방 · 골격근', long: '체중 하나만 적어도 그래프가 이어진다. 지난번과 견줘 무엇이 어느 쪽으로 갔는지 말해준다' },
  { name: '재는 도구',   path: '/body',    icon: 'ruler',     short: '사이즈 · 1RM · 체력',    long: '전신 사이즈 · 1RM · 체력 테스트 · 유연성까지 한곳에', state: { tab: 'measure' } },
  // ── 아래 둘은 2026-09-30 에 더했다 ──
  // 9/22~9/30 에 앱에 붙었는데 **이 목록이 그것을 모르고 있었다.** 소개를 읽은 사람은
  // 있는 기능을 없는 줄 알고 지나간다 — 없는 자리로 보내는 것과 같은 종류의 잘못이다
  { name: '체형 읽기',   path: '/body',    icon: 'body',      short: '사진으로 비율을',        long: '사진을 올리면 그 사진에서 잰 비율로 실루엣을 다시 그린다. 분석은 폰 안에서 끝나고, 견주는 상대는 지난 번의 나다', state: { tab: 'shape' } },
  { name: '회복 시간',   path: '/body',    icon: 'chart',     short: '숨이 가라앉는 초',       long: '동작이 끝나고 숨이 가라앉는 데 걸린 초를 잰다. 같은 동작 뒤에 그 초가 줄면 전보다 덜 힘들어진 것이다 (홈트에서 숨을 켜두면 쌓인다)', state: { tab: 'recover' } },
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

  // ── ★ **고객센터의 수 셋도 앞날 줄을 셌다** ── (2026-11-10)
  //
  // 이 파일은 11/05 에 `latest`(가장 최근 인바디)만 걸렀다. 세는 자리 셋은 안 걸렀다 —
  // 「지금까지 N회 적었다」 · 「이번 주만 N일 나왔다」. 기록 화면 통계 칸(11/09)과 홈
  // 줄(11/10)을 고친 뒤라 **같은 앱이 세 수를 말하고 있었다.**
  //
  // 「지금까지」 · 「나왔다」는 **한 것**을 말하는 말이다. 앞날에 담아둔 계획이 거기
  // 세어지면 그 문장이 거짓이 된다. 주는 `data/goal.js` 의 `doneIn` 과 같은 선을 쓴다
  // ── ★ **이 화면은 날이 바뀌어도 어제를 셌다** ── (2026-11-17)
  //
  // `dateKey()` 는 **부를 때의 기기 시계**다. 이 훅은 기록이 바뀔 때만 다시 도므로,
  // 고객센터를 띄워둔 채 자정을 넘기면 「이번 주만 N일 나왔다」와 주간 칸이 **어제
  // 기준**으로 남는다. 홈은 `useToday` 로 자정을 따라가는데 **여기만 안 따라갔다** —
  // 같은 앱이 두 날을 말한다(11/17 에 홈의 띠·요약에서 고친 그 류다).
  const today = useToday();
  const totalWorkouts = useMemo(
    () => upToToday(Object.keys(workouts), today)
      .reduce((n, k) => n + ((workouts && workouts[k]) || []).length, 0),
    [workouts, today],
  );
  const totalInbody = useMemo(
    () => (records || []).filter(r => !r?.date || r.date <= today).length,
    [records, today],
  );

  // ── ★ **주 경계를 제 손으로 세지 않는다** ── (2026-11-17)
  //
  // 여기에 **월요일을 찾는 셈이 따로 적혀 있었다** — `(now.getDay() + 6) % 7` 까지
  // `weeklyReport.mondayOf` 와 글자 그대로 같은 것이다. 그런데 그 셈이 읽는 것은
  // **또 다른 시계**(`new Date()`)였다: 위의 `today` 와 어긋나는 순간 **칸은 이번
  // 주인데 세는 수는 어제 기준**이 된다. 홈의 띠가 11/17 에 바로 그 꼴이었다.
  //
  // 그래서 **주를 세는 자 하나**를 부른다(`mondayOf`·`weekKeys` — 홈 띠 · 주간
  // 요약 · 목표가 쓰는 그것) 그리고 그것에 **`today` 를 먹인다.**
  const week = useMemo(() => weekKeys(mondayOf(atDay(today) || new Date())).map((key) => (
    // ★ 칸은 일곱 개 그대로 그린다(주간 달력이다). **앞날 칸만 「했다」로 안 켠다** —
    // 아래 `weekDays` 가 이 깃발을 세므로, 여기서 켜면 그 수가 미리 채워진다
    { key, done: key <= today && !!workouts[key]?.length }
  )), [workouts, today]);

  return {
    totalWorkouts, totalInbody,
    // 앞날 줄은 「가장 최근」이 아니다 (2026-11-05)
    latest: latestInbody(records, today).latest,
    week, weekDays: week.filter(d => d.done).length,
    // `dateKey()` 를 또 부르지 않는다 — 위 `today` 와 어긋나면 「오늘 했다」가
    // 주간 칸과 다른 날을 가리킨다 (2026-11-17)
    todayDone: !!workouts[today]?.length,
  };
}
