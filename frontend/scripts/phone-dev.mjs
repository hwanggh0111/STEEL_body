// 진짜 폰으로 개발 서버를 열려면 무엇이 필요한가 (2026-10-15)
//
//   npm run phone
//
// ── 왜 ──
//
// 틀은 틀일 뿐이다. `/dev` 의 기기 틀로 레이아웃은 잡히지만 **카메라 · 큰 사진 ·
// 오프라인 · 손가락으로 닿는 크기**는 실기기에서만 밝혀진다. 그런데 폰으로 열려면
// 세 가지가 맞아야 하고, 안 열릴 때 **어느 것이 틀렸는지가 안 보인다** —
// 주소가 틀렸는지, 와이파이가 다른지, 방화벽이 막는지.
//
// 그래서 한 번에 다 적어준다. **고치는 명령까지 그대로 적는다** — 방화벽 규칙은
// 관리자 창에서만 되므로 여기서 직접 걸지 않고, 붙여 쓸 줄을 준다.

import os from 'node:os';
import { execFileSync } from 'node:child_process';

const PORT = Number(process.env.PORT || 5173);
const API = 4000;
const RULE = 'BLACK IRON 개발 서버 (5173)';

const 금 = (s) => `\x1b[33m${s}\x1b[0m`;
const 밝 = (s) => `\x1b[1m${s}\x1b[0m`;
const 흐 = (s) => `\x1b[90m${s}\x1b[0m`;
const 초 = (s) => `\x1b[32m${s}\x1b[0m`;
const 빨 = (s) => `\x1b[31m${s}\x1b[0m`;

// ── 1. 이 PC 의 사설 주소 ──
const urls = [];
for (const [name, list] of Object.entries(os.networkInterfaces())) {
  for (const n of list || []) {
    if (n.family !== 'IPv4' || n.internal) continue;
    if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address)) continue;
    urls.push({ name, address: n.address });
  }
}

console.log('');
console.log(밝('폰으로 열 주소'));
if (!urls.length) {
  console.log('  ' + 빨('와이파이·랜 주소가 안 잡힙니다') + ' — 와이파이에 붙고 다시 해보세요');
} else {
  for (const u of urls) {
    console.log('  ' + 금(`http://${u.address}:${PORT}/`) + '   ' + 흐(u.name));
  }
  console.log('  ' + 흐(`폰 미리보기 화면은  http://${urls[0].address}:${PORT}/dev`));
}

// ── 2. 방화벽 ──
//
// **윈도가 막는 것이 제일 흔한 까닭이다.** node 가 처음 뜰 때 「액세스 허용」 창이
// 뜨는데, 그때 「취소」를 누르면 거부 규칙이 남아서 그 뒤로는 창도 안 뜬다.
console.log('');
console.log(밝('윈도 방화벽'));
let 열림 = null;
try {
  const out = execFileSync('powershell', [
    '-NoProfile', '-Command',
    `try { $r = Get-NetFirewallRule -DisplayName '${RULE}' -ErrorAction Stop; if ($r.Enabled -eq 'True') { 'OPEN' } else { 'DISABLED' } } catch { 'NONE' }`,
  ], { encoding: 'utf8', timeout: 15000 }).trim();
  열림 = out.includes('OPEN') ? true : out.includes('DISABLED') ? false : null;
} catch {
  열림 = null;                       // 못 물어봤다 — 모른다고 말한다
}

if (열림 === true) {
  console.log('  ' + 초('열려 있습니다') + ' ' + 흐(`(규칙: ${RULE})`));
} else {
  if (열림 === false) console.log('  ' + 빨('규칙이 꺼져 있습니다'));
  else console.log('  ' + 흐('규칙이 없습니다 (그래도 열릴 수 있습니다 — 폰에서 먼저 해보세요)'));
  console.log('');
  console.log('  안 열리면 ' + 밝('관리자 PowerShell') + ' 에 이 줄을 붙여 넣으세요 —');
  console.log('');
  console.log('  ' + 금(`New-NetFirewallRule -DisplayName "${RULE}" -Direction Inbound -Action Allow \``));
  console.log('  ' + 금(`    -Protocol TCP -LocalPort ${PORT},${API} -Profile Private`));
  console.log('');
  console.log('  ' + 흐('`-Profile Private` 이라 집·회사 와이파이에서만 열립니다.'));
  console.log('  ' + 흐('공용 와이파이(카페 등)에서는 안 열립니다 — 그게 맞습니다.'));
}

// ── 3. 폰에서 지킬 것 ──
console.log('');
console.log(밝('폰에서'));
console.log('  1. ' + '폰이 ' + 밝('이 PC 와 같은 와이파이') + ' 에 있어야 합니다 (LTE·5G 로는 안 됩니다)');
console.log('  2. ' + `서버 둘이 떠 있어야 합니다 — ${흐('frontend: npm run dev')} · ${흐('backend: npm start')}`);
console.log('  3. ' + '주소는 ' + 금('http') + ' 입니다 (https 가 아닙니다). 폰 브라우저가 검색으로 넘기면 주소 끝에 ' + 금('/') + ' 를 붙이세요');
console.log('');
console.log(흐('  · 서비스 워커는 개발 모드에서 스스로 지워집니다 — 폰에 옛 화면이 남지 않습니다'));
console.log(흐('  · 소셜 로그인은 콘솔에 이 주소가 등록돼 있어야 합니다. 이메일 로그인은 그냥 됩니다'));
console.log(흐('  · 앱 껍데기로 보려면: CAP_SERVER_URL=http://<위 주소>:' + PORT + ' npx cap sync android'));
console.log('');
