import { useState, useRef, useEffect, useCallback } from 'react';
import { useLangStore } from '../store/langStore';
import { usePachinkoStore } from '../store/pachinkoStore';
import { toast } from './Toast';
import ExpGainBanner from './ExpGainBanner';
import { UL_EXP, GENESIS } from './LevelSystem';
import {
  UL_PACHINKO, UL_PRIZES, UL_REEL_TOTAL_MS, UL_EXPECTED, drawUlPrize, compactExp,
  UL_WEIGHT_TOTAL_PROD, UL_WEIGHT_TOTAL_DEV, UL_HAS_DEV_WEIGHTS, ulWeight, UL_TICKET,
} from '../data/pachinkoData';

// 개벽(3차 레벨 체계) 전용 파칭코.
// 릴 연출은 일반 파칭코와 같지만 보상 단위가 울트라 레전드 EXP 라,
// 여기서 이긴 만큼 개벽 등급이 바로 오른다.
//
// 잠금 — 일반 150레벨(LV 149)을 다 채워 "새 레벨 단계"(초월)에 들어가면 나온다.
// 열리기 전에도 기계와 조건은 보여준다 (숨기면 목표가 있다는 걸 알 수가 없다).
//
// UL EXP 를 실제로 쓰는 개벽 등급은 그보다 위인 초월 만렙에서 열린다.
// 그 사이 구간에서는 벌어둔 UL EXP 가 화면에 안 잡히므로, 여기서 보유량과
// "개벽 몇 레벨분인지"를 직접 보여준다. 안 그러면 모으는 의미가 안 보인다.

const T = {
  ko: {
    title: '울트라 레전드 파칭코',
    sub: `한 판에 ${UL_TICKET.icon} ${UL_PACHINKO.cost}장`,
    tickets: '울트라 티켓',
    noUl: '울트라 티켓이 없어요 — 위 교환소에서 바꾸세요',
    locked: '잠김',
    lockedWhy: 'LV 150을 다 채우고 초월 단계에 들어가면 열립니다',
    banking: '개벽은 초월 100에서 열립니다 — 그때까지 여기서 모읍니다',
    stock: '모아둔',
    spin: '돌리기',
    batch: `${UL_PACHINKO.batch}연차`,
    spinning: '여는 중…',
    noTicket: `${UL_TICKET.icon} 울트라 티켓이 필요해요`,
    rates: '확률표',
    ratesTitle: '울트라 레전드 확률표',
    ratesDesc: `한 판에 ${UL_TICKET.icon} 울트라 티켓 ${UL_PACHINKO.cost}장(일반 티켓 ${UL_TICKET.rate}장). 보상이 일반 EXP 가 아니라 울트라 레전드 EXP 로 들어와 개벽 등급이 바로 오릅니다.`,
    avg: '판당 평균',
    perLevel: '개벽 1레벨',
    cost: '판당 비용',
    close: '닫기',
    held: '보유',
    devWarn: '개발 빌드입니다 — 실제로 뽑히는 확률은 아래와 다릅니다 (표는 운영 확률)',
    batchResult: (n) => `${n}연차`,
    levelsWorth: (n) => `개벽 ${n}레벨분`,
  },
  en: {
    title: 'Ultra Legend Pachinko',
    sub: `${UL_PACHINKO.cost} ${UL_TICKET.icon} per spin`,
    tickets: 'Ultra Tickets',
    noUl: 'No ultra tickets — use the exchange above',
    locked: 'LOCKED',
    lockedWhy: 'Unlocks once LV 150 is full and Transcend begins',
    banking: 'Genesis opens at Transcend 100 — banking until then',
    stock: 'Banked',
    spin: 'SPIN',
    batch: `${UL_PACHINKO.batch}x`,
    spinning: 'Opening…',
    noTicket: `Needs an ultra ticket`,
    rates: 'Odds',
    ratesTitle: 'Ultra Legend Odds',
    ratesDesc: `${UL_PACHINKO.cost} ultra ticket per spin (= ${UL_TICKET.rate} regular). Pays in ULTRA LEGEND EXP, which raises Genesis directly.`,
    avg: 'Avg / spin',
    perLevel: 'Per genesis level',
    cost: 'Cost / spin',
    close: 'Close',
    held: 'Held',
    devWarn: 'Dev build — actual draw odds differ from this table (table shows production odds)',
    batchResult: (n) => `${n} spins`,
    levelsWorth: (n) => `${n} genesis levels`,
  },
};

// 릴에 감아둘 숫자 띠 (0~9 반복)
const STRIP = Array.from({ length: UL_PACHINKO.cycles * 10 }, (_, i) => i % 10);
// 칸마다 <div> 를 만들면 릴 하나에 70개, 16칸이면 1,120개다. 칸 스타일이 전부 같으므로
// 줄바꿈으로 이어 붙인 텍스트 한 덩어리로 그린다 (PachinkoSystem 과 같은 이유).
const STRIP_TEXT = STRIP.join('\n');

// 개발 경고에 쓰는 합계. 개발 빌드에서만 의미가 있고 값이 고정이라 여기서 한 번만 구한다
// (UL_WEIGHT_TOTAL_DEV 는 pachinkoData 에서 가져다 쓴다 — 추첨과 같은 값이어야 한다)

// 이 보상이 개벽 몇 레벨분인지 — 조 단위 숫자만으로는 크기가 안 읽힌다
const levelsOf = (exp) => Math.round((exp / GENESIS.expPerLevel) * 10) / 10;

// 확률 표기 — 소수점이 길게 늘어지지 않게 자른다 (0.1% 같은 값도 0 으로 뭉개지 않는다)
const pctText = (v) => `${Number(v.toFixed(v < 1 ? 3 : 1))}%`;

export default function UltraPachinko({ available = 0, unlocked = false, genesisOpen = false, baseExp = 0 }) {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;
  const { gained, ulExp, lastUlGain, ulTickets, spendUlTickets } = usePachinkoStore();

  const [reels, setReels] = useState(
    () => Array.from({ length: UL_PACHINKO.digits }, () => ({ pos: 0, moving: false, stopped: true })),
  );
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [batch, setBatch] = useState(null);      // 연차 내역 { n, rows, total }
  const [showRates, setShowRates] = useState(false);

  const timersRef = useRef([]);
  const rafRef = useRef(0);
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    cancelAnimationFrame(rafRef.current);
  };

  // 연출 중이라 아직 화면에 안 나온 보상. 티켓은 돌릴 때 이미 나갔으므로
  // 도중에 이탈하면 여기 든 몫을 정산해 준다 (사다리·원판과 같은 규칙).
  const inFlightRef = useRef(null);
  const settleInFlight = useCallback(() => {
    const held = inFlightRef.current;
    if (!held) return 0;
    inFlightRef.current = null;
    return usePachinkoStore.getState().awardUl(held.total);
  }, []);

  // 새로고침 / 탭 닫기에도 정산한다. beforeunload 가 아니라 pagehide 를 쓰는 이유는
  // PlateDodge 주석 참고 (모바일 사파리와 bfcache 진입에서도 뜬다).
  useEffect(() => {
    window.addEventListener('pagehide', settleInFlight);
    return () => {
      window.removeEventListener('pagehide', settleInFlight);
      clearTimers();
      settleInFlight();
    };
  }, [settleInFlight]);

  const canSpin = unlocked && !spinning && ulTickets >= UL_PACHINKO.cost;

  const spin = (times = 1) => {
    if (!canSpin) return;
    const n = Math.min(times, Math.floor(ulTickets / UL_PACHINKO.cost));
    if (n < 1) return;

    clearTimers();
    settleInFlight();   // 앞 판이 남아 있으면 먼저 정산 (보통은 없다)

    // 돌리는 순간 울트라 티켓을 확정 차감한다. 연출이 끝날 때 빼면 결과를 보고
    // 새로고침해서 무를 수 있다 (pachinkoStore 주석 참고).
    if (!spendUlTickets(UL_PACHINKO.cost * n)) return;

    // n 은 최대 UL_PACHINKO.batch(10) 라 판마다 뽑아도 부담이 없다.
    // 일반 파칭코처럼 수백만 판을 돌릴 수 있는 모드가 아니라 표본추출이 필요 없다.
    const drawn = Array.from({ length: n }, () => drawUlPrize());
    const total = drawn.reduce((s, p) => s + p.exp, 0);
    const best = drawn.reduce((a, b) => (b.exp > a.exp ? b : a));
    inFlightRef.current = { total };   // 도중에 이탈해도 이 몫은 지급된다

    // 릴에는 이번에 받은 총액을 띄운다 (단판이면 그 판의 보상과 같다).
    // 칸 수를 넘는 값은 전 칸 9 로 눕힌다 — 자리를 잘라 앞자리를 버리면 안 된다.
    const cap = Number('9'.repeat(UL_PACHINKO.digits));
    const shown = String(Math.min(total, cap))
      .padStart(UL_PACHINKO.digits, '0').split('').map(Number);

    setSpinning(true);
    setResult(null);
    setBatch(null);

    // 1) 트랜지션 없이 릴을 시작 위치로 되돌린다
    setReels(shown.map(() => ({ pos: 0, moving: false, stopped: false })));

    // 2) 다음 프레임에 트랜지션을 켜고 목표 위치로 굴린다.
    //    되돌리기와 굴리기를 같은 프레임에 하면 릴이 즉시 완성돼 버린다.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setReels(shown.map((d) => ({
          pos: UL_PACHINKO.baseSpins * 10 + d, moving: true, stopped: false,
        })));
      });
    });

    // 3) 왼쪽 릴부터 하나씩 착지 표시.
    //    트랜지션이 rAF 2프레임 뒤에 시작하므로 그만큼 늦춰야 착지와 맞는다.
    shown.forEach((_, i) => {
      timersRef.current.push(setTimeout(() => {
        setReels(prev => prev.map((r, j) => (j === i ? { ...r, stopped: true } : r)));
      }, UL_PACHINKO.baseMs + UL_PACHINKO.staggerMs * i + 48));
    });

    // 4) 결과 확정 + 지급
    timersRef.current.push(setTimeout(() => {
      const applied = settleInFlight();
      setSpinning(false);
      setResult({ ...best, total, applied });

      if (n > 1) {
        const counts = new Map();
        drawn.forEach(p => counts.set(p, (counts.get(p) || 0) + 1));
        setBatch({
          n,
          total,
          rows: [...UL_PRIZES].reverse()
            .filter(p => counts.has(p))
            .map(p => ({ prize: p, count: counts.get(p) })),
        });
      }

      const unit = UL_EXP.short[lang] || UL_EXP.short.ko;
      if (applied > 0) {
        toast(`${best.icon} ${best.label[lang] || best.label.ko} +${compactExp(applied)} ${unit}`);
      } else {
        toast(best.msg[lang] || best.msg.ko, 'error');
      }
    }, UL_REEL_TOTAL_MS + UL_PACHINKO.revealMs));
  };

  // 확률표는 언제나 운영 가중치로 낸다 — 개발값을 띄우면 진짜 확률로 오해한다
  const glow = result ? result.color : UL_EXP.color;
  const ulShort = UL_EXP.short[lang] || UL_EXP.short.ko;

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16, opacity: unlocked ? 1 : 0.72 }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 'var(--radius)',
            background: `${UL_EXP.color}18`, border: `1px solid ${UL_EXP.color}66`,
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 11,
            letterSpacing: 1.5, color: UL_EXP.color,
          }}>
            {UL_EXP.icon} {t.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {unlocked ? t.sub : t.lockedWhy}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>
            {unlocked ? t.tickets : t.locked}
          </div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, lineHeight: 1,
            color: unlocked && ulTickets >= UL_PACHINKO.cost ? UL_EXP.color : 'var(--text-muted)',
          }}>
            {unlocked ? `${UL_TICKET.icon} ${ulTickets.toLocaleString()}` : '🔒'}
          </div>
        </div>
      </div>

      {/* 릴 */}
      <div style={{
        display: 'flex', gap: UL_PACHINKO.gap, width: '100%',
        padding: '10px 6px', marginBottom: 10,
        borderRadius: 'var(--radius)',
        background: 'linear-gradient(180deg, #0d0810 0%, #0c0c14 60%, #08080c 100%)',
        border: `1px solid ${result ? `${glow}66` : 'var(--border)'}`,
        boxShadow: result ? `0 0 34px ${glow}33, inset 0 0 26px ${glow}1e` : 'none',
        transition: 'box-shadow 300ms ease, border-color 300ms ease',
      }}>
        {reels.map((reel, i) => (
          <div
            key={i}
            style={{
              flex: 1, minWidth: 0, height: UL_PACHINKO.itemHeight,
              overflow: 'hidden', borderRadius: 4,
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${reel.stopped && result ? `${glow}55` : 'var(--border)'}`,
            }}
          >
            <div style={{
              transform: `translateY(${-reel.pos * UL_PACHINKO.itemHeight}px)`,
              transition: reel.moving
                ? `transform ${UL_PACHINKO.baseMs + UL_PACHINKO.staggerMs * i}ms cubic-bezier(.12,.72,.16,1), color 180ms ease`
                : 'color 180ms ease',
              // will-change 는 도는 동안만 (PachinkoSystem 주석 참고)
              willChange: reel.moving ? 'transform' : 'auto',
              whiteSpace: 'pre',
              lineHeight: `${UL_PACHINKO.itemHeight}px`,
              textAlign: 'center',
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: UL_PACHINKO.fontSize,
              color: reel.stopped && result ? glow : 'var(--text-secondary)',
            }}>
              {STRIP_TEXT}
            </div>
          </div>
        ))}
      </div>

      {/* 상태 문구 */}
      <div style={{
        minHeight: 20, textAlign: 'center', marginBottom: 10,
        fontSize: 12, fontWeight: 600,
        color: result ? result.color : 'var(--text-muted)',
      }}>
        {spinning
          ? t.spinning
          : result
            ? `${result.icon} ${result.label[lang] || result.label.ko} — ${result.msg[lang] || result.msg.ko}`
            : unlocked
              ? (ulTickets >= UL_PACHINKO.cost ? t.sub : t.noUl)
              : t.lockedWhy}
      </div>

      {/* 개벽이 열리기 전 구간 — 벌어둔 UL EXP 가 어디에도 안 잡히므로 여기서 보여준다 */}
      {unlocked && !genesisOpen && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, flexWrap: 'wrap',
          marginBottom: 10, padding: '7px 10px',
          borderRadius: 'var(--radius)',
          background: `${UL_EXP.color}0e`, border: `1px solid ${UL_EXP.color}44`,
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.banking}</span>
          <span style={{ fontSize: 11, color: UL_EXP.color, whiteSpace: 'nowrap' }}>
            {t.stock} {UL_EXP.icon} {compactExp(ulExp)}
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              {' '}({t.levelsWorth(levelsOf(ulExp))})
            </span>
          </span>
        </div>
      )}

      {/* 연차 내역 */}
      {batch && !spinning && (
        <div style={{
          marginBottom: 10, padding: '8px 10px',
          borderRadius: 'var(--radius)',
          background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
        }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, letterSpacing: 1,
            color: 'var(--text-muted)', marginBottom: 6,
          }}>
            {t.batchResult(batch.n)} —{' '}
            <span style={{ color: UL_EXP.color }}>
              +{compactExp(batch.total)} {ulShort}
            </span>
          </div>
          {batch.rows.map(({ prize, count }) => (
            <div key={prize.id} style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 11, marginBottom: 2, color: prize.color,
            }}>
              <span>{prize.icon} {prize.label[lang] || prize.label.ko}</span>
              <span style={{ color: 'var(--text-muted)' }}>×{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* 획득 + 개벽 레벨 변화.
          일반 EXP 는 이 기계로 늘지 않으므로 gainedExp 는 0 을 넘긴다 —
          배너가 개벽 구간을 잡아 UL EXP 로 표시한다. */}
      {result && !spinning && (
        <ExpGainBanner
          baseExp={baseExp + gained}
          gainedExp={0}
          ulExp={ulExp}
          ulGain={lastUlGain}
          source="ul"
          color={result.color}
        />
      )}

      {/* 버튼 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button
          className="btn-primary"
          onClick={() => spin(1)}
          disabled={!canSpin}
          style={{ flex: 1 }}
        >
          {spinning ? t.spinning : `${UL_EXP.icon} ${t.spin} (${UL_TICKET.icon} ${UL_PACHINKO.cost})`}
        </button>
        <button
          onClick={() => spin(UL_PACHINKO.batch)}
          disabled={!canSpin || ulTickets < UL_PACHINKO.cost * UL_PACHINKO.batch}
          style={{
            flex: 1,
            background: 'var(--bg-tertiary)',
            border: `1px solid ${UL_EXP.color}66`,
            borderRadius: 'var(--radius)',
            color: canSpin && ulTickets >= UL_PACHINKO.cost * UL_PACHINKO.batch
              ? UL_EXP.color : 'var(--text-muted)',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.2,
            padding: '9px 0',
            cursor: canSpin ? 'pointer' : 'not-allowed',
          }}
        >
          {t.batch} ({UL_TICKET.icon} {(UL_PACHINKO.cost * UL_PACHINKO.batch).toLocaleString()})
        </button>
      </div>

      {/* 확률표 */}
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
              maxWidth: 380, width: '100%', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            }}
          >
            <h3 style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2,
              color: 'var(--text-primary)', marginBottom: 4,
            }}>
              {UL_EXP.icon} {t.ratesTitle}
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
              {t.ratesDesc}
            </p>

            {UL_HAS_DEV_WEIGHTS && (
              <div style={{
                marginBottom: 12, padding: '7px 9px',
                borderRadius: 'var(--radius)',
                background: 'var(--danger-dim)', border: '1px solid var(--danger)',
                fontSize: 10, color: 'var(--danger)', lineHeight: 1.6,
              }}>
                ⚠️ {t.devWarn}
                {' '}({UL_PRIZES.filter(p => p.devWeight != null).map(p => `${p.label[lang] || p.label.ko} ${pctText((ulWeight(p) / UL_WEIGHT_TOTAL_DEV) * 100)}`).join(', ')})
              </div>
            )}

            {UL_PRIZES.map(p => {
              const pct = (p.weight / UL_WEIGHT_TOTAL_PROD) * 100;
              return (
                <div key={p.id} style={{ marginBottom: 10 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 12, marginBottom: 4, gap: 8,
                  }}>
                    <span style={{ color: p.color, fontWeight: 600 }}>
                      {p.icon} {p.label[lang] || p.label.ko}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>
                      {pctText(pct)} · <span style={{ color: p.color }}>+{compactExp(p.exp)}</span>
                      {p.exp > 0 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                          {' '}({t.levelsWorth(levelsOf(p.exp))})
                        </span>
                      )}
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
                <span style={{ color: 'var(--danger)' }}>
                  {UL_TICKET.icon} {UL_PACHINKO.cost}
                  <span style={{ color: 'var(--text-muted)' }}> (🎫 {UL_TICKET.rate})</span>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t.avg}</span>
                <span style={{ color: UL_EXP.color }}>
                  ~{compactExp(Math.round(UL_EXPECTED))} {ulShort}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t.perLevel}</span>
                <span>{compactExp(GENESIS.expPerLevel)} {ulShort}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t.held} {UL_EXP.icon}</span>
                <span style={{ color: UL_EXP.color }}>{ulExp.toLocaleString()}</span>
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
