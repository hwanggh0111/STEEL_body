import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import { useInbodyStore } from '../store/inbodyStore';
import StatBox from '../components/StatBox';
import WeightChart from '../components/WeightChart';
import WorkoutCard from '../components/WorkoutCard';
import { toast } from '../components/Toast';

export default function HistoryPage() {
  const navigate = useNavigate();
  const { workouts, loading: wLoading, fetchAll: fetchWorkouts, deleteWorkout } = useWorkoutStore();
  const { records, loading: iLoading, fetchAll: fetchInbody } = useInbodyStore();

  useEffect(() => {
    fetchWorkouts();
    fetchInbody();
  }, []);

  const [filterExercise, setFilterExercise] = useState('');

  const handleExportCSV = (type = 'workouts') => {
    const filename = type === 'inbody' ? 'steelbody_inbody.csv' : 'steelbody_workouts.csv';
    const baseURL = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('token');
    fetch(`${baseURL}/export/${type}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('Export failed');
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast(`${type === 'inbody' ? '인바디' : '운동'} CSV 내보내기 완료!`);
      })
      .catch(() => toast('내보내기에 실패했어요', 'error'));
  };

  const allExercises = useMemo(() => [...new Set(Object.values(workouts).flat().map(w => w.exercise).filter(Boolean))].sort(), [workouts]);

  const dates = useMemo(() => workouts ? Object.keys(workouts).sort().reverse() : [], [workouts]);
  const totalDays = dates.length;
  const totalWorkouts = useMemo(() => workouts ? Object.values(workouts).flat().length : 0, [workouts]);

  const handleDelete = async (id) => {
    try {
      await deleteWorkout(id);
      toast('삭제 완료!');
    } catch {
      toast('삭제 실패');
    }
  };

  const loading = wLoading || iLoading;

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        통계
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
        <StatBox number={totalDays} label="운동일" />
        <StatBox number={totalWorkouts} label="총 운동" />
        <StatBox number={records.length} label="인바디" />
      </div>

      <div className="section-title">
        <div className="accent-bar" />
        체중 변화
      </div>
      <div className="card" style={{ marginBottom: 24, padding: 12 }}>
        <WeightChart records={records} />
      </div>

      <div className="section-title">
        <div className="accent-bar" />
        운동 히스토리
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <select className="input" value={filterExercise} onChange={e => setFilterExercise(e.target.value)}
          style={{ flex: 1, fontSize: 13 }}>
          <option value="">전체 운동</option>
          {allExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </select>
        {filterExercise && (
          <button onClick={() => setFilterExercise('')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        )}
        <button
          onClick={() => handleExportCSV('workouts')}
          className="btn-secondary"
          style={{ fontSize: 12, padding: '8px 14px', whiteSpace: 'nowrap' }}
        >
          운동 CSV
        </button>
        <button
          onClick={() => handleExportCSV('inbody')}
          className="btn-secondary"
          style={{ fontSize: 12, padding: '8px 14px', whiteSpace: 'nowrap' }}
        >
          인바디 CSV
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          로딩 중...
        </div>
      ) : dates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">기록 없음</div>
          <div className="empty-state-desc">아직 운동 기록이 없어요</div>
          <button className="btn-primary" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate('/workout')}>+ 첫 운동 기록하기</button>
        </div>
      ) : (
        dates.map((date) => {
          const filtered = filterExercise
            ? (workouts[date] || []).filter(w => w.exercise === filterExercise)
            : (workouts[date] || []);
          if (filtered.length === 0) return null;
          return (
            <div key={date} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 6, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1.5 }}>
                {date}
              </div>
              {filtered.map((w) => (
                <WorkoutCard key={w.id} workout={w} onDelete={handleDelete} />
              ))}
            </div>
          );
        })
      )}

    </div>
  );
}
