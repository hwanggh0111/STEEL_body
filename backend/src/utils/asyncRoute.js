/**
 * **async 손이 던져도 서버가 안 죽게 한다** (2026-11-25 · 근호 · 벼림 지적).
 *
 * ── 무엇이 있었나 ──
 *
 * Express 4 는 손(handler)이 **돌려준 Promise 를 안 본다** — `Layer.handle_request` 가
 * `fn(req, res, next)` 를 try 로 부를 뿐이다. 그래서 `async (req, res) => {...}` 안에서
 * try 밖으로 던지면 거절(rejection)이 아무에게도 안 잡히고, Node 15+ 는 그때 **프로세스를
 * 내린다.** 11/25 밤 `oauth.js` 의 `readState` 가 그 길로 로그인 없이 서버를 죽였다
 * (`d9b2f55`). async 손은 열셋이었다(auth 6 · oauth 5 · reminders 1 · security 1).
 *
 * ── 어떻게 막나 ──
 *
 * 손을 하나씩 감싸면 **다음에 더하는 손이 또 빠진다**(이 앱이 여러 번 겪은 꼴이다). 그래서
 * 라우터를 다 꽂은 **뒤에 한 번**, 앱의 길 전체를 훑어 async 손을 감싼다(`guardAsyncRoutes`).
 * 감싼 손은 거절을 `next(err)` 로 넘겨 맨 끝의 오류 손(`index.js`)이 500 으로 답한다.
 * 새 라우터를 더해도 이 한 줄이 이미 그것을 본다.
 *
 * `Layer` 의 속을 고치지 않는다(바깥 패키지의 속은 판이 바뀌면 조용히 달라진다) —
 * 꽂힌 **손만** 바꿔 끼운다.
 */

const isAsync = (fn) => typeof fn === 'function' && fn.constructor && fn.constructor.name === 'AsyncFunction';
// 길(route)에 꽂힌 보통 손 — 오류 손(인자 넷)은 빼고
const isRouteHandler = (fn) => typeof fn === 'function' && fn.length <= 3;

/** async 손 하나를 감싼다. 인자 수(3)를 지켜야 Express 가 오류 손(4)과 헷갈리지 않는다 */
function wrap(fn) {
  const wrapped = function asyncRouteGuard(req, res, next) {
    let out;
    try { out = fn(req, res, next); } catch (err) { return next(err); }
    if (out && typeof out.then === 'function') out.then(undefined, next);
    return out;
  };
  wrapped.__guarded = true;
  return wrapped;
}

/**
 * 앱(또는 라우터)에 꽂힌 길을 **끝까지** 훑어 async 손을 감싼다. 감싼 수를 돌려준다.
 * 이미 감싼 손은 다시 안 감싼다(두 번 불러도 같다).
 */
function guardAsyncRoutes(appOrRouter) {
  const root = appOrRouter && (appOrRouter._router || appOrRouter);
  let count = 0;
  const seen = new Set();
  const walk = (stack) => {
    if (!Array.isArray(stack) || seen.has(stack)) return;
    seen.add(stack);
    for (const layer of stack) {
      if (layer.route && Array.isArray(layer.route.stack)) {
        for (const l of layer.route.stack) {
          // **길 손은 전부 감싼다** — async 라고 안 적고 Promise 를 돌려주는 손(`(req, res) => x().then(…)`)도
          // 같은 구멍이다(벼림 감사 · 11/25). 동기 손은 감싸도 하는 일이 같다(던지면 next)
          if (isRouteHandler(l.handle) && !l.handle.__guarded) { l.handle = wrap(l.handle); count += 1; }
        }
        continue;
      }
      // 꽂힌 라우터(`app.use('/api/x', router)`)는 그 안의 길까지 내려간다
      if (layer.handle && Array.isArray(layer.handle.stack)) { walk(layer.handle.stack); continue; }
      // `app.use(async (req, res, next) => ...)` 같은 미들웨어 손도 같다
      if (isAsync(layer.handle) && layer.handle.length <= 3 && !layer.handle.__guarded) {
        layer.handle = wrap(layer.handle); count += 1;
      }
    }
  };
  walk(root && root.stack);
  return count;
}

/** 아직 안 감싼 async 손이 남았나 (자가 본다) */
function unguardedAsync(appOrRouter) {
  const root = appOrRouter && (appOrRouter._router || appOrRouter);
  const left = [];
  const seen = new Set();
  const walk = (stack, base) => {
    if (!Array.isArray(stack) || seen.has(stack)) return;
    seen.add(stack);
    for (const layer of stack) {
      if (layer.route) {
        for (const l of layer.route.stack) {
          if (isRouteHandler(l.handle) && !l.handle.__guarded) left.push(`${l.method || '*'} ${base}${layer.route.path}`);
        }
        continue;
      }
      if (layer.handle && Array.isArray(layer.handle.stack)) { walk(layer.handle.stack, base + (layer.regexp && layer.regexp.source)); continue; }
      if (isAsync(layer.handle) && !layer.handle.__guarded) left.push(`use ${base}`);
    }
  };
  walk(root && root.stack, '');
  return left;
}

module.exports = { guardAsyncRoutes, unguardedAsync, wrap, isAsync };
