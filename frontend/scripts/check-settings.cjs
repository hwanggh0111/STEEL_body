// 설정 칩 줄과 묶음이 어긋나지 않는가 (2026-10-06).
//
// 설정함은 **칩 줄로 건너뛴다**(`JumpBar`). 칩과 묶음은 같은 파일에 있지만
// **적는 자리가 둘**이다 — 묶음은 `<Group title id>`, 칩은 `JumpBar` 의 목록.
//
// 그래서 다음에 묶음을 하나 더하면 **칩을 빼먹기 쉽다.** 빼먹으면 그 묶음은
// 「내려가야만 보이는 자리」가 되는데, 칩 줄이 있으니 사람은 **거기 없다고**
// 생각한다 — 길을 만들려고 더한 것이 길을 가리는 셈이 된다.
//
// 반대도 잡는다. 칩에만 있고 묶음이 없으면 **눌러도 아무 일이 안 일어난다**
// (`getElementById` 가 못 찾는다). 죽은 칩은 고장으로 보인다.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'pages', 'SettingsPage.jsx');
const src = fs.readFileSync(FILE, 'utf8');

// 묶음 — `<Group title="소리" id="set-sound">`
const groups = [...src.matchAll(/<Group\s+title="([^"]+)"\s+id="([^"]+)"/g)]
  .map((m) => ({ title: m[1], id: m[2] }));

// 자리표가 빠진 묶음 — 칩이 건너뛸 자리가 없다
const noId = [...src.matchAll(/<Group\s+title="([^"]+)"(?!\s+id=)/g)].map((m) => m[1]);

// 칩 — JumpBar 의 목록에 적힌 것
const bar = src.match(/<JumpBar[\s\S]*?\/>/);
const chips = bar
  ? [...bar[0].matchAll(/\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)'\s*\}/g)]
      .map((m) => ({ id: m[1], title: m[2] }))
  : [];

const problems = [];

if (!bar) problems.push('칩 줄(<JumpBar ... />)을 못 찾았어요');

for (const t of noId) problems.push(`묶음 「${t}」에 id 가 없어요 — 칩이 건너뛸 자리가 없습니다`);

const chipIds = new Set(chips.map((c) => c.id));
const groupIds = new Set(groups.map((g) => g.id));

for (const g of groups) {
  if (!chipIds.has(g.id)) {
    problems.push(`묶음 「${g.title}」(${g.id}) 이 칩 줄에 없어요 — 내려가야만 보이는 자리가 됩니다`);
  }
}
for (const c of chips) {
  if (!groupIds.has(c.id)) {
    problems.push(`칩 「${c.title}」(${c.id}) 이 가리키는 묶음이 없어요 — 눌러도 아무 일이 안 일어납니다`);
  }
}
// 이름까지 같아야 한다. 칩에 「소리」라 적고 묶음이 「알림음」이면
// 건너뛴 사람이 자기가 누른 것이 맞는지 알 수 없다
for (const c of chips) {
  const g = groups.find((x) => x.id === c.id);
  if (g && g.title !== c.title) {
    problems.push(`「${c.id}」의 이름이 달라요 — 칩은 「${c.title}」, 묶음은 「${g.title}」`);
  }
}

// ── 처음 열었을 때 칩 하나는 켜져 있나 ── (2026-11-24 · 맵시)
//
// 켜진 칩은 `IntersectionObserver` 가 정한다 — **「위쪽 45%」 안에 들어온 묶음**
// (`rootMargin: 0px 0px -55% 0px`). 그 선은 화면 키에 비례해서, 첫 묶음이 시작하는
// ~305px 보다 선이 위에 오는 작은 폰(640 → 288 · 568 → 256)에서는 **아무 칩도
// 안 켜진다** — 「지금 어디」를 말하려고 둔 줄이 처음 열 때 통째로 빈다.
// 맨 위에서 보이는 것은 늘 첫 묶음이니 그것으로 받친다.
// **칩 줄 안에서 찾는다** — 같은 파일의 고르는 줄(`SegMenu`)에도 `const on =` 가
// 있어서 그냥 찾으면 **엉뚱한 자리를 보고 운다** (여기서 한 번 밟았다)
const jumpBody = src.slice(src.indexOf('function JumpBar('));
const onLine = jumpBody.slice(0, jumpBody.indexOf('\nfunction ') + 1 || undefined)
  .match(/const on = ([^;]+);/);
if (!onLine) {
  problems.push('칩이 켜지는 자리(const on = …)를 못 찾았어요');
} else if (!/items\[0\]/.test(onLine[1])) {
  problems.push(`처음 열면 켜진 칩이 없어요 — 「const on = ${onLine[1].trim()}」 는 관찰자가 아직 아무것도`
    + ' 안 줬을 때(작은 폰에서 첫 묶음이 선 아래) 전부 꺼진 줄이 됩니다');
}

console.log('── 설정 칩 줄과 묶음이 맞나 ──');

if (problems.length === 0) {
  console.log(`OK   묶음 ${groups.length}개가 모두 칩 줄에 있다`);
  console.log(`OK   죽은 칩이 없다 → ${chips.map((c) => c.title).join(' · ')}`);
  console.log(`OK   처음 열면 첫 칩이 켜진다 → ${onLine ? onLine[1].trim() : ''}`);
  console.log('');
  console.log('전부 통과');
  process.exit(0);
}

console.log(`실패   ${problems.length}가지`);
console.log('');
for (const p of problems) console.log(`  · ${p}`);
console.log('');
console.log('고치는 곳: src/pages/SettingsPage.jsx 의 <JumpBar items={[...]} /> 와 <Group title id>');
process.exit(1);
