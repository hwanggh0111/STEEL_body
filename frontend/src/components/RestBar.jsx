import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRestTimerStore, formatLeft, restBarUp } from '../store/restTimerStore';
import { useWorkoutStore } from '../store/workoutStore';
import { restView, exerciseOfLabel } from '../data/nextSet';
import { useToday } from '../data/useToday';
import { beepDone } from '../data/alertSound';
import { useWakeLock } from '../data/useWakeLock';
import { useRestAlarm } from '../data/useRestAlarm';
import { LAYER } from '../data/layers';

// 휴식 중일 때 탭 바 바로 위에 뜨는 띠.
//
// 예전 타이머는 기록 화면 안에만 있어서, 쉬는 동안 인바디를 보러 가면 사라졌다.
// 이 띠는 Layout 에 있어서 **어느 화면에서나** 보인다.
//
// 끝났다고 알리는 것도 여기서 한다. 화면마다 따로 두면 어느 화면에 있느냐에 따라
// 소리가 나기도 하고 안 나기도 한다 — 언제나 떠 있는 이 자리에 한 번만 둔다.

// 「다음에 들 것」 한 줄. **띠와 OS 알림이 같은 줄을 쓴다** — 두 군데에 적으면
// 한쪽만 고쳐지고, 잠금화면과 띠가 다른 말을 하게 된다.
// 맨몸운동은 무게가 0 이다 — 「0kg」이라고 적지 않는다
function nextLine(view, label) {
  if (!view) return label || '휴식 중';
  return `다음 · ${view.nextSet}세트 · ${view.weight > 0 ? view.weight + 'kg ' : ''}${view.reps}회`;
}

export default function RestBar({ bottom = 'var(--tabbar-h, 60px)' }) {
  const { leftMs, deadline, pausedLeft, finished, label, runSec, duration, sound, vibrate, tone, volume, add, pause, resume, stop, ackFinished } = useRestTimerStore();
  const navigate = useNavigate();
  const location = useLocation();
  const alerted = useRef(false);

  // ── **띠도 제 높이를 알린다** ── (2026-11-19 · 맵시)
  //
  // 알림(토스트)이 띠 위로 비킬 때 여태 `bottom: 142` 라는 **짐작한 수**를 썼다.
  // 띠 높이는 글자 크기와 종목 이름 길이에 따라 달라지고(한 줄이 두 줄이 되면
  // 더 자란다), 탭바 높이까지 더해야 하는 값이다. 재서 `--restbar-h` 에 적으면
  // 알림이 `calc(--tabbar-h + --restbar-h + 틈)` 으로 저절로 비킨다.
  // 띠가 없는 동안은 **0** 이다 — 안 비우면 띠가 사라진 뒤에도 알림이 떠 있다
  const 띠ref = useRef(null);
  // ★ **뜨는 조건에만 매단다** (2026-11-19 · 정석이 짚었다). 의존성 배열이 없으면
  // 쉬는 동안 `leftMs` 가 **1초마다** 바뀌므로 이 효과가 매초 돌아 `ResizeObserver`
  // 를 **1초마다 만들고 끊는다.** 틀린 꼴은 아니지만 할 일 없는 일이다 —
  // **띠가 떴나 내렸나**가 바뀔 때만 다시 걸면 된다. 띠 **안**이 자라는 것(종목
  // 이름이 두 줄이 되는 것 · 글자 크기)은 `ResizeObserver` 가 그대로 잡는다.
  // 띠가 내려가는 렌더에서는 이 값이 false 로 바뀌어 효과가 다시 돌고, 그때
  // `ref` 가 비어 있어 **0 이 적힌다** — 아래 `적기(0)` 이 하던 그 일이다
  const 떴나 = restBarUp({ deadline, pausedLeft, finished });
  useEffect(() => {
    const el = 띠ref.current;
    const 적기 = (px) => {
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--restbar-h', px + 'px');
      }
    };
    if (!el) { 적기(0); return undefined; }
    const 재기 = () => 적기(Math.round(el.getBoundingClientRect().height));
    재기();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(재기);
    if (ro) ro.observe(el);
    // cleanup 에서 0 을 적지 않는다 — 매 렌더마다 0 → 실제값이 되면서 **알림이 깜빡인다.**
    // 띠가 사라지는 렌더에서는 `ref` 가 비므로 위의 `적기(0)` 이 그 일을 한다.
    // 다만 **이 칸이 통째로 없어질 때**(로그아웃)는 치운다 — 남겨두면 다음 사람의
    // 알림이 있지도 않은 띠 높이만큼 떠 있다
    return () => {
      if (ro) ro.disconnect();
      if (typeof document !== 'undefined' && !띠ref.current) {
        document.documentElement.style.removeProperty('--restbar-h');
      }
    };
  }, [떴나]);

  // 띠에도 **다음에 들 것**을 적는다 (2026-10-01).
  //
  // 쉬는 화면(`RestTimer`)에는 카드로 크게 적었는데, 이 띠는 **어느 화면에서나**
  // 떠 있는 자리다 — 쉬는 동안 기록을 보러 가면 보이는 것이 이쪽뿐이다.
  // 그때 「휴식 중」이라고만 적혀 있으면, 다음 세트를 보려고 운동 화면으로
  // 돌아가야 한다.
  //
  // **한 줄에 들어갈 만큼만** 적는다 — 세트 번호와 무게·횟수. 지난 번 이야기는
  // 쉬는 화면의 몫이다. 값이 없으면 지금까지처럼 `label` 이 그대로 나온다.
  const workouts = useWorkoutStore(s => s.workouts);
  const today = useToday();
  const restedName = exerciseOfLabel(label);
  // **1초마다 다시 그리는 자리다.** 그때마다 5년치 날짜를 훑으면 안 된다 —
  // 바뀌는 것은 `leftMs` 뿐이고 기록은 그대로다. 기록이 바뀔 때만 다시 센다
  const view = useMemo(
    () => (restedName ? restView(workouts, restedName, today) : null),
    [workouts, restedName, today],
  );

  // 끝나면 소리와 진동. **한 번만** 울린다
  useEffect(() => {
    if (!finished) { alerted.current = false; return; }
    if (alerted.current) return;
    alerted.current = true;
    // **이미 들은 알림을 또 울리지 않는다** (2026-10-16). 주머니에서 OS 알림을 받고
    // 3분 뒤에 앱을 열면, 멈춰 있던 타이머가 그제서야 끝을 세운다 — 그때 삑 소리를
    // 내면 사람은 「지금 끝났나?」 하고 시계를 다시 본다. 앱에서만 쓰는 판단이다
    if (!alarmFired.current) beepDone({ sound, vibrate, tone, volume });
    // `alarmFired` 는 **의존성에 넣지 않는다.** ref 라 다시 돌 거리가 아닌 데다,
    // 아래에서 만들어지는 값이라 넣으면 배열을 셀 때 터진다(TDZ)
  }, [finished, sound, vibrate, tone, volume]);

  // 다 됐다는 표시를 잠깐 두고 스스로 걷는다 — 누르지 않아도 사라진다.
  //
  // **울리는 효과와 떼어 둔다** (2026-11-23). 같이 있을 때는 「휴식 끝」이 떠 있는
  // 6초 안에 소리 · 음색 · 크기를 바꾸면 정리가 시계를 지우고, 다시 돈 효과는
  // `alerted` 에 막혀 **새 시계를 안 걸었다** — 초록 띠가 × 를 누를 때까지 남았다
  useEffect(() => {
    if (!finished) return undefined;
    const t = setTimeout(() => ackFinished(), 6000);
    return () => clearTimeout(t);
  }, [finished, ackFinished]);

  const running = deadline != null;
  const paused = pausedLeft != null;

  // 쉬는 동안 화면을 안 재운다 (2026-09-17).
  //
  // 90초 휴식에 화면이 꺼지면, 다음 세트를 하려고 **폰을 깨워 잠금까지 풀어야 한다** —
  // 세트마다 그런다. 땀 묻은 손으로.
  //
  // **이 자리에 두는 이유.** 이 띠는 껍데기(Layout)에 있어서 어느 화면에서나 떠 있다.
  // 화면마다 따로 두면 어디에 있느냐에 따라 화면이 꺼지기도 하고 안 꺼지기도 한다 —
  // 끝났다고 알리는 소리를 여기 한 번만 둔 것과 같은 이유다.
  //
  // **오래 잡고 있을 걱정은 없다.** 휴식은 길어야 10분이고(`MAX_SEC`), 다 되면
  // `deadline` 이 지워지면서 저절로 놓는다. **훅은 이른 반환보다 위에 있어야 한다**
  useWakeLock(running || paused);

  // 쉬는 동안 **폰을 주머니에 넣으면** 띠가 못 울린다 (2026-10-16).
  //
  // 뒤로 간 웹뷰는 타이머가 늦춰지고 소리를 낼 자리도 잠든다 — 꺼내 보면 「휴식 끝」이
  // 떠 있고 실제로는 한참 더 쉰 뒤다. 그래서 **앱이 뒤로 갈 때** 끝나는 시각에 OS 알림을
  // 걸어둔다. 돌아오면 지운다 — 둘 다 울리면 안 된다 (`data/restAlarm.js` 머리글).
  //
  // **소리·진동을 둘 다 끈 사람에게는 안 건다.** 끈 사람이 끈 이유가 있다.
  // 멈춰 둔 휴식(`paused`)도 안 건다 — 끝나는 시각이 없다.
  //
  // 알림에 적는 줄은 띠에 적는 것과 **같은 것**이다 — 두 벌로 만들면 한쪽만 고쳐진다
  const alarmBody = nextLine(view, label);
  const alarmFired = useRestAlarm(running && (sound || vibrate) ? deadline : null, alarmBody);

  // 뜨는 조건은 `restBarUp` 한 자리에서 온다 — 한 줄 알림이 같은 것을 본다 (2026-11-11)
  if (!떴나) return null;   // 뜨는 조건은 위에서 한 번 본다 (`restBarUp` 한 자리)

  // **지금 도는 휴식이 몇 초짜리인가(`runSec`)로 잰다** (2026-09-19 에 고쳤다).
  //
  // 여태 `duration` — **다음 휴식에 쓸 기본값** — 으로 쟀다. 그래서 둘이 어긋나는
  // 순간마다 띠가 거짓말을 했다:
  //   · +30초를 누르면 120초를 쉬는데 잣대는 90초다 → 비율이 1을 넘어 **띠가 꽉 찬 채로
  //     30초를 멈춰 있다** (`Math.min(1, …)` 에 잘린다)
  //   · 쉬는 중에 프리셋을 180초로 바꾸면 **띠가 그 자리에서 반으로 줄어든다**
  // 같은 것을 2026-09-14 에 링(`RestTimer`)에서 고쳤는데, 이 띠는 그대로 남아 있었다.
  const span = runSec > 0 ? runSec : duration;
  const ratio = finished ? 1 : Math.max(0, Math.min(1, (leftMs ?? 0) / (span * 1000)));
  const color = finished ? 'var(--success)' : 'var(--accent)';

  // ── ★ **낭독기가 쉬는 동안 내내 떠들고 있었다** ── (2026-11-20 · 정석이 짚었다)
  //
  // 이 띠는 통째로 `role="status" aria-live="polite"` 였고 그 안에 **매초 바뀌는 남은
  // 시간**이 들어 있었다(`formatLeft(leftMs)`). 그래서 **60초 휴식에 60번** 읽는다 —
  // 눈으로 보는 사람에게는 공짜인 그 숫자가 **귀로 듣는 사람에게는 소음**이다.
  //
  // 지우면 안 된다(남은 시간은 그 사람이 알아야 하는 값이다). 그래서 **거친 눈금**으로
  // 가른다 — 1분 단위로, 30초·10초에서 한 번, 끝에서 한 번. 60초 휴식이면 **네 번**이다.
  //
  // 글이 **그 눈금에서만 바뀌므로** 리액트가 매초 다시 그려도 DOM 글자가 그대로고,
  // 그러면 `aria-live` 가 읽지 않는다. 눈에 보이는 큰 숫자는 `aria-hidden` 으로 가린다
  const 눈금초 = (() => {
    if (finished) return 0;
    const s = Math.max(0, Math.ceil((leftMs ?? 0) / 1000));
    if (s <= 10) return 10;
    if (s <= 30) return 30;
    // **30초 눈금이다.** 1분 눈금으로 올리면 90초에 「2분쯤」이라고 말한다 — 그것은
    // 거친 것이 아니라 **과장**이다. 이 저장소의 선은 「모르면 모른다」이고,
    // 아는 것을 부풀려 말하지도 않는다
    return Math.ceil(s / 30) * 30;        // 1분 · 1분 30초 · 2분 …
  })();
  const 읽을글 = (() => {
    if (paused) return '휴식을 멈췄어요';
    if (finished) return '쉬는 시간이 끝났어요';
    if (눈금초 < 60) return `${눈금초}초쯤 남았어요`;
    const 분 = Math.floor(눈금초 / 60);
    const 초 = 눈금초 % 60;
    return `${분}분${초 ? ` ${초}초` : ''}쯤 남았어요`;
  })();

  return (
    <div
      ref={띠ref}
      style={{
        position: 'fixed', left: 0, right: 0, bottom,
        zIndex: LAYER.휴식띠,
        borderTop: `1px solid ${color}`,
        // ── ★ **띠 자체가 진행이다** ── (2026-11-20 · 맵시 · 시안 1120 ③ · 주인이 골랐다)
        //
        // 여태 띠 **아래에 진행 막대가 따로** 있었다(`height: 4` + `marginTop: 5` = **9px**).
        // 막대가 띠와 다른 물건이라 **늘 덮일 걱정**을 해야 했다 — 글자를 키우면 탭바가
        // 자라 그 9px 이 **가장 먼저** 가려졌고(11/19 에 `--tabbar-h` 로 고친 자리),
        // 오늘은 「맨 위로」가 이 띠에 통째로 묻혀 있었다.
        //
        // 막대를 걷고 **바탕이 왼→오로 차오르게** 한다. 덮일 물건이 하나 줄고 띠 높이도
        // 9px 낮아진다 — 띠는 제 높이를 재서 알리므로(`--restbar-h`) 알림과 「맨 위로」가
        // **저절로 따라 내려온다**(`check-layer` 가 그 쌓임을 본다).
        background: finished ? 'var(--success-dim)' : 'var(--bg-secondary)',
        padding: '9px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        // 차오르는 칸이 이 안에서 선다
        overflow: 'hidden',
      }}
    >
      {/* ── 차오르는 바탕 ──
          **면적으로 읽히는 값**이라 색이 옅어도 보인다. 다만 옅은 바탕만으로는 「지금
          어디까지」가 흐릿하므로 **차오름의 머리에 금 한 줄**을 세운다 — 그 선이 움직이는
          것이 눈에 걸린다. 금을 **면으로 칠하지 않는 것**은 11/13 의 선이다(금 바탕은
          축하가 입는 옷이다 · `PersonalRecordBanner`).
          1초 — 스토어가 **적히는 초가 바뀔 때만** 알려준다 (`restTimerStore` 의 tick) */}
      <div aria-hidden="true" style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${ratio * 100}%`,
        background: finished ? 'rgba(127,176,105,0.10)' : 'rgba(238,183,125,0.13)',
        borderRight: ratio > 0 && ratio < 1 ? `2px solid ${color}` : 'none',
        transition: 'width 1s linear',
        pointerEvents: 'none',
      }} />

      {/* ★ 낭독기에 읽히는 줄은 **이 숨은 칸 하나**다 (위 머리글의 거친 눈금).
          띠 통째로 `aria-live` 를 걸면 매초 떠든다 */}
      <span role="status" aria-live="polite" style={{
        position: 'absolute', width: 1, height: 1, overflow: 'hidden',
        clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
      }}>{읽을글}{label ? ` · ${label}` : ''}</span>

      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }} aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2M9 2h6" />
      </svg>

      {/* 누르면 운동 화면으로 돌아가는 칸이다 — **자판으로도 닿게** 한다 (2026-11-11).
          띠 자체는 `role="status"` 로 읽히는 자리라, 누르는 칸만 단추로 가른다.
          `.tap-tight` 는 안 붙인다 — 띠 안의 큰 칸이라 44px 로 커져도 밀 것이 없다 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="운동 화면으로 돌아가기"
        style={{ flexGrow: 1, minWidth: 0, cursor: 'pointer', position: 'relative' }}
        onClick={() => { if (location.pathname !== '/train') navigate('/train'); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (location.pathname !== '/train') navigate('/train');
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {/* 눈으로 읽는 숫자다 — 낭독기에는 위의 거친 눈금이 간다(여기까지 읽히면
              매초 두 번 말하는 셈이다). 막대를 걷은 자리를 받아 조금 키운다 */}
          <span aria-hidden="true" style={{
            fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif", fontSize: 24, letterSpacing: 1.5,
            color, lineHeight: 1,
          }}>{finished ? '휴식 끝' : formatLeft(leftMs)}</span>
          {/* `minWidth: 0` 이 없어 **말줄임이 안 들었다** — 가로 flex 자식의
              `min-width` 기본값이 `auto` 다. 사람이 지은 긴 종목 이름이 들어오면
              바닥 바 밖으로 삐져나갔다. 운동하는 동안 계속 보이는 자리다
              (2026-11-16 · 맵시) */}
          <span style={{
            fontSize: 12, color: 'var(--text-secondary)', minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{paused ? '멈춤'
            : finished ? '다음 세트 하세요'
            : nextLine(view, label)}</span>
        </div>
        {/* 진행 막대는 **걷었다** — 띠 바탕이 그 몫을 한다 (위 머리글 · 2026-11-20).
            여기 `height: 4 + marginTop: 5` = 9px 이 있었고, 그 9px 이 글자를 키운 폰에서
            가장 먼저 가려지던 자리다 */}
      </div>

      {!finished && (
        <>
          <button className="btn-secondary" style={{ flexShrink: 0, padding: '6px 10px' }} onClick={() => add(30)}>+30</button>
          <button className="btn-secondary" style={{ flexShrink: 0, padding: '6px 10px' }} onClick={paused ? resume : pause}>
            {paused ? '이어서' : '멈춤'}
          </button>
        </>
      )}

      <button
        onClick={finished ? ackFinished : stop}
        aria-label="닫기"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: 4, flexShrink: 0,
        }}
      >×</button>
    </div>
  );
}
