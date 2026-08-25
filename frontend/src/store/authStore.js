import { create } from 'zustand';
import client from '../api/client';
import { useWorkoutStore } from './workoutStore';
import { useInbodyStore } from './inbodyStore';
// 이 스토어는 모듈이 로드되는 순간 localStorage 를 읽는다. 쿠키를 막아둔 브라우저는
// 읽기에서도 SecurityError 를 던지는데, 그러면 import 단계에서 앱 전체가 흰 화면이 된다.
import { readLS, saveLS, removeLS, readCookies } from '../data/safeStorage';

// 쿠키 존재 여부로 로그인 상태 판단 (sb_csrf는 httpOnly가 아니므로 읽기 가능)
function hasCsrfCookie() {
  return readCookies().includes('sb_csrf=');
}

// 관리자도 다른 계정과 동일하게 기록대로 레벨/뱃지가 오르도록 특전을 두지 않는다.
// 이전 버전에서 심어둔 값이 남아 있으면 만렙 취급이 유지되므로 로그인 시 걷어낸다.
const LEGACY_ADMIN_PERK_KEYS = [
  'steelbody_legend', 'steelbody_immortal', 'steelbody_level',
  'steelbody_exp', 'steelbody_title', 'steelbody_badges',
];

function clearLegacyAdminPerks() {
  LEGACY_ADMIN_PERK_KEYS.forEach(k => removeLS(k));
}

// 파칭코 · 미니게임을 걷어내면서 남은 localStorage 키들.
// 진행도는 전부 브라우저에만 있었으므로 서버에는 지울 것이 없지만,
// 안 지우면 이미 쓰던 사람의 브라우저에 죽은 값이 영영 남는다. 앱이 뜰 때 한 번 쓸어낸다.
const REMOVED_GAME_KEYS = [
  'steelbody_pachinko_used', 'steelbody_pachinko_exp', 'steelbody_pachinko_log',
  'steelbody_pachinko_best', 'steelbody_pachinko_best_exp',
  'steelbody_ul_tickets', 'steelbody_ul_exp',
  'steelbody_plates', 'steelbody_plate_tickets', 'steelbody_plate_best',
  'steelbody_plate_plays', 'steelbody_plate_unlimited',
];
REMOVED_GAME_KEYS.forEach(k => removeLS(k));

export const useAuthStore = create((set) => ({
  token: readLS('token'), // 레거시 호환 (httpOnly 쿠키 전환 완료 후 제거 예정)
  nickname: readLS('nickname'),
  isLoggedIn: !!readLS('token') || hasCsrfCookie(),

  login: async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password });
    if (data.token) saveLS('token', data.token);
    saveLS('nickname', data.nickname);
    if (data.email) saveLS('ironlog_email', data.email);
    if (data.role) saveLS('ironlog_role', data.role);
    clearLegacyAdminPerks();
    set({ token: data.token, nickname: data.nickname, isLoggedIn: true });
  },

  // 가입 직후 자동 로그인 (백엔드가 토큰/쿠키 발급)
  register: async (email, password, nickname, username) => {
    const { data } = await client.post('/auth/register', { email, password, nickname, username });
    if (data?.token) saveLS('token', data.token);
    if (data?.nickname) saveLS('nickname', data.nickname);
    if (data?.email) saveLS('ironlog_email', data.email);
    if (data?.role) saveLS('ironlog_role', data.role);
    clearLegacyAdminPerks();
    set({ token: data?.token || null, nickname: data?.nickname || nickname, isLoggedIn: true });
    return data;
  },

  logout: async () => {
    try {
      await client.post('/auth/logout');
    } catch {}
    removeLS('token');
    removeLS('nickname');
    removeLS('ironlog_role');
    // CSRF 쿠키 클라이언트에서도 삭제 (서버 실패 대비)
    try { document.cookie = 'sb_csrf=; Max-Age=0; path=/'; } catch { /* 쿠키를 막아둔 브라우저 */ }
    set({ token: null, nickname: null, isLoggedIn: false });
    // 다른 스토어 초기화
    useWorkoutStore.setState({ workouts: {}, loading: false });
    useInbodyStore.setState({ records: [], loading: false });
    removeLS('ironlog_email');
  },

  // 쿠키 기반 인증 상태 확인 (앱 시작 시 호출)
  checkAuth: async () => {
    try {
      const { data } = await client.get('/auth/me');
      saveLS('nickname', data.nickname);
      if (data.role) saveLS('ironlog_role', data.role);
      clearLegacyAdminPerks();
      set({ nickname: data.nickname, isLoggedIn: true });
      return true;
    } catch {
      set({ isLoggedIn: false });
      return false;
    }
  },
}));
