import { create } from 'zustand';
import client from '../api/client';

// 쿠키 존재 여부로 로그인 상태 판단 (sb_csrf는 httpOnly가 아니므로 읽기 가능)
function hasCsrfCookie() {
  return document.cookie.includes('sb_csrf=');
}

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('token'), // 레거시 호환
  nickname: localStorage.getItem('nickname'),
  isLoggedIn: !!localStorage.getItem('token') || hasCsrfCookie(),

  login: async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password });
    // 서버가 httpOnly 쿠키를 설정함 + 레거시 body에도 token 포함
    if (data.token) localStorage.setItem('token', data.token);
    localStorage.setItem('nickname', data.nickname);
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
    set({ token: null, nickname: null, isLoggedIn: false });
    // 다른 스토어 초기화
    try {
      const { useWorkoutStore } = require('./workoutStore');
      const { useInbodyStore } = require('./inbodyStore');
      useWorkoutStore.setState({ workouts: {}, loading: false });
      useInbodyStore.setState({ records: [], loading: false });
    } catch {}
  },

  // 쿠키 기반 인증 상태 확인 (앱 시작 시 호출)
  checkAuth: async () => {
    try {
      const { data } = await client.get('/auth/me');
      localStorage.setItem('nickname', data.nickname);
      set({ nickname: data.nickname, isLoggedIn: true });
      return true;
    } catch {
      set({ isLoggedIn: false });
      return false;
    }
  },
}));
