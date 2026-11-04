import { CHART } from '../data/chartColors';
import LineChart from './charts/LineChart';
import Donut from './charts/Donut';

// 인바디 화면의 그래프들.
//
// 2026-08-28 에 recharts 를 걷어내고 직접 그린다. 그래프 다섯 장 때문에 받던
// 덩어리가 gzip 100KB 였다 — 인바디에 들어가면 그것부터 받았다.
// 그리는 것은 `components/charts/` 에 있다.

// 체성분 비율 — 도넛 + 범례
//
// **셈은 `data/composition.js` 가 한다** (2026-11-04). 여기는 그리기만 한다 —
// 왜 체수분이 조각이 아닌지(골격근 안에 이미 들어 있다) · 왜 퍼센트가 체중 기준인지
// (사람이 적어 넣은 체지방률과 같아야 한다)를 그 파일에 적어뒀다.
// `npm run composition` 이 그 셈을 값으로 본다.
export function CompositionChart({ composition }) {
  const parts = Array.isArray(composition?.parts) ? composition.parts : [];
  const total = composition?.total ?? null;
  const water = composition?.water ?? null;
  const over = composition?.over ?? 0;
  return (
    <>
      <Donut data={parts} total={total} height={260} />
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
        {parts.map((entry, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {entry.name} {entry.value}kg{entry.pct != null ? ` (${entry.pct}%)` : ''}
            </span>
          </div>
        ))}
      </div>
      {/* **체수분은 조각에서 뺐다고 말한다.** 숨기는 것이 아니라, 겹치는 것을
          겹친다고 적는다 — 근육의 70%쯤이 물이라 조각으로 또 넣으면 이중 계산이다 */}
      {water != null && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8, lineHeight: 1.6 }}>
          체수분 {water}L 은 골격근·체지방 안에 들어 있어서 이 그림에서는 뺐어요
        </div>
      )}
      {/* 골격근 + 체지방이 체중을 넘었다 — 조용히 기타만 빼면 「내 뼈는 0kg 인가」가 된다 */}
      {over > 0 && (
        <div style={{ fontSize: 11, color: 'var(--danger)', textAlign: 'center', marginTop: 6, lineHeight: 1.6 }}>
          골격근과 체지방을 더하면 체중보다 {over}kg 많아요 — 적은 값을 한 번 봐주세요
        </div>
      )}
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
