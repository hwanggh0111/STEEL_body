import { useState, useEffect, useRef } from 'react';
import { startRecover, recoverTick, tryLine } from '../data/breathRecover';

// 「숨 회복 지금 재보기」 (2026-09-30).
//
// **두 곳에서 쓴다** — 홈트의 「쉬는 화면 미리 보기」와 몸 → 「회복」 갈래.
// 두 벌로 두면 한쪽만 고치는 날이 오고, 그러면 같은 단추가 자리에 따라 다르게 된다
// (`ShapePage` 의 `measure` 에 적어둔 것과 같은 까닭이다).
//
// 마이크는 **부르는 쪽이 들고 있다**(`breath`). 홈트는 판이 쓰는 것을 그대로 넘기고,
// 「회복」 갈래는 자기 것을 만들어 넘긴다 — 한 화면에 마이크가 둘이 되지 않게.

/**
 * 「숨 회복 지금 재보기」 — 미리 보기 안에서 **진짜로 한 번 재본다** (2026-09-30).
 *
 * 붙여둔 회복 시간을 눈으로 보려면 판을 시작해 40초를 버티고 첫 쉬는 시간까지 가야 한다.
 * 그래서 **확인할 길이 없는 기능**이 되기 쉽다 — 「쉬는 화면 미리 보기」를 만든 것과
 * 같은 까닭으로 이 자리를 둔다.
 *
 * **잰 것은 안 쌓는다.** 동작 뒤에 잰 것이 아니라 견줄 상대가 없고(계획의 3번),
 * 쌓아두면 이력에 「무엇 뒤였는지 모르는 초」가 섞인다. 화면에도 그렇게 적는다.
 */
export default function RecoverTry({ breath, enabled }) {
  const [st, setSt] = useState(null);
  const [line, setLine] = useState(null);
  // 마이크를 여는 동안(권한 · 기준선 3초)은 아직 잴 수가 없다. 열리면 바로 시작한다
  const [waiting, setWaiting] = useState(false);
  const stRef = useRef(null);
  const stateRef = useRef(null);
  stateRef.current = breath.state;
  // **재보기가 켠 마이크는 재보기가 끈다.** 한 번 재보려고 누른 사람의 마이크가
  // 목록을 둘러보는 동안 계속 켜져 있으면 안 된다 (`useBreath` 의 첫 줄이 그 규칙이다).
  // 판을 돌리는 중에는 이 자리가 아예 안 보이므로 판의 마이크를 끌 일이 없다
  const startedRef = useRef(false);
  const stopRef = useRef(breath.stop);
  stopRef.current = breath.stop;

  const begin = () => {
    const fresh = startRecover(Date.now(), { program: '재보기', exercise: '재보기', duration: 0 });
    stRef.current = fresh;
    setSt(fresh);
    setLine(null);
  };

  // 기준선이 잡히면 기다리던 것을 시작한다. 막혔으면 기다리기를 접는다 —
  // `BreathRow` 가 바로 위에서 까닭을 이미 적고 있다
  useEffect(() => {
    if (!waiting) return;
    if (breath.phase === 'ready') { setWaiting(false); begin(); }
    else if (breath.phase === 'blocked' || breath.phase === 'off') setWaiting(false);
  }, [waiting, breath.phase]);

  useEffect(() => {
    if (!st || st.seconds !== null || st.why) return undefined;
    const id = setInterval(() => {
      const cur = stRef.current;
      if (!cur) return;
      const next = recoverTick(cur, stateRef.current, Date.now());
      if (next === cur) return;
      stRef.current = next;
      setSt(next);
      if (next.seconds !== null || next.why) {
        setLine(tryLine(next));
        // 다 쟀으면 마이크를 돌려놓는다 (우리가 켠 것일 때만)
        if (startedRef.current) { startedRef.current = false; stopRef.current(); }
      }
    }, 250);
    return () => clearInterval(id);
  }, [st]);

  // 미리 보기를 닫거나 화면을 떠날 때도 우리가 켠 것이면 끈다
  useEffect(() => () => {
    if (startedRef.current) { startedRef.current = false; stopRef.current(); }
  }, []);

  if (!enabled) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
        설정함에서 <b style={{ color: 'var(--text-secondary)' }}>숨 보고 쉬기</b>를 켜면,
        여기서 <b style={{ color: 'var(--text-secondary)' }}>숨이 가라앉는 데 몇 초 걸리나</b>를 재볼 수 있어요.
      </div>
    );
  }

  const measuring = st && st.seconds === null && !st.why;
  const busy = measuring || waiting;

  return (
    <div style={{ marginTop: 8 }}>
      <button
        className="btn-secondary"
        disabled={busy}
        style={{ width: '100%', minHeight: 38, fontFamily: 'inherit', fontSize: 12, cursor: busy ? 'default' : 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          // **마이크는 사람이 누른 이 순간에만 열 수 있다.** 권한 창이 그렇다
          if (breath.phase === 'ready') { begin(); return; }
          setWaiting(true);
          if (!breath.on) { startedRef.current = true; breath.start(); }
        }}
      >
        {measuring ? '재는 중… 숨이 가라앉으면 알려드려요'
          : waiting ? '마이크를 여는 중…'
            : '숨 회복 지금 재보기'}
      </button>
      {/* 무엇을 하는 단추인지 먼저 적는다. 누르고 나서 알게 하면 마이크가 먼저 열린다 */}
      {!busy && !line && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.6 }}>
          숨이 찬 뒤에 눌러보세요 — 가라앉기까지 몇 초인지 재드려요. <b>재보기는 안 쌓아둡니다.</b>
        </div>
      )}
      {line && (
        <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 7, lineHeight: 1.65 }}>
          {line}
        </div>
      )}
    </div>
  );
}
