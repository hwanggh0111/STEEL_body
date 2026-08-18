import { useState, useRef, useEffect, useCallback } from 'react';
import { useLangStore } from '../store/langStore';
import { usePachinkoStore } from '../store/pachinkoStore';
import { toast } from './Toast';
import ExpGainBanner from './ExpGainBanner';
import {
  LADDER, LADDER_PRIZES, LADDER_EXPECTED_EXP, drawLadderPrize, compactExp,
} from '../data/pachinkoData';

// 배수판 구성은 T 의 안내 문구가 참조하므로 T 보다 위에 있어야 한다.
// (아래에 두면 모듈이 평가되는 순간 TDZ 로 터진다 — 빌드는 통과하고 런타임에만 죽는다)
const GAMBLE_MULTS = [2, 2, 1, 0, 0];
const MAX_DOUBLE = 3;    // 연속 3회까지 → 최대 8배

const T = {
  ko: {
    title: '사다리타기',
    sub: `하이리스크 — 티켓 ${LADDER.cost}장`,
    tickets: '보유 티켓',
    pick: '시작점을 고르고 출발하세요',
    go: '출발',
    fromCol: '번에서',
    tracing: '내려가는 중…',
    noTicket: `티켓 ${LADDER.cost}장이 필요해요`,
    rates: '확률표',
    ratesTitle: '사다리 확률표',
    ratesDesc: `티켓 ${LADDER.cost}장을 걸고 한 판. 꽝이 잦은 대신 최고 보상 확률이 파칭코의 약 100배입니다.`,
    avg: '판당 평균',
    expUnit: '경험치',
    cost: '판당 비용',
    close: '닫기',
    retry: '다시',
    heldToast: '아직 안 받았습니다 — 챙기거나 한 번 더',
    take: '지금 챙기기',
    gamble: '두 배로 간다',
    gambleLeft: (k) => `더블 오어 나씽 — ${k}번 더 걸 수 있습니다`,
    gamblePick: '배수 칸이 보입니다. 시작점을 고르세요 — 사다리는 출발해야 드러납니다',
    gambleGo: (c) => `${c}번에서 건다`,
    cancel: '그만두기',
    gambleNote: `당첨되면 받기 전에 한 번 더 걸 수 있습니다. 배수 칸 ${GAMBLE_MULTS.length}개가 ×2 ×2 본전 꽝 꽝 이라 거는 기대값은 1.0 — 걸어도 평균 수익은 그대로이고 진폭만 커집니다. 최대 ${MAX_DOUBLE}연속(${2 ** MAX_DOUBLE}배)까지.`,
    busted: '💀 전부 날아갔습니다',
    maxed: `${MAX_DOUBLE}연속 성공 — 여기까지입니다`,
  },
  en: {
    title: 'Ladder',
    sub: `High risk — ${LADDER.cost} tickets`,
    tickets: 'Tickets',
    pick: 'Pick a start, then go',
    go: 'START FROM',
    fromCol: '',
    tracing: 'Tracing…',
    noTicket: `Needs ${LADDER.cost} tickets`,
    rates: 'Odds',
    ratesTitle: 'Ladder Odds',
    ratesDesc: `${LADDER.cost} tickets per play. More misses, but ~100x the top-prize chance.`,
    avg: 'Avg / play',
    expUnit: 'EXP',
    cost: 'Cost / play',
    close: 'Close',
    retry: 'Again',
    heldToast: 'Not banked yet — take it or push',
    take: 'Take it',
    gamble: 'Double or nothing',
    gambleLeft: (k) => `Double or nothing — ${k} left`,
    gamblePick: 'Multipliers are face-up. Pick a start — rungs show once you go',
    gambleGo: (c) => `PUSH FROM ${c}`,
    cancel: 'Back',
    gambleNote: `A win can be pushed before you bank it. The ${GAMBLE_MULTS.length} slots are ×2 ×2 keep bust bust — an EV of exactly 1.0, so pushing changes the swing, not the average. Up to ${MAX_DOUBLE} in a row (${2 ** MAX_DOUBLE}×).`,
    busted: '💀 Busted — all gone',
    maxed: `${MAX_DOUBLE} in a row — that is the cap`,
  },
};

const W = 300;   // SVG 좌표계 너비
const H = 210;   // SVG 좌표계 높이
const PAD_Y = 16;
// PC처럼 폭이 넓은 화면에서 사다리가 세로로 과하게 늘어나지 않도록 하는 상한
const LADDER_MAX_W = 420;

// ══ 더블 오어 나씽 ══
// 당첨된 판은 바로 받지 않고 한 번 더 걸 수 있다. 이때 도착 칸이 배수판으로 바뀐다.
// 배수의 합(2+2+1+0+0=5)이 칸 수와 같아 한 번 거는 기대값이 정확히 1.0 이다 —
// 걸든 안 걸든 사다리 모드 전체의 기대 EXP 는 변하지 않는다. 분산만 커진다.
// 칸 수와 길이가 같아야 하므로 LADDER.columns 를 바꾸면 여기도 같이 고쳐야 한다.

// 배수 칸을 보상 칸과 같은 모양으로 만든다 (도착 칸 렌더가 icon/label/color/exp 를 그대로 쓴다)
function gambleSlot(mult, heldExp) {
  if (mult >= 2) return {
    id: 'l_g2', mult, exp: heldExp * mult, icon: '✨', color: '#c060ff',
    label: { ko: `×${mult}`, en: `×${mult}` },
    msg: { ko: '두 배로 불렸습니다!', en: 'Doubled!' },
  };
  if (mult === 1) return {
    id: 'l_g1', mult, exp: heldExp, icon: '🛡️', color: '#4a9aff',
    label: { ko: '본전', en: 'Keep' },
    msg: { ko: '그대로 지켰습니다', en: 'Kept it' },
  };
  return {
    id: 'l_g0', mult, exp: 0, icon: '💀', color: '#555555',
    label: { ko: '꽝', en: 'Bust' },
    msg: { ko: '전부 날아갔습니다…', en: 'All gone…' },
  };
}

// 배수 칸 배치는 균등해야 한다. 사다리의 도착 분포는 칸마다 조금씩 다르므로
// (가운데 칸이 더 자주 걸린다) 배치가 치우치면 기대값 1.0 이 깨진다.
// sort(() => Math.random() - 0.5) 는 균등한 셔플이 아니라서 피셔-예이츠를 쓴다.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 걸 수 있는 판인지. 꽝은 걸 게 없고, 초대박(999조)은 그대로 챙기게 둔다 —
// 8배까지 불려봐야 누적 상한에 잘리고, 최고 보상을 잃게 만들 이유도 없다.
const canGamble = (prize) => prize.exp > 0 && prize.id !== 'l_max';

// 각 층마다 인접한 두 세로줄 사이에 가로줄을 놓는다.
// 같은 층에서 한 줄이 두 개의 가로줄을 갖지 않도록 막는다 (사다리타기 규칙).
function buildRungs() {
  const rungs = [];
  for (let row = 0; row < LADDER.rows; row++) {
    const taken = new Set();
    for (let col = 0; col < LADDER.columns - 1; col++) {
      if (taken.has(col)) continue;
      if (Math.random() < LADDER.rungChance) {
        rungs.push({ row, col });       // col ↔ col+1 연결
        taken.add(col);
        taken.add(col + 1);
      }
    }
  }
  return rungs;
}

// 시작 칸에서 사다리를 타고 내려간 경로와 도착 칸을 구한다
function trace(rungs, startCol) {
  let col = startCol;
  const path = [{ row: -1, col }];
  for (let row = 0; row < LADDER.rows; row++) {
    const left = rungs.find(r => r.row === row && r.col === col - 1);
    const right = rungs.find(r => r.row === row && r.col === col);
    if (left) col -= 1;
    else if (right) col += 1;
    path.push({ row, col });
  }
  return { path, end: col };
}

const colX = (c) => ((c + 0.5) / LADDER.columns) * W;
const rowY = (r) => PAD_Y + ((r + 1) / (LADDER.rows + 1)) * (H - PAD_Y * 2);

export default function LadderGame({ available = 0, baseExp = 0 }) {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;
  const { beginPlay, gained, ulExp, lastUlGain } = usePachinkoStore();

  const [rungs, setRungs] = useState(() => buildRungs());
  const [slots, setSlots] = useState(() => LADDER_PRIZES.slice(0, LADDER.columns));
  const [selected, setSelected] = useState(0);   // 고른 시작점 (아직 출발 전)
  const [picked, setPicked] = useState(null);    // 실제로 출발한 시작점
  const [pathD, setPathD] = useState('');
  // 선 그리기 단계
  //  idle    — 아직 안 그림
  //  armed   — 트랜지션을 끈 채 선을 감춰둔 상태 (되감기 애니메이션 방지)
  //  drawing — 트랜지션을 켜고 끝까지 그리는 중
  const [phase, setPhase] = useState('idle');
  const [tracing, setTracing] = useState(false);
  const [result, setResult] = useState(null);
  const [showRates, setShowRates] = useState(false);
  // 아직 받지 않고 손에 든 보상. { prize, mult } — 더블 오어 나씽 중에는 계속 여기 남는다.
  // 실제 EXP 는 prize.exp * mult 이고, 확정된 값은 언제나 inFlightRef 에도 들어 있다.
  const [stake, setStake] = useState(null);
  const [doubles, setDoubles] = useState(0);       // 연속으로 성공한 횟수
  const [gambleMode, setGambleMode] = useState(false);   // 배수판을 깔고 시작점을 기다리는 중

  const timersRef = useRef([]);
  const rafRef = useRef(0);
  // 한 판마다 타이머 id 가 하나씩 쌓이므로 매 판 시작할 때 비운다.
  // (파칭코는 이미 이렇게 하고 있다)
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    cancelAnimationFrame(rafRef.current);
  };

  // 연출 중이라 아직 화면에 안 나온 보상. 티켓은 출발할 때 이미 나갔으므로
  // 도중에 이탈하면 여기 든 보상을 정산해 준다 (안 하면 티켓만 날린 셈이 된다).
  const inFlightRef = useRef(null);
  // 배수판을 깔기 직전의 도착 칸 — 그만두기를 누르면 이걸로 되돌린다
  const boardBeforeGambleRef = useRef(null);
  // 언마운트 cleanup 이 한 번만 걸리도록 참조를 고정한다. 스토어 함수는 zustand 가
  // 만들 때 한 번 만들어져 계속 같은 참조이므로 getState() 로 꺼내 쓴다.
  const settleInFlight = useCallback(() => {
    const prize = inFlightRef.current;
    if (!prize) return null;
    inFlightRef.current = null;
    return usePachinkoStore.getState().award(prize, 'ladder');
  }, []);
  // 새로고침 / 탭 닫기에도 손에 든 보상을 정산한다.
  // 더블 오어 나씽이 생기면서 보상이 "받지 않은 채로" 화면에 오래 머무르게 됐다 —
  // 언마운트에만 걸어두면 그 사이 탭을 닫는 순간 티켓만 날린 셈이 된다.
  // (PlateDodge 와 같은 이유로 beforeunload 가 아니라 pagehide 를 쓴다)
  useEffect(() => {
    window.addEventListener('pagehide', settleInFlight);
    return () => {
      window.removeEventListener('pagehide', settleInFlight);
      clearTimers();
      settleInFlight();
    };
  }, [settleInFlight]);

  // 손에 든 보상이 있으면 먼저 처리해야 한다 (챙기거나 걸거나) — 새 판은 못 연다
  const canPlay = available >= LADDER.cost && !tracing && !stake;

  // 사다리 한 판을 화면에 태운다. 시작 · 배수판이 공유하는 연출 부분.
  const runTrace = (fresh, startCol, d, done) => {
    setRungs(fresh);
    setPicked(startCol);
    setPathD(d);
    setResult(null);
    setTracing(true);
    setPhase('armed');   // 트랜지션을 끈 채 선을 감춰두고

    // 다음 프레임에 트랜지션을 켜야 처음부터 그려진다.
    // (트랜지션을 켠 채로 되돌리면 이전 선이 거꾸로 지워지기 시작해
    //  두 번째 판부터 선이 즉시 완성돼 버린다)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setPhase('drawing'));
    });

    timersRef.current.push(setTimeout(done, LADDER.traceMs + 200));
  };

  // 경로를 SVG path 로
  const pathOf = (path, startCol, end) => {
    let d = `M ${colX(startCol)} ${PAD_Y - 8}`;
    for (let i = 1; i < path.length; i++) {
      const y = rowY(path[i].row);
      d += ` L ${colX(path[i - 1].col)} ${y}`;   // 세로 이동
      d += ` L ${colX(path[i].col)} ${y}`;       // 가로 이동
    }
    return d + ` L ${colX(end)} ${H - PAD_Y + 8}`;
  };

  const start = (startCol) => {
    if (!canPlay) return;

    clearTimers();
    settleInFlight();   // 앞 판이 남아 있으면 먼저 정산 (보통은 없다)

    // 출발하는 순간 티켓을 확정 차감한다.
    // 연출이 끝날 때 차감하면 3.6초 동안 보상 배치를 보고 꽝일 때만 새로고침해서
    // 무를 수 있다 (pachinkoStore 주석 참고).
    if (!beginPlay(LADDER.cost)) return;

    const fresh = buildRungs();
    const { path, end } = trace(fresh, startCol);
    const prize = drawLadderPrize();
    inFlightRef.current = prize;   // 도중에 이탈해도 이 보상은 지급된다

    // 도착 칸에 뽑힌 보상을 놓고, 나머지 칸은 다른 보상으로 섞어 채운다
    const rest = LADDER_PRIZES.filter(p => p.id !== prize.id)
      .sort(() => Math.random() - 0.5);
    const nextSlots = [];
    let ri = 0;
    for (let c = 0; c < LADDER.columns; c++) {
      nextSlots[c] = c === end ? prize : rest[ri++ % rest.length];
    }

    setSlots(nextSlots);
    setDoubles(0);
    setGambleMode(false);

    runTrace(fresh, startCol, pathOf(path, startCol, end), () => {
      setTracing(false);

      // 걸 수 있는 판이면 아직 주지 않는다. inFlightRef 에 그대로 둔 채 손에 들려주고
      // (stake) 챙길지 걸지 고르게 한다. 이탈해도 inFlightRef 가 정산되므로
      // 티켓만 날리는 일은 없다.
      if (canGamble(prize)) {
        setStake({ prize, mult: 1 });
        setResult({ ...prize, endCol: end, held: true });
        toast(`${prize.icon} ${prize.label[lang] || prize.label.ko} — ${t.heldToast}`);
        return;
      }

      // 티켓은 출발할 때 이미 나갔다. 여기서는 보상만 반영한다.
      // actualExp = 누적 상한에 잘린 뒤의 실제 증가분 — 획득 배너가 이전 레벨을
      // 역산하는 데 쓴다. prize.exp(자르기 전 원본)를 쓰면 만렙에서 어긋난다.
      const actualExp = settleInFlight();
      setResult({ ...prize, endCol: end, actualExp });
      if (prize.exp > 0) toast(`${prize.icon} ${prize.label[lang] || prize.label.ko} +${compactExp(prize.exp)} EXP`);
      else toast(prize.msg[lang] || prize.msg.ko, 'error');
    });
  };

  // 손에 든 보상을 그대로 받는다
  const takeStake = () => {
    if (!stake || tracing) return;
    const gainedExp = stake.prize.exp * stake.mult;
    const actualExp = settleInFlight();
    setResult(r => (r ? { ...r, held: false, actualExp } : r));
    setStake(null);
    setDoubles(0);
    setGambleMode(false);
    toast(`${stake.prize.icon} +${compactExp(gainedExp)} EXP`);
  };

  // 배수판을 깐다. 아직 아무것도 안 건 상태 — 시작점을 고르면 그때 출발한다.
  const enterGamble = () => {
    if (!stake || tracing) return;
    boardBeforeGambleRef.current = slots;   // 그만두면 되돌린다
    const heldExp = stake.prize.exp * stake.mult;
    setSlots(shuffle(GAMBLE_MULTS).map(m => gambleSlot(m, heldExp)));
    setRungs([]);      // 가로줄은 출발할 때 만든다 — 미리 보이면 눈으로 따라가 이길 수 있다
    setPathD('');
    setPhase('idle');
    setResult(null);
    setGambleMode(true);
  };

  // 배수판에서 물러난다. 아직 아무것도 굴리지 않았으므로 그냥 되돌리면 된다.
  const cancelGamble = () => {
    if (tracing) return;
    if (boardBeforeGambleRef.current) setSlots(boardBeforeGambleRef.current);
    setGambleMode(false);
  };

  // 배수판 사다리를 탄다.
  const gamble = (startCol) => {
    if (!stake || tracing || !gambleMode) return;
    clearTimers();

    // 시작점을 누르는 순간 결과가 확정된다. 가로줄을 여기서 처음 만들기 때문에
    // 화면으로 미리 따라갈 수 없다 — 배수 칸만 보이고 연결은 출발해야 드러난다.
    // 확정된 결과를 곧바로 inFlightRef 에 넣어, 연출 3.6초 동안 새로고침해서
    // 실패를 무르는 것을 막는다 (출발 때 티켓을 선차감하는 것과 같은 이유다).
    const fresh = buildRungs();
    const { path, end } = trace(fresh, startCol);
    const landed = slots[end];
    inFlightRef.current = { ...stake.prize, exp: landed.exp };

    runTrace(fresh, startCol, pathOf(path, startCol, end), () => {
      setTracing(false);
      setGambleMode(false);

      if (landed.mult === 0) {
        settleInFlight();     // 0 EXP 로 확정한다 (판 기록에는 남는다)
        setResult({ ...landed, endCol: end, actualExp: 0 });
        setStake(null);
        setDoubles(0);
        toast(t.busted, 'error');
        return;
      }

      const nextMult = stake.mult * landed.mult;
      const nextDoubles = doubles + 1;
      setDoubles(nextDoubles);

      // 아직 더 걸 수 있으면 계속 손에 들고 있는다 (inFlightRef 에는 이미 새 값이 들어 있다)
      if (nextDoubles < MAX_DOUBLE) {
        setStake({ prize: stake.prize, mult: nextMult });
        setResult({ ...landed, endCol: end, held: true, mult: nextMult });
        toast(`${landed.icon} ${landed.msg[lang] || landed.msg.ko} — ${compactExp(landed.exp)} EXP`);
        return;
      }

      // 상한까지 갔으면 자동으로 챙긴다
      const actualExp = settleInFlight();
      setResult({ ...landed, endCol: end, actualExp, mult: nextMult });
      setStake(null);
      setDoubles(0);
      toast(`${landed.icon} ${t.maxed} +${compactExp(landed.exp)} EXP`);
    });
  };

  const totalWeight = LADDER_PRIZES.reduce((s, p) => s + p.weight, 0);
  const big = result && result.exp >= 10000000;

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 'var(--radius)',
            background: 'var(--danger-dim)', border: '1px solid var(--danger)',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 11,
            letterSpacing: 1.5, color: 'var(--danger)',
          }}>
            🪜 {t.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.sub}</div>
        </div>

        {/* 파칭코와 같은 지갑이라 여기서도 보유 티켓을 띄운다.
            한 판에 LADDER.cost 장이 나가므로 그만큼 없으면 흐리게 — 못 도는 게 바로 보이도록. */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>{t.tickets}</div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, lineHeight: 1,
            color: available >= LADDER.cost ? 'var(--accent)' : 'var(--text-muted)',
          }}>
            🎫 {available.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 사다리 */}
      <div style={{
        position: 'relative',
        borderRadius: 'var(--radius)',
        background: 'linear-gradient(180deg, #0f0a0a 0%, #0c0c12 60%, #0a0a0a 100%)',
        border: `1px solid ${result ? `${result.color}66` : 'var(--border)'}`,
        boxShadow: big ? `0 0 40px ${result.color}44, inset 0 0 30px ${result.color}22` : 'none',
        transition: 'box-shadow 300ms ease, border-color 300ms ease',
        padding: '8px 6px 0',
        marginBottom: 10,
      }}>
        {/* 시작점 버튼 */}
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${LADDER.columns}, 1fr)`, gap: 4,
          marginBottom: 4,
          // PC에서 폭이 넓어져도 사다리가 과하게 커지지 않도록 제한
          maxWidth: LADDER_MAX_W, margin: '0 auto 4px',
        }}>
          {Array.from({ length: LADDER.columns }).map((_, c) => (
            <button
              key={c}
              onClick={() => setSelected(c)}
              disabled={tracing}
              style={{
                padding: '5px 0',
                borderRadius: 'var(--radius)',
                border: `1px solid ${selected === c ? 'var(--accent)' : 'var(--border-hover)'}`,
                background: selected === c ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                color: selected === c ? 'var(--accent)' : 'var(--text-secondary)',
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 14,
                cursor: tracing ? 'not-allowed' : 'pointer',
                transition: 'all 150ms',
                boxShadow: selected === c ? '0 0 10px var(--accent)44' : 'none',
              }}
            >
              {c + 1}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: 'block', maxWidth: LADDER_MAX_W, margin: '0 auto' }}
        >
          {/* 세로줄 */}
          {Array.from({ length: LADDER.columns }).map((_, c) => (
            <line
              key={c}
              x1={colX(c)} y1={PAD_Y - 8} x2={colX(c)} y2={H - PAD_Y + 8}
              stroke="var(--border-hover)" strokeWidth="2"
            />
          ))}
          {/* 가로줄 */}
          {rungs.map((r, i) => (
            <line
              key={i}
              x1={colX(r.col)} y1={rowY(r.row)} x2={colX(r.col + 1)} y2={rowY(r.row)}
              stroke="var(--border-hover)" strokeWidth="2"
            />
          ))}
          {/* 지나온 경로 */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={result ? result.color : 'var(--accent)'}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
              style={{
                strokeDasharray: 1,
                strokeDashoffset: phase === 'drawing' ? 0 : 1,
                // armed 단계에서만 트랜지션을 끈다 (선을 되감지 않고 즉시 숨기려고)
                transition: phase === 'armed'
                  ? 'none'
                  : `stroke-dashoffset ${LADDER.traceMs}ms linear, stroke 300ms ease`,
                filter: `drop-shadow(0 0 5px ${result ? result.color : 'var(--accent)'})`,
              }}
            />
          )}
        </svg>

        {/* 도착 칸 */}
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${LADDER.columns}, 1fr)`, gap: 4,
          padding: '4px 0 8px',
          maxWidth: LADDER_MAX_W, margin: '0 auto',
        }}>
          {slots.map((p, c) => {
            const hit = result?.endCol === c;
            // 배수판은 출발 전부터 다 보여준다 — 뭐가 걸려 있는지 알고 골라야 의미가 있다.
            // 감추는 건 보상 사다리(첫 판)뿐이다.
            const hidden = tracing && !gambleMode;
            return (
              <div
                key={c}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                  padding: '5px 0',
                  borderRadius: 'var(--radius)',
                  background: hit ? `${p.color}33` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${hit ? p.color : 'var(--border)'}`,
                  boxShadow: hit ? `0 0 16px ${p.color}66` : 'none',
                  transition: 'all 200ms',
                  // 결과가 나오기 전에는 어떤 칸이 무엇인지 감춘다
                  opacity: hidden ? 0.35 : 1,
                }}
              >
                <span style={{ fontSize: 13 }}>{hidden ? '❓' : p.icon}</span>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 9,
                  color: hit ? p.color : 'var(--text-muted)',
                }}>
                  {hidden ? '???' : (p.label[lang] || p.label.ko)}
                </span>
                {/* 각 칸이 얼마짜리인지 */}
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 9,
                  color: hit ? p.color : 'var(--text-muted)',
                  opacity: hit ? 1 : 0.6,
                }}>
                  {hidden ? '' : `+${compactExp(p.exp)}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 상태 문구 */}
      <div style={{
        minHeight: 20, textAlign: 'center', marginBottom: 10,
        fontSize: 12, fontWeight: 600,
        color: result ? result.color : 'var(--text-muted)',
      }}>
        {tracing
          ? t.tracing
          : gambleMode
            ? t.gamblePick
            : result
              ? `${result.icon} ${result.label[lang] || result.label.ko} — ${result.msg[lang] || result.msg.ko}`
              : available >= LADDER.cost ? t.pick : t.noTicket}
      </div>

      {/* 획득 EXP + 레벨 변화 — 손에 든 채(held)면 아직 받은 게 아니라 띄우지 않는다 */}
      {result && !tracing && !result.held && (
        <ExpGainBanner
          baseExp={baseExp + gained}
          gainedExp={result.actualExp ?? result.exp}
          ulExp={ulExp}
          ulGain={lastUlGain}
          color={result.color}
        />
      )}

      {/* 손에 든 보상 — 챙기거나 한 번 더 걸거나 */}
      {stake && !gambleMode && !tracing && (
        <>
          <div style={{
            textAlign: 'center', marginBottom: 8,
            fontSize: 11, color: 'var(--danger)', fontWeight: 600,
          }}>
            {t.gambleLeft(MAX_DOUBLE - doubles)}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button className="btn-primary" onClick={takeStake} style={{ flex: 1 }}>
              💰 {t.take} +{compactExp(stake.prize.exp * stake.mult)}
            </button>
            <button
              onClick={enterGamble}
              style={{
                flex: 1,
                background: 'var(--danger-dim)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius)',
                color: 'var(--danger)',
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.2,
                padding: '9px 0', cursor: 'pointer',
              }}
            >
              🎲 {t.gamble}
            </button>
          </div>
        </>
      )}

      {/* 출발 버튼 — 배수판에서는 그대로 "건다" 가 된다 */}
      {(!stake || gambleMode) && (
        <button
          className="btn-primary"
          onClick={() => (gambleMode ? gamble(selected) : start(selected))}
          disabled={gambleMode ? tracing : !canPlay}
          style={{ width: '100%', marginBottom: 10 }}
        >
          {tracing
            ? t.tracing
            : gambleMode
              ? `🎲 ${t.gambleGo(selected + 1)}`
              : available >= LADDER.cost
                ? `${t.go} ${selected + 1}${t.fromCol} (🎫 ${LADDER.cost})`
                : t.noTicket}
        </button>
      )}

      {/* 배수판에서 물러나기 */}
      {gambleMode && !tracing && (
        <button
          onClick={cancelGamble}
          style={{
            width: '100%', background: 'transparent', border: 'none',
            color: 'var(--text-muted)', fontSize: 11,
            padding: '2px 0 10px', cursor: 'pointer',
          }}
        >
          {t.cancel}
        </button>
      )}

      {/* 확률표 버튼 */}
      <button
        onClick={() => setShowRates(true)}
        style={{
          width: '100%', background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-hover)', borderRadius: 'var(--radius)',
          color: 'var(--text-secondary)',
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1.5,
          padding: '9px 0', cursor: 'pointer',
        }}
      >
        📊 {t.rates}
      </button>

      {showRates && (
        <div
          onClick={() => setShowRates(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99998, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true"
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: 20,
              maxWidth: 360, width: '100%', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            }}
          >
            <h3 style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2,
              color: 'var(--text-primary)', marginBottom: 4,
            }}>
              🪜 {t.ratesTitle}
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
              {t.ratesDesc}
            </p>

            {LADDER_PRIZES.map(p => {
              const pct = (p.weight / totalWeight) * 100;
              return (
                <div key={p.id} style={{ marginBottom: 10 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 12, marginBottom: 4,
                  }}>
                    <span style={{ color: p.color, fontWeight: 600 }}>
                      {p.icon} {p.label[lang] || p.label.ko}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {pct}% · <span style={{ color: p.color }}>+{p.exp.toLocaleString()}</span>
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.max(pct, 1.5)}%`, height: '100%',
                      background: p.color, borderRadius: 3,
                      boxShadow: `0 0 8px ${p.color}88`,
                    }} />
                  </div>
                </div>
              );
            })}

            <div style={{
              marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)',
              fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t.cost}</span>
                <span style={{ color: 'var(--danger)' }}>🎫 {LADDER.cost}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t.avg}</span>
                <span style={{ color: 'var(--success)' }}>
                  ~{compactExp(Math.round(LADDER_EXPECTED_EXP))} {t.expUnit}
                </span>
              </div>
            </div>

            <div style={{
              marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)',
              fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7,
            }}>
              🎲 {t.gambleNote}
            </div>

            <button
              className="btn-primary"
              onClick={() => setShowRates(false)}
              style={{ width: '100%', marginTop: 16 }}
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
