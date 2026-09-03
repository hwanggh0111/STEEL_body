import { useWorkoutStore } from '../store/workoutStore';
import { offlineStatus } from '../data/offline';
import { confirmDialog } from './ConfirmModal';
import { toast } from './Toast';

// 신호가 없을 때 · 아직 못 올린 것이 있을 때만 나오는 한 줄.
//
// **아무 일도 없으면 아무것도 안 띄운다.** 늘 붙어 있는 띠는 곧 안 보이게 된다.
//
// 무슨 말을 할지는 `data/offline.js` 의 `offlineStatus` 하나가 정한다 —
// 화면마다 조건을 따로 적으면 곧 서로 다른 말을 한다.
export default function OfflineBar() {
  const online = useWorkoutStore((s) => s.online);
  const queue = useWorkoutStore((s) => s.queue);
  const flushing = useWorkoutStore((s) => s.flushing);
  const retryFailed = useWorkoutStore((s) => s.retryFailed);
  const dropFailed = useWorkoutStore((s) => s.dropFailed);

  const status = offlineStatus({ online, queue });
  if (!status) return null;

  const danger = status.kind === 'failed';

  const retry = async () => {
    const res = await retryFailed();
    if (res.sent > 0) toast.success(`${res.sent}개를 올렸어요`);
    else if (res.stopped) toast('아직 신호가 없어요. 연결되면 다시 해볼게요', 'warning');
    else if (res.failed > 0) toast('서버가 받지 않았어요. 내용을 고치거나 지워주세요', 'error');
  };

  // 버리는 것은 사람이 정한다. 무엇을 버리는지 보여주고 한 번 묻는다 —
  // 여기 있는 것은 **사람이 헬스장에서 적은 기록**이다
  const drop = async () => {
    const failed = queue.filter((q) => q.failed);
    const list = failed.slice(0, 5)
      .map((q) => `· ${q.payload.date} ${q.payload.exercise} ${q.payload.weight} ${q.payload.sets}세트`)
      .join('\n');
    const more = failed.length > 5 ? `\n· 외 ${failed.length - 5}개` : '';
    const ok = await confirmDialog(
      `못 올린 기록 ${failed.length}개를 지웁니다. 되돌릴 수 없어요.\n\n${list}${more}`,
      { title: '못 올린 기록 지우기', confirmText: '지웁니다', danger: true },
    );
    if (ok) { dropFailed(); toast('지웠어요'); }
  };

  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '9px 13px', marginBottom: 12,
        border: `1px solid ${danger ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        background: 'var(--bg-card)',
      }}
    >
      <span aria-hidden="true" style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: danger ? 'var(--danger)' : online ? 'var(--accent)' : 'var(--text-muted)',
      }} />
      <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{status.text}</span>
      {status.hint && (
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{status.hint}</span>
      )}
      {danger && (
        <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button
            onClick={retry}
            disabled={flushing}
            style={{
              background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
              padding: '3px 10px', fontSize: 11, borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
          >{flushing ? '올리는 중' : '다시 시도'}</button>
          <button
            onClick={drop}
            disabled={flushing}
            style={{
              background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)',
              padding: '3px 10px', fontSize: 11, borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
          >지우기</button>
        </span>
      )}
    </div>
  );
}
