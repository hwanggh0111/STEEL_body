// 길찾기에 적히는 것들.
//
// **컴포넌트 파일에 두지 않는다.** 처음에는 `components/TabBar.jsx` 에서 내보냈는데,
// React Fast Refresh 는 컴포넌트 파일이 컴포넌트가 아닌 것을 같이 내보내면
// 그 파일을 고칠 때마다 **화면을 통째로 다시 그린다**(「export is incompatible」).
// 길찾기를 한 줄 고칠 때마다 보던 화면이 처음으로 돌아간다.
//
// 값만 있는 자리는 값만 있는 파일에 둔다.

// ── 서랍 ── (5차 리모델링, 2026-09-04)
//
// 늘 쓰는 것은 아래 탭바 넷에 있고(오늘 · 운동 · 몸 · 기록), 여기는 가끔 쓰는 것이다.
// 예전에는 「운동 검색」과 「관리자」가 같은 서랍에 있었다.
//
// 루틴 · 운동 검색 · 측정 · 인바디는 걷었다 — 탭바의 「운동」과 「몸」 안에 있다.
// 기능성운동은 아직 자기 화면이 필요해서 남긴다 (「운동」에서 열린다).
//
// **옛 화면 둘을 걷었다** (2026-09-18). 남겨둔 이유는 하나였다 — 새 「운동」이
// 고치기 · 지우기 · 지난 날짜에 적기를 못 했다. 그 셋이 「운동」 탭에 들어왔고,
// 루틴 고치기도 루틴 줄의 연필에서 열린다. 그래서 **같은 일을 하는 길이 하나가 됐다.**
//
// **라우트는 App.jsx 에 남겨둔다** — 북마크 · 폰 홈 화면 바로가기로 `/workout` ·
// `/routine` 을 직접 여는 사람이 있다. 걷은 것은 길찾기에 적힌 줄이다.
// (`/routine` 은 「운동」 탭의 「루틴 짜기」와 루틴 줄의 연필이 여는 자리라 살아 있다)
//
// 이 목록을 **머리의 내 계정 시트**(`AccountSheet`)와 **PC 사이드바**(`TabBar`)가
// 같이 쓴다. 두 벌로 적으면 한쪽에만 새 줄이 생기는 날이 온다.
export const DRAWER_ITEMS = [
  { path: '/homeworkout', label: '기능성운동', icon: 'homegym' },
  { path: '/reminders',  label: '운동 알림',  icon: 'bell' },
  // 아픈 곳 · 이 운동이 어디를 달굴지 (2026-09-30). **탭은 안 늘린다** —
  // 늘 쓰는 것은 탭바 넷에 있고, 이건 가끔 쓰는 것이라 서랍이 맞는 자리다
  { path: '/parts',      label: '부위',      icon: 'body' },
  // 소식 · 소개는 **여기 없다.** 소개는 홈페이지(`/site`)에, 소식(공지함)은
  // 고객센터 안에 있다. 서랍에 또 줄을 두면 같은 자리로 가는 길이 둘이 된다
  { path: '/support',    label: '고객센터',   icon: 'inbox' },
  { path: '/admin',      label: '관리자',     icon: 'gear', adminOnly: true },
];

// ── 탭 밖 화면 ── (2026-10-16)
//
// 탭은 넷이고(오늘 · 운동 · 기록 · 몸), 화면은 그보다 많다. 탭 밖 화면은 **두 갈래**다 —
//
//   · **탭의 자식** — 목표 · 몸 지도 · 운동 찾기 · 기능성운동 · 루틴 · 기구 세팅.
//     자기를 열어준 탭이 켜진다(`tab`). 9/19 에 붙인 규칙이다
//   · **서랍의 자식** — 설정함 · 고객센터 · 공지함 · 운동 알림 · 부위 · 관리자.
//     켜질 탭이 아예 없다(`tab: null`). PC 는 왼쪽 사이드바에 줄이 켜지지만
//     **폰에는 그 줄이 없다** — 서랍은 머리의 「내 계정」 시트 안에 있고 그 시트는 닫혀 있다
//
// 그래서 폰에서 서랍 화면에 서면 **아래 넷이 다 꺼져 있다.** 여기가 어디인지도,
// 어디로 돌아가는지도 화면에 없다 — 기기의 뒤로가기 하나뿐이다.
//
// **고친 방법은 머리에 한 줄**이다(`Layout` 의 길 줄). 탭 칸을 늘리지 않는다 —
// 9/19 에 「기구」를 뺄 때 적은 「탭을 늘리는 것은 이 앱이 계속 거절해 온 일이다」를
// 뒤집지 않는다. 그리고 이 한 줄은 서랍 여섯만이 아니라 **탭 밖 화면 열두 곳 전부**를
// 같이 고친다.
//
// **이름과 부모를 한 곳에 적는다.** 여태 부모 탭은 `TabBar` 안에만 있었고 이름은
// 아무 데도 없었다. 두 군데에 적으면 머리는 「설정함」이라 하고 탭은 딴 데가 켜지는
// 날이 온다.
export const SUBSCREENS = {
  // 탭의 자식 — 그 탭이 켜진다
  '/goal':       { label: '목표',       tab: '/home' },   // 홈의 목표 카드에서만 들어온다
  '/map':        { label: '몸 지도',    tab: '/home' },
  '/search':     { label: '운동 찾기',  tab: '/train' },
  '/homeworkout':{ label: '기능성운동', tab: '/train' },
  '/routine':    { label: '루틴',       tab: '/train' },
  '/gym':        { label: '기구 세팅',  tab: '/train' },
  // 서랍의 자식 — 켜질 탭이 없다
  '/settings':        { label: '설정함',    tab: null },
  '/support/notices': { label: '공지함',    tab: null },
  '/support':         { label: '고객센터',  tab: null },
  '/reminders':       { label: '운동 알림', tab: null },
  '/parts':           { label: '부위',      tab: null },
  '/admin':           { label: '관리자',    tab: null },
};

/**
 * 이 주소가 탭 밖 화면인가. 맞으면 `{ path, label, tab }`, 아니면 `null`.
 *
 * **긴 쪽이 이긴다** — `/support/notices` 는 「공지함」이고 「고객센터」가 아니다.
 * (`/support` 로도 걸리므로 차례만 믿으면 안 된다)
 */
export function screenOf(pathname) {
  const here = String(pathname || '');
  let best = null;
  for (const path of Object.keys(SUBSCREENS)) {
    if (here !== path && !here.startsWith(path + '/')) continue;
    if (!best || path.length > best.length) best = path;
  }
  return best ? { path: best, ...SUBSCREENS[best] } : null;
}

/** 탭 밖 화면 → 켜줄 탭. 서랍 화면은 들어 있지 않다 (켤 탭이 없다). */
export const PARENT_OF = Object.fromEntries(
  Object.entries(SUBSCREENS).filter(([, v]) => v.tab).map(([path, v]) => [path, v.tab]),
);
