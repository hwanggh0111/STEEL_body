import { useMemo } from 'react';
import { buildYear } from '../../data/yearWall';

// 1년 기록 벽 **미리보기** — 홈페이지(`/site`)에서 쓴다 (2026-10-20).
//
// ── 왜 만들었나 ──
//
// 「한 해를 금속판 열두 장에 새긴다. 무겁게 든 날일수록 깊다」는 이 앱에서 가장
// 자기다운 말인데, 홈페이지는 그것을 **글로만** 적어뒀다. 이 앱에서 그림이 가장
// 좋은 둘(결산 · 기록의 벽)을 **안 보여주고 설명하고 있었다.**
//
// ── 스크린샷을 올리지 않는다 ──
//
// 10/6 에 몸 지도 미리보기를 만들 때 정한 것이다 — **그림을 올려두면 화면을 고칠
// 때마다 옛말이 된다.** 그래서 여기도 **계산을 앱의 것으로 한다**(`buildYear`) —
// 각인 깊이를 가르는 규칙이 바뀌면 이 미리보기도 같이 바뀐다.
//
// 다른 것은 **그리는 방식**뿐이다. 「기록」 탭의 벽은 판마다 날짜 칸 서른을 깔지만
// (한 해를 들여다보는 자리다), 여기는 **열두 판이 한 줄**이다 — 처음 온 사람에게
// 필요한 것은 「한 해가 판 열둘에 쌓인다」는 모양 하나다.
//
// ── 예시라고 적는다 ──
//
// 남의 기록을 내 것처럼 보이게 하면 안 된다. 부르는 쪽(`SiteHome`)이 라벨 오른쪽에
// 「예시」를 박는다.

// 예시 한 해. **무작위를 쓰지 않는다** — 다시 그릴 때마다 벽이 바뀌면 그림이
// 아니라 소음이다. 날짜를 규칙으로 깔고 무게도 규칙으로 올린다.
//
// 모양은 **사람이 실제로 하는 꼴**로 둔다 — 주 3~4회, 봄에 가장 무겁게,
// 여름에 한 달 쉬고, 11·12월은 비어 있다(= 지금 10월이라는 뜻).
function sampleYear(year) {
  const out = {};
  // **10월까지만** 있다 — 지금이 10월이라는 뜻이다. 남은 두 판은 비어 있어야 글과 맞는다
  for (let m = 0; m < 10; m += 1) {
    if (m === 6) continue;                       // 7월은 쉰 달
    const days = m === 2 || m === 3 ? [2, 4, 6, 9, 11, 13, 16, 18, 20, 23, 25, 27]
      : m === 9 ? [1, 3, 6, 8, 10, 13, 15]       // 10월은 아직 중간
        // 달 초에 사흘 이어서 한다 — 그래야 「가장 길게 이어진 것」이 1일이 아니다
        : [2, 3, 4, 7, 9, 12, 14, 17, 19, 22, 24, 27];
    // 무게는 달이 갈수록 조금씩 오른다 (봄에 가장 무겁고 쉬고 난 뒤엔 낮다)
    const base = m === 2 || m === 3 ? 92 : m === 7 ? 62 : 70 + m * 2;
    days.forEach((d, i) => {
      const date = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      // **칸 이름은 `weight` 다** (`kg` 가 아니다 — `weeklyReport.js` 의 `volumeOf`).
      // 처음에 `kg` 로 적어뒀더니 합계가 0 이 나와 **판 열둘이 전부 같은 깊이**였다.
      // 돌려보고 알았다 — 벽이 평평하면 「무겁게 든 달일수록 깊다」가 거짓이 된다
      out[date] = [{ weight: String(base + (i % 3) * 5), reps: 8 + (i % 2) * 2, sets: 4 }];
    });
  }
  return out;
}

export default function WallPreview({ year = 2026, style }) {
  const wall = useMemo(() => buildYear(sampleYear(year), year), [year]);

  // 판의 깊이 — **달의 무게를 그 해 가장 무거운 달로 나눈다.** 벽이 쓰는 규칙과
  // 같은 결이다(그쪽은 날 단위다). 절대값으로 자르면 사람마다 벽이 통째로 어둡다
  const maxKg = Math.max(...wall.months.map((m) => m.kg), 1);

  return (
    <div style={style}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 3 }}>
        {wall.months.map((m) => {
          const r = m.kg / maxKg;
          return (
            <div
              key={m.index}
              title={`${m.name} — ${m.count}일`}
              style={{
                height: 46, position: 'relative', overflow: 'hidden', borderRadius: 1,
                background: 'var(--card-bg)', border: '1px solid var(--border)',
                boxShadow: 'var(--card-edge)',
              }}
            >
              {/* 각인 — 아래에서 올라온다. 깊을수록 높고 진하다 */}
              {r > 0 && (
                <span style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0,
                  height: `${Math.max(12, Math.round(r * 72))}%`,
                  background: 'var(--accent-low)',
                  opacity: 0.22 + r * 0.34,
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* 벽이 쓰는 그 줄을 그대로 쓴다 — 명조 한 줄 (`YearWall` 의 첫 줄과 같은 말) */}
      <div className="serif-display" style={{ fontSize: 16, lineHeight: 1.5, marginTop: 13 }}>
        {year}년 <span style={{ color: 'var(--accent)' }}>{wall.total.days}일</span>을<br />새겼습니다
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.8, marginTop: 8 }}>
        무겁게 든 달일수록 깊다. 가장 길게 이어진 것은 {wall.total.longest}일이고,
        남은 두 판은 아직 비어 있다.
      </div>
    </div>
  );
}
