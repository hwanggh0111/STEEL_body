import { useState, useEffect, useRef, useCallback } from 'react';
import { useLangStore } from '../store/langStore';
import { toast } from './Toast';
import CasinoChip from './CasinoChip';
import { MAX_EXP } from './LevelSystem';
import {
  TICKET_RULE, PRIZES, REEL, REEL_TOTAL_MS, LS, LOG_MAX,
  drawPrize, readInt, EXPECTED_EXP, MEGA_ID, SUPERNOVA_ID, BIG_HIT_EXP,
} from '../data/pachinkoData';

const T = {
  ko: {
    title: '파칭코',
    tickets: '보유 티켓',
    totalExp: '누적 획득',
    spin: '돌리기',
    spinning: '돌리는 중…',
    noTicket: '티켓이 없어요',
    howTo: `운동 ${TICKET_RULE.perWorkouts}회당 티켓 1개, 인바디 ${TICKET_RULE.perInbody}회당 티켓 1개`,
    rates: '확률표',
    ratesTitle: '확률표',
    ratesDesc: '한 판을 돌렸을 때 각 등급이 나올 확률입니다.',
    recent: '최근 결과',
    avg: '판당 평균',
    ticketRule: '티켓 획득',
    stackLabel: '최대 보유',
    close: '닫기',
    digitBanner: '자리 달성',
    novaBanner: '15자리 전부 9 달성',
  },
  en: {
    title: 'Pachinko',
    tickets: 'Tickets',
    totalExp: 'Total earned',
    spin: 'SPIN',
    spinning: 'Spinning…',
    noTicket: 'No tickets',
    howTo: `1 ticket per ${TICKET_RULE.perWorkouts} workouts, 1 per ${TICKET_RULE.perInbody} inbody`,
    rates: 'Odds',
    ratesTitle: 'Odds Table',
    ratesDesc: 'Chance of each tier per single spin.',
    recent: 'Recent',
    avg: 'Avg / spin',
    ticketRule: 'Tickets',
    stackLabel: 'Max stack',
    close: 'Close',
    digitBanner: ' DIGITS',
    novaBanner: 'ALL FIFTEEN NINES',
  },
};

// 기록 수 → 발급된 총 티켓 (저장하지 않고 매번 계산 = 조작 불가)
// 호출부가 객체/undefined를 넘겨도 NaN이 조용히 퍼지지 않도록 방어한다.
export function earnedTickets(totalWorkouts, totalInbody) {
  const w = Number.isFinite(+totalWorkouts) ? Math.max(0, +totalWorkouts) : 0;
  const i = Number.isFinite(+totalInbody) ? Math.max(0, +totalInbody) : 0;
  return Math.floor(w / TICKET_RULE.perWorkouts)
       + Math.floor(i / TICKET_RULE.perInbody);
}

// 파칭코로 획득한 누적 EXP (레벨 계산에 합산됨)
export function getPachinkoExp() {
  return readInt(LS.exp, 0);
}

const STRIP = Array.from({ length: REEL.cycles * 10 }, (_, i) => i % 10);

// 15자리까지 나오므로 좁은 칩/버튼 안에서는 축약해서 표기
function compactExp(n) {
  if (n < 10000) return String(n);
  const units = [
    [1e12, '조'], [1e8, '억'], [1e4, '만'],
  ];
  for (const [size, suffix] of units) {
    if (n >= size) {
      const v = n / size;
      return (v >= 100 ? Math.round(v) : +v.toFixed(1)) + suffix;
    }
  }
  return String(n);
}

export default function PachinkoSystem({ totalWorkouts = 0, totalInbody = 0, onExpChange }) {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;

  const [used, setUsed] = useState(() => readInt(LS.used, 0));
  const [gained, setGained] = useState(() => readInt(LS.exp, 0));
  const [log, setLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS.log) || '[]'); } catch { return []; }
  });

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
  useEffect(() => clearTimers, []);

  const earned = earnedTickets(totalWorkouts, totalInbody);
  // 미사용 티켓은 maxStack까지만 (오래 안 돌려도 무한 적립되지 않음)
  const available = Math.max(0, Math.min(earned - used, TICKET_RULE.maxStack));

  const persist = useCallback((nextUsed, nextExp, nextLog) => {
    localStorage.setItem(LS.used, String(nextUsed));
    localStorage.setItem(LS.exp, String(nextExp));
    localStorage.setItem(LS.log, JSON.stringify(nextLog.slice(0, LOG_MAX)));
  }, []);

  const spin = () => {
    if (spinning || available <= 0) return;

    const prize = drawPrize();
    const digits = String(prize.exp).padStart(REEL.digits, '0').split('').map(Number);

    setSpinning(true);
    setResult(null);

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

    // 4) 결과 확정 + 저장
    const doneId = setTimeout(() => {
      const nextUsed = used + 1;
      // 2^53을 넘으면 정수 정밀도가 깨지므로 LV100 기준선에서 자른다
      const nextExp = Math.min(gained + prize.exp, MAX_EXP);
      const nextLog = [{ id: prize.id, exp: prize.exp }, ...log];

      setUsed(nextUsed);
      setGained(nextExp);
      setLog(nextLog.slice(0, LOG_MAX));
      persist(nextUsed, nextExp, nextLog);

      const prevBest = localStorage.getItem(LS.best);
      const prevRank = PRIZES.findIndex(p => p.id === prevBest);
      const rank = PRIZES.findIndex(p => p.id === prize.id);
      if (rank > prevRank) localStorage.setItem(LS.best, prize.id);

      setResult(prize);
      setSpinning(false);
      onExpChange?.(nextExp);

      if (prize.exp > 0) toast(`${prize.icon} ${prize.label[lang] || prize.label.ko} +${compactExp(prize.exp)} EXP`);
      else toast(prize.msg[lang] || prize.msg.ko, 'error');
    }, REEL_TOTAL_MS + REEL.revealMs);
    timersRef.current.push(doneId);
  };

  const totalWeight = PRIZES.reduce((s, p) => s + p.weight, 0);
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
              🎫 {available}
            </div>
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
                  ? `transform ${REEL.baseMs + REEL.staggerMs * i}ms cubic-bezier(.12,.72,.16,1)`
                  : 'none',
                willChange: 'transform',
              }}>
                {STRIP.map((n, k) => (
                  <div
                    key={k}
                    style={{
                      height: REEL.itemHeight,
                      lineHeight: `${REEL.itemHeight}px`,
                      textAlign: 'center',
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: REEL.fontSize,
                      color: reel.stopped && result ? result.color : 'var(--text-primary)',
                      textShadow: reel.stopped && result ? `0 0 16px ${result.color}88` : 'none',
                      transition: 'color 180ms ease',
                    }}
                  >
                    {n}
                  </div>
                ))}
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
          {result ? `${result.exp.toLocaleString()} EXP` : 'EXP'}
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
            ? `${result.icon} ${result.label[lang] || result.label.ko} — ${result.msg[lang] || result.msg.ko}`
            : available > 0 ? t.howTo : t.noTicket}
      </div>

      {/* 돌리기 버튼 */}
      <button
        className="btn-primary"
        onClick={spin}
        disabled={spinning || available <= 0}
        style={{ width: '100%' }}
      >
        {spinning ? t.spinning : available > 0 ? `${t.spin} (🎫 ${available})` : t.noTicket}
      </button>

      {/* 최근 결과 */}
      {log.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 5 }}>
            {t.recent}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {log.map((entry, i) => {
              const p = PRIZES.find(x => x.id === entry.id) || PRIZES[0];
              return (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 7px', borderRadius: 'var(--radius)',
                  background: `${p.color}18`, border: `1px solid ${p.color}44`,
                  fontSize: 10, color: p.color,
                }}>
                  {p.icon} +{compactExp(entry.exp)}
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

            {PRIZES.map(p => {
              const pct = (p.weight / totalWeight) * 100;
              return (
                <div key={p.id} style={{ marginBottom: 10 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 12, marginBottom: 4,
                  }}>
                    <span style={{ color: p.color, fontWeight: 600 }}>
                      {p.icon} {p.label[lang] || p.label.ko}
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
                <span style={{ color: 'var(--success)' }}>~{EXPECTED_EXP.toFixed(1)} EXP</span>
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
