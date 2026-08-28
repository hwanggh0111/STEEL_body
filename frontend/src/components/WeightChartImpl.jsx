import { CHART } from '../data/chartColors';
import LineChart from './charts/LineChart';

// 히스토리 화면의 체중 그래프. 인바디 기록을 옛것부터 늘어놓는다
export default function WeightChart({ records }) {
  const data = [...records].reverse().map(r => ({ date: r.date.slice(5), weight: r.weight }));

  if (data.length < 2) return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13, fontFamily: 'Barlow' }}>
      인바디 기록이 2개 이상 있어야 차트가 표시돼요
    </div>
  );

  return (
    <LineChart data={data} xKey="date" unit="kg"
      series={[{ key: 'weight', label: '체중', color: CHART.accent }]} />
  );
}
