import { useRestTimerStore, formatLeft, PRESETS, MIN_SEC, MAX_SEC } from '../store/restTimerStore';
import { primeAudio, previewTone, TONES, VOLUMES } from '../data/alertSound';
import { useRoutineSessionStore } from '../store/routineSessionStore';
import { useWorkoutStore } from '../store/workoutStore';
import { restView, exerciseOfLabel } from '../data/nextSet';
import RestBreath from './RestBreath';
import { useToday } from '../data/useToday';
import { useMemo, useState } from 'react';

// 휴식 타이머 — 기록 화면에 붙는 자리.
//
// 시간을 세는 일과 알리는 일은 스토어와 Layout 의 띠가 한다. 여기는 **고르고 누르는 자리**다.
// 그래서 다른 화면으로 옮겨도 타이머는 그대로 돈다.

// 큰 링 — 시안 A 의 것이다.
//
// 8/25 에는 안 넣었다. C(세트에 붙는다) 로 가면서 링 옆에 「방금 저장한 세트」와
// 「다음 운동」을 적는 배치를 골랐고, 큰 링을 넣으면 그 자리와 부딪힌다고 봤다.
// 그래서 78px 짜리 작은 링을 옆에 붙였다.
//
// 다시 보니 부딪히는 게 아니라 **위아래로 놓으면 되는 것**이었다. 링을 위에 크게 두고
// 그 아래에 방금 저장한 세트와 다음 운동을 적는다. 둘 다 들어간다.
//
// 큰 링이 필요한 이유는 이것이다 — **폰을 내려놓고 쓰는 물건**이다. 벤치에 누워
// 팔 뻗은 거리에서 22px 숫자는 안 읽힌다. 시안 A 의 60px 이 그래서 나온 크기다.
//
// ── 쉬는 중에는 **쉬는 것만** 남긴다 ── (2026-10-06)
//
// 10/2 의 「A+D 합본」 시안이 **치르는 값을 하나 적어뒀다** —
// 「카드가 넷이라 **한 화면에 안 들어갑니다.** 숨 줄이 있는 날엔 「다음 휴식」 줄이
// 아래로 밀립니다.」 그 값이 그대로 남아 있었고, 10/1 할 일 목록에도
// 「시안에서 고르지 않은 쉬는 시간」으로 적혀 있었다.
//
// 그런데 실제로 세어보니 밀리는 것이 「다음 휴식」 줄만이 아니었다. 쉬는 중에
// 링 아래로 이만큼이 쌓인다 —
//
//   다음 세트 카드 · (숨 한 줄) · 방금 저장한 세트 · 단추 셋
//   「다음 휴식」 + 프리셋 다섯
//   저절로 시작 · 소리 · **소리 종류 넷 · 소리 크기 셋 · 설명 줄 셋** · 진동
//
// **쉬는 60초 동안 「어떤 소리로 알릴까요」를 볼 이유가 없다.** 그런데 그것이
// 큰 링 바로 아래에 있어서, 다음 휴식 길이를 바꾸려면 벤치에 누워 스크롤해야 한다.
//
// 그래서 **쉬는 중에는 정하는 것을 접는다.** 쉬고 나면 그대로 펴진다.
//
// ── 설정함과 판단이 다른 까닭 ──
//
// 오늘 설정함에서는 **「접지 않는다」**를 골랐다(칩 줄로 건너뛰게만 했다). 거기는
// **설정을 보러 온 자리**라 숨기면 「그 기능이 없다」가 된다.
//
// 여기는 **쉬러 온 자리**다. 고객센터가 고친 것과 같은 종류다 —
// 「볼일을 보러 온 사람 앞에 소개를 세워둔 것」. 쉬는 사람 앞에 소리 고르기를
// 세워둘 이유가 없다. **숨기지 않고 접는다** — 한 번 누르면 그 자리에서 펴진다.
const RING = 190;
const R = 86;
const CIRC = 2 * Math.PI * R;

function Ring({ ratio, children }) {
  return (
    <div style={{ position: 'relative', width: RING, height: RING, maxWidth: '100%', flexShrink: 0 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${RING} ${RING}`} aria-hidden="true">
        {/* 색은 **속성이 아니라 style 로** 준다. SVG 속성 안에서는 var() 가 치환되지 않아
            값이 통째로 무시된다 — 링이 아예 안 그려진다 (2026-08-28 에 그래프에서 같은 것에 걸렸다) */}
        <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" style={{ stroke: 'var(--bg-tertiary)' }} strokeWidth="10" />
        <circle
          cx={RING / 2} cy={RING / 2} r={R} fill="none"
          strokeWidth="10" strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - Math.max(0, Math.min(1, ratio)))}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          // style 이 둘이면 뒤엣것이 앞엣것을 통째로 덮는다 — 예전에 여기서 색(stroke)이
          // transition 에 덮여 진행 링이 금색으로 안 그려졌다. 한 style 로 합친다
          // 1초 — 스토어가 **적히는 초가 바뀔 때만** 알려주기 때문이다 (2026-09-19).
          // 0.25s 로 두면 한 칸 움직이고 0.75초를 멈춰 있어 뚝뚝 끊겨 보인다
          style={{ stroke: 'var(--accent)', transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
      }}>{children}</div>
    </div>
  );
}

function Toggle({ on, onClick, label, desc }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      aria-label={label}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 0' }}
    >
      <div style={{ flexGrow: 1 }}>
        <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{label}</div>
        {desc && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{desc}</div>}
      </div>
      <div style={{
        width: 40, height: 22, borderRadius: 11, padding: 3, flexShrink: 0,
        background: on ? 'var(--accent)' : 'var(--bg-tertiary)',
        border: on ? 'none' : '1px solid var(--border-hover)',
        display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background 0.15s',
      }}>
        <div style={{
          width: on ? 16 : 14, height: on ? 16 : 14, borderRadius: 8,
          background: on ? 'var(--on-accent)' : 'var(--text-muted)',
        }} />
      </div>
    </div>
  );
}

// 쉬는 동안 보여줄 것 — 시안 A (2026-10-01).
//
// 세트 사이 60~180초는 사람이 폰을 들고 있는 거의 유일한 시간인데, 그 자리에
// **남은 시간밖에 없었다.** 다음에 들 것을 손 안 대고 읽게 한다.
//
// **지어내지 않는다.** 무게·횟수는 방금 적은 그 값이고(「방금과 같이」), 지난 번
// 이야기는 기록에 적힌 것뿐이다. 값은 `data/nextSet.js` 가 만든다 — 이 자리는 그린다.
function NextSet({ view }) {
  if (!view) return null;
  const { nextSet, weight, reps, last, drop, planSets, doneSets, done, exercise } = view;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="card" style={{
        background: 'var(--accent-dim)', borderColor: 'var(--accent)', padding: '11px 13px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span className="label" style={{ marginBottom: 0 }}>
            {done ? '지난 번만큼 다 했어요' : `다음 · ${nextSet}세트`}
          </span>
          <span style={{
            fontSize: 11.5, color: 'var(--text-secondary)', minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{exercise}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
          {/* 맨몸운동은 무게가 0 이다 — 「0kg」이라고 적지 않는다 */}
          {weight > 0 && (
            <>
              <span style={{ fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 38, letterSpacing: 1, color: 'var(--accent)', lineHeight: 1 }}>{weight}</span>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>kg</span>
            </>
          )}
          <span style={{
            fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", letterSpacing: 1, lineHeight: 1,
            fontSize: weight > 0 ? 26 : 38, color: weight > 0 ? 'var(--text-primary)' : 'var(--accent)',
            marginLeft: weight > 0 ? 6 : 0,
          }}>{reps}</span>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>회</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 'auto' }}>방금과 같이</span>
        </div>
      </div>

      {/* 세트 칸 — 지난 번만큼 그리고, 오늘 한 것을 채운다.
          지난 번이 없으면 오늘 한 만큼만 그린다 (앞으로 몇 세트일지 지어내지 않는다) */}
      {planSets > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginRight: 2 }}>세트</span>
          {Array.from({ length: planSets }, (_, i) => i + 1).map(n => (
            <span key={n} style={{
              fontSize: 11, lineHeight: 1, padding: '4px 7px', borderRadius: 'var(--radius)',
              border: '1px solid ' + (n <= doneSets ? 'var(--accent)' : 'var(--border)'),
              color: n <= doneSets ? 'var(--accent)' : 'var(--text-muted)',
            }}>{n}</span>
          ))}
        </div>
      )}

      {last && (
        <div className="card" style={{ padding: '10px 13px' }}>
          <div className="label" style={{ marginBottom: 4 }}>지난 번 이 운동</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            {String(last.date).slice(5).replace('-', '월 ')}일
            {last.weight > 0 ? ` · ${last.weight}kg` : ''} {last.topReps}회
            {' '}<span style={{ color: 'var(--text-primary)' }}>{last.sets}세트</span>
          </div>
          {/* 안 줄었으면 이 줄을 아예 안 그린다 — 「안 줄었어요」는 적을 값이 아니다 */}
          {drop && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
              그날은 {drop.set}세트째에서 {drop.reps}회로 줄였어요
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RestTimer() {
  const {
    duration, runSec, leftMs, deadline, pausedLeft, label,
    autoStart, sound, vibrate, tone, volume,
    setDuration, setAutoStart, setSound, setVibrate, setTone, setVolume,
    start, add, pause, resume, stop,
  } = useRestTimerStore();

  // 루틴을 따라가는 중이면 다음에 무엇을 하는지 쉬면서 알려준다
  const session = useRoutineSessionStore(s => s.session);
  const nextName = session && session.current >= 0
    ? session.items[session.current]?.name
    : null;

  // 쉬는 동안 보여줄 것. 운동 이름은 **휴식을 건 그 이름**에서 읽는다 —
  // `autoStartAfterSet` 이 「벤치프레스 3세트」 꼴로 적어 둔다 (restTimerStore 의 label).
  // 루틴의 「다음」과는 다른 값이다: 지금 쉬고 있는 것은 **방금 한 운동**이다
  const workouts = useWorkoutStore(s => s.workouts);
  const restedName = exerciseOfLabel(label);
  // 날짜는 앱이 쓰는 것과 **같은 자리**에서 읽는다. 여기서 따로 만들면
  // 자정을 넘기는 순간의 판단이 화면마다 달라진다
  const today = useToday();
  // **1초마다 다시 그리는 자리다.** 그때마다 5년치 날짜를 훑으면 안 된다 —
  // 바뀌는 것은 leftMs 뿐이고 기록은 그대로다. 기록이 바뀔 때만 다시 센다
  const view = useMemo(
    () => (restedName ? restView(workouts, restedName, today) : null),
    [workouts, restedName, today],
  );

  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const running = deadline != null;
  const paused = pausedLeft != null;
  const active = running || paused;
  // 지금 도는 것이 몇 초짜리인지로 잰다 (설정값이 아니라). +30초를 눌러도 맞는다
  const span = runSec || duration;
  const ratio = active ? (leftMs ?? 0) / (span * 1000) : 1;

  // 소리는 **사람이 누른 그 순간**에 준비해야 브라우저가 막지 않는다
  const begin = (sec) => { primeAudio(); start(sec ?? duration, label); };

  // 쉬는 중에 **정하는 것**(다음 휴식 길이 · 알림)을 펼쳐 뒀나.
  //
  // 쉬는 동안은 기본이 접힘이다. 안 쉴 때는 이 값과 상관없이 늘 펴져 있다 —
  // 그때는 그것이 이 카드의 본일이다
  const [openPrefs, setOpenPrefs] = useState(false);
  // 쉬는 중이 아니면 언제나 펴 둔다
  const prefsOpen = !active || openPrefs;

  const applyCustom = () => {
    const n = parseInt(custom, 10);
    if (!Number.isFinite(n) || n < MIN_SEC || n > MAX_SEC) return;
    setDuration(n);
    setCustom('');
    setShowCustom(false);
  };

  return (
    <div className="card" style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="label" style={{ marginBottom: 0 }}>휴식 타이머</div>

      {active ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <Ring ratio={ratio}>
              <span style={{
                fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 56, letterSpacing: 3,
                color: paused ? 'var(--text-muted)' : 'var(--text-primary)', lineHeight: 1,
              }}>{formatLeft(leftMs)}</span>
              <span style={{ fontSize: 12, color: paused ? 'var(--warning)' : 'var(--text-muted)' }}>
                {paused ? '멈춤' : `${span}초 중`}
              </span>
            </Ring>

            {/* 다음에 들 것 — 시안 A (2026-10-01). 값이 없으면 안 그리고,
                그때는 아래의 옛 한 줄이 그대로 나온다 */}
            <NextSet view={view} />

            {/* 숨 — 시안 D. 거드는 한 줄이고, 못 들으면 이 줄만 사라진다.
                설정함에서 「헬스장 휴식까지」를 골랐을 때만 그린다 */}
            <RestBreath />

            {/* 방금 저장한 세트와 다음 운동 — C 안의 것이다. 링 아래에 놓으면
                큰 링과 부딪히지 않는다. 위 카드가 나오면 **같은 말을 두 번 하지 않는다** */}
            {((label && !view) || nextName) && (
              <div style={{ width: '100%', minWidth: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {label && !view && (
                  <div style={{ fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </div>
                )}
                {nextName && (
                  <div style={{
                    fontSize: 12.5, color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>다음 · {nextName}</div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <button className="btn-secondary" style={{ flexGrow: 1 }} onClick={() => add(30)}>+30초</button>
            <button className="btn-secondary" style={{ flexGrow: 1 }} onClick={paused ? resume : pause}>
              {paused ? '이어서' : '일시정지'}
            </button>
            {/* 다 쉬었으면 기다리지 않는다. 휴식을 끝내고 다음 세트로 간다 */}
            <button
              className="btn-primary"
              style={{ flexGrow: 1, width: 'auto', fontSize: 14, padding: '9px 0' }}
              onClick={stop}
            >바로 시작</button>
          </div>
        </>
      ) : null}

      {/* 쉬는 중이면 정하는 것을 접고 **한 줄만** 둔다 (위 머리말 참고).
          무엇이 접혀 있는지 적는다 — 「설정」이라고만 적으면 다음 휴식 길이가
          거기 있는 줄 모른다 */}
      {active && !openPrefs && (
        <button
          type="button"
          onClick={() => setOpenPrefs(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 40,
            padding: '0 2px', background: 'none', border: 'none', borderTop: '1px solid var(--border)',
            fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            다음 휴식 길이 · 알림 소리는 쉬고 나서 정하셔도 됩니다
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent-low)', flexShrink: 0 }}>펼치기 ›</span>
        </button>
      )}

      {/* 프리셋 — 여기서 고르는 것은 **다음 휴식**의 길이다. 도는 것을 중간에
          늘리거나 줄이는 자리가 아니다 (그건 +30초가 한다) — 그래서 쉬는 중에는
          그렇게 적는다 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...(prefsOpen ? null : { display: 'none' }) }}>
        {active && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>다음 휴식</div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          {PRESETS.map(sec => (
            <button
              key={sec}
              className={`btn-secondary${duration === sec && !showCustom ? ' active' : ''}`}
              style={{ flexGrow: 1, padding: '9px 0' }}
              onClick={() => { setDuration(sec); setShowCustom(false); }}
            >{sec}초</button>
          ))}
          <button
            className={`btn-secondary${showCustom ? ' active' : ''}`}
            style={{ flexGrow: 1, padding: '9px 0' }}
            onClick={() => setShowCustom(v => !v)}
          >직접</button>
        </div>

        {showCustom && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={MIN_SEC}
              max={MAX_SEC}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCustom(); } }}
              placeholder={`${MIN_SEC}~${MAX_SEC}초`}
            />
            <button className="btn-secondary" onClick={applyCustom} style={{ flexShrink: 0 }}>맞춤</button>
          </div>
        )}
      </div>

      {!active && (
        <button className="btn-primary" onClick={() => begin()}>{duration}초 쉬기</button>
      )}

      {/* 알림 묶음. 쉬는 중에는 같이 접힌다 — 소리 종류 넷 · 소리 크기 셋 ·
          설명 줄 셋이 큰 링 바로 아래에 쌓이던 자리다 */}
      <div style={{
        borderTop: '1px solid var(--border)', paddingTop: 8,
        ...(prefsOpen ? null : { display: 'none' }),
      }}>
        <Toggle
          on={autoStart}
          onClick={() => { primeAudio(); setAutoStart(!autoStart); }}
          label="저장하면 저절로 시작"
          desc="끄면 예전처럼 직접 눌러서 시작합니다"
        />
        <Toggle
          on={sound}
          onClick={() => { primeAudio(); setSound(!sound); }}
          label="끝나면 소리로 알리기"
        />

        {/* 소리를 끈 사람에게는 고를 것을 안 보여준다 — 눌러도 아무 일이 안 일어나는
            자리를 남겨두면 고장으로 읽힌다 */}
        {sound && (
          <div style={{ paddingLeft: 2, marginBottom: 4 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
              어떤 소리로 알릴까요 — 누르면 그 자리에서 들려드립니다
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {TONES.map((tn) => (
                <button
                  key={tn.id}
                  className={`btn-secondary${tone === tn.id ? ' active' : ''}`}
                  style={{ flex: '1 1 0', minWidth: 64, padding: '8px 0' }}
                  aria-pressed={tone === tn.id}
                  onClick={() => { setTone(tn.id); previewTone(tn.id, volume); }}
                >{tn.name}</button>
              ))}
            </div>
            {/* 고른 소리가 어떤 것인지 한 줄. 이름(「종」·「나무」)만으로는 아무도 모른다 */}
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 8 }}>
              {(TONES.find((t) => t.id === tone) || TONES[0]).desc}
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>소리 크기</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {VOLUMES.map((v) => (
                <button
                  key={v.id}
                  className={`btn-secondary${volume === v.id ? ' active' : ''}`}
                  style={{ flex: '1 1 0', padding: '8px 0' }}
                  aria-pressed={volume === v.id}
                  onClick={() => { setVolume(v.id); previewTone(tone, v.id); }}
                >{v.name}</button>
              ))}
            </div>
            {/* 폰이 무음이면 아무 소리도 안 난다. 「크게」로 해도 안 들리면 여기부터 본다 */}
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
              폰이 무음이면 소리가 나지 않습니다. 진동을 같이 켜두세요
            </div>
          </div>
        )}
        <Toggle
          on={vibrate}
          onClick={() => setVibrate(!vibrate)}
          label="끝나면 진동으로 알리기"
          desc="아이폰은 진동을 지원하지 않습니다. 소리로 알립니다"
        />

        {/* 펼쳐 놓고 그대로 두면 또 길어진다. **접는 길을 같이 둔다** —
            쉬는 중에만 그린다 (안 쉴 때는 이것이 이 카드의 본일이라 접을 것이 없다) */}
        {active && (
          <button
            type="button"
            onClick={() => setOpenPrefs(false)}
            style={{
              width: '100%', minHeight: 40, marginTop: 4, background: 'none', border: 'none',
              borderTop: '1px solid var(--border)', fontFamily: 'inherit', cursor: 'pointer',
              fontSize: 12, color: 'var(--text-muted)',
            }}
          >접어서 타이머만 보기</button>
        )}
      </div>
    </div>
  );
}
