import { useMemo, useState } from 'react';
import SegRow from './SegRow';
import LineChart from './charts/LineChart';
import { CHART } from '../data/chartColors';
import { SPANS, MIN_POINTS, liftNames, trendOf, trendLine, peakOf } from '../data/liftTrend';

// **한 운동이 늘어온 길** (2026-11-03) — 「기록 → 통계」.
//
// 통계가 보여주던 것은 **숫자 하나**였다(최고 기록 92.5kg). 이 앱 홈페이지의 첫 줄이
// 「무게는 늘었는데 **무엇이** 늘었는지는 아무도 안 알려준다」인데, 그 말의 운동 쪽
// 짝이 비어 있었다 — **내 벤치가 반년 동안 어떻게 왔는지**를 보는 자리가 없었다.
//
// **계산은 `data/liftTrend.js` 가 한다.** 여기는 고르고 그리기만 한다 —
// 그 파일에 왜 1RM 으로 환산하지 않는지(지어내지 않는다) · 왜 맨몸 운동은 선이
// 없는지 적어뒀다. `npm run data` 가 그 계산을 값으로 본다.
//
// **그릴 것이 없으면 아무것도 안 그린다.** 「선을 그릴 운동이 없어요」를 띄우는 것은
// 통계 갈래에 빈 카드를 하나 더 세우는 일이다 — 기록이 쌓이면 저절로 나타난다.
export default function LiftTrend({ workouts, today }) {
  const names = useMemo(() => liftNames(workouts, today), [workouts, today]);
  const [pick, setPick] = useState(null);
  const [span, setSpan] = useState('6m');

  // 고른 것이 목록에서 사라질 수 있다 (기간을 좁히거나 기록을 지웠을 때).
  // 그때는 맨 앞(제일 자주 한 운동)으로 되돌린다 — 빈 그래프를 들고 있지 않는다
  const name = names.includes(pick) ? pick : names[0];
  const days = (SPANS.find((s) => s.key === span) || SPANS[1]).days;
  const label = (SPANS.find((s) => s.key === span) || SPANS[1]).label;

  const points = useMemo(
    () => (name ? trendOf(workouts, name, { today, days }) : []),
    [workouts, name, today, days],
  );

  if (names.length === 0) return null;

  const line = trendLine(points, label);
  const peak = peakOf(points);
  // `LineChart` 는 `{ [key]: 값 }` 꼴을 받는다. 축 이름은 운동 이름이 아니라
  // 「무게」다 — 운동 이름은 위의 고르는 줄이 이미 말하고 있다
  const data = points.map((p) => ({ date: p.date, 무게: p.kg }));

  return (
    <>
      <div className="section-title">
        <div className="accent-bar" />
        늘어온 길
      </div>

      {/* 운동 고르기. 하나뿐이면 고를 것이 없으니 줄을 안 그린다 */}
      {names.length > 1 && (
        <SegRow
          items={names.map((n) => ({ key: n, label: n }))}
          value={name}
          onChange={setPick}
          ariaLabel="어느 운동을 볼까"
        />
      )}

      <div className="card" style={{ marginBottom: 24, padding: 12 }}>
        <SegRow
          items={SPANS.map((s) => ({ key: s.key, label: s.label }))}
          value={span}
          onChange={setSpan}
          ariaLabel="얼마 동안"
        />

        {points.length < MIN_POINTS ? (
          // **빈 그래프를 그리지 않는다.** 점이 하나면 선이 아니고, 그 사실을
          // 말해주는 쪽이 맞다 — 기간을 넓히면 보일 수 있다
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, padding: '6px 2px 2px' }}>
            {label} 안에 <b style={{ color: 'var(--text-secondary)' }}>{name}</b> 기록이
            {points.length === 0 ? ' 없어요' : ' 한 번뿐이에요'} — 기간을 넓혀보세요.
          </div>
        ) : (
          <>
            <LineChart
              data={data}
              xKey="date"
              unit="kg"
              series={[{ key: '무게', label: name, color: CHART.accent }]}
            />
            {/* 한 줄로 읽어준다. **꺾였으면 꺾인 그대로 적는다** — 그래프와 글이
                다른 말을 하면 글을 안 믿게 된다 (`trendLine` 머리글) */}
            {line && (
              <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text-secondary)' }}>
                {line.text}
                {line.dir !== 0 && (
                  <span style={{ color: line.dir > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                    {line.dir > 0 ? 'kg 올랐어요' : 'kg'}
                  </span>
                )}
              </div>
            )}
            {peak && (
              <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--text-muted)' }}>
                가장 무거웠던 날 {peak.date} · {peak.kg}kg
                {' · '}그 날 든 가장 무거운 무게로 그렸어요
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
