import { useAuthStore } from '../store/authStore';

// 개발 중에만 동작하는 자동 로그인.
// import.meta.env.DEV 는 빌드 시 false 로 치환되므로 프로덕션 번들에서는 통째로 죽는다.
// 계정 정보는 frontend/.env.local, 끄려면 VITE_DEV_AUTOLOGIN=0 (Vite 재시작 필요).

export async function devAutoLogin() {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_DEV_AUTOLOGIN !== '1') return;

  const email = import.meta.env.VITE_DEV_EMAIL;
  const password = import.meta.env.VITE_DEV_PASSWORD;
  if (!email || !password) return;

  // 같은 계정 세션이 이미 있으면 그대로 둔다 (새로고침마다 토큰 발급 방지).
  // 이메일이 바뀌었으면 옛 세션을 버리고 새로 로그인해야 한다.
  const authed = localStorage.getItem('token') || document.cookie.includes('sb_csrf=');
  if (authed && localStorage.getItem('ironlog_email') === email) return;

  try {
    await useAuthStore.getState().login(email, password);
    console.info(`[dev-login] ${email} 로 로그인했습니다`);
  } catch (err) {
    // 자동 로그인 실패가 앱 부팅을 막으면 안 되므로 삼키고 로그인 화면으로 보낸다.
    console.warn('[dev-login] 실패:', err?.response?.data?.error || err?.message);
  }
}
