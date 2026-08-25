import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { devAutoLogin } from './dev/autoLogin';

// 테마는 index.html 인라인 스크립트가 CSS 평가 이전에 이미 적용함

// 개발용 자동 로그인은 첫 렌더 이전에 끝나야 한다.
// 렌더 뒤에 로그인하면 PrivateRoute 가 먼저 /login 으로 튕겨버린다.
// 프로덕션 빌드에서는 아래 블록이 통째로 제거된다.
async function devBoot() {
  await devAutoLogin();
}

devBoot().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

// Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      // 로그는 개발 빌드에서만. 운영 콘솔에 남길 이유가 없다
      .then((reg) => { if (import.meta.env.DEV) console.log('SW registered:', reg.scope); })
      .catch((err) => { if (import.meta.env.DEV) console.warn('SW registration failed:', err); });
  });
}
