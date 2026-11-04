import { useMemo, useState } from 'react';
import SegRow from './SegRow';
import LineChart from './charts/LineChart';
import { CHART } from '../data/chartColors';
import {
  SPANS, MIN_POINTS, volumeParts, volumeTrend, volumeLine, volumePeak, weekLabel,
} from '../data/partVolume';

// **한 부위가 늘어온 길** (2026-11-04) — 「기록 → 통계」.
//
// 어제 붙인 선(`LiftTrend`)은 **운동 하나**의 최고 무게를 본다. 기구를 바꾸면 선이
// 끊긴 것처럼 보이고, 「가슴을 덜 하게 된 것인지」는 그 선으로 모른다. 여기는
// **그 부위에 주마다 들인 총량**이다 — 기구를 바꿔도 이어진다.
//
// **계산은 `data/partVolume.js` 가 한다.** 여기는 고르고 그리기만 한다 —
// 왜 맨몸·유산소를 빼는지(지어내지 않는다) · 왜 이번 주를 선에 안 넣는지(안 끝난
// 주는 늘 꺾여 보인다) · 주가 왜 월요일에 시작하는지를 그 파일에 적어뒀다.
// `npm run volume` 이 그 계산을 값으로 본다.
//
// **그릴 것이 없으면 아무것도 안 그린다** — 빈 카드를 하나 더 세우지 않는다
// (`LiftTrend` 와 같은 선). 기록이 쌓이면 저절로 나타난다.
export default function PartTrend({ workouts, today }) {
  const parts = useMemo(() => volumeParts(workouts, today), [workouts, today]);
  const [pick, setPick] = useState(null);
  const [span, setSpan] = useState('6m');

  // 고른 것이 목록에서 사라질 수 있다 (기록을 지웠을 때).
  // 그때는 맨 앞으로 되돌린다 — 빈 그래프를 들고 있지 않는다
  const part = parts.includes(pick) ? pick : parts[0];
  const spanOf = SPANS.find((s) => s.key === span) || SPANS[1];

  const trend = useMemo(
    () => (part ? volumeTrend(workouts, part, { today, days: spanOf.days }) : { rows: [], current: null }),
    [workouts, part, today, spanOf.days],
  );

  if (parts.length === 0) return null;

  const rows = trend.rows;
  const line = volumeLine(rows, spanOf.label);
  const peak = volumePeak(rows);
  // `LineChart` 는 `{ [key]: 값 }` 꼴을 받는다. x 는 **주 이름**이다 —
  // 부위 이름은 위의 고르는 줄이 이미 말하고 있다
  const data = rows.map((r) => ({ week: weekLabel(r.week), 볼륨: r.kg }));

  return (
    <>
      <div className="section-title">
        <div className="accent-bar" />
        부위가 늘어온 길
      </div>

      {/* 부위 고르기. 하나뿐이면 고를 것이 없으니 줄을 안 그린다 */}
      {parts.length > 1 && (
        <SegRow
          items={parts.map((p) => ({ key: p, label: p }))}
          value={part}
          onChange={setPick}
          ariaLabel="어느 부위를 볼까"
        />
      )}

      <div className="card" style={{ marginBottom: 24, padding: 12 }}>
        <SegRow
          items={SPANS.map((s) => ({ key: s.key, label: s.label }))}
          value={span}
          onChange={setSpan}
          ariaLabel="얼마 동안"
        />

        {rows.length < MIN_POINTS ? (
          // **빈 그래프를 그리지 않는다.** 점이 하나면 선이 아니고, 그 사실을
          // 말해주는 쪽이 맞다 — 기간을 넓히면 보일 수 있다
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, padding: '6px 2px 2px' }}>
            {spanOf.label} 안에 <b style={{ color: 'var(--text-secondary)' }}>{part}</b> 기록이
            {rows.length === 0 ? ' 없어요' : ' 한 주뿐이에요'} — 기간을 넓혀보세요.
            {trend.current && (
              <>
                <br />
                이번 주에는 {trend.current.kg.toLocaleString()}kg 들였어요.
              </>
            )}
          </div>
        ) : (
          <>
            <LineChart
              data={data}
              xKey="week"
              unit="kg"
              series={[{ key: '볼륨', label: part, color: CHART.accent }]}
            />
            {/* 한 줄로 읽어준다. **꺾였으면 꺾인 그대로 적는다** — 그래프와 글이
                다른 말을 하면 글을 안 믿게 된다 (`volumeLine` 머리글) */}
            {line && (
              <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text-secondary)' }}>
                {line.text}
                {line.dir > 0 && <span style={{ color: 'var(--success)' }}> 늘었어요</span>}
              </div>
            )}
            {peak && (
              <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--text-muted)' }}>
                가장 많이 들인 주 {weekLabel(peak.week)} · {peak.kg.toLocaleString()}kg
              </div>
            )}
            {/* **이번 주는 선에 없다.** 안 끝난 주를 점으로 찍으면 늘 마지막이
                꺾여 보인다 — 그래서 수만 따로 말해준다 */}
            {trend.current && (
              <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--text-muted)' }}>
                이번 주는 아직 안 끝나서 선에 안 넣었어요 — 지금까지 {trend.current.kg.toLocaleString()}kg
              </div>
            )}
            {/* **뺀 것을 말한다.** 무게가 없는 것을 1kg 으로 치면 지어내는 셈이다 —
                푸시업 40회는 횟수로 말해야 하는데 그것은 다른 그림이다 */}
            <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              무게 × 세트 × 횟수를 주 단위로 더했어요. 맨몸 · 유산소는 무게가 없어서 이 선에서 뺐습니다.
            </div>
          </>
        )}
      </div>
    </>
  );
}
