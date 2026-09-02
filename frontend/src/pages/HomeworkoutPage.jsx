import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../components/Toast';
import NavIcon from '../components/NavIcon';
import { PROGRAMS, PROGRAM_NOTES, descOf, gearOf, loudOf } from '../data/homeworkoutPrograms';
import { readLS, saveLS } from '../data/safeStorage';
import { primeAudio, beepDone } from '../data/alertSound';
import { useRestTimerStore } from '../store/restTimerStore';

const PROGRAM_NAMES = Object.keys(PROGRAMS);

// 지난번에 한 프로그램. **여기에만 남는다** — 홈트는 아직 서버에 안 쌓인다
// (「운동 기록에 남기기」를 눌러야 기록이 된다). 그래서 기기의 것으로만 적는다.
//
// 열쇠의 `steelbody_` 는 옛 앱 이름이다. 앱 이름이 바뀌어도 안 바꾼다
const LS_LAST = 'steelbody_home_last';

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
  };

  const advance = () => {
    const { idx, rest } = phaseRef.current;
    // 단계가 바뀌는 그 순간에 알린다. 소리도 진동도 안 될 수 있어서(사파리는 진동이
    // 없고, 브라우저가 소리를 막기도 한다) 화면 표시는 언제나 같이 둔다
    beepDone(alertRef.current);
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
  // 폰을 손으로 만질 수 없는 자세라서 더 그렇다. 안 되는 브라우저(사파리 일부)에서는
  // 조용히 넘어간다 — 이것만 믿고 다른 것을 빼지 않는다
  useEffect(() => {
    if (!running || !navigator.wakeLock) return;
    let lock = null;
    let dropped = false;
    const grab = () => navigator.wakeLock.request('screen')
      .then((l) => { if (dropped) l.release().catch(() => {}); else lock = l; })
      .catch(() => {});
    grab();
    // 다른 앱을 봤다 돌아오면 잠금이 풀려 있다 — 다시 잡는다
    const onVisible = () => { if (document.visibilityState === 'visible') grab(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      dropped = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [running]);

  // 멈춘 자리에 남은 밀리초. 이어서 하기가 이걸 본다
  const pausedLeftRef = useRef(0);

  // 처음부터 시작한다. 멈춰뒀던 자리는 버린다
  const startProgram = () => {
    if (!exercises.length) return;
    // 소리는 **사람이 누른 그 순간에** 준비해야 한다. 시간이 다 되는 시점은 아무도
    // 누르지 않은 시점이라, 그때 처음 만들면 브라우저가 막는다
    primeAudio();
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
  const goRecord = (count) => navigate('/workout', {
    state: { exercise: `기능성운동 - ${selected}`, sets: String(Math.max(1, count)), reps: '1' },
  });

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
                  <button className="btn-primary" onClick={() => setSelected(name)}>시작하기</button>
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
