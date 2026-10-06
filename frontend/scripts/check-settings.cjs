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

console.log('── 설정 칩 줄과 묶음이 맞나 ──');

if (problems.length === 0) {
  console.log(`OK   묶음 ${groups.length}개가 모두 칩 줄에 있다`);
  console.log(`OK   죽은 칩이 없다 → ${chips.map((c) => c.title).join(' · ')}`);
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
