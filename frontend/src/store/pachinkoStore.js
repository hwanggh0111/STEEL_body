import { create } from 'zustand';
import { LS, LOG_MAX, readInt } from '../data/pachinkoData';
import { MAX_EXP } from '../components/LevelSystem';

// 파칭코 / 사다리 두 모드가 티켓과 누적 EXP를 공유한다.
// 티켓 발급량은 기록 수에서 매번 계산하므로 여기서는 "사용량"만 누적한다.

function loadLog() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS.log) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export const usePachinkoStore = create((set, get) => ({
  used: readInt(LS.used, 0),
  gained: readInt(LS.exp, 0),
  log: loadLog(),

  // 한 판 결과를 반영한다. cost=소모 티켓, prize=당첨 등급, mode='reel'|'ladder'
  play: (cost, prize, mode) => {
    const { used, gained, log } = get();

    const nextUsed = used + cost;
    // 2^53을 넘으면 정수 정밀도가 깨지므로 LV100 기준선에서 자른다
    const nextGained = Math.min(gained + prize.exp, MAX_EXP);
    const nextLog = [{ id: prize.id, exp: prize.exp, mode }, ...log].slice(0, LOG_MAX);

    localStorage.setItem(LS.used, String(nextUsed));
    localStorage.setItem(LS.exp, String(nextGained));
    localStorage.setItem(LS.log, JSON.stringify(nextLog));

    // 최고 등급 갱신 (등급 순위는 각 모드 테이블 순서를 따름)
    const prevBest = localStorage.getItem(LS.best);
    if (!prevBest || prize.exp > readInt(LS.best + '_exp', 0)) {
      localStorage.setItem(LS.best, prize.id);
      localStorage.setItem(LS.best + '_exp', String(prize.exp));
    }

    set({ used: nextUsed, gained: nextGained, log: nextLog });
    return nextGained;
  },

  reset: () => {
    [LS.used, LS.exp, LS.log, LS.best, LS.best + '_exp'].forEach(k => localStorage.removeItem(k));
    set({ used: 0, gained: 0, log: [] });
  },
}));
