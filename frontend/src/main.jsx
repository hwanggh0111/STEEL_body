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
//
// **개발 중에는 안 붙인다.** 서비스 워커는 캐시 먼저 주게 돼 있어서(8/28 에 그렇게
// 고쳤다), 코드를 고치고 새로고침해도 **어제 화면이 그대로 나온다.** 오늘 이것 때문에
// 「안 바뀌는데?」를 겪었다. 이미 붙어 있던 것도 여기서 떼고 캐시를 비운다
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .then(() => (window.caches ? caches.keys() : []))
      .then((keys) => Promise.all([...keys].map((k) => caches.delete(k))))
      .catch(() => {});
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}
