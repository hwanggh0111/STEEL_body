import { changeOf, diffLabel, sinceLabel } from '../../data/measureChange';

// 「지난번과 견주면」 — 전신 사이즈와 유연성이 같이 쓴다.
//
// **몸에는 좋고 나쁨을 매기지 않는다** (8/25 에 정했다). 허리가 늘었다고 「나쁨」이라
// 하지 않는다. **늘어난 것과 줄어든 것만** 색으로 나눈다 — 비교 화면과 같은 규칙이다.
//
// 체력 테스트는 이걸 안 쓴다. 거기는 **기록**이라 최고를 말하고, 좋아진 쪽을 따로 칠한다.
export default function ChangeSummary({ records, fields }) {
  if (!records || records.length < 2) return null;
  const rows = fields
    .map((f) => ({ f, ch: changeOf(records, f.key) }))
    .filter(({ ch }) => ch && ch.prev !== null);
  // 견줄 것이 하나도 없으면 빈 카드를 남기지 않는다
  if (rows.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 8 }}>
        지난번과 견주면
      </div>
      {rows.map(({ f, ch }) => (
        <div key={f.key} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{f.label}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {ch.prev}{f.unit} &#8594; <b style={{ color: 'var(--text-primary)' }}>{ch.last}{f.unit}</b>
            <b style={{
              marginLeft: 8,
              color: ch.diff > 0 ? 'var(--accent)' : ch.diff < 0 ? 'var(--info)' : 'var(--text-muted)',
            }}>{diffLabel(ch.diff, f.unit)}</b>
            {ch.days ? <span style={{ marginLeft: 6 }}>{sinceLabel(ch.days)}</span> : null}
          </span>
        </div>
      ))}
      {/* 색만 다르게 칠해두면 사람은 그 색을 점수로 읽는다. 아니라고 적어둔다 */}
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.7 }}>
        늘고 줆에 좋고 나쁨을 매기지 않습니다. 무엇이 어느 쪽으로 갔는지만 적어요.
      </div>
    </div>
  );
}
