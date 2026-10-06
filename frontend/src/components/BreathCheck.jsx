import { useEffect } from 'react';
import { useBreath } from '../data/useBreath';
import { breathLabel } from '../data/breathRest';
import { senseOf } from '../store/settingsStore';

// 「지금 잡히나」 — 설정함에서 **숨을 한 번 쉬어 보는 자리** (2026-09-22).
//
// ── 왜 필요한가 ──
//
// 마이크는 **켜봐야 되는지 안다.** 방이 시끄러운지, 권한이 막혀 있는지, 이 폰이
// 숨을 잡는지는 실제로 들어봐야 알 수 있다. 그런데 여태 확인하려면 **홈트를 시작해
// 45초를 버텨야** 했다 — 그 첫 휴식에 가서야 파형이 나왔다.
//
// 만든 사람도 그래서 확인을 못 했다. 여기서 숨 한 번이면 끝난다.
//
// ── 여기서 재는 것은 저장 안 한다 ──
//
// 기준선도, 파형도 이 화면을 떠나면 버린다. **실제 판에서는 그때 다시 잰다** —
// 방이 달라지고 폰 자리가 달라지면 기준선도 달라진다. 여기서 잰 것을 들고 가면
// 그것이 오히려 틀린다.
export default function BreathCheck({ sense }) {
  const th = senseOf(sense);
  const breath = useBreath(th);

  // **화면을 떠나면 반드시 끈다.** 설정을 보다가 나갔는데 마이크가 켜져 있으면
  // 그것만으로 이 기능을 못 믿게 된다 (`useBreath` 도 스스로 끄지만, 여기서
  // 한 번 더 끄는 것이 눈에 보이는 약속이다)
  useEffect(() => () => breath.stop(), []);   // eslint-disable-line react-hooks/exhaustive-deps

  const bars = breath.history.slice(-16);
  const top = Math.max(0.02, ...bars);
  // 고른 예민도로 지금 숨이 어느 쪽인지 — 설정을 바꾸면 **여기서 바로 달라진다**
  const ratio = breath.base && breath.level ? breath.level / Math.max(breath.base, 0.004) : 0;
  const state = !breath.base ? null : ratio >= th.up ? 'high' : ratio >= th.mid ? 'mid' : 'calm';

  return (
    <div style={{
      marginTop: 11, padding: '11px 12px', borderRadius: 8,
      border: '1px solid var(--border-hover)', background: 'var(--bg-tertiary)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 11, letterSpacing: 1.6,
          color: breath.on ? 'var(--info)' : 'var(--text-muted)',
        }}>
          {breath.on && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--info)',
              boxShadow: '0 0 0 3px rgba(127,168,217,0.16)',
            }} />
          )}
          지금 잡히나
        </span>
        <button
          onClick={() => (breath.on ? breath.stop() : breath.start())}
          className="btn-secondary"
          style={{ width: 'auto', padding: '5px 12px', fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer' }}
        >{breath.on ? '멈추기' : '들어보기'}</button>
      </div>

      {!breath.on && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          눌러서 숨을 한 번 쉬어보세요. <b>여기서 잰 것은 저장하지 않아요</b> —
          실제로 운동할 때 그 자리에서 다시 잽니다.
        </div>
      )}

      {breath.on && breath.phase !== 'ready' && (
        <div style={{
          fontSize: 11.5, lineHeight: 1.6,
          color: breath.phase === 'blocked' ? 'var(--warning)' : 'var(--text-muted)',
        }}>
          {breath.phase === 'asking' && '마이크를 여는 중이에요…'}
          {breath.phase === 'calibrating' && '조용한 소리를 재는 중이에요 — 잠깐만요.'}
          {breath.phase === 'blocked' && breath.why}
        </div>
      )}

      {breath.on && breath.phase === 'ready' && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 30 }} aria-hidden="true">
            {bars.map((v, i) => (
              <span key={i} style={{
                flex: 1, borderRadius: 1,
                height: `${Math.max(8, Math.round((v / top) * 100))}%`,
                background: state === 'calm' ? 'var(--info)' : 'var(--accent)',
                opacity: state === 'calm' ? 0.4 : 0.85,
              }} />
            ))}
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            fontSize: 11, color: 'var(--text-muted)', marginTop: 7,
          }}>
            <span>조용할 때 ──</span>
            {/* **숫자를 안 적는다.** 잰 값을 보여주면 그것이 점수처럼 읽힌다 */}
            <span style={{ color: state === 'calm' ? 'var(--text-muted)' : 'var(--accent)' }}>
              {breathLabel(state) || '듣는 중…'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 8 }}>
            숨을 크게 쉬면 금색이 되어야 맞아요. 아무리 쉬어도 안 변하면
            <b> 예민하게</b>로 바꿔보세요.
          </div>
        </>
      )}
    </div>
  );
}
