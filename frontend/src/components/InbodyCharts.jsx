import { CHART } from '../data/chartColors';
import LineChart from './charts/LineChart';
import Donut from './charts/Donut';

// 인바디 화면의 그래프들.
//
// 2026-08-28 에 recharts 를 걷어내고 직접 그린다. 그래프 다섯 장 때문에 받던
// 덩어리가 gzip 100KB 였다 — 인바디에 들어가면 그것부터 받았다.
// 그리는 것은 `components/charts/` 에 있다.

// 체성분 비율 — 도넛 + 범례
export function CompositionChart({ data, total }) {
  const parts = Array.isArray(data) ? data : [];
  const sum = parts.reduce((s, p) => s + (p?.value || 0), 0);
  return (
    <>
      <Donut data={parts} total={total} height={260} />
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
        {parts.map((entry, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {entry.name} {entry.value}kg{sum ? ` (${(entry.value / sum * 100).toFixed(1)}%)` : ''}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// 체중 변화 추이
export function WeightTrend({ data }) {
  return (
    <LineChart data={data} xKey="date" unit="kg"
      series={[{ key: '체중', label: '체중', color: CHART.accent }]} />
  );
}

// 체지방 / 골격근 변화 — 값이 있는 선만 그린다 (LineChart 가 알아서 뺀다)
export function BodyTrend({ data }) {
  return (
    <LineChart data={data} xKey="date"
      series={[
        { key: '체지방', label: '체지방', color: CHART.fat },
        { key: '골격근', label: '골격근', color: CHART.muscle },
      ]} />
  );
}
