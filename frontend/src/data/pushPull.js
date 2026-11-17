// **미는 것과 당기는 것** — 치우쳤는지 본다 (2026-11-17, 시안 C 의 둘째 칸).
//
// ── 왜 이 자리가 비어 있었나 ──
//
// 몸 지도(`bodyHeat`)는 부위별로 **최근에 했나 · 최근 이레 몇 세트인가**를 말한다.
// 그래서 「가슴 24세트 · 등 6세트」는 지도에서 이미 보인다(막대가 서로 견준다).
// 비어 있던 것은 **그 둘을 한 축으로 묶어 보는 것**이다 — 가슴·어깨·삼두는 전부
// **미는** 것이고 등·이두는 **당기는** 것이다. 미는 쪽만 쌓이는 것은 부위 막대
// 여섯 개로는 눈에 안 들어온다.
//
// ── 어떻게 가르나 ──
//
// **묶음(`group`)으로 가른다.** `part` 로는 못 가른다 — `part: 팔` 안에 컬(당기기)과
// 삼두(밀기)가 같이 있다. 사전에 운동을 더할 때 묶음만 적으면 저절로 들어온다.
//
// 이 표는 11/09 에 `scripts/measure-pushpull.cjs` 가 들고 있던 것을 **여기로
// 옮긴 것**이다. 그 자가 이제 이 파일에서 읽는다 — 표가 두 벌이면 화면과 자가
// 다른 말을 하는 날이 온다(11/16 의 「자가 「지금」을 베끼면 거짓이 된다」 류).
//
// ── 세트로 센다 ──
//
// **무게로 세면 안 된다.** 11/09 에 실제 기록으로 재보고 접은 길이다 —
//
//   · 스쿼트 한 세트가 컬 열 세트보다 무겁다 → **하체가 늘 이긴다**
//   · 플랭크 · 크런치는 무게가 없다 → **코어가 0kg 으로 나온다.** 맞는 셈이고
//     틀린 그림이다. 「코어 0%」를 화면에 적으면 거짓이 된다
//
// 세트는 미는 것이든 당기는 것이든 **한 번은 한 번**이다. 맨몸도 같이 센다.
//
// ── 안 가려지는 것은 어느 쪽에도 안 넣는다 ──
//
// 사이드 레이즈는 미는 것도 당기는 것도 아니다(벌리는 것). 유산소는 축이 다르고,
// 부위를 못 알아본 줄은 애초에 셀 곳이 없다. **조용히 한쪽에 넣으면 수가 거짓이
// 된다** — 몇 줄인지 세어서 화면이 말한다.
import { EXERCISE_DICT } from './exerciseDict';
import { bodyPartOf } from './bodyPart';
import { isCardioName } from './cardio';
import { atDay, dateKey } from './dateKey';

/** 사전과 같은 다듬기 (`cardio.js` · `bodyPart.js` 와 같은 줄) */
const norm = (s) => String(s || '').toLowerCase().replace(/[\s.,!?~·・\-_'"()]/g, '');

/** 묶음 → 어느 쪽인가. **사전에 운동을 더할 때 묶음만 적으면 저절로 들어온다** */
export const PUSH_GROUPS = ['벤치프레스', '프레스', '머신프레스', '푸시업', '딥스', '플라이', '머신플라이', '삼두', '케이블'];
export const PULL_GROUPS = ['로우', '풀다운', '풀업', '컬', '승모근'];
export const LEG_GROUPS = ['스쿼트', '런지', '하체머신', '둔근', '종아리', '햄스트링', '데드리프트'];
export const CORE_GROUPS = ['코어'];

/**
 * **묶음이 축이 아니라 기구 이름인 것.**
 *
 * `밴드` 묶음 여덟(`밴드 로우` · `밴드 체스트프레스` · `밴드 바이셉컬` · `밴드
 * 스쿼트` …)은 「밴드로 한다」만 말한다 — 미는지 당기는지는 **운동 이름에 들어
 * 있다.** 자를 세우고 사전 쪽에서 거꾸로 세어보니(2026-11-17, 정석이 「모집단이
 * 작으면 전부 통과가 거짓이 된다」를 지적한 뒤) 이 여덟이 통째로 **못 가림**으로
 * 떨어지고 있었다. 집에서 밴드로 하는 사람의 기록이 전부 어디에도 안 셌다.
 *
 * **부위로 가르지 않는다** — `밴드 풀어파트` · `밴드 페이스풀` 은 부위가 어깨인데
 * **당기는** 것이다(어깨 = 밀기로 두면 틀린다). 그래서 이름 안에 **다른 묶음
 * 이름이 들어 있나**로 본다: `밴드 로우` → 로우(당기기) · `밴드 체스트프레스` →
 * 프레스(밀기) · `밴드 바이셉컬` → 컬(당기기) · `밴드 스쿼트` → 스쿼트(하체).
 * 나머지 넷(`트라이셉 익스텐션` · `풀어파트` · `페이스풀` · `몬스터 워크`)은 걸릴
 * 이름이 없어 **그대로 못 가림**이다 — 모르는 것을 지어서 고르지 않는다.
 */
export const GEAR_GROUPS = ['밴드'];

const SET_PUSH = new Set(PUSH_GROUPS);
const SET_PULL = new Set(PULL_GROUPS);
const SET_LEG = new Set(LEG_GROUPS);
const SET_CORE = new Set(CORE_GROUPS);

/** 이름 → 사전 항목. 사전 이름을 **품고 있으면** 그것으로 본다 (`bodyPartOf` 와 같은 선) */
const byNorm = (() => {
  const m = new Map();
  for (const e of EXERCISE_DICT) {
    for (const n of [e.ko, e.en, ...(e.alias || [])]) {
      const k = norm(n);
      if (k && !m.has(k)) m.set(k, e);
    }
  }
  return m;
})();

/** 사전이 비면 아무것도 안 잡는다 — 자가 그것을 본다 */
export const dictNameCount = () => byNorm.size;

export function entryOf(exercise) {
  const n = norm(exercise);
  if (!n) return null;
  if (byNorm.has(n)) return byNorm.get(n);
  // 품은 이름이 둘이면 **더 긴 쪽**이 센 증거다 (「덤벨 로우 크롤」이 「로우」에
  // 걸려 엉뚱한 데로 가는 것을 막는 그 선)
  let hit = null;
  let hitLen = 0;
  for (const [k, e] of byNorm) {
    if (k.length < 2) continue;
    if (n.includes(k) && k.length > hitLen) { hit = e; hitLen = k.length; }
  }
  return hit;
}

/**
 * 줄여 적은 이름의 후보들 — **사전 이름이 적은 이름을 품은 것들.**
 *
 * ── 왜 후보를 **여럿** 보나 ── (2026-11-17, 붙인 그 자리에서 잡았다)
 *
 * 사람은 「벤치」 · 「데드」로 적는다 — 실제 기록에 **「벤치」가 스물두 줄**이다.
 * 위 `entryOf` 는 「적은 이름이 사전 이름을 품었나」만 봐서 그 둘이 `nodict` 로
 * 떨어졌다. 부위는 알아보는데(`bodyPartOf('벤치') === '가슴'`) 미는/당기는 축에서만
 * 빠지는 **어긋난 꼴**이었다.
 *
 * 처음에는 **가장 짧은 후보**를 골랐다. 그랬더니 「데드」가 `데드행`(풀업 묶음 ·
 * 3자)에 걸려 **당기기**가 됐다 — 그런데 `데드리프트` 는 하체 묶음이라 **같은 운동이
 * 적는 꼴에 따라 다른 쪽**이 됐다(`데드` → 당기기 · `데드리프트` → 하체). 부위로
 * 걸러도 안 갈린다: 사전이 데드리프트를 **`part: 등`** 으로 적어둬서 둘이 같은 부위다.
 *
 * 그래서 **고르지 않는다.** 후보들이 가리키는 쪽이 갈리면 그것은 **못 가린 것**이고,
 * 못 가린 것은 어디에도 안 센다(화면이 몇 건인지 적는다). 한쪽을 지어서 고르면
 * 수가 거짓이 되고, **거짓인 수는 눈으로 안 보인다.**
 */
function 줄임후보쪽(exercise) {
  const n = norm(exercise);
  if (n.length < 2) return new Set();
  const 부위 = bodyPartOf(exercise);
  const sides = new Set();
  for (const [k, e] of byNorm) {
    if (!k.includes(n)) continue;
    // 앱이 아는 부위와 **다른 부위**의 항목은 후보가 아니다 — `bodyPartOf` 는
    // 별명 · 낱말 규칙까지 들고 있는 이 앱의 자다. 새 표를 짓지 않고 있는 자를 쓴다
    if (부위 !== '기타' && e.part !== 부위) continue;
    const s = groupSide(e.group);
    if (s) sides.add(s);
  }
  return sides;
}

/**
 * 운동 이름 안에 **다른 묶음 이름**이 들어 있나 → 그 쪽. (`GEAR_GROUPS` 전용)
 *
 * 긴 이름이 센 증거다 — 「데드리프트」가 「데드」보다 먼저 걸려야 한다.
 * 걸리는 것이 둘 이상인데 쪽이 갈리면 **고르지 않는다**(`데드` 와 같은 선).
 */
function 이름속묶음(exercise) {
  const n = norm(exercise);
  const 걸린쪽 = new Set();
  for (const [g, 쪽] of 묶음차례) {
    if (n.includes(norm(g))) 걸린쪽.add(쪽);
  }
  return 걸린쪽.size === 1 ? [...걸린쪽][0] : null;
}

/** 묶음 이름을 **긴 것부터** — 짧은 이름이 긴 이름 안에 들어 있다 */
const 묶음차례 = [
  ...PUSH_GROUPS.map((g) => [g, 'push']),
  ...PULL_GROUPS.map((g) => [g, 'pull']),
  ...LEG_GROUPS.map((g) => [g, 'leg']),
  ...CORE_GROUPS.map((g) => [g, 'core']),
].sort((a, b) => b[0].length - a[0].length);

/** 묶음 하나 → 쪽. 모르는 묶음은 null */
function groupSide(group) {
  if (SET_PUSH.has(group)) return 'push';
  if (SET_PULL.has(group)) return 'pull';
  if (SET_LEG.has(group)) return 'leg';
  if (SET_CORE.has(group)) return 'core';
  return null;
}

/**
 * 이 운동은 미는 쪽인가 당기는 쪽인가.
 *
 *   'push' · 'pull' · 'leg' · 'core'   — 가려졌다
 *   'cardio'                           — 축이 다르다 (시간 · 거리)
 *   'other'                            — 부위를 못 알아봤다
 *   'nodict'                           — 사전에 없다
 *   'nosplit'                          — 축에 없거나 **줄여 적어 갈리지 않는다**
 */
export function sideOf(exercise) {
  // **유산소를 먼저 가린다** — 「런닝머신」은 부위가 `전신 · 유산소` 라
  // `bodyPartOf` 가 '기타'로 돌려주는데, 그것은 못 알아본 것이 아니다
  if (isCardioName(exercise)) return 'cardio';
  const e = entryOf(exercise);
  if (e && e.cardio) return 'cardio';
  if (bodyPartOf(exercise) === '기타') return 'other';
  if (e) {
    const s = groupSide(e.group);
    if (s) return s;
    // 묶음이 **기구 이름**이면 축은 운동 이름 안에 있다 (`GEAR_GROUPS`)
    if (GEAR_GROUPS.includes(e.group)) return 이름속묶음(exercise) || 'nosplit';
    return 'nosplit';
  }

  // 사전 이름을 품지 않았다 — **줄여 적은 것**일 수 있다 (「벤치」 · 「랫풀」)
  const 후보 = 줄임후보쪽(exercise);
  if (후보.size === 1) return [...후보][0];
  // 갈리면 **고르지 않는다** (「데드」 = 데드행? 데드리프트?)
  if (후보.size > 1) return 'nosplit';
  return 'nodict';
}

/** 가려지는 넷 — 화면이 이 차례로 그린다 */
export const SIDES = ['push', 'pull', 'leg', 'core'];


/** 보는 창 — **최근 4주.** 지도의 막대(최근 이레)보다 넓게 본다 */
export const BALANCE_DAYS = 28;

/**
 * 최근 `days` 일의 **세트 수**를 미는/당기는/하체/코어로 가른다.
 *
 * 돌려주는 것 —
 *   sets     `{ push, pull, leg, core }` 세트 수
 *   upper    밀기 + 당기기 (상체)
 *   total    가려진 세트 수 전부
 *   ratio    밀기 ÷ 당기기 — **당기기가 0 이면 null** (∞ 를 화면에 적지 않는다)
 *   skipped  `{ cardio, other, nodict, nosplit }` **줄 수** (세트가 아니다)
 *   days     본 창
 *
 * 앞날 기록은 세지 않는다 (`today` 를 주면 그 뒤를 버린다 — 지도 · 선과 같은 선).
 */
export function pushPullBalance(workouts, { today = null, days = BALANCE_DAYS } = {}) {
  const sets = { push: 0, pull: 0, leg: 0, core: 0 };
  const skipped = { cardio: 0, other: 0, nodict: 0, nosplit: 0 };

  // 창의 첫날. **밀리초로 세지 않는다** — 하루를 `86400000` 으로 적는 자리가 이
  // 앱에 이미 열한 벌이고 `check-daygap` 이 **새로 생기는 것을 막는다**(11/10 에
  // 세운 자다. 붙인 그 자리에서 이 자가 나를 집었다). `atDay` 는 날짜 열쇠를
  // **한낮으로** 읽고 못 읽는 값은 `null` 로 돌려준다 — 서머타임에서 하루가
  // 밀리는 것과 `2026-13-40` 이 조용히 넘치는 것을 둘 다 막는 공용 손이다
  let from = null;
  if (today) {
    const base = atDay(today);
    if (base) {
      const back = new Date(base);
      back.setDate(back.getDate() - (days - 1));
      from = dateKey(back);
    }
  }

  for (const [date, list] of Object.entries(workouts || {})) {
    if (today && date > today) continue;          // 앞날은 아직 한 것이 아니다
    if (from && date < from) continue;            // 창 밖
    for (const r of list || []) {
      const side = sideOf(r?.exercise);
      if (!SIDES.includes(side)) { skipped[side] = (skipped[side] || 0) + 1; continue; }
      const n = Number(r?.sets);
      // 세트가 안 적힌 줄은 **셀 것이 없다.** 가려지기는 했으니 안 가린 줄로도
      // 세지 않는다 — 0 을 더하고 지난다
      sets[side] += Number.isFinite(n) && n > 0 ? n : 0;
    }
  }

  const upper = sets.push + sets.pull;
  const total = upper + sets.leg + sets.core;
  // **한쪽이 0 이면 배수가 없다.** 「밀기 10 : 당기기 0」은 ∞ 배이고 ∞ 는 수가
  // 아니다 — 0 으로 두면 화면이 `1 : Infinity` 를 적는다(붙인 자리에서 잡았다).
  // 어느 쪽이 비었는지는 세트 수가 말하므로 화면이 그 줄을 따로 쓴다
  const ratio = sets.push > 0 && sets.pull > 0 ? sets.push / sets.pull : null;

  return { sets, upper, total, ratio, skipped, days };
}

/** 「2.5 : 1」. 당기기가 0 이면 null — 화면이 그 자리에 다른 말을 쓴다 */
export function ratioLabel(ratio) {
  if (ratio === null || !Number.isFinite(ratio)) return null;
  // 1 아래면 당기는 쪽이 많다는 뜻이다 — **뒤집어 적는다**(「1 : 2.5」가 아니라
  // 「밀기 1 : 당기기 2.5」로 읽히게 화면이 이름을 붙인다)
  const r = ratio >= 1 ? ratio : 1 / ratio;
  const n = r >= 10 ? Math.round(r) : Math.round(r * 10) / 10;
  return ratio >= 1 ? `${n} : 1` : `1 : ${n}`;
}
