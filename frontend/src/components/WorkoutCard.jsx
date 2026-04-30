import { confirmDialog } from './ConfirmModal';

export default function WorkoutCard({ workout, onDelete, onEdit }) {
  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5, color: 'var(--text-primary)' }}>
          {workout.exercise}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
          {workout.weight} · {workout.sets}세트 · {workout.reps}회
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {onEdit && (
          <button
            onClick={() => onEdit(workout)}
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
          const ok = await confirmDialog(`"${workout.exercise}" 기록을 삭제할까요?`, { title: '운동 기록 삭제', confirmText: '삭제' });
          if (ok) onDelete(workout.id);
        }}>✕</button>
      </div>
    </div>
  );
}
