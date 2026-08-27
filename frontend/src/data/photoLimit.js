// 사진 한도는 서버가 정한다 — backend/src/routes/photos.js 가 base64 길이 2MB 를 넘기면 거절한다.
// (JSON 파일 DB 를 통째로 메모리에 올리는 구조라 한도를 함부로 올릴 수 없다)
//
// 파일 크기로 재면 어긋난다. base64 는 원본보다 약 33% 커진다.
// 1.9MB 짜리 사진이 프론트 검사(2MB)를 통과한 뒤 서버에서 2.5MB 가 돼 거절당했다 —
// 사용자 입장에서는 2MB 이하 사진을 골랐는데 '너무 크다' 는 말을 들은 셈이다.
export const PHOTO_MAX_BASE64 = 2 * 1024 * 1024;

// base64 로 부풀어도 서버 한도를 안 넘는 원본 크기. 1KB 는 data: 머리말 몫이다.
//
// **이제 이 값으로 사람을 돌려보내지 않는다.** 한도를 넘으면 `shrinkImage` 가 줄여서
// 올린다 — 요즘 폰 사진은 3~8MB 라, 이 값으로 거르면 앨범에서 고른 것이 거의 다
// 튕겼다. 남겨두는 것은 「줄여도 안 되는」 마지막 경우를 알리기 위해서다.
export const PHOTO_MAX_FILE = Math.floor(PHOTO_MAX_BASE64 * 3 / 4) - 1024;

export const PHOTO_MAX_LABEL = '1.5MB';

// 브라우저에 사진을 캐싱해두는 자리.
//
// **로그아웃할 때 반드시 지워야 한다** (`store/authStore.js` 의 LOGOUT_KEYS).
// 안 지우면 같은 기기에서 다음 사람이 로그인했을 때 **앞 사람의 몸 사진**이 그대로
// 뜬다. 하필 제일 안 보여도 되는 것이다. 그래서 키 이름을 여기 한 곳에 두고
// 쓰는 쪽과 지우는 쪽이 같은 것을 본다 — 두 곳에 적어두면 언젠가 갈린다.
export const PROFILE_PHOTO_KEY = 'ironlog_profile_photo';
export const COMPARE_PHOTOS_KEY = 'ironlog_photos';
