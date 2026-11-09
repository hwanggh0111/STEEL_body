// 소식 **목록만** 뽑아 src/data/feedList.json 으로 쓴다.
//
// 실행: npm run feed  (dev / build 앞에서 자동으로 돈다)
//
// ── 왜 ──
//
// 홈페이지(`/site`)의 「소식」 칸은 **날짜와 한 줄, 그것도 다섯 개**를 쓴다.
// 그런데 그것을 그리려고 두 파일을 통째로 받고 있었다 —
//
//     notices.json     49,019B  gzip 15,728B
//     changelog.json   34,980B  gzip 13,723B
//     ────────────────────────────────────
//     합               83,999B  gzip 29,451B      ← 다섯 줄을 쓰려고
//
// 무게의 거의 전부가 **「자세히」에 들어가는 `detail`** 이다(공지 41개의 detail 만
// 18,125자). 그건 **공지함**이 쓰는 값이고, 홈페이지는 한 줄도 안 쓴다.
//
// **여기는 로그인도 앱 설치도 없이 처음 오는 사람이 보는 자리다.** 아직 이 앱을
// 쓸지 말지도 모르는 사람에게 29KB 를 받게 할 이유가 없다. 그리고 **공지가 쌓일수록
// 더 벌어진다** — 10/6 하루에 열다섯 개를 더해서 notices 가 10KB 늘었다.
//
//     detail 을 뺀 목록만   12,492B  gzip 4,129B      ← gzip 86% 줄어든다
//
// ── 「두 곳에 적는 것」이 아니다 ──
//
// `SiteHome` 의 주석은 앞서 이 길을 **거절했다** — 「빌드 때 따로 뽑아둘 수도 있지만,
// 그러면 같은 소식이 두 곳에 있게 되고 한쪽만 낡는 날이 온다」.
//
// **손으로 적는 자리가 둘이 되면** 그 말이 맞다. 그런데 **뽑은 파일은 두 곳이 아니다.**
// 이 앱은 이미 그 방식을 쓴다 —
//
//   · `changelog.json`   커밋에서 뽑는다 (`gen-changelog.mjs`)
//   · `exercisePart.js`  사전에서 뽑는다 (`gen-parts.mjs`)
//
// 그 파일들 머리에 적힌 말이 그대로 여기에도 쓰인다: **「뽑아 적은 파일이다.
// 손으로 고치지 않는다.」** 출처는 `notices.json` 하나로 남고, 어긋나면
// `npm run check` 가 잡는다(`check-feed.cjs`).
//
// ── 공지함은 그대로 전체를 받는다 ──
//
// 거기는 `detail` 을 펼치고 **그 글까지 검색**한다(`NoticeArchive`). 그 화면에서는
// 필요한 값이라 안 건드린다. 미루는 것은 **홈페이지가 받는 것**뿐이다.
//
// 이 스크립트는 **절대 실패로 끝나지 않는다** — 읽을 것이 없으면 있던 json 을
// 그대로 두고 조용히 빠진다. 빌드를 막을 이유가 없다 (`gen-changelog` 와 같다).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, '../src/data');
const OUT = resolve(DATA, 'feedList.json');
// 공지함 · 고객센터가 쓰는 **전체 목록**(본문 없이)과, 본문만 따로 담은 파일
const OUT_ALL = resolve(DATA, 'feedIndex.json');
const PUBLIC = resolve(HERE, '../public');
const OUT_DETAIL = resolve(PUBLIC, 'feed-detail.json');

// 홈페이지가 다섯 줄을 쓰지만 여유를 둔다 — 고정한 공지가 여럿이면 날짜순 다섯이
// 다 밀릴 수 있고, 걸러낸 뒤에 다섯이 남아야 한다
const KEEP = 20;

function readJson(name) {
  const p = resolve(DATA, name);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    console.log(`[feed] ${name} 을 읽지 못했어요 — 그대로 둡니다 (${e.message})`);
    return null;
  }
}

const notices = readJson('notices.json');
const changelog = readJson('changelog.json');

if (!notices && !changelog) {
  console.log('[feed] 읽을 것이 없어요 — 그대로 둡니다');
  process.exit(0);
}

// **담는 것은 화면이 그리는 것뿐이다.** 날짜 · 한 줄 · 고정 여부.
// `detail` 은 담지 않는다 — 그것이 이 파일을 만든 까닭이다
const rows = [
  ...((notices?.items) || []).map((n) => ({
    date: n.date || '',
    text: n.text || '',
    ...(n.pinned ? { pinned: true } : null),
  })),
  ...((changelog?.items) || []).map((c) => ({
    date: c.date || '',
    // 홈페이지는 「갈래 · 한 줄」로 한 줄에 적는다. 화면에서 또 이어 붙이지 않게
    // **여기서 이어 붙여 둔다** — 그러면 화면이 `scope` 를 몰라도 된다
    text: `${c.scope ? `${c.scope} · ` : ''}${c.text || ''}`,
  })),
]
  // 날짜도 글도 없는 줄은 화면이 어차피 걸러낸다. 여기서 걸러서 안 싣는다
  .filter((r) => r.date && r.text)
  // 고정한 것이 맨 위, 그 다음 날짜 역순 — 화면이 하던 차례를 그대로 여기서 한다
  .sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return String(b.date).localeCompare(String(a.date));
  })
  .slice(0, KEEP);

const out = {
  note: '뽑아 적은 파일이다. 손으로 고치지 않는다 — 고치려면 notices.json 에서 고치고 `npm run feed` 를 돌린다. npm run check 가 어긋나면 잡는다.',
  items: rows,
};

// ── 공지함 · 고객센터가 받는 것도 가볍게 ── (2026-10-16)
//
// 홈페이지는 10/6 에 위의 `feedList.json` 으로 가벼워졌는데, **고객센터와 공지함은
// 여전히 두 파일을 통째로 받고 있었다** — 묶인 조각이 91KB(gzip 32KB)이고 그
// 거의 전부가 본문(`detail`, 공지 19,663자 + 커밋 14,578자)이다. 고객센터에 오는
// 사람 대부분은 **한 줄도 안 펼친다.**
//
// 그래서 여기서도 가른다 —
//   feedIndex.json     전체 목록(본문 없이) — 묶음에 실린다
//   public/feed-detail.json   본문만 — **펼치거나 찾을 때** 받는다
//
// 열쇠(`key`)는 화면이 쓰는 것과 **같은 규칙**으로 만든다(공지는 id, 커밋은 hash) —
// 어긋나면 펼쳐도 본문이 안 나온다. `npm run checkfeed` 가 그 짝을 본다.
const noticeRows = ((notices?.items) || []).map((n, i) => ({
  key: n.id ?? `notice-${i}`,
  date: n.date || '',
  text: n.text || '',
  notice: true,
  ...(n.pinned ? { pinned: true } : null),
  ...(n.detail ? { has: true } : null),
}));
const changeRows = ((changelog?.items) || []).map((c, i) => ({
  key: c.hash ?? `change-${i}`,
  date: c.date || '',
  text: c.text || '',
  label: c.label || '',
  ...(c.scope ? { scope: c.scope } : null),
  ...(c.detail ? { has: true } : null),
}));

const details = {};
((notices?.items) || []).forEach((n, i) => {
  if (n.detail) details[n.id ?? `notice-${i}`] = n.detail;
});
((changelog?.items) || []).forEach((c, i) => {
  if (c.detail) details[c.hash ?? `change-${i}`] = c.detail;
});

if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(`[feed] ${rows.length}줄 → src/data/feedList.json`);

// -- 목록과 본문의 짝을 여기서 못 박는다 -- (2026-11-09)
//
// 둘은 한 번에 나오므로 여기서 어긋날 수 없다. 그런데 라이브에서는 어긋났다 --
// 고객센터 최신 공지 두 줄에 더하기 표시가 보이는데, 눌러도 본문이 영영 안 왔다.
//
// 까닭은 두 파일이 서로 다른 판으로 서빙되기 때문이다.
//
//   feedIndex.json           src/data 에 있어 번들에 실린다. 이름에 해시가 박혀
//                            배포하면 즉시 새것이 간다 (immutable)
//   public/feed-detail.json  정적 파일. 이름이 안 바뀌어서 브라우저 HTTP 캐시가
//                            최장 7일(max-age=604800) 묵은 것을 내준다
//
// 그래서 배포 뒤 최장 이레 동안 목록은 새것, 본문은 옛것이었다. 새 줄은 본문이
// 있다고 적혀 있고, 받아온 옛 본문에는 그 열쇠가 없다.
//
// 본문 파일에 내용 해시를 붙여 그 짝을 묶는다 -- 번들은 제가 지어진 그 본문의
// 판을 이름으로 부른다(/feed-detail.json?v=...). 내용이 바뀌면 열쇠가 바뀌므로
// 캐시가 반드시 빗나가고, 안 바뀌면 이레를 그대로 쓴다 (헛된 왕복이 없다).
const detailJson = JSON.stringify(details);
const detailVersion = createHash('sha1').update(detailJson).digest('hex').slice(0, 10);

// -- 그리고 어긋나면 빌드를 깬다 --
//
// 이 파일 머리글에 「절대 실패로 끝나지 않는다」고 적어뒀다 -- 읽을 것이 없을 때의
// 말이다. 짝이 어긋난 것은 다르다: 그대로 내보내면 사람이 눌러도 아무 일이
// 안 일어나는 줄이 라이브에 남는다. 해시가 또 바뀌어도 라이브까지 못 나가게 한다.
{
  const want = [...noticeRows, ...changeRows].filter((r) => r.has).map((r) => r.key);
  const have = new Set(Object.keys(details));
  const missing = want.filter((k) => !have.has(k));
  const orphan = [...have].filter((k) => !want.includes(k));
  // ★ **열쇠가 겹치면 남의 본문이 열린다** — 짝 어긋남보다 이쪽이 실제로 일어난다.
  //
  // 위의 두 집합은 **같은 자리에서 한 번에** 나오므로(`has` 는 `detail` 이 있다는
  // 뜻이고 본문도 그 `detail` 이다) 서로 어긋날 수가 없다 — 그래서 저 가드는
  // 생성기가 갈라지는 날을 위한 울타리다. 실제로 어긋나는 길은 **열쇠가 겹치는
  // 것**이다: `notices.json` 의 id 는 **손으로 적는다**(`n-2026-10-26-a`). 같은 id
  // 를 두 줄에 적으면 본문 하나가 다른 하나를 덮고, 눌렀을 때 **남의 글이 열린다** —
  // 아무 오류도 안 나고, 화면은 멀쩡해 보인다
  const dup = [...new Set([...noticeRows, ...changeRows]
    .map((r) => r.key)
    .filter((k, i, a) => a.indexOf(k) !== i))];
  if (dup.length) {
    console.error('[feed] 열쇠가 겹칩니다 - 눌렀을 때 남의 본문이 열립니다: ' + dup.join(' '));
    console.error('  notices.json 의 id 를 서로 다르게 적으세요 (커밋 쪽은 hash 라 겹칠 일이 없습니다).');
    process.exit(1);
  }
  if (missing.length || orphan.length) {
    const lines = [
      '[feed] 목록과 본문의 짝이 어긋났습니다 - 그대로 내보내면 눌러도 본문이 안 옵니다.',
      missing.length ? `  본문이 있다고 적혔는데 없는 줄 ${missing.length}: ${missing.slice(0, 8).join(' ')}` : '',
      orphan.length ? `  본문만 있고 목록이 모르는 줄 ${orphan.length}: ${orphan.slice(0, 8).join(' ')}` : '',
      '  notices.json 을 고친 뒤 `npm run feed` 를 다시 돌리세요.',
    ].filter(Boolean);
    console.error(lines.join('\n'));
    process.exit(1);
  }
}

const all = {
  note: '뽑아 적은 파일이다. 손으로 고치지 않는다 — notices.json 에서 고치고 `npm run feed`. 본문(detail)은 public/feed-detail.json 에 따로 있고 화면이 펼칠 때 받는다.',
  // 본문 파일의 판. 화면이 이 판을 이름에 붙여 받는다 -- 옛 본문이 새 목록과
  // 짝지어지는 일을 막는 열쇠다 (위 머리글)
  detailVersion,
  items: [...noticeRows, ...changeRows],
};
writeFileSync(OUT_ALL, JSON.stringify(all, null, 2) + '\n', 'utf8');

if (!existsSync(PUBLIC)) mkdirSync(PUBLIC, { recursive: true });
// **줄바꿈 없이 쓴다** — 사람이 읽는 파일이 아니라 받아가는 파일이다
writeFileSync(OUT_DETAIL, detailJson, 'utf8');

const kb = (n) => `${Math.round(n / 102.4) / 10}KB`;
console.log(`[feed] ${all.items.length}줄(본문 없이) → src/data/feedIndex.json ${kb(JSON.stringify(all).length)}`);
console.log(`[feed] 본문 ${Object.keys(details).length}개 → public/feed-detail.json ${kb(detailJson.length)} - 판 ${detailVersion} (펼칠 때만 받는다)`);

