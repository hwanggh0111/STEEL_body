// 원판 피하기 — 설정을 여기서만 조정하면 됩니다.

// ── 교환 ──
// 피해서 모은 원판으로 티켓을 산다.
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

  dodgeReward: 1,      // 피하기만 해도 주는 양. 나머지는 주워야 받는다.
};

// ── 바닥에 떨어진 원판 (줍기) ──
// 피한 원판은 바닥에 남고, 밟으면 원판 값만큼 더 받는다.
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

// 실제 올림픽 원판 색. 무거울수록 크고 빠르고, 피했을 때 더 많이 준다.
// name 이 있으면 화면에 그 이름으로 나온다 (없으면 "2.5kg" 처럼 무게로).
export const PLATES = [
  { kg: 2.5, value: 1, r: 0.045, speed: 1.00, weight: 34, color: '#e8e8e8', ring: '#9aa0a6' },
  { kg: 5,   value: 1, r: 0.055, speed: 1.05, weight: 26, color: '#2f3336', ring: '#5c6368' },
  { kg: 10,  value: 2, r: 0.068, speed: 1.12, weight: 20, color: '#2f9e44', ring: '#63d08a' },
  { kg: 15,  value: 3, r: 0.080, speed: 1.20, weight: 13, color: '#f2c200', ring: '#ffe066' },
  { kg: 20,  value: 5, r: 0.094, speed: 1.30, weight: 7,  color: '#e03131', ring: '#ff8787' },
  // 잭팟. 900개면 티켓 90장이라 한 방에 판도가 바뀐다.
  // 피하기만 해서는 +1 뿐이라, 떨어지는 원판 사이로 주우러 들어가야 값을 한다.
  //
  // weight 는 이 게임의 수급을 혼자 좌우한다 (값이 다른 원판의 180배라
  // 기대값을 잭팟이 지배한다). 참고로 한 판에 원판 120개가 떨어진다고 보면:
  //   0.1 → 0.100%, 주울때 평균 2.64, 8.8판에 한 번
  //   0.5 → 0.498%, 주울때 평균 6.21, 2.2판에 한 번   ← 지금
  //   1.0 → 0.990%, 주울때 평균 10.6, 1.4판에 한 번
  {
    kg: 100, name: '슈퍼울트라', value: 900, r: 0.105, speed: 1.45, weight: 0.5,
    color: '#ff44ff', ring: '#ffb3ff',
  },
];

// 잭팟 판정 기준 — 이 값 이상이면 바닥 정리에서 보호하고 연출을 다르게 준다
export const JACKPOT_VALUE = 100;

export function drawPlate(rand = Math.random) {
  const total = PLATES.reduce((s, p) => s + p.weight, 0);
  let roll = rand() * total;
  for (const p of PLATES) {
    roll -= p.weight;
    if (roll < 0) return p;
  }
  return PLATES[0];
}

// 한 판에서 이론상 벌 수 있는 원판의 기대값 — 밸런싱 참고용
export const EXPECTED_PER_PLATE = PLATES.reduce((s, p) => s + p.value * p.weight, 0)
  / PLATES.reduce((s, p) => s + p.weight, 0);

// ── localStorage 키 ──
export const PLS = {
  plates: 'steelbody_plates',            // 보유 원판
  purchased: 'steelbody_plate_tickets',  // 원판으로 산 티켓 (누적)
  best: 'steelbody_plate_best',          // 한 판 최고 기록
  day: 'steelbody_plate_plays',          // 'YYYY-MM-DD|오늘 돌린 판 수'
};

// 로컬 기준 날짜 문자열. toISOString 은 UTC라 한국 시간 오전 9시 이전에 날짜가 밀린다.
export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
