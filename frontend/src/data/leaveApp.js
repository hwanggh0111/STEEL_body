import { useWorkoutStore } from '../store/workoutStore';
import { useNoteStore } from '../store/noteStore';
import { useAuthStore } from '../store/authStore';
import { confirmDialog } from '../components/ConfirmModal';
import { toast } from '../components/Toast';

// 나가기 — **로그아웃 하나에 두 벌이 있으면 안 되는 자리** (2026-09-22).
//
// 로그아웃은 「토큰을 비우고 로그인 화면으로」가 아니다. 그 전에 **줄에 남은 것**을
// 올려야 한다 — 신호가 없는 헬스장에서 적은 기록은 서버에 못 가고 이 기기에만
// 담겨 있다(`workoutStore.queue` · `noteStore.queue`). 그대로 로그아웃하면
// **사람이 손으로 적은 것이 사라진다.**
//
// 여태 이 일이 `Layout` 안에만 있었다. 설정함에서도 로그아웃할 수 있게 되면서
// 두 벌이 될 뻔했다 — 한쪽만 고치는 날이 오면, 그날 누군가의 기록이 날아간다.
//
// 그래서 여기 한 곳에 둔다.

/**
 * 나간다.
 *
 * 돌려주는 것: 실제로 나갔으면 true. 사람이 「그만두기」를 고르면 false —
 * 부르는 쪽은 그때 **시트를 닫거나 화면을 옮기지 않아야** 한다.
 */
export async function leaveApp() {
  const left = () => useWorkoutStore.getState().queue.length
    + Object.keys(useNoteStore.getState().queue).length;

  if (left() > 0) {
    // 나가기 전에 **한 번 더 올려본다.** 여기서 올라가면 아무 말도 안 하고 조용히 나간다
    const a = await useWorkoutStore.getState().flushQueue();
    const b = await useNoteStore.getState().flushQueue();
    const remain = left();
    if (remain > 0) {
      const ok = await confirmDialog(
        `아직 올리지 못한 기록이 ${remain}개 있어요. 지금 로그아웃하면 이 기기에서 사라집니다.`,
        { title: '올리지 못한 기록', confirmText: '그래도 로그아웃', danger: true },
      );
      if (!ok) return false;
    } else if (a.sent + b.sent > 0) {
      toast.success(`적어둔 것 ${a.sent + b.sent}개를 올렸어요`);
    }
  }

  // **홈 화면 위젯을 비운다** (2026-10-16). 위젯은 앱 밖에 있다 — 로그아웃해도
  // 폰 홈 화면에는 나간 사람의 몸 이야기가 그대로 남아 있었다
  // (「가슴이 3일째 식어 있습니다」).
  //
  // **여기서도 쓸 때 받는다.** 맨 위에서 받으면 이 파일을 쓰는 껍데기까지
  // 위젯 조각(과 그것이 보는 `bodyHeat`)을 같이 받는다 — 방금 떼어낸 그것이다.
  // 로그아웃은 사람이 누르는 일이라 그때 받아도 늦지 않다
  try { (await import('./homeWidget')).clearWidget(); } catch { /* 위젯 때문에 못 나가면 안 된다 */ }

  await useAuthStore.getState().logout();
  return true;
}
