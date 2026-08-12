import { useEffect, useMemo } from 'react';
import { useWorkoutStore } from '../store/workoutStore';
import { useInbodyStore } from '../store/inbodyStore';
import { usePachinkoStore } from '../store/pachinkoStore';
import PachinkoSystem, { earnedTickets } from '../components/PachinkoSystem';
import LadderGame from '../components/LadderGame';
import LevelSystem from '../components/LevelSystem';
import { TICKET_RULE } from '../data/pachinkoData';

export default function PachinkoPage() {
  const { workouts, loading: wLoading, fetchAll: fetchWorkouts } = useWorkoutStore();
  const { records, loading: iLoading, fetchAll: fetchInbody } = useInbodyStore();
  // 파칭코와 사다리가 같은 티켓/누적 EXP를 쓴다
  // ?reset=1 초기화는 main.jsx가 앱 부팅 전에 처리한다 (로그인 여부와 무관하게 동작해야 하므로)
  const { used, gained } = usePachinkoStore();

  useEffect(() => {
    fetchWorkouts();
    fetchInbody();
  }, []);

  const loading = wLoading || iLoading;
  // workouts는 날짜별로 묶인 객체 — HomePage와 동일하게 펼쳐서 센다
  const totalWorkouts = useMemo(() => Object.values(workouts).flat().length, [workouts]);
  const totalInbody = records.length;

  const earned = earnedTickets(totalWorkouts, totalInbody);
  const available = Math.max(0, Math.min(earned - used, TICKET_RULE.maxStack));
  // 파칭코를 뺀 순수 기록 EXP — 두 모드가 레벨 변화를 계산하는 기준
  const baseExp = totalWorkouts * 15 + totalInbody * 30;

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
            totalInbody={totalInbody}
            baseExp={baseExp}
          />

          {/* 두 번째 모드 — 티켓은 위 파칭코와 공유 */}
          <div className="section-title">
            <div className="accent-bar" />
            LADDER
          </div>
          <LadderGame available={available} baseExp={baseExp} />

          {/* 두 모드에서 번 EXP가 함께 반영되는 레벨 */}
          <div className="section-title">
            <div className="accent-bar" />
            MY LEVEL
          </div>
          <LevelSystem
            totalWorkouts={totalWorkouts}
            totalInbody={totalInbody}
            bonusExp={gained}
          />
        </>
      )}
    </div>
  );
}
