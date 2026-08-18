import { expForLevel, MAX_LEVEL } from '../components/LevelSystem';
import { LS } from '../data/pachinkoData';
import { usePachinkoStore } from '../store/pachinkoStore';

// ?level=30  으로 계정 레벨을 그 자리에서 올린다 (개발용).
// ?level=max 면 만렙.
//
// 레벨은 저장되는 값이 아니라 "기록 EXP + 파칭코 EXP"에서 매번 계산되므로,
// 직접 심을 수 있는 건 파칭코 EXP 뿐이다. 그래서 목표 레벨의 문턱값을 거기에 넣는다.
// 운동/인바디 기록이 있으면 그만큼 EXP가 더해져 목표보다 한두 레벨 높게 나올 수 있다.
//
// pachinkoStore 는 모듈 로드 시점에 localStorage 를 읽어가므로, 여기서는 localStorage 와
// 스토어 state 를 함께 맞춘다 (localStorage 만 고치면 메모리에 남은 옛 값이 다시 저장된다).

// 주소창에 아무것도 안 쳐도 한 번은 적용되는 시작 레벨.
// tag 가 localStorage 에 남아 있으면 건너뛰므로 브라우저당 딱 한 번만 돈다.
// 다시 한 번 강제하고 싶으면 tag 값을 바꾸면 된다 ('lv0-2', 'lv50-1' 처럼).
const ONCE = { tag: 'lv0-1', level: 0 };
const ONCE_KEY = 'steelbody_dev_level_once';

function applyOnce(setLevelTo) {
  if (localStorage.getItem(ONCE_KEY) === ONCE.tag) return false;
  setLevelTo(ONCE.level);
  localStorage.setItem(ONCE_KEY, ONCE.tag);
  console.info(`[dev-level] 최초 1회 적용 — LV ${ONCE.level} 로 맞췄습니다 (tag: ${ONCE.tag})`);
  return true;
}

export function applyDevLevel() {
  if (!import.meta.env.DEV) return;

  // 목표 레벨의 문턱값을 파칭코 EXP 에 심는다. 티켓 사용량도 함께 비워 처음 상태로 되돌린다.
  const setLevelTo = (lv) => {
    const exp = expForLevel(lv);
    localStorage.setItem(LS.exp, String(exp));
    // 울트라 티켓(교환으로만 생기는 값)까지 비운다. 안 그러면 LV 0 인데 끝판 티켓을
    // 들고 있는 상태가 돼서 "처음 상태"가 아니게 된다.
    [LS.used, LS.ulExp, LS.ulTickets, LS.log, LS.best, LS.best + '_exp']
      .forEach(k => localStorage.removeItem(k));
    usePachinkoStore.setState({
      gained: exp, used: 0, ulExp: 0, ulTickets: 0, lastUlGain: 0, log: [],
    });
  };

  const params = new URLSearchParams(window.location.search);
  const raw = params.get('level');
  if (raw === null) { applyOnce(setLevelTo); return; }

  const level = raw === 'max' ? MAX_LEVEL : Number(raw);
  if (!Number.isFinite(level)) {
    console.warn(`[dev-level] "${raw}" 는 레벨로 읽을 수 없습니다 (0~${MAX_LEVEL} 또는 max)`);
    return;
  }

  const clamped = Math.max(0, Math.min(Math.floor(level), MAX_LEVEL));
  setLevelTo(clamped);
  // ?level 을 직접 쓴 이상 1회 적용분은 소진된 것으로 본다
  localStorage.setItem(ONCE_KEY, ONCE.tag);

  // 새로고침해도 다시 적용되지 않도록 쿼리를 지운다
  params.delete('level');
  const qs = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));

  const note = clamped !== level ? ` (${level} → ${clamped} 로 잘림)` : '';
  const exp = expForLevel(clamped);
  console.info(`[dev-level] LV ${clamped} 로 맞췄습니다 — 파칭코 EXP ${exp.toLocaleString()}${note}`);
}
