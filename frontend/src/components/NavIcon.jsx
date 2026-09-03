// 길찾기 아이콘 — 직접 그린다.
//
// 예전에는 이모지(🏠 · 🏋️ …)를 글자로 찍었다. 이모지는 **글자마다 그림을 애플 · 구글 ·
// 삼성이 따로 그린다.** 코드포인트는 자유롭지만 그 그림은 그 회사 것이고, 폰마다
// 다르게 나오기까지 한다 — 금색으로 맞춰놓은 화면에 파란 종이 뜨고 노란 집이 뜬다.
//
// 그래서 여기서 직접 그린다. 남의 아이콘 세트도 안 가져온다(들여올 때마다 라이선스가
// 따라온다). **선은 currentColor 로 그린다** — 그래야 고른 자리에서 금색이 되고,
// 안 고른 자리에서 흐려진다.

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

// 톱니는 손으로 여덟 번 적느니 돌려가며 그린다
const teeth = (n, r1, r2) => Array.from({ length: n }, (_, i) => {
  const a = (Math.PI * 2 * i) / n;
  const c = Math.cos(a), s = Math.sin(a);
  return <line key={i} x1={12 + r1 * c} y1={12 + r1 * s} x2={12 + r2 * c} y2={12 + r2 * s} />;
});

// 별은 꼭짓점 열을 손으로 적느니 돌려가며 찍는다
const starPoints = (rOut, rIn) => Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (Math.PI * i) / 5;
  const r = i % 2 ? rIn : rOut;
  return (12 + r * Math.cos(a)).toFixed(1) + ',' + (12 + r * Math.sin(a)).toFixed(1);
}).join(' ');

const PATHS = {
  // 집 — 지붕과 몸통, 가운데 문
  home: <><path d="M3.5 11.2 12 4.2l8.5 7" /><path d="M5.6 10v9.4h12.8V10" /><path d="M10 19.4v-4.6h4v4.6" /></>,
  // 덤벨 — 원판 넷과 봉
  dumbbell: <><path d="M4.2 9.3v5.4M7.2 6.8v10.4M16.8 6.8v10.4M19.8 9.3v5.4" /><path d="M7.2 12h9.6" /></>,
  // 막대그래프 — 바닥선 위에 셋
  chart: <><path d="M4 19.5h16" /><path d="M7.5 19.5v-5.2M12 19.5v-9.4M16.5 19.5v-7" /></>,
  // 서류판 — 집게와 줄 셋
  clipboard: <><rect x="5" y="5" width="14" height="15" rx="2" /><path d="M9 5V3.6h6V5" /><path d="M8.6 10.2h6.8M8.6 13.4h6.8M8.6 16.6h4" /></>,
  // 더보기 — 점 셋
  dots: <><circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none" /></>,
  // 홈트 — 집 안의 덤벨
  homegym: <><path d="M3.5 11.2 12 4.2l8.5 7" /><path d="M5.6 10v9.4h12.8V10" /><path d="M8.4 13.4v3.4M10.2 12.6v5M13.8 12.6v5M15.6 13.4v3.4" /><path d="M10.2 14.9h3.6" /></>,
  // 돋보기
  search: <><circle cx="10.8" cy="10.8" r="6" /><path d="M15.2 15.2 20 20" /></>,
  // 줄자 — 눈금이 있는 자
  ruler: <><rect x="2.8" y="8.2" width="18.4" height="7.6" rx="1.4" /><path d="M7 8.2v3M11 8.2v4.2M15 8.2v3M19 8.2v4.2" /></>,
  // 달력
  calendar: <><rect x="3.8" y="5.4" width="16.4" height="14.4" rx="2" /><path d="M3.8 10h16.4" /><path d="M8.2 3.6v3.4M15.8 3.6v3.4" /><path d="M8 13.6h2M14 13.6h2M8 16.6h2M14 16.6h2" /></>,
  // 종
  bell: <><path d="M6.4 17.2c1.2-1.2 1.4-2.2 1.4-4.6 0-3.4 1.6-5.6 4.2-5.6s4.2 2.2 4.2 5.6c0 2.4.2 3.4 1.4 4.6z" /><path d="M10.2 19.6a2 2 0 0 0 3.6 0" /><path d="M12 4.4V7" /></>,
  // 말풍선 — 물어보는 자리
  chat: <><path d="M4 6.4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H10l-4.6 3.4v-3.4H6a2 2 0 0 1-2-2z" /><path d="M8.4 9.2h7.2M8.4 12.2h4.6" /></>,
  // ─── 성취 · 등급 (아직 쓰는 자리가 있다) ───
  // 불꽃 — 하루에 몰아친 것
  flame: <><path d="M12 20.4c3 0 5.4-2 5.4-4.8 0-3.5-2.8-5.5-4.3-9.4-1.8 1.6-3.1 3.5-3.1 5.4 0 .9.2 1.6.6 2.2-.9-.4-1.5-1.2-1.8-2.2-1.4 1.4-2.2 2.7-2.2 4 0 2.8 2.4 4.8 5.4 4.8z" /></>,
  // 쌓인 판 — 세트를 쌓은 것
  stack: <><rect x="4.2" y="4.8" width="15.6" height="3.6" rx="1.2" /><rect x="4.2" y="10.2" width="15.6" height="3.6" rx="1.2" /><rect x="4.2" y="15.6" width="15.6" height="3.6" rx="1.2" /></>,
  // 과녁 — 여러 가지를 고루
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.2" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  // 별
  star: <><polygon points={starPoints(8.4, 3.6)} /></>,
  // 트로피
  trophy: <><path d="M7.6 4.4h8.8v4.8a4.4 4.4 0 0 1-8.8 0z" /><path d="M7.6 6.2H5v1.4a3.2 3.2 0 0 0 3.2 3.2M16.4 6.2H19v1.4a3.2 3.2 0 0 1-3.2 3.2" /><path d="M12 13.6v3.4M8.4 19.6h7.2l-.8-2.6H9.2z" /></>,
  // 메달 — 리본과 원
  medal: <><path d="M8.6 3.6 11.4 9M15.4 3.6 12.6 9" /><circle cx="12" cy="14.6" r="5.4" /><path d="M12 12.2l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" /></>,
  // 보석
  gem: <><path d="M6.4 4.6h11.2l3.2 4.6L12 19.8 3.2 9.2z" /><path d="M3.2 9.2h17.6M9.2 9.2 12 19.8l2.8-10.6M6.4 4.6 9.2 9.2M17.6 4.6 14.8 9.2" /></>,
  // 왕관
  crown: <><path d="M3.8 7.4 8 11.6l4-6.4 4 6.4 4.2-4.2-1.6 10.4H5.4z" /><path d="M6.6 19.6h10.8" /></>,
  // 오르는 선 — 여러 번 재서 흐름이 보이는 것
  trend: <><path d="M3.8 16.6 9.4 11l3.6 3.6 7.2-7.2" /><path d="M15.6 7.4h4.6v4.6" /></>,
  // 다 한 것
  check: <><path d="M5 12.4 9.8 17.2 19 7.2" strokeWidth="2" /></>,
  // ─── 고객센터 ───
  // 벌레 — 안 되는 것
  bug: <><ellipse cx="12" cy="13.6" rx="4.8" ry="6" /><path d="M12 8.4v10.8" /><path d="M9.8 7.6 8.2 4.6M14.2 7.6 15.8 4.6" /><path d="M7.2 11.2 4 9.4M7.2 14.2H3.6M7.2 17.2 4.2 19M16.8 11.2 20 9.4M16.8 14.2h3.6M16.8 17.2l3 1.8" /></>,
  // 전구 — 이랬으면 하는 것
  bulb: <><path d="M8.8 14.8a5.8 5.8 0 1 1 6.4 0v2.4H8.8z" /><path d="M9.6 19.6h4.8M10.6 21.8h2.8" /></>,
  // 우편함 — 보낸 것을 보러 가는 자리
  inbox: <><path d="M3.6 12.6 6.4 5.4h11.2l2.8 7.2v5.6a1.4 1.4 0 0 1-1.4 1.4H5a1.4 1.4 0 0 1-1.4-1.4z" /><path d="M3.6 12.6h4.2l1.2 2.4h6l1.2-2.4h4.2" /></>,
  // 전파 — 못 불러왔을 때
  signal: <><path d="M6.6 15.2a7.6 7.6 0 0 1 10.8 0M3.4 11.6a12.2 12.2 0 0 1 17.2 0" /><circle cx="12" cy="18.6" r="1.4" fill="currentColor" stroke="none" /></>,
  // 막음 — 차단한 사람
  ban: <><circle cx="12" cy="12" r="8" /><path d="M6.4 6.4 17.6 17.6" /></>,
  // ─── 관리자 · 점검 ───
  // 자물쇠 — 잠긴 자리 · 해킹 보안
  lock: <><rect x="4.8" y="10.4" width="14.4" height="9.4" rx="2" /><path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6" /><circle cx="12" cy="14.8" r="1.3" fill="currentColor" stroke="none" /></>,
  // 방패 — 보안 관리
  shield: <><path d="M12 3.6 5 6.2v5.2c0 4 2.9 7.4 7 9 4.1-1.6 7-5 7-9V6.2z" /><path d="M9.2 12.2l2 2 3.6-3.8" /></>,
  // 로봇 — 스스로 막는 쪽 (AI 관리자)
  robot: <><rect x="4.4" y="8" width="15.2" height="10.6" rx="2.4" /><path d="M12 4.6V8" /><circle cx="12" cy="3.6" r="1.1" /><circle cx="9.2" cy="12.4" r="1.1" fill="currentColor" stroke="none" /><circle cx="14.8" cy="12.4" r="1.1" fill="currentColor" stroke="none" /><path d="M9.6 15.8h4.8" /></>,
  // 렌치 — 점검
  wrench: <><path d="M15.4 4.6a4.6 4.6 0 0 0-4.2 6.4L4.6 17.6l1.8 1.8 6.6-6.6a4.6 4.6 0 0 0 5.8-6l-2.6 2.6-2.2-.6-.6-2.2z" /></>,
  // 서버 — 서버 점검
  server: <><rect x="4" y="5" width="16" height="5.6" rx="1.4" /><rect x="4" y="13.4" width="16" height="5.6" rx="1.4" /><path d="M7.4 7.8h.01M7.4 16.2h.01" /><circle cx="7.4" cy="7.8" r="0.9" fill="currentColor" stroke="none" /><circle cx="7.4" cy="16.2" r="0.9" fill="currentColor" stroke="none" /></>,
  // 사이렌 — 긴급
  siren: <><path d="M6.6 18.4v-5.2a5.4 5.4 0 0 1 10.8 0v5.2z" /><path d="M4.6 18.4h14.8" /><path d="M12 4.6V2.8M5.4 7 4.2 5.8M18.6 7l1.2-1.2" /></>,
  // 확성기 — 알려주는 것 (공지함)
  megaphone: <><path d="M4.6 10.2v3.6a1.4 1.4 0 0 0 1.4 1.4h2.2l7.8 4V4.8l-7.8 4H6a1.4 1.4 0 0 0-1.4 1.4z" /><path d="M8.2 15.2v3.6h2.6v-2.3" /><path d="M18.8 9.6a3.4 3.4 0 0 1 0 4.8" /></>,
  // 시계 — 최근에 본 것
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7.4V12l3 1.8" /></>,
  // 심장 — 심박수
  heart: <><path d="M12 19.4S4.6 15.2 4.6 9.9A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7.4 1.9c0 5.3-7.4 9.5-7.4 9.5z" /></>,
  // 줄 셋 — 메뉴 열기
  menu: <><path d="M4.4 7.4h15.2M4.4 12h15.2M4.4 16.6h15.2" /></>,
  // 물음표 말풍선 — 물었는데 답이 없던 말
  question: <><path d="M4 6.4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H10l-4.6 3.4v-3.4H6a2 2 0 0 1-2-2z" /><path d="M10.2 8.6a1.9 1.9 0 0 1 3.6.8c0 1.3-1.8 1.5-1.8 2.8" /><circle cx="12" cy="13.6" r="0.8" fill="currentColor" stroke="none" /></>,
  // 톱니
  // ─── 내 계정 시트 (2026-09-03) ───
  // 여기까지는 ✎ 같은 **글자**를 아이콘 자리에 쓰고 있었다. 글꼴마다 모양이 달라지고
  // 크기도 안 맞는다 — 다른 자리와 같이 직접 그린 선으로 바꿨다
  pencil: <><path d="M4.6 19.4h3.2L18.4 8.8a2.2 2.2 0 0 0-3.2-3.2L4.6 16.2z" /><path d="M14.2 6.6l3.2 3.2" /></>,
  camera: <><path d="M4.4 8.6h3.2l1.4-2.2h6l1.4 2.2h3.2a1.4 1.4 0 0 1 1.4 1.4v7.6a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 17.6V10a1.4 1.4 0 0 1 1.4-1.4z" /><circle cx="12" cy="13.6" r="3.2" /></>,
  exit: <><path d="M14.4 4.6H6.2a1.6 1.6 0 0 0-1.6 1.6v11.6a1.6 1.6 0 0 0 1.6 1.6h8.2" /><path d="M11 12h9.4" /><path d="M17.4 8.8 20.6 12l-3.2 3.2" /></>,
  gear: <><circle cx="12" cy="12" r="3.4" />{teeth(8, 6.2, 8.8)}</>,
};

export const NAV_ICONS = Object.keys(PATHS);

export default function NavIcon({ name, size = 22, title }) {
  const d = PATHS[name];
  // 이름이 틀리면 조용히 빈 칸이 된다 — 길찾기에서 아이콘만 사라지면 눈치채기 어렵다
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S}
      role={title ? 'img' : 'presentation'} aria-hidden={title ? undefined : true}
      aria-label={title} style={{ display: 'block' }}>
      {title && <title>{title}</title>}
      {d}
    </svg>
  );
}
