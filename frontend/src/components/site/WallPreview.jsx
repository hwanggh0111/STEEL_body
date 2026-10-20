// 1년 기록 벽 **미리보기** — 홈페이지(`/site`)에서 쓴다 (2026-10-20).
//
// ── 왜 만들었나 ──
//
// 「한 해를 금속판 열두 장에 새긴다. 무겁게 든 날일수록 깊다」는 이 앱에서 가장
// 자기다운 말인데, 홈페이지는 그것을 **글로만** 적어뒀다. 이 앱에서 그림이 가장
// 좋은 둘(결산 · 기록의 벽)을 **안 보여주고 설명하고 있었다.**
//
// ── 계산은 앱의 것이고, **받는 것은 숫자뿐이다** ──
//
// 스크린샷은 올리지 않는다(10/6 판단) — 그림을 올려두면 화면을 고칠 때마다 옛말이
// 된다. 그래서 각인 깊이를 **앱의 계산**(`data/yearWall.js` 의 `buildYear`)으로 낸다.
//
// 그런데 그 계산을 **화면에서** 부르면 조각이 공개 첫 화면에 딸려 온다. 재보니
// `yearWall + weeklyReport + personalRecord + bodyPart` 로 **7.2KB(gzip)** 였고,
// /site 첫 화면이 7.3KB → **15.1KB** 가 됐다 (`bodyPart` 가 4.6KB 다 — 운동 이름을
// 부위로 옮기는 표가 거기 있다). **예시 판 열둘을 그리려고 그 표를 받는 셈**이다.
// 오늘 아침에 운동 사전 10.2KB 를 첫 화면에서 떼어낸 것과 똑같은 모양이다.
//
// 그래서 **빌드할 때 한 번 계산해 숫자만 적어둔다**(`scripts/gen-wall.mjs` →
// `data/sitePlates.json`, 0.2KB). 규칙이 바뀌면 다음 빌드에서 다시 계산되고,
// 어긋나면 `npm run nav` 가 **다시 뽑아 견줘서** 잡는다 (`feedList.json` 과 같은 방식).
//
// 여기 남는 일은 **그리기**뿐이다 — 깊이(0~1)를 높이와 진하기로 바꾼다.
//
// ── 예시라고 적는다 ──
//
// 남의 기록을 내 것처럼 보이게 하면 안 된다. 부르는 쪽(`SiteHome`)이 라벨 오른쪽에
// 「예시」를 박는다.
import plates from '../../data/sitePlates.json';

export default function WallPreview({ style }) {
  return (
    <div style={style}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 3 }}>
        {plates.plates.map((r, i) => (
          <div
            key={i}
            style={{
              height: 46, position: 'relative', overflow: 'hidden', borderRadius: 1,
              background: 'var(--card-bg)', border: '1px solid var(--border)',
              boxShadow: 'var(--card-edge)',
            }}
          >
            {/* 각인 — 아래에서 올라온다. 깊을수록 높고 진하다.
                **무게가 0 인 달은 아예 안 그린다** — 얕은 각인을 그리면 쉰 달이
                운동한 달처럼 보인다 */}
            {r > 0 && (
              <span style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                height: `${Math.max(12, Math.round(r * 72))}%`,
                background: 'var(--accent-low)',
                opacity: 0.22 + r * 0.34,
              }} />
            )}
          </div>
        ))}
      </div>

      {/* 벽이 쓰는 그 줄을 그대로 쓴다 — 명조 한 줄 (`YearWall` 의 첫 줄과 같은 말) */}
      <div className="serif-display" style={{ fontSize: 16, lineHeight: 1.5, marginTop: 13 }}>
        {plates.year}년 <span style={{ color: 'var(--accent)' }}>{plates.days}일</span>을<br />새겼습니다
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.8, marginTop: 8 }}>
        무겁게 든 달일수록 깊다. 가장 길게 이어진 것은 {plates.longest}일이고,
        남은 두 판은 아직 비어 있다.
      </div>
    </div>
  );
}
