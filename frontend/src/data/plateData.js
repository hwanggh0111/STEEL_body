// 원판 피하기 — 설정을 여기서만 조정하면 됩니다.

// ── 교환 ──
// 주워서 모은 원판으로 티켓을 산다.
// 티켓은 원래 "기록에서 매번 계산"이라 조작이 불가능했는데, 구매분은 저장해야 하므로
// 이 값만은 localStorage 에 남는다. 그래서 하루 상한으로 벌이를 묶는다.
export const PLATE_RULE = {
  perTicket: 10,     // 원판 N개 = 티켓 1장
  // 하루에 돌릴 수 있는 판 수 (무한 파밍 방지).
  // 개발 중에는 판 수를 세는 게 테스트에 방해만 되므로 사실상 풀어둔다.
  // import.meta.env.DEV 는 빌드 시 false 로 치환되므로 프로덕션에는 5만 남는다.
  dailyPlays: import.meta.env.DEV ? 9999 : 5,
  needWorkoutToday: false,  // true 면 오늘 운동 기록이 있어야 도전 가능
  revives: 3,               // 한 판에 쓸 수 있는 부활 횟수
};

// ── 게임 ──
// 좌표는 캔버스 크기에 대한 비율(0~1)로 잡는다. 폰/PC 어느 쪽에서도 같은 난이도.
export const DODGE = {
  aspect: 1.25,        // 높이 / 너비
  playerY: 0.9,        // 바닥에서 띄운 위치
  playerR: 0.05,       // 반지름 (너비 비율)
  // 손가락을 따라가는 감쇠 계수(초당). 프레임 수와 무관하게 같은 속도로 붙는다.
  // 프레임마다 일정 비율을 곱하는 방식은 120Hz 화면에서 60Hz의 두 배로 빨라진다.
  //
  // 값이 곧 반응 속도다: 시정수 = 1/followK 초, 목표의 95%까지 그 3배가 걸린다.
  // 16이면 190ms 밀려서 마우스를 그을 때 확연히 뭉갠다. 40이면 75ms — 부드럽되 붙는다.
  followK: 40,
  // 초당 최대 이동 거리 (너비 비율) — 순간이동처럼 튀지 않게 하되,
  // 판을 가로지르는 데 0.2초는 넘지 않아야 떨어지는 원판을 피할 수 있다.
  maxSpeed: 6,
  keySpeed: 2.6,       // ← → 를 누르고 있을 때의 이동 속도 (초당, 너비 비율)
  snap: 0.0015,        // 목표에 이만큼 가까우면 딱 붙인다 (미세 떨림 제거)
  tilt: 0.3,           // 이동 방향으로 기우는 최대 각도(rad, 약 17도). 0이면 안 기움

  fallBase: 0.55,      // 초당 낙하 거리 (높이 비율)
  fallPerDodge: 0.008, // 하나 피할 때마다 붙는 가속
  fallMax: 1.5,

  spawnBase: 820,      // 생성 간격 (ms)
  spawnPerDodge: 9,    // 하나 피할 때마다 줄어드는 간격
  spawnMin: 240,

  graceMs: 700,        // 시작 직후 무적 (손을 올릴 시간)
  // 부활 직후 무적. 시작보다 길게 준다 — 죽었던 자리에서 다시 시작하는 데다
  // 그 시점엔 낙하 속도가 이미 붙어 있어서, 700ms 면 손 쓸 새 없이 또 죽는다.
  reviveGraceMs: 1600,
};

// ── 바닥에 떨어진 원판 (줍기) ──
// 피한 원판은 바닥에 남고, 밟으면 원판 값만큼 받는다.
// 이 게임의 점수는 전부 여기서 나온다 — 피하기만 하면 0 이다.
// 주우러 가려면 떨어지는 원판 사이로 들어가야 해서, 피하기와 이해가 상충한다.
export const GROUND = {
  y: 0.945,      // 바닥에 놓이는 높이 (높이 비율)
  lifeMs: 4200,  // 남아 있는 시간
  // 잭팟은 더 오래 남는다 — 4.2초 안에 낙하 구간을 뚫고 가라는 건 사실상 못 줍게 하는 것이다
  jackpotLifeMs: 9000,
  fadeMs: 1100,  // 사라지기 전 깜빡이는 구간
  max: 6,        // 동시에 놓일 수 있는 최대 개수 (넘으면 값이 낮은 것부터 사라짐)
  grab: 0.55,    // 줍기 판정 여유 (플레이어 반지름 배수)
};

// 바닥에 남아 있는 시간. 잭팟만 예외적으로 길다.
export function groundLife(spec) {
  return spec.value >= JACKPOT_VALUE ? GROUND.jackpotLifeMs : GROUND.lifeMs;
}

// 실제 올림픽 원판 색. 무거울수록 크고 빠르고, 주웠을 때 더 많이 준다.
// name 이 있으면 화면에 그 이름으로 나온다 (없으면 "2.5kg" 처럼 무게로).
export const PLATES = [
  { kg: 2.5, value: 1, r: 0.045, speed: 1.00, weight: 34, color: '#e8e8e8', ring: '#9aa0a6' },
  { kg: 5,   value: 1, r: 0.055, speed: 1.05, weight: 26, color: '#2f3336', ring: '#5c6368' },
  { kg: 10,  value: 2, r: 0.068, speed: 1.12, weight: 20, color: '#2f9e44', ring: '#63d08a' },
  { kg: 15,  value: 3, r: 0.080, speed: 1.20, weight: 13, color: '#f2c200', ring: '#ffe066' },
  { kg: 20,  value: 5, r: 0.094, speed: 1.30, weight: 7,  color: '#e03131', ring: '#ff8787' },
  // 잭팟. 900개면 티켓 90장이라 한 방에 판도가 바뀐다.
  // 피하기만 해서는 한 푼도 안 들어오니, 떨어지는 원판 사이로 주우러 들어가야 한다.
  //
  // weight 는 이 게임의 수급을 혼자 좌우한다 (값이 다른 원판의 180배라
  // 기대값을 잭팟이 지배한다). 한 판에 원판 120개가 떨어진다고 보면:
  //   0.1 → 0.0999%, ∞ 제외 평균 2.74,  8.8판에 한 번   ← 지금
  //   0.5 → 0.498%,  ∞ 제외 평균 6.31,  2.2판에 한 번
  //   1.0 → 0.990%,  ∞ 제외 평균 10.73, 1.4판에 한 번
  //
  // 0.5 에서 0.1 로 내린 이유: 0.5 면 이 원판 하나가 기대값의 71% 를 차지했고,
  // 하루 5판을 다 주우면 티켓 203장/일이 들어왔다. 운동으로 보유 상한(150장)을
  // 채우려면 운동 450회가 필요한데, 미니게임 하루면 그걸 넘긴다.
  // 그러면 "운동 기록 → 티켓" 이라는 앱의 축이 무의미해진다.
  // 0.1 이면 하루 51장 — 거들어주되 대체하지는 않는 수준이다.
  {
    kg: 100, name: '슈퍼울트라', value: 900, r: 0.105, speed: 1.45,
    weight: 0.1, devWeight: 5,
    color: '#ff44ff', ring: '#ffb3ff',
  },
  // 최상위. 한 번 주우면 티켓 999장이라 사실상 판이 끝난다.
  //
  // 확률은 일부러 잔인하게 잡았다 — 슈퍼울트라보다 500배 희귀하다.
  // 운영 weight 0.001 기준 (총 가중치 100.5011):
  //   한 원판이 무한일 확률   0.000995%
  //   한 판(원판 120개)에 뜰 확률  약 0.12%  → 838판에 한 번
  //   하루 5판이면 약 168일(약 5개월반)에 한 번
  //
  // 개발 중에는 이 확률로 테스트가 불가능하므로 DEV 에서만 크게 올린다.
  // import.meta.env.DEV 는 빌드 시 false 로 치환되므로 운영에는 0.01 만 남는다.
  //
  // value 가 JACKPOT_VALUE 이상이라 잭팟 취급을 그대로 물려받는다 —
  // 바닥 정리에서 보호되고, 9초를 버티고, 멀리서도 보이게 크게 빛난다.
  {
    kg: 999, name: '무한', value: 9999, r: 0.118, speed: 1.60,
    weight: 0.001, devWeight: 8,
    color: '#00f0ff', ring: '#ccfbff',
  },
  // 전설. 화면에는 숫자 대신 ∞ 로 나온다 (display).
  //
  // 값은 유한하다. value 에 Infinity 를 넣으면 String(Infinity) 가 "Infinity" 로 저장되고,
  // readInt 의 Number.isFinite 가드에 걸려 다음 접속에 지갑이 통째로 0 이 된다.
  // 그래서 값은 크게 잡되 유한한 수로 두고, 보여줄 때만 ∞ 로 바꾼다.
  //
  // unlimited — 이걸 주우면 **티켓이 영구히 닳지 않는다.** 진짜 무한이다.
  //
  // "티켓 N장 지급"이 아니라 "소모를 멈춘다"로 구현한다. 지갑에 큰 수를 넣는
  // 방식은 결국 유한하고, Infinity 를 넣으면 저장이 깨진다(위 참고).
  // 소모를 멈추면 어떤 숫자도 다루지 않으므로 아무것도 안 깨진다.
  // 자세한 건 pachinkoData 의 ticketsAvailable / UNLIMITED_TICKETS 주석 참고.
  //
  // value 는 그대로 남겨 둔다 — 최고 기록과 원판 지갑이 계속 말이 되게.
  //
  // 운영 weight 0.00005 기준 (총 가중치 100.10105):
  //   한 원판이 이것일 확률       0.00004995%
  //   한 판(원판 120개)에 뜰 확률  약 0.006%  → 16,680판에 한 번
  //   하루 5판이면 약 3,336일 — 대략 9년에 한 번
  //
  // 한 번 뜨면 그 계정의 티켓 경제가 영구히 끝난다. 그래서 이 확률이다.
  //
  // 주의: 값이 워낙 커서 이 등급 하나가 산술 기대값의 65%를 차지한다.
  // 그래서 원판표는 "∞ 제외" 평균을 기본으로 보여준다 (EXPECTED_PER_PLATE_COMMON).
  // weight 를 올릴 때는 기대값이 어떻게 튀는지 먼저 계산해 볼 것.
  //
  // lethal — 맞으면 부활 횟수가 남아 있어도 그 자리에서 판이 끝난다.
  // 이 게임에서 유일하게 목숨을 무시하는 원판이다.
  // 최고 보상이자 최대 위험으로 두어, 뜨는 순간 "먹을까 피할까"가 아니라
  // "일단 피하고 나서 주우러 갈까"가 되게 한다.
  //
  // 크기는 제일 크지만 속도는 일부러 느리다.
  // "무거울수록 크고 빠르다"는 규칙을 깨는 유일한 예외인데, 이유가 있다:
  // 즉사 판정이라 맞으면 판이 끝나고, 화면의 원판도 함께 사라진다.
  // 1년에 한 번 뜨는 걸 손도 못 대고 날리면 보상이 아니라 벌이다.
  // 커서 눈에 확 띄되, 피했다가 주우러 돌아갈 시간은 준다.
  //
  // 색은 단색이 아니라 무지개가 돈다 (rainbow). 이 등급만의 렌더 경로다 —
  // 단색으로는 "그냥 좋은 원판"과 구분이 안 된다.
  {
    kg: 9999, name: '울트라 무한', display: '∞', value: 9999990,
    r: 0.130, speed: 1.15, lethal: true, legend: true,
    unlimited: true, rainbow: true,
    weight: 0.00005, devWeight: 8,
    color: '#ffffff', ring: '#ffffff',
  },
];

// 무지개 원판이 도는 색. 마지막이 첫 색과 같아야 이음매가 안 보인다.
export const RAINBOW_STOPS = [
  '#ff3b3b', '#ff8a00', '#ffe600', '#3bff6e',
  '#00e5ff', '#4d5bff', '#c14dff', '#ff3b3b',
];

// ── 가중치: 운영값과 개발값을 둘 다 들고 있는다 ──
//
// weight 가 진짜(운영) 값이고, devWeight 는 개발 빌드에서만 대신 쓰는 값이다.
// 희귀 등급은 운영 확률이 만분의 일 단위라 그대로 두면 테스트가 불가능하다.
//
// 예전에는 `weight: import.meta.env.DEV ? 8 : 0.001` 처럼 삼항으로 섞어놨는데,
// 그러면 개발 화면에서 운영 확률을 알 방법이 없어진다. 실제로 원판표에 뜬
// 개발용 6.6% 를 진짜 확률로 오해하는 일이 있었다. 그래서 둘을 분리하고,
// 원판표가 개발 빌드에서는 운영 확률을 함께 보여준다.
export function plateWeight(p) {
  return (import.meta.env.DEV && p.devWeight != null) ? p.devWeight : p.weight;
}

// 실제로 뽑기에 쓰는 가중치의 합 (개발이면 개발값 기준)
export const PLATE_WEIGHT_TOTAL = PLATES.reduce((s, p) => s + plateWeight(p), 0);
// 운영 가중치의 합 — 개발 화면에서 "운영이라면 몇 %인지" 계산할 때 쓴다
export const PLATE_WEIGHT_TOTAL_PROD = PLATES.reduce((s, p) => s + p.weight, 0);

// 개발 빌드에서 부풀린 등급이 하나라도 있는가 (원판표 경고 배너 조건)
export const HAS_DEV_WEIGHTS = import.meta.env.DEV
  && PLATES.some(p => p.devWeight != null && p.devWeight !== p.weight);

// 값 표기 — display 가 있으면 숫자 대신 그 기호를 쓴다 (울트라 무한의 ∞).
// count 는 여러 개 주웠을 때 합계용. ∞ 는 몇 개를 주워도 ∞ 다.
export function plateValueText(p, count = 1) {
  if (p.display) return p.display;
  return (p.value * count).toLocaleString();
}

// 잭팟 판정 기준 — 이 값 이상이면 바닥 정리에서 보호하고 연출을 다르게 준다
export const JACKPOT_VALUE = 100;

export function drawPlate(rand = Math.random) {
  let roll = rand() * PLATE_WEIGHT_TOTAL;
  for (const p of PLATES) {
    roll -= plateWeight(p);
    if (roll < 0) return p;
  }
  return PLATES[0];
}

// 원판 하나를 주웠을 때의 기대값 — 밸런싱 참고용이자 원판표에 띄우는 값.
//
// 값이 큰 등급이 산술 평균을 통째로 끌고 간다. 울트라 무한은 4년 반에 한 번인데
// 값이 9,999,990 이라 혼자 전체 기대값의 61%를 차지한다. 그 숫자를 "주울 때 평균"
// 이라고 띄우면, 실제로는 평생 한 번 볼까 말까 한 값을 매 판 받는 것처럼 읽힌다.
//
// 그래서 두 개를 따로 낸다.
//   COMMON — legend 를 뺀 값. 보통 한 판에서 실제로 겪는 수준.
//   전체    — 산술적으로 정확한 값. 참고로만 같이 보여준다.
//
// 개발 빌드에서도 **운영 가중치**로 계산한다. 개발용으로 부풀린 값을 쓰면
// 원판표에 743 같은 숫자가 뜨는데, 그건 밸런싱에도 안내에도 쓸모가 없다.
const evOf = (list) => list.reduce((s, p) => s + p.value * p.weight, 0)
  / list.reduce((s, p) => s + p.weight, 0);

export const EXPECTED_PER_PLATE = evOf(PLATES);
export const EXPECTED_PER_PLATE_COMMON = evOf(PLATES.filter(p => !p.legend));

// ── localStorage 키 ──
export const PLS = {
  plates: 'steelbody_plates',            // 보유 원판
  purchased: 'steelbody_plate_tickets',  // 원판으로 산 티켓 (누적)
  best: 'steelbody_plate_best',          // 한 판 최고 기록
  day: 'steelbody_plate_plays',          // 'YYYY-MM-DD|오늘 돌린 판 수'
  unlimited: 'steelbody_plate_unlimited', // 무한 티켓 획득 여부 ('1')
};

// 로컬 기준 날짜 문자열. 같은 헬퍼가 세 군데에 따로 있었어서 data/dateKey.js 하나로 합쳤다.
// 이름은 부르던 곳들을 위해 그대로 둔다.
export { dateKey as todayKey } from './dateKey';
