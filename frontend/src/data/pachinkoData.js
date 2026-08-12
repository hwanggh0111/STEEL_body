// 파칭코 시스템 설정 — 확률/보상/티켓 수급을 여기서만 조정하면 됩니다.

// ── 티켓 수급 ──
// 티켓은 "발급량 = 기록 수에서 계산" + "사용량만 localStorage 누적" 구조.
// 발급량을 저장하지 않으므로 티켓 자체를 조작할 수 없습니다.
export const TICKET_RULE = {
  perWorkouts: 3,   // 운동 N회당 티켓 1개
  perInbody: 1,     // 인바디 N회당 티켓 1개
  maxStack: 60,     // 미사용 티켓 최대 보유량 (무한 적립 방지)
};

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
    weight: 32,
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
    weight: 2,
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

// ── 안전한 숫자 읽기 (조작/손상 값 방어) ──
export function readInt(key, fallback = 0) {
  const raw = Number(localStorage.getItem(key));
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallback;
}
