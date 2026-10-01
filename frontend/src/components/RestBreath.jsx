import { useEffect, useRef, useState } from 'react';
import { useBreath } from '../data/useBreath';
import { breathLabel, extraFor } from '../data/breathRest';
import { useSettingsStore, senseOf } from '../store/settingsStore';
import { useRestTimerStore } from '../store/restTimerStore';

// 헬스장 휴식에서 숨 보고 쉬기 (2026-10-01, 시안 D).
//
// 홈트에만 있던 것을 **세트 사이 휴식에도** 붙인다. 9/29 에 설정함의
// 「홈트에서만 / 운동할 때도」가 거짓말이라 걷어낸 그 자리 — 이제는 정말로 있다.
// 설정함에도 **「헬스장 휴식에서도」라는 갈래를 새로 만들어** 적었다.
// 없는 것을 있다고 적지 않는 것과 **있는 것을 없다고 적지 않는 것**은 같은 규칙이다.
//
// ── 거드는 말이지 주인공이 아니다 ──
//
// 한 줄만 쓴다. 헬스장은 시끄러워서 **못 들을 때가 많고**, 그때는 이 줄만
// 사라진다 — 다음 세트 카드는 언제나 보인다. 그래서 「되는 날만 되는 기능」이
// 화면 전체를 흔들지 않는다.
//
// ── 마이크는 사람이 켠다 ──
//
// 설정함에서 켜 둬야 이 줄이 보이고, 보여도 **「숨 듣기」를 눌러야** 마이크가 돈다.
// 휴식이 끝나면 끈다. 쉬는 동안만 듣는다.
//
// ── 언제 더 주나 ──
//
// **휴식이 끝나려 할 때 한 번 본다.** 그때까지도 숨이 올라있으면 몇 초 더 준다
// (얼마까지 줄지는 설정함의 「얼마나 더 줄까요」가 정한다). 중간에 자꾸 늘리면
// 몇 초짜리 휴식인지 사람이 알 수 없게 된다.
//
// 틀려도 손해가 「조금 더 쉬었다」뿐이라 **안전한 쪽으로 틀린다.** 그리고
// 「그냥 시작」은 언제나 있다.

// 끝나기 이만큼 전에 한 번 본다. 0 에 딱 맞춰 보면 그 사이에 휴식이 끝나버린다
const LOOK_MS = 1500;

export default function RestBreath() {
  const breathOn = useSettingsStore(s => s.breath);
  const where = useSettingsStore(s => s.breathWhere);
  const sense = useSettingsStore(s => s.breathSense);
  const maxExtra = useSettingsStore(s => s.breathMax);

  const leftMs = useRestTimerStore(s => s.leftMs);
  const deadline = useRestTimerStore(s => s.deadline);
  const add = useRestTimerStore(s => s.add);

  const th = senseOf(sense);
  const breath = useBreath(th);

  // 이번 휴식에 몇 초를 더 줬나. 휴식이 새로 시작되면 0 으로 돌아간다
  const [given, setGiven] = useState(0);
  const looked = useRef(false);

  // 쉬는 것이 끝나면 마이크를 끈다. **쉬는 동안만 듣는다**
  useEffect(() => {
    if (deadline == null && breath.on) breath.stop();
  }, [deadline]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 새 휴식이 시작되면 준 것도 다시 센다
  useEffect(() => {
    setGiven(0);
    looked.current = false;
  }, [deadline]);

  // 화면을 떠나면 반드시 끈다 — 마이크가 켜진 채로 남으면 이 기능을 못 믿게 된다
  useEffect(() => () => breath.stop(), []);   // eslint-disable-line react-hooks/exhaustive-deps

  const ratio = breath.base && breath.level ? breath.level / Math.max(breath.base, 0.004) : 0;
  const state = !breath.base ? null : ratio >= th.up ? 'high' : ratio >= th.mid ? 'mid' : 'calm';

  // 끝나려 할 때 한 번 본다
  useEffect(() => {
    if (!breath.on || looked.current) return;
    if (leftMs == null || leftMs > LOOK_MS) return;
    looked.current = true;
    const extra = extraFor(state, given, maxExtra);
    if (extra > 0) {
      add(extra);
      setGiven(g => g + extra);
    }
  }, [leftMs, breath.on, state, given, maxExtra, add]);

  // 설정함에서 안 켰거나 헬스장까지로 고르지 않았으면 **이 줄은 없다**
  if (!breathOn || where !== 'gym') return null;
  if (deadline == null) return null;

  const bars = breath.history.slice(-10);
  const top = Math.max(0.02, ...bars);

  return (
    <div className="card" style={{
      width: '100%', padding: '9px 11px',
      borderColor: breath.on ? 'var(--info)' : 'var(--border)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {breath.on && bars.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 18, flexShrink: 0 }} aria-hidden="true">
          {bars.map((v, i) => (
            <div key={i} style={{
              width: 3, borderRadius: 1, background: 'var(--info)', opacity: 0.8,
              height: `${Math.max(10, Math.min(100, (v / top) * 100))}%`,
            }} />
          ))}
        </div>
      )}

      <div style={{ minWidth: 0, flexGrow: 1 }}>
        {!breath.on ? (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            숨을 들어보고 아직 올라있으면 몇 초 더 드려요
          </div>
        ) : breath.phase === 'ready' || !breath.base ? (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>조용한 소리를 재는 중…</div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{breathLabel(state)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {/* 준 것이 없으면 「0초 더」라고 적지 않는다 — 그건 아무 말도 아니다 */}
              {given > 0 ? `${given}초 더 드렸어요` : '소리 크기만 재요 · 녹음하지 않아요'}
            </div>
          </>
        )}
      </div>

      <button
        className="btn-secondary"
        style={{ width: 'auto', padding: '5px 10px', fontSize: 11.5, flexShrink: 0 }}
        onClick={() => (breath.on ? breath.stop() : breath.start())}
      >{breath.on ? '그만 듣기' : '숨 듣기'}</button>
    </div>
  );
}
