import { useState, useEffect } from 'react';
import { useWorkoutStore } from '../store/workoutStore';
import { useNoteStore } from '../store/noteStore';
import { offlineStatus } from '../data/offline';
import { queueList } from '../data/offlineNotes';
import { confirmDialog } from './ConfirmModal';
import { toast } from './Toast';

// 줄바꿈 글자. 메모 첫 줄만 꺼낼 때 쓴다
const NL = String.fromCharCode(10);

// 신호가 없을 때 · 아직 못 올린 것이 있을 때만 나오는 한 줄.
//
// **아무 일도 없으면 아무것도 안 띄운다.** 늘 붙어 있는 띠는 곧 안 보이게 된다.
//
// 무슨 말을 할지는 `data/offline.js` 의 `offlineStatus` 하나가 정한다 —
// 화면마다 조건을 따로 적으면 곧 서로 다른 말을 한다.
//
// **띠도 하나다.** 운동 기록과 그날 메모를 따로 세면, 신호가 없을 때 같은 말을 하는
// 줄이 두 개 뜬다. 줄을 합쳐서 한 번에 센다 — 사람에게는 「적어둔 것 3개」지
// 「기록 2개 · 메모 1개」가 아니다.
export default function OfflineBar() {
  const online = useWorkoutStore((s) => s.online);
  const workoutQueue = useWorkoutStore((s) => s.queue);
  const flushing = useWorkoutStore((s) => s.flushing);
  const retryFailed = useWorkoutStore((s) => s.retryFailed);
  const dropFailed = useWorkoutStore((s) => s.dropFailed);

  // 메모의 줄은 날짜로 찾는 모양이라(하루 한 장) 여기서 배열로 바꿔 합친다
  const noteQueueMap = useNoteStore((s) => s.queue);
  const noteFlushing = useNoteStore((s) => s.flushing);
  const noteRetry = useNoteStore((s) => s.retryFailed);
  const noteDrop = useNoteStore((s) => s.dropFailed);

  const queue = [...workoutQueue, ...queueList(noteQueueMap)];
  const busy = flushing || noteFlushing;

  // **담지 못한 것은 가장 급한 말이다** — 다른 줄은 「나중에 올라간다」는 뜻이지만
  // 이것만은 「앱을 닫으면 사라진다」는 뜻이다 (2026-10-24)
  const unsaved = useWorkoutStore((s) => s.unsaved) || useNoteStore((s) => s.unsaved);

  // ── 서버가 「잠시 뒤에」라고 했으면 **기다렸다 저절로 다시 올린다** ── (2026-10-24)
  //
  // 전역 셈은 분당 100 이다. 줄이 그보다 길면 올리는 중간에 429 가 오는데, 여태
  // 그것을 「서버가 받지 않았어요」로 표시해서 **사람이 누를 때까지 영영 안 올라갔다.**
  // 이제 그 줄은 표시하지 않고 기다린다 — 기다리는 일은 이 띠가 한다(초를 센다).
  const tooFastUntil = Math.max(
    useWorkoutStore((s) => s.tooFastUntil) || 0,
    useNoteStore((s) => s.tooFastUntil) || 0,
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (tooFastUntil <= Date.now()) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [tooFastUntil]);
  const tooFastLeftSec = Math.max(0, Math.ceil((tooFastUntil - now) / 1000));
  // 때가 되면 **한 번 더 올려본다.** 줄은 표시되지 않았으니 그대로 집어간다
  useEffect(() => {
    if (!tooFastUntil || tooFastLeftSec > 0) return;
    useWorkoutStore.getState().flushQueue();
    useNoteStore.getState().flushQueue();
  }, [tooFastUntil, tooFastLeftSec]);

  const status = offlineStatus({ online, queue, unsaved, tooFastLeftSec });
  if (!status) return null;

  const danger = status.kind === 'failed' || status.kind === 'unsaved';

  const retry = async () => {
    const a = await retryFailed();
    const b = await noteRetry();
    const sent = a.sent + b.sent;
    if (sent > 0) toast.success(`${sent}개를 올렸어요`);
    // 계정이 막혀서 멈춘 것이면 **아무 말도 안 한다** — 덮는 화면
    // (`AccountBlocked`)이 이미 까닭과 기한을 말하고 있다. 여기서 「신호가
    // 없어요」를 띄우면 없는 까닭을 말하는 것이 된다 (2026-10-24)
    else if (a.blocked || b.blocked) { /* 덮는 화면이 말한다 */ }
    // 서버가 「잠시 뒤에」라고 한 것은 실패가 아니다 — 띠가 초를 세어 저절로 다시 한다
    else if (a.tooFastMs || b.tooFastMs) {
      toast('서버가 잠깐 쉬라고 했어요. 조금 뒤에 저절로 다시 올려요', 'warning');
    }
    else if (a.stopped || b.stopped) toast('아직 신호가 없어요. 연결되면 다시 해볼게요', 'warning');
    else if (a.failed + b.failed > 0) toast('서버가 받지 않았어요. 내용을 고치거나 지워주세요', 'error');
  };

  // 버리는 것은 사람이 정한다. 무엇을 버리는지 보여주고 한 번 묻는다 —
  // 여기 있는 것은 **사람이 헬스장에서 적은 기록**이다
  const drop = async () => {
    const failed = queue.filter((q) => q.failed);
    const list = failed.slice(0, 5)
      .map((q) => (q.kind === 'note' ? noteLabel(q) : `· ${q.payload.date} ${q.payload.exercise} ${q.payload.weight} ${q.payload.sets}세트`))
      .join('\n');
    const more = failed.length > 5 ? `\n· 외 ${failed.length - 5}개` : '';
    const ok = await confirmDialog(
      `못 올린 기록 ${failed.length}개를 지웁니다. 되돌릴 수 없어요.\n\n${list}${more}`,
      { title: '못 올린 기록 지우기', confirmText: '지웁니다', danger: true },
    );
    if (ok) { dropFailed(); noteDrop(); toast('지웠어요'); }
  };

  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '9px 13px', marginBottom: 12,
        border: `1px solid ${danger ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        background: 'var(--card-bg)',
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
            disabled={busy}
            style={{
              background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
              padding: '3px 10px', fontSize: 11, borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
          >{busy ? '올리는 중' : '다시 시도'}</button>
          <button
            onClick={drop}
            disabled={busy}
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

// 지울 것을 보여줄 때 메모는 **적은 첫 줄**로 적는다 — 무엇을 지우는지 알고 눌러야 한다
function noteLabel(q) {
  if (q.op === 'delete') return `· ${q.date} 메모 지우기`;
  const first = String(q.body || '').split(NL).find((l) => l.trim()) || '';
  return `· ${q.date} 메모 「${first.trim().slice(0, 14)}」`;
}
