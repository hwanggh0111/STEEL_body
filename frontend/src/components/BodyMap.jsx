import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import { useToday } from '../data/useToday';
import { buildHeat, MAP_PARTS } from '../data/bodyHeat';

// 몸 지도.
//
// 최근에 자극한 부위가 아직 달아 있고, 날이 갈수록 식는다. 계산은 `data/bodyHeat.js`
// 가 한다 — 여기서는 그리기만 한다.
//
// **그리는 규칙 셋.**
//
// 1. **식은 곳은 칠하지 않는다.** 없는 것을 색으로 칠하면 있는 것과 구별이 안 된다.
//    가장 식은 한 곳만 **가는 점선**으로 두른다. 식은 곳이 넷이라고 넷을 다 두르면
//    지도가 점선 밭이 되어 아무 데도 안 보인다 — 오늘 갈 곳은 어차피 하나다.
//
// 2. **금색은 밝기로만 말한다.** 색을 여러 개 쓰면(빨강=오래됨, 초록=최근) 뜻을
//    외워야 한다. 하나의 금색이 진해졌다 옅어지는 것은 안 배워도 읽힌다.
//
// 3. **숨 쉬는 것은 오늘 한 곳뿐이다.** 다 깜빡이면 아무것도 안 깜빡이는 것과 같다.
//
// **누를 수 있다** (2026-09-16 에 더했다). 첫 판은 보기만 하는 그림이었다 — 몸을
// 눌러도 아무 일이 없고, 「시작」은 가장 식은 한 곳에만 있었다. 그런데 사람이 오늘
// 할 곳을 늘 그 한 곳으로 고르지는 않는다(어제 하체를 했어도 오늘 또 할 수 있다).
// **여섯 부위가 다 열린다** — 몸을 누르거나 아래 줄을 누르면 그 부위가 펼쳐진다.
//
// **「얼마나 했나」도 같이 말한다.** 마지막 자극일만으로는 「어제 한 세트 깔짝」과
// 「어제 스무 세트」가 똑같이 뜨겁다. 최근 이레 세트 수를 부위끼리 견준 막대로 둔다.
// **절대값으로 좋다 나쁘다를 매기지 않는다** — 하체 5세트와 팔 5세트는 같은 양이 아니고,
// 우리는 그 사람의 프로그램을 모른다. 서로 견주는 것까지가 우리가 말할 수 있는 선이다.
//
// 색은 SVG 속성으로 나가므로 `var(--accent)` 를 못 쓴다 — 속성 안에서는 치환되지
// 않는다(2026-08-28 에 그래프에서 겪은 것과 같은 자리). 토큰 값을 직접 적는다.
const GOLD = '#eeb77d';
const GOLD_LOW = '#d29a5f';
const SKIN = '#1c1813';
const SKIN_EDGE = '#2b251c';

/** 달아오른 정도 → 칠. 0(식음)은 안 칠한다. */
function fillOf(level) {
  if (level >= 3) return { fill: GOLD, opacity: 0.78, breathe: true };
  if (level === 2) return { fill: GOLD_LOW, opacity: 0.46 };
  if (level === 1) return { fill: GOLD_LOW, opacity: 0.2 };
  return null;
}

/**
 * 부위 한 덩어리. 바탕 모양 위에 달아오른 칠을 겹친다.
 *
 * `shape` 는 이 파일 아래쪽의 그리기 조각이다 — 같은 모양을 바탕과 칠에 여러 번 쓴다.
 * 누를 수 있으므로 단추로 다룬다(자판 · 읽어주는 기계에서도 닿아야 한다).
 */
function Muscle({ shape, part, slot, dashed, selected, onPick }) {
  const paint = fillOf(slot?.level ?? 0);
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${part} · ${agoLabel(slot?.days)}`}
      aria-pressed={selected}
      onClick={() => onPick(part)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(part); } }}
      style={{ cursor: 'pointer', outline: 'none' }}
    >
      <g fill={SKIN} stroke={SKIN_EDGE} strokeWidth="0.7">{shape}</g>
      {paint && (
        <g
          fill={paint.fill}
          fillOpacity={paint.opacity}
          className={paint.breathe ? 'heat-breathe' : undefined}
          style={{ filter: 'url(#heatSoft)' }}
        >{shape}</g>
      )}
      {dashed && (
        <g fill="none" stroke={GOLD_LOW} strokeWidth="0.8" strokeOpacity="0.8" strokeDasharray="2.5 3">{shape}</g>
      )}
      {/* 고른 자리는 **가는 실선 한 줄**로만 표시한다. 칠을 더하면 달아오른 정도가
          달라 보여서, 고르기만 했는데 지도가 거짓말을 하게 된다 */}
      {selected && (
        <g fill="none" stroke={GOLD} strokeWidth="1.1" strokeOpacity="0.95">{shape}</g>
      )}
    </g>
  );
}

// ── 그리는 조각 ──
//
// 사람 몸을 정확히 그리는 것이 목적이 아니다. **어디를 말하는지 한눈에 알면 된다.**
// 그래서 타원과 둥근 네모로만 짠다 — 어느 폰에서 줄어들어도 뭉개지지 않는다.
const FRONT = {
  어깨: <><ellipse cx="38" cy="45" rx="11.5" ry="9" /><ellipse cx="82" cy="45" rx="11.5" ry="9" /></>,
  가슴: <rect x="44" y="49" width="32" height="24" rx="6" />,
  코어: <rect x="49" y="73" width="22" height="36" rx="5" />,
  팔: <>
    <ellipse cx="30" cy="70" rx="7.5" ry="15" /><ellipse cx="90" cy="70" rx="7.5" ry="15" />
    <ellipse cx="26" cy="101" rx="6" ry="14" /><ellipse cx="94" cy="101" rx="6" ry="14" />
  </>,
  하체: <>
    <ellipse cx="48" cy="142" rx="12.5" ry="31" /><ellipse cx="72" cy="142" rx="12.5" ry="31" />
    <ellipse cx="46" cy="195" rx="8.5" ry="21" /><ellipse cx="74" cy="195" rx="8.5" ry="21" />
  </>,
};

const BACK = {
  어깨: <><ellipse cx="38" cy="47" rx="11" ry="9" /><ellipse cx="82" cy="47" rx="11" ry="9" /></>,
  등: <path d="M45 50h30l-5 40H50z" />,
  코어: <rect x="49" y="90" width="22" height="20" rx="4" />,
  팔: <>
    <ellipse cx="30" cy="72" rx="7.5" ry="15" /><ellipse cx="90" cy="72" rx="7.5" ry="15" />
    <ellipse cx="26" cy="102" rx="6" ry="14" /><ellipse cx="94" cy="102" rx="6" ry="14" />
  </>,
  하체: <>
    <rect x="42" y="110" width="36" height="22" rx="9" />
    <ellipse cx="48" cy="152" rx="12" ry="26" /><ellipse cx="72" cy="152" rx="12" ry="26" />
    <ellipse cx="46" cy="195" rx="9" ry="21" /><ellipse cx="74" cy="195" rx="9" ry="21" />
  </>,
};

function Silhouette({ shapes, byPart, coldPart, selected, onPick, label, width }) {
  return (
    <svg width={width} height={width * 2.38} viewBox="0 0 120 240" fill="none" role="group" aria-label={label}>
      <defs>
        <filter id="heatSoft" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* 머리 · 목 — 부위가 아니라 사람 모양을 알아보게 하는 것뿐이다. 안 눌린다 */}
      <g fill={SKIN} stroke={SKIN_EDGE} strokeWidth="0.7">
        <circle cx="60" cy="17" r="11" />
        <rect x="54" y="27" width="12" height="8" rx="3" />
      </g>

      {Object.entries(shapes).map(([part, shape]) => (
        <Muscle
          key={part}
          part={part}
          shape={shape}
          slot={byPart[part]}
          dashed={part === coldPart && (byPart[part]?.level ?? 0) === 0}
          selected={part === selected}
          onPick={onPick}
        />
      ))}
    </svg>
  );
}

/** 며칠 됐나 → 사람 말. */
function agoLabel(days) {
  if (days === null || days === undefined) return '아직 없음';
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}

/** 마지막 기록 한 줄. 무게를 안 적었으면 맨몸이다. */
function lastLine(last) {
  if (!last) return null;
  const w = last.weight === null || last.weight === undefined || String(last.weight).trim() === ''
    ? '맨몸' : String(last.weight);
  const kg = /^\d+(\.\d+)?$/.test(w) ? `${w}kg` : w;
  return `${last.exercise} · ${kg} · ${last.sets}세트${last.reps ? ` × ${last.reps}회` : ''}`;
}

export default function BodyMap() {
  const navigate = useNavigate();
  const today = useToday();
  const workouts = useWorkoutStore((s) => s.workouts);
  const fetchAll = useWorkoutStore((s) => s.fetchAll);
  // 「몸」 탭은 여태 인바디만 받아왔다. 지도는 운동 기록으로 그린다 —
  // 스토어가 30초 안에 받은 것은 다시 안 부른다(중복 요청은 저기서 합쳐진다)
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const heat = useMemo(() => buildHeat(workouts, today), [workouts, today]);
  // 고른 부위. **처음에는 아무것도 안 고른 상태**다 — 열자마자 한 부위가 펼쳐져
  // 있으면 그것이 오늘 할 것이라고 말하는 셈이 된다. 고르는 것은 사람이 한다
  const [picked, setPicked] = useState(null);

  if (!heat.any) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          운동을 기록하면 여기에 몸이 그려져요.<br />
          최근에 한 부위가 금빛으로 달아오르고, 며칠 지나면 식습니다.
        </div>
        <button className="btn-primary" onClick={() => navigate('/train')}>운동 기록하기</button>
      </div>
    );
  }

  const cold = heat.coldest;
  const shown = picked ? heat.byPart[picked] : null;
  const toggle = (part) => setPicked((p) => (p === part ? null : part));

  return (
    <div>
      {/* 한 줄로 말한다. 지도는 그 말의 근거다 */}
      <div className="serif-display" style={{ fontSize: 22, lineHeight: 1.5, marginBottom: 20 }}>
        {cold.days === null ? (
          <><span style={{ color: 'var(--accent)' }}>{cold.part}</span>은(는)<br />아직 한 번도 안 했습니다</>
        ) : cold.days === 0 ? (
          <>오늘은 몸 전체가<br />고루 달아 있습니다</>
        ) : (
          <><span style={{ color: 'var(--accent)' }}>{cold.part}</span>이(가) {cold.days}일째<br />식어 있습니다</>
        )}
      </div>

      <hr className="rule-beam" style={{ marginBottom: 14 }} />

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
        <Silhouette shapes={FRONT} byPart={heat.byPart} coldPart={cold.part}
          selected={picked} onPick={toggle} label="앞모습" width={140} />
        <Silhouette shapes={BACK} byPart={heat.byPart} coldPart={cold.part}
          selected={picked} onPick={toggle} label="뒷모습" width={140} />
      </div>

      {/* 범례 — 색이 무엇을 뜻하는지 한 줄 */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, marginTop: 4 }}>
        {[
          { c: GOLD, o: 0.78, t: '오늘' },
          { c: GOLD_LOW, o: 0.46, t: '이틀 전' },
          { c: GOLD_LOW, o: 0.2, t: '닷새 전' },
        ].map((d) => (
          <span key={d.t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.c, opacity: d.o }} />
            {d.t}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', border: `1px dashed ${GOLD_LOW}` }} />
          식었음
        </span>
      </div>

      <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 12 }}>
        몸이나 아래 줄을 누르면 그 부위를 자세히 봅니다
      </div>

      <hr className="rule-beam" style={{ margin: '18px 0' }} />

      {/* 부위 여섯.
          **마지막 자극일 + 최근 이레 세트 수**를 같이 준다. 날짜만으로는 「어제 한
          세트 깔짝」과 「어제 스무 세트」가 똑같이 뜨겁다.
          막대는 **부위끼리 견준 것**이지 많다 적다를 매긴 것이 아니다 */}
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 16 }}>
        {MAP_PARTS.map((p) => {
          const slot = heat.byPart[p];
          const isCold = p === cold.part && slot.level === 0;
          const on = p === picked;
          const ratio = heat.maxSets7 > 0 ? slot.sets7 / heat.maxSets7 : 0;
          return (
            <div key={p}>
              <button
                onClick={() => toggle(p)}
                aria-expanded={on}
                style={{
                  width: '100%', minHeight: 44, padding: '10px 2px', background: 'none',
                  border: 'none', borderBottom: '1px solid var(--bg-tertiary)', cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: slot.level > 0 ? (slot.level >= 3 ? GOLD : GOLD_LOW) : 'none',
                  opacity: slot.level >= 3 ? 0.9 : slot.level === 2 ? 0.5 : slot.level === 1 ? 0.24 : 1,
                  border: slot.level === 0 ? `1px dashed ${isCold ? GOLD_LOW : 'var(--border-hover)'}` : 'none',
                }} />
                <span style={{
                  width: 34, flexShrink: 0, fontSize: 14,
                  color: on ? 'var(--accent)' : isCold ? 'var(--accent-low)' : 'var(--text-primary)',
                }}>{p}</span>

                {/* 최근 이레 — 세트가 하나도 없으면 막대도 안 그린다 */}
                <span className="progress-bg" style={{ flexGrow: 1, height: 4 }}>
                  {slot.sets7 > 0 && (
                    <span className="progress-fill" style={{
                      display: 'block', height: 4,
                      width: `${Math.max(6, Math.round(ratio * 100))}%`,
                      background: slot.level >= 3 ? GOLD : GOLD_LOW,
                      opacity: slot.level >= 3 ? 0.95 : 0.55,
                    }} />
                  )}
                </span>

                <span style={{ width: 40, textAlign: 'right', fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {slot.sets7 > 0 ? `${slot.sets7}세트` : '—'}
                </span>
                <span style={{ width: 46, textAlign: 'right', fontSize: 12, color: isCold ? 'var(--accent-low)' : 'var(--text-muted)', flexShrink: 0 }}>
                  {agoLabel(slot.days)}
                </span>
              </button>

              {/* 펼친 자리 — 마지막으로 뭘 했는지와 그 부위로 가는 길 */}
              {on && (
                <div style={{
                  padding: '13px 14px', marginBottom: 2,
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  display: 'flex', flexDirection: 'column', gap: 11,
                }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {shown?.last
                      ? <>마지막 기록 · {shown.date}<br />{lastLine(shown.last)}</>
                      : <>{p} 기록이 아직 없어요.</>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    최근 이레 {shown?.sets7 || 0}세트 · 지금까지 {shown?.count || 0}번
                  </div>
                  <button className="btn-secondary" onClick={() => navigate('/train', { state: { part: p } })}>
                    {p} 운동 찾기
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 어느 부위에도 못 들어간 것. **조용히 빼지 않는다** —
          「나는 이만큼 했는데 지도가 비어 있다」가 되면 지도를 못 믿게 된다 */}
      {heat.other.count > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
          {heat.other.count}건은 부위를 못 알아봐서 지도에 없어요
          {heat.other.names.length > 0 && ` (${heat.other.names.slice(0, 3).join(' · ')}${heat.other.names.length > 3 ? ' 외' : ''})`}.
          운동 이름을 알아보게 적으면 지도에 들어옵니다.
        </div>
      )}

      {/* 오늘 갈 곳 하나. 고른 부위가 있으면 그 자리 안에 단추가 있으므로 안 그린다 */}
      {!picked && cold.level === 0 && (
        <button
          className="btn-primary"
          onClick={() => navigate('/train', { state: { part: cold.part } })}
        >{cold.part} 운동 찾기</button>
      )}
    </div>
  );
}
