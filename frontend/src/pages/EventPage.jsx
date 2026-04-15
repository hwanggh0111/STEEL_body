import { useWorkoutStore } from '../store/workoutStore';
import { useInbodyStore } from '../store/inbodyStore';
import { useEffect } from 'react';
import LaunchEvent from '../components/LaunchEvent';

export default function EventPage() {
  const { workouts, loading: wLoading, fetchAll: fetchWorkouts } = useWorkoutStore();
  const { records, loading: iLoading, fetchAll: fetchInbody } = useInbodyStore();

  useEffect(() => {
    fetchWorkouts();
    fetchInbody();
  }, []);

  const loading = wLoading || iLoading;

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        EVENT
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>LOADING...</div>
      ) : (
        <LaunchEvent workouts={workouts} records={records} />
      )}
    </div>
  );
}
