// 파칭코 시스템 설정 — 확률/보상/티켓 수급을 여기서만 조정하면 됩니다.

// ── 티켓 수급 ──
// 티켓은 "발급량 = 기록 수에서 계산" + "사용량만 localStorage 누적" 구조.
// 발급량을 저장하지 않으므로 티켓 자체를 조작할 수 없습니다.
export const TICKET_RULE = {
  perWorkouts: 3,   // 운동 N회당 티켓 1개
  perInbody: 1,     // 인바디 N회당 티켓 1개
  maxStack: 60,     // 미사용 티켓 최대 보유량 (무한 적립 방지)
  // 무상 지급 티켓. 평소 0이며, 테스트로 티켓을 늘릴 때만 잠깐 올린다
  // (기록을 수백만 건 만들지 않고 티켓만 확보하기 위한 용도).
  bonus: 0,
};

// 한 번에 돌릴 수 있는 최대 판수.
// 티켓이 수백만 장이어도 그만큼 배열을 만들면 브라우저가 멈추므로 잘라낸다.
export const MAX_BATCH = 1000;

// ── 보상 등급 ──
// weight 합계가 100일 필요는 없습니다 (가중치 비율로 계산).
export const PRIZES = [
  {
    id: 'miss',
    weight: 8,
    exp: 0,
    icon: '💨',
    color: '#555555',
    label: { ko: '꽝', en: 'Miss' },
    msg: { ko: '아쉽네요… 다음 판!', en: 'So close… next one!' },
  },
  {
    id: 'normal',
    weight: 33,
    exp: 5,
    icon: '⚪',
    color: '#888888',
    label: { ko: '일반', en: 'Normal' },
    msg: { ko: '가볍게 한 스푼', en: 'A small scoop' },
  },
  {
    id: 'rare',
    weight: 18,
    exp: 15,
    icon: '🔵',
    color: '#4a9aff',
    label: { ko: '레어', en: 'Rare' },
    msg: { ko: '오, 괜찮은데요?', en: 'Nice one!' },
  },
  {
    id: 'epic',
    weight: 11,
    exp: 40,
    icon: '🟣',
    color: '#c0a0ff',
    label: { ko: '에픽', en: 'Epic' },
    msg: { ko: '에픽! 운이 좋으시네요', en: 'Epic! Lucky you' },
  },
  {
    id: 'legend',
    weight: 8,
    exp: 120,
    icon: '🟡',
    color: '#ffd700',
    label: { ko: '전설', en: 'Legend' },
    msg: { ko: '전설 등급! 좋은데요?', en: 'Legendary! Nice!' },
  },
  // ── 여기부터 자릿수가 늘어나는 상위 등급 ──
  {
    id: 'transcend',
    weight: 6,
    exp: 500,
    icon: '🔮',
    color: '#00ffcc',
    label: { ko: '초월', en: 'Transcend' },
    msg: { ko: '초월! 세 자리 돌파!', en: 'Transcend! Three digits!' },
  },
  {
    id: 'jackpot',
    weight: 5,
    exp: 2500,
    icon: '🪙',
    color: '#ff0066',
    label: { ko: '잭팟', en: 'JACKPOT' },
    msg: { ko: '🎊 잭팟!! 네 자리!!', en: '🎊 JACKPOT!! Four digits!!' },
  },
  {
    id: 'mega',
    weight: 4,
    exp: 10000,
    icon: '👑',
    color: '#ffffff',
    label: { ko: '메가잭팟', en: 'MEGA JACKPOT' },
    msg: { ko: '👑 다섯 자리 달성!!!', en: '👑 FIVE DIGITS!!!' },
  },
  // ── 자릿수 사다리: 15칸을 채우기 위한 상위 등급 ──
  {
    id: 'cosmic',
    weight: 3,
    exp: 1000000,               // 7자리
    icon: '🌌',
    color: '#00ffcc',
    label: { ko: '우주', en: 'Cosmic' },
    msg: { ko: '🌌 일곱 자리!! 우주급', en: '🌌 SEVEN DIGITS!! Cosmic' },
  },
  {
    id: 'god',
    weight: 3,
    exp: 10000000000,           // 11자리
    icon: '⚡',
    color: '#ff44ff',
    label: { ko: '신', en: 'God' },
    msg: { ko: '⚡ 열한 자리!!! 신의 영역', en: '⚡ ELEVEN DIGITS!!! Divine' },
  },
  {
    id: 'supernova',
    weight: 1,
    exp: 999999999999999,       // 15자리 — 전 칸이 9로 채워짐
    icon: '💥',
    color: '#ffcc00',
    label: { ko: '초신성', en: 'SUPERNOVA' },
    msg: {
      ko: '💥💥 열다섯 자리 전부 9!!! 999조 EXP!!!',
      en: '💥💥 ALL FIFTEEN NINES!!! 999 TRILLION EXP!!!',
    },
  },
];

// 5칸을 채우는 등급 (5자리 연출 기준)
export const MEGA_ID = 'mega';
// 15칸을 전부 채우는 최상위 등급
export const SUPERNOVA_ID = 'supernova';
// 특별 연출을 켜는 기준 (초월 이상)
export const BIG_HIT_EXP = 500;

// 기대값 참고: 약 20 EXP/판 (운동 3회 = 45 EXP + 티켓 1개 ≈ 65 EXP)
export const EXPECTED_EXP = PRIZES.reduce(
  (sum, p) => sum + p.exp * p.weight, 0
) / PRIZES.reduce((sum, p) => sum + p.weight, 0);

// ══ 사다리타기 (하이리스크 모드) ══
// 티켓 5장을 걸고 한 판 — 꽝이 훨씬 잦은 대신 최고 보상 확률이 5배
export const LADDER = {
  // 판당 티켓 3장 — 최고 보상을 3%로 낮춘 만큼 비용도 낮춰
  // 티켓당 기대값을 파칭코와 1.000배로 맞춘다 (유불리 없이 분산만 다르게)
  cost: 3,
  columns: 5,       // 세로줄 = 시작점 개수 = 도착 칸 개수
  rows: 9,          // 가로줄이 놓일 수 있는 층 수
  rungChance: 0.55, // 각 층에서 가로줄이 생길 확률
  traceMs: 3600,    // 경로를 따라 내려가는 시간 (천천히 보이도록)
};

export const LADDER_PRIZES = [
  {
    id: 'l_miss', weight: 30, exp: 0, icon: '💨', color: '#555555',
    label: { ko: '꽝', en: 'Miss' },
    msg: { ko: '5장이 날아갔습니다…', en: 'Five tickets gone…' },
  },
  {
    id: 'l_small', weight: 32, exp: 500, icon: '🔹', color: '#4a9aff',
    label: { ko: '소', en: 'Small' },
    msg: { ko: '본전은 아니지만…', en: 'Not quite even…' },
  },
  {
    id: 'l_mid', weight: 20, exp: 50000, icon: '🔶', color: '#ffa040',
    label: { ko: '중', en: 'Medium' },
    msg: { ko: '괜찮은 수확!', en: 'Decent haul!' },
  },
  {
    id: 'l_big', weight: 15, exp: 10000000, icon: '💠', color: '#c060ff',
    label: { ko: '대', en: 'Big' },
    msg: { ko: '천만 EXP! 크게 먹었습니다', en: '10M EXP! Big win' },
  },
  {
    id: 'l_max', weight: 3, exp: 999999999999999, icon: '💥', color: '#ffcc00',
    label: { ko: '초대박', en: 'MAX' },
    msg: { ko: '💥 사다리 최고 보상!! 999조!!', en: '💥 LADDER MAX!! 999 TRILLION!!' },
  },
];

export function drawLadderPrize(rand = Math.random) {
  const total = LADDER_PRIZES.reduce((sum, p) => sum + p.weight, 0);
  let roll = rand() * total;
  for (const p of LADDER_PRIZES) {
    roll -= p.weight;
    if (roll < 0) return p;
  }
  return LADDER_PRIZES[0];
}

export const LADDER_EXPECTED_EXP = LADDER_PRIZES.reduce(
  (sum, p) => sum + p.exp * p.weight, 0
) / LADDER_PRIZES.reduce((sum, p) => sum + p.weight, 0);

// ── localStorage 키 ──
export const LS = {
  used: 'steelbody_pachinko_used',   // 사용한 티켓 수
  exp: 'steelbody_pachinko_exp',     // 파칭코로 획득한 누적 EXP
  log: 'steelbody_pachinko_log',     // 최근 결과 (최대 LOG_MAX개)
  best: 'steelbody_pachinko_best',   // 최고 등급 id
};

export const LOG_MAX = 8;

// ── 릴 연출 설정 ──
// 보상이 0~500이라 3자리 릴에 딱 맞음 (000 / 005 / 015 / 040 / 120 / 500)
export const REEL = {
  digits: 15,       // 숫자 칸 개수
  itemHeight: 40,   // 숫자 한 칸 높이(px) — 15칸이라 낮게
  fontSize: 17,     // 숫자 폰트 크기
  gap: 2,           // 릴 사이 간격(px)
  // 칸 너비는 flex로 균등 분할 (15칸이라 고정 px로는 폰에서 넘침)
  cycles: 7,        // 스트립에 담을 0~9 반복 횟수 (최대 회전수보다 커야 함)
  baseSpins: 6,     // 릴이 도는 바퀴 수
  spinStep: 0,      // 15칸이라 0 — 릴마다 회전수를 늘리면 DOM이 3천 개를 넘음
  baseMs: 700,      // 첫 릴이 멈추는 시각
  staggerMs: 90,    // 릴 사이 정지 간격 (15칸이라 짧게)
  revealMs: 240,    // 마지막 릴 정지 후 결과 문구까지의 여유
};

// 마지막 릴이 멈추는 시각
export const REEL_TOTAL_MS = REEL.baseMs + REEL.staggerMs * (REEL.digits - 1);

// ── 가중 랜덤 추첨 ──
export function drawPrize(rand = Math.random) {
  const total = PRIZES.reduce((sum, p) => sum + p.weight, 0);
  let roll = rand() * total;
  for (const p of PRIZES) {
    roll -= p.weight;
    if (roll < 0) return p;
  }
  return PRIZES[0];
}

// ── 큰 숫자 축약 (15자리까지 나오므로 좁은 칸에서는 줄여 표기) ──
export function compactExp(n) {
  if (n < 10000) return String(n);
  const units = [[1e12, '조'], [1e8, '억'], [1e4, '만']];
  for (const [size, suffix] of units) {
    if (n >= size) {
      const v = n / size;
      return (v >= 100 ? Math.round(v) : +v.toFixed(1)) + suffix;
    }
  }
  return String(n);
}

// ── 안전한 숫자 읽기 (조작/손상 값 방어) ──
export function readInt(key, fallback = 0) {
  const raw = Number(localStorage.getItem(key));
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallback;
}
