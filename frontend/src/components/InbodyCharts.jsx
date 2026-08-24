import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

// 인바디 화면의 그래프들.
//
// recharts 는 이 앱에서 제일 무거운 덩어리다(gzip 110KB). InbodyPage 가 위에서 그냥
// import 하고 있어서, 인바디에 들어가면 그 덩어리를 다 받을 때까지 입력 폼도 기록 목록도
// 안 그려졌다. 그래프만 따로 떼어 나중에 받는다.

const AXIS_TICK = { fill: 'var(--text-muted)', fontSize: 11 };
const TOOLTIP_STYLE = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  fontSize: 13,
};

// 체성분 비율 — 도넛 + 범례
export function CompositionChart({ data, total }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={105}
            paddingAngle={3}
            dataKey="value"
            label={({ name, value }) => `${name} ${value}kg`}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [`${value}kg`, name]} />
        </PieChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
        {data.map((entry, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {entry.name} {entry.value}kg{total ? ` (${(entry.value / total * 100).toFixed(1)}%)` : ''}
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
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={AXIS_TICK} />
        <YAxis tick={AXIS_TICK} domain={['auto', 'auto']} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Line type="monotone" dataKey="체중" stroke="#ff6b1a" strokeWidth={2} dot={{ fill: '#ff6b1a', r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// 체지방 / 골격근 변화 — 값이 있는 선만 그린다
export function BodyTrend({ data }) {
  const hasFat = data.some(d => d.체지방 != null);
  const hasMuscle = data.some(d => d.골격근 != null);
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={AXIS_TICK} />
        <YAxis tick={AXIS_TICK} domain={['auto', 'auto']} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend formatter={(v) => <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{v}</span>} />
        {hasFat && <Line type="monotone" dataKey="체지방" stroke="#e84040" strokeWidth={2} dot={{ fill: '#e84040', r: 3 }} />}
        {hasMuscle && <Line type="monotone" dataKey="골격근" stroke="#3a9e3a" strokeWidth={2} dot={{ fill: '#3a9e3a', r: 3 }} />}
      </LineChart>
    </ResponsiveContainer>
  );
}
