import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
        <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} domain={['auto', 'auto']} />
        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
