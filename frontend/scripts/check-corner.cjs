// **모서리가 한결같은가** (2026-11-11)
//
//   npm run corner     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 이 앱은 **모서리를 굴리지 않는다.** `globals.css` 가 `--radius: 2px` ·
// `--radius-lg: 4px` 로 못 박아 뒀고, 검정과 금에 각진 모서리가 이 앱의 결이다.
//
// 그런데 **토큰을 안 쓰고 숫자를 직접 적은 자리가 열다섯**이었다 — 6 · 8 · 11 · 13.
// 그중 열은 단추 · 딱지 · 칸 · 안내 상자라, **같은 단추가 화면마다 다르게 둥글었다.**
// 11/11 에 기능 ② 의 새 상자가 `borderRadius: 8` 로 들어온 것을 잡으면서 세어 보니
// 이미 그만큼 퍼져 있었다 — 한 자리를 잡아도 **다음 사람이 또 8을 적는다.**
//
// 이 류가 조용한 까닭은 **한 화면만 보면 멀쩡하기** 때문이다. 둥근 상자 하나는
// 그 자체로 이상하지 않다. 나란히 놓아야 보이고, 나란히 놓는 사람이 없다.
//
// ── 일부러 둥근 것은 적어둔다 ──
//
// 스위치의 알약과 손잡이 · 알림 수 딱지 · 아이콘 자리는 **둥근 것이 맞다.**
// `.tap-tight`(일부러 작게 둔 단추)와 같은 결로, **목록에 적힌 것만** 넘긴다 —
// 적어두면 다음 사람이 「왜 이것만 둥근가」를 묻지 않아도 된다.

const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const ROOT = path.join(__dirname, '..');

// 토큰이 그대로 있는가 — 이 검사의 바닥이다
const css = fs.readFileSync(path.join(ROOT, 'src', 'styles', 'globals.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
console.log('── 토큰이 그대로인가 ──');
ok('--radius 가 2px 다', /--radius:\s*2px/.test(css), true);
ok('  --radius-lg 가 4px 다', /--radius-lg:\s*4px/.test(css), true);

// **일부러 둥근 자리.** 파일과 값으로 적는다 — 줄 번호는 위가 한 줄 늘면 어긋난다
const 둥근것이맞다 = {
  'src/components/RestTimer.jsx':      [11, 8],  // 쉬는 소리 스위치 — 알약과 손잡이
  'src/pages/RemindersPage.jsx':       [11, 8],  // 알림 스위치 — 같은 꼴
  'src/pages/SettingsPage.jsx':        [13],     // 설정함 스위치 (44×25 라 13)
  'src/components/TabBar.jsx':         [8],      // 안 읽은 수 딱지 — 작은 동그라미
  'src/pages/OauthEmailPage.jsx':      [8],      // 28×28 아이콘 자리
};
// 알약(`999`)은 어디서든 맞다 — 「통째로 둥글게」라는 뜻이고 값이 아니다
const 알약 = 999;
// 2 · 4 는 토큰과 같은 수다. 1 · 3 은 1px 선과 작은 칸의 자리 — 굴림이 아니다
const 토큰만한수 = 4;

console.log('');
console.log('── 토큰 안 쓰고 직접 적은 모서리 ──');
const 어긋난자리 = [];
const 적어둔것중안쓰는것 = [];
const walk = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) { walk(full); continue; }
    if (!/\.jsx?$/.test(f.name)) continue;
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    const src = fs.readFileSync(full, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const m of line.matchAll(/borderRadius:\s*(\d+(?:\.\d+)?)/g)) {
        const v = Number(m[1]);
        if (v === 알약 || v <= 토큰만한수) continue;
        if ((둥근것이맞다[rel] || []).includes(v)) continue;
        어긋난자리.push(rel + ':' + (i + 1) + ' → ' + v);
      }
    });
  }
};
walk(path.join(ROOT, 'src'));
ok('어긋난 자리', 어긋난자리, []);
console.log('     ↑ `var(--radius)`(2px) 나 `var(--radius-lg)`(4px) 를 쓴다.');
console.log('       일부러 둥글어야 하면 이 검사의 `둥근것이맞다` 에 까닭과 함께 적는다');

// 적어둔 예외가 **실제로 아직 거기 있는가** — 없어진 예외를 들고 있으면
// 목록이 「그렇게 돼 있다」고 거짓으로 말한다 (`.tap-tight` 자와 같은 결)
console.log('');
console.log('── 적어둔 예외가 아직 쓰이는가 ──');
for (const [rel, vals] of Object.entries(둥근것이맞다)) {
  const full = path.join(ROOT, rel);
  const src = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
  for (const v of vals) {
    if (!new RegExp('borderRadius:\\s*' + v + '\\b').test(src)) 적어둔것중안쓰는것.push(rel + ' → ' + v);
  }
}
ok('없어진 예외를 들고 있지 않다', 적어둔것중안쓰는것, []);

console.log('');
if (bad === 0) console.log('모서리가 한결같습니다');
else console.log(bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
