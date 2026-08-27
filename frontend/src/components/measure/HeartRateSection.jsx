import { useState } from 'react';

// 심박수 존.
//
// 두 가지가 잘못돼 있었다.
//
// **1. 안 쓰는 값을 물어봤다.** 「안정시 심박수 (선택)」 칸을 받아놓고 **아무 데도
// 쓰지 않았다.** 적어 넣어도 화면이 하나도 안 바뀐다. 안정시 심박수는 존을 재는 데
// 쓰라고 있는 값이다 (카보넨 식) — 이제 적으면 그 식으로 계산한다.
//
// **2. 어림값을 딱 떨어지는 값처럼 보여줬다.** `220 − 나이` 는 사람마다 10~12bpm 쯤
// 어긋난다. 「최대 심박수」라고 크게 띄우면 그게 내 몸의 확정된 수치로 읽힌다.
// 어림값이라고 적고, **재본 적 있으면 그 값을 넣을 수 있게** 했다.
//
// 존 이름과 구간은 그대로 뒀다 — 널리 쓰는 구분이고, 여기서 새로 지어낼 이유가 없다.

const ZONES = [
  { name: '존1 (회복)',      lo: 0.5, hi: 0.6, color: 'var(--info)',    desc: '가벼운 활동, 워밍업' },
  { name: '존2 (지방연소)',  lo: 0.6, hi: 0.7, color: 'var(--success)', desc: '유산소 기초' },
  { name: '존3 (유산소)',    lo: 0.7, hi: 0.8, color: 'var(--accent)',  desc: '심폐지구력 향상' },
  { name: '존4 (젖산역치)',  lo: 0.8, hi: 0.9, color: 'var(--warning)', desc: '고강도 인터벌, 속도 향상' },
  { name: '존5 (최대)',      lo: 0.9, hi: 1.0, color: 'var(--danger)',  desc: '전력질주, 단시간만' },
];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function HeartRateSection() {
  const [age, setAge] = useState('');
  const [restHR, setRestHR] = useState('');
  const [ownMax, setOwnMax] = useState('');

  const measured = num(ownMax);
  const byAge = num(age) ? 220 - num(age) : null;
  const maxHR = measured || byAge;
  const rest = num(restHR);

  // 안정시 심박수를 알면 카보넨 식을 쓴다 — 여유 심박(최대 − 안정)에 비율을 곱하고
  // 안정치를 다시 더한다. 모르면 최대치에 그냥 비율을 곱한다
  const zoneRange = (lo, hi) => {
    if (!maxHR) return null;
    const at = (p) => (rest ? Math.round(rest + (maxHR - rest) * p) : Math.round(maxHR * p));
    return { min: at(lo), max: at(hi) };
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />심박수 존</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label className="label">나이</label>
          <input className="input" type="number" inputMode="numeric" placeholder="25" value={age} onChange={e => setAge(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label">안정시 심박수 <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(선택)</span></label>
          <input className="input" type="number" inputMode="numeric" placeholder="65" value={restHR} onChange={e => setRestHR(e.target.value)} />
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
        안정시 심박수는 아침에 일어나 누운 채로 재는 것이 가장 정확합니다.
        적어주시면 <b style={{ color: 'var(--text-secondary)' }}>카보넨 식</b>으로 더 맞게 계산합니다.
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="label">직접 잰 최대 심박수 <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(선택)</span></label>
        <input className="input" type="number" inputMode="numeric" placeholder="비워두면 220 − 나이로 계산합니다" value={ownMax} onChange={e => setOwnMax(e.target.value)} />
      </div>

      {maxHR && (
        <>
          <div className="card" style={{ textAlign: 'center', marginBottom: 6, borderColor: 'var(--accent)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {measured ? '최대 심박수 (직접 잰 값)' : '최대 심박수 어림값 (220 − 나이)'}
            </div>
            <div className="stat-number" style={{ fontSize: 36 }}>
              {maxHR}<span style={{ fontSize: 14, color: 'var(--text-muted)' }}>bpm</span>
            </div>
          </div>

          {/* 어림값을 딱 떨어지는 값처럼 보여주지 않는다 */}
          {!measured && (
            <div style={{ fontSize: 11.5, color: 'var(--warning)', marginBottom: 12, lineHeight: 1.7 }}>
              220 − 나이는 어림식입니다. 사람마다 <b>10~12bpm</b> 쯤 어긋납니다 —
              재보신 적이 있으면 위에 그 값을 넣어주세요.
            </div>
          )}
          {measured && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
              직접 잰 값으로 계산했습니다.
            </div>
          )}

          {ZONES.map(z => {
            const r = zoneRange(z.lo, z.hi);
            return (
              <div key={z.name} className="card" style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: z.color }}>{z.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{z.desc}</div>
                </div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: z.color, letterSpacing: 1, flexShrink: 0 }}>
                  {r.min}~{r.max}
                </div>
              </div>
            );
          })}

          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.7 }}>
            {rest
              ? '안정시 심박수를 넣어 카보넨 식(여유 심박)으로 계산했습니다.'
              : '최대 심박수에 비율을 곱해 계산했습니다. 안정시 심박수를 넣으면 더 맞습니다.'}
          </div>
        </>
      )}
    </div>
  );
}
