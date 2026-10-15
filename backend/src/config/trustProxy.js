// 프록시를 몇 홉이나 믿을지 — **함부로 믿으면 안 된다** (2026-09-15, 자체 침투 테스트에서 잡음).
//
// 예전에는 `1` 로 박아뒀다. 그런데 그러면 req.ip 를 X-Forwarded-For 헤더에서 읽는다.
// 서버에 **직접**(개발·터널) 닿으면 그 헤더는 공격자가 마음대로 쓴다 — 헤더만 바꿔가며
// 로그인 실패 IP 잠금 · aiGuard IP 차단 · 전역 rate limit 을 통째로 우회할 수 있었다.
// (계정별 잠금은 이메일 기준이라 단일 계정 무차별 대입은 그대로 막힌다. 뚫린 건 IP 방어다.)
//
// 그래서 **앞에 진짜 프록시가 있다고 아는 곳에서만** 믿는다. 기본값은 0(안 믿음) —
// req.ip 가 소켓 주소가 되어 헤더 위조가 안 통한다.
// 안 믿으면 터널에서는 모두가 한 IP 로 합쳐지지만, 그건 안전한 쪽이다.
//
// ── 홉 수로 세는 것은 틀렸다 (2026-10-15) ──
//
// `1` 로 뒀더니 배포본의 차단 목록에 `10.31.78.209` · `10.31.50.190` 이 남았다 —
// 사람 IP 가 아니라 **Render 내부 프록시 주소**다. Render 는 1 홉이 아니라
// `클라이언트 → 엣지 → 내부 홉` 으로 **XFF 끝에 내부 주소를 하나 더 붙인다.**
// 그래서 한 명이 차단되면 **그 홉을 지나는 사람이 전부 막혔고**(10/14 에 실제로
// 그랬다 — 다른 통신망의 핸드폰까지 못 들어왔다) rate limit 도 사람별이 아니라
// 전체 한 덩어리로 걸렸다. 막으려던 일이 그대로 일어나고 있었다.
//
// **`2` 로 올리는 것은 고치는 게 아니다.** 내부 홉이 하나 더 끼면 또 사설 IP 가
// 나오고, 엣지가 하나뿐인 순간에는 **클라이언트가 적어 보낸 값**을 그대로 믿는다.
// 홉 수는 우리가 셀 수 있는 값이 아니다.
//
// 대신 **사설 주소 범위를 믿는다**(`private`). proxy-addr 이 XFF 를 뒤에서부터
// 걸으며 사설·루프백을 건너뛰고 **처음 나오는 공인 IP** 에서 멈춘다. 그게 진짜
// 접속자다. 위조도 안 통한다 — 클라이언트가 적어 넣은 값은 엣지가 붙인 진짜 공인
// IP 보다 **왼쪽**에 놓이므로 걸음이 거기까지 가지 않는다. 홉이 몇이든 같다.
//
// `npm run proxy` 가 이 판정과 express 의 req.ip 를 여섯 경우로 돌려본다.

/** 사설·루프백·링크로컬 범위. proxy-addr 이 알아듣는 이름들이다 */
const TRUST_PRIVATE = ['loopback', 'linklocal', 'uniquelocal'];

/**
 * TRUST_PROXY 환경값 → express 의 `trust proxy` 값
 * @param {string|undefined} raw
 * @returns {false|number|string[]}
 */
function parseTrustProxy(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === '' || v === '0' || v === 'false' || v === 'no') return false; // 헤더를 안 믿는다
  if (v === 'private' || v === 'auto') return TRUST_PRIVATE;              // 사설 홉은 몇이든 건너뛴다 (Render)
  if (/^\d+$/.test(v)) return Number(v);                                  // 홉 수 — 셀 수 있는 곳에서만
  return false; // 'true'(모두 신뢰)는 일부러 안 받는다 — 그게 바로 이 구멍이다
}

module.exports = { parseTrustProxy, TRUST_PRIVATE };
