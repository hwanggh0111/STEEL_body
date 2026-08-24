import { useState, useEffect } from 'react';

// 화면이 PC 폭인가.
//
// Layout 과 TabBar 가 같은 훅을 각자 갖고 있었다 — resize 리스너가 둘, 타이머가 둘,
// 그리고 대기 시간이 서로 달라(150ms / 100ms) 창을 줄이면 사이드바와 탭바가
// 한 박자 어긋나게 바뀌었다. 하나로 합친다.
const PC_WIDTH = 768;
const SETTLE_MS = 120;

export function useIsPC() {
  const [isPC, setIsPC] = useState(() => window.innerWidth >= PC_WIDTH);

  useEffect(() => {
    let tid;
    const handler = () => {
      clearTimeout(tid);
      tid = setTimeout(() => setIsPC(window.innerWidth >= PC_WIDTH), SETTLE_MS);
    };
    window.addEventListener('resize', handler);
    return () => { clearTimeout(tid); window.removeEventListener('resize', handler); };
  }, []);

  return isPC;
}

export default useIsPC;
