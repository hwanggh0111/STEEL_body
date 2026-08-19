import { useAuthStore } from '../store/authStore';
// 개발 도구도 앱이 뜨기 전에 도는 코드다 — 쿠키를 막아둔 브라우저에서 던지면 흰 화면이 된다
import { readLS, saveLS, removeLS, readCookies } from '../data/safeStorage';

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
  //
  // 다만 "쿠키가 있다 = 로그인돼 있다" 로 보면 안 된다. 세션이 죽은 뒤에도
  // sb_csrf 쿠키와 ironlog_email 은 그대로 남아서, 로그아웃된 상태인데도 이 가드에
  // 걸려 자동 로그인이 건너뛰어진다. 그러면 새로고침을 몇 번을 해도 안 돌아온다.
  // 그래서 살아 있는지 실제로 물어본다.
  //
  // axios 클라이언트가 아니라 fetch 를 쓴다 — 401 이 응답 인터셉터를 타면
  // refresh 를 시도하고 실패 시 /login 으로 튕겨서, 여기서 다시 로그인할 기회가 없어진다.
  const authed = readLS('token') || readCookies().includes('sb_csrf=');
  if (authed && readLS('ironlog_email') === email) {
    const base = import.meta.env.VITE_API_URL || '/api';
    const alive = await fetch(`${base}/auth/me`, { credentials: 'include' })
      .then(r => r.ok)
      .catch(() => false);
    if (alive) return;
    console.info('[dev-login] 세션이 죽어 있어 다시 로그인합니다');
  }

  try {
    await useAuthStore.getState().login(email, password);
    console.info(`[dev-login] ${email} 로 로그인했습니다`);
  } catch (err) {
    // 자동 로그인 실패가 앱 부팅을 막으면 안 되므로 삼키고 로그인 화면으로 보낸다.
    console.warn('[dev-login] 실패:', err?.response?.data?.error || err?.message);
  }
}
