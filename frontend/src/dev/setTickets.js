import { TICKET_RULE, BASE_MAX_STACK } from '../data/pachinkoData';
// 개발 도구도 앱이 뜨기 전에 도는 코드다 — 쿠키를 막아둔 브라우저에서 던지면 흰 화면이 된다
import { readLS, saveLS, removeLS, readCookies } from '../data/safeStorage';

// `?tickets=N` — 개발 보너스 티켓 수를 바꾼다. 개발 빌드에서만 동작한다.
//
//   ?tickets=0     보너스를 끈다. 기록으로 번 티켓만 남고 상한도 운영과 같아진다(BASE_MAX_STACK).
//   ?tickets=500   500장만 준다. 상한 동작을 볼 때 편하다.
//   ?tickets=9999999  원래대로
//
// 한 번 주면 localStorage 에 남아서 다음부터는 붙이지 않아도 유지된다.
//
// TICKET_RULE 은 pachinkoData 를 import 하는 시점에 이미 계산이 끝난다.
// (ES 모듈은 import 대상의 최상위 코드를 먼저 돌린다 — main.jsx 의 ?reset 처리보다도 먼저다.)
// 그래서 localStorage 만 쓰면 이번 로드에는 안 먹는다. 객체를 직접 갈아끼워야 한다.

const KEY = 'steelbody_dev_tickets';

export function applyDevTickets() {
  if (!import.meta.env.DEV) return;

  const params = new URLSearchParams(window.location.search);
  const raw = params.get('tickets');
  if (raw === null) return;   // 저장된 값은 import 시점에 이미 반영됐다

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    console.warn(`[dev-tickets] 0 이상의 숫자가 필요합니다: ${raw}`);
    return;
  }
  const bonus = Math.floor(n);

  try {
    saveLS(KEY, String(bonus));
  } catch { /* 저장이 안 돼도 이번 세션은 아래에서 반영된다 */ }

  TICKET_RULE.bonus = bonus;
  TICKET_RULE.maxStack = Math.max(bonus, BASE_MAX_STACK);

  // 새로고침해도 다시 적용되지 않도록 쿼리를 지운다 (값은 localStorage 에 남는다)
  params.delete('tickets');
  const qs = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));

  console.log(
    `[dev-tickets] 보너스 티켓 ${bonus.toLocaleString()}장, 보유 상한 ${TICKET_RULE.maxStack.toLocaleString()}장`
    + (bonus === 0 ? ' — 보너스를 껐습니다. 기록으로 번 티켓만 남습니다.' : '')
  );
}
