import { create } from 'zustand';
import { PLATE_RULE, PLS, todayKey } from '../data/plateData';
import { readInt, readLS, saveLS, removeLS } from '../data/pachinkoData';

// 원판 피하기의 지갑.
// 원판은 게임으로 벌고, 티켓은 원판으로 산다.
// 하루 판 수를 제한해야 무한 파밍이 안 되므로 "오늘 돌린 판 수"를 날짜와 함께 들고 있는다.

function loadDay() {
  const raw = readLS(PLS.day) || '';
  const [date, plays] = raw.split('|');
  const today = todayKey();
  if (date !== today) return { date: today, plays: 0 };
  const n = Number(plays);
  return { date: today, plays: Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0 };
}

function saveDay(day) {
  saveLS(PLS.day, `${day.date}|${day.plays}`);
}

export const usePlateStore = create((set, get) => ({
  plates: readInt(PLS.plates, 0),
  purchased: readInt(PLS.purchased, 0),
  best: readInt(PLS.best, 0),
  day: loadDay(),

  // 날짜가 바뀌었으면 오늘 판 수를 0으로 되돌린다 (앱을 켜 둔 채 자정을 넘긴 경우)
  rollDay: () => {
    const today = todayKey();
    if (get().day.date === today) return;
    const day = { date: today, plays: 0 };
    saveDay(day);
    set({ day });
  },

  remainingPlays: () => Math.max(0, PLATE_RULE.dailyPlays - get().day.plays),

  // 판을 시작할 때 한 번 차감한다.
  // 끝날 때 차감하면 지기 직전에 새로고침해서 무한히 돌릴 수 있다.
  startRun: () => {
    get().rollDay();
    const { day } = get();
    if (day.plays >= PLATE_RULE.dailyPlays) return false;
    const next = { ...day, plays: day.plays + 1 };
    saveDay(next);
    set({ day: next });
    return true;
  },

  // 한 판이 끝나면 번 원판을 넣는다.
  finishRun: (raw) => {
    const { plates, best } = get();
    const nextPlates = plates + raw;
    const nextBest = Math.max(best, raw);

    saveLS(PLS.plates, nextPlates);
    saveLS(PLS.best, nextBest);

    set({ plates: nextPlates, best: nextBest });
    return { added: raw, remaining: get().remainingPlays() };
  },

  // 원판으로 티켓을 산다. 살 수 있는 만큼만 사고 실제 구매 수를 돌려준다.
  buyTickets: (count) => {
    const { plates, purchased } = get();
    const affordable = Math.floor(plates / PLATE_RULE.perTicket);
    // count 가 NaN 이면 Math.min/max 를 통과해도 NaN 이라 n === 0 검사를 빠져나간다.
    // 그대로 두면 plates 가 NaN 이 되어 지갑이 통째로 망가진다.
    const want = Number.isFinite(+count) ? Math.floor(+count) : 0;
    const n = Math.max(0, Math.min(want, affordable));
    if (n <= 0) return 0;

    const nextPlates = plates - n * PLATE_RULE.perTicket;
    const nextPurchased = purchased + n;
    saveLS(PLS.plates, nextPlates);
    saveLS(PLS.purchased, nextPurchased);

    set({ plates: nextPlates, purchased: nextPurchased });
    return n;
  },

  reset: () => {
    [PLS.plates, PLS.purchased, PLS.best, PLS.day].forEach(removeLS);
    set({ plates: 0, purchased: 0, best: 0, day: { date: todayKey(), plays: 0 } });
  },
}));
