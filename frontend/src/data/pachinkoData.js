import { GENESIS } from '../components/LevelSystem';

// 파칭코 시스템 설정 — 확률/보상/티켓 수급을 여기서만 조정하면 됩니다.

// ── 티켓 수급 ──
// 티켓은 "발급량 = 기록 수에서 계산" + "사용량만 localStorage 누적" 구조.
//
// 조작은 막지 않았습니다 — 못 막은 게 아니라 안 막기로 한 것입니다 (docs/BUGS.md P0-2).
// 기록에서 계산하는 몫은 서버 데이터라 건드리기 어렵지만, 아래는 전부 localStorage라
// 콘솔 한 줄이면 바뀝니다.
//   steelbody_plate_tickets   원판 피하기로 산 티켓
//   steelbody_pachinko_used   사용량 (0으로 되돌리면 티켓이 재충전됨)
//   steelbody_pachinko_exp    누적 EXP
// 레벨은 남과 겨루는 값이 아니라 자기 기록을 보는 지표라, 서버 원장을 둘 만큼의
// 값어치가 없다고 판단했습니다. 랭킹처럼 남과 비교하는 요소가 생기면 그때는
// 서버 검증이 필요합니다.
//
// 개발 중에만 티켓을 몰아준다 (기록을 수백만 건 만들지 않고 티켓만 확보).
// import.meta.env.DEV 는 빌드 시 false 로 치환되므로 프로덕션에서는
// 원래 값(bonus 0 / maxStack 150)만 남는다 — 되돌리는 걸 잊어도 안전.
// 개발 보너스 티켓. `?tickets=N` 으로 이 값을 바꿔 저장해 둘 수 있다(dev/setTickets.js).
// 0 을 주면 보너스가 꺼져서 "기록으로 번 티켓만" 남는다 — 초기 상태를 볼 때 쓴다.
// 프로덕션 빌드에서는 이 함수가 통째로 0 을 돌려준다.
const DEV_TICKET_KEY = 'steelbody_dev_tickets';
function devTicketBonus() {
  if (!import.meta.env.DEV) return 0;
  const raw = readLS(DEV_TICKET_KEY);
  const n = Number(raw);
  if (raw !== null && Number.isFinite(n) && n >= 0) return Math.floor(n);
  return 9999999;
}
const DEV_TICKETS = devTicketBonus();

// 미사용 티켓 최대 보유량 (무한 적립 방지).
//
// 150 이었는데 400 으로 올렸다. 교환소가 티켓 200장을 한 번에 먹는데 상한이 150 이면
// 지갑을 꽉 채워도 단 한 장을 못 바꾼다 — 울트라 레전드 파칭코와 개벽 등급 전체가
// 운영 빌드에서 도달 불가능이었다. 상한은 무한 적립을 막으려고 둔 값이지 소비처의
// 크기를 정하는 값이 아니므로, 가장 비싼 소비처보다 넉넉해야 한다.
// 지금 소비처: 파칭코 1 · 사다리 100 · 교환소 200.
export const BASE_MAX_STACK = 400;

export const TICKET_RULE = {
  perWorkouts: 3,   // 운동 N회당 티켓 1개
  perInbody: 1,     // 인바디 N회당 티켓 1개
  // bonus만 올리고 이걸 기본값으로 두면 available 이 잘려 의미가 없다.
  // 보너스를 0 으로 끄면 운영과 같아져 상한 동작까지 그대로 확인할 수 있다.
  maxStack: import.meta.env.DEV ? Math.max(DEV_TICKETS, BASE_MAX_STACK) : BASE_MAX_STACK,
  // 무상 지급 티켓. 프로덕션에서는 0.
  bonus: DEV_TICKETS,
};

// ── 무한 티켓 ──
// 원판 피하기의 울트라 무한(∞)을 주우면 티켓이 영구히 닳지 않는다.
//
// "티켓 N장 지급"이 아니라 "소모를 멈춘다"로 구현한다.
//   - 지갑에 큰 수를 넣는 방식은 결국 유한하고, 상한(maxStack)에도 걸린다
//   - Infinity 를 넣으면 String(Infinity) → readInt 의 isFinite 가드에 걸려
//     다음 접속에 지갑이 통째로 0 이 된다
// 소모를 멈추면 숫자를 아예 안 건드리므로 아무것도 안 깨진다.
// 구체적으로는 beginPlay 가 used 를 올리지 않고, available 은 아래 상수를 쓴다.
//
// 화면에는 이 수 대신 ∞ 를 찍는다(ticketText). 이 값이 필요한 이유는
// "모두 쓰기" 가 실제로 돌릴 판 수를 알아야 하기 때문이다.
// 9,999,999 는 개발 보너스로 이미 쓰던 규모라 다회 뽑기 경로가 검증돼 있다.
export const UNLIMITED_TICKETS = 9999999;

// 지금 쓸 수 있는 티켓. 세 화면(파칭코/사다리/미니게임)이 같은 식을 쓰도록 모아둔다.
export function ticketsAvailable({ earned, used, unlimited }) {
  if (unlimited) return UNLIMITED_TICKETS;
  return Math.max(0, Math.min(earned - used, TICKET_RULE.maxStack));
}

// 티켓 수 표기 — 무한이면 숫자 대신 ∞
export function ticketText(n, unlimited) {
  return unlimited ? '∞' : n.toLocaleString();
}

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
    devWeight: 30000,
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
//
// 예전에는 여기서 `miss.weight = 30000` 으로 덮어썼다. 그러면 운영 확률이
// 메모리에서 사라져 확률표가 개발용 5.9% 를 진짜 꽝 확률(53.4%)처럼 보여주고,
// 판당 평균(EXPECTED_EXP)까지 개발 기준으로 나온다.
// 원판표·울트라·사다리에서 이미 고친 문제라 여기도 devWeight 로 분리한다.
// import.meta.env.DEV 는 빌드 시 false 로 치환되므로 운영에는 530000 만 남는다.
export function prizeWeight(p) {
  return (import.meta.env.DEV && p.devWeight != null) ? p.devWeight : p.weight;
}

// 운영 가중치의 합 — 확률표는 언제나 이 값으로 % 를 낸다
export const PRIZE_WEIGHT_TOTAL_PROD = PRIZES.reduce((s, p) => s + p.weight, 0);
// 실제로 뽑기에 쓰는 합 (개발이면 개발값). 경고 배너가 "지금 진짜 확률"을 적을 때 쓴다
export const PRIZE_WEIGHT_TOTAL_DEV = PRIZES.reduce((s, p) => s + prizeWeight(p), 0);
// 개발 빌드에서 부풀린 등급이 있는가 (확률표 경고 배너 조건)
export const PRIZE_HAS_DEV_WEIGHTS = import.meta.env.DEV
  && PRIZES.some(p => p.devWeight != null && p.devWeight !== p.weight);

// 5칸을 채우는 등급 (5자리 연출 기준)
export const MEGA_ID = 'mega';
// 15칸을 전부 채우는 최상위 등급
export const SUPERNOVA_ID = 'supernova';
// 특별 연출을 켜는 기준 (초월 이상)
export const BIG_HIT_EXP = 500;

// 기대값은 상위 등급(7·11·15자리)이 지배한다 — 확률표의 '판당 평균'에 계산된 값이 나온다.
// 운영 가중치로만 낸다. 개발값을 섞으면 표에 뜨는 숫자가 밸런싱에도 안내에도 쓸모없어진다.
export const EXPECTED_EXP = PRIZES.reduce(
  (sum, p) => sum + p.exp * p.weight, 0
) / PRIZE_WEIGHT_TOTAL_PROD;

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
    id: 'l_miss', weight: 800000000, devWeight: 20000000, exp: 0, icon: '💨', color: '#555555',
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
//
// 예전에는 여기서 `miss.weight = 20000000` 으로 **덮어썼다.** 그러면 운영 확률이
// 메모리에서 사라져 확률표가 개발용 9.2% 를 진짜 꽝 확률(80.2%)처럼 보여준다.
// 원판표·울트라 확률표에서 이미 같은 문제를 겪었으므로, 여기도 devWeight 로 분리한다.
// import.meta.env.DEV 는 빌드 시 false 로 치환되므로 운영에는 800000000 만 남는다.
export function ladderWeight(p) {
  return (import.meta.env.DEV && p.devWeight != null) ? p.devWeight : p.weight;
}

// 운영 가중치의 합 — 확률표는 언제나 이 값으로 % 를 낸다
export const LADDER_WEIGHT_TOTAL_PROD = LADDER_PRIZES.reduce((s, p) => s + p.weight, 0);
// 실제로 뽑기에 쓰는 합 (개발이면 개발값). 경고 배너가 "지금 진짜 확률"을 적을 때 쓴다
export const LADDER_WEIGHT_TOTAL_DEV = LADDER_PRIZES.reduce((s, p) => s + ladderWeight(p), 0);
// 개발 빌드에서 부풀린 등급이 있는가 (확률표 경고 배너 조건)
export const LADDER_HAS_DEV_WEIGHTS = import.meta.env.DEV
  && LADDER_PRIZES.some(p => p.devWeight != null && p.devWeight !== p.weight);

export function drawLadderPrize(rand = Math.random) {
  let roll = rand() * LADDER_WEIGHT_TOTAL_DEV;
  for (const p of LADDER_PRIZES) {
    roll -= ladderWeight(p);
    if (roll < 0) return p;
  }
  return LADDER_PRIZES[0];
}

// 운영 기준 판당 기대값. 확률표에 뜨는 숫자라 개발 가중치를 섞으면 안 된다.
export const LADDER_EXPECTED_EXP = LADDER_PRIZES.reduce(
  (sum, p) => sum + p.exp * p.weight, 0
) / LADDER_WEIGHT_TOTAL_PROD;

// ══ 울트라 레전드 파칭코 (개벽 전용) ══
// 초월 만렙을 찍어 개벽이 열린 계정만 돌릴 수 있는 세 번째 기계.
// 보상이 일반 EXP 가 아니라 울트라 레전드 EXP 라 개벽 등급이 바로 오른다.
//
// 왜 따로 만드나 — 상한에 닿은 계정은 일반 파칭코 당첨도 어차피 1:1 로 UL EXP 가
// 되지만, 일반 파칭코의 기대값은 1/54만 짜리 초신성이 지배한다. 개벽 만렙(8,000조)
// 까지 그걸로 가려면 티켓 수백만 장이 필요해 사실상 길이 아니다. 이 기계는 분포를
// 눕혀서(최상위 없이도 굴러가게) 개벽을 실제로 오를 수 있는 경로로 만든다.
//
// 보상은 개벽 1레벨(GENESIS.expPerLevel = 32조)을 단위로 잡았다. L 배수로 읽으면 된다.
// L 을 그대로 쓰므로 개벽 1레벨당 비용이 바뀌면 상품도 같이 따라간다 —
// "이 상품은 몇 레벨분" 이라는 아래 문구들이 항상 맞는다.
const L = GENESIS.expPerLevel;

// 울트라 티켓 — 이 기계 전용 화폐. 일반 티켓을 바꿔서 만든다.
// 교환비가 예전 판당 비용(일반 200장)과 같으므로 밸런스는 그대로다.
// 굳이 화폐를 나눈 이유는 두 가지다.
//  - 판당 "200장"이 아니라 "1장"이라 화면에서 남은 판 수가 바로 읽힌다
//  - 일반 파칭코·사다리와 지갑이 갈려 서로의 소비에 휘둘리지 않는다
export const UL_TICKET = {
  rate: 200,        // 일반 티켓 몇 장이 울트라 티켓 1장인가
  icon: '🎟️',
  name: { ko: '울트라 티켓', en: 'Ultra Ticket' },
};

export const UL_PACHINKO = {
  cost: 1,          // 판당 울트라 티켓 (= 일반 티켓 UL_TICKET.rate 장)
  batch: 10,        // 연차 판 수
  // 최고 보상이 8,000조(16자리)라 릴도 16칸. 일반 파칭코(15칸)보다 한 칸 좁게 잡는다
  digits: 16,
  itemHeight: 34,
  fontSize: 15,
  gap: 2,
  cycles: 7,
  baseSpins: 6,
  baseMs: 700,
  staggerMs: 80,
  revealMs: 240,
};

export const UL_REEL_TOTAL_MS =
  UL_PACHINKO.baseMs + UL_PACHINKO.staggerMs * (UL_PACHINKO.digits - 1);

// 가중치 합은 100,000 — 확률을 그대로 읽을 수 있게 맞춰뒀다.
// 판당 기대값 0.0212 L (약 1.7조) → 개벽 1레벨당 울트라 티켓 약 47장
// (일반 티켓으로는 약 9,500장). 개벽은 끝판 콘텐츠라 일부러 이렇게 잡았다.
//
// devWeight 는 개발 빌드에서만 대신 쓰는 값이다. 운영 확률이 만분의 일 단위라
// 그대로 두면 상위 등급 연출을 한 번도 못 보고 개발하게 된다.
// 확률표는 언제나 weight(운영) 기준으로 % 를 내고, 개발 빌드에서는 경고를 띄운다.
export const UL_PRIZES = [
  {
    id: 'ul_miss', weight: 92000, devWeight: 5000, exp: 0, icon: '🌑', color: '#555555',
    label: { ko: '무', en: 'Void' },
    msg: { ko: '아무것도 열리지 않았습니다', en: 'Nothing opened' },
  },
  {
    id: 'ul_glim', weight: 7000, exp: 0.1 * L, icon: '✦', color: '#7a7a8c',
    label: { ko: '미광', en: 'Glimmer' },
    msg: { ko: '희미한 빛', en: 'A faint light' },
  },
  {
    id: 'ul_after', weight: 900, exp: 0.8 * L, icon: '✧', color: '#4fa8d8',
    label: { ko: '잔광', en: 'Afterglow' },
    msg: { ko: '개벽 한 레벨에 가깝습니다', en: 'Nearly a full level' },
  },
  {
    id: 'ul_radiance', weight: 95, devWeight: 900, exp: 5 * L, icon: '☀️', color: '#d8b84f',
    label: { ko: '광휘', en: 'Radiance' },
    msg: { ko: '개벽 5레벨분!', en: '5 genesis levels!' },
  },
  {
    id: 'ul_shard', weight: 4, devWeight: 200, exp: 30 * L, icon: '💠', color: '#ff9a4f',
    label: { ko: '개벽의 파편', en: 'Genesis Shard' },
    msg: { ko: '💠 개벽 30레벨분!!', en: '💠 30 genesis levels!!' },
  },
  {
    id: 'ul_origin', weight: 1, devWeight: 60, exp: 100 * L, icon: '⚪', color: '#ffffff',
    label: { ko: '태초의 빛', en: 'First Light' },
    // 개벽이 250레벨이 된 뒤로 100레벨은 더 이상 만렙이 아니다 (그래도 최고 상품이다)
    msg: { ko: '⚪ 태초의 빛 — 개벽 100레벨분!!!', en: '⚪ FIRST LIGHT — 100 GENESIS LEVELS!!!' },
  },
];

// 뽑기에 실제로 쓰는 가중치 (개발이면 개발값)
export function ulWeight(p) {
  return (import.meta.env.DEV && p.devWeight != null) ? p.devWeight : p.weight;
}
// 운영 가중치의 합 — 확률표는 언제나 이 값으로 % 를 낸다
export const UL_WEIGHT_TOTAL_PROD = UL_PRIZES.reduce((s, p) => s + p.weight, 0);
// 실제로 뽑기에 쓰는 합 (개발이면 개발값). 확률표 경고 배너와 추첨이 함께 쓴다
export const UL_WEIGHT_TOTAL_DEV = UL_PRIZES.reduce((s, p) => s + ulWeight(p), 0);
// 개발 빌드에서 부풀린 등급이 있는가 (확률표 경고 배너 조건)
export const UL_HAS_DEV_WEIGHTS = import.meta.env.DEV
  && UL_PRIZES.some(p => p.devWeight != null && p.devWeight !== p.weight);

export function drawUlPrize(rand = Math.random) {
  let roll = rand() * UL_WEIGHT_TOTAL_DEV;
  for (const p of UL_PRIZES) {
    roll -= ulWeight(p);
    if (roll < 0) return p;
  }
  return UL_PRIZES[0];
}

// 운영 기준 판당 기대값. 확률표에 뜨는 숫자라 개발 가중치를 섞으면 안 된다.
export const UL_EXPECTED = UL_PRIZES.reduce(
  (sum, p) => sum + p.exp * p.weight, 0
) / UL_WEIGHT_TOTAL_PROD;

// ── localStorage 키 ──
export const LS = {
  used: 'steelbody_pachinko_used',   // 사용한 티켓 수
  exp: 'steelbody_pachinko_exp',     // 파칭코로 획득한 누적 EXP
  log: 'steelbody_pachinko_log',     // 최근 결과 (최대 LOG_MAX개)
  best: 'steelbody_pachinko_best',   // 최고 등급 id
  // 울트라 티켓 보유량. 일반 티켓과 달리 "사용량"이 아니라 잔량을 직접 들고 있다
  // (교환으로만 생기므로 기록에서 되계산할 수가 없다).
  ulTickets: 'steelbody_ul_tickets',
  // 울트라 레전드 EXP — 누적 EXP 가 상한에 닿은 뒤로 버는 EXP 는 전부 이쪽으로 들어온다.
  // 개벽 등급이 이 값으로 오른다. (티켓 상한 초과분인 trimOverflow 와는 다른 값이다)
  ulExp: 'steelbody_ul_exp',
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
  let roll = rand() * PRIZE_WEIGHT_TOTAL_DEV;
  for (const p of PRIZES) {
    roll -= prizeWeight(p);
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
  let remWeight = PRIZE_WEIGHT_TOTAL_DEV;

  // 희귀한 등급부터 뽑는다 — 순서가 결과를 바꾼다.
  // 마지막에 남는 등급은 앞선 근사들의 오차를 전부 떠안는데, 그 자리를 초신성
  // (100만 판에 1번)에 두면 반올림 오차 몇 판이 그대로 최상위 당첨으로 둔갑한다.
  // 실제로 흔한 등급부터 뽑았을 때 초신성이 기대치의 약 2배로 나왔다.
  // 가장 흔한 꽝이 떠안으면 수백만 판에서 몇 판 차이라 티가 나지 않는다.
  for (let i = PRIZES.length - 1; i > 0 && remaining > 0; i--) {
    const k = binomial(remaining, prizeWeight(PRIZES[i]) / remWeight, rand);
    counts[i] = k;
    remaining -= k;
    remWeight -= prizeWeight(PRIZES[i]);
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
