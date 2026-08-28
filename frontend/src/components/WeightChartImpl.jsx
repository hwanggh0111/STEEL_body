import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART, AXIS_TICK, TOOLTIP_STYLE } from '../data/chartColors';

export default function WeightChart({ records }) {
  const data = [...records]
    .reverse()
    .map(r => ({ date: r.date.slice(5), weight: r.weight }));

  if (data.length < 2) return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13, fontFamily: 'Barlow' }}>
      인바디 기록이 2개 이상 있어야 차트가 표시돼요
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={AXIS_TICK} />
        <YAxis tick={AXIS_TICK} domain={['auto', 'auto']} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Line type="monotone" dataKey="weight" stroke={CHART.accent} strokeWidth={2} dot={{ fill: CHART.accent, r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
