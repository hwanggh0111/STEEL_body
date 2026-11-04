// **지금 화면 앞에 앉은 사람이 몇 번째인가** (2026-11-04).
//
// ── 무엇이 틀렸나 ──
//
// 저장소들은 다 이런 모양이다.
//
//     const { data } = await client.get('/workouts');
//     set({ ... data ... });            // ← 기다린 뒤에 꽂는다
//
// 그리고 로그아웃은 이렇게 생겼다 (`authStore.logout`).
//
//     await client.post('/auth/logout');   // ← 여기서 또 기다린다
//     …
//     useGoalStore.getState().reset();     // 비운다
//
// **비우는 것과 꽂는 것의 차례가 뒤집힐 수 있다.** 홈에서 목록을 받는 중에
// 「나가기」를 누르면, 비우기가 먼저 끝나고 **날아가 있던 답이 그 뒤에 내려앉는다** —
// 다음에 로그인한 사람 화면에 앞 사람의 기록 · 목표 · 제보 · 진행표가 뜬다.
// 저장소마다 `reset()` 을 공들여 적어두고도 그 뒤에 다시 채워졌다.
//
// 가장 나쁜 자리는 `workoutStore` 다 — 그 길이 `saveCache(grouped)` 로 **기기에
// 담기까지 한다.** 로그아웃이 지운 그 자리에 앞 사람 5년치가 다시 적히고, 다음
// 사람이 앱을 켜면 `hydrate()` 가 그것을 먼저 그린다. 잠깐이 아니라 남는다.
//
// ── 어떻게 막나 ──
//
// `noteStore` 가 이미 이 모양을 한 번 막았다 — 「어느 달의 답인지 보고 아니면
// 버린다」(`loadedMonth !== mine`). 달을 빨리 넘길 때를 막으려고 쓴 자인데,
// 로그아웃도 같이 막아줬다(`resetNoteCache` 가 `loadedMonth` 를 비운다).
// **그 자를 사람 단위로 올려 한 자리에 둔다.**
//
//   · 기다리기 **전에** 지금 세대를 받아 둔다 (`const mine = sessionEpoch()`)
//   · 답이 온 뒤 **꽂기 전에** 아직 그 사람인지 본다 (`if (!isSameSession(mine)) return`)
//   · 사람이 바뀌는 순간 세대를 올린다 (`newSession()` — 로그인 · 로그아웃)
//
// 요청을 끊는 것(AbortController)으로도 막을 수 있지만, 길이 열 군데가 넘고
// 끊긴 요청은 `catch` 로 가서 **「신호가 없다」로 읽힌다**(`isOfflineError`) —
// 지하 대비가 엉킨다. 세대를 보는 쪽은 삼키는 자리가 한 줄이고 엉키지 않는다.
let epoch = 0;

/** 기다리기 전에 받아 둔다. */
export const sessionEpoch = () => epoch;

/** 받아 둔 것이 아직 그 사람인가. 아니면 그 답은 버린다. */
export const isSameSession = (mine) => mine === epoch;

/**
 * 사람이 바뀐다 — 날아가 있는 답은 모두 앞 사람 것이 된다.
 *
 * **로그아웃은 서버에 묻기 전에** 부른다. 묻는 동안에도 다른 답이 내려앉으므로,
 * 누른 그 순간부터 앞 사람 것으로 쳐야 한다.
 */
export const newSession = () => { epoch += 1; return epoch; };
