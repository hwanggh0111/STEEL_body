// 건강 앱(헬스 커넥트)에서 **체중·체지방률을 가져온다** (2026-10-16)
//
// ── 왜 ──
//
// 인바디를 재고 나면 체중 · 체지방률 · 골격근량을 **손으로 옮겨 적는다.** 그런데
// 체중계(삼성 · 샤오미 · 인바디 앱)는 이미 그 값을 **헬스 커넥트에 넣고 있다.**
// 같은 숫자를 사람이 두 번 치고 있는 것이다 — 그리고 두 번 치면 틀린다.
//
// ── 가져오는 것 둘뿐 ──
//
//   체중        weight          kg
//   체지방률    body-fat        % (0~100)
//
// **골격근량은 안 가져온다.** 헬스 커넥트에 있는 것은 `lean-body-mass`(제지방량)이고
// 이것은 **골격근량이 아니다** — 뼈 · 장기 · 수분이 다 들어 있어서 대개 골격근량의
// 두 배쯤이다. 칸 이름이 비슷하다고 밀어 넣으면 **그래프가 거짓말을 한다.**
// 이 앱의 규칙은 하나다: 지어내지 않는다, 적혀 있는 것만 말한다
// (`data/nextSet.js` 머리글). 골격근량은 그대로 손으로 적는다.
//
// 권한을 둘만 받는 이유도 같다 — **적어둔 권한은 동의 화면에 그대로 다 뜬다.**
// 쓰지도 않을 걸음수 · 심박을 같이 물으면 사람은 그 자리에서 거절한다.
//
// ── 출시와의 관계 (중요) ──
//
// **건강 권한은 플레이스토어가 따로 심사한다**(건강 앱 선언 양식 · 개인정보처리방침에
// 그 항목이 적혀 있어야 한다). 첫 출시에 끼우면 가장 긴 줄이 된다 — 그래서 **빼는 법**을
// `docs/PLAY-STORE.md` 에 적어뒀다(플러그인을 지우고 다시 `cap sync` 하면 끝이고,
// 이 파일은 **저절로 꺼진다** — 아래 `load()` 가 못 찾으면 조용히 없는 것으로 본다).
//
// ── 브라우저에서는 ──
//
// 아무 일도 안 한다. 단추도 안 그린다 (`healthReady()` 가 false 다).

import { Capacitor } from '@capacitor/core';

/** 우리가 묻는 권한 — **쓰는 것만.** 적어둔 것은 동의 화면에 전부 뜬다 */
export const HEALTH_PERMS = ['READ_WEIGHT', 'READ_BODY_FAT'];

let plugin = null;
let missing = false;        // 플러그인을 지우고 빌드한 판 (출시용)

// 쓸 때 받는다. 맨 위에서 받으면 브라우저로 여는 사람도 안 쓸 조각을 내려받는다
async function load() {
  if (plugin) return plugin;
  if (missing) return null;
  try {
    const mod = await import('capacitor-health');
    plugin = mod.Health;
    return plugin;
  } catch {
    // **플러그인이 아예 없는 판**이다 (첫 출시용으로 뺀 경우). 다시 묻지 않는다
    missing = true;
    return null;
  }
}

/** 앱인가 (브라우저에는 헬스 커넥트가 없다). */
function isApp() {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

/**
 * 이 폰에서 건강 앱을 쓸 수 있나.
 *
 * 셋이 다 있어야 한다 — 앱으로 열었고 · 플러그인이 실려 있고 · 폰에 헬스 커넥트가
 * 깔려 있다. 하나라도 없으면 **단추를 아예 안 그린다**: 눌러도 아무 일이 안 나는
 * 줄을 두지 않는다 (설정함의 「앱 잠금」과 같은 규칙).
 */
export async function healthReady() {
  if (!isApp()) return false;
  const api = await load();
  if (!api) return false;
  try {
    const { available } = await api.isHealthAvailable();
    return !!available;
  } catch {
    return false;
  }
}

/** 헬스 커넥트가 안 깔린 폰에게 받는 자리를 열어준다. */
export async function openHealthStore() {
  const api = await load();
  try { await api?.showHealthConnectInPlayStore(); } catch { /* 못 열어도 할 일이 없다 */ }
}

/** 헬스 커넥트 설정(권한을 손으로 고치는 자리). 두 번 거절하면 여기서만 풀 수 있다. */
export async function openHealthSettings() {
  const api = await load();
  try { await api?.openHealthConnectSettings(); } catch { /* 같음 */ }
}

/** 권한을 받았나 물어본다. 안 받았으면 한 번 묻는다. 돌려주는 것은 `true/false`. */
export async function askHealth() {
  const api = await load();
  if (!api) return false;
  try {
    const got = await api.requestHealthPermissions({ permissions: HEALTH_PERMS });
    return hasAll(got);
  } catch {
    return false;
  }
}

/**
 * 돌려준 모양이 판마다 다르다 — `[{READ_WEIGHT: true}, …]` 이기도 하고
 * `{permissions: {READ_WEIGHT: true}}` 이기도 하다. **모양을 믿지 않고 훑는다.**
 * (이 앱은 서버가 준 모양을 화면이 다르게 읽는 일로 여러 번 당했다 — `data/plans.js`)
 */
function hasAll(res) {
  const flat = {};
  const eat = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(eat); return; }
    Object.entries(o).forEach(([k, v]) => {
      if (typeof v === 'boolean') flat[k] = v;
      else eat(v);
    });
  };
  eat(res);
  return HEALTH_PERMS.every((p) => flat[p] === true);
}

/** 기록 목록에서 **가장 최근 것** 하나. 없으면 null. */
function latestOf(records) {
  const list = Array.isArray(records) ? records : [];
  let best = null;
  for (const r of list) {
    const v = Number(r?.value);
    if (!Number.isFinite(v)) continue;
    if (!best || String(r.startDate) > String(best.startDate)) best = { ...r, value: v };
  }
  return best;
}

/**
 * 최근 `days` 일 안에서 가장 최근 체중 · 체지방률.
 *
 * 돌려주는 것: `{ weight, fatPct, at, source }` — 없는 값은 `null` 이다.
 * **없는 값을 0 으로 채우지 않는다.** 0kg 이 적히면 그래프가 바닥으로 떨어진다.
 *
 * 왜 기간을 자르나 — 반년 전 체중을 「오늘 잰 것」으로 적으면 안 된다.
 * 기본 30일이고, 그보다 오래된 것밖에 없으면 **없는 것으로 본다**(아래 화면이
 * 「최근 30일 안에 잰 것이 없어요」라고 말한다).
 */
export async function latestBody(days = 30) {
  const api = await load();
  if (!api) return null;
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const range = { startDate: start.toISOString(), endDate: end.toISOString() };

  const pick = async (dataType) => {
    try {
      const res = await api.queryRecords({ ...range, dataType });
      return latestOf(res?.records);
    } catch {
      return null;                 // 그 한 가지만 권한이 없을 수 있다
    }
  };

  const [w, f] = await Promise.all([pick('weight'), pick('body-fat')]);
  if (!w && !f) return null;

  // 잰 시각과 어디서 온 값인지는 **같이 보여준다.** 숫자만 채워 넣으면 사람은
  // 그것이 언제 잰 것인지 모른 채 저장한다
  const newest = [w, f].filter(Boolean).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))[0];
  return {
    weight: w ? round1(w.value) : null,
    fatPct: f ? round1(f.value) : null,
    at: newest?.startDate || null,
    source: newest?.sourceName || '',
  };
}

const round1 = (n) => Math.round(Number(n) * 10) / 10;
