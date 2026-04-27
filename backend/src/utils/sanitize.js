/**
 * 입력값 새니타이즈 유틸리티
 * HTML 태그, 이벤트 핸들러, javascript: URI, 위험 패턴 모두 제거
 */

// 위험 패턴 (이벤트 핸들러, javascript URI, 스크립트 관련)
const DANGEROUS_PATTERNS = [
  /on\w+\s*=/gi,           // onerror=, onclick=, onfocus= 등
  /javascript\s*:/gi,      // javascript: URI
  /vbscript\s*:/gi,        // vbscript: URI
  /expression\s*\(/gi,     // CSS expression()
  /eval\s*\(/gi,           // eval()
  /alert\s*\(/gi,          // alert()
  /document\s*\./gi,       // document.cookie 등
  /window\s*\./gi,         // window.location 등
  /\.innerHTML/gi,         // innerHTML
  /\.outerHTML/gi,         // outerHTML
  /\.fromCharCode/gi,      // String.fromCharCode
  /data\s*:\s*text\/html/gi, // data:text/html
];

function sanitize(str) {
  if (typeof str !== 'string') return '';
  // 0단계: URL 인코딩 디코딩 (이중 인코딩 우회 방지)
  let clean = str;
  try {
    let decoded = decodeURIComponent(clean);
    while (decoded !== clean) { clean = decoded; decoded = decodeURIComponent(clean); }
  } catch {}
  // 1단계: HTML 태그 관련 문자 제거
  clean = clean.replace(/[<>"'&`]/g, '');
  // 2단계: 위험 패턴 제거
  for (const pattern of DANGEROUS_PATTERNS) {
    clean = clean.replace(pattern, '');
  }
  // 3단계: 연속 공백 정리
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

function sanitizeObj(obj) {
  if (typeof obj === 'string') return sanitize(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObj);
  if (typeof obj === 'object' && obj !== null) {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      // 위험한 키 이름 제거
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      clean[sanitize(k)] = sanitizeObj(v);
    }
    return clean;
  }
  return obj;
}

module.exports = { sanitize, sanitizeObj };
