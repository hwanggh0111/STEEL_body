// **실제 기록으로 재본다** — 밀기 · 당기기 · 하체 · 코어 (2026-11-09).
//
//   cd frontend && npm run measure
//
// ── 왜 이 자리가 있나 ──
//
// 이것은 **자(검사)가 아니다.** `npm run check` 에 넣지 않는다 — 통과/실패가 없고,
// 돌릴 때마다 답이 달라지는 것이 맞다(기록이 쌓이니까).
//
// 11/09 에 「밀기와 당기기의 비율」 기능을 연구하면서 **「밀기가 네 배」라고 적었다가
// 그것이 지어낸 수임을 깨달았다.** 기능 판단을 추측으로 하지 않으려면 **재봐야** 한다.
// 그래서 재는 자를 남긴다 — 검토하는 쪽이 내 말을 믿지 않고 **직접 돌려볼 수 있게.**
//
// ── 무엇을 어떻게 가르나 ──
//
// 이름 → 사전 항목은 **앱의 자**를 쓴다(`bodyPartOf` · `EXERCISE_DICT`). 그래야
// 「벤치」처럼 줄여 적은 것도 앱과 똑같이 찾는다 — 처음에 임시 분류기로 재서
// 「29%가 안 가려진다」고 잘못 셌다(실제는 9%).
//
// 가르는 자는 **묶음**(`group`)이다. `part` 로는 못 가른다 — `part: 팔` 안에
// 컬(당기기)과 삼두(밀기)가 같이 있다.
//
// **못 가르는 것은 어느 쪽에도 안 넣는다.** 사이드 레이즈는 미는 것도 당기는 것도
// 아니다(벌리는 것). 몇 줄인지 적어서 보여준다 — 조용히 한쪽에 넣으면 수가 거짓이 된다.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const DB = path.join(__dirname, '..', '..', 'backend', 'blackiron.json');

const bundle = (rel, out) => {
  const file = path.join(ROOT, out);
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, rel)], bundle: true, format: 'cjs',
    outfile: file, platform: 'node', logLevel: 'silent',
  });
  const m = require(file);
  fs.unlinkSync(file);
  return m;
};

const BP = bundle('src/data/bodyPart.js', '.mpp-bp.cjs');
const DX = bundle('src/data/exerciseDict.js', '.mpp-dx.cjs');

// 묶음 → 어느 쪽인가. **사전에 운동을 더할 때 묶음만 적으면 저절로 들어온다**
const PUSH = new Set(['벤치프레스', '프레스', '머신프레스', '푸시업', '딥스', '플라이', '머신플라이', '삼두', '케이블']);
const PULL = new Set(['로우', '풀다운', '풀업', '컬', '승모근']);
const LEG = new Set(['스쿼트', '런지', '하체머신', '둔근', '종아리', '햄스트링', '데드리프트']);
const CORE = new Set(['코어']);

const norm = (s) => String(s || '').toLowerCase().replace(/[\s.,!?~·・\-_'"()]/g, '');

// 사전 이름 → 항목. 앱의 `bodyPartOf` 와 같은 선으로 **품은 이름**도 본다
const byNorm = new Map();
for (const e of DX.EXERCISE_DICT) {
  for (const n of [e.ko, e.en, ...(e.alias || [])]) if (n) byNorm.set(norm(n), e);
}
const entryOf = (name) => {
  const n = norm(name);
  if (!n) return null;
  if (byNorm.has(n)) return byNorm.get(n);
  let hit = null;
  for (const [k, e] of byNorm) {
    if (k.length < 2) continue;
    if (n.includes(k) || k.includes(n)) {
      if (!hit || k.length > norm(hit.ko).length) hit = e;
    }
  }
  return hit;
};

const sideOf = (name) => {
  const e = entryOf(name);
  if (e && e.cardio) return 'cardio';
  if (BP.bodyPartOf(name) === '기타') return 'other';
  if (!e) return 'nodict';
  if (PUSH.has(e.group)) return 'push';
  if (PULL.has(e.group)) return 'pull';
  if (LEG.has(e.group)) return 'leg';
  if (CORE.has(e.group)) return 'core';
  return 'nosplit';
};

/** 무게 글자에서 수를 꺼낸다 (`personalRecord.parseWeight` 와 같은 선) */
const kgOf = (w) => {
  const m = /\d+(?:\.\d+)?/.exec(String(w || '').replace(/[,\s]/g, ''));
  return m ? Number(m[0]) : null;
};

/** 'YYYY-MM-DD' → 그 주 월요일 (앱과 같다 — 주는 월요일에 시작한다) */
const weekOf = (date) => {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const p = (n) => String(n).padStart(2, '0');
  return `${mon.getFullYear()}-${p(mon.getMonth() + 1)}-${p(mon.getDate())}`;
};

if (!fs.existsSync(DB)) {
  console.log(`[재기] ${DB} 가 없습니다 — 운영에서는 Postgres 라 이 자리로는 못 봅니다.`);
  process.exit(0);
}
const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const all = db.workouts || [];

const byUser = {};
for (const w of all) {
  const u = w.user_id ?? w.userId ?? '?';
  (byUser[u] = byUser[u] || []).push(w);
}

console.log(`기록 ${all.length}줄 · 사람 ${Object.keys(byUser).length}명`);

const lines = {};
for (const w of all) {
  const s = sideOf(w.exercise);
  lines[s] = (lines[s] || 0) + 1;
}
console.log('\n── 가려진 줄 ──');
const total = all.length;
for (const [k, v] of Object.entries(lines).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(8)} ${String(v).padStart(4)}  ${Math.round((v / total) * 100)}%`);
}
const split = (lines.push || 0) + (lines.pull || 0) + (lines.leg || 0) + (lines.core || 0);
console.log(`  → 가려진 것 ${split}/${total} (${Math.round((split / total) * 100)}%)`);

console.log('\n── 사람별 (줄 5개 이상) ──');
for (const [u, list] of Object.entries(byUser).sort((a, b) => b[1].length - a[1].length)) {
  if (list.length < 5) continue;
  const kg = { push: 0, pull: 0, leg: 0, core: 0 };
  let miss = 0;
  const weeks = {};
  for (const w of list) {
    const s = sideOf(w.exercise);
    const v = kgOf(w.weight);
    const vol = v !== null ? v * (Number(w.sets) || 0) * (Number(w.reps) || 0) : 0;
    if (kg[s] !== undefined) kg[s] += vol; else if (s === 'nosplit' || s === 'nodict') miss += 1;
    if (s === 'push' || s === 'pull') {
      const k = weekOf(w.date);
      if (k) { weeks[k] = weeks[k] || { push: 0, pull: 0 }; weeks[k][s] += vol; }
    }
  }
  const sum = kg.push + kg.pull + kg.leg + kg.core;
  const r = kg.pull > 0 ? (kg.push / kg.pull).toFixed(2) : (kg.push > 0 ? '∞' : '—');
  const pct = (n) => (sum ? `${Math.round((n / sum) * 100)}%` : '—');
  console.log(`\n  user ${u} · 줄 ${list.length} · 안 가린 줄 ${miss}`);
  console.log(`    밀기 ${Math.round(kg.push)}kg(${pct(kg.push)}) · 당기기 ${Math.round(kg.pull)}kg(${pct(kg.pull)})`
    + ` · 하체 ${Math.round(kg.leg)}kg(${pct(kg.leg)}) · 코어 ${Math.round(kg.core)}kg(${pct(kg.core)})`);
  console.log(`    누적 밀기÷당기기 = ${r}배`);
  // ★ **누적은 최근을 가린다** — 그것을 눈으로 보려고 마지막 네 주를 따로 적는다
  const ws = Object.keys(weeks).sort();
  const last = ws.slice(-4);
  if (last.length) {
    console.log('    마지막 네 주 (밀기 / 당기기 → 배):');
    for (const k of last) {
      const a = Math.round(weeks[k].push);
      const b = Math.round(weeks[k].pull);
      const rr = b > 0 ? (a / b).toFixed(1) : (a > 0 ? '∞' : '—');
      console.log(`      ${k}  ${String(a).padStart(6)} / ${String(b).padStart(6)}  → ${rr}배`);
    }
  }
}

console.log('\n※ 코어가 0kg 으로 나오는 것은 **맞는 셈이고 틀린 그림**이다 —');
console.log('  플랭크 · 크런치는 무게가 없어서 kg 으로는 한 줄도 안 잡힌다.');
console.log('  「코어 0%」를 화면에 적으면 거짓이 된다 (그래서 넷으로 나누는 안을 접었다).');
