// 계정이 막혔을 때 **그 말을 사람에게 전하는 자** (2026-10-24).
//
// ── 왜 생겼나 ──
//
// 서버는 정지된 사람에게 할 말을 다 들고 있었다 —
//
//     403 { code: 'suspended', error: '계정이 정지되었습니다.',
//           reason: '…', expiresAt: '2026-10-31T06:12:45.123Z' }
//
// **그런데 그 403 을 읽는 자리가 앱에 한 곳도 없었다.** `api/client.js` 는 401 만
// 다루고 403 은 그대로 흘려보냈고, 화면마다 「불러오지 못했어요」가 떴다.
//
// 더 나쁜 것은 **되풀이**였다. 앱이 뜰 때 `checkAuth` 가 `/auth/me` 를 묻는데 그것도
// 403 이다 → `isLoggedIn: false` → 로그인 화면. 그런데 **로그인은 정지를 안 본다**
// (일부러 그렇다 — 비밀번호가 맞는 사람은 들어와서 까닭을 들어야 한다) → 들어가면
// 또 403 → 또 로그인 화면. 정지된 사람이 보는 것은 **까닭 없이 되돌아오는 로그인
// 화면**뿐이었다. 며칠을 그렇게 보낸다 — 자동 판정이 틀린 사람도 똑같이.
//
// 사전이 「오후 3시 발목」을 욕으로 보던 10/22 의 그 자리와 같은 결이다: **자동으로
// 벌을 주는 앱은 벌받은 사람에게 까닭과 기한을 말해야 한다.**
//
// 여기는 **값만 다룬다** (오류 하나 → 보여줄 것). 그려주는 것은
// `components/AccountBlocked.jsx`, 받아 두는 것은 `store/blockStore.js` 다.

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 서버가 주는 까닭 코드(`backend/src/middleware/auth.js`). **글자로 가려내지 않는다** —
// 안내문을 다듬는 날 조용히 안 걸린다
const KINDS = {
  suspended: {
    title: '계정이 잠시 멈췄습니다',
    // 7일이 가장 긴 벌이라는 것은 고객센터 답변에도 적혀 있다 (`faq.js`)
    tail: '적어두신 기록은 그대로 있습니다. 기한이 지나면 저절로 풀립니다.',
  },
  banned: {
    title: '계정이 영구 정지되었습니다',
    tail: '기록은 지우지 않습니다. 잘못 걸렸다면 풀어드릴 수 있으니 알려주세요.',
  },
  blocked: {
    title: '차단된 계정입니다',
    tail: '기록은 그대로 있습니다. 고객센터로 알려주시면 확인합니다.',
  },
  // ── 주소가 막힌 것 ── (2026-10-26)
  //
  // 계정이 아니라 **지금 쓰는 인터넷 주소**가 막힌 것이다(AI 가드의 LEVEL 2~4 ·
  // 입력 스캔). 여태 이 403 에는 까닭 코드가 없어서 **이 화면이 뜬 적이 없다** —
  // 화면마다 「불러오지 못했어요」가 떴고, 그게 10/24 이전의 그 모습이다.
  //
  // 더 나쁜 것은 **입력 스캔으로 정지된 사람**이다. 그 벌은 계정 정지와 주소 차단을
  // 같이 거는데(`aiGuard.executeLevel3`), 주소 잠금은 토큰을 보기 **전에** 걸러진다 —
  // 즉 그 사람의 다음 요청은 계정 쪽 403(`auth.js`)에 닿지도 못한다. 이 코드가
  // 없으면 3일 동안 까닭을 한 번도 못 듣는다.
  //
  // **한 주소 뒤에는 여럿이 있다**(통신사 NAT · 헬스장 와이파이). 그래서 「당신이
  // 무엇을 했다」고 단정하지 않는다 — 그렇게 적으면 옆 사람이 자기가 한 줄로 읽는다
  ip_blocked: {
    title: '접근이 차단되었습니다',
    tail: '계정과 적어두신 기록은 그대로입니다. 같은 인터넷 회선(와이파이 · 통신사)을 함께 쓰는 다른 사람 때문일 수도 있습니다.',
    // 계정 일이 아니다 — 로그아웃해도 안 풀린다. 화면이 그 단추를 안 그린다
    account: false,
  },
};

/** 「10월 31일(토) 15:12」 — 서버가 주는 ISO 를 사람 말로. 못 읽으면 null */
export function untilLabel(iso) {
  if (!iso || iso === 'permanent') return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${DAY_LABELS[d.getDay()]}) ${hh}:${mm}`;
}

/** 남은 시간을 사람 말로. 「1440분」은 아무도 하루로 안 읽는다 */
export function leftLabel(iso, ref = new Date()) {
  if (!iso || iso === 'permanent') return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const min = Math.ceil((t - ref.getTime()) / 60000);
  if (min <= 0) return null;                       // 이미 지났다 — 「0분 남음」을 보여주지 않는다
  if (min < 60) return `${min}분 남음`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 남음`;
  return `${Math.floor(min / (60 * 24))}일 남음`;
}

/**
 * 막힌 응답인가. 막힌 것이면 **보여줄 것**을 돌려준다 (아니면 null).
 *
 * 평범한 403(남의 줄을 건드렸다 · 관리자 전용 길)과 섞이면 안 된다 —
 * 그래서 **서버가 적어 보낸 까닭 코드만** 본다.
 */
export function blockOf(err) {
  const res = err?.response;
  if (!res || res.status !== 403) return null;
  const data = res.data || {};
  const kind = KINDS[data.code] ? data.code : null;
  if (!kind) return null;
  // 기한 이름이 두 벌이다 — 계정 쪽은 `expiresAt`, 주소 차단은 예전부터
  // `blockedUntil` 로 보냈다(이제 둘 다 보낸다). **둘 다 읽는다** — 한쪽만 읽으면
  // 「풀리는 때」가 조용히 사라지고, 그 칸이 이 화면에 온 사람이 제일 알고 싶은 것이다
  const raw = typeof data.expiresAt === 'string' ? data.expiresAt
    : typeof data.blockedUntil === 'string' ? data.blockedUntil : null;
  const until = raw === 'permanent' || raw === 'forever' ? null : raw;
  return {
    kind,
    title: KINDS[kind].title,
    tail: KINDS[kind].tail,
    // 계정 일인가 (로그아웃이 뜻이 있는가). 적어두지 않은 것은 계정 일이다
    account: KINDS[kind].account !== false,
    // 자동 판정이 적어둔 까닭. 없을 수도 있다 (관리자가 손으로 건 것)
    reason: typeof data.reason === 'string' && data.reason.trim() ? data.reason.trim() : null,
    until,
    untilLabel: untilLabel(until),
    left: leftLabel(until),
    // 기한이 없는 것은 영구다 — 화면이 「언제 풀리나」를 안 그린다
    forever: !until,
  };
}
