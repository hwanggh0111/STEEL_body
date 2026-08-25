import { useMemo, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { readingsOf, SEXES } from '../data/bodyRanges';
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

export default function BodyReading({ record }) {
  const sex = useAuthStore(s => s.sex);
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

      <div className="card" style={{ borderLeft: '3px solid var(--info)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>이 범위는 참고용입니다</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          나이 · 운동 이력 · 재는 기계에 따라 달라집니다. 좋고 나쁨을 매기지 않고,
          일반적으로 알려진 범위 안에서 어디쯤인지만 보여드립니다.
          <br />몸에 등급을 매기지 않습니다.
        </div>
      </div>
    </div>
  );
}

// 눈금이 없을 때(성별 안 고름) 쓸 이름과 단위
const METRIC_LABELS = { fat_pct: '체지방률', muscle_ratio: '골격근 비율', bmi: 'BMI' };
const METRIC_UNITS = { fat_pct: '%', muscle_ratio: '%', bmi: '' };
