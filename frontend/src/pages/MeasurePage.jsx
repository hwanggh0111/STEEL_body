import { useState, useEffect, useRef } from 'react';
import client from '../api/client';
import Toast, { toast } from '../components/Toast';

// ─── 전신 사이즈 ───
const SIZE_FIELDS = [
  { key: 'chest', label: '가슴둘레', unit: 'cm', placeholder: '95' },
  { key: 'waist', label: '허리둘레', unit: 'cm', placeholder: '78' },
  { key: 'hip', label: '엉덩이둘레', unit: 'cm', placeholder: '95' },
  { key: 'arm_l', label: '왼팔둘레', unit: 'cm', placeholder: '35' },
  { key: 'arm_r', label: '오른팔둘레', unit: 'cm', placeholder: '35' },
  { key: 'thigh_l', label: '왼허벅지', unit: 'cm', placeholder: '55' },
  { key: 'thigh_r', label: '오른허벅지', unit: 'cm', placeholder: '55' },
  { key: 'calf', label: '종아리둘레', unit: 'cm', placeholder: '38' },
  { key: 'neck', label: '목둘레', unit: 'cm', placeholder: '38' },
];

function BodySizeSection({ records, onSave, onDelete }) {
  const [values, setValues] = useState({});
  const [openIdx, setOpenIdx] = useState(null);

  const handleSave = () => {
    const filled = Object.entries(values).filter(([, v]) => v);
    if (filled.length === 0) { toast('최소 1개 항목을 입력해주세요'); return; }
    onSave({ ...values });
    setValues({});
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />전신 사이즈 측정</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>줄자로 각 부위의 둘레를 측정하세요</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6, marginBottom: 10 }}>
        {SIZE_FIELDS.map(f => (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            <input className="input" type="number" step="0.1" placeholder={f.placeholder}
              value={values[f.key] || ''} onChange={e => setValues({ ...values, [f.key]: e.target.value })}
              style={{ fontSize: 13 }} />
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={handleSave} style={{ marginBottom: 12 }}>측정 저장</button>

      {records.map((r, i) => (
        <div key={r.id} className="card" style={{ marginBottom: 6, cursor: 'pointer', borderColor: openIdx === i ? 'var(--accent)' : 'var(--border)' }}
          onClick={() => setOpenIdx(openIdx === i ? null : i)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.date}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {r.data?.chest && <span style={{ fontSize: 12 }}>가슴 <strong style={{ color: 'var(--accent)' }}>{r.data.chest}</strong></span>}
              {r.data?.arm_r && <span style={{ fontSize: 12 }}>팔 <strong>{r.data.arm_r}</strong></span>}
              <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(r.id); }}>✕</button>
            </div>
          </div>
          {openIdx === i && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {SIZE_FIELDS.map(f => r.data?.[f.key] && (
                <span key={f.key} style={{ fontSize: 12 }}>{f.label} <strong>{r.data[f.key]}{f.unit}</strong></span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── 1RM 계산기 ───
function OneRMSection({ records, onSave }) {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [result, setResult] = useState(null);

  const calc1RM = () => {
    if (!weight || !reps) return;
    const w = Number(weight);
    const r = Number(reps);
    if (r < 1 || r > 36) { toast('횟수는 1~36 범위여야 해요', 'error'); return; }
    if (r > 10) { toast('10회 초과 시 정확도가 낮아요', 'warning'); }
    // Brzycki 공식
    const orm = r === 1 ? w : Math.round(w * (36 / (37 - r)));
    setResult(orm);
  };

  const handleSave = (exercise) => {
    if (!result) return;
    onSave({ exercise, weight: Number(weight), reps: Number(reps), orm: result });
    toast(`${exercise} 1RM ${result}kg 저장!`);
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />1RM 계산기</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>무게와 횟수(1~10회)를 입력하면 예상 1RM을 계산합니다 (Brzycki 공식, 10회 이하에서 정확)</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="label">무게 (kg)</label>
          <input className="input" type="number" placeholder="80" value={weight} onChange={e => { setWeight(e.target.value); setResult(null); }} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label">횟수</label>
          <input className="input" type="number" placeholder="5" value={reps} onChange={e => { setReps(e.target.value); setResult(null); }} />
        </div>
      </div>
      <button className="btn-primary" onClick={calc1RM} style={{ marginBottom: 10 }}>계산</button>

      {result && (
        <div className="card" style={{ marginBottom: 12, textAlign: 'center', borderColor: 'var(--accent)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>예상 1RM</div>
          <div className="stat-number" style={{ fontSize: 40 }}>{result}<span style={{ fontSize: 16, color: 'var(--text-muted)' }}>kg</span></div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            {['벤치프레스', '스쿼트', '데드리프트', '숄더프레스'].map(ex => (
              <button key={ex} className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => handleSave(ex)}>{ex}로 저장</button>
            ))}
          </div>
        </div>
      )}

      {records.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>기록</div>
          {records.slice(0, 5).map(r => (
            <div key={r.id} className="card" style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1 }}>{r.data?.exercise}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{r.data?.weight}kg × {r.data?.reps}회</span>
              </div>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--accent)' }}>{r.data?.orm}kg</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── 체력 테스트 ───
const FITNESS_TESTS = [
  { key: 'pushup', label: '푸시업 최대', unit: '개', placeholder: '30' },
  { key: 'pullup', label: '풀업 최대', unit: '개', placeholder: '10' },
  { key: 'plank', label: '플랭크 최대', unit: '초', placeholder: '120' },
  { key: 'run_1km', label: '1km 달리기', unit: '초', placeholder: '300' },
  { key: 'situp', label: '윗몸일으키기 1분', unit: '개', placeholder: '40' },
  { key: 'squat_max', label: '스쿼트 최대', unit: '개', placeholder: '50' },
];

function FitnessTestSection({ records, onSave }) {
  const [values, setValues] = useState({});

  const handleSave = () => {
    const filled = Object.entries(values).filter(([, v]) => v);
    if (filled.length === 0) { toast('최소 1개 항목을 입력해주세요'); return; }
    onSave({ ...values });
    setValues({});
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />체력 테스트</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        {FITNESS_TESTS.map(f => (
          <div key={f.key}>
            <label className="label">{f.label} ({f.unit})</label>
            <input className="input" type="number" placeholder={f.placeholder}
              value={values[f.key] || ''} onChange={e => setValues({ ...values, [f.key]: e.target.value })}
              style={{ fontSize: 13 }} />
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={handleSave} style={{ marginBottom: 12 }}>기록 저장</button>

      {records.slice(0, 3).map(r => (
        <div key={r.id} className="card" style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{r.date}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {FITNESS_TESTS.map(f => r.data?.[f.key] && (
              <span key={f.key} style={{ fontSize: 12 }}>{f.label} <strong style={{ color: 'var(--accent)' }}>{r.data[f.key]}{f.unit}</strong></span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 심박수 계산기 ───
function HeartRateSection() {
  const [age, setAge] = useState('');
  const [restHR, setRestHR] = useState('');
  const maxHR = age ? 220 - Number(age) : null;

  const zones = maxHR ? [
    { zone: '존1 (회복)', min: Math.round(maxHR * 0.5), max: Math.round(maxHR * 0.6), color: 'var(--info)', desc: '가벼운 활동, 워밍업' },
    { zone: '존2 (지방연소)', min: Math.round(maxHR * 0.6), max: Math.round(maxHR * 0.7), color: 'var(--success)', desc: '유산소 기초, 체지방 연소 최적' },
    { zone: '존3 (유산소)', min: Math.round(maxHR * 0.7), max: Math.round(maxHR * 0.8), color: 'var(--accent)', desc: '심폐지구력 향상' },
    { zone: '존4 (젖산역치)', min: Math.round(maxHR * 0.8), max: Math.round(maxHR * 0.9), color: 'var(--warning)', desc: '고강도 인터벌, 속도 향상' },
    { zone: '존5 (최대)', min: Math.round(maxHR * 0.9), max: maxHR, color: 'var(--danger)', desc: '전력질주, 단시간만 유지 가능' },
  ] : [];

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />심박수 존 계산기</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="label">나이</label>
          <input className="input" type="number" placeholder="25" value={age} onChange={e => setAge(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label">안정시 심박수 (선택)</label>
          <input className="input" type="number" placeholder="65" value={restHR} onChange={e => setRestHR(e.target.value)} />
        </div>
      </div>

      {maxHR && (
        <>
          <div className="card" style={{ textAlign: 'center', marginBottom: 12, borderColor: 'var(--accent)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>최대 심박수 (220 - 나이)</div>
            <div className="stat-number" style={{ fontSize: 36 }}>{maxHR}<span style={{ fontSize: 14, color: 'var(--text-muted)' }}>bpm</span></div>
          </div>
          {zones.map(z => (
            <div key={z.zone} className="card" style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: z.color }}>{z.zone}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{z.desc}</div>
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: z.color, letterSpacing: 1 }}>
                {z.min}~{z.max}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── 스톱워치 / 타이머 ───
function StopwatchSection({ onSave }) {
  const [mode, setMode] = useState('stopwatch');
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [laps, setLaps] = useState([]);
  const [timerInput, setTimerInput] = useState('60');
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTime(prev => {
          if (mode === 'timer') {
            if (prev <= 0) {
              setRunning(false);
              toast('타이머 종료!');
              return 0;
            }
            return prev - 100;
          }
          return prev + 100;
        });
      }, 100);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, mode]);

  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const dec = Math.floor((ms % 1000) / 100);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${dec}`;
  };

  const handleStart = () => {
    if (mode === 'timer' && !running && time === 0) {
      setTime(Number(timerInput) * 1000);
    }
    setRunning(true);
  };

  const handleStop = () => setRunning(false);

  const handleReset = () => {
    setRunning(false);
    setTime(0);
    setLaps([]);
  };

  const handleLap = () => {
    setLaps(prev => [time, ...prev]);
  };

  const handleSaveRecord = () => {
    if (time === 0) return;
    onSave({ time, formatted: formatTime(time), laps: laps.map(l => formatTime(l)) });
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />스톱워치 / 타이머</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button className={`btn-secondary${mode === 'stopwatch' ? ' active' : ''}`}
          onClick={() => { handleReset(); setMode('stopwatch'); }} style={{ fontSize: 12, padding: '6px 14px' }}>스톱워치</button>
        <button className={`btn-secondary${mode === 'timer' ? ' active' : ''}`}
          onClick={() => { handleReset(); setMode('timer'); }} style={{ fontSize: 12, padding: '6px 14px' }}>타이머</button>
      </div>

      {mode === 'timer' && !running && time === 0 && (
        <div style={{ marginBottom: 10 }}>
          <label className="label">시간 (초)</label>
          <input className="input" type="number" value={timerInput} onChange={e => setTimerInput(e.target.value)} placeholder="60" />
        </div>
      )}

      <div style={{ textAlign: 'center', padding: 20 }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 56,
          color: running ? 'var(--accent)' : 'var(--text-primary)',
          letterSpacing: 4,
          lineHeight: 1,
          transition: 'color 0.2s',
        }}>
          {formatTime(time)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {!running ? (
          <button className="btn-primary" onClick={handleStart} style={{ flex: 1 }}>
            {time > 0 && mode === 'stopwatch' ? '이어하기' : '시작'}
          </button>
        ) : (
          <button className="btn-primary" onClick={handleStop} style={{ flex: 1, background: 'var(--danger)' }}>정지</button>
        )}
        {mode === 'stopwatch' && running && (
          <button className="btn-secondary active" onClick={handleLap} style={{ padding: '10px 16px' }}>랩</button>
        )}
        <button className="btn-secondary" onClick={handleReset} style={{ padding: '10px 16px' }}>초기화</button>
        {time > 0 && !running && (
          <button className="btn-secondary" onClick={handleSaveRecord} style={{ padding: '10px 16px' }}>저장</button>
        )}
      </div>

      {laps.length > 0 && (
        <div className="card">
          {laps.map((l, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < laps.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>랩 {laps.length - i}</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: 'var(--accent)', letterSpacing: 1 }}>{formatTime(l)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 유연성 측정 ───
const FLEX_FIELDS = [
  { key: 'sitreach', label: '앉아 앞으로 굽히기', unit: 'cm', placeholder: '15', desc: '다리 펴고 앉아서 손끝이 발끝을 넘는 거리' },
  { key: 'shoulder_l', label: '왼쪽 어깨 유연성', unit: 'cm', placeholder: '5', desc: '등 뒤에서 양손 사이 거리 (0이면 닿음)' },
  { key: 'shoulder_r', label: '오른쪽 어깨 유연성', unit: 'cm', placeholder: '5', desc: '등 뒤에서 양손 사이 거리' },
  { key: 'squat_depth', label: '스쿼트 깊이', unit: 'cm', placeholder: '0', desc: '엉덩이가 무릎 아래로 내려간 거리 (0=평행)' },
];

function FlexibilitySection({ records, onSave }) {
  const [values, setValues] = useState({});

  const handleSave = () => {
    const filled = Object.entries(values).filter(([, v]) => v);
    if (filled.length === 0) { toast('최소 1개 항목을 입력해주세요'); return; }
    onSave({ ...values });
    setValues({});
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />유연성 측정</div>
      {FLEX_FIELDS.map(f => (
        <div key={f.key} style={{ marginBottom: 8 }}>
          <label className="label">{f.label} ({f.unit})</label>
          <input className="input" type="number" step="0.1" placeholder={f.placeholder}
            value={values[f.key] || ''} onChange={e => setValues({ ...values, [f.key]: e.target.value })} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{f.desc}</div>
        </div>
      ))}
      <button className="btn-primary" onClick={handleSave} style={{ marginBottom: 12 }}>기록 저장</button>

      {records.slice(0, 3).map(r => (
        <div key={r.id} className="card" style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{r.date}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {FLEX_FIELDS.map(f => r.data?.[f.key] && (
              <span key={f.key} style={{ fontSize: 12 }}>{f.label} <strong style={{ color: 'var(--accent)' }}>{r.data[f.key]}{f.unit}</strong></span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 어깨 측정 ───
function getShoulderType(width) {
  if (width < 38) return { label: '좁은 어깨', color: 'var(--info)', emoji: '📐' };
  if (width < 42) return { label: '보통 어깨', color: 'var(--text-secondary)', emoji: '📏' };
  if (width < 46) return { label: '넓은 어깨', color: 'var(--success)', emoji: '💪' };
  if (width < 50) return { label: '광배 어깨', color: 'var(--accent)', emoji: '🔥' };
  return { label: '문짝 어깨', color: 'var(--danger)', emoji: '🚪' };
}

function getRatioGrade(ratio) {
  if (!ratio) return null;
  const r = Number(ratio);
  if (r >= 1.6) return { label: '역삼각형 (이상적)', color: 'var(--success)' };
  if (r >= 1.45) return { label: '좋은 비율', color: 'var(--accent)' };
  if (r >= 1.3) return { label: '보통 비율', color: 'var(--text-secondary)' };
  return { label: '개선 필요', color: 'var(--warning)' };
}

function ShoulderSection({ records, onSave, onDelete }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [shoulderWidth, setShoulderWidth] = useState('');
  const [waist, setWaist] = useState('');

  const type = shoulderWidth ? getShoulderType(Number(shoulderWidth)) : null;
  const ratio = shoulderWidth && waist ? (Number(shoulderWidth) / Number(waist)).toFixed(2) : null;
  const ratioGrade = getRatioGrade(ratio);

  const handleSave = (e) => {
    e.preventDefault();
    if (!shoulderWidth) { toast('어깨 너비를 입력해주세요'); return; }
    onSave({ date, shoulder: Number(shoulderWidth), waist: waist ? Number(waist) : null, ratio: ratio ? Number(ratio) : null });
    setShoulderWidth(''); setWaist('');
  };

  const latest = records[0];
  const oldest = records.length >= 2 ? records[records.length - 1] : null;
  const latestShoulder = latest?.data?.shoulder;
  const oldestShoulder = oldest?.data?.shoulder;
  const diff = latestShoulder && oldestShoulder ? (latestShoulder - oldestShoulder).toFixed(1) : null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />어깨 측정</div>
      <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5, color: 'var(--accent)', marginBottom: 6 }}>측정 방법</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          1. 줄자를 준비하세요<br />
          2. 왼쪽 어깨 끝(견봉) → 오른쪽 어깨 끝(견봉)까지 측정<br />
          3. 등 뒤로 줄자를 돌리지 말고 일직선으로 측정<br />
          4. 허리둘레는 배꼽 높이에서 측정 (선택)
        </div>
      </div>

      <form onSubmit={handleSave} style={{ marginBottom: 24 }}>
        <label className="label">날짜</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="label">어깨 너비 (cm)</label>
            <input className="input" type="number" step="0.1" placeholder="45" value={shoulderWidth} onChange={(e) => setShoulderWidth(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">허리둘레 (cm) - 선택</label>
            <input className="input" type="number" step="0.1" placeholder="30" value={waist} onChange={(e) => setWaist(e.target.value)} />
          </div>
        </div>

        {shoulderWidth && (
          <div className="card" style={{ marginBottom: 12, background: 'var(--bg-tertiary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>어깨 분류</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: type.color, letterSpacing: 1.5 }}>{type.emoji} {type.label}</span>
            </div>
            {ratio && ratioGrade && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13 }}>어깨:허리 비율</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5 }}>
                  <span style={{ color: ratioGrade.color }}>{ratio}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>{ratioGrade.label}</span>
                </span>
              </div>
            )}
          </div>
        )}
        <button className="btn-primary" type="submit">측정 저장</button>
      </form>

      {diff && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
          <div className="stat-box"><div className="stat-number">{latestShoulder}</div><div className="stat-label">최근 (cm)</div></div>
          <div className="stat-box"><div className="stat-number">{oldestShoulder}</div><div className="stat-label">처음 (cm)</div></div>
          <div className="stat-box">
            <div className="stat-number" style={{ color: Number(diff) > 0 ? 'var(--success)' : Number(diff) < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{Number(diff) > 0 ? '+' : ''}{diff}</div>
            <div className="stat-label">변화량</div>
          </div>
        </div>
      )}

      <div className="section-title"><div className="accent-bar" />측정 기록</div>
      {records.length === 0 ? (
        <div className="empty-state"><div className="empty-state-title">데이터 없음</div><div className="empty-state-desc">어깨 측정 기록이 없어요</div></div>
      ) : records.map((r) => {
        const t = getShoulderType(r.data?.shoulder);
        const rg = r.data?.ratio ? getRatioGrade(r.data.ratio) : null;
        return (
          <div key={r.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{r.date}</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>어깨 <strong style={{ color: t.color }}>{r.data?.shoulder}cm</strong></span>
                  {r.data?.waist && <span style={{ fontSize: 13 }}>허리 <strong>{r.data.waist}cm</strong></span>}
                  {r.data?.ratio && rg && <span style={{ fontSize: 13 }}>비율 <strong style={{ color: rg.color }}>{r.data.ratio}</strong></span>}
                </div>
              </div>
              <button className="delete-btn" onClick={() => onDelete(r.id)}>✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 메인 페이지 ───
const TABS = [
  { key: 'size', label: '전신 사이즈' },
  { key: 'shoulder', label: '어깨 측정' },
  { key: 'orm', label: '1RM 계산' },
  { key: 'fitness', label: '체력 테스트' },
  { key: 'heart', label: '심박수' },
  { key: 'stopwatch', label: '시간 측정' },
  { key: 'flex', label: '유연성' },
];

export default function MeasurePage() {
  const [tab, setTab] = useState('size');
  const [measures, setMeasures] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all measures on mount
  useEffect(() => {
    client.get('/measures')
      .then(({ data }) => setMeasures(data))
      .catch(() => toast('측정 데이터를 불러오지 못했어요'))
      .finally(() => setLoading(false));
  }, []);

  // Filter measures by type
  const filterByType = (type) => measures.filter(m => m.type === type);

  // Save a new measure
  const handleSave = async (type, data) => {
    try {
      const date = data.date || new Date().toISOString().split('T')[0];
      const payload = { type, date, data };
      await client.post('/measures', payload);
      // 서버에서 전체 목록 재조회 (서버 응답이 id만 포함하므로)
      const { data: refreshed } = await client.get('/measures');
      setMeasures(refreshed);
      toast('저장 완료!');
    } catch {
      toast('저장에 실패했어요');
    }
  };

  // Delete a measure
  const handleDelete = async (id) => {
    if (!confirm('정말 삭제하시겠어요?')) return;
    try {
      await client.delete(`/measures/${id}`);
      setMeasures(prev => prev.filter(m => m.id !== Number(id)));
      toast('삭제 완료!');
    } catch {
      toast('삭제에 실패했어요');
    }
  };

  if (loading) {
    return (
      <div>
        <div className="section-title"><div className="accent-bar" />측정 시스템</div>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          로딩 중...
        </div>
        <Toast />
      </div>
    );
  }

  return (
    <div>
      <div className="section-title"><div className="accent-bar" />측정 시스템</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} className={`btn-secondary${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)} style={{ fontSize: 11, padding: '5px 12px', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'size' && <BodySizeSection records={filterByType('bodySize')} onSave={(data) => handleSave('bodySize', data)} onDelete={handleDelete} />}
      {tab === 'shoulder' && <ShoulderSection records={filterByType('shoulder')} onSave={(data) => handleSave('shoulder', data)} onDelete={handleDelete} />}
      {tab === 'orm' && <OneRMSection records={filterByType('oneRM')} onSave={(data) => handleSave('oneRM', data)} />}
      {tab === 'fitness' && <FitnessTestSection records={filterByType('fitness')} onSave={(data) => handleSave('fitness', data)} />}
      {tab === 'heart' && <HeartRateSection />}
      {tab === 'stopwatch' && <StopwatchSection onSave={(data) => handleSave('stopwatch', data)} />}
      {tab === 'flex' && <FlexibilitySection records={filterByType('flexibility')} onSave={(data) => handleSave('flexibility', data)} />}

      <Toast />
    </div>
  );
}
