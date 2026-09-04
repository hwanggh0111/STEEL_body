// 열쇠 이름의 `ironlog_` 는 이 앱의 옛 이름이다. **일부러 그대로 둔다** —
// 이름은 아무 데도 안 보이는데, 바꾸면 쓰던 사람의 브라우저에 남은 것을 못 찾는다
// (프로필 사진 · 비교 사진 · 점검 캐시가 통째로 사라진다).
// 2026-08-28 에 파일 이름과 패키지 이름만 steelbody 로 옮겼다가,
// **2026-09-01 에 앱 이름을 BLACK IRON 으로 정했다.**
// 그런데 여기 열쇠 이름은 `ironlog_` 와 `steelbody_` 로 남아 있다 — **일부러 그대로 둔다.**
// 이름은 아무 데도 안 보이는데, 바꾸면 쓰던 사람의 프로필 사진 · 비교 사진 ·
// 휴식 타이머 설정 · 답변 확인 시각이 통째로 사라진다.
// **앱 이름이 바뀔 때마다 따라 바꾸면 안 되는 자리다.**
// 브라우저에 남겨두는 것들의 이름.
//
// **왜 한 곳에 모으는가.** 로그아웃할 때 지울 목록(`store/authStore.js` 의
// `LOGOUT_KEYS`)과, 실제로 저장하는 화면이 **따로 적어두고 있었다.** 그러면 새 키를
// 만든 사람이 목록에 넣는 것을 잊는다. 실제로 잊혔다 —
//
//   - 몸 사진 두 개 → 같은 기기에서 다음 사람이 로그인하면 **앞 사람 사진**이 떴다
//   - 검색 기록 → 앞 사람이 무엇을 찾았는지 그대로 보였다
//   - 답변 확인 시각 → 앞 사람의 시각이 남아, 새 사람의 답변이 **이미 읽은 것**으로
//     처리돼 「답변이 왔어요」가 영영 안 떴다
//
// 그래서 이름을 여기 두고, 지우는 쪽은 `PER_USER_KEYS` 를 그대로 쓴다.
// 새 키를 여기 만들면 지우는 일은 저절로 따라온다.

// ── 사람마다 다른 것. 로그아웃하면 지운다 ──
export const PROFILE_PHOTO_KEY = 'ironlog_profile_photo';
export const COMPARE_PHOTOS_KEY = 'ironlog_photos';
export const SEARCH_HISTORY_KEY = 'ironlog_search_history';
export const SEEN_REPLY_KEY = 'steelbody_report_seen_reply';
// 신호가 없을 때 쓰는 둘 (`data/offline.js`).
//   cache — 마지막으로 받아온 기록. 못 받아오면 이것으로 그린다
//   queue — 아직 못 올린 기록. **사람이 적은 것이라 제일 잃으면 안 되는 값이다**
// 사람마다 다르므로 로그아웃하면 지운다 — 다음 사람 화면에 앞 사람 기록이 뜨면 안 된다.
// (줄에 남은 것이 있으면 로그아웃 전에 화면이 먼저 말린다. `Layout` 참고)
export const WORKOUT_CACHE_KEY = 'ironlog_workouts_cache';
export const WORKOUT_QUEUE_KEY = 'ironlog_workout_queue';
// 달력의 그날 메모도 같은 둘을 쓴다 (`data/offlineNotes.js`).
// **메모도 헬스장에서 적는다** — 「어깨가 안 좋아 가볍게」는 집에 와서 적는 말이 아니다.
// 세트를 적는 것만 담아두고 메모는 못 적게 두면, 사람은 같은 자리에서 한 번은 되고
// 한 번은 안 되는 앱을 쓰게 된다.
export const NOTE_CACHE_KEY = 'ironlog_day_notes_cache';
export const NOTE_QUEUE_KEY = 'ironlog_day_note_queue';

export const PER_USER_KEYS = [
  // 누구인지 · 기억해둔 것
  'token', 'nickname', 'ironlog_role', 'ironlog_email',
  'auto_login', 'saved_id', 'saved_nickname',
  // 그 사람의 것
  PROFILE_PHOTO_KEY,
  COMPARE_PHOTOS_KEY,
  SEARCH_HISTORY_KEY,
  SEEN_REPLY_KEY,
  WORKOUT_CACHE_KEY,
  WORKOUT_QUEUE_KEY,
  NOTE_CACHE_KEY,
  NOTE_QUEUE_KEY,
];

// ── 기기의 것. 로그아웃해도 남긴다 ──
//
// 점검 안내는 누가 쓰든 같은 것이고, 휴식 타이머 설정(길이 · 소리 · 진동)은 그 기기에서
// 어떻게 쓰는지에 대한 취향이다. 사람이 바뀐다고 다시 정하게 할 이유가 없다.
export const MAINT_KEY = 'ironlog_maintenance';
export const MAINT_VERSION_KEY = 'ironlog_maint_version';
