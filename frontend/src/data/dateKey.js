// 날짜 키는 반드시 로컬 기준으로 만든다.
//
// toISOString() 은 UTC 로 바꾼 뒤 자르기 때문에 KST(+9)에서는 새벽 0시~8시 59분 사이에
// 하루 전 날짜가 나온다. 기록은 WorkoutPage 가 로컬 날짜로 저장하는데 홈이 UTC 로 조회하면,
// 새벽에 남긴 운동이 홈에서 사라지고 주간 표도 하루씩 밀린다.
//
// 같은 헬퍼가 여러 곳에 따로 있었다. 새로 쓰는 곳은 여기를 쓴다.
export function dateKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ── 시각을 **그 사람의 시계로** 적는다 (2026-10-27) ──
//
// 위와 **같은 함정**이다. 서버가 보내는 시각은 `new Date().toISOString()` —
// 끝에 `Z` 가 붙은 UTC 다. 그것을 글자로 잘라 쓰면(`iso.substring(11, 19)`)
// 한국에서는 **아홉 시간 전**이 화면에 적힌다.
//
// 실제로 그랬다 — 관리자의 「최근 보안 로그」가 방금 일어난 일을 오전 9시로 적고
// 있었고(저녁 6시였다), 같은 줄을 그리는 다른 관리자 화면(`AiAdminPanel`)은
// 맞게 적고 있었다. **두 화면이 같은 시각을 아홉 시간 다르게 말했다.**
//
// 그래서 여기 둔다 — 「같은 헬퍼가 여러 곳에 따로 있었다」는 위의 말과 같은 자리다.
// 깨진 값 · 없는 값은 `-` 다. **지어내지 않는다** (0 이나 지금으로 때우면 더 나쁘다).

const pad2 = (n) => String(n).padStart(2, '0');

/** 시:분:초. 로그 한 줄 앞에 붙이는 자리 — 날짜는 목록이 이미 말한다 */
export function clockOf(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '-';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** 날짜와 시각. 「언제 검사했나」처럼 **날짜가 뜻이 있는** 자리에 쓴다 */
export function stampOf(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '-';
  return `${dateKey(d)} ${clockOf(iso)}`;
}
