import { useMemo, useState } from 'react';
import NavIcon from '../NavIcon';
import { useIsPC } from '../useIsPC';

// 홈페이지의 **앱 안내 지도** (2026-11-12).
//
// ── 왜 ──
//
// 위 「이 앱이 하는 것」은 **무엇을** 하는지 말한다. 그런데 들어가 본 사람이 제일
// 먼저 묻는 것은 **「그게 어디 있어요?」**다. 회복은 「몸」 탭의 다섯째 갈래 안에
// 있고, 목표는 홈의 카드를 눌러야만 들어간다 — **탭바에 없는 화면이 절반이다.**
// 글로 「몸 탭 → 회복」이라고 적어도 앱을 본 적 없는 사람은 그 자리를 못 그린다.
//
// 그래서 **폰을 한 장 그리고 그 위에서 고르게 한다.** 그림 속 탭을 누르면 화면이
// 그 탭의 약도로 바뀌고, 옆에 「여기 있는 것」과 그 자리로 가는 단추가 뜬다.
//
// ── 지키는 것 ──
//
// · **그림 속 단추도 진짜 단추다.** 그림이라고 `div` 에 손가락만 받으면 자판과
//   낭독기에는 지도가 없는 것이다. 고른 것은 `aria-pressed` 로 말한다
// · **스크린샷을 안 쓴다.** 화면을 고칠 때마다 그림이 옛말이 된다 — 약도는 칸 이름
//   몇 줄이라, 화면이 바뀌면 여기 한 줄을 고치면 된다
// · **가는 길은 주소 하나로 끝난다.** 갈래는 `?t=` 로 적는다(`useTabParam`).
//   로그인 전이면 로그인이 받았다가 그 주소로 데려간다 — 그래서 단추 말도
//   「가입하고 열기」로 바꾼다 (위 `openLabel` 과 같은 약속)
// · **없는 것을 그리지 않는다.** 목록은 지금 앱에 있는 것만 적는다

// 그림 속에서 고를 수 있는 자리. `spot` 은 그림의 어디에 있는가다
//   tab    아래 탭바의 칸
//   head   머리의 단추
//
// `items`  그 화면에 **있는 것**. 하나하나에 `path` 를 단다 — **어디를 눌러 들어가야
//          그것이 나오는지**를 차례대로. 「몸 탭에 있다」로는 모자라다 — 몸 탭 안에
//          갈래가 다섯이고, 재는 도구 안에 또 일곱이다
// `hidden` 그 화면에서 **들어가는** 화면. 탭바에 없어서 여기 안 적으면 못 찾는다
// `to`     그 자리로 가는 주소. **주소만으로 열리는 것**만 적는다(`?t=` 갈래까지).
//          재는 도구의 일곱 칸처럼 `state` 로만 열리는 자리는 그 갈래까지 데려가고,
//          마지막 한 걸음은 `path` 가 말한다
//
// 2026-11-12 에 화면마다 코드를 읽고 맞춘 것이다 — **화면이 바뀌면 여기도 고친다**
const T = (n) => `아래 「${n}」 탭`;
const PLACES = [
  {
    id: 'home', spot: 'tab', icon: 'body', name: '오늘',
    sketch: ['어디로 갈까요? (찾기)', '내 목표 · 오늘 할 곳', '오늘 카드 — 이어서 하기 · 루틴 시작', '이번 주 운동'],
    items: [
      { name: '어디로 갈까요 (앱 안 찾기)', does: '화면 이름을 치면 그 자리로 데려갑니다. 「1RM」 「어깨 측정」처럼 안쪽 도구까지 바로 찾아요', path: [T('오늘'), '맨 위 「어디로 갈까요?」 칸'], to: '/home' },
      { name: '이어서 하기 · 루틴 시작', does: '하던 운동을 이어서 하거나, 루틴을 골라 바로 시작합니다', path: [T('오늘'), '「오늘」 카드'], to: '/home' },
      { name: '운동 기록하기', does: '오늘 한 것을 적으러 운동 화면으로 갑니다', path: [T('오늘'), '「오늘」 카드', '「운동 기록하기」'], to: '/home' },
      { name: '지난 날 고치기', does: '달력에서 지난 날을 골라 고칩니다', path: [T('오늘'), '「오늘」 카드', '「달력에서 고치기」'], to: '/home' },
      { name: '이번 주 운동', does: '이번 주 칠 일. 운동한 날을 누르면 그날 기록으로 갑니다', path: [T('오늘'), '「이번 주 운동」 줄', '운동한 날 누르기'], to: '/home' },
      { name: '앱 소개', does: '이 페이지를 새 창으로 엽니다', path: [T('오늘'), '맨 아래 「블랙아이언 소개」'] },
    ],
    hidden: [
      { name: '목표', does: '주 몇 번 · 체중 · 체지방률 · 골격근량 목표를 세우고, 이번 주 얼마나 채웠는지 봅니다', path: [T('오늘'), '「내 목표」 카드 (처음엔 「세우기 ›」)'], to: '/goal' },
      { name: '몸 지도', does: '최근에 자극한 부위가 금빛으로 달고, 날이 갈수록 식습니다. 식은 부위에서 바로 운동을 고릅니다', path: [T('오늘'), '「오늘 할 곳」 (기록이 쌓이면 떠요)'], to: '/map' },
    ],
  },
  {
    id: 'train', spot: 'tab', icon: 'dumbbell', name: '운동',
    sketch: ['휴식 타이머 (머리 오른쪽)', '무엇을 하시겠어요 — 루틴 · 기능성운동', '운동 찾기 → 무게 · 세트 · 횟수', '오늘 적은 것'],
    items: [
      { name: '세트 적기', does: '운동을 찾고 무게 · 세트 · 횟수를 적습니다', path: [T('운동'), '「운동 찾기」', '무게 · 세트 · 횟수', '「이 운동 적기」'], to: '/train' },
      { name: '지난번과 같게', does: '그 운동을 지난번에 한 대로 한 번에 채웁니다', path: [T('운동'), '운동 고르기', '「지난번과 같게」'], to: '/train' },
      { name: '워밍업 · 원판 계산', does: '본세트까지 올라가는 무게 계단과, 바에 원판을 몇 장 끼울지', path: [T('운동'), '운동 고르기', '「본세트까지 올라가기」'], to: '/train' },
      { name: '루틴 하기', does: '루틴을 시작하면 세트마다 칸을 체크해 나갑니다. 마치면 오늘 들어올린 무게를 한 화면으로 셉니다', path: [T('운동'), '「무엇을 하시겠어요」 루틴의 「시작」', '세트 칸 누르기', '「루틴 끝내기」'], to: '/train' },
      { name: '휴식 타이머', does: '쉬는 시간을 잽니다. 설정에서 「세트를 적으면 저절로」를 켤 수 있어요', path: [T('운동'), '머리 오른쪽 「휴식」 단추'], to: '/train' },
      { name: '횟수 세기 (카메라)', does: '폰을 옆에 세워두면 관절이 접혔다 펴지는 것을 셉니다. 영상은 안 남아요', path: [T('운동'), '운동 고르기', '「횟수를 세어줄까요?」'], to: '/train' },
      { name: '말로 적기', does: '목소리로 세트를 적습니다', path: ['위 「설정」', '「마이크」 → 목소리로 세트 적기 켜기', T('운동')] },
      { name: '지난 날짜에 적기 · 슈퍼세트 · 드롭', does: '깜빡한 날을 나중에 적고, 붙여 하는 세트도 적습니다. 유산소는 시간과 거리로', path: [T('운동'), '운동 고르기', '적는 칸 아래'], to: '/train' },
      { name: '오늘 적은 것', does: '오늘 적은 줄을 고치거나 지웁니다 (지운 것은 잠깐 되돌릴 수 있어요)', path: [T('운동'), '맨 아래 「오늘 적은 것」'], to: '/train' },
    ],
    hidden: [
      { name: '루틴 짜기', does: '내 루틴 · 추천 루틴 · 일주일 프로그램 · 메모', path: [T('운동'), '「루틴 짜기」 (루틴 옆 연필은 그 루틴 고치기)'], to: '/routine' },
      { name: '추천 루틴', does: '처음이면 여기서 골라 내 루틴으로 담습니다', path: [T('운동'), '「루틴 짜기」', '위 「추천」'], to: '/routine?t=pick' },
      { name: '일주일 프로그램', does: '요일마다 할 루틴을 정해둡니다', path: [T('운동'), '「루틴 짜기」', '위 「프로그램」'], to: '/routine?t=program' },
      { name: '기능성운동', does: '집에서 하는 프로그램. 「밤에도 조용한 것」 「준비물 없는 것」으로 고르고, 마치면 기록에 남깁니다', path: [T('운동'), '「기능성운동」'], to: '/homeworkout' },
      { name: '기구 세팅', does: '헬스장마다 기구 의자 높이 같은 세팅을 적어둡니다', path: [T('운동'), '운동 고르기', '「적어둔 기구 세팅 전부 보기」'], to: '/gym' },
    ],
  },
  {
    id: 'history', spot: 'tab', icon: 'calendar', name: '기록',
    sketch: ['달력 · 기록의 벽 · 통계', '한 달 달력 (메모 · 계획)', '그날 기록', '내려받기 · 가져오기'],
    items: [
      { name: '달력', does: '한 달을 한 장으로. 날을 누르면 그날 한 것이 아래에 나옵니다', path: [T('기록'), '위 「달력」'], to: '/history' },
      { name: '날마다 메모 · 다음에 할 것', does: '그날에 메모를 남기고 다음에 할 것을 적어둡니다', path: [T('기록'), '위 「달력」', '날 누르기'], to: '/history' },
      { name: '한 달 요약', does: '운동한 날 · 든 무게 · 유산소 · 쉰 날', path: [T('기록'), '위 「달력」', '달력 아래'], to: '/history' },
      { name: '기록의 벽', does: '한 해를 금속판 열두 장에. 무겁게 든 날일수록 깊게 새겨집니다. 달을 누르면 그 달 달력으로', path: [T('기록'), '위 「기록의 벽」'], to: '/history?t=wall' },
      { name: '통계 · 최고 기록', does: '운동한 날 · 운동별 최고 기록 · 무게와 부위 흐름 · 체중 변화', path: [T('기록'), '위 「통계」'], to: '/history?t=stats' },
      { name: '내려받기 · 가져오기 (CSV)', does: '운동과 인바디를 파일로 받고, 다른 앱에서 쓰던 기록을 가져옵니다', path: [T('기록'), '위 「달력」', '목록 위 「운동 내려받기」 「인바디 내려받기」'], to: '/history' },
    ],
    hidden: [],
  },
  {
    id: 'body', spot: 'tab', icon: 'chart', name: '몸',
    sketch: ['「N일 전과 견주면」', '몸 지도 › · 아픈 곳 ›', '인바디 · 재는 도구 · 견주기 · 체형 · 회복', '갈래마다 적는 칸 · 지난 기록'],
    items: [
      { name: '인바디', does: '키 · 체중 · 체지방률 · 골격근량 · 체수분을 적고 흐름을 봅니다. 건강 앱에서 가져오기도 돼요', path: [T('몸'), '위 「인바디」'], to: '/body' },
      { name: '전신 사이즈', does: '가슴 · 허리 · 팔 · 허벅지 둘레', path: [T('몸'), '위 「재는 도구」', '「전신 사이즈」'], to: '/body?t=measure' },
      { name: '어깨 측정', does: '어깨너비와 허리 대비 비율', path: [T('몸'), '위 「재는 도구」', '「어깨 측정」'], to: '/body?t=measure' },
      { name: '1RM 계산', does: '든 무게와 횟수로 최대 중량을 환산합니다', path: [T('몸'), '위 「재는 도구」', '「1RM 계산」'], to: '/body?t=measure' },
      { name: '체력 테스트', does: '푸시업 · 플랭크 · 달리기 기록', path: [T('몸'), '위 「재는 도구」', '「체력 테스트」'], to: '/body?t=measure' },
      { name: '심박수 존', does: '나이로 유산소 구간을 계산합니다', path: [T('몸'), '위 「재는 도구」', '「심박수 존」'], to: '/body?t=measure' },
      { name: '스톱워치 · 타이머', does: '재고 남깁니다', path: [T('몸'), '위 「재는 도구」', '「스톱워치 · 타이머」'], to: '/body?t=measure' },
      { name: '유연성', does: '앞으로 굽히기 · 스쿼트 깊이', path: [T('몸'), '위 「재는 도구」', '「유연성」'], to: '/body?t=measure' },
      { name: '견주기 (사진)', does: '두 날의 사진과 수치를 나란히. 「겹쳐 찍기」로 같은 자리에서 찍습니다', path: [T('몸'), '위 「견주기」'], to: '/body?t=compare' },
      { name: '체형 읽기', does: '사진에서 잰 비율로 실루엣을 다시 그립니다. 재는 일은 폰 안에서 끝나요', path: [T('몸'), '위 「체형」'], to: '/body?t=shape' },
      { name: '회복 시간', does: '동작이 끝나고 숨이 가라앉는 데 걸린 초. 지난번의 나와 견줍니다', path: [T('몸'), '위 「회복」 (기능성운동에서 「숨 보고 쉬기」를 켜면 쌓여요)'], to: '/body?t=recover' },
    ],
    hidden: [
      { name: '몸 지도', does: '최근에 자극한 부위가 금빛으로 달고, 날이 갈수록 식습니다. 식은 부위에서 바로 운동을 고릅니다', path: [T('몸'), '맨 위 「몸 지도 ›」'], to: '/map' },
      { name: '아픈 곳', does: '아픈 곳을 몸 그림에 짚어둡니다. 진단은 아니에요', path: [T('몸'), '맨 위 「아픈 곳 ›」'], to: '/parts' },
    ],
  },
  {
    id: 'account', spot: 'head', icon: 'menu', name: '내 계정',
    sketch: ['사진 · 이름 · 아이디', '기능성운동 · 운동 알림 · 부위 · 고객센터', '비밀번호 · 앱 잠금', '로그아웃 · 계정 삭제'],
    items: [
      { name: '사진 · 이름 · 아이디', does: '사진을 넣고 바꾸고, 이름과 아이디를 고칩니다', path: ['위 「내 계정」', '맨 위'] },
      { name: '비밀번호 · 앱 잠금', does: '비밀번호 바꾸기(구글로 가입했으면 「만들기」), 앱을 열 때 잠그기', path: ['위 「내 계정」', '「비밀번호 변경」 · 「앱 잠금」'] },
      { name: '로그아웃 · 계정 삭제', does: '맨 아래에 있습니다. 계정을 지우면 되돌릴 수 없어요', path: ['위 「내 계정」', '맨 아래'] },
    ],
    hidden: [
      { name: '운동 알림', does: '요일(매일 · 평일 · 월수금 · 주말)과 시간을 골라 운동할 때를 알려줍니다', path: ['위 「내 계정」', '「운동 알림」'], to: '/reminders' },
      { name: '부위 (아픈 곳)', does: '아픈 곳을 몸 그림에 짚어둡니다. 진단은 아니에요. 「몸」 탭에서도 들어가요', path: ['위 「내 계정」', '「부위」'], to: '/parts' },
      { name: '기능성운동', does: '운동 탭에서도 들어갑니다', path: ['위 「내 계정」', '「기능성운동」'], to: '/homeworkout' },
      { name: '고객센터 · 제보', does: '안 되는 것 · 쓰는 법 · 바라는 것을 보내고 답을 받습니다', path: ['위 「내 계정」', '「고객센터」', '「무엇을 도와드릴까요」'], to: '/support' },
      { name: '자주 묻는 것', does: '물어보기 전에 찾아봅니다', path: ['위 「내 계정」', '「고객센터」', '「자주 묻는 것」'], to: '/support' },
      { name: '공지함', does: '바뀐 것과 알림을 전부 봅니다', path: ['위 「내 계정」', '「고객센터」', '「공지함에서 전부 보기」'], to: '/support/notices' },
    ],
  },
  {
    id: 'settings', spot: 'head', icon: 'gear', name: '설정',
    sketch: ['소리 · 쉴 때 · 마이크', '운동할 때 · 몸 · 헬스장', '계정 · 잠금과 알림', '기록 챙기기'],
    items: [
      { name: '소리 · 진동', does: '쉬는 시간이 끝나면 소리와 진동으로 알립니다', path: ['위 「설정」', '「소리」'], to: '/settings' },
      { name: '휴식 타이머 저절로', does: '세트를 적으면 휴식 타이머가 저절로 돕니다', path: ['위 「설정」', '「쉴 때」'], to: '/settings' },
      { name: '숨 보고 쉬기 · 목소리로 적기', does: '켤 때만 마이크가 켜집니다 (되는 기기에서만 보여요)', path: ['위 「설정」', '「마이크」'], to: '/settings' },
      { name: '운동할 때', does: '화면 켜두기 · 최고 기록이면 알려주기 · 끝나면 오늘 한 것 보여주기', path: ['위 「설정」', '「운동할 때」'], to: '/settings' },
      { name: '몸', does: '성별 · 인바디 점수 보기 · 체형에서 잰 비율 지우기', path: ['위 「설정」', '「몸」'], to: '/settings' },
      { name: '헬스장', does: '다니는 곳과 기구 세팅', path: ['위 「설정」', '「헬스장」'], to: '/settings' },
      { name: '잠금과 알림', does: '앱 잠금 · 운동 알림 · 쉬는 시간 끝 알림 · 건강 앱 연동', path: ['위 「설정」', '「잠금과 알림」'], to: '/settings' },
      { name: '기록 챙기기', does: '운동 · 인바디 · 측정을 파일로 내려받기', path: ['위 「설정」', '「기록 챙기기」'], to: '/settings' },
      { name: '기본값으로 되돌리기 · 로그아웃', does: '맨 아래에 있습니다', path: ['위 「설정」', '맨 아래'], to: '/settings' },
    ],
    hidden: [],
  },
];

export default function AppGuide({ onGo, openLabel }) {
  const [pick, setPick] = useState('train');
  const isPC = useIsPC();

  // ── 기능 이름으로 찾는다 ──
  // 그림을 하나씩 눌러보지 않아도 「회복」을 치면 그것이 있는 칸이 켜진다.
  // 이름과 하는 일 둘 다 본다 — 「알림」은 이름에도, 설정의 하는 일에도 있다
  const [q, setQ] = useState('');
  const term = q.trim();
  const found = useMemo(() => {
    if (!term) return [];
    const out = [];
    for (const p of PLACES) {
      for (const it of [...p.items, ...p.hidden]) {
        if (it.name.includes(term) || it.does.includes(term) || it.path.some((x) => x.includes(term))) out.push({ place: p, it });
      }
    }
    return out.slice(0, 6);
  }, [term]);
  const place = PLACES.find((p) => p.id === pick) || PLACES[0];
  const tabs = PLACES.filter((p) => p.spot === 'tab');
  // 머리 단추는 **앱과 같은 차례**다 — 설정(기어) 다음에 내 계정 (`Layout.jsx`)
  const heads = ['settings', 'account'].map((id) => PLACES.find((p) => p.id === id));

  const spotBtn = (p, compact) => {
    const on = p.id === pick;
    return (
      <button
        key={p.id}
        type="button"
        aria-pressed={on}
        aria-label={`${p.name} 화면 보기`}
        onClick={() => setPick(p.id)}

        style={{
          flex: compact ? '0 0 auto' : 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2, minHeight: 44, minWidth: 44, padding: compact ? '4px 6px' : '5px 0',
          background: on ? 'var(--accent-dim)' : 'none',
          border: `1px ${on ? 'solid' : 'dashed'} ${on ? 'var(--accent)' : 'var(--border-hover)'}`,
          borderRadius: 'var(--radius)', cursor: 'pointer',
          color: on ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: 'inherit',
        }}
      >
        <span aria-hidden="true" style={{ display: 'flex' }}><NavIcon name={p.icon} size={compact ? 16 : 18} /></span>
        {/* 머리 단추도 **이름을 적는다.** 앱의 기어 · 계정 단추는 그림만 있지만, 여기는
            앱을 처음 보는 사람이 읽는 그림이라 그림만으로는 「≡」가 무엇인지 모른다 */}
        <span style={{ fontSize: compact ? 9.5 : 10.5, whiteSpace: 'nowrap' }}>{p.name}</span>
      </button>
    );
  };

  return (
    <div>
      <label htmlFor="guide-q" style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
        찾는 기능이 있나요?
      </label>
      <input
        id="guide-q"
        className="input"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value.slice(0, 20))}
        placeholder="예: 회복, 1RM, 알림, 루틴"
        style={{ marginBottom: found.length || term ? 8 : 18 }}
      />
      {term && (
        <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {found.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>그 말이 들어간 기능이 없어요. 아래 그림에서 칸을 눌러 보세요</div>
          )}
          {found.map(({ place: p, it }) => (
            <button
              key={p.id + it.name}
              type="button"
              onClick={() => { setPick(p.id); setQ(''); }}
              style={{
                display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center',
                minHeight: 40, padding: '7px 11px', textAlign: 'left', cursor: 'pointer',
                background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{it.name}</span>
              <span style={{ fontSize: 11.5, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                {p.spot === 'tab' ? `「${p.name}」 탭` : p.name}{p.hidden.includes(it) ? ' 안쪽' : ''} ›
              </span>
            </button>
          ))}
        </div>
      )}

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
      {/* ── 폰 그림 ── PC 에서는 **목록을 내려도 따라온다.** 고른 칸과 목록이 한눈에
          있어야 「이게 저기 있구나」가 이어진다. 폰에서는 위아래로 쌓여서 붙여두면
          목록을 가리므로 안 붙인다 */}
      <div style={{
        flex: '0 0 auto', width: 232, maxWidth: '100%', margin: '0 auto',
        ...(isPC ? { position: 'sticky', top: 84 } : null),
        border: '1.5px solid var(--border-hover)', borderRadius: 22, padding: '12px 10px 10px',
        background: 'var(--bg-secondary)',
      }}>
        {/* 머리 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{
            fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 13, letterSpacing: 1.6,
            color: 'var(--text-secondary)', marginRight: 'auto',
          }}>BLACK IRON</span>
          {heads.map((p) => spotBtn(p, true))}
        </div>

        {/* 화면 — 고른 자리의 약도 */}
        <div
          aria-live="polite"
          style={{
            minHeight: 196, border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            padding: 10, background: 'var(--bg-primary)', marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>{place.name}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {place.sketch.map((s) => (
              <div key={s} style={{
                fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.4,
                border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 8px',
                background: 'var(--bg-secondary)',
              }}>{s}</div>
            ))}
          </div>
        </div>

        {/* 아래 탭바 */}
        <div style={{ display: 'flex', gap: 5 }}>
          {tabs.map((p) => spotBtn(p, false))}
        </div>
      </div>

      {/* ── 고른 자리에 있는 것 ── */}
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
          {place.spot === 'tab' ? `아래 「${place.name}」 탭` : `위 ${place.name} 단추`}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
          그림의 점선 칸(탭 · 머리 단추)을 누르면 그 화면으로 바뀝니다
        </div>
        <Items list={place.items} onGo={onGo} openLabel={openLabel} />
        {place.hidden.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '16px 0 8px' }}>
              여기서 들어가는 화면
            </div>
            <Items list={place.hidden} onGo={onGo} openLabel={openLabel} />
          </>
        )}
      </div>
    </div>
    </div>
  );
}

function Items({ list, onGo, openLabel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {list.map((it) => (
        <div key={it.name}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{it.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 2 }}>{it.does}</div>
          {/* **가는 길을 차례로 적는다.** 「몸 탭에 있다」로는 못 찾는다 — 그 안에 갈래가
              다섯이고, 갈래 안에 또 칸이 있다. 낭독기에는 「가는 길, 1 … 2 …」로 읽힌다 */}
          <ol aria-label="가는 길" style={{
            listStyle: 'none', margin: '6px 0 0', padding: 0,
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 4px',
          }}>
            {it.path.map((step, i) => (
              <li key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && <span aria-hidden="true" style={{ fontSize: 11, color: 'var(--text-muted)' }}>→</span>}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2px 7px',
                  background: 'var(--bg-secondary)',
                }}>
                  <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>{i + 1}</span>
                  {step}
                </span>
              </li>
            ))}
          </ol>
          {it.to && onGo && (
            <button
              type="button"
              onClick={() => onGo(it.to)}
              aria-label={`${it.name} ${openLabel.replace(' ›', '')}`}
              style={{
                marginTop: 6, minHeight: 36, padding: '6px 11px',
                background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--accent)',
                fontFamily: "'Barlow', 'IBM Plex Sans KR', sans-serif",
              }}
            >{openLabel}</button>
          )}
        </div>
      ))}
    </div>
  );
}
