// ── 안전한 localStorage 접근 ──
//
// 쿠키·사이트 데이터를 막아둔 브라우저에서는 localStorage 를 "읽는 것"조차
// SecurityError 를 던진다 (Chrome 의 "모든 쿠키 차단", allow-same-origin 없는
// iframe, dom.storage.enabled=false 인 파이어폭스). 용량이 차면 setItem 도 던진다.
//
// 던진 자리가 모듈 최상위나 요청 인터셉터면 앱 전체가 흰 화면이 된다.
// 그래서 실패를 삼키고 최소한 메모리 상태는 살린다. 성공 여부를 돌려준다.
//
// 원래 pachinkoData 안에 있던 것을 여기로 옮겼다 — 인증·API 계층에서도 써야 하는데,
// 그쪽이 파칭코 상품표까지 끌어오게 둘 수는 없어서다. pachinkoData 는 다시 내보낸다.

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

// 쿠키도 같은 이유로 던진다 (샌드박스 iframe). 못 읽으면 빈 문자열로 본다.
export function readCookies() {
  try {
    return document.cookie || '';
  } catch {
    return '';
  }
}
