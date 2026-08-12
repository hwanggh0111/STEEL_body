import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 테마는 index.html 인라인 스크립트가 CSS 평가 이전에 이미 적용함

// ?reset=1 이 붙어 있으면 앱이 뜨기 전에 파칭코 진행도를 비운다.
// 라우터/로그인 상태와 무관하게 동작해야 해서 여기서 처리한다
// (라우트 안에서 처리하면 비로그인 시 /login 으로 튕겨 실행되지 않음).
(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('reset') !== '1') return;
  [
    'steelbody_pachinko_used',
    'steelbody_pachinko_exp',
    'steelbody_pachinko_log',
    'steelbody_pachinko_best',
    'steelbody_pachinko_best_exp',
  ].forEach(k => localStorage.removeItem(k));
  // 새로고침해도 다시 초기화되지 않도록 쿼리를 지운다
  params.delete('reset');
  const qs = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
  console.log('[reset] 파칭코 EXP / 티켓 사용량을 초기화했습니다');
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('SW registered:', reg.scope))
      .catch((err) => console.warn('SW registration failed:', err));
  });
}
