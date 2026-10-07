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
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, '../src/data');
const OUT = resolve(DATA, 'feedList.json');

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

if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(`[feed] ${rows.length}줄 → src/data/feedList.json`);
