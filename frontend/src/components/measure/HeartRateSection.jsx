import { useState } from 'react';
import { AGE_MAX, AGE_MIN, HR_MAX, HR_MIN } from '../../data/measureRange';

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
// **3. 칸에 테두리가 없었다** (2026-10-31에 고쳤다). 세 칸 다 위아래가 열려 있었다 —
//
//   · **나이 999 → 「최대 심박수 어림값 −779bpm」**을 36px 로 크게 적고, 존 다섯을
//     전부 음수로 그렸다(「존1 −389~−467」 — **작은 쪽이 더 크다**)
//   · **나이 220 → 0** 이라 `num()` 이 null 로 보고 **조용히 아무것도 안 나왔다**
//   · **안정시 심박수가 최대보다 크면 존이 거꾸로 된다** — 카보넨 식이 여유 심박을
//     음수로 셈한다(안정 200 · 최대 190 → 「195~194」). 적은 값이 서로 안 맞는
//     것이고, **그때는 존을 그리지 않고 그렇다고 말한다**
//
// 이 칸들은 **저장하지 않는다.** 그래도 테두리가 필요했다 — 그 값으로 화면이
// **말을 짓기** 때문이다 (10/28 에 1RM · FFMI 에서 세운 그 자다).
//
// 존 이름과 구간은 그대로 뒀다 — 널리 쓰는 구분이고, 여기서 새로 지어낼 이유가 없다.

const ZONES = [
  { name: '존1 (회복)',      lo: 0.5, hi: 0.6, color: 'var(--info)',    desc: '가벼운 활동, 워밍업' },
  { name: '존2 (지방연소)',  lo: 0.6, hi: 0.7, color: 'var(--success)', desc: '유산소 기초' },
  { name: '존3 (유산소)',    lo: 0.7, hi: 0.8, color: 'var(--accent)',  desc: '심폐지구력 향상' },
  { name: '존4 (젖산역치)',  lo: 0.8, hi: 0.9, color: 'var(--warning)', desc: '고강도 인터벌, 속도 향상' },
  { name: '존5 (최대)',      lo: 0.9, hi: 1.0, color: 'var(--danger)',  desc: '전력질주, 단시간만' },
];

/** 테두리 안의 수만 수로 본다. 밖이면 **모르는 것**이다 — 지어내지 않는다 */
const inRange = (v, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};

export default function HeartRateSection() {
  const [age, setAge] = useState('');
  const [restHR, setRestHR] = useState('');
  const [ownMax, setOwnMax] = useState('');

  const measured = inRange(ownMax, HR_MIN, HR_MAX);
  const years = inRange(age, AGE_MIN, AGE_MAX);
  const byAge = years ? 220 - years : null;
  const maxHR = measured || byAge;
  const rest = inRange(restHR, HR_MIN, HR_MAX);
  // **적은 값이 서로 안 맞는다** — 안정시가 최대와 같거나 크면 여유 심박이
  // 0 이거나 음수다. 존을 그리면 「195~194」처럼 거꾸로 된 구간이 나온다
  const restTooHigh = !!(maxHR && rest && rest >= maxHR);

  // 안정시 심박수를 알면 카보넨 식을 쓴다 — 여유 심박(최대 − 안정)에 비율을 곱하고
  // 안정치를 다시 더한다. 모르면 최대치에 그냥 비율을 곱한다
  const zoneRange = (lo, hi) => {
    if (!maxHR) return null;
    const useRest = rest && !restTooHigh ? rest : null;
    const at = (p) => (useRest ? Math.round(useRest + (maxHR - useRest) * p) : Math.round(maxHR * p));
    return { min: at(lo), max: at(hi) };
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />심박수 존</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label className="label">나이</label>
          <input className="input" type="number" inputMode="numeric" min={AGE_MIN} max={AGE_MAX}
            placeholder="25" value={age} onChange={e => setAge(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label">안정시 심박수 <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(선택)</span></label>
          <input className="input" type="number" inputMode="numeric" min={HR_MIN} max={HR_MAX}
            placeholder="65" value={restHR} onChange={e => setRestHR(e.target.value)} />
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
        안정시 심박수는 아침에 일어나 누운 채로 재는 것이 가장 정확합니다.
        적어주시면 <b style={{ color: 'var(--text-secondary)' }}>카보넨 식</b>으로 더 맞게 계산합니다.
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="label">직접 잰 최대 심박수 <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(선택)</span></label>
        <input className="input" type="number" inputMode="numeric" min={HR_MIN} max={HR_MAX}
          placeholder="비워두면 220 − 나이로 계산합니다" value={ownMax} onChange={e => setOwnMax(e.target.value)} />
      </div>

      {/* **조용히 아무것도 안 나오지 않게** 한다 (2026-10-31). 나이 220 은
          `220 − 220 = 0` 이라 여태 화면이 그냥 비었다 — 사람은 제가 뭘 잘못
          적었는지 알 길이 없었다. 테두리 밖을 적었으면 그렇다고 적는다 */}
      {!maxHR && (String(age).trim() || String(ownMax).trim()) && (
        <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12, lineHeight: 1.7 }}>
          나이는 <b>{AGE_MIN}~{AGE_MAX}</b>, 심박수는 <b>{HR_MIN}~{HR_MAX}bpm</b> 으로 적어주세요.
        </div>
      )}

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

          {restTooHigh && (
            <div style={{ fontSize: 11.5, color: 'var(--warning)', marginBottom: 12, lineHeight: 1.7 }}>
              안정시 심박수({rest})가 최대 심박수({maxHR})보다 높아요 — 둘 중 하나를
              다시 봐주세요. <b>지금은 최대 심박수만으로</b> 계산했습니다.
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
                <div style={{ fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 16, color: z.color, letterSpacing: 1, flexShrink: 0 }}>
                  {r.min}~{r.max}
                </div>
              </div>
            );
          })}

          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.7 }}>
            {rest && !restTooHigh
              ? '안정시 심박수를 넣어 카보넨 식(여유 심박)으로 계산했습니다.'
              : '최대 심박수에 비율을 곱해 계산했습니다. 안정시 심박수를 넣으면 더 맞습니다.'}
          </div>
        </>
      )}
    </div>
  );
}
