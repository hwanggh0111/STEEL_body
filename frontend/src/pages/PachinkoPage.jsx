import { useEffect, useState, useMemo } from 'react';
import { useWorkoutStore } from '../store/workoutStore';
import { useInbodyStore } from '../store/inbodyStore';
import PachinkoSystem, { getPachinkoExp } from '../components/PachinkoSystem';
import LevelSystem from '../components/LevelSystem';

export default function PachinkoPage() {
  const { workouts, loading: wLoading, fetchAll: fetchWorkouts } = useWorkoutStore();
  const { records, loading: iLoading, fetchAll: fetchInbody } = useInbodyStore();
  const [pachinkoExp, setPachinkoExp] = useState(() => getPachinkoExp());

  useEffect(() => {
    fetchWorkouts();
    fetchInbody();
  }, []);

  const loading = wLoading || iLoading;
  // workouts는 날짜별로 묶인 객체 — HomePage와 동일하게 펼쳐서 센다
  const totalWorkouts = useMemo(() => Object.values(workouts).flat().length, [workouts]);

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        PACHINKO
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>LOADING...</div>
      ) : (
        <>
          <PachinkoSystem
            totalWorkouts={totalWorkouts}
            totalInbody={records.length}
            onExpChange={setPachinkoExp}
          />

          {/* 돌린 결과가 레벨에 어떻게 반영되는지 바로 확인 */}
          <div className="section-title">
            <div className="accent-bar" />
            MY LEVEL
          </div>
          <LevelSystem
            totalWorkouts={totalWorkouts}
            totalInbody={records.length}
            bonusExp={pachinkoExp}
          />
        </>
      )}
    </div>
  );
}
