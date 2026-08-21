import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from './Toast';
import CasinoChip from './CasinoChip';
import ExpGainBanner from './ExpGainBanner';
import { useLangStore } from '../store/langStore';
import { usePachinkoStore } from '../store/pachinkoStore';
import { usePlateStore } from '../store/plateStore';
import {
  TICKET_RULE, PRIZES, REEL, REEL_TOTAL_MS, LS, MAX_BATCH,
  drawPrize, drawPrizeCounts, readInt, EXPECTED_EXP, MEGA_ID, SUPERNOVA_ID, BIG_HIT_EXP, LADDER_PRIZES,
  prizeWeight, PRIZE_WEIGHT_TOTAL_PROD, PRIZE_WEIGHT_TOTAL_DEV, PRIZE_HAS_DEV_WEIGHTS,
  compactExp, ticketsAvailable, ticketText, earnedTickets,
} from '../data/pachinkoData';

const T = {
  ko: {
    title: '파칭코',
    tickets: '보유 티켓',
    totalExp: '누적 획득',
    spin1: '1회 뽑기',
    spin10: '10회 뽑기',
    spin100: '100회 뽑기',
    spinAll: '모두 쓰기',
    timesUnit: '회',
    resultLabel: '결과',
    // 다회 뽑기에서 릴은 최고 등급 하나만 보여준다 — 합계와 헷갈리지 않게 붙이는 말
    best: '최고',
    bestOf: (n) => `${n}회 중 최고`,
    spinning: '돌리는 중…',
    noTicket: '티켓이 없어요',
    howTo: `운동 ${TICKET_RULE.perWorkouts}회당 티켓 1개, 인바디 ${TICKET_RULE.perInbody}회당 티켓 1개`,
    rates: '확률표',
    ratesTitle: '확률표',
    ratesDesc: '한 판을 돌렸을 때 각 등급이 나올 확률입니다.',
    devWarn: '개발 빌드입니다 — 실제로 뽑히는 확률은 아래와 다릅니다 (표는 운영 확률)',
    recent: '최근 결과',
    avg: '판당 평균',
    expUnit: '경험치',
    ticketRule: '티켓 획득',
    stackLabel: '최대 보유',
    close: '닫기',
    digitBanner: '자리 달성',
    novaBanner: '15자리 전부 9 달성',
    capped: '상한 도달',
    atCap: '상한 · 더 안 쌓여요',
  },
  en: {
    title: 'Pachinko',
    tickets: 'Tickets',
    totalExp: 'Total earned',
    spin1: 'SPIN x1',
    spin10: 'SPIN x10',
    spin100: 'SPIN x100',
    spinAll: 'SPIN ALL',
    timesUnit: 'x',
    resultLabel: 'RESULT',
    best: 'BEST',
    bestOf: (n) => `best of ${n}`,
    spinning: 'Spinning…',
    noTicket: 'No tickets',
    howTo: `1 ticket per ${TICKET_RULE.perWorkouts} workouts, 1 per ${TICKET_RULE.perInbody} inbody`,
    rates: 'Odds',
    ratesTitle: 'Odds Table',
    ratesDesc: 'Chance of each tier per single spin.',
    devWarn: 'Dev build — actual draw odds differ from this table (table shows production odds)',
    recent: 'Recent',
    avg: 'Avg / spin',
    expUnit: 'EXP',
    ticketRule: 'Tickets',
    stackLabel: 'Max stack',
    close: 'Close',
    digitBanner: ' DIGITS',
    novaBanner: 'ALL FIFTEEN NINES',
    capped: 'MAXED',
    atCap: 'MAX · stops stacking',
  },
};

// 기록 수 → 발급된 총 티켓.
// 티켓 발급량 계산은 data/pachinkoData.js 로 옮겼다.
// 제보함이 기기 정보에 티켓 수를 담으려고 이 함수 하나 때문에 파칭코 화면을
// 통째로 끌어오게 둘 수는 없어서다. 부르던 곳들을 위해 이름은 여기서도 내보낸다.
export { earnedTickets };

// 파칭코로 획득한 누적 EXP (레벨 계산에 합산됨)
export function getPachinkoExp() {
  return readInt(LS.exp, 0);
}

const STRIP = Array.from({ length: REEL.cycles * 10 }, (_, i) => i % 10);
// 숫자 띠를 칸마다 <div> 로 쪼개면 릴 하나에 70개, 15칸이면 1,050개다.
// 칸마다 스타일이 같으므로 줄바꿈으로 이어 붙인 텍스트 한 덩어리로 그린다 —
// white-space: pre 와 고정 line-height 면 각 줄이 정확히 itemHeight 라 보이는 건 같다.
const STRIP_TEXT = STRIP.join('\n');

// 정적 테이블이라 렌더마다 다시 더하지 않는다
// 확률표는 언제나 운영 가중치로 낸다 — 개발값을 띄우면 진짜 확률로 오해한다

export default function PachinkoSystem({ totalWorkouts = 0, totalInbody = 0, baseExp = 0 }) {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;

  // 티켓/누적 EXP/기록은 사다리 모드와 공유한다
  const { used, gained, log, beginPlay, ulExp, lastUlGain } = usePachinkoStore();
  const purchased = usePlateStore(s => s.purchased);   // 원판 피하기로 산 티켓
  const unlimited = usePlateStore(s => s.unlimited);   // 울트라 무한(∞) 획득 여부
  const [multi, setMulti] = useState(null);   // 다회 뽑기 결과 요약

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [showRates, setShowRates] = useState(false);

  // 릴 상태: pos = 스트립 인덱스, moving = 트랜지션 on/off, stopped = 착지 완료
  const [reels, setReels] = useState(
    () => Array.from({ length: REEL.digits }, () => ({ pos: 0, moving: false, stopped: true }))
  );

  const timersRef = useRef([]);
  const rafRef = useRef(0);
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    cancelAnimationFrame(rafRef.current);
  };

  // 연출 중이라 아직 화면에 안 나온 판. 티켓은 돌리는 순간 이미 나갔으므로
  // 도중에 이탈하면 여기 든 보상을 정산해 준다 (안 하면 티켓만 날린 셈이 된다).
  const inFlightRef = useRef(null);
  // 언마운트 cleanup 이 한 번만 걸리도록 참조를 고정한다. 스토어 함수는 zustand 가
  // 만들 때 한 번 만들어져 계속 같은 참조이므로 getState() 로 꺼내 쓴다.
  const settleInFlight = useCallback(() => {
    const f = inFlightRef.current;
    if (!f) return null;
    inFlightRef.current = null;
    const s = usePachinkoStore.getState();
    if (f.n === 1) return { actualExp: s.award(f.prize, 'reel'), exact: true };
    const { totalExp, exact } = s.awardMany(f.rows, 'reel');
    return { actualExp: totalExp, exact };
  }, []);
  useEffect(() => () => {
    clearTimers();
    settleInFlight();
  }, [settleInFlight]);

  const earned = earnedTickets(totalWorkouts, totalInbody, purchased);
  // 미사용 티켓은 maxStack까지만 (오래 안 돌려도 무한 적립되지 않음).
  // 티켓은 돌리는 즉시 used 로 확정되므로 사다리와 이중 사용될 여지가 없다.
  const available = ticketsAvailable({ earned, used, unlimited });
  // 상한에 닿았으면 지금부터 버는 티켓은 쌓이지 않고 사라진다.
  // 무한 티켓이면 상한 자체가 없으므로 경고할 것도 없다.
  const atCap = !unlimited && available >= TICKET_RULE.maxStack;

  // count 판을 한 번에 돌린다. 릴은 그중 최고 등급을 보여주고,
  // 2판 이상이면 전체 내역을 요약 패널로 따로 표시한다.
  const spin = (count = 1) => {
    if (spinning || available <= 0) return;
    clearTimers();      // 앞선 판의 타이머 id 가 계속 쌓이지 않도록 비운다
    settleInFlight();   // 앞 판이 남아 있으면 먼저 정산 (보통은 없다)

    const n = Math.min(count, available);
    // 돌리는 순간 티켓을 확정 차감한다.
    // 연출이 끝날 때 차감하면 결과를 보고 새로고침해 무를 수 있다
    // (pachinkoStore 주석 참고 — 파칭코는 창이 190ms라 좁지만 원인은 사다리와 같다).
    if (!beginPlay(n)) return;

    // 판수가 적으면 판마다 뽑고, 많으면 등급별 횟수만 표본추출한다.
    // 수백만 장을 한 번에 쓸 때 그만큼 배열을 만들면 브라우저가 멈추기 때문이다.
    // 어느 쪽이든 결과는 PRIZES 순서의 [{ prize, count }] 로 모인다.
    let rows;
    if (n <= MAX_BATCH) {
      const counts = new Map();
      for (let i = 0; i < n; i++) {
        const p = drawPrize();
        counts.set(p, (counts.get(p) || 0) + 1);
      }
      rows = PRIZES.filter(p => counts.has(p)).map(p => ({ prize: p, count: counts.get(p) }));
    } else {
      const counts = drawPrizeCounts(n);
      rows = PRIZES.map((p, i) => ({ prize: p, count: counts[i] })).filter(r => r.count > 0);
    }

    // 릴에 띄울 판 — 여러 판이면 그중 가장 높은 등급 (PRIZES 는 오름차순)
    const prize = rows[rows.length - 1].prize;
    inFlightRef.current = { n, rows, prize };   // 도중에 이탈해도 이 보상은 지급된다
    const digits = String(prize.exp).padStart(REEL.digits, '0').split('').map(Number);

    setSpinning(true);
    setResult(null);
    setMulti(null);

    // 1) 트랜지션 없이 각 릴을 시작 위치(0~9)로 되돌린다
    setReels(digits.map(() => ({ pos: 0, moving: false, stopped: false })));

    // 2) 다음 프레임에 트랜지션을 켜고 목표 위치로 굴린다
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setReels(digits.map((d, i) => ({
          pos: (REEL.baseSpins + i * REEL.spinStep) * 10 + d,
          moving: true,
          stopped: false,
        })));
      });
    });

    // 3) 릴이 하나씩 멈출 때마다 착지 표시 (왼쪽부터 순서대로)
    digits.forEach((_, i) => {
      const id = setTimeout(() => {
        setReels(prev => prev.map((r, j) => (j === i ? { ...r, stopped: true } : r)));
        // 트랜지션은 rAF 2프레임 뒤에 시작하므로 그만큼 늦춰야 착지와 맞는다
      }, REEL.baseMs + REEL.staggerMs * i + 48);
      timersRef.current.push(id);
    });

    // 4) 결과 확정 + 저장 (티켓 n장 소모)
    const doneId = setTimeout(() => {
      // 티켓은 돌릴 때 이미 나갔다. 여기서는 보상만 반영한다.
      // actualExp = 누적 상한에 잘린 뒤의 실제 증가분 — 획득 배너가 이전 레벨을
      // 역산하는 데 쓴다. prize.exp(자르기 전 원본)를 쓰면 만렙에서 어긋난다.
      const { actualExp, exact } = settleInFlight();

      if (n === 1) {
        if (prize.exp > 0) toast(`${prize.icon} ${prize.label[lang] || prize.label.ko} +${compactExp(prize.exp)} EXP`);
        else toast(prize.msg[lang] || prize.msg.ko, 'error');
      } else {
        setMulti({
          n,
          totalExp: actualExp,
          exact,
          best: prize,
          rows: [...rows].reverse(),   // 높은 등급부터 보여준다
        });
        toast(exact
          ? `${n}${t.timesUnit} — +${compactExp(actualExp)} EXP`
          : `${n}${t.timesUnit} — ${t.capped}`);
      }

      setResult({ ...prize, actualExp });
      setSpinning(false);
    }, REEL_TOTAL_MS + REEL.revealMs);
    timersRef.current.push(doneId);
  };

  const glow = result ? result.color : 'var(--accent)';
  const bigHit = result && result.exp >= BIG_HIT_EXP;
  const isNova = result?.id === SUPERNOVA_ID;
  // 5자리 이상이면 왼쪽 칸들이 켜지므로 특별 연출 (메가/우주/신/초신성)
  const isMega = result && (result.id === MEGA_ID || String(result.exp).length >= 5);

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      {/* 헤더: 티켓 / 누적 EXP */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 'var(--radius)',
          background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 11,
          letterSpacing: 1.5, color: 'var(--accent)',
        }}>
          <CasinoChip size={14} spinning={spinning} />
          {t.title}
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>{t.tickets}</div>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, lineHeight: 1,
              color: available > 0 ? 'var(--accent)' : 'var(--text-muted)',
            }}>
              🎫 {ticketText(available, unlimited)}
            </div>
            {/* 상한에 닿으면 그 뒤로 버는 티켓은 소멸한다.
                잘린 다음에 알리는 것(PachinkoPage 토스트)만으로는 늦으므로 미리 띄운다 */}
            {atCap && (
              <div style={{ fontSize: 9, color: 'var(--warning)', letterSpacing: 0.5, marginTop: 2 }}>
                {t.atCap}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>{t.totalExp}</div>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, lineHeight: 1,
              color: 'var(--success)',
            }}>
              +{compactExp(gained)}
            </div>
          </div>
        </div>
      </div>

      {/* ── 슬롯 릴 ── */}
      <div style={{
        position: 'relative',
        padding: '18px 12px',
        borderRadius: 'var(--radius)',
        background: 'linear-gradient(180deg, #14080c 0%, #0c0c12 50%, #090909 100%)',
        border: `1px solid ${result ? `${result.color}${isMega ? 'cc' : '55'}` : 'var(--border)'}`,
        boxShadow: isNova
          ? `0 0 90px ${glow}88, 0 0 180px ${glow}55, inset 0 0 60px ${glow}44`
          : isMega
            ? `0 0 60px ${glow}66, 0 0 120px ${glow}33, inset 0 0 40px ${glow}33`
            : bigHit ? `0 0 34px ${glow}44, inset 0 0 26px ${glow}22` : 'none',
        transition: 'box-shadow 300ms ease, border-color 300ms ease',
        marginBottom: 12,
      }}>
        {/* 자릿수 달성 배너 */}
        {(isMega || isNova) && (
          <div style={{
            position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 11, letterSpacing: 3,
            color: result.color,
            textShadow: `0 0 12px ${result.color}`,
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>
            {isNova ? `💥 ${t.novaBanner} 💥` : `👑 ${String(result.exp).length}${t.digitBanner} 👑`}
          </div>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: REEL.gap, width: '100%',
        }}>
          {reels.map((reel, i) => (
            <div
              key={i}
              style={{
                position: 'relative',
                // 15칸이라 고정 px로는 폰에서 넘침 — 균등 분할
                flex: '1 1 0', minWidth: 0, maxWidth: 44,
                height: REEL.itemHeight,
                overflow: 'hidden',
                borderRadius: 6,
                background: '#000',
                border: `1px solid ${reel.stopped && result ? `${result.color}88` : 'var(--border-hover)'}`,
                boxShadow: reel.stopped && result
                  ? `0 0 14px ${result.color}55, inset 0 0 10px ${result.color}22`
                  : 'inset 0 6px 10px -6px #000, inset 0 -6px 10px -6px #000',
                transition: 'border-color 180ms ease, box-shadow 180ms ease',
              }}
            >
              <div style={{
                transform: `translateY(${-reel.pos * REEL.itemHeight}px)`,
                transition: reel.moving
                  ? `transform ${REEL.baseMs + REEL.staggerMs * i}ms cubic-bezier(.12,.72,.16,1), color 180ms ease, text-shadow 180ms ease`
                  : 'color 180ms ease, text-shadow 180ms ease',
                // will-change 는 도는 동안만. 켜둔 채로 두면 릴 31개가 영구히
                // 레이어로 승격돼 모바일에서 GPU 메모리만 잡아먹는다.
                willChange: reel.moving ? 'transform' : 'auto',
                whiteSpace: 'pre',
                lineHeight: `${REEL.itemHeight}px`,
                textAlign: 'center',
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: REEL.fontSize,
                color: reel.stopped && result ? result.color : 'var(--text-primary)',
                textShadow: reel.stopped && result ? `0 0 16px ${result.color}88` : 'none',
              }}>
                {STRIP_TEXT}
              </div>
            </div>
          ))}

        </div>

        {/* 15칸은 눈으로 읽기 어려우니 아래에 콤마 찍은 값을 같이 표시 */}
        <div style={{
          marginTop: 8, textAlign: 'center',
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 16, letterSpacing: 1,
          color: result ? result.color : 'var(--text-muted)',
          transition: 'color 200ms ease',
        }}>
          {/* 다회 뽑기면 이 값은 합계가 아니라 그중 최고 등급이다.
              바로 아래 배너가 합계를 보여주므로 라벨이 없으면 두 숫자가 서로 어긋나 보인다. */}
          {result
            ? `${multi ? `${t.best} ` : ''}${result.exp.toLocaleString()} EXP`
            : 'EXP'}
        </div>

        {/* 가운데 라인 (릴 기준선) */}
        <div style={{
          position: 'absolute', left: 12, right: 12, top: '50%',
          height: 1, background: `linear-gradient(90deg, transparent, ${glow}33, transparent)`,
          pointerEvents: 'none',
        }} />
      </div>

      {/* 결과 문구 */}
      <div style={{
        minHeight: 22, textAlign: 'center', marginBottom: 10,
        fontSize: 13, fontWeight: 600,
        color: result ? result.color : 'var(--text-muted)',
      }}>
        {spinning
          ? t.spinning
          : result
            ? `${result.icon} ${result.label[lang] || result.label.ko} — ${
                multi ? t.bestOf(multi.n.toLocaleString()) : (result.msg[lang] || result.msg.ko)
              }`
            : available > 0 ? t.howTo : t.noTicket}
      </div>

      {/* 획득 EXP + 레벨 변화 */}
      {result && !spinning && (
        <ExpGainBanner
          baseExp={baseExp + gained}
          gainedExp={result.actualExp ?? result.exp}
          ulExp={ulExp}
          ulGain={lastUlGain}
          color={result.color}
        />
      )}

      {/* 뽑기 버튼 3종 */}
      <button
        className="btn-primary"
        onClick={() => spin(1)}
        disabled={spinning || available <= 0}
        style={{ width: '100%' }}
      >
        {spinning ? t.spinning : available > 0 ? `${t.spin1} (🎫 1)` : t.noTicket}
      </button>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          onClick={() => spin(10)}
          disabled={spinning || available < 10}
          style={{
            flex: 1, padding: '10px 0',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-accent)',
            background: available >= 10 && !spinning ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
            color: available >= 10 && !spinning ? 'var(--accent)' : 'var(--text-muted)',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1,
            cursor: available >= 10 && !spinning ? 'pointer' : 'not-allowed',
          }}
        >
          {t.spin10} (🎫 10)
        </button>
        <button
          onClick={() => spin(100)}
          disabled={spinning || available < 100}
          style={{
            flex: 1, padding: '10px 0',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-accent)',
            background: available >= 100 && !spinning ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
            color: available >= 100 && !spinning ? 'var(--accent)' : 'var(--text-muted)',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1,
            cursor: available >= 100 && !spinning ? 'pointer' : 'not-allowed',
          }}
        >
          {t.spin100} (🎫 100)
        </button>
        <button
          onClick={() => spin(available)}
          disabled={spinning || available <= 0}
          style={{
            flex: 1, padding: '10px 0',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--danger)',
            background: available > 0 && !spinning ? 'var(--danger-dim)' : 'var(--bg-tertiary)',
            color: available > 0 && !spinning ? 'var(--danger)' : 'var(--text-muted)',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1,
            cursor: available > 0 && !spinning ? 'pointer' : 'not-allowed',
          }}
        >
          {t.spinAll} (🎫 {ticketText(available, unlimited)})
        </button>
      </div>

      {/* 다회 뽑기 요약 */}
      {multi && !spinning && (
        <div style={{
          marginTop: 12, padding: 12,
          borderRadius: 'var(--radius)',
          background: 'var(--bg-tertiary)',
          border: `1px solid ${multi.best.color}55`,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)',
          }}>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1,
              color: 'var(--text-primary)',
            }}>
              {multi.n.toLocaleString()}{t.timesUnit} {t.resultLabel}
            </span>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 18,
              color: 'var(--success)',
            }}>
              {multi.exact ? `+${compactExp(multi.totalExp)} EXP` : t.capped}
            </span>
          </div>

          {multi.rows.map(({ prize: p, count }) => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 11, padding: '3px 0',
            }}>
              <span style={{ color: p.color }}>
                {p.icon} {p.label[lang] || p.label.ko}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {count.toLocaleString()}{t.timesUnit}
                {/* exp * count 가 2^53을 넘으면 끝자리부터 뭉개진다.
                    틀린 수를 보여주느니 횟수만 남긴다 (multi.exact=false) */}
                {multi.exact && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                    +{compactExp(p.exp * count)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 최근 결과 */}
      {log.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 5 }}>
            {t.recent}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {log.map((entry, i) => {
              // 사다리 기록도 같은 목록에 섞여 들어온다
              const p = [...PRIZES, ...LADDER_PRIZES].find(x => x.id === entry.id) || PRIZES[0];
              return (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 7px', borderRadius: 'var(--radius)',
                  background: `${p.color}18`, border: `1px solid ${p.color}44`,
                  fontSize: 10, color: p.color,
                }}>
                  {entry.mode === 'ladder' ? '🪜' : p.icon} +{compactExp(entry.exp)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 확률표 버튼 */}
      <button
        onClick={() => setShowRates(true)}
        style={{
          marginTop: 10, width: '100%',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-hover)',
          borderRadius: 'var(--radius)',
          color: 'var(--text-secondary)',
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 13, letterSpacing: 1.5,
          padding: '9px 0', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        📊 {t.rates}
      </button>

      {/* 확률표 모달 */}
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
            role="dialog"
            aria-modal="true"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              maxWidth: 360, width: '100%',
              maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            }}
          >
            <h3 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 20, letterSpacing: 2,
              color: 'var(--text-primary)', marginBottom: 4,
            }}>
              📊 {t.ratesTitle}
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
              {t.ratesDesc}
            </p>

            {PRIZE_HAS_DEV_WEIGHTS && (
              <div style={{
                marginBottom: 12, padding: '7px 9px',
                borderRadius: 'var(--radius)',
                background: 'var(--danger-dim)', border: '1px solid var(--danger)',
                fontSize: 10, color: 'var(--danger)', lineHeight: 1.6,
              }}>
                ⚠️ {t.devWarn}
                {' '}({PRIZES.filter(p => p.devWeight != null).map(p => `${p.label[lang]} ${Number(((prizeWeight(p) / PRIZE_WEIGHT_TOTAL_DEV) * 100).toFixed(1))}%`).join(', ')})
              </div>
            )}

            {PRIZES.map(p => {
              const pct = (p.weight / PRIZE_WEIGHT_TOTAL_PROD) * 100;
              return (
                <div key={p.id} style={{ marginBottom: 10 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 12, marginBottom: 4,
                  }}>
                    <span style={{ color: p.color, fontWeight: 600 }}>
                      {p.icon} {p.label[lang]}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {pct >= 1 ? (pct % 1 === 0 ? pct : pct.toFixed(1)) : pct.toFixed(4)}% · <span style={{ color: p.color }}>+{compactExp(p.exp)}</span>
                    </span>
                  </div>
                  {/* 확률 막대 — 낮은 확률도 보이도록 최소 너비 보장 */}
                  <div style={{
                    height: 6, borderRadius: 3,
                    background: 'var(--bg-tertiary)', overflow: 'hidden',
                  }}>
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
                <span>{t.avg}</span>
                <span style={{ color: 'var(--success)' }}>~{compactExp(Math.round(EXPECTED_EXP))} {t.expUnit}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t.ticketRule}</span>
                <span>{t.howTo}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t.stackLabel}</span>
                <span>{TICKET_RULE.maxStack}</span>
              </div>
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
