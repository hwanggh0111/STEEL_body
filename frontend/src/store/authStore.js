import { create } from 'zustand';
import client from '../api/client';
import { useWorkoutStore } from './workoutStore';
import { useInbodyStore } from './inbodyStore';

// 쿠키 존재 여부로 로그인 상태 판단 (sb_csrf는 httpOnly가 아니므로 읽기 가능)
function hasCsrfCookie() {
  return document.cookie.includes('sb_csrf=');
}

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('token'), // 레거시 호환 (httpOnly 쿠키 전환 완료 후 제거 예정)
  nickname: localStorage.getItem('nickname'),
  isLoggedIn: !!localStorage.getItem('token') || hasCsrfCookie(),

  login: async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password });
    if (data.token) localStorage.setItem('token', data.token);
    localStorage.setItem('nickname', data.nickname);
    if (data.email) localStorage.setItem('ironlog_email', data.email);
    if (data.role) localStorage.setItem('ironlog_role', data.role);
    set({ token: data.token, nickname: data.nickname, isLoggedIn: true });
  },

  register: async (email, password, nickname, username) => {
    await client.post('/auth/register', { email, password, nickname, username });
  },

  logout: async () => {
    try {
      await client.post('/auth/logout');
    } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('nickname');
    localStorage.removeItem('ironlog_role');
    // CSRF 쿠키 클라이언트에서도 삭제 (서버 실패 대비)
    document.cookie = 'sb_csrf=; Max-Age=0; path=/';
    set({ token: null, nickname: null, isLoggedIn: false });
    // 다른 스토어 초기화
    useWorkoutStore.setState({ workouts: {}, loading: false });
    useInbodyStore.setState({ records: [], loading: false });
  },

  // 쿠키 기반 인증 상태 확인 (앱 시작 시 호출)
  checkAuth: async () => {
    try {
      const { data } = await client.get('/auth/me');
      localStorage.setItem('nickname', data.nickname);
      if (data.role) localStorage.setItem('ironlog_role', data.role);
      set({ nickname: data.nickname, isLoggedIn: true });
      return true;
    } catch {
      set({ isLoggedIn: false });
      return false;
    }
  },
}));
