// 운동 끝 결산 **미리보기** — 홈페이지(`/site`)에서 쓴다 (2026-10-20).
//
// 「마치면 오늘 들어올린 무게를 한 화면으로. 최고를 넘은 날에만 각인이 붙는다」를
// 글로만 적어두고 있었다. **이 앱에서 숫자가 가장 크게 서는 자리**인데 홈페이지에는
// 숫자가 한 자도 없었다.
//
// ── 계산을 안 베낀다 ──
//
// 결산(`SessionFinish`)은 한 판을 받아 세는 화면이다. 여기에 그 계산을 옮기면
// **두 벌이 된다.** 여기 있는 것은 **예시 숫자 셋**이고, 그 숫자가 어떻게 나왔는지는
// 앱이 말한다 — 그래서 라벨 오른쪽에 「예시」를 박는다(부르는 쪽이 박는다).
//
// 베끼는 것은 **모양**뿐이다 — 숫자는 Bebas · 자리를 맞춰 세우고(`tabular-nums`),
// 각인 한 줄만 명조로 적는다. 그 둘이 결산 화면의 결이다.
export default function FinishPreview({ style }) {
  return (
    <div style={style}>
      {/* 숫자 셋 — **자리를 맞춘다.** 1,240 과 980 의 자리가 어긋나면 표가 아니라 글이 된다 */}
      <div style={{
        display: 'flex', gap: 1, background: 'var(--border)',
        border: '1px solid var(--border)',
      }}>
        {[
          ['4,820', '오늘 들어올린 kg', false],
          ['12', '세트', false],
          ['3', '이어온 주', true],
        ].map(([n, label, gold]) => (
          <div key={label} style={{
            flex: 1, background: 'var(--bg-secondary)', padding: '12px 6px 11px', textAlign: 'center',
          }}>
            <div style={{
              fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif",
              fontSize: 24, letterSpacing: 0.6, lineHeight: 1.1,
              fontVariantNumeric: 'tabular-nums',
              color: gold ? 'var(--accent)' : 'var(--text-primary)',
            }}>{n}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 각인 — **최고를 넘은 날에만** 붙는다. 그 한 줄만 명조다 */}
      <div style={{ marginTop: 14 }}>
        <div style={{
          fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif",
          fontSize: 11.5, letterSpacing: 2.2, color: 'var(--accent-low)', marginBottom: 6,
        }}>새 최고기록</div>
        <div className="serif-display" style={{ fontSize: 16, lineHeight: 1.5 }}>
          벤치프레스 <span style={{ color: 'var(--accent)' }}>100kg · 5회</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.8, marginTop: 8 }}>
          지난 최고보다 2.5kg. 넘지 못한 날에는 이 각인이 붙지 않는다.
        </div>
      </div>
    </div>
  );
}
