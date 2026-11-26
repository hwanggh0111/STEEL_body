import { useMemo } from 'react';
import { useWorkoutStore } from '../store/workoutStore';
import { useToday } from '../data/useToday';
import { pushPullBalance, ratioLabel, BALANCE_DAYS } from '../data/pushPull';

// **미는 것과 당기는 것** — 치우쳤는지 본다 (2026-11-17, 시안 C 의 둘째 칸).
//
// ── 지도가 이미 하는 말은 하지 않는다 ──
//
// 시안 C 는 칸이 둘이었다. 첫 칸(「최근 4주, 어디에 몰렸나」 — 부위별 세트 막대)은
// **이미 몸 지도 안에 있다**(`BodyMap.jsx` 의 부위 여섯 줄 · `bodyHeat` 의 `sets7` ·
// `maxSets7`). 창이 최근 이레라는 것만 다르다. 같은 말을 두 자리에서 하면 **한 줄
// 만큼 본문이 좁아지고**, 두 수가 어긋나는 날 사람은 어느 쪽을 믿을지 모른다
// (이 앱이 길 줄·탭바에서 이미 정해둔 선이다). 그래서 **안 지었다.**
//
// 비어 있던 것은 **축을 묶어 보는 것**이다 — 가슴·어깨·삼두는 전부 미는 것이고
// 등·이두는 당기는 것이다. 미는 쪽만 쌓이는 것은 부위 막대 여섯으로는 눈에 안 띈다.
//
// ── 앱이 좋다 나쁘다를 말하지 않는다 ──
//
// 「1:1 이 맞다」는 말을 하지 않는다. 비율만 보여주고 **판단은 사람이** 한다 —
// 숫자에 평가를 붙이면 그것은 코치 노릇이고, 틀리면 사람이 다친다. 지도의 부위
// 막대에 적어둔 그 선과 같다(「서로 견주는 것까지가 우리가 말할 수 있는 선」).
//
// 세는 규칙과 가르는 표는 `data/pushPull.js` 에 있다 — 여기서는 그리기만 한다.
// `npm run pushpull` 이 값으로 본다.
export default function PartBalance() {
  const workouts = useWorkoutStore((s) => s.workouts);
  const today = useToday();
  const bal = useMemo(() => pushPullBalance(workouts, { today }), [workouts, today]);

  const { sets, upper, total, ratio, skipped } = bal;
  // **셀 것이 없으면 칸을 안 그린다.** 「밀기 0 · 당기기 0」은 아무 말도 아니고,
  // 빈 칸이 하나 늘면 그만큼 아래 것이 밀린다
  if (total === 0) return null;

  const 안가린줄 = skipped.other + skipped.nodict + skipped.nosplit;
  const 밀기몫 = upper > 0 ? Math.round((sets.push / upper) * 100) : 0;
  const r = ratioLabel(ratio);

  return (
    <div style={{ marginTop: 18 }}>
      <div className="label" style={{ marginBottom: 6 }}>미는 것과 당기는 것</div>

      <div className="card" style={{ padding: '14px 16px' }}>
        {/* 한 줄에 둘을 나란히 — 길이가 곧 몫이다. 수는 **세트 수**다.
            밀기가 0 이어도 띠는 그린다(당기기만 한 사람도 읽을 것이 있다) */}
        <div style={{
          display: 'flex', minHeight: 30, border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', overflow: 'hidden',
          fontFamily: "'Barlow', 'BI Sans KR', sans-serif", fontSize: 13,
        }}>
          <div style={{
            // 한쪽이 0 일 때 **글자가 든 칸이 0% 로 접히면** 글이 사라진다 —
            // `flexBasis` 는 몫으로 두고 최소 폭을 글자만큼 남긴다
            flex: `0 0 ${밀기몫}%`, minWidth: sets.push > 0 ? 72 : 0,
            background: 'linear-gradient(90deg, var(--accent-dim), var(--accent-low))',
            display: 'flex', alignItems: 'center', gap: 5, padding: sets.push > 0 ? '0 11px' : 0,
            overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--accent)',
          }}>
            {sets.push > 0 && <>밀기 <b style={{ fontWeight: 700 }}>{sets.push}</b></>}
          </div>
          <div style={{
            flex: 1, minWidth: 0, background: 'var(--bg-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5,
            padding: '0 11px', overflow: 'hidden', whiteSpace: 'nowrap',
            color: 'var(--text-secondary)',
          }}>
            {sets.pull > 0 ? <>당기기 <b style={{ fontWeight: 700 }}>{sets.pull}</b></> : '당기기 0'}
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', gap: 10,
          fontSize: 11, color: 'var(--text-muted)', marginTop: 7,
        }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            상체 <b style={{ color: 'var(--text-secondary)' }}>{upper}</b>
            {' · '}하체 <b style={{ color: 'var(--text-secondary)' }}>{sets.leg}</b>
            {' · '}코어 <b style={{ color: 'var(--text-secondary)' }}>{sets.core}</b>
          </span>
          <span style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {/* 당기기가 0 이면 **배수를 적지 않는다** — ∞ 는 수가 아니다.
                어느 쪽이 큰지는 `ratioLabel` 이 자리로 말한다(`2.5 : 1` · `1 : 2.5`) */}
            {r ? `밀기 ${r} 당기기`
              : sets.pull === 0 ? '당기는 기록이 없어요'
                : '미는 기록이 없어요'}
          </span>
        </div>
      </div>

      {/* 세는 규칙을 적는다. **무게로 세지 않는 까닭**까지 한 줄로 —
          그 줄이 없으면 「내 스쿼트가 왜 안 보이나」가 된다 */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 8 }}>
        최근 {BALANCE_DAYS / 7}주를 <b style={{ color: 'var(--text-secondary)' }}>세트 수</b>로 셉니다
        — 무게로 세면 스쿼트 한 세트가 컬 열 세트를 이겨 하체가 늘 이깁니다.
        {안가린줄 > 0 && (
          <> 미는/당기는 축으로 <b style={{ color: 'var(--text-secondary)' }}>못 가린 기록 {안가린줄}건</b>은
            어디에도 안 셌어요 — 사이드 레이즈처럼 벌리는 것, 밴드 풀어파트처럼
            기구 이름만 적힌 것, 부위를 못 알아본 것이에요.</>
        )}
        {skipped.cardio > 0 && (
          <> 유산소 {skipped.cardio}건은 축이 달라 여기 없어요.</>
        )}
      </div>
    </div>
  );
}
