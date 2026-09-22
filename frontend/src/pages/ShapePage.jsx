import { useMemo, useEffect } from 'react';
import { useWorkoutStore } from '../store/workoutStore';
import { useInbodyStore } from '../store/inbodyStore';
import { useToday } from '../data/useToday';
import { buildShapeRead } from '../data/shapeRead';

// 체형 — **01 단계: 사진 없이 「덜 한 곳」** (2026-09-22).
//
// 계획은 `docs/SHAPE-READ-2026-09-19.md`. 거기서 정한 차례의 첫 칸이라, 여기엔
// 아직 사진도 그림도 없다. **01만 해도 쓸모가 있어야 한다**는 것이 그날 정한 것이다.
//
// 계산은 전부 `data/shapeRead.js` 가 한다 — 여기서는 그리기만 한다(검사가 값으로
// 보고 있다: `npm run shape`). 화면에서 규칙을 한 줄이라도 다시 쓰면 두 벌이 되고,
// 그러면 한쪽만 고치는 날이 온다.
//
// **그리는 규칙 둘.**
//
// 1. **줄마다 근거를 붙인다.** 무엇으로 한 말인지(기록 · 인바디)가 안 보이면
//    앱이 몸을 들여다본 것처럼 읽힌다. 우리가 본 것은 적어둔 세트와 인바디 값뿐이다.
// 2. **막대는 부위끼리만 견준다.** 세트 수에 좋다 나쁘다를 매기지 않는다 —
//    지도(`BodyMap`)에서 정한 것과 같은 선이다.
export default function ShapePage({ embedded = false }) {
  const today = useToday();
  const workouts = useWorkoutStore((s) => s.workouts);
  const fetchAll = useWorkoutStore((s) => s.fetchAll);
  const records = useInbodyStore((s) => s.records);
  const fetchInbody = useInbodyStore((s) => s.fetchAll);

  // 둘 다 제 가게(store)에서 받는다. 「몸」 탭 안에서 열리면 인바디는 이미 받아둔
  // 것이라 다시 안 간다(30초 안은 그대로 쓴다 — `inbodyStore` 의 FRESH_MS)
  useEffect(() => { fetchAll?.(); fetchInbody?.(); }, [fetchAll, fetchInbody]);

  const read = useMemo(
    () => buildShapeRead(workouts, records, today),
    [workouts, records, today],
  );

  const maxSets = read.parts.reduce((n, p) => Math.max(n, p.sets), 0);

  return (
    <div>
      {!embedded && (
        <div className="section-title">
          <div className="accent-bar" />
          체형
        </div>
      )}

      {/* ── 자료가 모자라면 아무 말도 안 한다 ──
          「덜 한 곳」은 여덟 주가 있어야 나오는 말이다. 두어 번 적고 들어온 사람에게
          그럴듯한 문장을 지어내면, 그 다음부터는 맞는 말도 안 믿게 된다 */}
      {!read.ready ? (
        <div className="card">
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.7 }}>
            {read.need}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 7 }}>
            여기는 <b>최근 8주</b>를 봐요. 앞 4주와 지난 4주를 견줍니다.
          </div>
        </div>
      ) : (
        <>
          {/* ── 머리 한 줄 ──
              단정한 것과 「두고 보자」는 것을 **색으로 가른다.** 둘을 같은 낯으로
              두면 「늘고 있어요」가 지적으로 읽힌다 */}
          <div
            className="card"
            style={{
              marginBottom: 14,
              borderColor: read.verdict === 'less' ? 'var(--accent)' : 'var(--border-hover)',
              background: read.verdict === 'less' ? 'var(--accent-dim)' : 'none',
            }}
          >
            <div style={{
              fontSize: 11.5, letterSpacing: 1, marginBottom: 7,
              color: read.verdict === 'less' ? 'var(--accent)' : 'var(--text-muted)',
            }}>
              최근 8주
            </div>
            <div style={{ fontSize: 17, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {read.verdict === 'less'
                ? <>덜 한 곳은 <b>{read.least.part}</b>예요.</>
                : <><b>{read.least.part}</b>가 가장 적지만, 늘고 있어요.</>}
            </div>
          </div>

          {/* ── 근거 ──
              한 줄 한 줄이 어디서 온 말인지 왼쪽에 붙인다 */}
          <div className="card" style={{ marginBottom: 14 }}>
            {read.lines.map((line, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', gap: 9, alignItems: 'flex-start',
                  padding: '9px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <span style={{
                  flexShrink: 0, marginTop: 1,
                  fontSize: 10.5, letterSpacing: 0.5, whiteSpace: 'nowrap',
                  padding: '3px 7px', borderRadius: 4,
                  border: '1px solid var(--border-hover)',
                  color: 'var(--text-muted)',
                }}>{line.basis}</span>
                <span style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.65 }}>
                  {line.text}
                </span>
              </div>
            ))}
          </div>

          {/* ── 부위별 8주 ──
              **순위를 보여주는 자리지 양을 재는 자리가 아니다.** 그래서 막대는
              부위 중 가장 많은 것을 가득으로 두고 서로 견주기만 한다 */}
          <div className="card">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 11 }}>
              8주 세트 — 적은 곳부터
            </div>
            {read.parts.map((p) => (
              <div key={p.part} style={{ marginBottom: 11 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12.5, marginBottom: 5,
                  color: p.part === read.least.part ? 'var(--accent)' : 'var(--text-secondary)',
                }}>
                  <span>{p.part}</span>
                  <span>
                    {p.sets}세트
                    {/* 지난 달의 나와 견준 것. 앞 4주가 비어 있으면(`new`) 화살표를
                        안 붙인다 — 0 에서 는 것은 「늘었다」가 아니라 시작한 것이다 */}
                    {p.dir === 'up' && <span style={{ color: 'var(--text-muted)' }}> · 지난 4주 늘어남</span>}
                    {p.dir === 'down' && <span style={{ color: 'var(--text-muted)' }}> · 지난 4주 줄어듦</span>}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: maxSets > 0 ? `${Math.round((p.sets / maxSets) * 100)}%` : '0%',
                    background: p.part === read.least.part ? 'var(--accent)' : 'var(--border-hover)',
                    borderRadius: 3,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── 꼭 적는 것 ──
          진단이 아니다. 그리고 **여기가 아직 무엇을 안 보는지** 밝힌다 —
          「체형」이라는 이름을 달고 사진을 안 보면, 안 밝히면 속인 것이 된다 */}
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.75, marginTop: 14 }}>
        적어둔 세트와 인바디로만 말해요. <b>사진은 아직 안 봅니다.</b><br />
        진단이 아니고, 견주는 상대는 <b>지난 달의 나</b>예요.
      </div>
    </div>
  );
}
