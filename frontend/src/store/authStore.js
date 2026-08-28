import { create } from 'zustand';
import { PER_USER_KEYS } from '../data/localKeys';
import client from '../api/client';
import { useWorkoutStore, resetCache as resetWorkoutCache } from './workoutStore';
import { useInbodyStore, resetCache as resetInbodyCache } from './inbodyStore';
import { useRoutineSessionStore } from './routineSessionStore';
// 이 스토어는 모듈이 로드되는 순간 localStorage 를 읽는다. 쿠키를 막아둔 브라우저는
// 읽기에서도 SecurityError 를 던지는데, 그러면 import 단계에서 앱 전체가 흰 화면이 된다.
import { readLS, saveLS, removeLS, readCookies } from '../data/safeStorage';

// 쿠키 존재 여부로 로그인 상태 판단 (sb_csrf는 httpOnly가 아니므로 읽기 가능)
function hasCsrfCookie() {
  return readCookies().includes('sb_csrf=');
}


// 파칭코 · 미니게임 · 레벨 · 성취 뱃지를 걷어내면서 남은 localStorage 키들.
// 진행도는 전부 브라우저에만 있었으므로 서버에는 지울 것이 없지만,
// 안 지우면 이미 쓰던 사람의 브라우저에 죽은 값이 영영 남는다. 앱이 뜰 때 한 번 쓸어낸다.
const REMOVED_GAME_KEYS = [
  // 레벨 · 칭호 (8/25 오전에 걷어냄) · 성취 뱃지 (8/25 오후)
  'steelbody_legend', 'steelbody_immortal', 'steelbody_level',
  'steelbody_exp', 'steelbody_title', 'steelbody_badges',
  'steelbody_legend_seen', 'steelbody_immortal_seen', 'steelbody_first_date',
  'steelbody_pachinko_used', 'steelbody_pachinko_exp', 'steelbody_pachinko_log',
  'steelbody_pachinko_best', 'steelbody_pachinko_best_exp',
  'steelbody_ul_tickets', 'steelbody_ul_exp',
  'steelbody_plates', 'steelbody_plate_tickets', 'steelbody_plate_best',
  'steelbody_plate_plays', 'steelbody_plate_unlimited',
];
REMOVED_GAME_KEYS.forEach(k => removeLS(k));

// 로그아웃할 때 브라우저에서 지울 것.
//
// 「기억해둔 것」과 「누구인지」 둘 다다. 남겨두면 다음에 그 기기를 쓰는 사람의
// 로그인 화면에 앞 사람의 아이디와 닉네임이 미리 채워진다.
// 목록은 `data/localKeys.js` 가 갖고 있다. 저장하는 쪽과 지우는 쪽이 **같은 목록**을
// 봐야 한다 — 따로 적어두면 새 키를 만든 사람이 여기에 넣는 것을 잊는다. 실제로
// 사진 · 검색 기록 · 답변 확인 시각이 그렇게 빠져 있었다
const LOGOUT_KEYS = PER_USER_KEYS;

export const useAuthStore = create((set) => ({
  token: readLS('token'), // 레거시 호환 (httpOnly 쿠키 전환 완료 후 제거 예정)
  nickname: readLS('nickname'),
  // 인바디 참고 범위에만 쓴다. null 이면 범위를 안 그리고 숫자만 보여준다.
  // 서버가 들고 있고 checkAuth 때 받아온다 — 기기를 바꿔도 다시 안 물어본다
  sex: null,
  isLoggedIn: !!readLS('token') || hasCsrfCookie(),

  login: async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password });
    if (data.token) saveLS('token', data.token);
    saveLS('nickname', data.nickname);
    if (data.email) saveLS('ironlog_email', data.email);
    if (data.role) saveLS('ironlog_role', data.role);
    set({ token: data.token, nickname: data.nickname, isLoggedIn: true });
  },

  // 가입 직후 자동 로그인 (백엔드가 토큰/쿠키 발급)
  register: async (email, password, nickname, username) => {
    const { data } = await client.post('/auth/register', { email, password, nickname, username });
    if (data?.token) saveLS('token', data.token);
    if (data?.nickname) saveLS('nickname', data.nickname);
    if (data?.email) saveLS('ironlog_email', data.email);
    if (data?.role) saveLS('ironlog_role', data.role);
    set({ token: data?.token || null, nickname: data?.nickname || nickname, isLoggedIn: true });
    return data;
  },

  setSex: async (sex) => {
    const { data } = await client.put('/auth/sex', { sex });
    set({ sex: data.sex ?? null });
    return data.sex ?? null;
  },

  logout: async () => {
    try {
      await client.post('/auth/logout');
    } catch {}
    // 나갈 때 지울 것을 여기 한 군데에 모은다.
    //
    // Layout 이 헤더와 프로필 메뉴 두 곳에서 `['auto_login','ironlog_email', …]` 를
    // **손으로 나열**하고 있었다. 한 곳만 고치면 다른 쪽에 남는다 —
    // 8/25 에 죽은 게임 키를 정리하면서 「나열은 한 군데에만 있으면 된다」고 적어놓고
    // 이 둘을 못 봤다
    LOGOUT_KEYS.forEach(k => removeLS(k));
    // CSRF 쿠키 클라이언트에서도 삭제 (서버 실패 대비)
    try { document.cookie = 'sb_csrf=; Max-Age=0; path=/'; } catch { /* 쿠키를 막아둔 브라우저 */ }
    set({ token: null, nickname: null, sex: null, isLoggedIn: false });
    // 다른 스토어 초기화
    useWorkoutStore.setState({ workouts: {}, loading: false });
    useInbodyStore.setState({ records: [], loading: false });
    // 목록을 「방금 받아왔다」고 기억해 둔 것까지 비운다.
    // 안 비우면 다음에 로그인한 사람이 앞 사람 목록을 잠깐 본다
    resetWorkoutCache();
    resetInbodyCache();
    // 진행 중인 루틴도 비운다 — 안 비우면 다음에 로그인한 사람이 앞 사람의 진행표를 본다
    useRoutineSessionStore.getState().reset();
  },

  // 쿠키 기반 인증 상태 확인 (앱 시작 시 호출)
  checkAuth: async () => {
    try {
      const { data } = await client.get('/auth/me');
      saveLS('nickname', data.nickname);
      if (data.role) saveLS('ironlog_role', data.role);
        set({ nickname: data.nickname, isLoggedIn: true });
      return true;
    } catch {
      set({ isLoggedIn: false });
      return false;
    }
  },
}));
