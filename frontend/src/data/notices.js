// ─── 공지사항 데이터 ───
export const NOTICES = [
  { id: 1, date: '2026-03-23', title: 'STEEL BODY v1.0 정식 오픈!', type: '공지', content: 'STEEL BODY 헬스 트래커가 정식 오픈했습니다. 운동 기록, 인바디 측정, 루틴 추천 등 다양한 기능을 활용해보세요!' },
  { id: 2, date: '2026-03-23', title: '구글 로그인 지원', type: '업데이트', content: '구글 계정으로 간편하게 로그인할 수 있습니다. 로그인 화면에서 Google 버튼을 눌러보세요.' },
  { id: 3, date: '2026-03-23', title: '홈화면 + 대시보드 오픈', type: '신기능', content: '오늘의 운동 요약, 이번 주 운동 달력, 체중 변화 미니 차트, 빠른 이동 버튼이 포함된 홈화면이 추가됐습니다.' },
  { id: 4, date: '2026-03-23', title: '운동 루틴 홈트 추가', type: '신기능', content: '루틴 탭에서 머신/맨몸 외에 홈트레이닝 루틴이 추가됐습니다. 전신, 가슴, 등, 어깨, 하체, 코어 부위별 운동 + 상세 설명 포함.' },
  { id: 5, date: '2026-03-23', title: '운동 검색 한국어 지원', type: '업데이트', content: '검색 탭에서 한국어로 운동을 검색하면 자동으로 영어 번역됩니다. 벤치프레스 종류 8가지, 스쿼트 8가지 등 세부 분류도 확인 가능!' },
  { id: 6, date: '2026-03-23', title: '몸 변화 비교 + 사진', type: '신기능', content: 'BEFORE/AFTER 사진 업로드, 인바디 수치 비교, 막대 그래프 + 레이더 차트로 과거 vs 현재 한눈에 비교 가능.' },
  { id: 7, date: '2026-03-23', title: '식단 추천 (매일 변경)', type: '신기능', content: '벌크업/다이어트/유지 목적별 × 아침/점심/저녁/간식 끼니별 식단 추천. 끼니당 10개 메뉴로 매일 다른 추천!' },
  { id: 8, date: '2026-03-23', title: '운동 트렌드', type: '신기능', content: '요즘 핫한 운동, 챌린지, 계절 추천, 분야별 트렌드 등 최신 운동 트렌드를 홈에서 확인하세요.' },
  { id: 9, date: '2026-03-23', title: '헬스 보호대 상세 설명', type: '업데이트', content: '초보~고인물 등급별 보호대 추천에 소재, 사용법, 브랜드, 사이즈 선택 팁 등 상세 설명이 추가됐습니다.' },
  { id: 10, date: '2026-03-27', title: '계절별 옷 추천 (남녀)', type: '신기능', content: '봄/여름/가을/겨울 × 남성/여성 × 운동복/일상복 카테고리별 옷 추천. 현재 계절 자동 감지!' },
  { id: 11, date: '2026-03-27', title: '측정 시스템 오픈', type: '신기능', content: '전신 사이즈 측정, 1RM 계산기, 체력 테스트, 심박수 존 계산, 스톱워치/타이머, 유연성 측정 총 6가지 측정 기능!' },
  { id: 12, date: '2026-03-27', title: '어깨 측정 기능', type: '신기능', content: '어깨 너비 + 허리둘레 입력하면 어깨 분류(좁은~문짝), 어깨:허리 비율(역삼각형 판정), 변화량 추적 가능.' },
  { id: 13, date: '2026-03-27', title: '로그인 시스템 강화', type: '업데이트', content: '아이디 추가(영문+숫자 4~20자, 중복확인), 이메일 인증번호, 비밀번호 확인, 자동 로그인 체크박스가 추가됐습니다.' },
  { id: 14, date: '2026-03-27', title: '닉네임 위젯 + 프로필', type: '업데이트', content: '오른쪽 닉네임 위젯에서 프로필 사진 업로드, 닉네임 변경, 카테고리별 전체 메뉴 이동이 가능합니다.' },
  { id: 15, date: '2026-03-27', title: '로그인 인트로 애니메이션', type: '업데이트', content: '로그인 성공 시 STEEL BODY 로고 등장 + 슬라이드 업 인트로가 재생됩니다. 홈 이동 시에도 미니 스플래시!' },
  { id: 16, date: '2026-03-27', title: '인바디 그래프 추가', type: '업데이트', content: '인바디 탭 하단에 체중 변화 추이, 체지방/골격근 변화 라인 그래프, 과거 vs 현재 막대 그래프가 추가됐습니다.' },
  { id: 17, date: '2026-03-27', title: '공지사항 시스템', type: '신기능', content: '홈 상단에 공지사항 슬라이드 배너 + 로그인 시 새 공지 팝업이 추가됐습니다. 지금 보고 계신 이것!' },
  { id: 18, date: '2026-04-04', title: '운동 음악 대규모 업데이트', type: '업데이트', content: '운동 음악이 190곡 → 307곡으로 대폭 추가! 힙합/트랩, 게임 OST, 라틴/레게톤, 영화 OST 4개 카테고리 신설. 카테고리 넘기기 버튼 + 검색 기능도 추가됐습니다.' },
  { id: 19, date: '2026-04-04', title: '인바디 체형 판정 + 체성분 차트', type: '신기능', content: '인바디 기록 시 체지방률·골격근량 기반 체형 판정(근육형/표준/비만 등)과 체성분 비율 도넛 차트가 추가됐습니다. 체지방률+골격근량을 입력하면 확인 가능!' },
  { id: 20, date: '2026-04-04', title: '홈 검색 기능 추가', type: '신기능', content: '홈 화면에 메뉴 검색 기능이 추가됐습니다. 한글/영어/초성 검색 지원! 최근 검색 기록도 자동 저장됩니다.' },
  { id: 21, date: '2026-04-04', title: '공지사항 자동 팝업 개선', type: '업데이트', content: '새 공지가 추가되면 자동으로 감지하여 모든 공지를 하나씩 팝업으로 보여줍니다. "다음 공지(N개 남음)" 버튼으로 연속 확인 가능!' },
  { id: 22, date: '2026-04-04', title: '자동 점검 시스템 도입', type: '공지', content: '매일 평일(월~금) 새벽 04:00~05:00 (1시간) 자동 점검이 진행됩니다. 점검 중에는 서비스 이용이 제한되며, 남은 시간이 실시간으로 표시됩니다. 점검 완료 후 자동 복구!' },
  { id: 23, date: '2026-04-08', title: 'v1.1 대규모 업데이트', type: '업데이트', content: '■ 버그 수정 (17건)\n\n[뱃지 시스템]\n• 연속 운동 기록(스트릭)이 오늘 운동 안 하면 0으로 초기화되던 버그 수정\n• 월 개근 판정이 28일 고정 → 해당 월 실제 일수(28~31일)로 변경\n• 최장 연속 기록이 운동 0건일 때 1로 표시되던 버그 수정\n• 날짜 계산이 UTC 기준이라 자정~오전 9시에 하루 밀리던 버그 수정\n• 첫 가입일 저장이 렌더링마다 실행되던 성능 이슈 수정\n• 가입일 경과 계산 타임존 불일치 수정\n\n[백엔드]\n• 회원가입 시 동시 요청으로 ID가 중복 생성될 수 있던 버그 수정\n• 로그인 시 존재하지 않는 계정으로 서버 크래시 발생하던 버그 수정\n• 네이버/페이스북/인스타 소셜 로그인 시 이메일 정보 누락 수정\n• 인바디 키 입력 0일 때 BMI가 무한대로 저장되던 버그 수정\n\n[프론트엔드]\n• 운동 기록 날짜가 UTC 기준으로 잘못 표시되던 버그 수정\n• 운동 삭제 실패해도 "삭제 완료!" 표시되던 버그 수정\n• 인바디 근육비율 계산 시 체중 0이면 크래시 발생하던 버그 수정\n• 홈트 타이머 운동↔휴식 전환 시 잘못된 시간 표시되던 버그 수정\n• 음수 세트/횟수 입력 가능하던 버그 수정\n\n[보안]\n• 자동 로그인 시 비밀번호가 평문으로 저장되던 보안 이슈 수정 → 토큰 기반으로 변경\n• 점검 중 강제 로그아웃 제거 → 토큰 유지, 점검 끝나면 자동 복구\n\n■ 메뉴 정리\n• 운동 음악, 옷 추천, 헬스 장비, 운동 가이드 페이지 삭제 (핵심 기능에 집중)\n• 어깨 측정 → 측정 시스템 "어깨 측정" 탭으로 통합\n• 몸 변화 비교 → 인바디 페이지 "비교" 탭으로 통합\n• 메뉴 13개 → 8개로 간소화\n\n■ 개선\n• 회원가입 페이지 간소화 (이메일 인증 제거, 핵심 입력만 남김)\n• 모바일 접속 지원 (같은 Wi-Fi에서 접속 가능)' },
];

export const NOTICE_BADGE = {
  '공지': 'badge badge-danger',
  '긴급공지': 'badge badge-danger',
  '업데이트': 'badge badge-accent',
  '신기능': 'badge badge-success',
  '이벤트': 'badge badge-warning',
};

export const NOTICE_READ_KEY = 'ironlog_notice_read';
const NOTICE_COUNT_KEY = 'ironlog_notice_count';

export function getReadNotices() {
  // 공지 개수가 바뀌었으면 (새 공지 추가됨) 읽음 기록 초기화
  const savedCount = parseInt(localStorage.getItem(NOTICE_COUNT_KEY) || '0', 10);
  if (NOTICES.length !== savedCount) {
    localStorage.removeItem(NOTICE_READ_KEY);
    localStorage.setItem(NOTICE_COUNT_KEY, String(NOTICES.length));
    return [];
  }
  try { return JSON.parse(localStorage.getItem(NOTICE_READ_KEY)) || []; } catch { return []; }
}

export function markNoticeRead(id) {
  const read = getReadNotices();
  if (!read.includes(id)) {
    read.push(id);
    localStorage.setItem(NOTICE_READ_KEY, JSON.stringify(read));
  }
}

// ─── 관리자 공지 관리 (localStorage 기반) ───
const ADMIN_NOTICES_KEY = 'ironlog_admin_notices';

export function getAllNotices() {
  const adminNotices = getAdminNotices();
  const deletedIds = getDeletedNoticeIds();
  const base = NOTICES.filter(n => !deletedIds.includes(n.id));
  return [...base, ...adminNotices];
}

export function getAdminNotices() {
  try { return JSON.parse(localStorage.getItem(ADMIN_NOTICES_KEY)) || []; } catch { return []; }
}

export function addAdminNotice(notice) {
  const list = getAdminNotices();
  list.push(notice);
  localStorage.setItem(ADMIN_NOTICES_KEY, JSON.stringify(list));
}

export function deleteNotice(id) {
  // 관리자가 추가한 공지면 localStorage에서 삭제
  const adminList = getAdminNotices();
  const filtered = adminList.filter(n => n.id !== id);
  localStorage.setItem(ADMIN_NOTICES_KEY, JSON.stringify(filtered));
  // 기본 공지면 삭제 목록에 추가
  if (NOTICES.find(n => n.id === id)) {
    const deleted = getDeletedNoticeIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem('ironlog_deleted_notices', JSON.stringify(deleted));
    }
  }
}

export function getDeletedNoticeIds() {
  try { return JSON.parse(localStorage.getItem('ironlog_deleted_notices')) || []; } catch { return []; }
}

export function restoreAllNotices() {
  localStorage.removeItem('ironlog_deleted_notices');
}
