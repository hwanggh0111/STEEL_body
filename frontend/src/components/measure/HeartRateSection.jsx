import { useState } from 'react';

export default function HeartRateSection() {
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
