import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../components/Toast';
import { PROGRAMS, PROGRAM_NOTES } from '../data/homeworkoutPrograms';

const PROGRAM_NAMES = Object.keys(PROGRAMS);

// 고르기 전 빈 목록. 매 렌더 새로 만들면 effect 가 그때마다 다시 돈다
const EMPTY = [];

export default function HomeworkoutPage() {
  const [selected, setSelected] = useState(null);
  // 시작하기 전에 무엇을 하는지 펼쳐 보는 자리
  const [preview, setPreview] = useState(null);
  const [running, setRunning] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isRest, setIsRest] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const navigate = useNavigate();

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
      toast('홈트 완료!');
      return;
    }
    beginPhase(next, false);
  };

  useEffect(() => {
    if (!running) return;
    // 250ms 마다 시계를 다시 본다. 1초 간격으로 재면 백그라운드에서 흐르지 않는다
    const id = setInterval(() => {
      if (phaseRef.current.done) return;
      const remain = deadlineRef.current - Date.now();
      // 올림으로 센다. 반올림하면 마지막 0.5초가 잘려 단계마다 조금씩 짧아진다
      setTimeLeft(Math.max(0, Math.ceil(remain / 1000)));
      if (remain <= 0) advance();
    }, 250);
    return () => clearInterval(id);
  }, [running, selected]);

  // 멈춘 자리에 남은 밀리초. 이어서 하기가 이걸 본다
  const pausedLeftRef = useRef(0);

  // 처음부터 시작한다. 멈춰뒀던 자리는 버린다
  const startProgram = () => {
    if (!exercises.length) return;
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
    const left = pausedLeftRef.current;
    if (left <= 0) { startProgram(); return; }
    deadlineRef.current = Date.now() + left;
    phaseRef.current = { ...phaseRef.current, done: false };
    setTimeLeft(Math.ceil(left / 1000));
    setRunning(true);
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
    state: { exercise: `홈트 - ${selected}`, sets: String(Math.max(1, count)), reps: '1' },
  });

  const totalTime = exercises.reduce((sum, e) => sum + e.duration + e.rest, 0);

  // 프로그램 선택 화면
  //
  // 예전에는 이름 · 개수 · 걸리는 시간만 보여줬다. **무엇을 하는지는 시작해봐야 알았다.**
  // 8개짜리 프로그램을 고르면서 그 안에 뭐가 들었는지 모르고 누르는 셈이었다.
  // 이제 눌러서 미리 볼 수 있다.
  if (!selected) {
    return (
      <div>
        <div className="section-title">
          <div className="accent-bar" />
          홈트레이닝
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          장비 없이 집에서 할 수 있는 운동 프로그램
        </p>
        {PROGRAM_NAMES.map((name) => {
          const exs = PROGRAMS[name];
          const total = exs.reduce((sum, e) => sum + e.duration + e.rest, 0);
          const open = preview === name;
          return (
            <div key={name} className="card" style={{ marginBottom: 8 }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPreview(open ? null : name)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreview(open ? null : name); } }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 10 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2 }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {exs.length}개 운동 · 약 {Math.ceil(total / 60)}분 · {open ? '접기' : '눌러서 미리 보기'}
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
                    {exs.map((e, i) => (
                      <div key={`${e.name}-${i}`} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
                        <span style={{ width: 18, color: 'var(--text-muted)', flexShrink: 0, fontSize: 11 }}>{i + 1}</span>
                        <span style={{ flexGrow: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>
                          {e.duration}초{e.rest > 0 ? ` · 쉬는 ${e.rest}초` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button className="btn-primary" onClick={() => setSelected(name)}>시작하기</button>
                </div>
              )}
            </div>
          );
        })}
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
          <div style={{ fontSize: 40, marginBottom: 10 }} aria-hidden="true">💪</div>
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

      {/* 타이머 */}
      {running && current && (
        <div style={{ textAlign: 'center', marginBottom: 24, padding: 24, background: isRest ? 'var(--bg-tertiary)' : 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
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

          <button
            className="btn-secondary"
            style={{ marginTop: 16 }}
            onClick={pauseProgram}
          >
            일시정지
          </button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: 'var(--text-muted)', width: 20 }}>{i + 1}</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1 }}>{ex.name}</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ex.duration}초 {ex.rest > 0 ? `+ ${ex.rest}초 휴식` : ''}</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
