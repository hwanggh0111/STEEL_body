export default function WorkoutCard({ workout, onDelete }) {
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
      <button className="delete-btn" onClick={() => onDelete(workout.id)}>✕</button>
    </div>
  );
}
