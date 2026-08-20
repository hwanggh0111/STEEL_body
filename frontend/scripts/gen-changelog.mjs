// 최근 바뀐 것 목록을 git 커밋에서 뽑아 src/data/changelog.json 으로 쓴다.
//
// 손으로 적으면 두 가지가 어긋난다 — 적는 걸 잊거나, 적어놓고 실제와 달라지거나.
// 커밋은 어차피 남기므로 그걸 읽으면 둘 다 안 생긴다.
//
// 실행: npm run changelog  (dev / build 앞에서 자동으로 돈다)
//
// 이 스크립트는 절대 실패로 끝나지 않는다. git 이 없거나 저장소가 아니어도
// 있던 json 을 그대로 두고 조용히 빠진다 — 빌드를 막을 이유가 없다.

import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/changelog.json');
const KEEP = 8;          // json 에 담을 개수. 화면에서 몇 개를 보여줄지는 화면이 정한다
const SCAN = 120;        // 훑을 커밋 수

// 사용자가 볼 이유가 있는 것만. chore·docs·refactor·test·style 은 화면이 안 바뀐다
const SHOWN = {
  feat: { label: '새 기능', weight: 3 },
  fix:  { label: '고침',   weight: 2 },
  perf: { label: '빨라짐', weight: 1 },
};

function git(args) {
  return execFileSync('git', args, {
    cwd: resolve(HERE, '../..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function build() {
  // 본문(%b)까지 가져온다 — 화면에서 펼쳐 볼 '자세히' 가 된다.
  // 본문에 줄바꿈이 있으므로 레코드는  로, 항목은 탭으로 가른다
  const raw = git(['log', `-n${SCAN}`, '--date=short', '--pretty=format:%h%x09%ad%x09%s%x09%b%x1e']);

  const entries = [];
  for (const rec of raw.split('')) {
    const line = rec.trim();
    if (!line) continue;
    const [hash, date, subject, ...rest] = line.split('	');
    if (!subject) continue;
    const body = rest.join('	').trim();

    // "type(scope): 제목" 또는 "type: 제목"
    const m = subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
    if (!m) continue;
    const [, type, scope, text] = m;
    const kind = SHOWN[type];
    if (!kind) continue;

    // 개발 전용 변경은 사용자에게 알릴 것이 없다
    if (scope === 'dev' || /^\(?dev\)?/.test(scope || '')) continue;

    entries.push({
      hash, date, type, label: kind.label,
      scope: scope || null, text: text.trim(),
      detail: body || null,
    });
  }

  // 같은 날 같은 범위로 여러 번 손댄 것은 마지막 것만 남긴다.
  // 한 기능을 세 번 고친 게 세 줄로 뜨면 목록이 아니라 로그가 된다
  const seen = new Set();
  const picked = [];
  for (const e of entries) {
    const key = `${e.date}|${e.scope || e.text.slice(0, 6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(e);
    if (picked.length >= KEEP) break;
  }

  return {
    generated: entries.length ? entries[0].date : null,  // 훑은 시점이 아니라 최신 커밋 날짜
    items: picked,
  };
}

let data;
try {
  data = build();
} catch {
  // git 이 없거나 저장소가 아니다. 있던 파일을 그대로 둔다
  if (existsSync(OUT)) process.exit(0);
  data = { generated: null, items: [] };
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`[changelog] ${data.items.length}건 → src/data/changelog.json`);
