import { useMemo, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { readingsOf, SEXES } from '../data/bodyRanges';
import { scoreChange } from '../data/inbodyScore';
import { toast } from './Toast';

// 인바디 값이 **일반적으로 알려진 범위의 어디쯤인지**.
//
// 예전 화면(BodyAnalysis)이 하던 네 가지를 안 한다.
//   1. 성별을 안 받으면서 남성 기준으로 판정 → 성별을 받고, 안 고르면 범위를 안 그린다
//   2. 몸에 A~D 등급 → 등급을 안 매긴다
//   3. 몸 그림의 팔·다리를 서로 다른 색으로 → 안 그린다. 인바디 값은 부위를 모른다
//   4. 「내장지방 위험」 같은 의학적 단정 → 안 한다
//
// 성별을 안 고른 사람에게는 **숫자와 변화만** 보여준다. 그것도 하나의 답이다.

function Scale({ reading }) {
  const { scale, position, value } = reading;
  const bands = scale.bands;
  const tone = { normal: 'var(--success-dim)', low: 'var(--info-dim)', high: 'var(--warning-dim)' };

  return (
    <>
      <div style={{ position: 'relative', paddingTop: 4 }}>
        <div style={{ display: 'flex', height: 8, borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {bands.map((b, i) => (
            <div key={i} style={{ flexGrow: 1, background: tone[b.tone] || 'var(--bg-tertiary)' }} />
          ))}
        </div>
        {/* 내 위치. 눈금 밖으로 나가지 않게 양 끝에서 살짝 물린다 */}
        <div style={{
          position: 'absolute',
          left: `calc(${(position?.ratio ?? 0) * 100}% - 1px)`,
          top: 0, width: 2, height: 16,
          background: 'var(--text-primary)',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
        {bands.map((b, i) => (
          <span key={i} style={{
            flexGrow: 1, fontSize: 10.5, textAlign: 'center',
            color: position?.band === b ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>{b.label}</span>
        ))}
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {scale.note}
      </div>
    </>
  );
}

// 숫자만 — 시안 A 의 것이다.
//
// 8/25 에는 A 를 「원칙」으로만 가져왔다. 성별을 안 고르면 범위를 안 그린다는 규칙이
// 그것이다. 그런데 시안 A 는 **화면이기도 했다** — 체중 · 체지방률 · 골격근량 ·
// 체수분 · BMI 다섯 줄을 지난 기록과의 차이와 함께 세운 표다.
//
// 눈금(B)이 그리는 것은 셋뿐이고 그나마 성별을 골라야 그린다. 그래서 성별을 안 고른
// 사람은 **체중도 체수분도 아무 데도 안 나왔다.** 판정 없이 숫자만 보고 싶은 사람이
// 볼 것이 없었다는 뜻이다. 표를 되살린다 — 눈금 위에 놓으면 둘이 부딪히지 않는다.
const NUMBERS = [
  { key: 'weight', label: '체중', unit: 'kg', digits: 1 },
  { key: 'fat_pct', label: '체지방률', unit: '%', digits: 1 },
  { key: 'muscle_kg', label: '골격근량', unit: 'kg', digits: 1 },
  { key: 'water_l', label: '체수분', unit: 'L', digits: 1 },
  { key: 'bmi', label: 'BMI', unit: '', digits: 1 },
];

// ── 인바디 점수 (2026-09-29) ──
//
// **꺼져 있는 것이 기본이다.** 설정함에서 켠 사람에게만 나온다 — 8/25 에 「몸에
// 등급을 안 매긴다」고 정했고, 그 규칙을 되돌린 것이 아니라 보고 싶은 사람에게
// 자리를 준 것이다. 계산은 `data/inbodyScore.js` 에 있고 여기는 그리는 일만 한다.
//
// 지키는 것 셋 —
//   · **등급을 안 붙인다.** 「72점 · 보통」 · A~D · 「위험」을 안 쓴다
//   · **무엇으로 냈는지 항목마다 보여준다.** 한 숫자만 내놓으면 어디서 깎였는지
//     모르고, 그러면 사람은 그 숫자를 고치려 들지 못한다
//   · **못 낼 때는 까닭을 적는다.** 「점수 없음」만 있으면 고장인 줄 안다
function ScoreCard({ record, prev, sex }) {
  const got = useMemo(() => scoreChange(record, prev, sex), [record, prev, sex]);

  if (got.score === null) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>인바디 점수</div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7 }}>{got.why}</div>
      </div>
    );
  }

  return (
    <div className="card" style={{
      borderColor: 'var(--accent)', background: 'var(--accent-dim)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9 }}>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, letterSpacing: 1, color: 'var(--accent)' }}>인바디 점수</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.6 }}>
            참고 범위 {got.parts.length}가지를 접은 숫자예요 (100 이 범위 안)
          </div>
        </div>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, letterSpacing: 1,
          color: 'var(--text-primary)', lineHeight: 0.9,
        }}>{got.score}</span>
        {/* 지난 번과의 차이. **좋고 나쁨을 색으로 매기지 않는다** — 방향만 나눈다
            (`BodyChange` · `ComparePage` 와 같은 규칙) */}
        {got.dir && got.dir !== 'flat' && (
          <span style={{ fontSize: 13, color: got.delta > 0 ? 'var(--accent)' : 'var(--info)', paddingBottom: 3 }}>
            {got.delta > 0 ? '+' : '−'}{Math.abs(got.delta)}
          </span>
        )}
      </div>

      {/* 어디서 깎였나. 항목마다 적는다 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {got.parts.map((p) => (
          <div key={p.metric} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12.5 }}>
            <span style={{ color: 'var(--text-secondary)', flexGrow: 1 }}>{p.label}</span>
            <span style={{ color: 'var(--text-muted)' }}>
              {p.inNormal
                ? '범위 안'
                : p.where === 'above'
                  ? `범위보다 ${p.off} 위`
                  : `범위보다 ${p.off} 아래`}
            </span>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 0.5,
              color: 'var(--text-primary)', width: 32, textAlign: 'right',
            }}>{p.score}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        {got.prev !== null
          ? `지난 기록은 ${got.prev}점이었어요. 견주는 상대는 지난 번의 나예요.`
          : '지난 기록이 없어서 아직 견줄 것이 없어요.'}
        <br />
        점수는 <b>등급이 아니에요</b> — 이미 아래에 그려둔 참고 범위를 한 숫자로 접은 것이고,
        나이 · 운동 이력 · 재는 기계에 따라 달라져요. 근육이 많아서 범위를 넘은 것은 안 깎아요.
        {got.parts.length < 3 && <> 적은 칸이 있어서 {got.parts.length}가지로만 냈어요.</>}
      </div>
    </div>
  );
}

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function Delta({ value, digits }) {
  if (value === null || value === 0) return null;
  // 늘고 줆에 좋고 나쁨을 매기지 않는다. 방향만 색으로 나눈다 (BodyChange 와 같은 규칙)
  const color = value > 0 ? 'var(--accent)' : 'var(--info)';
  return (
    <span style={{ fontSize: 12, color }}>
      {value > 0 ? '+' : '−'}{Math.abs(value).toFixed(digits)}
    </span>
  );
}

function Numbers({ record, prev }) {
  const rows = NUMBERS
    .map(f => {
      const now = num(record?.[f.key]);
      if (now === null) return null;
      const then = num(prev?.[f.key]);
      return { ...f, now, delta: then === null ? null : Number((now - then).toFixed(f.digits)) };
    })
    .filter(Boolean);
  if (rows.length === 0) return null;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
        {record?.date ? `${record.date.slice(5).replace('-', '월 ')}일에 넣은 값입니다` : '가장 최근에 넣은 값입니다'}
        {prev && ' · 오른쪽은 지난 기록과의 차이입니다'}
      </div>
      {rows.map(r => (
        <div key={r.key} style={{
          display: 'flex', alignItems: 'baseline', gap: 8,
          padding: '7px 0', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexGrow: 1 }}>{r.label}</span>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1,
            color: 'var(--text-primary)', lineHeight: 1,
          }}>{r.now}</span>
          {r.unit && <span style={{ fontSize: 11.5, color: 'var(--text-muted)', width: 18 }}>{r.unit}</span>}
          <span style={{ width: 46, textAlign: 'right' }}><Delta value={r.delta} digits={r.digits} /></span>
        </div>
      ))}
    </div>
  );
}

export default function BodyReading({ record, prev }) {
  const sex = useAuthStore(s => s.sex);
  // 점수는 **켠 사람에게만.** 기본은 꺼짐이다 (`settingsStore`)
  const showScore = useSettingsStore(st => st.inbodyScore);
  const setSex = useAuthStore(s => s.setSex);
  const [saving, setSaving] = useState(false);

  const readings = useMemo(() => readingsOf(record, sex), [record, sex]);
  if (!record || readings.length === 0) return null;

  const pick = async (next) => {
    setSaving(true);
    try {
      await setSex(next);
    } catch {
      toast('저장하지 못했어요', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* 점수를 켰으면 맨 위에 둔다 — 켠 사람은 그것을 보러 온다.
          **끈 사람에게는 이 자리가 아예 없다** (기본이 꺼짐이다) */}
      {showScore && <ScoreCard record={record} prev={prev} sex={sex} />}

      {/* 숫자 먼저 (시안 A). 판정 없이 이것만 보고 싶은 사람도 있다 */}
      <Numbers record={record} prev={prev} />

      {/* 성별 — 필수가 아니다. 안 골라도 화면은 돈다 */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>참고 범위 기준</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            {sex ? '언제든 바꾸거나 지울 수 있습니다' : '안 고르셔도 됩니다. 그러면 범위를 안 그립니다'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {SEXES.map(s => (
            <button
              key={s.key}
              className={`btn-secondary${sex === s.key ? ' active' : ''}`}
              style={{ padding: '5px 12px' }}
              disabled={saving}
              onClick={() => pick(sex === s.key ? null : s.key)}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {readings.map(r => (
        <div key={r.metric} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.scale?.label ?? METRIC_LABELS[r.metric]}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: 1,
                color: 'var(--text-primary)', lineHeight: 1,
              }}>{r.value}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.scale?.unit ?? METRIC_UNITS[r.metric]}</span>
            </div>
          </div>

          {r.scale
            ? <Scale reading={r} />
            : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                이 값은 성별에 따라 기준이 크게 다릅니다. 위에서 골라주시면 범위를 그려드립니다.
              </div>
            )}
        </div>
      ))}

      {/* 성별을 안 고른 사람에게는 시안 A 의 말을 그대로 한다 —
          범위를 안 그리는 것이 빠뜨린 것이 아니라 **말할 수 없어서**라는 것을 밝힌다 */}
      {sex ? (
        <div className="card" style={{ borderLeft: '3px solid var(--info)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>이 범위는 참고용입니다</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            나이 · 운동 이력 · 재는 기계에 따라 달라집니다. 좋고 나쁨을 매기지 않고,
            일반적으로 알려진 범위 안에서 어디쯤인지만 보여드립니다.
            <br />몸에 등급을 매기지 않습니다.
            {/* 점수를 켠 사람에게는 **점수와 등급이 어떻게 다른지** 적는다 —
                안 적으면 위의 숫자와 이 줄이 서로 다른 말을 하는 것으로 읽힌다 */}
            {showScore && <> 위의 점수도 등급이 아니라 <b>이 범위를 접은 숫자</b>예요 —
              잘함 · 못함을 적지 않고, 몇 점이 되어야 한다고도 말하지 않습니다.</>}
          </div>
        </div>
      ) : (
        <div className="card" style={{ borderLeft: '3px solid var(--info)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>판정은 하지 않습니다</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            성별을 안 고르셨습니다. 그 값 없이는 체지방률과 골격근 비율에 대해
            「높다 · 낮다」를 말할 수 없습니다 — 남성과 여성의 범위가 크게 다릅니다.
            <br />숫자와 변화만 보여드리고, 해석은 인바디 기계의 출력지나 전문가에게 맡깁니다.
          </div>
        </div>
      )}
    </div>
  );
}

// 눈금이 없을 때(성별 안 고름) 쓸 이름과 단위
const METRIC_LABELS = { fat_pct: '체지방률', muscle_ratio: '골격근 비율', bmi: 'BMI' };
const METRIC_UNITS = { fat_pct: '%', muscle_ratio: '%', bmi: '' };
