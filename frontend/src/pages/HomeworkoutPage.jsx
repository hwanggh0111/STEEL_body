import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../components/Toast';
import NavIcon from '../components/NavIcon';
import { PROGRAMS, PROGRAM_NOTES, descOf, gearOf, loudOf } from '../data/homeworkoutPrograms';
import { readLS, saveLS } from '../data/safeStorage';
import { HOME_LAST_KEY } from '../data/localKeys';
import { buildPump, programPump, partsOf, toRecords } from '../data/homeworkoutParts';
import { useBreath, micSupported } from '../data/useBreath';
import { breathLabel, extraFor, hardestOf } from '../data/breathRest';
import PumpBody from '../components/PumpBody';
import { useWorkoutStore } from '../store/workoutStore';
import { useToday } from '../data/useToday';
import { useSettingsStore, senseOf } from '../store/settingsStore';
import { primeAudio, beepDone } from '../data/alertSound';
import { useRestTimerStore } from '../store/restTimerStore';
import { useWakeLock } from '../data/useWakeLock';

const PROGRAM_NAMES = Object.keys(PROGRAMS);

// 지난번에 한 프로그램. **여기에만 남는다** — 홈트는 아직 서버에 안 쌓인다
// (「운동 기록에 남기기」를 눌러야 기록이 된다 — **2026-09-22 부터 그 단추가 부위별로
// 나눠 서버에 바로 저장하고, 몸 지도까지 간다**). 그래서 기기의 것으로만 적는다.
//
// 이름은 `data/localKeys.js` 에 둔다 — **그 사람이 한 것**이라 로그아웃하면 지운다
// (열쇠의 `steelbody_` 는 옛 앱 이름이다. 앱 이름이 바뀌어도 안 바꾼다)
const LS_LAST = HOME_LAST_KEY;

function readLastDone() {
  try {
    const v = JSON.parse(readLS(LS_LAST) || 'null');
    // 없어진 프로그램 이름이 적혀 있으면 안 그린다 (프로그램을 갈아끼워도 안 터진다)
    return v && PROGRAMS[v.name] ? v : null;
  } catch {
    return null;
  }
}
const saveLastDone = (name) => saveLS(LS_LAST, JSON.stringify({ name, at: Date.now() }));

const dayStart = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** 며칠 전인가. 「3일 전」이 「9월 1일」보다 빨리 읽힌다 */
function agoLabel(at) {
  const days = Math.round((dayStart(Date.now()) - dayStart(at)) / 86400000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 30) return `${days}일 전`;
  return '한 달 넘게 전';
}

// 고르기 전 빈 목록. 매 렌더 새로 만들면 effect 가 그때마다 다시 돈다
const EMPTY = [];

/**
 * 쉬는 동안의 숨 한 줄.
 *
 * **점수도 숫자도 안 적는다.** 적는 것은 「숨이 아직 올라있어요」 한 마디와,
 * 몇 초를 더 줬는지뿐이다. 판단 규칙은 `data/breathRest.js` 에 있다.
 *
 * 파형은 **읽으라고 있는 것이 아니다** — 마이크가 실제로 듣고 있다는 표시다.
 * 이것이 없으면 「켰는데 아무 일도 안 일어난다」로 읽힌다.
 */
function BreathRow({ breath, extraGiven, onSkip }) {
  if (!breath.on) return null;

  // 기준선을 재는 중 · 못 쓰는 자리 — **까닭을 적는다.** 조용히 아무 일도 안 하면
  // 켜둔 사람이 고장으로 읽는다
  if (breath.phase !== 'ready') {
    return (
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {breath.phase === 'calibrating' && '조용한 소리를 재는 중이에요…'}
        {breath.phase === 'asking' && '마이크를 여는 중이에요…'}
        {breath.phase === 'blocked' && `숨이 안 잡혀요 — ${breath.why}`}
      </div>
    );
  }

  const label = breathLabel(breath.state);
  const bars = breath.history.slice(-14);
  const top = Math.max(0.02, ...bars);

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Bebas Neue', sans-serif", fontSize: 10.5, letterSpacing: 1.8, color: 'var(--info)' }}>
          {/* 듣고 있다는 표시는 **늘 켜둔다** — 마이크가 켜진 것을 모르는 채로 두지 않는다 */}
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--info)', boxShadow: '0 0 0 3px rgba(127,168,217,0.16)' }} />
          숨
        </span>
        {label && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 26 }} aria-hidden="true">
        {bars.map((v, i) => (
          <span key={i} style={{
            flex: 1, borderRadius: 1,
            height: `${Math.max(8, Math.round((v / top) * 100))}%`,
            background: breath.state === 'calm' ? 'var(--info)' : 'var(--accent)',
            opacity: breath.state === 'calm' ? 0.4 : 0.85,
          }} />
        ))}
      </div>

      {/* 더 준 것이 있으면 **그렇다고 말한다.** 말 없이 시간이 늘면 타이머가 고장난 것으로 읽힌다 */}
      {extraGiven > 0 && (
        <div style={{
          marginTop: 11, padding: '9px 11px', borderRadius: 6,
          border: '1px solid var(--accent)', background: 'var(--accent-dim)',
          fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.6,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <span>숨이 아직 올라있어서 <b style={{ color: 'var(--accent)' }}>{extraGiven}초</b> 더 드렸어요</span>
          {/* **언제든 무시할 수 있다.** 앱이 정한 것을 사람이 못 넘기면 그것은 규칙이 아니라 벽이다 */}
          <button
            onClick={onSkip}
            className="btn-secondary"
            style={{ width: 'auto', flexShrink: 0, padding: '5px 11px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}
          >그냥 시작</button>
        </div>
      )}
    </div>
  );
}

/**
 * 여기까지 몸의 어디를 채웠나.
 *
 * 막대는 **부위끼리만 견준다** — 세트 수로 많고 적음을 말하지 않는 몸 지도의 선을
 * 여기서도 따른다. 안 건드린 곳은 칠하지 않고 `PumpBody` 가 점선으로 두른다.
 */
function PumpRow({ pump, next }) {
  const nextParts = next ? partsOf(next) : null;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14, paddingTop: 13, borderTop: '1px solid var(--border)' }}>
      <PumpBody pump={pump} width={62} now={nextParts} />
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 10.5, letterSpacing: 1.8, color: 'var(--accent)', marginBottom: 7 }}>
          여기까지 채운 곳
        </div>
        {pump.order.filter((r) => r.score > 0).slice(0, 4).map((r) => (
          <div key={r.part} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, marginBottom: 5 }}>
            <span style={{ width: 26, color: 'var(--text-secondary)', flexShrink: 0 }}>{r.part}</span>
            <span style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <span style={{
                display: 'block', height: '100%', borderRadius: 2,
                width: `${Math.round((r.score / Math.max(1, pump.max)) * 100)}%`,
                background: r.main > 0 ? 'var(--accent)' : 'var(--accent-low)',
                opacity: r.main > 0 ? 1 : 0.5,
              }} />
            </span>
          </div>
        ))}
        {pump.untouched.length > 0 && (
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 7, lineHeight: 1.5 }}>
            아직 안 건드린 곳: {pump.untouched.join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 이 판이 **어디를 채우는 판인가** — 고르기 전에 보는 것.
 *
 * 이름만으로는 모른다. 「상체 집중」이 가슴만 하는 판인지 등까지 하는 판인지,
 * 「기능성」이 하체 판인지 온몸 판인지는 **동작을 다 읽어야** 나온다.
 */
function ProgramPump({ list }) {
  const pump = useMemo(() => programPump(list), [list]);
  if (!pump.touched.length) return null;
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'center',
      padding: '12px 0', marginBottom: 12,
      borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
    }}>
      <PumpBody pump={pump} width={56} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 10.5, letterSpacing: 1.8, color: 'var(--accent)', marginBottom: 7 }}>
          이 판이 채우는 곳
        </div>
        {pump.order.filter((r) => r.score > 0).slice(0, 4).map((r) => (
          <div key={r.part} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, marginBottom: 5 }}>
            <span style={{ width: 26, color: 'var(--text-secondary)', flexShrink: 0 }}>{r.part}</span>
            <span style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <span style={{
                display: 'block', height: '100%', borderRadius: 2,
                width: `${Math.round((r.score / Math.max(1, pump.max)) * 100)}%`,
                background: r.main > 0 ? 'var(--accent)' : 'var(--accent-low)',
                opacity: r.main > 0 ? 1 : 0.5,
              }} />
            </span>
          </div>
        ))}
        {pump.untouched.length > 0 && (
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            안 하는 곳: {pump.untouched.join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomeworkoutPage() {
  const [selected, setSelected] = useState(null);
  // 시작하기 전에 무엇을 하는지 펼쳐 보는 자리
  const [preview, setPreview] = useState(null);
  // 지난번에 한 것 · 지금 되는 것만 좁혀 보기
  const [lastDone, setLastDone] = useState(readLastDone);
  const [onlyQuiet, setOnlyQuiet] = useState(false);
  const [onlyBare, setOnlyBare] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isRest, setIsRest] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const navigate = useNavigate();

  // ── 숨 보고 쉬기 (2026-09-22) ──
  //
  // **기능성에만 붙인다.** 10분을 쉬지 않고 도는 판이라 숨이 실제로 차고, 쉬는 시간이
  // 10~20초로 짧아서 「조금 더」가 뜻이 있다. 전신 초급에서 30초씩 쉬는 사람에게는
  // 늘려줄 것이 없다 — 되는 자리에만 두고, 되는지 봐서 넓힌다.
  //
  // **사용자가 켤 때만 켜진다.** 화면을 연다고 마이크가 켜지지 않는다
  const breathSense = useSettingsStore((st) => st.breathSense);
  const breath = useBreath(senseOf(breathSense));
  // **판을 안 돌려도 보는 자리** (2026-09-22).
  //
  // 쉬는 화면은 판을 시작하고 첫 동작(45초)을 버텨야 한 번 나온다. 그래서 눈으로
  // 확인하려면 매번 45초를 기다려야 했다 — 만든 사람도, 쓰는 사람도.
  // 여기서 **그 화면 그대로**를 열어본다. 열어두고 숨을 쉬면 파형이 움직인다
  const [peek, setPeek] = useState(false);
  // 판을 끝내면 여기서 바로 저장한다 — 기록 화면으로 보내 한 번 더 누르게 하지 않는다
  const addWorkout = useWorkoutStore((st) => st.addWorkout);
  const today = useToday();
  const keepAwake = useSettingsStore((st) => st.keepAwake);
  // 숨은 **설정함에서 켠다** (2026-09-22). 화면마다 따로 켜게 두면 한쪽만 켜둔 것을
  // 잊는다 — 소리·진동을 휴식 타이머 설정 하나로 모은 것과 같은 결이다
  const breathOn = useSettingsStore((st) => st.breath);
  const breathWhere = useSettingsStore((st) => st.breathWhere);
  const breathMax = useSettingsStore((st) => st.breathMax);
  // 이 휴식에서 이미 더 준 초. 휴식이 끝나면 0 으로 돌아간다
  const [extraGiven, setExtraGiven] = useState(0);
  // 동작마다 그 동안 가장 컸던 숨. 끝 화면의 「숨이 제일 찼던 동작」이 쓴다
  const peaksRef = useRef([]);
  const stepStartRef = useRef(0);
  // 소리와 진동은 휴식 타이머에서 이미 정한 값을 그대로 쓴다. 같은 「시간이 다 됐다」인데
  // 화면마다 따로 켜고 끄게 하면 한쪽만 꺼둔 것을 잊는다.
  //
  // **화면을 보고 있어야만 알 수 있으면 안 된다.** 플랭크를 하는 사람은 바닥을 보고 있고,
  // 런지 홀드를 하는 사람은 폰을 못 든다 — 소리가 나야 다음으로 넘어간 걸 안다
  const sound = useRestTimerStore((s) => s.sound);
  const vibrate = useRestTimerStore((s) => s.vibrate);
  // 어떤 소리로 얼마나 크게 알릴지도 같은 설정을 본다 — 휴식 타이머에서 고른 것이
  // 여기서도 그대로 난다. 화면마다 다른 소리가 나면 같은 앱으로 안 들린다
  const tone = useRestTimerStore((s) => s.tone);
  const volume = useRestTimerStore((s) => s.volume);
  const alertRef = useRef({ sound, vibrate, tone, volume });
  alertRef.current = { sound, vibrate, tone, volume };
  // 더보기의 「기능성(특수부대식)」처럼 한 프로그램으로 바로 오는 길. `?p=이름`
  //
  // 바로 시작하게 하지 않고 **펼쳐서** 보여준다 — 층간소음이나 식탁 대체 같은 말이
  // 미리 보기에만 있어서, 바로 타이머로 넘기면 그 말을 한 번도 못 보고 뛰게 된다.
  // 없는 이름이 와도 목록만 열린다 (안 터진다)
  const [params] = useSearchParams();
  const wanted = params.get('p');
  useEffect(() => {
    if (!wanted || !PROGRAMS[wanted]) return;
    setPreview(wanted);
    // 여섯째 카드라 펴놓기만 하면 화면 밖이다 — 그 카드로 데려간다
    const id = requestAnimationFrame(() => {
      document.getElementById('program-' + wanted)?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(id);
  }, [wanted]);

  const exercises = selected ? PROGRAMS[selected] : EMPTY;

  // ── 숨 보고 쉬기 — **켜고 끄는 것은 설정함이 한다** (2026-09-22) ──
  //
  // 처음에는 이 화면 안에 스위치를 뒀다. 그런데 루틴 휴식 타이머까지 넓히면
  // **화면마다 스위치가 생긴다** — 한쪽만 켜둔 것을 잊는다.
  // 소리·진동을 휴식 타이머 설정 하나로 모은 것과 같은 결이다.
  //
  // 기능성은 10분을 쉬지 않고 도는 판이라 숨이 실제로 차고, 쉬는 시간이 10~20초로
  // 짧아서 「조금 더」가 뜻이 있다. 30초씩 쉬는 판에서는 늘려줄 것이 없다 —
  // 그래서 설정에서 「운동할 때도」를 고르지 않는 한 **기능성에서만** 본다
  const breathable = micSupported() && breathOn
    && (breathWhere === 'all' || selected === '기능성(특수부대식)');

  // 여기까지 몸의 어디를 채웠나. 계산은 `data/homeworkoutParts.js` 가 한다 —
  // **쉬는 중이면 방금 끝낸 것까지** 센다(쉬는 동안은 그 동작을 이미 한 것이다)
  const pumpDone = isRest ? currentIdx + 1 : currentIdx;
  const pump = useMemo(() => buildPump(exercises, pumpDone), [exercises, pumpDone]);
  const current = exercises[currentIdx];

  // 지금 어느 단계인지. 화면 상태와 따로 ref 로도 들고 있는다 —
  // 1초마다 도는 타이머가 옛 렌더의 값을 붙잡고 있으면 안 된다
  const phaseRef = useRef({ idx: 0, rest: false, done: true });
  // 끝나는 시각. 남은 초를 1씩 빼는 대신 시계로 계산한다.
  // 빼는 방식은 화면을 내리거나 다른 탭을 보는 동안 브라우저가 타이머를 늦춰서,
  // 30초 플랭크가 1분이 되고 그동안 숫자는 멈춰 있다
  const deadlineRef = useRef(0);

  // 단계 전환은 여기 한 곳에서만 한다.
  //
  // 예전에는 effect 두 개가 각자 timeLeft 를 건드렸다. 휴식이 끝나 다음 운동으로
  // 넘어가는 commit 에서 둘이 같이 돌면서 서로를 덮어썼고, 그 결과 두 번째 운동부터는
  // 운동 단계가 통째로 사라지고 휴식만 운동 시간만큼 이어졌다.
  const beginPhase = (idx, rest) => {
    const step = exercises[idx];
    if (!step) return;
    const seconds = rest ? step.rest : step.duration;
    phaseRef.current = { idx, rest, done: false };
    deadlineRef.current = Date.now() + seconds * 1000;
    setCurrentIdx(idx);
    setIsRest(rest);
    setTimeLeft(seconds);
    // 새 단계가 시작되면 **더 준 초를 0 으로** 돌린다. 안 돌리면 앞 휴식에서 쓴 만큼이
    // 남아서, 다음 휴식에는 숨이 차 있어도 안 늘려준다
    setExtraGiven(0);
    stepStartRef.current = Date.now();
  };

  /**
   * 휴식을 몇 초 더 준다.
   *
   * 늘리는 것은 **끝나는 시각**이다 — 남은 초를 더하면 1초마다 도는 자리가 다음 칸에서
   * 다시 계산해 덮어쓴다(이 화면이 시계로 세는 까닭이 그것이다).
   */
  const addRest = (sec) => {
    if (sec <= 0) return;
    deadlineRef.current += sec * 1000;
    setExtraGiven((n) => n + sec);
    setTimeLeft(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
  };

  const advance = () => {
    const { idx, rest } = phaseRef.current;

    // ── 숨을 보고 쉬는 시간을 늘린다 ──
    //
    // **끝나려는 그 순간에 한 번만 본다.** 쉬는 내내 보면 숨이 한 번 튈 때마다
    // 늘어나서 휴식이 언제 끝날지 모르게 된다
    if (rest && breath.on && breath.phase === 'ready') {
      const add = extraFor(breath.state, extraGiven, breathMax);
      if (add > 0) { addRest(add); return; }
    }

    // 동작이 끝났으면 그 동안 가장 컸던 숨을 적어둔다 (끝 화면의 순위에 쓴다)
    if (!rest && breath.on && breath.phase === 'ready') {
      const ex = exercises[idx];
      if (ex?.name) {
        peaksRef.current = [
          ...peaksRef.current.filter((m) => m.index !== idx),
          { index: idx, name: ex.name, peak: breath.peakSince(stepStartRef.current) },
        ];
      }
    }

    // 단계가 바뀌는 그 순간에 알린다. 소리도 진동도 안 될 수 있어서(사파리는 진동이
    // 없고, 브라우저가 소리를 막기도 한다) 화면 표시는 언제나 같이 둔다
    beepDone(alertRef.current);
    // **그 소리를 마이크가 같이 듣는다.** 안 버리면 앱이 제 소리를 듣고 「숨이 찼다」고 한다
    breath.blind();
    // 운동이 끝났고 쉬는 시간이 있으면 쉰다. 마지막 운동 뒤에는 쉬지 않는다
    if (!rest && exercises[idx]?.rest > 0 && idx < exercises.length - 1) {
      beginPhase(idx, true);
      return;
    }
    const next = idx + 1;
    if (next >= exercises.length) {
      phaseRef.current = { idx, rest, done: true };
      setRunning(false);
      setFinished(true);
      // 다음에 왔을 때 「지난번에 한 것」으로 보여준다. 홈트는 서버에 안 쌓이니
      // 여기서 안 적으면 무엇을 했는지 아무 데도 안 남는다
      saveLastDone(selected);
      setLastDone(readLastDone());
      toast('기능성운동 완료!');
      return;
    }
    beginPhase(next, false);
  };

  // 1초마다 도는 자리가 붙잡고 있을 최신 `advance`. 없으면 처음 렌더의 것을 계속 쓴다
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  useEffect(() => {
    if (!running) return;
    // 250ms 마다 시계를 다시 본다. 1초 간격으로 재면 백그라운드에서 흐르지 않는다
    const id = setInterval(() => {
      if (phaseRef.current.done) return;
      const remain = deadlineRef.current - Date.now();
      // 올림으로 센다. 반올림하면 마지막 0.5초가 잘려 단계마다 조금씩 짧아진다
      setTimeLeft(Math.max(0, Math.ceil(remain / 1000)));
      if (remain <= 0) advanceRef.current();
    }, 250);
    return () => clearInterval(id);
  }, [running, selected]);

  // 운동하는 동안 화면을 안 재운다.
  //
  // 40초 플랭크를 하는데 30초에 화면이 꺼지면 남은 시간도, 다음이 뭔지도 못 본다.
  // 폰을 손으로 만질 수 없는 자세라서 더 그렇다.
  //
  // **2026-09-17 에 공용 훅으로 옮겼다** (`data/useWakeLock.js`) — 여기에만 있어서
  // 정작 매일 겪는 루틴 진행과 휴식 중에는 세트마다 폰을 깨워야 했다
  // 설정함에서 끌 수 있다 (2026-09-22)
  useWakeLock(running && keepAwake);

  // 멈춘 자리에 남은 밀리초. 이어서 하기가 이걸 본다
  const pausedLeftRef = useRef(0);

  // 처음부터 시작한다. 멈춰뒀던 자리는 버린다
  const startProgram = () => {
    if (!exercises.length) return;
    // 소리는 **사람이 누른 그 순간에** 준비해야 한다. 시간이 다 되는 시점은 아무도
    // 누르지 않은 시점이라, 그때 처음 만들면 브라우저가 막는다
    primeAudio();
    // **설정에서 켜뒀으면 여기서 같이 켠다.** 마이크 권한 창은 사람이 누른 그 순간에만
    // 뜨므로, 「시작하기」를 누른 이 자리가 유일하게 물어볼 수 있는 때다.
    // (기준선을 3초 재는 동안 첫 동작이 지나가지만, 첫 휴식 전에는 끝난다)
    if (breathable && !breath.on) breath.start();
    pausedLeftRef.current = 0;
    setFinished(false);
    setRunning(true);
    beginPhase(0, false);
  };

  // 일시정지.
  //
  // 예전에는 이 자리가 「중지」였고, 누르면 `running` 만 끄고 끝이었다.
  // 그런데 다시 「시작하기」를 누르면 `beginPhase(0, false)` 라 **처음부터** 돌았다.
  // 8개짜리를 하다가 5번째에서 전화를 받으면 **다섯 개를 다시 해야 했다.**
  //
  // 이제 멈춘 자리를 기억한다. 남은 초까지 그대로 들고 있다가 이어서 센다.
  const pauseProgram = () => {
    pausedLeftRef.current = Math.max(0, deadlineRef.current - Date.now());
    phaseRef.current = { ...phaseRef.current, done: true };
    setRunning(false);
  };

  const resumeProgram = () => {
    primeAudio();
    const left = pausedLeftRef.current;
    if (left <= 0) { startProgram(); return; }
    deadlineRef.current = Date.now() + left;
    phaseRef.current = { ...phaseRef.current, done: false };
    setTimeLeft(Math.ceil(left / 1000));
    setRunning(true);
  };

  // 못 하는 운동은 넘어갈 수 있어야 한다.
  //
  // 노르딕 컬이나 월 핸드스탠드는 오늘 안 되는 사람이 있다. 넘길 길이 없으면
  // 그 자리에서 20초를 서서 기다리거나 판을 통째로 그만둔다 — 둘 다 나쁘다.
  // 쉬는 시간이면 쉬는 것을 건너뛰고 바로 다음 운동으로 간다
  const skipStep = () => {
    if (!running) return;
    deadlineRef.current = Date.now();
    advance();
  };

  // 그만두기 — 처음으로 되돌린다
  const quitProgram = () => {
    pausedLeftRef.current = 0;
    phaseRef.current = { idx: 0, rest: false, done: true };
    setRunning(false);
    setCurrentIdx(0);
    setIsRest(false);
    setTimeLeft(0);
  };

  // 어디까지 했나. 끝냈으면 전부, 중간에 멈췄으면 지나온 것까지
  const doneCount = finished ? exercises.length : currentIdx;
  const doneSeconds = exercises
    .slice(0, doneCount)
    .reduce((sum, e) => sum + e.duration, 0);

  // 기록 화면으로 넘길 값.
  //
  // 예전에는 운동명만 넘겨서, 빈 폼에 이름만 적힌 채 **세트와 횟수를 지어내야** 했다
  // (둘 다 필수 칸이다). 홈트는 시간으로 하는 것이라 「한 운동 = 한 세트」로 세고,
  // 횟수는 1 로 둔다. 고치고 싶으면 그 자리에서 고치면 된다
  /**
   * 판을 **몸 지도까지** 남긴다 (2026-09-22).
   *
   * 여태 「기능성운동 - 이름」 한 줄로 기록 화면에 넘겼다. 그런데 몸 지도는 그 이름을
   * 못 읽어 **'기타'** 로 봤다 — 판을 다 해도 지도에 아무것도 안 칠해졌다.
   * 부위를 52개에 다 적어놓고 정작 지도로는 못 보내고 있었던 셈이다.
   *
   * 이제 **부위별로 묶어 그 자리에서 저장한다.** 기록 화면으로 보내 한 번 더 누르게
   * 하지 않는다 — 판을 끝낸 사람에게 저장 버튼을 두 번 누르게 할 이유가 없다.
   *
   * 못 올려도 **앱은 그대로 돈다**: 신호가 없으면 줄에 담겼다가 나중에 올라간다
   * (`workoutStore` 가 이미 그렇게 한다).
   */
  const goRecord = async (count) => {
    const rows = toRecords(exercises, count, selected);
    if (rows.length === 0) { toast('적을 것이 없어요'); return; }
    try {
      for (const r of rows) await addWorkout({ ...r, date: today });
      toast(`${rows.length}줄로 기록했어요 · 몸 지도에도 쌓였어요`);
      navigate('/history', { state: { date: today } });
    } catch {
      // 서버가 거절한 것은 다시 보내도 마찬가지다. 기록 화면으로 보내 손으로 적게 한다
      toast('기록을 못 올렸어요. 직접 적어주세요');
      navigate('/train', { state: { exercise: `${selected} · ${rows[0].exercise.split(' · ').pop()}` } });
    }
  };

  const totalTime = exercises.reduce((sum, e) => sum + e.duration + e.rest, 0);
  // 진행 막대는 **움직인 시간**으로 잰다. 쉬는 시간까지 넣으면 가만히 있는 동안에도
  // 막대가 자라서, 힘든 판과 쉬운 판이 같은 속도로 차오른다
  const workSeconds = exercises.reduce((sum, e) => sum + e.duration, 0);
  const nextEx = exercises[currentIdx + 1];

  // ── 고르는 화면 ──
  //
  // 머리에 **「장비 없이 집에서 할 수 있는 운동 프로그램」**이라고 적혀 있었다.
  // **그것이 사실이 아니었다** — 의자 · 식탁 · 수건 · 배낭 · 문틀바를 쓴다.
  // 집에 있는 것으로 대신하게 해둔 것이지 아무것도 안 쓰는 것이 아니다.
  // 「장비 없이」를 보고 들어온 사람이 배낭 파머스 워크 앞에서 멈춘다.
  //
  // 그래서 머리만 고치지 않고 **고르는 자리를 다시 짰다.** 집에서 하는 사람이
  // 고르기 전에 정말 묻는 것은 둘이다 —
  //   **「지금 이거 할 만한 게 집에 있나」**(준비물) 와
  //   **「이 시간에 뛰어도 되나」**(층간소음).
  // 둘 다 카드에 적고, 그 둘로 목록을 좁힐 수 있게 했다.
  //
  // 그리고 **지난번에 한 것**을 맨 위에 둔다. 홈트는 이어서 하는 물건이라
  // 열에 아홉은 저번에 하던 것을 또 한다.
  if (!selected) {
    const cards = PROGRAM_NAMES.map((name) => ({
      name,
      exs: PROGRAMS[name],
      gear: gearOf(name),
      loud: loudOf(name),
    }));
    const shown = cards.filter((c) => (!onlyQuiet || c.loud.length === 0) && (!onlyBare || c.gear.length === 0));
    const narrowed = onlyQuiet || onlyBare;

    return (
      <div>
        <div className="section-title">
          <div className="accent-bar" />
          기능성운동
        </div>
        {/* **「장비 없이」라고 적으면 안 된다.** 의자 · 수건 · 배낭을 쓴다 —
            운동기구를 안 쓰는 것이지 아무것도 안 쓰는 것이 아니다 */}
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.7 }}>
          운동기구 없이, 집에 있는 것(의자 · 수건 · 배낭)으로 하는 프로그램 {PROGRAM_NAMES.length}개입니다.
          <br />
          무엇이 필요하고 밤에 켜도 되는지를 카드에 적어뒀어요.
        </p>

        {/* 지난번에 한 것 — 홈트는 이어서 하는 물건이다.
            처음 온 사람에게는 안 그린다 (빈 자리를 남겨두면 고장 난 것으로 읽힌다) */}
        {lastDone && (
          <div className="card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ minWidth: 0, flexGrow: 1 }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: 1 }}>지난번에 한 것</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lastDone.name} <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>· {agoLabel(lastDone.at)}</span>
              </div>
            </div>
            <button
              className="btn-secondary"
              style={{ width: 'auto', flexShrink: 0, padding: '7px 14px', fontSize: 12.5 }}
              onClick={() => setSelected(lastDone.name)}
            >또 하기</button>
          </div>
        )}

        {/* 좁히기 — 집에서 하는 사람이 실제로 걸리는 두 가지다.
            여섯 개짜리 목록에 검색칸을 놓을 일은 아니고, 이 둘이면 충분하다 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            className={`btn-secondary${onlyQuiet ? ' active' : ''}`}
            aria-pressed={onlyQuiet}
            style={{ width: 'auto', padding: '7px 12px', fontSize: 12.5 }}
            onClick={() => setOnlyQuiet((v) => !v)}
          >밤에도 조용한 것</button>
          <button
            className={`btn-secondary${onlyBare ? ' active' : ''}`}
            aria-pressed={onlyBare}
            style={{ width: 'auto', padding: '7px 12px', fontSize: 12.5 }}
            onClick={() => setOnlyBare((v) => !v)}
          >준비물 없는 것</button>
        </div>

        {/* 조건에 맞는 것이 하나도 없을 수 있다. 빈 화면만 두면 고장으로 읽힌다 —
            무엇 때문에 비었는지 적고 되돌릴 길을 같이 준다 */}
        {shown.length === 0 && (
          <div className="card" style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            고르신 조건에 맞는 프로그램이 없어요.
            <button
              className="btn-secondary"
              style={{ marginTop: 10 }}
              onClick={() => { setOnlyQuiet(false); setOnlyBare(false); }}
            >조건 지우기</button>
          </div>
        )}

        {shown.map(({ name, exs, gear, loud }) => {
          const total = exs.reduce((sum, e) => sum + e.duration + e.rest, 0);
          const open = preview === name;
          const note = (PROGRAM_NOTES[name] || [])[0];
          return (
            <div key={name} id={'program-' + name} className="card" style={{ marginBottom: 8 }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPreview(open ? null : name)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreview(open ? null : name); } }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', gap: 10 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2 }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {exs.length}개 운동 · 약 {Math.ceil(total / 60)}분 · {open ? '접기' : '눌러서 미리 보기'}
                  </div>
                  {/* 이름 한 줄로는 옆 프로그램과 뭐가 다른지 모른다. 펼치지 않아도 보이게 한 줄 */}
                  {note && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.6 }}>{note}</div>
                  )}

                  {/* **고르기 전에 알아야 하는 둘.** 펼쳐야 보이면 늦다 —
                      배낭이 없는 사람은 시작하고 세 번째 운동에서 알게 된다 */}
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.7 }}>
                    <div>
                      {gear.length === 0
                        ? '준비물 없음 — 맨몸으로 합니다'
                        : `준비물 — ${gear.join(' · ')}`}
                    </div>
                    <div>
                      {loud.length === 0
                        ? '밤에도 그대로 — 뛰는 동작이 없습니다'
                        : `밤에는 ${loud.join(' · ')} ${loud.length === 1 ? '하나만' : '을'} 바꿔서 (미리 보기에 적어뒀어요)`}
                    </div>
                  </div>
                </div>
                <span className="badge badge-accent" style={{ flexShrink: 0 }}>{exs.length}개</span>
              </div>

              {open && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  {/* 이름만으로는 옆 프로그램과 뭐가 다른지 모른다 — 있는 것만 적어준다 */}
                  {(PROGRAM_NOTES[name] || []).map((line) => (
                    <p key={line} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 6px' }}>
                      {line}
                    </p>
                  ))}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: (PROGRAM_NOTES[name] ? '10px 0 12px' : '0 0 12px') }}>
                    {/* 이름만 적어두면 「스캡 푸시업」 앞에서 사람이 멈춘다.
                        어떻게 하는지를 운동 사전에서 가져와 같이 적는다 */}
                    {exs.map((e, i) => {
                      const how = descOf(e.name);
                      return (
                        <div key={`${e.name}-${i}`} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13, marginBottom: how ? 6 : 0 }}>
                          <span style={{ width: 18, color: 'var(--text-muted)', flexShrink: 0, fontSize: 11 }}>{i + 1}</span>
                          <div style={{ flexGrow: 1, minWidth: 0 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{e.name}</span>
                            {how && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 1 }}>{how}</div>
                            )}
                          </div>
                          <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>
                            {e.duration}초{e.rest > 0 ? ` · 쉬는 ${e.rest}초` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* ── 이 판이 어디를 채우나 (2026-09-22) ──
                      **고르기 전에 보여준다.** 「상체 집중」이라는 이름만으로는
                      가슴만 하는 판인지 등까지 하는 판인지 모른다. 부위는
                      `data/homeworkoutParts.js` 가 적어둔 것에서 온다 */}
                  <ProgramPump list={exs} />

                  {/* 숨 보고 쉬기가 켜져 있으면 **그렇다고만 적는다.** 켜고 끄는 것은
                      설정함이 한다 — 화면마다 스위치를 두면 한쪽만 켜둔 것을 잊는다 */}
                  {micSupported() && breathOn
                    && (breathWhere === 'all' || name === '기능성(특수부대식)') && (
                    <div style={{
                      fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6,
                      marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)',
                    }}>
                      <b style={{ color: 'var(--accent)' }}>숨 보고 쉬기</b>가 켜져 있어요 —
                      시작하면 마이크를 한 번 묻습니다.
                    </div>
                  )}

                  <button className="btn-primary" onClick={() => setSelected(name)}>시작하기</button>

                  {/* **쉬는 화면을 미리 본다.** 판을 시작해 45초를 버텨야 한 번
                      나오는 화면이라, 확인할 길이 없으면 아무도 확인을 못 한다 */}
                  <button
                    className="btn-secondary"
                    style={{ width: '100%', marginTop: 8, fontFamily: 'inherit', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); setPeek(peek === name ? false : name); }}
                  >{peek === name ? '미리 보기 닫기' : '쉬는 화면 미리 보기'}</button>

                  {peek === name && (
                    <div style={{
                      marginTop: 10, padding: 13, borderRadius: 'var(--radius)',
                      border: '1px dashed var(--border-hover)', background: 'var(--bg-secondary)',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
                        <b style={{ color: 'var(--text-secondary)' }}>미리 보기</b> — 판의 절반쯤 왔을 때
                        쉬는 화면이 이렇게 나와요. 숨을 켜두셨으면 <b style={{ color: 'var(--text-secondary)' }}>지금 숨을 쉬어보세요</b>,
                        파형이 움직입니다.
                      </div>
                      {name === '기능성(특수부대식)' && micSupported() && (
                        <BreathRow breath={breath} extraGiven={0} onSkip={() => {}} />
                      )}
                      <PumpRow
                        pump={buildPump(exs, Math.ceil(exs.length / 2))}
                        next={exs[Math.ceil(exs.length / 2)]}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* 좁혀서 안 보이는 것이 있으면 그렇다고 말한다. 안 적으면 프로그램이
            줄어든 줄 안다 */}
        {narrowed && shown.length > 0 && shown.length < cards.length && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.7 }}>
            조건에 맞는 {shown.length}개만 보이고 있어요 (전체 {cards.length}개).
          </div>
        )}
      </div>
    );
  }

  // 판을 다 했을 때의 몸 — **전부를 센다**(`pump` 는 진행 중 것이라 여기서는 못 쓴다)
  const donePump = buildPump(exercises, exercises.length);
  // 숨을 켜고 했으면 순위가 나온다. 안 켰으면 빈 것이라 그 칸이 통째로 안 그려진다
  const hardest = hardestOf(peaksRef.current, breath.base);

  // 완료 화면.
  //
  // 예전에는 「COMPLETE!」 한 줄이 전부였다 — **무엇을 얼마나 했는지가 없었다.**
  // 방금 한 것을 적어주고, 다시 할 길과 기록할 길을 같이 둔다.
  if (finished) {
    return (
      <div>
        <div style={{ textAlign: 'center', padding: '40px 0 28px' }}>
          {/* 이모지 그림은 폰 만든 회사 것이고 폰마다 다르게 나온다 — 직접 그린 선을 쓴다 */}
          <div style={{ color: 'var(--accent)', marginBottom: 10 }} aria-hidden="true">
            <NavIcon name="flame" size={40} />
          </div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: 3,
            color: 'var(--accent)', marginBottom: 8,
          }}>다 했어요</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {selected}
            <br />
            <span style={{ color: 'var(--text-primary)' }}>
              {exercises.length}개 운동 · 움직인 시간 {Math.round(doneSeconds / 60)}분
            </span>
          </div>
        </div>

        {/* ── 오늘 채운 곳 (2026-09-22) ──
            홈트는 여태 **몸 지도와 따로 놀았다** — 판을 다 해도 지도는 아무것도 몰랐다.
            여기서 무엇을 채웠는지 보여주고, 안 건드린 곳이 곧 다음에 할 곳이 된다 */}
        <div className="card" style={{ marginBottom: 14 }}>
          <PumpRow pump={donePump} next={null} />

          {/* 숨을 켜고 했으면 **순위만** 적는다. 점수가 아니고, 「하체가 뜨겁다」도 아니다 —
              숨이 찬 것과 근육이 타는 것은 다른 일이고 마이크는 앞의 것만 듣는다 */}
          {hardest.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 13, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 10.5, letterSpacing: 1.8, color: 'var(--info)', marginBottom: 8 }}>
                숨이 제일 찼던 동작
              </div>
              {hardest.map((m, i) => {
                const ex = exercises[m.index];
                const where = ex ? partsOf(ex).main.join('·') : '';
                const top = hardest[0].ratio || 1;
                return (
                  <div key={m.index} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, marginBottom: 6 }}>
                    <span style={{ width: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, color: 'var(--text-primary)', minWidth: 0, textAlign: 'left' }}>{m.name}</span>
                    <span style={{ width: 46, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                      <span style={{ display: 'block', height: '100%', borderRadius: 2, background: 'var(--info)', width: `${Math.round((m.ratio / top) * 100)}%` }} />
                    </span>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{where}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 눌렀을 때 **무슨 일이 나는지** 미리 적는다. 「기록에 남기기」가 몸 지도까지
              간다는 것은 눌러보기 전에는 모른다 */}
          <div style={{
            marginTop: 12, padding: '9px 11px', borderRadius: 6,
            border: '1px solid var(--border-hover)', background: 'var(--bg-secondary)',
            fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            아래를 누르면 <b style={{ color: 'var(--accent)' }}>부위별 {donePump.touched.length}줄</b>로 적히고
            <b style={{ color: 'var(--accent)' }}> 몸 지도</b>에도 쌓여요.
            {donePump.untouched.length > 0 && <> 안 한 {donePump.untouched[0]}이 「오늘 뭘 하지」에 올라옵니다.</>}
          </div>
        </div>

        <button className="btn-primary" onClick={() => goRecord(exercises.length)}>
          운동 기록에 남기기
        </button>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setFinished(false); startProgram(); }}>
            다시 하기
          </button>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setSelected(null); setFinished(false); quitProgram(); }}>
            목록으로
          </button>
        </div>
      </div>
    );
  }

  // 프로그램 상세 / 실행 화면
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>
          <div className="accent-bar" />
          {selected}
        </div>
        <button className="btn-secondary" style={{ width: 'auto', fontSize: 12, padding: '4px 12px' }} onClick={() => { quitProgram(); setSelected(null); }}>
          목록
        </button>
      </div>

      {/* 타이머.
          쉬는 20초 동안 **다음이 뭔지 모르면** 그 시간이 준비하는 시간이 못 된다.
          자세를 잡을 새 없이 시작 소리가 나고, 그제서야 이름을 읽는다.
          그래서 쉬는 화면은 다음 운동과 어떻게 하는지를 같이 보여준다 */}
      {running && current && (
        <div style={{ marginBottom: 24, padding: 24, background: isRest ? 'var(--bg-tertiary)' : 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          {/* 어디까지 왔는지 — 숫자만으로는 얼마나 남았는지 감이 안 온다 */}
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{
              width: `${Math.round((doneSeconds / Math.max(1, workSeconds)) * 100)}%`,
              height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: isRest ? 'var(--info)' : 'var(--accent)', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, marginBottom: 4 }}>
              {isRest ? '휴식' : `${currentIdx + 1} / ${exercises.length}`}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 3, marginBottom: 8, color: isRest ? 'var(--info)' : 'var(--text-primary)' }}>
              {isRest ? 'REST' : current.name}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, color: isRest ? 'var(--info)' : 'var(--accent)', lineHeight: 1 }}>
              {timeLeft}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>초</div>

            {/* ── 숨과 몸 (2026-09-22) ──
                **쉴 때만 그린다.** 버티는 45초 동안은 아무도 화면을 안 본다 —
                그때 파형을 흔들어봐야 볼 사람이 없다 */}
            {isRest && breathable && (
              <BreathRow breath={breath} extraGiven={extraGiven} onSkip={() => { setExtraGiven(99); advanceRef.current(); }} />
            )}
            {isRest && pump.done > 0 && (
              <PumpRow pump={pump} next={exercises[currentIdx + 1]} />
            )}

            {/* 쉴 때는 다음 운동을, 할 때는 지금 하는 것을 어떻게 하는지 적는다 */}
            {isRest ? (
              nextEx && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>다음</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, marginTop: 2 }}>
                    {nextEx.name} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{nextEx.duration}초</span>
                  </div>
                  {descOf(nextEx.name) && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 4 }}>{descOf(nextEx.name)}</div>
                  )}
                </div>
              )
            ) : (
              descOf(current.name) && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 12 }}>
                  {descOf(current.name)}
                </div>
              )
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={pauseProgram}>일시정지</button>
              {/* 오늘 안 되는 운동이 있다. 넘길 길이 없으면 서서 기다리거나 판을 접는다 */}
              <button className="btn-secondary" style={{ flex: 1 }} onClick={skipStep}>
                {isRest ? '바로 시작' : '건너뛰기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 시작 · 이어서 하기 */}
      {!running && (
        <div style={{ marginBottom: 16 }}>
          {pausedLeftRef.current > 0 ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                {currentIdx + 1}번째 {isRest ? '휴식' : '운동'}에서 멈췄어요 · {Math.ceil(pausedLeftRef.current / 1000)}초 남음
              </div>
              <button className="btn-primary" onClick={resumeProgram}>이어서 하기</button>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={startProgram}>처음부터</button>
                {/* 중간에 멈춘 만큼도 기록할 수 있어야 한다 —
                    예전에는 끝까지 해야만 「기록 저장」이 나왔다 */}
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => goRecord(currentIdx)} disabled={currentIdx < 1}>
                  여기까지 기록하기
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                총 {exercises.length}개 운동 · 약 {Math.ceil(totalTime / 60)}분
              </div>
              <button className="btn-primary" onClick={startProgram}>
                시작하기
              </button>
            </>
          )}
        </div>
      )}

      {/* 운동 목록 */}
      <div style={{ marginTop: 16 }}>
        {exercises.map((ex, i) => (
          <div
            key={i}
            className="card"
            style={{
              marginBottom: 6,
              borderColor: running && i === currentIdx && !isRest ? 'var(--accent)' : 'var(--border)',
              opacity: running && i < currentIdx ? 0.4 : 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: 'var(--text-muted)', width: 20, flexShrink: 0 }}>{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1 }}>{ex.name}</span>
                  {/* 어떻게 하는지를 여기에도 둔다 — 시작하기 전에 훑어보는 자리다 */}
                  {descOf(ex.name) && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 2 }}>{descOf(ex.name)}</div>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{ex.duration}초 {ex.rest > 0 ? `+ ${ex.rest}초 휴식` : ''}</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
