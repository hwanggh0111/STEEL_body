import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MiniSplash from './MiniSplash';
import Logo from './Logo';
import NavIcon from './NavIcon';
import { isAdmin } from '../data/admin';
import { useIsPC } from './useIsPC';
import { usePendingReports } from './usePendingReports';
import { DRAWER_ITEMS, PARENT_OF } from '../data/navItems';
import { LAYER } from '../data/layers';

// 아이콘은 이모지가 아니라 직접 그린 선이다 (NavIcon.jsx). 이모지 그림은 폰 만든
// 회사 것이라 남의 것이고, 폰마다 다르게 나온다 — 금색 화면에 파란 종이 뜬다
const TABS = [
  // 5차 리모델링 (2026-09-04) — **기능 이름이 아니라 하는 일로 나눈다.**
  //   오늘  무엇을 하면 되는지        운동  고르고 · 찾고 · 적는다
  //   몸    재고 견준다                기록  되짚는다
  // 루틴은 「운동」 안에서 시작하고, 인바디 · 측정 · 견주기는 「몸」 안에 있다
  //
  // **6차 (2026-09-16) — 탭 하나가 질문 하나에 답한다.**
  //
  //   오늘  오늘 뭘 하지?      운동  지금 적는다
  //   기록  얼마나 왔지?       몸    몸이 달라졌나?
  //
  // 「HOME」을 「오늘」로 바꿨다. 집 그림은 「여기가 첫 화면」만 말하고 그 안에 무엇이
  // 있는지는 안 알려준다. 첫 화면이 실제로 하는 일은 **오늘 무엇을 할지 말하는 것**이다.
  // 그 자리에 몸 지도가 첫 카드로 올라왔고, 방금 끝낸 운동의 결산도 여기서 다시 본다.
  //
  // 차례도 바꿨다 — **하루의 차례**다. 오늘 뭘 할지 보고(오늘) · 하면서 적고(운동) ·
  // 되짚고(기록) · 가끔 몸을 잰다(몸). 앞서는 「몸」이 「기록」보다 앞이었는데,
  // 몸을 재는 일은 넷 중에 제일 드물게 한다.
  //
  // **7차 (2026-09-17) — 「기구」를 넣었다.**
  //
  //   오늘  오늘 뭘 하지?      운동  지금 적는다      기구  이 기구 어떻게 맞췄더라?
  //   기록  얼마나 왔지?       몸    몸이 달라졌나?
  //
  // 기구 세팅은 처음에 「운동」 화면 안에만 뒀다. 그런데 그러면 **운동을 고른 뒤에야
  // 보인다** — 「내가 뭘 적어뒀더라」를 보려면 운동을 하나씩 골라봐야 했다.
  // 적어둔 것을 한눈에 볼 자리가 없으면 적어둘 마음도 안 생긴다.
  //
  // 탭을 늘리는 것은 이 앱이 계속 거절해 온 일이다(길이 여러 벌이 된다). 여기서는
  // 늘린다 — **「운동」 안의 세팅 카드와 이 탭은 같은 것을 다르게 묻는다.**
  //   · 운동 안: 「지금 이 기구를 어떻게 맞추지?」 (하나)
  //   · 기구 탭: 「내가 무엇을 적어뒀지?」 (전부)
  // 둘이 같은 자리로 가는 두 벌의 길이 아니라, 하나와 전부다.
  //
  // **8차 (2026-09-19) — 「기구」를 뺐다.**
  //
  //   오늘  오늘 뭘 하지?      운동  지금 적는다
  //   기록  얼마나 왔지?       몸    몸이 달라졌나?
  //
  // 7차에 늘린 지 이틀 만이다. 이유는 위 7차 주석에 이미 적혀 있었다 —
  // **「탭을 늘리는 것은 이 앱이 계속 거절해 온 일이다」.** 거절했어야 했다.
  // 기구 세팅은 **하루의 축이 아니라 「운동」의 곁다리 질문**이다(이 기구 어떻게
  // 맞췄더라). 나머지 넷은 각자 하루의 한 토막에 답하는데 이것만 그렇지 않았다.
  //
  // **걷은 것은 탭 칸이고 화면이 아니다.** `/gym` 은 그대로 있고, 「운동」 화면의
  // 기구 세팅 카드에서 「적어둔 것 전부」로 들어간다 — 원래 그 질문이 나오는 자리다.
  // 다섯째 칸은 **비워 둔다**: 채울 것을 정하기 전에 억지로 채우면 7차를 되풀이한다.
  { path: '/home',    label: '오늘',  icon: 'body' },
  { path: '/train',   label: '운동',  icon: 'dumbbell' },
  { path: '/history', label: '기록',  icon: 'calendar' },
  { path: '/body',    label: '몸',    icon: 'chart' },
  // **「더보기」 칸을 걷었다** (5차 리모델링, 2026-09-04).
  //
  // 서랍이 둘이었다 — 아래의 더보기와 머리의 내 계정. 둘 다 「가끔 쓰는 것」을 담는
  // 자리라서, 무엇이 어느 쪽에 있는지를 사람이 외워야 했다 (운동 알림은 더보기,
  // 비밀번호는 내 계정). **서랍은 하나면 된다** — 머리의 내 계정이다.
  // 아래 넷은 늘 쓰는 것만 남는다.
];

// **한 화면에 한 줄이다.**
//
// 9/3 까지 여기에 「기능성운동」과 「특수부대식」이 나란히 있었다. 둘 다 `/homeworkout`
// 으로 가고, 뒤엣것은 여섯 프로그램 중 하나를 펼쳐 놓기만 했다 — **눌러보면 같은
// 화면이다.** 여섯 중 하나만 지름길을 갖는 것도 이유가 없다(다른 다섯은 없다).
// 메뉴에 같은 곳으로 가는 줄이 둘 있으면, 쓰는 사람은 둘이 다른 것인 줄 알고 눌러본다.
// 그래서 지름길 줄을 지웠다 — 프로그램은 그 화면에서 고른다

// ─── 통일 디자인 토큰 ──────────────────
const NAV_TOKENS = {
  iconSize: 22,
  iconSizeSmall: 20,
  labelSize: 11,
  labelLetterSpacing: 1,
  labelFont: "'Bebas Neue', 'BI Sans KR', sans-serif",
  paddingY: 10,
  paddingX: 16,
  activeBarSize: 24,
};


// ── **탭바는 제 높이를 알린다** ── (2026-11-19 · 맵시)
//
// 바닥에 떠 있는 것이 셋이다 — 휴식 띠(`bottom: 60`) · 알림(`80`) · 위로 가기(`90`).
// 그 수들은 **탭바 높이 60 을 짐작해서 적은 것**이다. 그런데 탭바 높이는 **글자
// 크기에 따라 자란다**: 기본에서 이미 **64.6px**(여백 10+10 · 아이콘 22 · 틈 4 ·
// 이름 17.6 · 테두리 1)이고, 폰에서 글자를 150% 로 쓰면 ~70, 200% 면 ~82 가 된다.
//
// 그러면 **탭바가 띠를 덮는다**(층이 탭바 9999 > 띠 9998 이다) — 200% 에서 22px 을
// 덮고, 띠 아래 9~13px 에 있는 **쉬는 시간 진행 막대가 통째로 가려진다.** 알림도
// 탭바와 겹쳐 읽기 어려워진다.
//
// 그래서 **짐작을 걷고 실제 높이를 잰다.** 재서 `--tabbar-h` 에 적으면 바닥에 뜨는
// 것들이 그 값에서 올라간다 — 글자를 키우면 탭바와 함께 따라 올라간다.
// PC 는 사이드바라 아래가 비니 **0** 이다.
const 탭바높이알리기 = (px) => {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--tabbar-h', px + 'px');
};
// 탭바가 사라질 때는 **치운다.** `Layout` 은 로그인한 사람만 쓰므로 로그아웃하면
// 이 바가 통째로 없어지는데, 적어둔 높이가 뿌리에 남으면 **탭바가 없는 로그인
// 화면에서도 알림이 그만큼 떠 있다**(글자를 크게 쓰는 사람은 100px 넘게 뜬다)
const 탭바높이치우기 = () => {
  if (typeof document === 'undefined') return;
  document.documentElement.style.removeProperty('--tabbar-h');
};

// ── **자판이 올라오면 탭바가 자판 위에 남아 칸을 덮었다** ── (2026-11-25 · 맵시)
//
// 폰에서 글 칸을 누르면 자판이 화면 아래 절반을 먹는다. 탭바는 `fixed; bottom: 0` 이라
// **자판 바로 위로 따라 올라와** 65px 을 또 먹는다 — 높이 380 으로 흉내 내 보니 목표 화면
// 「체지방률」 칸이 탭바 밑에 **통째로 가려졌다.** 브라우저는 누른 칸이 보이게 굴려 주지만
// 고정 막대가 있다는 것은 모른다.
//
// 자판이 떠 있는 동안 탭을 누를 일은 없다 — **쓰는 동안만 탭바를 걷는다.** 걷으면 위
// 측정이 높이를 0 으로 알려 바닥 여백도 같이 줄어든다(쓸 자리가 그만큼 는다).
// 손가락 기기(`pointer: coarse`)에서만이다 — PC 는 자판이 화면을 안 먹는다.
// 자판이 안 뜨는 칸(체크 · 라디오 · 날짜 · 색 · 파일 · 고르기)은 안 센다 — 그 칸을
// 누를 때마다 탭바가 깜빡이면 그게 더 이상하다
const 자판칸 = (el) => {
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return !el.readOnly;
  if (el.tagName !== 'INPUT' || el.readOnly || el.disabled) return false;
  const t = (el.getAttribute('type') || 'text').toLowerCase();
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden',
    'date', 'time', 'month', 'week', 'datetime-local'].includes(t);
};
function use쓰는중(꺼짐) {
  const [쓰는중, set쓰는중] = useState(false);
  useEffect(() => {
    if (꺼짐 || typeof window === 'undefined' || !window.matchMedia) return undefined;
    const 손가락 = window.matchMedia('(pointer: coarse)');
    const 보기 = () => set쓰는중(손가락.matches && 자판칸(document.activeElement));
    // `focusout` 직후에는 아직 다음 칸으로 안 옮겨 갔다 — 한 박자 뒤에 본다.
    // 안 그러면 칸에서 칸으로 넘어갈 때마다 탭바가 한 번씩 튀어나온다
    let t = 0;
    const 나감 = () => { clearTimeout(t); t = setTimeout(보기, 0); };
    document.addEventListener('focusin', 보기);
    document.addEventListener('focusout', 나감);
    return () => {
      clearTimeout(t);
      document.removeEventListener('focusin', 보기);
      document.removeEventListener('focusout', 나감);
    };
  }, [꺼짐]);
  return 꺼짐 ? false : 쓰는중;
}

export default function TabBar() {
  const [splash, setSplash] = useState(false);
  const navRef = useRef(null);

  // ── ★ **글자를 키운 사람에게만 탭 이름을 접는다** ── (2026-11-20 · 시안 1120 ④)
  //
  // 탭바 높이는 기본 **64.6px** 인데 폰에서 글자를 150% 로 쓰면 ~70, 200% 면 ~82 가 된다
  // (`NAV_TOKENS.labelSize: 11` 이 22 로 자란다). 그만큼 **바닥에 뜨는 것이 전부 밀리고**
  // (띠 · 알림 · 「맨 위로」 — 11/19·11/20 에 그 셋을 다 고쳤다) 화면도 그만큼 줄어든다.
  //
  // 시안 ④ 의 A 안(가운데 큰 단추)은 **길 이름이 바뀌어** 익은 사람이 헤매고, B 안
  // (아이콘만)은 **처음 쓰는 사람에게 아이콘 넷을 외우게** 한다. 그래서 중간으로 간다 —
  // **기본 크기에서는 지금과 한 글자도 다르지 않고**, 글자를 키운 사람에게만 접는다.
  //
  // ★ **배율을 묻지 않고 잰다.** 웹에서 「글자 크기 200%」라는 수는 읽을 길이 없다.
  // 그리고 **탭바 높이(`--tabbar-h`)로 재지 않는다** — 접으면 그 높이가 줄어 다시 펴지고,
  // 펴면 또 커져 **떨린다**(정석이 짚은 자리). 대신 **라벨 글자의 실제 px** 를 잰다:
  // 그 값은 **접어도 안 변하므로** 떨 자리가 없다. 11 이 기본이고 150% 면 ~16.5,
  // 200% 면 22 다 — **15.5** 를 넘으면 접는다(150% 를 담는 선이다).
  const 라벨잣대 = useRef(null);
  const [이름접기, set이름접기] = useState(false);
  useEffect(() => {
    const el = 라벨잣대.current;
    if (!el || typeof window === 'undefined') return undefined;
    const 재기 = () => {
      const px = parseFloat(window.getComputedStyle(el).fontSize) || 0;
      // 0 이 나오면(못 쟀다) **접지 않는다** — 모를 때는 이름을 보이는 쪽이 안전하다
      if (px > 0) set이름접기(px > 15.5);
    };
    재기();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(재기);
    if (ro) ro.observe(el);
    window.addEventListener('resize', 재기);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', 재기);
    };
  }, []);
  const [isAdminUser, setIsAdminUser] = useState(isAdmin());
  const location = useLocation();
  const navigate = useNavigate();
  const isPC = useIsPC();
  // 자판이 떠 있는 동안은 탭바를 걷는다 (위 `use쓰는중` 머리글)
  const 쓰는중 = use쓰는중(isPC);
  // 손볼 제보가 있으면 관리자 항목에 숫자를 붙인다 — 화면을 열어봐야만 알던 것이다
  const pending = usePendingReports();

  // 재서 알린다 — 글자 크기 · 가로세로 돌리기 · 안전 영역이 바뀌면 다시 잰다.
  // `ResizeObserver` 를 쓰는 까닭은 **글자 크기 바뀜에는 이벤트가 없다**는 것이다
  // (`resize` 는 창 크기만 알려준다)
  useEffect(() => {
    if (isPC) { 탭바높이알리기(0); return 탭바높이치우기; }
    const el = navRef.current;
    if (!el) return 탭바높이치우기;
    const 재기 = () => 탭바높이알리기(Math.round(el.getBoundingClientRect().height));
    재기();
    if (typeof ResizeObserver === 'undefined') return 탭바높이치우기;
    const ro = new ResizeObserver(재기);
    ro.observe(el);
    return () => { ro.disconnect(); 탭바높이치우기(); };
  }, [isPC]);

  // 관리자 권한 변경 감지 (다른 탭에서 로그인/로그아웃 시)
  useEffect(() => {
    const handler = () => setIsAdminUser(isAdmin());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // 권한 기반 메뉴 필터링
  const moreItems = useMemo(
    () => DRAWER_ITEMS
      .filter(i => !i.adminOnly || isAdminUser)
      .map(i => (i.path === '/admin' ? { ...i, badge: pending.total } : i)),
    [isAdminUser, pending.total]
  );

  const handleTab = (path) => {
    if (path === '/home' && location.pathname === '/home') return;
    if (path === '/home') {
      setSplash(true);
      return;
    }
    navigate(path);
  };

  // 하위 주소도 그 항목으로 친다 — /support/notices(공지함)에서 더보기가 꺼져 있으면
  // 지금 어디에 있는지가 아무 데도 안 뜬다
  const onPath = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  // 한 화면에 한 줄이라 주소만 보면 된다. 예전에는 같은 화면으로 가는 줄이 둘이라
  // (홈트 목록 · 특수부대식 바로가기) 물음표 뒤까지 봐야 어느 쪽인지 갈렸다.
  // **줄을 지우니 그 갈래도 없어졌다** — 화면의 `?p=` 길은 그대로 남는다
  // (다른 데서 걸어주는 링크가 그 길로 온다)
  const goTo = (item) => item.path + (item.param ? '?p=' + encodeURIComponent(item.param) : '');
  const onItem = (item) => onPath(item.path);

  // ── 탭 밖에서 열리는 화면은 **자기를 열어준 탭을 켠다** ── (2026-09-19)
  //
  // 여태 `/goal` · `/map` · `/search` · `/homeworkout` 에서는 **아래 다섯 칸 중
  // 아무것도 안 켜졌다.** 그 자리에 선 사람은 자기가 어디에 있는지 알 수 없고,
  // 옆으로 건너갈 실마리도 없다 — 뒤로 가기밖에 없다.
  // (9/18 에 홈의 인바디 줄을 옛 단독 화면에서 「몸」 탭으로 돌린 이유가 이것이었다.
  //  그때는 그 한 줄만 고쳤고, 같은 일이 네 화면에 남아 있었다.)
  //
  // **서랍 화면(`/support` · `/reminders` · `/settings` · `/admin` …)은 여기 없다** —
  // 켤 탭이 아예 없다. 그쪽은 PC 사이드바에서 자기 줄이 켜지고, 폰에서는 **머리의
  // 길 줄**이 이름과 나가는 길을 댄다 (2026-10-16, `Layout` 과 `data/navItems.js`).
  //
  // **이 짝은 `data/navItems.js` 에 있다** — 머리의 길 줄이 같은 것을 본다.
  // 여기 한 벌 더 적으면 머리는 「설정함」이라 하고 탭은 딴 데가 켜지는 날이 온다.

  const isActive = (path) => {
    if (onPath(path)) return true;
    // 지금 자리가 탭 밖이면 그 부모 탭을 켠다
    const here = Object.keys(PARENT_OF).find((child) => onPath(child));
    return Boolean(here && PARENT_OF[here] === path);
  };

  // ─── 공통 셀 컴포넌트 (모양/크기 통일) ───
  //
  // ── **앱의 주 길찾기가 자판으로 하나도 안 눌렸다** ── (2026-11-11)
  //
  // 이 칸은 `<div onClick>` 이었다. 마우스와 손가락으로는 눌리니 **아무도 몰랐다** —
  // 그런데 탭 키로는 **멈추지도 않고**, 읽어주는 기계에는 「눌리는 것」이라고
  // 알려주지도 않았다. 다섯 탭이 전부 그랬으니 **자판만 쓰는 사람은 이 앱에서
  // 화면을 하나도 옮길 수 없었다**(뒤로 가기와 주소창뿐이다).
  //
  // 홈의 주간 달력 칸을 같은 까닭으로 고쳤는데(11/11 아침), 그때 **이 자리를 안
  // 봤다.** 그쪽은 눌러서 하루를 보는 곁길이고 **여기는 주 길찾기**다 — 순서가
  // 거꾸로였다. 정석이 전수로 세어 29건을 넘겼고 그 첫 건이 이것이다.
  //
  // **`<button>` 으로 바꾼다.** `role`·`tabIndex`·Enter/Space 를 손으로 흉내 내는
  // 것보다 **원래 단추인 것**을 쓰는 것이 맞다 — 자판·낭독기·돋보기가 다 안다.
  // 단추의 기본 꼴(테두리 · 글자꼴 · 배경)은 지우고, `border: 'none'` 을 **먼저**
  // 적어 그 뒤의 `borderLeft`(고른 자리의 금색 선)가 살아남게 한다.
  //
  // `aria-current="page"` 는 **지금 어디인지**를 읽어준다 — 금색은 눈으로만 보인다.
  // 안 읽은 수(badge)는 이름에 같이 넣는다. 「고객센터」만 읽히면 빨간 동그라미에
  // 적힌 3 은 전해지지 않는다.
  const NavCell = ({ item, active, onClick, layout = 'vertical', 이름숨김 = false }) => (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      /* ★ **이름을 늘 들려준다** (2026-11-20). 여태 `badge > 0` 일 때만 있었다 —
         이름을 접으면 **나머지 탭은 이름이 통째로 사라진다**(아이콘만 남는다).
         보이든 접히든 낭독기에는 같은 말이 가야 한다 (정석이 짚었다) */
      aria-label={item.badge > 0 ? `${item.label}, 안 읽은 ${item.badge}` : item.label}
      style={{
        display: 'flex',
        flexDirection: layout === 'vertical' ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: layout === 'vertical' ? 4 : 12,
        width: '100%',
        padding: layout === 'vertical' ? `${NAV_TOKENS.paddingY}px 4px` : `${NAV_TOKENS.paddingY}px ${NAV_TOKENS.paddingX}px`,
        // ★ **접으면 과녁이 44 아래로 내려간다** (2026-11-20 · 정석이 경고한 자리).
        // 이름이 있을 때는 여백 20 + 아이콘 22 + 틈 4 + 이름 17.6 = 64.6 이라 넉넉한데,
        // 이름을 접으면 **20 + 22 = 42** 다. 폰의 「글자 크기」는 **글자만** 키우므로
        // 여백 10 과 아이콘 22 는 그대로다 — 즉 접은 뒤에는 늘 42 다.
        // 그래서 세로 칸에 **바닥을 깐다.** 이름이 있을 때는 이미 그보다 커서 아무 일도
        // 안 한다 (`check-tap` 이 44 를 지킨다)
        minHeight: layout === 'vertical' ? 48 : undefined,
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.15s',
        font: 'inherit',
        color: 'inherit',
        appearance: 'none',
        border: 'none',
        borderLeft: layout === 'horizontal' && active ? '3px solid var(--accent)' : '3px solid transparent',
        background: active ? 'var(--accent-dim)' : 'none',
        borderRadius: layout === 'vertical' ? 'var(--radius)' : 0,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'none'; }}
    >
      {/* 모바일 상단 active bar */}
      {layout === 'vertical' && active && (
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: NAV_TOKENS.activeBarSize, height: 2, background: 'var(--accent)', borderRadius: 1,
        }} />
      )}
      <span style={{
        // 선으로 그린 아이콘이라 색이 글자를 따라온다 — 고른 자리에서 금색이 된다
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        opacity: active ? 1 : 0.85,
        transition: 'opacity 0.15s, transform 0.15s, color 0.15s',
        transform: active ? 'scale(1.05)' : 'scale(1)',
        lineHeight: 1,
        position: 'relative',
      }}>
        <NavIcon name={item.icon} size={NAV_TOKENS.iconSize} />
        {item.badge > 0 && (
          // ── **글자를 크게 쓰는 사람에게는 수가 잘렸다** ── (2026-11-17 · 맵시)
          //
          // `height: 16` · `lineHeight: '16px'` 로 **칸을 못 자라게 묶어뒀다.**
          // 크롬(안드로이드)의 「글자 크기」는 `px` 로 적은 글자도 같이 키운다 —
          // 글자 크기 200% 면 `fontSize: 10` 이 20 이 되는데 칸은 **16 에 그대로
          // 있어** 수가 위아래로 잘린다. 알림 수는 **놓치면 안 되는 수**다.
          //
          // `minHeight` 로 바꾸고 줄 높이를 1 로 둔 뒤 가운데 맞춤은 flex 에 맡긴다 —
          // 기본 글자 크기에서는 **지금과 한 픽셀도 다르지 않고**(10px 글자 + 위아래
          // 여백 3 = 16), 글자가 커지면 알약이 따라 자란다. `borderRadius: 999` 로
          // 두면 자란 뒤에도 알약 꼴이 유지된다(8 로 두면 네모에 가까워진다)
          <span style={{
            position: 'absolute', top: -4, right: -8,
            minWidth: 16, minHeight: 16, padding: '0 4px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 999, background: 'var(--danger-strong)', color: 'var(--on-danger)',
            fontSize: 11, fontWeight: 700, lineHeight: 1, textAlign: 'center',
            fontFamily: "'Barlow', 'BI Sans KR', sans-serif",
          }}>{item.badge > 99 ? '99+' : item.badge}</span>
        )}
      </span>
      {/* 이름. 글자를 키운 사람에게는 **접는다** — 그래도 `aria-label` 로 들린다.
          `hidden` 으로 끄는 것은 집안 꼴이다(`globals.css` 의 `[hidden]`) */}
      <span hidden={이름숨김} style={{
        fontFamily: NAV_TOKENS.labelFont,
        fontSize: NAV_TOKENS.labelSize,
        letterSpacing: NAV_TOKENS.labelLetterSpacing,
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        transition: 'color 0.15s',
        whiteSpace: 'nowrap',
      }}>{item.label}</span>
    </button>
  );

  // ─── PC: 좌측 사이드바 ───
  if (isPC) {
    return (
      <>
        {splash && <MiniSplash onDone={() => { setSplash(false); navigate('/home'); }} />}

        <nav aria-label="메인 네비게이션" style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: 200,
          background: 'var(--surface)',
          backdropFilter: 'var(--surface-blur)',
          WebkitBackdropFilter: 'var(--surface-blur)',
          borderRight: '1px solid var(--border)',
          zIndex: LAYER.탭바,
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* 로고 영역 */}
          <div style={{
            padding: '20px 16px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <Logo cap={19} style={{ cursor: 'pointer' }} onClick={() => handleTab('/home')} />
          </div>

          {/* 메인 탭 */}
          <div style={{ flex: 1, padding: '8px 0' }}>
            {TABS.map(tab => (
              <NavCell
                key={tab.path}
                item={tab}
                active={isActive(tab.path)}
                onClick={() => handleTab(tab.path)}
                layout="horizontal"
              />
            ))}

            {/* 구분선 */}
            <div style={{
              height: 1, background: 'var(--border)',
              margin: '8px 16px',
            }} />

            {/* 더보기 항목들 */}
            <div>
              <div style={{
                padding: '8px 20px 4px',
                fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif",
                fontSize: 11, letterSpacing: 1.5,
                color: 'var(--text-muted)',
              }}>더보기</div>
              {moreItems.map(item => (
                <NavCell
                  key={item.path + (item.param || '')}
                  item={item}
                  active={onItem(item)}
                  onClick={() => navigate(goTo(item))}
                  layout="horizontal"
                />
              ))}
            </div>
          </div>
        </nav>
      </>
    );
  }

  // ─── 모바일: 하단 탭바 + 더보기 패널 ───
  return (
    <>
      {splash && <MiniSplash onDone={() => { setSplash(false); navigate('/home'); }} />}

      {/* 하단 탭바 */}
      <nav ref={navRef} aria-label="하단 네비게이션" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)',
        backdropFilter: 'var(--surface-blur)',
        WebkitBackdropFilter: 'var(--surface-blur)',
        borderTop: '1px solid var(--border)',
        zIndex: LAYER.탭바,
        // 쓰는 동안은 걷는다 — 높이 측정이 0 을 알려 바닥 여백도 같이 빠진다
        display: 쓰는중 ? 'none' : 'flex', justifyContent: 'center',
        // 아이폰 홈바 · 안드로이드 제스처 바가 탭을 덮지 않게 (2026-10-05).
        // 지금은 대개 0 이라 아무 일도 안 한다
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div style={{
          display: 'flex', width: '100%', maxWidth: 'var(--max-width)',
        }}>
          {/* ★ 라벨 글자를 재는 **보이지 않는 잣대**다 (위 머리글). 탭 이름과 **같은
              글꼴·같은 크기**로 두어야 같은 값이 읽힌다. 접혀도 이 칸은 늘 있으므로
              잣대가 사라지지 않는다 — 그래서 떨지 않는다 */}
          <span ref={라벨잣대} aria-hidden="true" style={{
            position: 'absolute', width: 1, height: 1, overflow: 'hidden',
            clip: 'rect(0 0 0 0)', pointerEvents: 'none',
            fontFamily: NAV_TOKENS.labelFont,
            fontSize: NAV_TOKENS.labelSize,
            letterSpacing: NAV_TOKENS.labelLetterSpacing,
          }}>가</span>
          {TABS.map(tab => (
            <div key={tab.path} style={{ flex: 1 }}>
              <NavCell
                item={tab}
                active={isActive(tab.path)}
                onClick={() => handleTab(tab.path)}
                layout="vertical"
                이름숨김={이름접기}
              />
            </div>
          ))}
        </div>
      </nav>

      <style>{`
        @keyframes moreSlide {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
