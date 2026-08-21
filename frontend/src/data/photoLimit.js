// 사진 한도는 서버가 정한다 — backend/src/routes/photos.js 가 base64 길이 2MB 를 넘기면 거절한다.
// (JSON 파일 DB 를 통째로 메모리에 올리는 구조라 한도를 함부로 올릴 수 없다)
//
// 파일 크기로 재면 어긋난다. base64 는 원본보다 약 33% 커진다.
// 1.9MB 짜리 사진이 프론트 검사(2MB)를 통과한 뒤 서버에서 2.5MB 가 돼 거절당했다 —
// 사용자 입장에서는 2MB 이하 사진을 골랐는데 '너무 크다' 는 말을 들은 셈이다.
export const PHOTO_MAX_BASE64 = 2 * 1024 * 1024;

// base64 로 부풀어도 서버 한도를 안 넘는 원본 크기. 1KB 는 data: 머리말 몫이다.
export const PHOTO_MAX_FILE = Math.floor(PHOTO_MAX_BASE64 * 3 / 4) - 1024;

export const PHOTO_MAX_LABEL = '1.5MB';
