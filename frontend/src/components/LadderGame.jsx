import { useState, useRef, useEffect } from 'react';
import { useLangStore } from '../store/langStore';
import { usePachinkoStore } from '../store/pachinkoStore';
import { toast } from './Toast';
import ExpGainBanner from './ExpGainBanner';
import {
  LADDER, LADDER_PRIZES, LADDER_EXPECTED_EXP, drawLadderPrize, compactExp,
} from '../data/pachinkoData';

const T = {
  ko: {
    title: '사다리타기',
    sub: `하이리스크 — 티켓 ${LADDER.cost}장`,
    pick: '시작점을 고르고 출발하세요',
    go: '출발',
    fromCol: '번에서',
    tracing: '내려가는 중…',
    noTicket: `티켓 ${LADDER.cost}장이 필요해요`,
    rates: '확률표',
    ratesTitle: '사다리 확률표',
    ratesDesc: `티켓 ${LADDER.cost}장을 걸고 한 판. 꽝이 잦은 대신 최고 보상 확률이 파칭코의 3배입니다.`,
    avg: '판당 평균',
    cost: '판당 비용',
    close: '닫기',
    retry: '다시',
  },
  en: {
    title: 'Ladder',
    sub: `High risk — ${LADDER.cost} tickets`,
    pick: 'Pick a start, then go',
    go: 'START FROM',
    fromCol: '',
    tracing: 'Tracing…',
    noTicket: `Needs ${LADDER.cost} tickets`,
    rates: 'Odds',
    ratesTitle: 'Ladder Odds',
    ratesDesc: `${LADDER.cost} tickets per play. More misses, but 3x the top-prize chance.`,
    avg: 'Avg / play',
    cost: 'Cost / play',
    close: 'Close',
    retry: 'Again',
  },
};

const W = 300;   // SVG 좌표계 너비
const H = 210;   // SVG 좌표계 높이
const PAD_Y = 16;
// PC처럼 폭이 넓은 화면에서 사다리가 세로로 과하게 늘어나지 않도록 하는 상한
const LADDER_MAX_W = 420;

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
  const { play, gained } = usePachinkoStore();

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

  const timersRef = useRef([]);
  const rafRef = useRef(0);
  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
    cancelAnimationFrame(rafRef.current);
  }, []);

  const canPlay = available >= LADDER.cost && !tracing;

  const start = (startCol) => {
    if (!canPlay) return;

    const fresh = buildRungs();
    const { path, end } = trace(fresh, startCol);
    const prize = drawLadderPrize();

    // 도착 칸에 뽑힌 보상을 놓고, 나머지 칸은 다른 보상으로 섞어 채운다
    const rest = LADDER_PRIZES.filter(p => p.id !== prize.id)
      .sort(() => Math.random() - 0.5);
    const nextSlots = [];
    let ri = 0;
    for (let c = 0; c < LADDER.columns; c++) {
      nextSlots[c] = c === end ? prize : rest[ri++ % rest.length];
    }

    // 경로를 SVG path 로
    let d = `M ${colX(startCol)} ${PAD_Y - 8}`;
    for (let i = 1; i < path.length; i++) {
      const y = rowY(path[i].row);
      d += ` L ${colX(path[i - 1].col)} ${y}`;   // 세로 이동
      d += ` L ${colX(path[i].col)} ${y}`;       // 가로 이동
    }
    d += ` L ${colX(end)} ${H - PAD_Y + 8}`;

    setRungs(fresh);
    setSlots(nextSlots);
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

    const id = setTimeout(() => {
      play(LADDER.cost, prize, 'ladder');
      setResult({ ...prize, endCol: end });
      setTracing(false);
      if (prize.exp > 0) toast(`${prize.icon} ${prize.label[lang] || prize.label.ko} +${compactExp(prize.exp)} EXP`);
      else toast(prize.msg[lang] || prize.msg.ko, 'error');
    }, LADDER.traceMs + 200);
    timersRef.current.push(id);
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
                  opacity: tracing ? 0.35 : 1,
                }}
              >
                <span style={{ fontSize: 13 }}>{tracing ? '❓' : p.icon}</span>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 9,
                  color: hit ? p.color : 'var(--text-muted)',
                }}>
                  {tracing ? '???' : (p.label[lang] || p.label.ko)}
                </span>
                {/* 각 칸이 얼마짜리인지 */}
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 9,
                  color: hit ? p.color : 'var(--text-muted)',
                  opacity: hit ? 1 : 0.6,
                }}>
                  {tracing ? '' : `+${compactExp(p.exp)}`}
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
          : result
            ? `${result.icon} ${result.label[lang] || result.label.ko} — ${result.msg[lang] || result.msg.ko}`
            : available >= LADDER.cost ? t.pick : t.noTicket}
      </div>

      {/* 획득 EXP + 레벨 변화 */}
      {result && !tracing && (
        <ExpGainBanner
          baseExp={baseExp + gained}
          gainedExp={result.exp}
          color={result.color}
        />
      )}

      {/* 출발 버튼 */}
      <button
        className="btn-primary"
        onClick={() => start(selected)}
        disabled={!canPlay}
        style={{ width: '100%', marginBottom: 10 }}
      >
        {tracing
          ? t.tracing
          : available >= LADDER.cost
            ? `${t.go} ${selected + 1}${t.fromCol} (🎫 ${LADDER.cost})`
            : t.noTicket}
      </button>

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
                  ~{Math.round(LADDER_EXPECTED_EXP).toLocaleString()} EXP
                </span>
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
