import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { shortTime, longTime } from '../data/pace';

// 운동 끝 결산.
//
// 루틴을 다 마치면 여태 토스트 한 줄이 4초 지나가고 끝이었다. 하루 중 제일 뿌듯한
// 순간이 제일 조용했다. 그 자리에 한 화면을 세운다.
//
// **Toast 와 같은 방식으로 부른다** — 화면마다 상태를 들고 있으면 루틴이 끝나는
// 자리(기록 화면 · 운동 화면) 둘이 각자 같은 것을 짜게 된다. 여기 하나만 두고
// `showFinish(summary)` 로 부른다. 껍데기(Layout)에 한 번 걸려 있다.
//
// **직접 닫아야 사라진다.** 토스트처럼 4초 뒤에 없어지면, 폰을 내려놓고 물 마시고
// 온 사람은 아무것도 못 본다. 운동이 끝난 참이라 급할 것도 없다.
let showFinishFn = null;

/** 결산을 띄운다. summary 는 `data/sessionSummary.js` 의 buildSummary 결과. */
export function showFinish(summary) {
  if (showFinishFn && summary) showFinishFn(summary);
}

/** 큰 숫자가 0 에서 올라간다. 움직임을 싫어하는 설정이면 곧바로 끝값을 보여준다. */
function useCountUp(target, ms = 900) {
  const [n, setN] = useState(target);
  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce || !target) { setN(target); return undefined; }

    let raf = 0;
    const started = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - started) / ms);
      // 끝에서 천천히 멎는다. 등속으로 올리면 숫자가 툭 끊긴다
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

/** 무게 한 칸. 안 적었으면 맨몸이다 (숫자만 적었으면 kg 을 붙인다). */
function weightLabel(raw) {
  const w = raw === null || raw === undefined || String(raw).trim() === '' ? '맨몸' : String(raw).trim();
  return /^\d+(\.\d+)?$/.test(w) ? `${w}kg` : w;
}

function Motes() {
  // 다섯 알이면 충분하다. 금가루를 뿌리면 금세 싸 보인다
  const spots = [
    { left: '20%', delay: '0s', size: 2 },
    { left: '41%', delay: '3.4s', size: 1.5 },
    { left: '60%', delay: '6.1s', size: 2.5 },
    { left: '78%', delay: '1.8s', size: 1.5 },
    { left: '31%', delay: '8.3s', size: 2 },
  ];
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {spots.map((s) => (
        <span key={s.left} className="finish-mote" style={{
          left: s.left, width: s.size, height: s.size, animationDelay: s.delay,
        }} />
      ))}
    </div>
  );
}

export default function SessionFinish() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const fn = (s) => setSummary(s);
    showFinishFn = fn;
    // 이 컴포넌트가 두 번 마운트됐다 하나가 빠질 때 남은 쪽까지 벙어리가 되지 않게
    return () => { if (showFinishFn === fn) showFinishFn = null; };
  }, []);

  // 떠 있는 동안은 Esc 로 닫는다. 자판만 쓰는 사람에게 나갈 길이 있어야 한다
  useEffect(() => {
    if (!summary) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSummary(null); };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [summary]);

  // 훅은 조건보다 위에 있어야 한다 — 결산이 없을 때도 같은 수만큼 불려야 한다
  const kg = summary?.kg || 0;
  const shown = useCountUp(kg);

  if (!summary) return null;

  const { sets, count, weeks, deltaKg, record, routineName, bodyweightSets, items, parts, pace } = summary;
  // 맨몸만 한 날은 총 무게가 0 이다. 0kg 을 크게 띄우면 열심히 한 사람에게
  // 아무것도 아니라고 말하는 셈이라, 그때는 세트 수를 대신 세운다
  const weighted = kg > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="운동 결산"
      className="finish-sheet"
      onClick={(e) => { if (e.target === e.currentTarget) setSummary(null); }}
    >
      <Motes />
      <div className="finish-beam" aria-hidden="true" />

      <div style={{
        position: 'relative', width: '100%', maxWidth: 420, margin: '0 auto',
        padding: '40px 28px 32px', minHeight: '100%',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 머리 */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span className="label" style={{ marginBottom: 0, letterSpacing: 2.2 }}>
            {summary.date?.replace(/-/g, ' · ')}
          </span>
          <span className="label" style={{ marginBottom: 0, letterSpacing: 1.4 }}>
            {routineName || '운동 완료'}
          </span>
        </div>

        {/* 오늘 든 무게 — 이 화면에서 큰 것은 이것 하나뿐이다 */}
        <div style={{ marginTop: 'clamp(56px, 13vh, 120px)', textAlign: 'center' }}>
          <div className="label" style={{ marginBottom: 16, letterSpacing: 2.2 }}>
            {weighted ? '오늘 들어올린 무게' : '오늘 해낸 세트'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(58px, 20vw, 82px)',
              lineHeight: 0.84, letterSpacing: 2, color: 'var(--accent)',
            }}>{weighted ? shown.toLocaleString() : sets}</span>
            <span className="label" style={{ marginBottom: 0, fontSize: 13, letterSpacing: 3, color: 'var(--text-secondary)' }}>
              {weighted ? 'KG' : 'SETS'}
            </span>
          </div>

          {weighted && deltaKg !== null && deltaKg !== 0 && (
            <div className="serif-display" style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 20 }}>
              지난주 같은 날보다 {deltaKg > 0 ? `${deltaKg.toLocaleString()}kg 더` : `${Math.abs(deltaKg).toLocaleString()}kg 적게`}
            </div>
          )}
          {weighted && bodyweightSets > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
              맨몸 {bodyweightSets}세트는 무게에 안 들어갔어요
            </div>
          )}
        </div>

        {/* 각인 — 최고기록을 세운 날에만 나온다. 늘 나오면 각인이 아니다 */}
        {record && (
          <div style={{ marginTop: 'clamp(40px, 9vh, 76px)', textAlign: 'center' }}>
            <hr className="rule-beam" style={{ width: 56, margin: '0 auto 22px' }} />
            <div className="label" style={{ marginBottom: 12, letterSpacing: 2.2 }}>새 최고기록</div>
            <div className="serif-display" style={{ fontSize: 20, lineHeight: 1.5 }}>
              {record.entry.exercise} {record.entry.kg ? `${record.entry.kg}kg · ` : ''}{record.entry.reps}회
            </div>
            {record.prev && record.prev.kg && record.entry.kg > record.prev.kg && (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
                지난 최고보다 {Math.round((record.entry.kg - record.prev.kg) * 10) / 10}kg
              </div>
            )}
            <hr className="rule-beam" style={{ width: 56, margin: '22px auto 0' }} />
          </div>
        )}

        {/* **뭘 했는지.** 큰 숫자만 두면 방금 한 사람도 무엇으로 그 숫자가 됐는지
            모른다. 작게 깐다 — 크게 적으면 기록 화면이 되고, 그건 이미 있다.
            **다섯 줄까지만** 보여준다. 열 개를 적어두면 아무도 안 읽는다 */}
        {items && items.length > 0 && (
          <div style={{ marginTop: 'clamp(28px, 6vh, 44px)' }}>
            {parts && parts.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {parts.map((p) => (
                  <span key={p} style={{
                    fontSize: 11.5, padding: '2px 9px', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', color: 'var(--text-secondary)',
                  }}>{p}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.slice(0, 5).map((w, i) => (
                <div key={`${w.exercise}-${i}`} style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
                  fontSize: 12.5, color: 'var(--text-secondary)',
                }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.exercise}
                  </span>
                  <span style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
                    {weightLabel(w.weight)} · {w.sets}세트{w.reps ? ` × ${w.reps}회` : ''}
                  </span>
                </div>
              ))}
              {items.length > 5 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
                  외 {items.length - 5}개
                </div>
              )}
            </div>
          </div>
        )}

        {/* 나머지 숫자는 한 줄로 조용히 */}
        <div style={{
          marginTop: 'clamp(28px, 6vh, 44px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          {weighted && <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{sets}세트</span>}
          {weighted && <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--border-hover)' }} />}
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>운동 {count}개</span>
          {weeks > 0 && <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--border-hover)' }} />}
          {weeks > 0 && <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{weeks}주 연속</span>}
        </div>

        {/* ── 늘어졌나 ── (2026-09-16)
            결산이 든 무게는 말해줬지만 **그 무게를 얼마 만에 들었는지**는 아무 데도
            없었다. 헬스장에서 보낸 시간의 절반이 폰 보는 시간이라는 것은 스스로 못 본다.

            **좋다 나쁘다를 매기지 않는다.** 길게 쉬는 날이 있다 — 고중량 하는 날이
            그렇고 아픈 날도 그렇다. 「평소보다 길다」까지가 우리가 아는 전부다.

            못 재는 날(기록이 둘 이하 · 한꺼번에 적은 날)은 **아무 말도 안 한다** */}
        {pace?.usable && (
          <div style={{ marginTop: 'clamp(22px, 5vh, 34px)', textAlign: 'center' }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              헬스장에 {longTime(pace.spanMs)} · 기록 사이 보통 {shortTime(pace.medianMs)}
            </div>
            {pace.deltaMs !== null && Math.abs(pace.deltaMs) >= 30000 && (
              <div className="serif-display" style={{
                fontSize: 14, marginTop: 8,
                color: pace.deltaMs > 0 ? 'var(--warning)' : 'var(--success)',
              }}>
                평소보다 {shortTime(Math.abs(pace.deltaMs))} {pace.deltaMs > 0 ? '길게 쉬었어요' : '짧게 쉬었어요'}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              기록을 남긴 시각으로 쟀어요{pace.longestMs >= 15 * 60000 ? ` · 제일 길게 쉰 것 ${shortTime(pace.longestMs)}` : ''}
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <button
            ref={closeRef}
            className="btn-primary"
            style={{ background: 'none' }}
            onClick={() => { setSummary(null); navigate('/history'); }}
          >기록 보러 가기</button>
          <button
            onClick={() => setSummary(null)}
            className="label"
            style={{ marginBottom: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
          >닫기</button>
        </div>
      </div>
    </div>
  );
}
