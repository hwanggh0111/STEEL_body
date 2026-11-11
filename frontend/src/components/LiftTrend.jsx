import { useMemo, useState } from 'react';
import SegRow from './SegRow';
import LineChart from './charts/LineChart';
import { CHART } from '../data/chartColors';
import { SPANS, MIN_POINTS, liftNames, trendOf, trendLine, peakOf } from '../data/liftTrend';
import { plateauOf, plateauLine } from '../data/plateau';

// **한 운동이 늘어온 길** (2026-11-03) — 「기록 → 통계」.
//
// 통계가 보여주던 것은 **숫자 하나**였다(최고 기록 92.5kg). 이 앱 홈페이지의 첫 줄이
// 「무게는 늘었는데 **무엇이** 늘었는지는 아무도 안 알려준다」인데, 그 말의 운동 쪽
// 짝이 비어 있었다 — **내 벤치가 반년 동안 어떻게 왔는지**를 보는 자리가 없었다.
//
// **계산은 `data/liftTrend.js` 가 한다.** 여기는 고르고 그리기만 한다 —
// 그 파일에 왜 1RM 으로 환산하지 않는지(지어내지 않는다) · 왜 맨몸 운동은 선이
// 없는지 적어뒀다. `npm run data` 가 그 계산을 값으로 본다.
//
// **그릴 것이 없으면 아무것도 안 그린다.** 「선을 그릴 운동이 없어요」를 띄우는 것은
// 통계 갈래에 빈 카드를 하나 더 세우는 일이다 — 기록이 쌓이면 저절로 나타난다.
export default function LiftTrend({ workouts, today }) {
  const names = useMemo(() => liftNames(workouts, today), [workouts, today]);
  const [pick, setPick] = useState(null);
  const [span, setSpan] = useState('6m');

  // 고른 것이 목록에서 사라질 수 있다 (기간을 좁히거나 기록을 지웠을 때).
  // 그때는 맨 앞(제일 자주 한 운동)으로 되돌린다 — 빈 그래프를 들고 있지 않는다
  const name = names.includes(pick) ? pick : names[0];
  const days = (SPANS.find((s) => s.key === span) || SPANS[1]).days;
  const label = (SPANS.find((s) => s.key === span) || SPANS[1]).label;

  const points = useMemo(
    () => (name ? trendOf(workouts, name, { today, days }) : []),
    [workouts, name, today, days],
  );

  // **제자리인가**는 고른 기간이 아니라 **기록 전체**로 본다 — 「3개월」을 보고
  // 있다고 해서 넉 달째 안 오른 사실이 바뀌지 않는다. 기간을 좁혔다고 「제자리가
  // 아니게」 되면 그 글은 창을 움직일 때마다 말을 바꾼다 (`plateau.js` 머리글)
  const flat = useMemo(
    () => (name ? plateauOf(workouts, name, today) : null),
    [workouts, name, today],
  );

  if (names.length === 0) return null;

  const line = trendLine(points, label);
  const peak = peakOf(points);
  // 셈이 지은 말. **두 번 부르지 않는다** — 있나 보는 데 한 번, 적는 데 한 번이었다
  const flatLine = plateauLine(flat);
  // `LineChart` 는 `{ [key]: 값 }` 꼴을 받는다. 축 이름은 운동 이름이 아니라
  // 「무게」다 — 운동 이름은 위의 고르는 줄이 이미 말하고 있다
  // ── **같은 그림에 두 화면이 다른 길이의 날짜를 넘겼다** ── (2026-11-11)
  //
  // 인바디 화면은 `r.date.slice(5)`(`10-03`)로 줄여 넘기는데 여기는 날짜 키를
  // **통째로**(`2026-10-03`) 넘겼다. 축의 날짜 자리는 **46px 간격**으로 잡혀 있고
  // (`charts/useWidth.js` 의 `labelEvery` 기본값) 10px 글씨로 열 글자는 그만큼을
  // 꽉 채운다 — 좁은 폰에서 옆 날짜와 **맞닿는다.**
  //
  // 자(`check-data.cjs` 의 겹침 검사)가 이것을 못 본 까닭은 **거기 넣는 날짜가
  // `08-14`(다섯 글자)** 라서다. 짧은 글자로 재면 겹칠 일이 없다.
  //
  // 해는 위의 「가장 무거웠던 날」 줄이 날짜를 통째로 적어주고, 짚으면 말풍선도
  // 그 날짜를 적는다 — 축은 **달·일**이면 된다.
  const data = points.map((p) => ({ date: p.date.slice(5), 무게: p.kg }));

  return (
    <>
      <div className="section-title">
        <div className="accent-bar" />
        늘어온 길
      </div>

      {/* 운동 고르기. 하나뿐이면 고를 것이 없으니 줄을 안 그린다 */}
      {names.length > 1 && (
        <SegRow
          items={names.map((n) => ({ key: n, label: n }))}
          value={name}
          onChange={setPick}
          ariaLabel="어느 운동을 볼까"
        />
      )}

      <div className="card" style={{ marginBottom: 24, padding: 12 }}>
        <SegRow
          items={SPANS.map((s) => ({ key: s.key, label: s.label }))}
          value={span}
          onChange={setSpan}
          ariaLabel="얼마 동안"
        />

        {points.length < MIN_POINTS ? (
          // **빈 그래프를 그리지 않는다.** 점이 하나면 선이 아니고, 그 사실을
          // 말해주는 쪽이 맞다 — 기간을 넓히면 보일 수 있다
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, padding: '6px 2px 2px' }}>
            {label} 안에 <b style={{ color: 'var(--text-secondary)' }}>{name}</b> 기록이
            {points.length === 0 ? ' 없어요' : ' 한 번뿐이에요'} — 기간을 넓혀보세요.
          </div>
        ) : (
          <>
            <LineChart
              data={data}
              xKey="date"
              unit="kg"
              series={[{ key: '무게', label: name, color: CHART.accent }]}
            />
            {/* 한 줄로 읽어준다. **꺾였으면 꺾인 그대로 적는다** — 그래프와 글이
                다른 말을 하면 글을 안 믿게 된다 (`trendLine` 머리글) */}
            {line && (
              <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text-secondary)' }}>
                {line.text}
                {line.dir !== 0 && (
                  <span style={{ color: line.dir > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                    {line.dir > 0 ? 'kg 올랐어요' : 'kg'}
                  </span>
                )}
              </div>
            )}
            {/* ── **한 줄에 사실과 설명을 같이 넣으면 좁은 폰에서 뭉친다** ── (2026-11-11)
                「가장 무거웠던 날 2026-10-03 · 92.5kg · 그 날 든 가장 무거운 무게로
                그렸어요」는 접은 폴더블(280px)에서 11.5px 흐린 글씨 **석 줄**이 되고,
                그 아래 제자리 상자와 뭉쳐 어디까지가 한 말인지 끊기지 않는다.
                **사실 한 줄 · 그린 법 한 줄**로 끊는다 — 그린 법은 더 뒤로 물린다
                (`--text-faint` 는 「있다는 것만 알리는」 자리다). */}
            {peak && (
              <>
                <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--text-muted)' }}>
                  가장 무거웠던 날 {peak.date} · {peak.kg}kg
                </div>
                <div style={{ fontSize: 11, marginTop: 2, color: 'var(--text-faint)' }}>
                  그 날 든 가장 무거운 무게로 그렸어요
                </div>
              </>
            )}
            {/* **몇 주째 제자리인가** (2026-11-11). 선이 평평한 것을 **사람이 읽게**
                두지 않는다 — 다만 늘고 있으면 아무 말도 안 하고(`plateauLine` 이
                `null` 을 준다), 쉰 것은 「제자리」라고 부르지 않는다. 판정도 꾸중도
                아니고 **사실 한 줄**이다 */}
            {/* 꼴은 `.trend-note` 한 자리에 있다 (2026-11-11) — **색 하나로만**
                제자리와 쉼을 가르고 있어서(금빛 ↔ 흐림) 색을 잘 못 가리는 사람과
                햇빛 아래에서는 같은 상자였다. 왼쪽 금색 선을 더해 **색이 안 보여도**
                갈리게 했다. 모서리를 안 굴리는 것도 거기 적혀 있다.
                ★ 말은 셈이 짓는다 — `plateauLine` 을 **한 번만** 부른다 */}
            {flatLine && (
              <div className={`trend-note${flat.kind === 'flat' ? ' is-flat' : ''}`}>
                {flatLine}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
