import { create } from 'zustand';
import client from '../api/client';
import { useWorkoutStore } from './workoutStore';
import { useInbodyStore } from './inbodyStore';
import { usePachinkoStore } from './pachinkoStore';
import { usePlateStore } from './plateStore';
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

export const useAuthStore = create((set) => ({
  token: readLS('token'), // 레거시 호환 (httpOnly 쿠키 전환 완료 후 제거 예정)
  nickname: readLS('nickname'),
  isLoggedIn: !!readLS('token') || hasCsrfCookie(),

  login: async (email, password) => {
    const prevEmail = readLS('ironlog_email');
    const { data } = await client.post('/auth/login', { email, password });
    if (data.token) saveLS('token', data.token);
    saveLS('nickname', data.nickname);
    if (data.email) saveLS('ironlog_email', data.email);
    if (data.role) saveLS('ironlog_role', data.role);
    clearLegacyAdminPerks();
    // 파칭코/원판 진행도는 localStorage 에 계정 구분 없이 저장된다.
    // 다른 계정으로 갈아타면 앞 사람의 EXP 와 원판·티켓이 내 것으로 넘어오므로 여기서 끊는다.
    if (prevEmail && data.email && prevEmail !== data.email) {
      usePachinkoStore.getState().reset();
      usePlateStore.getState().reset();
    }
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
    // 가입은 언제나 새 계정이다. 그런데 /register 는 PrivateRoute 밖이라
    // 로그인한 채로도 들어올 수 있어서, 안 비우면 앞 계정의 파칭코 EXP 와
    // 원판·구매 티켓이 그대로 새 계정 것이 된다 (login 에는 있는 가드가 여기만 없었다).
    // 새 계정이 물려받을 진행도는 없으므로 조건 없이 비운다.
    usePachinkoStore.getState().reset();
    usePlateStore.getState().reset();
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
    // 파칭코 EXP/티켓도 비운다 — 안 지우면 다음에 로그인한 계정의 레벨에 얹힌다
    usePachinkoStore.getState().reset();
    // 원판 지갑(원판·구매 티켓·오늘 판 수)도 같이 비운다
    usePlateStore.getState().reset();
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
