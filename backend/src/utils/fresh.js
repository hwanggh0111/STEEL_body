// **바뀐 것이 없으면 다시 안 보낸다** (2026-10-24).
//
// ── 왜 ──
//
// 앱은 목록을 통째로 받아 들고 있고, 화면을 옮길 때마다 다시 받는다(30초 지나면).
// 5년치면 그 몸통이 **4MB**다 — 서버는 그때마다 줄을 모아 글자로 만들고(stringify)
// gzip 으로 누른다. `npm run http` 로 재보니 2년치에서 **1.65MB · 31ms**(이 기계)고,
// Render 무료 판은 **CPU 0.1 코어**다.
//
// 그 네 번 중 세 번은 **바뀐 것이 하나도 없다.** 그러면 「안 바뀌었다」(304) 한 줄만
// 보내면 된다 — 몸통도 안 만들고, 누르지도 않고, 보내지도 않는다.
//
// ── 왜 express 의 ETag 를 안 쓰나 ──
//
// express 는 `res.json` 에서 **몸통을 다 만든 뒤** 그것을 해시해 딱지를 만든다.
// 그러면 「안 바뀌었다」를 알기까지 **비싼 일을 다 한다** — 재보니 304 도 15ms 였다
// (줄 모으기 + 4MB stringify + 해시). 우리가 아는 것은 **그 사람의 그 표가 바뀌었나**
// 하나뿐이고(`db.dataTag`), 그건 Map 한 번 보기다.
//
// 그래서 **딱지를 먼저 견주고**, 보낼 때는 `res.end` 로 내보낸다 — `res.json` 을
// 쓰면 express 가 우리 딱지를 **제 해시로 덮어쓴다**(그리고 4MB 를 또 해시한다).
//
// ── 담아두는 규칙 ──
//
// `Cache-Control: no-cache, private` 다. `no-cache` 는 **「담지 마라」가 아니라
// 「쓰기 전에 물어봐라」**다 — 그래야 브라우저가 다음에 `If-None-Match` 를 들고 온다.
// `private` 는 중간에 있는 캐시(프록시)가 담지 말라는 뜻이다. **사람의 기록이다.**

/** 보내온 딱지 중에 우리 것이 있나 (`If-None-Match` 는 여럿일 수 있다) */
function matches(header, tag) {
  if (!header || !tag) return false;
  return String(header).split(',').some((v) => v.trim() === tag);
}

/**
 * 바뀐 것이 없으면 304, 있으면 몸통을 만들어 보낸다.
 *
 * @param {string} tag   `db.dataTag(표, 사람)` 가 준 딱지
 * @param {() => any} build  **바뀌었을 때만** 부른다 (줄을 모으는 비싼 일이다)
 */
function sendFresh(req, res, tag, build) {
  res.set('ETag', tag);
  res.set('Cache-Control', 'no-cache, private');
  if (matches(req.headers['if-none-match'], tag)) {
    return res.status(304).end();
  }
  let body;
  try {
    body = JSON.stringify(build());
  } catch (err) {
    // 몸통을 못 만들면 딱지를 걷는다 — 다음에 또 물어보게 (틀린 딱지를 남기면 안 된다)
    res.removeHeader('ETag');
    throw err;
  }
  res.set('Content-Type', 'application/json; charset=utf-8');
  return res.end(body);
}

module.exports = { sendFresh, matches };
