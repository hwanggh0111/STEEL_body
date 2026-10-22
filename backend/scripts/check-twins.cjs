// **같은 이름의 숫자가 서버와 화면에서 같은가** (2026-10-22).
//
//   npm run twins     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 오늘 하루에 이 모양으로 **여섯 번** 물렸다 —
//
//   · 보안 보고서가 고치기 전 버그를 「지금 쓰는 방어」로 적고 있었다 (10/21)
//   · 알림 기본값이 라우트에만 있고 판단하는 쪽에는 없어서 **알림이 한 통도 안 갔다**
//   · 운동 칸을 다듬는 자가 두 벌이라 **파일로는 음수 무게가 들어왔다**
//   · 부위 맞히는 자가 서버/화면 두 벌이라 **화면만 고쳤더니 60개가 어긋났다**
//   · 백업 머리글이 「Render 에서는 못 돌린다」고 적어두고 있었다 (오늘 고쳤다)
//   · 1RM 「10회 이하에서 정확」이라 적어두고 등수는 36회까지 환산했다
//
// 같은 값이 두 곳에 적히면 **반드시 어긋난다.** 그리고 어긋난 것을 아는 길은
// 「그 날 그 화면을 쓰는 사람」뿐이다. 그래서 **이름이 같은 숫자를 전부 견준다.**
//
// 이 검사는 지금 어긋난 것을 못 찾아도 **나중에 어긋나는 것을 잡는다** — 값이 하나
// 바뀌는 날 FAIL 한다. 오늘 서버 쪽 부위 맞히기를 빼먹었을 때 9/29 에 세워둔 검사가
// 나를 잡아준 것과 같은 자리다.
const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', 'dist', 'android'].includes(e.name)) walk(p, out); continue; }
    if (/\.(js|jsx|cjs|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

const ROOT = path.join(__dirname, '..', '..');
const back = walk(path.join(ROOT, 'backend', 'src'));
const front = walk(path.join(ROOT, 'frontend', 'src'));

// `const NAME = 12;` · `const NAME = 2 * 1024 * 1024;` 처럼 **셈으로 적힌 숫자**만 모은다.
// 글자와 목록은 뜻이 갈리는 일이 많아 여기서 보지 않는다 (이름표는 `check-data` 가 본다)
const NUM = /(?:export\s+)?const\s+([A-Z][A-Z0-9_]{2,})\s*=\s*([\d_\s*+/.()-]+);/g;

function numsOf(files) {
  const map = new Map();   // 이름 → [{ file, value }]
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(NUM)) {
      const [, name, expr] = m;
      let v;
      // eslint-disable-next-line no-new-func
      try { v = Function(`"use strict";return (${expr})`)(); } catch { continue; }
      if (!Number.isFinite(v)) continue;
      if (!map.has(name)) map.set(name, []);
      map.get(name).push({ file: path.relative(ROOT, f), value: v });
    }
  }
  return map;
}

// **뜻이 다른데 이름만 같은 것**은 여기 적어 뺀다. 까닭을 같이 적는다 —
// 그러지 않으면 다음 사람이 「왜 빠졌지」를 알 수 없다
const 다른뜻 = {
  MAX_ITEMS: '서버는 점검 20개 · 화면은 루틴 운동 수 — 서로 다른 것이다',
  MAX_ROWS: '서버는 가져오기 줄 수 — 화면에 같은 이름의 딴 값이 있다',
  CACHE_MAX: '각자 제 캐시 크기다 — 맞출 까닭이 없다',
  MAX_LEN: '칸마다 다르다',
  TICK_MS: '서버는 1분 타이머 · 화면은 그리는 간격',
  MAX: '이름이 너무 흔하다',
  NAME_MAX: '서버는 운동명 100자 · 화면은 소리 이름 6자 — 서로 다른 칸이다',
};

const b = numsOf(back);
const f2 = numsOf(front);

const 짝 = [];
for (const [name, bl] of b) {
  if (!f2.has(name)) continue;
  if (다른뜻[name]) continue;
  const fl = f2.get(name);
  // 한쪽에 여러 벌이 있으면 그것부터 문제다 — 다 모아 견준다
  const values = [...new Set([...bl, ...fl].map((x) => x.value))];
  짝.push({ name, values, where: [...bl, ...fl] });
}

console.log(`── 서버와 화면에 **같은 이름의 숫자**가 있는 자리: ${짝.length} ──`);
const 어긋난것 = 짝.filter((t) => t.values.length > 1);
for (const t of 짝) {
  const 같나 = t.values.length === 1;
  console.log(`   ${같나 ? '같다 ' : '다르다'} ${t.name} = ${t.values.join(' / ')}`);
  if (!같나) t.where.forEach((w) => console.log(`        ${w.file} → ${w.value}`));
}
ok('어긋난 자리', 어긋난것.map((t) => t.name), []);

// 뺀 것도 적어둔다 — 조용히 빼면 그 자리가 영영 안 보인다
console.log('\n── 이름만 같고 뜻이 다른 것 (일부러 뺐다) ──');
for (const [name, why] of Object.entries(다른뜻)) {
  if (b.has(name) && f2.has(name)) console.log(`   ${name} — ${why}`);
}

// 짝이 하나도 없으면 이 검사가 **아무것도 안 재고 있다는 뜻**이다 (오늘 그런 검사를 고쳤다)
ok('재고 있는 짝이 있다', 짝.length >= 5, true);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
