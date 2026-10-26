// 원판 계산 — **바에 뭘 꽂아야 하나** (2026-10-05).
//
// ── 왜 ──
//
// 100kg 을 치려면 양쪽에 25+20+5. 헬스장에서 **매 세트 머리로 하는 계산**이고,
// 워밍업이면 다섯 번을 연달아 한다. 경쟁 앱은 거의 다 갖고 있고 우리만 없었다.
//
// 방금 붙인 워밍업 줄(`setPlan.js`)과 한 쌍이다 — 「60×4」 옆에 「20 하나씩」이
// 같이 적히면 바 앞에서 더 셀 것이 없다.
//
// ── 한쪽만 센다 ──
//
// 바벨은 **양쪽에 같은 원판**을 끼운다. 그래서 (목표 − 바) ÷ 2 를 한쪽에 올린다.
// 화면에도 **한쪽 것만** 적는다 — 「양쪽에 25+20+5」라고 말해야지 총 개수를 적으면
// 바 앞에서 다시 나눠야 한다.
//
// ── 못 맞추는 무게가 있다 ──
//
// 가진 원판으로 딱 안 떨어지면 **가장 가까운 아래**까지만 쌓고 얼마가 모자라는지
// 말한다. 몰래 반올림해서 「100kg」이라고 적어주면 실제로는 97.5kg 을 들고
// 기록에는 100 이 남는다 — 그게 다음 주 무게를 정한다.

// **기구는 사전이 안다** — 빌드가 뽑아둔 표다 (`gen-parts.mjs` → `exerciseGear.js`).
// 손으로 고치지 않는다. 고칠 자리는 `exerciseDict.js` 의 `gear` 칸이다
import { EXERCISE_GEAR } from './exerciseGear.js';

// 한국 헬스장에 보통 있는 원판 (kg). 큰 것부터.
//
// 1.25 까지 둔다 — 2.5 단위로 떨어지는 무게만 쓰면 양쪽 합 2.5kg 을 못 올린다.
// 작은 증량(한 번에 2.5kg)을 하는 사람에게는 그 한 장이 전부다.
export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

// 바 무게. 올림픽 바가 20kg, 여성용·짧은 바가 15kg 이다.
// 0 은 **바가 없는 것** — 덤벨 · 머신 · 스미스머신의 표시 무게다
export const BARS = [
  { kg: 20, label: '바벨 20kg' },
  { kg: 15, label: '짧은 바 15kg' },
  { kg: 0, label: '덤벨 · 머신' },
];

// ── 그 운동에 **바가 있나** ── (2026-10-22)
//
// 바 무게는 기기에 남는다 — 「그 헬스장에 어떤 바가 있나」라서다. 그런데 **꽂을
// 원판이 있느냐는 헬스장이 아니라 운동이 정한다.** 둘을 한 값으로 쓰고 있어서
// 양쪽으로 틀렸다 —
//
//   덤벨컬을 적다 「덤벨 · 머신」을 고른 뒤 **벤치프레스**를 적으면
//     → 「덤벨 · 머신 — 꽂을 원판이 없어요」. 워밍업에서 **빈 바 줄과 원판 안내가
//       통째로 사라진다**(`warmupSets` 가 바를 0 으로 받는다)
//   바를 20 으로 둔 채 **덤벨컬**을 적으면
//     → 「양쪽 2.5 + 1.25」. 덤벨에 꽂을 수 없는 안내고, 워밍업이 「빈 바 20×8」로
//       시작한다 — 덤벨컬에 빈 바가 왜 나오나
//
// 이름으로 읽는다. **아는 것만 고치고 모르는 것은 고른 값을 그대로 쓴다** —
// 사람이 고른 것을 말없이 뒤집지 않는다(「체스트프레스」처럼 머신이지만 이름에
// 기구가 안 적힌 것이 있고, 운동명은 자유 입력이다).
//
// 부위를 이름으로 맞히는 자리(`bodyPart.js`)와 같은 결이다 — 사전이 있으면 사전이,
// 없으면 낱말이. 다만 사전에는 **기구 칸이 없다**(219개에 `part` 와 설명뿐이다).
// 그래서 여기서는 낱말만 본다. 검사가 사전 219개를 통째로 넣어 본다(`npm run plate`).

// 공백 · 기호를 지운 소문자 — 「덤벨 컬」과 「덤벨컬」은 같은 말이다
// **사전에서 뽑은 표의 열쇠와 같은 다듬기여야 한다** (`gen-parts.mjs` 의 `norm`) —
// 다르면 표를 찾는 열쇠가 어긋나 조용히 안 맞는다
const flat = (s) => String(s || '').toLowerCase().replace(/[\s.,!?~·・\-_'"()]/g, '');

// 사전 이름을 **긴 것부터** 본다 — 「의자 스쿼트」가 「스쿼트」보다 먼저 걸려야 한다.
// 한 번만 세운다 (부를 때마다 세우면 기록 수천 건에서 그만큼 돈다)
const GEAR_NAMES = Object.keys(EXERCISE_GEAR).sort((a, b) => b.length - a.length);

/** 이름 안에 든 **제일 긴** 사전 이름의 기구. 없으면 null */
function containedGear(n) {
  for (const key of GEAR_NAMES) {
    if (key.length >= 2 && n.includes(key)) return EXERCISE_GEAR[key];
  }
  return null;
}

// **바가 없는 것** — 덤벨 · 머신 · 케이블 · 맨몸.
// 고정 기구(랫풀다운 · 레그프레스)는 표시 무게가 곧 그 무게라 나눌 것이 없다
const NO_BAR_WORDS = [
  '덤벨', 'dumbbell', '케틀벨', 'kettlebell', '머신', 'machine',
  '케이블', 'cable', '스미스', 'smith', '밴드', 'band', '튜브',
  '랫풀', '풀다운', 'pulldown', '레그프레스', 'legpress', '레그컬', 'legcurl',
  '레그익스텐션', 'legextension', '펙덱', 'pecdeck', '크로스오버', 'crossover',
  '시티드로우', 'seatedrow', '해머스트렝스', '핵스쿼트', 'hacksquat',
  '맨몸', '푸시업', 'pushup', '풀업', 'pullup', '친업', 'chinup', '딥스', 'dip',
  '플랭크', 'plank', '버피', 'burpee', '크런치', 'crunch', '레그레이즈', 'legraise',
  '점핑', 'jumping', '마운틴', 'mountain', '브릿지', 'bridge', '스트레칭',
];

// **바가 있는 것** — 바벨을 쓰는 큰 운동. 이름에 기구가 안 적혀도 바벨이 기본이다
const BAR_WORDS = [
  '바벨', 'barbell', '벤치프레스', 'benchpress', '스쿼트', 'squat',
  '데드리프트', 'deadlift', '오버헤드프레스', '밀리터리', 'military',
  '바벨로우', '벤트오버로우', 'bentoverrow', '클린', 'clean', '스내치', 'snatch',
  '저크', 'jerk', '프론트스쿼트', '굿모닝', 'goodmorning', '힙쓰러스트', 'hipthrust',
];

/**
 * 그 운동에 바가 있나.
 *
 * @returns 'none'     바가 없다 (덤벨 · 머신 · 맨몸) — 꽂을 원판이 없다
 * @returns 'bar'      바벨이다 — 고른 바를 쓴다
 * @returns 'unknown'  이름으로는 모른다 — 고른 값을 그대로 쓴다
 */
export function equipOf(name) {
  const n = flat(name);
  if (!n) return 'unknown';
  // ① 사전에 **그 꼴로** 있으면 사전이 답한다 (안 적힌 것은 「모름」이라 안 걸린다)
  if (EXERCISE_GEAR[n]) return EXERCISE_GEAR[n];
  // ② **바가 없는 쪽을 먼저 본다.** 「덤벨 벤치프레스」는 둘 다 걸리는데 덤벨이다 —
  // 기구 낱말이 계열 낱말보다 세고, **사전이 품은 이름보다도 세다**
  // (「스미스 벤치프레스」는 사전의 「벤치프레스」를 품지만 스미스머신이다)
  if (NO_BAR_WORDS.some((w) => n.includes(flat(w)))) return 'none';
  // ③ 사전 이름을 **품고 있으면** 그 이름으로 본다 — 긴 것부터.
  // 「라잉 아놀드프레스」 · 「집에서 의자 스쿼트」처럼 꾸며 적은 것이 여기서 걸린다.
  // 짧은 쪽이 먼저 걸리면 「의자 스쿼트」가 「스쿼트」로 읽혀 빈 바가 나온다
  const held = containedGear(n);
  if (held) return held;
  // ④ 계열 낱말 — 사전에 아예 없는 이름
  if (BAR_WORDS.some((w) => n.includes(flat(w)))) return 'bar';
  return 'unknown';
}

/**
 * 이 운동에 **실제로 쓸 바 무게.**
 *
 * @param name   운동 이름 (자유 입력)
 * @param chosen 사람이 고른 바 (기기에 남아 있는 값)
 */
export function barFor(name, chosen = 20) {
  const c = BARS.some((b) => b.kg === Number(chosen)) ? Number(chosen) : 20;
  const kind = equipOf(name);
  if (kind === 'none') return 0;
  // 바벨 운동인데 「덤벨 · 머신」이 남아 있으면 **바가 있는 것으로 본다.**
  // 고른 바가 바벨 둘 중 하나면 그것을 그대로 쓴다 (헬스장 바는 사람이 안다)
  if (kind === 'bar') return c > 0 ? c : 20;
  return c;
}

/**
 * 목표 무게를 만들려면 **한쪽에** 무엇을 꽂나.
 *
 * @returns null  — 바보다 가벼워 만들 수 없다 (화면은 아무것도 안 그린다)
 * @returns {{ perSide: number[], total: number, short: number, barOnly: boolean }}
 *   perSide  한쪽에 꽂을 원판들 (큰 것부터)
 *   total    실제로 만들어지는 무게
 *   short    목표에서 모자라는 무게 (0 이면 딱 맞다)
 *   barOnly  빈 바 그대로 (원판 없음)
 */
export function platesFor(targetKg, barKg = 20, plates = PLATES) {
  const target = Number(targetKg);
  const bar = Number(barKg);
  if (!Number.isFinite(target) || target <= 0) return null;
  if (!Number.isFinite(bar) || bar < 0) return null;
  if (target < bar) return null;                 // 빈 바보다 가벼울 수는 없다

  // 바가 없으면(덤벨 · 머신) 나눌 것도 없다 — 표시 무게가 곧 그 무게다
  if (bar === 0) {
    return { perSide: [], total: target, short: 0, barOnly: false, noBar: true };
  }

  let side = (target - bar) / 2;
  if (side === 0) return { perSide: [], total: bar, short: 0, barOnly: true };
  // **아무것도 안 올라가는데 모자란 경우**가 있다 (2026-10-05 리뷰).
  // 22kg 을 20kg 바로 치려면 한쪽에 1kg 인데 그런 원판이 없다. 여기서 `barOnly` 로
  // 빠져나가면 화면이 「빈 바 그대로」라고만 말하고 **2kg 이 사라진다** —
  // 이 파일이 안 하겠다고 적어둔 「몰래 반올림」이다. 모자란 만큼을 들고 나간다
  if (side < Math.min(...plates)) {
    return { perSide: [], total: bar, short: +(side * 2).toFixed(2), barOnly: true };
  }

  // 큰 것부터 쌓는다. 같은 원판을 여러 장 꽂을 수 있다
  const perSide = [];
  for (const p of plates) {
    // **한 종류를 무한정 쌓지 않는다.** 바 한쪽에 들어가는 장수에는 끝이 있고,
    // 열 장이 넘는 답은 읽어도 못 쓴다. 헬스장에 그만큼 있지도 않다
    let n = 0;
    while (side >= p - 1e-9 && n < 10) { perSide.push(p); side -= p; n += 1; }
  }

  const made = bar + (target - bar - side * 2);
  return {
    perSide,
    total: +made.toFixed(2),
    short: +(side * 2).toFixed(2),
    barOnly: perSide.length === 0,
  };
}

/**
 * 사람이 읽는 한 줄. 「25+20+5 양쪽」 · 「빈 바 그대로」
 * 못 만들면 모자란 만큼을 덧붙인다 — 몰래 반올림하지 않는다.
 */
export function plateText(targetKg, barKg = 20, plates = PLATES) {
  const r = platesFor(targetKg, barKg, plates);
  if (!r) return '';
  if (r.noBar) return '';                        // 덤벨 · 머신은 나눌 것이 없다
  // 빈 바라도 **모자라면 말한다** — 「빈 바 그대로」로 끝내면 그 차이가 사라진다
  if (r.barOnly) return r.short > 0 ? `빈 바 그대로 (${r.short}kg 모자람)` : '빈 바 그대로';

  // 같은 원판은 묶어 센다 — 「20+20+10」보다 「20 둘 · 10 하나」가 읽기 쉽다
  const count = new Map();
  for (const p of r.perSide) count.set(p, (count.get(p) || 0) + 1);
  const parts = [...count.entries()].map(([kg, n]) => (n === 1 ? `${kg}` : `${kg}×${n}`));

  const body = `양쪽 ${parts.join(' + ')}`;
  return r.short > 0 ? `${body} (${r.short}kg 모자람)` : body;
}
