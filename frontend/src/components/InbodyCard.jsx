import { memo } from 'react';
import { confirmDialog } from './ConfirmModal';
import { scaleFor, positionOn } from '../data/bodyRanges';

// BMI 를 뭐라고 부를지.
//
// 여기도 「저체중 · 정상 · 과체중 · **비만**」이라고 부르고 있었다.
// 8/25 에 인바디 분석에서 몸에 등급을 안 매기기로 했고 오늘 입력 폼도 고쳤는데,
// **목록 카드만 그대로**였다 — 같은 화면 안에서 위는 「일반적인 범위」라고 하고
// 아래 목록은 「비만」이라고 하는 상태였다. 눈금을 한 군데서 가져와 말을 맞춘다
function getBmiInfo(bmi) {
  if (!bmi) return { label: '-', color: 'var(--text-muted)' };
  const scale = scaleFor('bmi');
  const pos = scale ? positionOn(scale, Number(bmi)) : null;
  if (!pos?.band) return { label: '-', color: 'var(--text-muted)' };
  const tone = pos.band.tone;
  return {
    label: pos.band.label,
    color: tone === 'low' ? 'var(--info)' : tone === 'high' ? 'var(--warning)' : 'var(--success)',
  };
}

function InbodyCard({ record, onDelete, onEdit }) {
  const bmiInfo = getBmiInfo(record.bmi);

  return (
    <div className="card list-item" style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{record.date}</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>체중 <strong style={{ color: 'var(--accent)' }}>{record.weight}kg</strong></span>
            {record.fat_pct && <span style={{ fontSize: 13 }}>체지방 <strong>{record.fat_pct}%</strong></span>}
            {record.muscle_kg && <span style={{ fontSize: 13 }}>골격근 <strong>{record.muscle_kg}kg</strong></span>}
            {record.bmi && (
              <span style={{ fontSize: 13 }}>
                BMI <strong style={{ color: bmiInfo.color }}>{record.bmi} ({bmiInfo.label})</strong>
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {onEdit && (
            <button
              onClick={() => onEdit(record)}
              style={{
                background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                padding: '4px 10px', cursor: 'pointer', fontSize: 12, borderRadius: 'var(--radius)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              title="수정"
            >✎</button>
          )}
          <button className="delete-btn" onClick={async () => {
            const ok = await confirmDialog(`${record.date} 인바디 기록을 삭제할까요?`, { title: '인바디 기록 삭제', confirmText: '삭제' });
            if (ok) onDelete(record.id);
          }}>✕</button>
        </div>
      </div>
    </div>
  );
}

// 목록에 몇 백 개가 늘어선다. 부모가 한 번 다시 그려질 때마다 카드가 전부 따라 그려지면
// 스크롤이 끊긴다 — 받은 것이 그대로면 그리지 않는다.
// (부모 쪽 핸들러도 useCallback 으로 고정해야 이게 실제로 걸린다)
export default memo(InbodyCard);
