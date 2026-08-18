import { useEffect, useMemo } from 'react';
import { useWorkoutStore } from '../store/workoutStore';
import { useInbodyStore } from '../store/inbodyStore';
import { usePachinkoStore } from '../store/pachinkoStore';
import PachinkoSystem, { earnedTickets } from '../components/PachinkoSystem';
import LadderGame from '../components/LadderGame';
import LevelSystem from '../components/LevelSystem';
import { TICKET_RULE, ticketsAvailable } from '../data/pachinkoData';
import { usePlateStore } from '../store/plateStore';
import { toast } from '../components/Toast';

export default function PachinkoPage() {
  const { workouts, loading: wLoading, fetchAll: fetchWorkouts } = useWorkoutStore();
  const { records, loading: iLoading, fetchAll: fetchInbody } = useInbodyStore();
  // 파칭코와 사다리가 같은 티켓/누적 EXP를 쓴다
  // ?reset=1 초기화는 main.jsx가 앱 부팅 전에 처리한다 (로그인 여부와 무관하게 동작해야 하므로)
  const { used, gained, ulExp, trimOverflow } = usePachinkoStore();
  const purchased = usePlateStore(s => s.purchased);   // 원판 피하기로 산 티켓
  const unlimited = usePlateStore(s => s.unlimited);   // 울트라 무한(∞)을 주웠는가

  useEffect(() => {
    fetchWorkouts();
    fetchInbody();
  }, []);

  const loading = wLoading || iLoading;
  // workouts는 날짜별로 묶인 객체 — HomePage와 동일하게 펼쳐서 센다
  const totalWorkouts = useMemo(() => Object.values(workouts).flat().length, [workouts]);
  const totalInbody = records.length;

  const earned = earnedTickets(totalWorkouts, totalInbody, purchased);

  // 상한을 넘겨 쌓인 미사용 티켓은 여기서 소멸시킨다.
  // 이걸 안 하면 min() 이 표시만 상한에 묶어둘 뿐이라, earned - used 가 상한보다 큰
  // 계정은 티켓을 써도 숫자가 줄지 않아 무한히 돌릴 수 있다.
  // 두 모드(파칭코/사다리)가 earned 를 아는 곳은 여기뿐이라 이 페이지에서 처리한다.
  // 소멸 뒤엔 earned - used == maxStack 이 되므로 effect 가 다시 돌아도 아무 일도 안 한다.
  //
  // 소멸은 말없이 하면 안 된다. 운영 상한이 150이고 운동 3회당 1장이므로, 한동안
  // 안 돌린 유저는 이 페이지를 여는 것만으로 티켓이 잘린다. 몇 장이 사라졌는지
  // 알려준다 (trimOverflow 가 소멸량을 돌려준다).
  useEffect(() => {
    if (loading) return;         // 기록을 못 받았으면 건드리지 않는다
    if (unlimited) return;       // 무한 티켓이면 상한 자체가 의미 없다
    const burned = trimOverflow(earned, TICKET_RULE.maxStack);
    if (burned > 0) {
      toast(
        `보유 상한 ${TICKET_RULE.maxStack.toLocaleString()}장을 넘은 티켓 `
        + `${burned.toLocaleString()}장이 사라졌어요`,
        'warning',
      );
    }
  }, [earned, used, loading, unlimited, trimOverflow]);

  // 티켓은 판을 시작하는 즉시 used 로 확정되므로, 연출 중이라고 따로 빼둘 몫이 없다.
  const available = ticketsAvailable({ earned, used, unlimited });
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
            ulExp={ulExp}
          />
        </>
      )}
    </div>
  );
}
