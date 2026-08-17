// 파칭코 시스템 설정 — 확률/보상/티켓 수급을 여기서만 조정하면 됩니다.

// ── 티켓 수급 ──
// 티켓은 "발급량 = 기록 수에서 계산" + "사용량만 localStorage 누적" 구조.
// 발급량을 저장하지 않으므로 티켓 자체를 조작할 수 없습니다.
// 개발 중에만 티켓을 몰아준다 (기록을 수백만 건 만들지 않고 티켓만 확보).
// import.meta.env.DEV 는 빌드 시 false 로 치환되므로 프로덕션에서는
// 원래 값(bonus 0 / maxStack 150)만 남는다 — 되돌리는 걸 잊어도 안전.
const DEV_TICKETS = import.meta.env.DEV ? 9999999 : 0;

export const TICKET_RULE = {
  perWorkouts: 3,   // 운동 N회당 티켓 1개
  perInbody: 1,     // 인바디 N회당 티켓 1개
  // 미사용 티켓 최대 보유량 (무한 적립 방지).
  // bonus만 올리고 이걸 150으로 두면 available이 60에서 잘려 의미가 없다.
  maxStack: import.meta.env.DEV ? DEV_TICKETS : 150,
  // 무상 지급 티켓. 프로덕션에서는 0.
  bonus: DEV_TICKETS,
};

// 판마다 결과 객체를 만드는 방식으로 처리할 최대 판수.
// 이 위로는 배열 대신 등급별 횟수만 뽑는다(drawPrizeCounts) — 쓸 수 있는 티켓의
// 상한이 아니라 "어느 방식으로 계산할지"의 경계다. 모두 쓰기는 판수 제한이 없다.
export const MAX_BATCH = 1000;

// ── 보상 등급 ──
// weight 합계가 100일 필요는 없습니다 (가중치 비율로 계산).
// 총합 약 100만 — 상위 등급을 0.0001% 단위까지 내리려고 눈금을 잘게 썼습니다.
export const PRIZES = [
  {
    id: 'miss',
    weight: 530000,
    exp: 0,
    icon: '💨',
    color: '#555555',
    label: { ko: '꽝', en: 'Miss' },
    msg: { ko: '아쉽네요… 다음 판!', en: 'So close… next one!' },
  },
  {
    id: 'normal',
    weight: 230000,
    exp: 5,
    icon: '⚪',
    color: '#888888',
    label: { ko: '일반', en: 'Normal' },
    msg: { ko: '가볍게 한 스푼', en: 'A small scoop' },
  },
  {
    id: 'rare',
    weight: 130000,
    exp: 15,
    icon: '🔵',
    color: '#4a9aff',
    label: { ko: '레어', en: 'Rare' },
    msg: { ko: '오, 괜찮은데요?', en: 'Nice one!' },
  },
  {
    id: 'epic',
    weight: 70000,
    exp: 40,
    icon: '🟣',
    color: '#c0a0ff',
    label: { ko: '에픽', en: 'Epic' },
    msg: { ko: '에픽! 운이 좋으시네요', en: 'Epic! Lucky you' },
  },
  {
    id: 'legend',
    weight: 30000,
    exp: 120,
    icon: '🟡',
    color: '#ffd700',
    label: { ko: '전설', en: 'Legend' },
    msg: { ko: '전설 등급! 좋은데요?', en: 'Legendary! Nice!' },
  },
  // ── 여기부터 자릿수가 늘어나는 상위 등급 ──
  {
    id: 'transcend',
    weight: 10000,
    exp: 500,
    icon: '🔮',
    color: '#00ffcc',
    label: { ko: '초월', en: 'Transcend' },
    msg: { ko: '초월! 세 자리 돌파!', en: 'Transcend! Three digits!' },
  },
  {
    id: 'jackpot',
    weight: 2000,
    exp: 2500,
    icon: '🪙',
    color: '#ff0066',
    label: { ko: '잭팟', en: 'JACKPOT' },
    msg: { ko: '🎊 잭팟!! 네 자리!!', en: '🎊 JACKPOT!! Four digits!!' },
  },
  {
    id: 'mega',
    weight: 500,
    exp: 10000,
    icon: '👑',
    color: '#ffffff',
    label: { ko: '메가잭팟', en: 'MEGA JACKPOT' },
    msg: { ko: '👑 다섯 자리 달성!!!', en: '👑 FIVE DIGITS!!!' },
  },
  // ── 자릿수 사다리: 15칸을 채우기 위한 상위 등급 ──
  {
    id: 'cosmic',
    weight: 100,
    exp: 1000000,               // 7자리
    icon: '🌌',
    color: '#00ffcc',
    label: { ko: '우주', en: 'Cosmic' },
    msg: { ko: '🌌 일곱 자리!! 우주급', en: '🌌 SEVEN DIGITS!! Cosmic' },
  },
  {
    id: 'god',
    weight: 10,
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

// 개발 중에만 꽝 비중을 낮춘다 — 테스트할 때 두 판에 한 번이 꽝이면 확인이 더디다.
// 꽝만 건드리므로 나머지 등급끼리의 비율은 그대로고, 전부 같은 배수로 올라간다
// (530000 → 30000 이면 약 2배. 꽝을 0으로 만들어도 2.12배가 천장이다 —
//  초신성 같은 최상위 연출을 보려면 그 등급의 weight 를 직접 올려야 한다).
// 프로덕션 빌드에서는 이 블록이 통째로 사라지고 위의 530000 이 그대로 쓰인다.
if (import.meta.env.DEV) {
  const miss = PRIZES.find(p => p.id === 'miss');
  if (miss) miss.weight = 30000;
}

// 5칸을 채우는 등급 (5자리 연출 기준)
export const MEGA_ID = 'mega';
// 15칸을 전부 채우는 최상위 등급
export const SUPERNOVA_ID = 'supernova';
// 특별 연출을 켜는 기준 (초월 이상)
export const BIG_HIT_EXP = 500;

// 기대값은 상위 등급(7·11·15자리)이 지배한다 — 확률표의 '판당 평균'에 계산된 값이 나온다
export const EXPECTED_EXP = PRIZES.reduce(
  (sum, p) => sum + p.exp * p.weight, 0
) / PRIZES.reduce((sum, p) => sum + p.weight, 0);

// ══ 사다리타기 (하이리스크 모드) ══
// 티켓 100장을 걸고 한 판 — 꽝이 80%인 대신 최고 보상 확률이 파칭코의 약 100배
export const LADDER = {
  // 판당 티켓 100장. 티켓당 기대 EXP 를 파칭코와 1.000배로 맞춘다
  // (유불리 없이 분산만 다르게). 두 모드의 최고 보상이 같은 999조라
  // 기대값은 최고 등급이 지배하고, 정합을 맞추면 최고 보상 확률은
  // 자동으로 파칭코의 약 100배가 된다 — l_max 가중치는 그 결과값이다.
  cost: 100,
  columns: 5,       // 세로줄 = 시작점 개수 = 도착 칸 개수
  rows: 9,          // 가로줄이 놓일 수 있는 층 수
  rungChance: 0.55, // 각 층에서 가로줄이 생길 확률
  traceMs: 3600,    // 경로를 따라 내려가는 시간 (천천히 보이도록)
};

export const LADDER_PRIZES = [
  {
    id: 'l_miss', weight: 800000000, exp: 0, icon: '💨', color: '#555555',
    label: { ko: '꽝', en: 'Miss' },
    msg: { ko: `${LADDER.cost}장이 날아갔습니다…`, en: `${LADDER.cost} tickets gone…` },
  },
  {
    id: 'l_small', weight: 150000000, exp: 500, icon: '🔹', color: '#4a9aff',
    label: { ko: '소', en: 'Small' },
    msg: { ko: '본전은 아니지만…', en: 'Not quite even…' },
  },
  {
    id: 'l_mid', weight: 45000000, exp: 50000, icon: '🔶', color: '#ffa040',
    label: { ko: '중', en: 'Medium' },
    msg: { ko: '괜찮은 수확!', en: 'Decent haul!' },
  },
  {
    id: 'l_big', weight: 2000000, exp: 10000000, icon: '💠', color: '#c060ff',
    label: { ko: '대', en: 'Big' },
    msg: { ko: '천만 EXP! 크게 먹었습니다', en: '10M EXP! Big win' },
  },
  {
    id: 'l_max', weight: 99460, exp: 999999999999999, icon: '💥', color: '#ffcc00',
    label: { ko: '초대박', en: 'MAX' },
    msg: { ko: '💥 사다리 최고 보상!! 999조!!', en: '💥 LADDER MAX!! 999 TRILLION!!' },
  },
];

// 파칭코와 같은 이유로 개발 중에만 꽝을 낮춘다 (80% 는 테스트가 더디다).
// 꽝만 건드리므로 나머지 등급끼리의 비율은 그대로고, 다 같은 배수로 올라간다.
// 프로덕션 빌드에서는 이 블록이 통째로 사라지고 위의 800000000 이 그대로 쓰인다.
if (import.meta.env.DEV) {
  const miss = LADDER_PRIZES.find(p => p.id === 'l_miss');
  if (miss) miss.weight = 20000000;
}

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
// 최고 보상이 15자리(999조)라 릴도 15칸
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

// ── 여러 판을 한 번에: 등급별 횟수만 뽑기 ──
// n 판을 실제로 n 번 돌리는 대신, 등급별로 몇 번 나왔는지를 바로 표본추출한다.
// 티켓이 수백만 장이어도 등급 수(11번)만 계산하므로 즉시 끝난다.
//
// 방식은 다항분포의 표준적인 순차 조건부 이항분포:
//   등급 i 의 횟수 ~ Binomial(남은 판수, w_i / 남은 가중치 합)
// 남은 판수와 남은 가중치를 매번 깎아 나가므로, 마지막 등급은 남은 전부를 가져간다.

// Box-Muller — 표준정규분포 표본 하나
function gaussian(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();   // log(0) 방지
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Knuth 의 포아송 — 평균이 작을 때만 쓴다 (반복 횟수가 평균에 비례하므로)
function poisson(mean, rand) {
  const L = Math.exp(-mean);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

// 이항분포 표본. m 이 수백만이어도 루프를 돌지 않는다.
// 기대 횟수가 작으면 포아송으로, 크면 정규분포로 근사한다 — 게임 결과라
// 마지막 한 판의 오차보다 즉시 끝나는 쪽이 중요하다.
function binomial(m, p, rand) {
  if (m <= 0 || p <= 0) return 0;
  if (p >= 1) return m;
  const mean = m * p;
  if (mean < 20) return Math.min(m, poisson(mean, rand));
  // p 가 1 에 가까우면 반대쪽(안 나온 횟수)이 작으므로 그쪽을 뽑는다
  if (m - mean < 20) return m - Math.min(m, poisson(m - mean, rand));
  const sd = Math.sqrt(mean * (1 - p));
  return Math.max(0, Math.min(m, Math.round(mean + sd * gaussian(rand))));
}

// PRIZES 와 같은 순서의 횟수 배열을 돌려준다 (합계 = n)
export function drawPrizeCounts(n, rand = Math.random) {
  const counts = new Array(PRIZES.length).fill(0);
  let remaining = Math.max(0, Math.floor(n));
  let remWeight = PRIZES.reduce((s, p) => s + p.weight, 0);

  // 희귀한 등급부터 뽑는다 — 순서가 결과를 바꾼다.
  // 마지막에 남는 등급은 앞선 근사들의 오차를 전부 떠안는데, 그 자리를 초신성
  // (100만 판에 1번)에 두면 반올림 오차 몇 판이 그대로 최상위 당첨으로 둔갑한다.
  // 실제로 흔한 등급부터 뽑았을 때 초신성이 기대치의 약 2배로 나왔다.
  // 가장 흔한 꽝이 떠안으면 수백만 판에서 몇 판 차이라 티가 나지 않는다.
  for (let i = PRIZES.length - 1; i > 0 && remaining > 0; i--) {
    const k = binomial(remaining, PRIZES[i].weight / remWeight, rand);
    counts[i] = k;
    remaining -= k;
    remWeight -= PRIZES[i].weight;
  }
  // 남은 판은 전부 꽝 — 조건부 확률이 1 이므로 이게 정확한 값이다
  counts[0] = remaining;
  return counts;
}

// ── 큰 숫자 축약 (15자리까지 나오므로 좁은 칸에서는 줄여 표기) ──
export function compactExp(n) {
  if (n < 10000) return String(n);
  const units = [[1e12, '조'], [1e8, '억'], [1e4, '만']];
  for (const [size, suffix] of units) {
    if (n >= size) {
      const v = n / size;
      // 반올림하면 999.99…조가 1000조로 부풀어 당첨 문구(999조)와 어긋난다.
      // 보상을 실제보다 크게 보여주지 않도록 버린다.
      return (v >= 100 ? Math.floor(v) : +v.toFixed(1)) + suffix;
    }
  }
  return String(n);
}

// ── 안전한 localStorage 접근 ──
// 사파리 프라이빗 모드나 용량 초과에서 setItem 이 throw 하고,
// 쿠키를 막아둔 브라우저에서는 getItem 조차 throw 한다.
// 판 정산 한가운데에서 터지면 그 뒤 코드(EXP 반영·상태 갱신)가 통째로 중단되므로,
// 저장 실패는 삼키고 최소한 메모리 상태는 살린다. 성공 여부를 돌려준다.
export function readLS(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveLS(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function removeLS(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// ── 안전한 숫자 읽기 (조작/손상 값 방어) ──
export function readInt(key, fallback = 0) {
  const raw = Number(readLS(key));
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallback;
}
