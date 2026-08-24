import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import { useInbodyStore } from '../store/inbodyStore';
import { usePachinkoStore } from '../store/pachinkoStore';
import { usePlateStore } from '../store/plateStore';
import PlateDodge from '../components/PlateDodge';
// 티켓 계산은 data/pachinkoData 에서 바로 가져온다.
// PachinkoSystem 이 재수출하고 있어 거기서도 되지만, 그러면 함수 하나 때문에
// 파칭코 화면 전체가 이 페이지 번들에 딸려 들어온다 (8/21 에 제보 폼에서 겪은 것과 같다)
import { TICKET_RULE, ticketsAvailable, ticketText, earnedTickets } from '../data/pachinkoData';
import { PLATE_RULE, todayKey } from '../data/plateData';

// 미니게임 전용 페이지.
// 파칭코/사다리가 티켓을 쓰는 곳이라면 여기는 티켓을 버는 곳이다.
// 산 티켓이 어디로 가는지 보이도록 현재 보유 티켓을 같이 띄운다.
export default function MiniGamePage() {
  const { workouts, loading: wLoading, fetchAll: fetchWorkouts } = useWorkoutStore();
  const { records, loading: iLoading, fetchAll: fetchInbody } = useInbodyStore();
  const used = usePachinkoStore(s => s.used);
  const purchased = usePlateStore(s => s.purchased);
  const unlimited = usePlateStore(s => s.unlimited);

  useEffect(() => {
    fetchWorkouts();
    fetchInbody();
  }, []);

  const totalWorkouts = useMemo(() => Object.values(workouts).flat().length, [workouts]);
  const earned = earnedTickets(totalWorkouts, records.length, purchased);
  const available = ticketsAvailable({ earned, used, unlimited });

  // 상한을 넘겨 산 티켓은 available 계산에서 잘려 사라지므로, 남은 자리만큼만 팔게 한다.
  // 무한 티켓을 얻었으면 살 이유가 없으므로 교환을 아예 닫는다 (원판만 없어진다).
  const ticketRoom = unlimited ? 0 : Math.max(0, TICKET_RULE.maxStack - available);

  // needWorkoutToday 가 켜져 있으면 오늘 운동 기록이 있어야 도전할 수 있다.
  // 날짜는 로컬 기준(todayKey) — toISOString 은 UTC라 오전 9시 이전에 어제로 밀린다.
  const playedToday = (workouts[todayKey()] || []).length > 0;
  const canPlay = !PLATE_RULE.needWorkoutToday || playedToday;

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        MINI GAME
      </div>

      {(wLoading || iLoading) ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>LOADING...</div>
      ) : (
        <>
          <PlateDodge
            canPlay={canPlay}
            blockedReason={canPlay ? '' : '오늘 운동을 기록해야 도전할 수 있어요'}
            ticketRoom={ticketRoom}
          />

          {/* 여기서 산 티켓이 어디로 가는지 */}
          <Link
            to="/pachinko"
            className="card"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 10, padding: '12px 16px', textDecoration: 'none',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>
                보유 티켓
              </span>
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, lineHeight: 1,
                color: available > 0 ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                🎫 {ticketText(available, unlimited)}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              파칭코에서 쓰기 →
            </span>
          </Link>
        </>
      )}
    </div>
  );
}
