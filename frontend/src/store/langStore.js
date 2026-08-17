import { create } from 'zustand';

// 앱은 한국어 전용이다.
// 각 컴포넌트의 T.en 사전은 그대로 남겨뒀으므로, 영어를 다시 열려면
// 아래 lang 을 localStorage 에서 읽도록 되돌리고 Layout 의 🌐 버튼만 살리면 된다.
export const useLangStore = create(() => ({
  lang: 'ko',
  setLang: () => {},   // 전환 없음 — 호출부가 남아 있어도 터지지 않도록 빈 함수로 둔다
}));
