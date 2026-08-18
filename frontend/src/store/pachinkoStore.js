import { create } from 'zustand';
import { LS, LOG_MAX, UL_TICKET, readInt, readLS, saveLS, removeLS } from '../data/pachinkoData';
import { MAX_EXP, MAX_UL_EXP } from '../components/LevelSystem';
// 무한 티켓 여부는 원판 지갑이 들고 있다. plateStore 는 이 파일을 import 하지 않으므로
// 순환 참조가 생기지 않는다.
import { usePlateStore } from './plateStore';

// 파칭코 / 사다리 두 모드가 티켓과 누적 EXP를 공유한다.
// 티켓 발급량은 기록 수에서 매번 계산하므로 여기서는 "사용량"만 누적한다.
//
// 한 판은 두 단계다.
//   1) beginPlay(cost) — 판을 시작하는 즉시 티켓을 확정 차감한다
//   2) award(prize)    — 연출이 끝나면 보상만 반영한다
//
// 차감을 연출이 끝날 때로 미루면 결과를 미리 보고 무를 수 있다.
// 사다리는 출발과 동시에 5칸의 보상 배치와 가로줄이 전부 보여서, 눈으로 경로를
// 따라가면 3.6초 연출이 끝나기 전에 결과를 안다. 꽝일 때만 새로고침하면
// 티켓이 전액 환불돼 기대값이 무한대가 된다. 그래서 시작 시점에 확정한다
// (원판 피하기의 plateStore.startRun() 과 같은 이유, 같은 방식).
//
// 대신 연출 도중 이탈하면 티켓만 나가고 보상을 못 받으므로, 호출부는 언마운트 때
// award 를 한 번 더 불러 정산해야 한다. 티켓은 이미 나갔으니 보상은 반드시 준다.

function loadLog() {
  try {
    const raw = JSON.parse(readLS(LS.log) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

// 최고 등급 갱신 (등급 순위는 각 모드 테이블 순서를 따름)
function bumpBest(prize) {
  if (!prize) return;
  if (prize.exp > readInt(LS.best + '_exp', 0)) {
    saveLS(LS.best, prize.id);
    saveLS(LS.best + '_exp', prize.exp);
  }
}

export const usePachinkoStore = create((set, get) => ({
  used: readInt(LS.used, 0),
  gained: readInt(LS.exp, 0),
  // 누적 EXP 가 MAX_EXP 에 닿은 뒤로 넘쳐서 버려지던 몫. 개벽 등급이 이 값으로 계산된다.
  // gained 와 따로 두는 이유는 둘을 합치면 2^53 을 넘어 정수 정밀도가 깨지기 때문이다.
  ulExp: readInt(LS.ulExp, 0),
  // 울트라 티켓 잔량 (울트라 레전드 파칭코 전용)
  ulTickets: readInt(LS.ulTickets, 0),
  // 직전 판에서 UL EXP 로 넘어간 몫. 획득 배너가 "+0 EXP" 대신 이걸 보여준다.
  // (상한에 닿은 뒤에는 일반 EXP 증가분이 항상 0 이라 화면에 아무 일도 안 일어난 것처럼 보인다)
  lastUlGain: 0,
  log: loadLog(),

  // 보유 상한을 넘겨 쌓인 미사용 티켓을 실제로 소멸시킨다.
  //
  // available 을 min(earned - used, maxStack) 으로 "보여주기만" 하면 상한이 걸린 게 아니다.
  // earned - used 가 상한보다 큰 동안에는 티켓을 써도 표시가 줄지 않아서, 기록이 많은
  // 계정은 티켓이 무한이 된다 (운동 450회면 earned 150 — 운영 상한과 같다).
  // 그래서 넘친 만큼을 used 로 밀어 없앤다. 그 뒤로는 earned - used == maxStack 이라
  // 한 판 쓸 때마다 정직하게 줄어든다.
  trimOverflow: (earned, maxStack) => {
    const { used } = get();
    // 여기서 넘치는 건 '티켓' 이다. EXP 쪽 초과분(ulExp)과 헷갈리지 않게 이름을 나눈다.
    const spill = earned - used - maxStack;
    if (!(spill > 0)) return 0;   // NaN 이면 아무것도 하지 않는다
    const nextUsed = used + spill;
    saveLS(LS.used, nextUsed);
    set({ used: nextUsed });
    return spill;
  },

  // 판을 시작할 때 티켓을 확정 차감한다. cost 가 이상한 값이면 시작하지 않는다.
  // 남은 티켓 검사는 발급량(earned)을 아는 호출부 몫이다.
  beginPlay: (cost) => {
    const n = Number.isFinite(+cost) ? Math.floor(+cost) : 0;
    if (n <= 0) return false;
    // 무한 티켓을 얻었으면 소모하지 않는다. 이게 "진짜 무한"의 구현이다 —
    // 지갑에 큰 수를 넣는 대신 차감을 멈춘다 (pachinkoData 의 UNLIMITED_TICKETS 주석 참고).
    if (usePlateStore.getState().unlimited) return true;
    const nextUsed = get().used + n;
    saveLS(LS.used, nextUsed);
    set({ used: nextUsed });
    return true;
  },

  // 한 판의 보상을 반영한다. prize=당첨 등급, mode='reel'|'ladder'
  // 티켓은 beginPlay 에서 이미 나갔으므로 여기서는 건드리지 않는다.
  // 반환값은 상한에 잘린 뒤의 "실제 증가분" — 획득 배너가 이전 레벨을 역산하는 데 쓴다.
  award: (prize, mode) => {
    const { gained, log } = get();

    // 2^53을 넘으면 정수 정밀도가 깨지므로 상한에서 자른다.
    // gained + prize.exp 를 먼저 더하면 그 합 자체가 2^53 을 넘어 끝자리가 뭉개진다.
    // 남은 자리(room)를 먼저 구해서 "들어갈 몫"과 "넘칠 몫"으로 나눈다.
    const room = MAX_EXP - gained;
    const applied = Math.min(prize.exp, room);
    const nextGained = gained + applied;
    // 상한을 넘은 몫은 버린다. UL EXP 는 울트라 레전드 파칭코(awardUl)에서만 나온다 —
    // 한때 이 초과분을 UL EXP 로 넘겼지만, 그건 그 기계가 없던 시절의 임시 통로였다.
    // 지금은 남는 티켓을 교환소에서 울트라 티켓으로 바꾸는 게 정해진 경로다.
    const nextLog = [{ id: prize.id, exp: prize.exp, mode }, ...log].slice(0, LOG_MAX);

    saveLS(LS.exp, nextGained);
    saveLS(LS.log, JSON.stringify(nextLog));
    bumpBest(prize);

    set({ gained: nextGained, lastUlGain: 0, log: nextLog });
    return nextGained - gained;
  },

  // 여러 판의 보상을 한 번에 반영한다 (10연차 / 모두 쓰기).
  // 판마다 set을 호출하면 리렌더가 수백 번 일어나므로 한 번에 합산한다.
  //
  // 판 배열이 아니라 등급별 횟수를 받는다. rows = [{ prize, count }].
  // 티켓 수백만 장을 한 번에 써도 그만큼 배열을 만들 필요가 없다.
  awardMany: (rows, mode) => {
    const { gained, log } = get();

    // exp * count 는 2^53을 넘길 수 있다 (초신성 999조가 10회만 나와도 1e16).
    // 넘는 순간 끝자리부터 뭉개져 요약 패널 숫자가 조용히 틀리므로,
    // 안전 정수 범위를 벗어나면 합산을 멈추고 "상한 도달"로 취급한다.
    // 어차피 저장값은 MAX_EXP 에서 잘리므로 레벨 계산에는 영향이 없다.
    let sum = 0;
    let exact = true;
    for (const r of rows) {
      const add = r.prize.exp * r.count;
      if (!Number.isSafeInteger(add) || !Number.isSafeInteger(sum + add)) {
        exact = false;
        break;
      }
      sum += add;
    }
    if (!exact) sum = MAX_EXP;

    // 넘친 몫은 버린다 (award 주석 참고 — UL EXP 는 awardUl 에서만 나온다).
    // 자르기 전에 더하면 그 합이 2^53 을 넘어 끝자리가 뭉개지므로 남은 자리를 먼저 구한다.
    const room = MAX_EXP - gained;
    const applied = Math.min(sum, room);
    const nextGained = gained + applied;

    // 기록에는 등급이 높은 것부터 남긴다 (수백만 판이면 전부 남길 수 없음)
    const byExp = [...rows].sort((a, b) => b.prize.exp - a.prize.exp);
    const head = [];
    for (const r of byExp) {
      for (let i = 0; i < r.count && head.length < LOG_MAX; i++) {
        head.push({ id: r.prize.id, exp: r.prize.exp, mode });
      }
      if (head.length >= LOG_MAX) break;
    }
    const nextLog = [...head, ...log].slice(0, LOG_MAX);

    saveLS(LS.exp, nextGained);
    saveLS(LS.log, JSON.stringify(nextLog));

    const best = byExp[0]?.prize;
    bumpBest(best);

    set({ gained: nextGained, lastUlGain: 0, log: nextLog });
    // totalExp = 상한에 잘린 뒤 실제로 반영된 양.
    // exact=false 면 등급별 합계도 믿을 수 없으므로 화면에서 정확한 수치를 감춘다.
    return { totalExp: nextGained - gained, exact, best };
  },

  // 일반 티켓을 울트라 티켓으로 바꾼다 (UL_TICKET.rate 장 → 1장).
  // 차감은 beginPlay 를 그대로 태운다 — 무한 티켓이면 안 닳는 규칙까지 따라간다.
  // available(지금 쓸 수 있는 티켓)은 발급량을 아는 호출부만 알기 때문에 인자로 받는다.
  exchangeUlTickets: (count, available) => {
    const n = Math.floor(Number(count) || 0);
    if (n < 1) return 0;
    const cost = UL_TICKET.rate * n;
    const unlimited = usePlateStore.getState().unlimited;
    if (!unlimited && !(available >= cost)) return 0;   // NaN 이면 아무것도 안 한다
    if (!get().beginPlay(cost)) return 0;

    const next = get().ulTickets + n;
    saveLS(LS.ulTickets, next);
    set({ ulTickets: next });
    return n;
  },

  // 울트라 티켓을 쓴다. 판을 시작하는 순간 부르는 것이 규칙 —
  // 연출이 끝날 때 빼면 결과를 보고 새로고침해서 무를 수 있다 (beginPlay 와 같은 이유).
  spendUlTickets: (count) => {
    const n = Math.floor(Number(count) || 0);
    const { ulTickets } = get();
    if (n < 1 || ulTickets < n) return false;
    const next = ulTickets - n;
    saveLS(LS.ulTickets, next);
    set({ ulTickets: next });
    return true;
  },

  // 울트라 레전드 파칭코 전용 — 보상이 UL EXP 로 바로 들어간다.
  // 일반 EXP(gained)는 건드리지 않는다. 로그도 안 남긴다 — 일반 파칭코 로그와
  // 단위가 달라(EXP vs UL EXP) 같은 목록에 섞으면 숫자를 잘못 읽게 된다.
  awardUl: (amount) => {
    const { ulExp } = get();
    const add = Number.isFinite(+amount) ? Math.max(0, Math.floor(+amount)) : 0;
    // award 와 같은 이유로 먼저 남은 자리를 구한다 — ulExp + add 는 2^53 을 넘을 수 있다
    const room = MAX_UL_EXP - ulExp;
    const applied = Math.min(add, room);
    const next = ulExp + applied;

    saveLS(LS.ulExp, next);
    set({ ulExp: next, lastUlGain: applied });
    return applied;
  },

  reset: () => {
    [LS.used, LS.exp, LS.ulExp, LS.ulTickets, LS.log, LS.best, LS.best + '_exp'].forEach(removeLS);
    set({ used: 0, gained: 0, ulExp: 0, ulTickets: 0, lastUlGain: 0, log: [] });
  },
}));
