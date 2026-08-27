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
  /formaction\s*=/gi,      // form action hijack
  /srcdoc\s*=/gi,          // iframe srcdoc
  /xlink:href/gi,          // SVG xlink
  /xmlns/gi,               // XML namespace injection
  /base\s+href/gi,         // base tag hijack
  /meta\s+http-equiv/gi,   // meta refresh/redirect
  /action\s*=\s*["']?javascript/gi, // form action javascript
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

// 여러 줄을 받는 칸용.
//
// 위의 sanitize 는 3단계에서 연속 공백을 하나로 눌러버린다. 한 줄짜리 이름에는
// 맞지만 여러 줄에는 안 맞는다 — 버그 재현 절차를 줄로 나눠 적으면 한 덩어리가 되고,
// 관리자 답변도 문단이 통째로 뭉개진다. 화면은 줄바꿈을 살려 그리고 있는데
// 저장하는 쪽에서 지우고 있었다.
//
// 줄 단위로 sanitize 를 돌리고 줄바꿈만 되살린다. 빈 줄이 세 줄 넘게 이어지면
// 두 줄로 줄인다 — 여백으로 목록을 밀어내지 못하게.
function sanitizeMultiline(str) {
  if (typeof str !== 'string') return '';
  return str
    .split(/\r?\n/)
    .map(line => sanitize(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 사람이 붙이는 이름 한 줄 — 운동명 · 루틴명 · 닉네임.
//
// 이 칸들은 저마다 `!name` 과 `name.length > N` 으로만 막고 있었다. 셋 다 샌다:
//   - `'   '` 는 `!name` 을 통과하고, 새니타이즈가 빈 문자열로 만들어 **이름 없는 기록**이 남는다
//   - 배열은 `.length` 가 있어서 길이 검사도 통과한다 (`['a','b'].length === 2`)
//   - `.trim()` 을 먼저 부르는 자리(닉네임)는 배열을 받으면 그대로 **500** 이 났다
//   - `'<<<>>>'` 처럼 새니타이즈하면 아무것도 안 남는 글자도 빈 이름이 된다
//
// 바로 옆의 무게 칸은 같은 이유로 이미 막아뒀는데(`normalizeWeight`) 이름 칸만 무방비였다.
// 새니타이즈까지 끝낸 뒤에 비었는지 보는 것이 요점이다 — 검사와 저장이 같은 값을 봐야 한다.
//
// 쓸 수 있으면 다듬은 이름을, 아니면 null 을 준다. 부르는 쪽이 왜 안 되는지를 말한다.
function cleanName(raw, maxLen) {
  if (typeof raw !== 'string') return null;
  if (raw.length > maxLen) return null;
  const clean = sanitize(raw);
  return clean || null;
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

module.exports = { sanitize, sanitizeMultiline, sanitizeObj, cleanName };
