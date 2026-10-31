// ── 안전한 localStorage 접근 ──
//
// 쿠키·사이트 데이터를 막아둔 브라우저에서는 localStorage 를 "읽는 것"조차
// SecurityError 를 던진다 (Chrome 의 "모든 쿠키 차단", allow-same-origin 없는
// iframe, dom.storage.enabled=false 인 파이어폭스). 용량이 차면 setItem 도 던진다.
//
// 던진 자리가 모듈 최상위나 요청 인터셉터면 앱 전체가 흰 화면이 된다.
// 그래서 실패를 삼키고 최소한 메모리 상태는 살린다. 성공 여부를 돌려준다.

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

/**
 * **이 브라우저가 담아주는가** (2026-10-31).
 *
 * 쿠키·사이트 데이터를 막아둔 브라우저에서는 쓰는 것도 읽는 것도 던진다.
 * 「담아두면 좋은 값」은 조용히 잃어도 되지만(검색 기록 · 고른 바 무게),
 * **담겼다는 것이 기능의 전부인 자리**가 있다 — 앱 잠금이 그렇다.
 * 거기서는 **걸기 전에 물어봐야 한다.**
 *
 * 써보고 · 읽어보고 · 치운다. 앱의 열쇠 접두사를 안 쓴다 —
 * 남는 값이 아니라 **그 자리에서 치우는 값**이다
 */
export function canStore() {
  const probe = '__probe__';
  try {
    localStorage.setItem(probe, '1');
    const back = localStorage.getItem(probe) === '1';
    localStorage.removeItem(probe);
    return back;
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

// 쿠키도 같은 이유로 던진다 (샌드박스 iframe). 못 읽으면 빈 문자열로 본다.
export function readCookies() {
  try {
    return document.cookie || '';
  } catch {
    return '';
  }
}
