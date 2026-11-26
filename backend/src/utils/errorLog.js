/**
 * **서버가 터진 것을 적어 둔다 — 내가 그것을 받아 고친다** (2026-11-26 · 주인 지시).
 *
 * ── 무엇이 있었나 ──
 *
 * 500 을 만든 자리는 `index.js` 의 마지막 오류 손인데, 거기서 **운영에서는 아무것도
 * 안 적었다**:
 *
 *     if (process.env.NODE_ENV !== 'production') console.error(err.message);
 *     res.status(500).json({ error: '서버에 문제가 생겼어요' });
 *
 * 즉 **라이브에서 난 500 은 아무 데도 남지 않았다.** 사람은 「문제가 생겼어요」를 보고
 * 그만둔다. 11/25 밤에 `async` 손 열셋을 감싸 서버가 안 죽게는 했지만(`asyncRoute.js`),
 * 감싸서 500 으로 바꾼 그 거절도 **남지 않으니 고칠 수가 없다.** 고칠 사람이 그것을
 * 볼 길이 없는 것이 **오류율이 안 내려가는 까닭**이었다.
 *
 * ── 어디에 적나 ──
 *
 * **보안 기록이 쓰는 길을 그대로 쓴다**(`routes/security.js` 의 `addLog`) — 램 한 벌과
 * **DB 한 벌**이다. 파일은 안 쓴다: Render 무료 판은 디스크가 날아가고(`storage.js`),
 * 그래서 10/22 에 보안 기록도 DB 로 옮겼다. DB 는 **재시작 · 배포를 넘긴다.**
 *
 * 갈래는 `server_error` 한 가지다. 보안 기록과 같은 표에 쌓이지만 `type` 으로 갈리고,
 * 관리자 화면의 기록 목록(`/logs`)은 **제 갈래만** 보던 것이 아니라 전부 보여주므로
 * 거기에도 같이 뜬다 — 그건 그게 맞다(관리자가 「서버가 터졌다」를 봐야 한다).
 *
 * ── 무엇을 적나 · 무엇을 안 적나 ──
 *
 * 적는다: 언제 · 어떤 길(메서드 + 경로) · 누구(번호만) · 오류 이름과 말 · **우리 코드
 * 세 줄**(`src/...:줄`).
 *
 * **안 적는다: 본문 · 쿼리 · 쿠키 · 헤더.** 로그인 본문에는 비번이 들어 있고, 메모
 * 본문에는 사람이 적은 글이 들어 있다. 오류를 고치려고 사람 글을 베껴 두는 것은
 * 바꿔치기다 — 11/25 의 「로그인 실패 로그에 친 그대로가 남는다」와 같은 꼴이다.
 * 경로는 남긴다(`/api/workouts/812`) — 그것 없이는 어느 손인지 모른다.
 *
 * 줄바꿈은 걷는다 — 한 줄에 적는 기록이라, 오류 말에 든 `\n` 으로 **없던 줄을 지어낼**
 * 수 있다(로그 지어내기).
 */

const db = require('../db');

/** 램에 드는 수. DB 에는 보안 기록과 같은 상한까지 쌓인다 */
const RAM_KEEP = 200;
const ram = [];

/** 이 갈래로만 적는다 — 꺼내는 쪽(`/security/errors` · `npm run errors`)이 이것으로 고른다 */
const KIND = 'server_error';

/** 한 줄로 적는 기록이라 줄바꿈 · 조절 글자를 걷는다 (로그 지어내기 막기) */
const oneLine = (s) => String(s == null ? '' : s)
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * 스택에서 **우리 코드 세 줄**만 꺼낸다.
 *
 * 그대로 적으면 `C:\hgh\backend\src\...` 또는 Render 의 `/opt/render/project/...` 가
 * 통째로 들어가 한 줄이 300자가 된다. 남의 꾸러미(`node_modules`) 줄은 거의 쓸모가
 * 없다 — 우리 줄이 하나도 없을 때만 맨 위 한 줄을 남긴다.
 */
function frames(err) {
  const raw = err && err.stack ? String(err.stack) : '';
  const lines = raw.split('\n').slice(1).map((l) => l.trim());
  const short = (l) => {
    const m = l.match(/([^\\/()]+[\\/](?:src|scripts)[\\/][^)]+?):(\d+):\d+/)
      || l.match(/([^\\/()]+):(\d+):\d+/);
    // 맨 앞의 `at 함수이름` 은 떼고 **파일과 줄**만 남긴다
    return m ? `${m[1].replace(/\\/g, '/').replace(/^at \S+ /, '').replace(/^at /, '')}:${m[2]}` : null;
  };
  const ours = lines.filter((l) => /[\\/]src[\\/]/.test(l) && !/node_modules/.test(l))
    .map(short).filter(Boolean);
  if (ours.length > 0) return ours.slice(0, 3).join(' | ');
  const first = lines.map(short).filter(Boolean)[0];
  return first || '';
}

/** 어느 길이었나 — **쿼리는 떼고** 경로만 (`?token=...` 이 기록에 남지 않게) */
function whereOf(req) {
  if (!req) return '';
  const url = String(req.originalUrl || req.url || '').split('?')[0];
  return `${req.method || '?'} ${url}`;
}

/**
 * 한 건 적는다. **여기서 던지지 않는다** — 기록은 곁일이고, 이 자리가 터지면
 * 오류 손 안에서 또 터져서 사람에게 가는 답까지 잃는다 (`addLog` 와 같은 결)
 */
function recordError(kind, err, req) {
  try {
    const name = oneLine(err && err.name) || 'Error';
    const msg = oneLine(err && err.message ? err.message : err).slice(0, 300);
    const parts = [
      kind,                                           // request · rejection · job
      whereOf(req),
      req && req.userId ? `u${req.userId}` : '',
      `${name}: ${msg}`,
      frames(err),
    ].filter(Boolean);
    const entry = { type: KIND, detail: parts.join(' · '), timestamp: new Date().toISOString() };
    ram.push(entry);
    if (ram.length > RAM_KEEP) ram.shift();
    // **DB 만 재시작을 넘는다.** 적다 터져도 조용히 넘어간다 (위 머리글)
    try { db.addSecurityLog(entry); } catch { /* 기록은 곁일이다 */ }
    // 운영에서도 한 줄은 찍는다 — Render 의 로그 창에서 바로 보이게
    console.error('[error]', entry.detail);
    return entry;
  } catch {
    return null;                                      // 기록 때문에 길이 막히지 않는다
  }
}

/**
 * 최신이 위인 목록. **램과 DB 를 합쳐** 돌려준다 (`recentLogs` 와 같은 결) —
 * 방금 뜬 서버는 램이 비어 있고, 오래된 것은 DB 에만 있다. 같은 줄은 한 번만
 */
function recentErrors(limit = 100) {
  let saved = [];
  try {
    saved = db.getSecurityLogs().filter((e) => e && e.type === KIND);
  } catch { saved = []; }
  const all = [...saved, ...ram];
  const seen = new Set();
  const out = [];
  for (let i = all.length - 1; i >= 0 && out.length < limit; i--) {
    const e = all[i];
    const key = `${e.timestamp}|${e.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ detail: e.detail, timestamp: e.timestamp });
  }
  return out;
}

/** 같은 오류가 몇 번 났나 — 많이 나는 것부터 고친다 (`npm run errors` 가 쓴다) */
function groupErrors(list) {
  const by = new Map();
  for (const e of list) {
    // 「언제 · 누구」를 떼고 **무엇이 터졌나**로 묶는다
    const key = e.detail.replace(/ · u\d+ · / , ' · ').replace(/^[a-z]+ · /, '');
    if (!by.has(key)) by.set(key, { what: key, count: 0, first: e.timestamp, last: e.timestamp });
    const g = by.get(key);
    g.count += 1;
    if (e.timestamp < g.first) g.first = e.timestamp;
    if (e.timestamp > g.last) g.last = e.timestamp;
  }
  return [...by.values()].sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1));
}

module.exports = { recordError, recentErrors, groupErrors, KIND, RAM_KEEP };
