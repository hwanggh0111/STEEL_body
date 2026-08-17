import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { devAutoLogin } from './dev/autoLogin';
import { usePachinkoStore } from './store/pachinkoStore';
import { usePlateStore } from './store/plateStore';

// 테마는 index.html 인라인 스크립트가 CSS 평가 이전에 이미 적용함

// ?reset=1 이 붙어 있으면 앱이 뜨기 전에 파칭코/원판 진행도를 비운다.
// 라우터/로그인 상태와 무관하게 동작해야 해서 여기서 처리한다
// (라우트 안에서 처리하면 비로그인 시 /login 으로 튕겨 실행되지 않음).
(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('reset') !== '1') return;
  // 스토어는 import 시점(= 이 블록보다 먼저)에 이미 localStorage 를 읽어 갔다.
  // 그래서 localStorage 만 지우면 메모리에 남은 값이 다음 판에 그대로 다시 저장된다.
  // 양쪽을 같이 비우는 reset() 을 부른다.
  usePachinkoStore.getState().reset();
  usePlateStore.getState().reset();   // 원판·구매 티켓도 같이 (안 지우면 반만 초기화된다)
  // 새로고침해도 다시 초기화되지 않도록 쿼리를 지운다
  params.delete('reset');
  const qs = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
  console.log('[reset] 파칭코 EXP / 티켓 사용량 / 원판 지갑을 초기화했습니다');
})();

// 개발용 준비 작업은 첫 렌더 이전에 끝나야 한다.
// 렌더 뒤에 로그인하면 PrivateRoute 가 먼저 /login 으로 튕겨버리고,
// ?level 은 pachinkoStore 가 localStorage 를 읽기 전에 심어야 한다.
// 프로덕션 빌드에서는 아래 블록이 통째로 제거된다.
async function devBoot() {
  if (import.meta.env.DEV) {
    const { applyDevLevel } = await import('./dev/setLevel');
    applyDevLevel();
  }
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
      .then((reg) => console.log('SW registered:', reg.scope))
      .catch((err) => console.warn('SW registration failed:', err));
  });
}
