// 서버가 **잠들지 않게 스스로 깨어 있는다** (2026-10-16)
//
// ── 왜 ──
//
// 무료 Render 는 **15분 동안 아무 요청이 없으면 잠든다.** 깨는 데 10/15 실측으로
// **22.3초**다. 그동안 들어온 사람이 보는 것은 빈 화면이거나(웹) 오프라인 화면(앱)이다.
//
// 10/15 에 **깨어난 다음**을 고쳤다 — 앱은 담아둔 화면을 먼저 보여주고(서비스 워커),
// 오프라인 화면은 「서버를 깨우고 있어요」로 기다린 초를 센다. 그런데 그건
// **기다리는 동안을 견디게 한 것**이고, 22초 자체는 그대로다.
//
// 그리고 이 22초를 가장 먼저 만나는 사람이 **플레이스토어 심사자**다. 출시 직후의
// 앱은 하루에 몇 번 열리지도 않으니 거의 늘 잠들어 있다.
//
// ── 어떻게 ──
//
// 제 주소의 `/api/health` 를 **14분마다 한 번** 두드린다. 밖에서 온 요청과 똑같이
// 엣지를 지나므로 Render 가 「쓰고 있다」고 본다. 바깥 서비스(크론 사이트 ·
// 깃허브 액션)를 끼지 않는다 — 열쇠도 계정도 더 안 만들고, 꺼질 때 조용히 꺼진다.
//
// ── 알고 두는 것 (공짜가 아니다) ──
//
// 무료 판은 **한 달 750 인스턴스 시간**이 공짜다. 하루 24시간 깨어 있으면 한 달에
// **약 730시간** — 아슬아슬하게 들어간다. 그래서 **무료 웹 서비스가 이것 하나일 때만
// 맞다.** 둘이 되면 둘 다 월말에 멈춘다.
//
// 그 줄이 싫으면 고를 것이 둘 있다 (둘 다 이 파일을 지우지 않는다) —
//   · 유료 $7 — 애초에 안 잠든다. 그러면 `KEEP_WARM=0` 으로 끄는 것이 맞다
//   · `KEEP_WARM_HOURS` 로 **사람이 쓰는 시간대만** 깨워 둔다 (아래)
//
// ── 끄는 법 ──
//
// `KEEP_WARM=0`. 그리고 **내 컴퓨터에서는 아예 안 돈다** — 주소가 localhost 면
// 깨울 것이 없고, 개발 중에 14분마다 찍히는 줄은 방해만 된다.

const TICK_MS = 14 * 60 * 1000;   // 15분 안에 한 번은 닿아야 한다 — 1분 여유
let timer = null;

/**
 * `KEEP_WARM_HOURS` — 깨워 둘 시간대 (서울 시각, `6-24` 처럼 적는다).
 *
 * 비워두면 하루 내내. 끝 시각은 **그 시가 끝날 때까지**다 (`6-24` = 06:00~24:00).
 * 24시간 다 깨우면 월 730시간이라 750 에 바싹 붙으므로, 줄이고 싶을 때 쓴다.
 */
function withinHours(now = new Date()) {
  const raw = String(process.env.KEEP_WARM_HOURS || '').trim();
  if (!raw) return true;
  const m = raw.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (!m) return true;                       // 못 읽을 값이면 늘 깨운다 (조용히 멈추지 않는다)
  const from = Number(m[1]);
  const to = Number(m[2]);
  // 서울 시각으로 본다 — 서버는 UTC 로 돌고, 적는 사람은 제 시계로 적는다
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false,
  }).format(now)) % 24;
  if (from === to) return true;
  // `22-6` 처럼 자정을 넘는 것도 받는다
  return from < to ? (hour >= from && hour < to) : (hour >= from || hour < to);
}

/** 두드릴 주소. 없거나 내 컴퓨터면 `null` — 그때는 아예 안 돈다. */
function target() {
  const base = String(process.env.BACKEND_URL || process.env.FRONTEND_URL || '').trim();
  if (!base) return null;
  if (!/^https?:\/\//.test(base)) return null;
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(base)) return null;
  return base.replace(/\/+$/, '') + '/api/health';
}

async function ping(url) {
  // **10초에 끊는다.** 깨우는 중이라 늦는 것은 괜찮지만, 답을 영원히 기다리는
  // 연결이 쌓이면 그게 서버를 누른다
  const stop = AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined;
  const res = await fetch(url, { signal: stop, headers: { 'user-agent': 'blackiron-keepwarm' } });
  return res.status;
}

function start() {
  if (timer) return;
  if (process.env.KEEP_WARM === '0') {
    console.log('[warm] 깨워두기 꺼짐 (KEEP_WARM=0)');
    return;
  }
  const url = target();
  if (!url) {
    // 내 컴퓨터에서 흔한 자리다 — 「틀렸다」가 아니라 「여기선 할 일이 없다」다
    console.log('[warm] 깨워둘 주소가 없어 띄우지 않습니다 (BACKEND_URL 이 없거나 localhost)');
    return;
  }
  if (typeof fetch !== 'function') {
    console.log('[warm] 이 노드에는 fetch 가 없어 띄우지 않습니다');
    return;
  }

  timer = setInterval(() => {
    if (!withinHours()) return;
    ping(url).catch(() => { /* 한 번 못 닿은 것으로 할 일은 없다 — 다음 번에 또 두드린다 */ });
  }, TICK_MS);
  // **서버가 이것 때문에 안 꺼지면 안 된다** (운동 알림 스케줄러와 같은 규칙)
  if (timer.unref) timer.unref();

  const when = process.env.KEEP_WARM_HOURS ? ` · ${process.env.KEEP_WARM_HOURS}시 (서울)` : ' · 하루 내내';
  console.log(`[warm] 깨워두기 시작 — 14분마다 ${url}${when}`);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** 지금 두드리고 있나. **검사가 밖에서 볼 수 있어야 한다** (`npm run warm`). */
function isRunning() {
  return timer != null;
}

module.exports = { start, stop, isRunning, ping, target, withinHours, TICK_MS };
