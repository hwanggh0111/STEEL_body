import axios from 'axios';
import { readLS, removeLS, saveLS, readCookies } from '../data/safeStorage';

// 쿠키에서 값 읽기 헬퍼.
// document.cookie 도 샌드박스 iframe 에서는 던진다 — 요청 인터셉터에서 터지면
// 앱의 모든 API 호출이 죽으므로 안전하게 읽는다.
function getCookie(name) {
  const match = readCookies().match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  withCredentials: true, // httpOnly 쿠키 자동 전송
});

// 토큰 갱신 중복 방지
let isRefreshing = false;
let refreshQueue = [];
let refreshFailCount = 0;
const MAX_REFRESH_FAILS = 3;

// 요청 인터셉터: CSRF 토큰 + 레거시 Bearer 토큰
client.interceptors.request.use((config) => {
  // CSRF 토큰 (쿠키에서 읽어서 헤더로)
  const csrf = getCookie('sb_csrf');
  if (csrf) config.headers['X-CSRF-Token'] = csrf;
  // 레거시 호환: localStorage 토큰도 보냄 (마이그레이션 기간)
  const token = readLS('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 응답 인터셉터: 401 시 refresh 시도, 실패하면 로그아웃
client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    // 401이고 refresh 시도 안 한 경우
    if (err.response?.status === 401 && !originalRequest._retry) {
      // refresh 연속 실패 시 바로 로그아웃 (무한 루프 방지)
      if (refreshFailCount >= MAX_REFRESH_FAILS) {
        refreshFailCount = 0;
        removeLS('token');
        removeLS('nickname');
        window.location.href = '/login';
        return Promise.reject(err);
      }
      // refresh/logout 요청 자체가 실패한 경우는 바로 로그아웃
      if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/logout')) {
        removeLS('token');
        removeLS('nickname');
        window.location.href = '/login';
        return Promise.reject(err);
      }

      if (isRefreshing) {
        // 이미 갱신 중이면 큐에 넣고 대기
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(() => client(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          (import.meta.env.VITE_API_URL || '/api') + '/auth/refresh',
          {},
          { withCredentials: true }
        );
        // **새 토큰을 받아 적는다.** 안 적으면 쿠키가 막힌 브라우저에서 요청 인터셉터가
        // 계속 옛 토큰을 헤더로 보내고, 갱신은 200 인데 다음 요청이 또 401 이 된다.
        // 갱신이 실패한 것이 아니라 실패 횟수도 안 올라가서 고리에서 못 빠져나온다
        if (data?.token) saveLS('token', data.token);
        // 갱신 성공: 카운터 리셋 + 큐 복사 후 초기화
        refreshFailCount = 0;
        isRefreshing = false;
        const queue = [...refreshQueue];
        refreshQueue = [];
        queue.forEach(({ resolve }) => resolve());
        return client(originalRequest);
      } catch (refreshErr) {
        // refresh도 실패: 카운터 증가 + 큐 복사 후 초기화
        refreshFailCount++;
        isRefreshing = false;
        const queue = [...refreshQueue];
        refreshQueue = [];
        queue.forEach(({ reject }) => reject(refreshErr));
        removeLS('token');
        removeLS('nickname');
        saveLS('session_expired', 'true');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(err);
  }
);

export default client;
