import MiniTapGame from '../components/MiniTapGame';
import CharacterAvatar from '../components/CharacterAvatar';
import WorkoutHeatmap from '../components/WorkoutHeatmap';
import WeatherWorkout from '../components/WeatherWorkout';
import { useWorkoutStore } from '../store/workoutStore';
import { useEffect, useMemo } from 'react';

export default function GamePage() {
  const { workouts, loading, fetchAll } = useWorkoutStore();
  const totalWorkouts = useMemo(() => Object.values(workouts).flat().length, [workouts]);

  useEffect(() => { fetchAll(); }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>LOADING...</div>;
  }

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        MINI GAME
      </div>
      <MiniTapGame />

      <div className="section-title" style={{ marginTop: 20 }}>
        <div className="accent-bar" />
        MY CHARACTER
      </div>
      <CharacterAvatar totalWorkouts={totalWorkouts} />

      <div className="section-title" style={{ marginTop: 20 }}>
        <div className="accent-bar" />
        WORKOUT HEATMAP
      </div>
      <WorkoutHeatmap workouts={workouts} />

      <div className="section-title" style={{ marginTop: 20 }}>
        <div className="accent-bar" />
        WEATHER
      </div>
      <WeatherWorkout />
    </div>
  );
}
