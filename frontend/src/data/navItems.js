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
// **옛 화면 둘은 되돌릴 수 있게 남겨둔다** — 새 「운동」이 아직 못 하는 것이 있다
// (고치기 · 지우기 · 지난 날짜에 적기). 5차를 마치면 이 둘을 걷는다.
//
// 이 목록을 **머리의 내 계정 시트**(`AccountSheet`)와 **PC 사이드바**(`TabBar`)가
// 같이 쓴다. 두 벌로 적으면 한쪽에만 새 줄이 생기는 날이 온다.
export const DRAWER_ITEMS = [
  { path: '/homeworkout', label: '기능성운동', icon: 'homegym' },
  { path: '/reminders',  label: '운동 알림',  icon: 'bell' },
  { path: '/community',  label: '커뮤니티',   icon: 'chat' },
  { path: '/support',    label: '고객센터',   icon: 'inbox' },
  { path: '/intro',      label: '앱 소개',    icon: 'bulb' },
  { path: '/workout',    label: '옛 기록',    icon: 'dumbbell' },
  { path: '/routine',    label: '옛 루틴',    icon: 'clipboard' },
  { path: '/admin',      label: '관리자',     icon: 'gear', adminOnly: true },
];
