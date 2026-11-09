import { useMemo, useState } from 'react';
import SegRow from './SegRow';
import LineChart from './charts/LineChart';
import { CHART } from '../data/chartColors';
import {
  SPANS, MIN_POINTS, METRICS, cardioTrend, metricRows, metricsWith,
  cardioLine, cardioPeak, weekLabel,
} from '../data/cardioTrend';

// **유산소가 쌓여온 길** (2026-11-09) — 「기록 → 통계」.
//
// 위의 두 선은 **무게**를 본다. 그래서 둘 다 머리글에 「유산소는 뺐습니다」라고
// 적혀 있고, 매일 런닝머신만 걷는 사람에게 통계는 빈 화면이었다. 11/05 에 시간·거리
// 칸을 줬으니(`data/cardio.js`) 그것이 **모이는 그림**을 여기 둔다.
//
// **계산은 `data/cardioTrend.js` 가 한다.** 여기는 고르고 그리기만 한다 — 왜 시간과
// 거리를 한 축에 겹치지 않는지 · 왜 시간만 적은 주가 거리 선에 없는지(0km 달린 것이
// 아니다) · 왜 이번 주를 선에 안 넣는지를 그 파일에 적어뒀다.
// `npm run cardiotrend` 가 그 계산을 값으로 본다.
//
// **그릴 것이 없으면 아무것도 안 그린다** — 빈 카드를 하나 더 세우지 않는다
// (`LiftTrend` · `PartTrend` 와 같은 선).
export default function CardioTrend({ workouts, today }) {
  const [span, setSpan] = useState('6m');
  const [pick, setPick] = useState(null);
  const spanOf = SPANS.find((s) => s.key === span) || SPANS[1];

  const trend = useMemo(
    () => cardioTrend(workouts, { today, days: spanOf.days }),
    [workouts, today, spanOf.days],
  );

  // 창을 넓히면 **온 기간**의 유산소가 있는지 본다 — 기간 칩 안이 비었다고 카드를
  // 걷어버리면, 「3개월」을 골라둔 사람에게 유산소 그림이 **사라진 것처럼** 보인다
  const everAny = useMemo(
    () => metricsWith(cardioTrend(workouts, { today }).rows).length > 0,
    [workouts, today],
  );

  const metrics = metricsWith(trend.rows);
  // 고른 자가 사라질 수 있다 (거리 적은 기록을 지웠을 때). 맨 앞으로 되돌린다
  const metric = metrics.find((m) => m.key === pick) || metrics[0] || METRICS[0];

  if (!everAny && !trend.current) return null;

  const rows = metricRows(trend.rows, metric.key);
  const line = cardioLine(trend.rows, spanOf.label, metric.key);
  const peak = cardioPeak(trend.rows, metric.key);
  const now = trend.current;
  // `LineChart` 는 `{ [key]: 값 }` 꼴을 받는다. x 는 **주 이름**이다
  const data = rows.map((r) => ({ week: weekLabel(r.week), [metric.series]: r.value }));

  return (
    <>
      <div className="section-title">
        <div className="accent-bar" />
        유산소가 쌓여온 길
      </div>

      <div className="card" style={{ marginBottom: 24, padding: 12 }}>
        <SegRow
          items={SPANS.map((s) => ({ key: s.key, label: s.label }))}
          value={span}
          onChange={setSpan}
          ariaLabel="얼마 동안"
        />

        {/* ★ **시간과 거리를 한 축에 겹치지 않는다** — 「30분」과 「5.2km」를 한 그림에
            올리면 거리 선이 바닥에 눌려 평평해 보인다. 자가 하나뿐이면 고를 것이 없다 */}
        {metrics.length > 1 && (
          <SegRow
            items={metrics.map((m) => ({ key: m.key, label: m.label }))}
            value={metric.key}
            onChange={setPick}
            ariaLabel="무엇으로 볼까"
          />
        )}

        {rows.length < MIN_POINTS ? (
          // **빈 그래프를 그리지 않는다.** 점이 하나면 선이 아니고, 그 사실을
          // 말해주는 쪽이 맞다 — 기간을 넓히면 보일 수 있다
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, padding: '6px 2px 2px' }}>
            {spanOf.label} 안에 유산소 <b style={{ color: 'var(--text-secondary)' }}>{metric.label}</b> 기록이
            {rows.length === 0 ? ' 없어요' : ' 한 주뿐이에요'} — 기간을 넓혀보세요.
            {now && (now[metric.key] !== null) && (
              <>
                <br />
                이번 주에는 {metric.fmt(now[metric.key])} 했어요.
              </>
            )}
          </div>
        ) : (
          <>
            <LineChart
              data={data}
              xKey="week"
              unit={metric.unit}
              series={[{ key: metric.series, label: `주마다 ${metric.label}`, color: CHART.accent }]}
            />
            {/* 한 줄로 읽어준다. **꺾였으면 꺾인 그대로 적는다** */}
            {line && (
              <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text-secondary)' }}>
                {line.text}
                {line.dir > 0 && <span style={{ color: 'var(--success)' }}> 늘었어요</span>}
              </div>
            )}
            {peak && (
              <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--text-muted)' }}>
                가장 많이 한 주 {weekLabel(peak.week)} · {metric.fmt(peak.value)}
              </div>
            )}
            {/* **이번 주는 선에 없다** — 안 끝난 주를 찍으면 늘 마지막이 꺾여 보인다 */}
            {now && now[metric.key] !== null && (
              <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--text-muted)' }}>
                이번 주는 아직 안 끝나서 선에 안 넣었어요 — 지금까지 {metric.fmt(now[metric.key])}
              </div>
            )}
            {/* **안 한 주는 점이 없다**(0 을 찍지 않는다). 거리 쪽은 한 걸음 더 —
                런닝머신은 거리를 안 적어도 되므로, 시간만 적은 주는 거리 선에 없다 */}
            <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {metric.key === 'km'
                ? '주마다 달린 거리를 더했어요. 거리를 안 적은 주는 0km 가 아니라서 선에서 비웠습니다.'
                : '주마다 들인 시간을 더했어요. 안 한 주는 0분이 아니라서 선을 끊었습니다.'}
            </div>
          </>
        )}
      </div>
    </>
  );
}
