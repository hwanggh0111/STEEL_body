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
// 체형에서 **지난 번 사진으로 잰 비율** (2026-09-22). 사진이 아니라 숫자 몇 개지만
// **그 사람의 몸**이다 — 안 지우면 다음에 로그인한 사람이 앞 사람 실루엣을
// 점선으로 겹쳐 보게 된다. 위에 적힌 「몸 사진 두 개」와 똑같은 자리다.
export const SHAPE_RATIOS_KEY = 'shape:lastRatios';
// 체형에서 **잰 비율의 이력** (2026-09-29, 04 단계). 위의 한 칸(`SHAPE_RATIOS_KEY`)이
// 하던 일을 넘겨받았다 — 「지난 번」 말고 **처음과도** 견주려면 한 칸으로는 안 된다.
// 옛 한 칸은 **지우는 목록에 그대로 둔다**: 쓰던 사람의 브라우저에 아직 남아 있고,
// 그것도 그 사람의 몸이라 로그아웃하면 같이 지워져야 한다.
// 여기에도 **사진은 안 들어간다** — 비율 숫자와 날짜뿐이다.
export const SHAPE_LOG_KEY = 'shape:log';
// 지금 있는 헬스장 (`store/gymStore.js`). 세팅 자체는 서버에 있고, **어디 있는지만**
// 기기에 남긴다 — 폰에서 고른 곳이 집 PC 까지 바뀌면 안 되기 때문이다.
// 그래도 **사람이 바뀌면 지운다**: 다음에 로그인한 사람이 앞 사람이 다니는 헬스장
// 이름으로 시작하게 둘 이유가 없다 (2026-09-22 에 옮겼다).
export const GYM_KEY = 'steelbody_gym';
// 지난번에 한 홈트 프로그램 (`pages/HomeworkoutPage.jsx`). 홈트는 아직 서버에 안
// 쌓여서 기기에만 남는데, **그 사람이 한 것**이다 — 안 지우면 다음 사람 화면에
// 「지난번에 ○○ 하셨네요」가 앞 사람 것으로 뜬다 (2026-09-22 에 찾았다).
export const HOME_LAST_KEY = 'steelbody_home_last';
// 홈트에서 **숨이 가라앉는 데 걸린 초** (2026-09-30, `data/breathRecover.js`).
// 소리는 안 들어간다 — 초 · 날짜 · 어느 동작이었나뿐이다. 그래도 **그 사람의 몸**이라
// 로그아웃하면 지운다(체형의 비율 이력과 똑같은 자리다). 회복이 빨라진 자취를 다음에
// 로그인한 사람이 자기 것으로 보게 둘 이유가 없다.
export const BREATH_LOG_KEY = 'breath:recover';

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
  SHAPE_RATIOS_KEY,
  SHAPE_LOG_KEY,
  GYM_KEY,
  HOME_LAST_KEY,
  BREATH_LOG_KEY,
];

// ── 기기의 것. 로그아웃해도 남긴다 ──
//
// 점검 안내는 누가 쓰든 같은 것이고, 휴식 타이머 설정(길이 · 소리 · 진동)은 그 기기에서
// 어떻게 쓰는지에 대한 취향이다. 사람이 바뀐다고 다시 정하게 할 이유가 없다.
export const MAINT_KEY = 'ironlog_maintenance';
export const MAINT_VERSION_KEY = 'ironlog_maint_version';
// 휴식 타이머 취향 여섯 (`store/restTimerStore.js`). 길이 · 소리 · 음색 · 진동 · 볼륨 ·
// 자동 시작 — 그 기기에서 어떻게 쓰는지에 대한 취향이라 사람이 바뀌어도 남긴다.
export const REST_KEYS = {
  auto: 'steelbody_rest_auto',
  duration: 'steelbody_rest_duration',
  sound: 'steelbody_rest_sound',
  tone: 'steelbody_rest_tone',
  vibrate: 'steelbody_rest_vibrate',
  volume: 'steelbody_rest_volume',
};
// 설정함이 들고 있는 것들 (`store/settingsStore.js`, 2026-09-22).
//
// 여태 **아무 데서도 못 끄던 것들**이다 — 화면 켜두기는 코드에만 있었고, 목소리로
// 적기는 운동 화면 안에만 있었다. 전부 **그 기기에서 어떻게 쓰는지**에 대한 취향이라
// 로그아웃해도 남긴다.
//
// 휴식 타이머 여섯(소리 · 음색 · 볼륨 · 진동 · 자동 · 길이)은 여기 없다 —
// `REST_KEYS` 가 이미 갖고 있고, 설정 화면은 그쪽을 그대로 불러 쓴다.
// **같은 값을 두 벌로 두지 않는다.**
export const SETTINGS_KEYS = {
  keepAwake:   'steelbody_set_keepawake',
  voiceLog:    'steelbody_set_voicelog',
  prBanner:    'steelbody_set_prbanner',
  finishCard:  'steelbody_set_finishcard',
  breath:      'steelbody_set_breath',
  breathWhere: 'steelbody_set_breath_where',
  breathMax:   'steelbody_set_breath_max',
  breathSense: 'steelbody_set_breath_sense',
  // 인바디 점수 (2026-09-29). **기본은 꺼짐** — 이 앱은 몸에 점수를 안 매기기로
  // 했으므로(8/25), 보고 싶은 사람이 켜는 것이다. 그 기기에서 어떻게 볼지에 대한
  // 취향이라 로그아웃해도 남긴다.
  inbodyScore: 'steelbody_set_inbodyscore',
};

// 내가 만든 알림 소리 (`data/customTones.js`, 2026-09-22).
// 고른 재료(높이 · 몇 번 · 빠르기 · 결)만 남긴다 — **소리 파일은 안 받는다**.
// 그 기기에서 어떻게 쓰는지에 대한 취향이라 로그아웃해도 남긴다.
export const CUSTOM_TONES_KEY = 'steelbody_my_tones';

// 앱 잠금 (`data/appLock.js` 가 들고 있다 — 계산이 거기 있어서 이름도 거기 둔다).
// **기기의 가림막**이라 로그아웃해도 남긴다: 로그인은 그보다 센 자물쇠다.
export const LOCK_KEY_NAME = 'steelbody_lock';
// 「로그인이 풀렸어요」를 로그인 화면에 한 번 알리는 쪽지 (`api/client.js`).
// 로그인 화면이 읽고 그 자리에서 지운다 — 사람에 딸린 것이 아니다.
export const SESSION_EXPIRED_KEY = 'session_expired';
