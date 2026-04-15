import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast, { toast } from '../components/Toast';

const PROGRAMS = {
  '전신 초급': [
    { name: '점핑잭', duration: 30, rest: 15 },
    { name: '스쿼트', duration: 30, rest: 15 },
    { name: '푸시업', duration: 30, rest: 15 },
    { name: '런지 (좌우)', duration: 30, rest: 15 },
    { name: '플랭크', duration: 30, rest: 15 },
    { name: '버피', duration: 20, rest: 20 },
    { name: '마운틴 클라이머', duration: 30, rest: 15 },
    { name: '슈퍼맨', duration: 30, rest: 0 },
  ],
  '상체 집중': [
    { name: '푸시업', duration: 30, rest: 15 },
    { name: '와이드 푸시업', duration: 30, rest: 15 },
    { name: '다이아몬드 푸시업', duration: 25, rest: 20 },
    { name: '딥스 (의자)', duration: 30, rest: 15 },
    { name: '파이크 푸시업', duration: 25, rest: 20 },
    { name: '플랭크 숄더탭', duration: 30, rest: 15 },
    { name: '인클라인 푸시업', duration: 30, rest: 15 },
    { name: '플랭크', duration: 40, rest: 0 },
  ],
  '하체 집중': [
    { name: '스쿼트', duration: 30, rest: 15 },
    { name: '와이드 스쿼트', duration: 30, rest: 15 },
    { name: '런지', duration: 30, rest: 15 },
    { name: '불가리안 스플릿 스쿼트', duration: 30, rest: 20 },
    { name: '힙쓰러스트', duration: 30, rest: 15 },
    { name: '카프레이즈', duration: 30, rest: 15 },
    { name: '점프 스쿼트', duration: 25, rest: 20 },
    { name: '월싯', duration: 40, rest: 0 },
  ],
  '코어 강화': [
    { name: '크런치', duration: 30, rest: 15 },
    { name: '레그레이즈', duration: 30, rest: 15 },
    { name: '플랭크', duration: 40, rest: 15 },
    { name: '사이드 플랭크 (좌)', duration: 25, rest: 10 },
    { name: '사이드 플랭크 (우)', duration: 25, rest: 15 },
    { name: '바이시클 크런치', duration: 30, rest: 15 },
    { name: '마운틴 클라이머', duration: 30, rest: 15 },
    { name: '데드버그', duration: 30, rest: 0 },
  ],
  '유산소 타바타': [
    { name: '점핑잭', duration: 20, rest: 10 },
    { name: '하이니', duration: 20, rest: 10 },
    { name: '버피', duration: 20, rest: 10 },
    { name: '마운틴 클라이머', duration: 20, rest: 10 },
    { name: '점프 스쿼트', duration: 20, rest: 10 },
    { name: '스케이터', duration: 20, rest: 10 },
    { name: '터크점프', duration: 20, rest: 10 },
    { name: '점핑 런지', duration: 20, rest: 0 },
  ],
};

const PROGRAM_NAMES = Object.keys(PROGRAMS);

export default function HomeworkoutPage() {
  const [selected, setSelected] = useState(null);
  const [running, setRunning] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isRest, setIsRest] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  const exercises = selected ? PROGRAMS[selected] : [];
  const current = exercises[currentIdx];

  // 타이머 로직
  useEffect(() => {
    if (!running) return;

    if (timeLeft <= 0) {
      // 다음 단계로
      if (isRest) {
        // 휴식 끝 → 다음 운동
        setIsRest(false);
        setCurrentIdx(prev => prev + 1);
      } else {
        // 운동 끝
        if (current?.rest > 0 && currentIdx < exercises.length - 1) {
          // 휴식 시작
          setIsRest(true);
          setTimeLeft(current.rest);
          return;
        } else {
          // 마지막 운동이거나 휴식 없음
          const nextIdx = currentIdx + 1;
          if (nextIdx >= exercises.length) {
            // 프로그램 완료
            setRunning(false);
            setFinished(true);
            toast('홈트 완료!');
            return;
          }
          setCurrentIdx(nextIdx);
        }
      }
      return;
    }

    timerRef.current = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timerRef.current);
  }, [running, timeLeft, isRest, currentIdx]);

  // currentIdx 변경 시 운동 시간 세팅
  useEffect(() => {
    if (running && !isRest && exercises[currentIdx]) {
      setTimeLeft(exercises[currentIdx].duration);
    }
  }, [currentIdx, running, isRest, exercises]);

  const startProgram = () => {
    if (!exercises.length) return;
    setCurrentIdx(0);
    setIsRest(false);
    setFinished(false);
    setTimeLeft(exercises[0].duration);
    setRunning(true);
  };

  const stopProgram = () => {
    setRunning(false);
    clearTimeout(timerRef.current);
  };

  const totalTime = exercises.reduce((sum, e) => sum + e.duration + e.rest, 0);

  // 프로그램 선택 화면
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
          const total = exs.reduce((s, e) => s + e.duration + e.rest, 0);
          return (
            <div
              key={name}
              className="card clickable"
              style={{ marginBottom: 8 }}
              onClick={() => setSelected(name)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2 }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {exs.length}개 운동 · 약 {Math.ceil(total / 60)}분
                  </div>
                </div>
                <span className="badge badge-accent">{exs.length}SET</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 완료 화면
  if (finished) {
    return (
      <div>
        <div className="empty-state" style={{ color: 'var(--accent)' }}>
          <div className="empty-state-title" style={{ color: 'var(--accent)' }}>COMPLETE!</div>
          <div className="empty-state-desc" style={{ color: 'var(--text-secondary)' }}>
            {selected} 프로그램을 완료했어요
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setSelected(null); setFinished(false); }}>
            목록으로
          </button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={() => navigate('/workout', { state: { exercise: `홈트 - ${selected}` } })}>
            기록 저장
          </button>
        </div>
        <Toast />
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
        <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => { stopProgram(); setSelected(null); }}>
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
            onClick={stopProgram}
          >
            중지
          </button>
        </div>
      )}

      {/* 시작 버튼 */}
      {!running && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            총 {exercises.length}개 운동 · 약 {Math.ceil(totalTime / 60)}분
          </div>
          <button className="btn-primary" onClick={startProgram}>
            시작하기
          </button>
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
      <Toast />
    </div>
  );
}
