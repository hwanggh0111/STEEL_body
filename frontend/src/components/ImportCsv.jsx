import { useRef, useState } from 'react';
import client from '../api/client';
import { toast } from './Toast';
import { confirmDialog } from '../components/ConfirmModal';

// 내려받은 파일을 다시 넣는다 (2026-09-18).
//
// 내보내기는 있는데 **되돌릴 길이 없었다.** 기기를 바꾸거나 계정을 새로 만들면
// 내려받아 둔 파일이 있어도 못 넣는다. 게다가 이 DB 는 파일 하나라 날아갈 위험이
// 남아 있다 — 「챙겨 나갈 수는 있는데 들고 들어올 수는 없다」는 반쪽이다.
//
// ── 이 단추가 지키는 것 ──
//
// **기록이 하나도 없을 때도 보여야 한다.** 내보내기는 「내려받을 것이 있을 때만」
// 나오는 것이 맞지만, 가져오기는 **정반대**다 — 새 기기에서 처음 열었을 때, 즉
// 아무것도 없을 때가 이것이 제일 필요한 순간이다. 그래서 빈 화면에도 놓는다.
//
// **읽는 일은 서버가 한다.** 화면에서 쪼개 한 줄씩 올릴 수도 있지만, 5년치가 3만 줄이고
// 전역 제한은 분당 100 요청이다 — 사람이 제 기록을 되돌리는 일이 공격으로 보인다.
// 파일 한 장을 한 번에 올린다.
//
// **크게 안 띄운다.** 평소에는 흐린 한 줄이고, 누르면 파일 고르개가 열린다.

const MAX_BYTES = 2 * 1024 * 1024;

export default function ImportCsv({ kind, label, onDone, style }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = () => { if (!busy) fileRef.current?.click(); };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    // 같은 파일을 다시 고를 수 있어야 한다 — 값을 비워두지 않으면 `change` 가 안 온다
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast('파일이 너무 커요. 기간을 나눠 넣어주세요', 'error');
      return;
    }

    // **무엇을 넣는지 한 번 확인한다.** 파일 이름을 잘못 고르는 일이 실제로 잦다
    // (운동 파일을 인바디 자리에 넣는 것). 넣은 뒤에 지우는 것은 훨씬 번거롭다
    const yes = await confirmDialog(
      `「${file.name}」 을 ${label} 기록으로 넣을까요?

이미 있는 것과 똑같은 줄은 건너뜁니다 — 같은 파일을 두 번 넣어도 늘어나지 않아요.`,
      { title: `${label} 가져오기`, confirmText: '넣습니다', danger: false },
    );
    if (!yes) return;

    setBusy(true);
    try {
      // 글자로 읽는다. 한글 엑셀이 붙인 BOM 은 서버가 걷는다
      const csv = await file.text();
      const { data } = await client.post('/import', { kind, csv });

      // **무슨 일이 일어났는지 수로 말한다.** 「완료」만 띄우면 넣었는지 건너뛴 것인지
      // 알 수 없고, 다음에 또 넣어본다
      const parts = [`${data.added}줄 넣었어요`];
      if (data.skipped) parts.push(`${data.skipped}줄은 이미 있어서 건너뛰었어요`);
      if (data.failed) parts.push(`${data.failed}줄은 못 넣었어요`);
      toast(parts.join(' · '), data.added > 0 ? 'success' : 'error');

      // 못 넣은 줄이 있으면 **왜인지 보여준다.** 「몇 줄 실패」로 끝내면 파일을
      // 고칠 수가 없다. 처음 다섯 가지만 — 백 줄을 늘어놓으면 아무도 안 읽는다
      if (data.failed && Array.isArray(data.reasons) && data.reasons.length) {
        const lines = data.reasons.slice(0, 5)
          .map((r) => (r.line ? `${r.line}째 줄 — ${r.why}` : r.why));
        await confirmDialog(
          `못 넣은 줄이 ${data.failed}개 있어요.\n\n${lines.join('\n')}${
            data.failed > lines.length ? `\n… 그 밖에 ${data.failed - lines.length}줄` : ''
          }\n\n넣은 줄은 그대로 남아 있습니다. 파일을 고쳐 다시 넣으면 건너뛴 줄은 다시 안 들어갑니다.`,
          { title: '못 넣은 줄', confirmText: '알겠습니다', cancelText: '닫기', danger: false },
        );
      }

      if (data.added > 0) onDone?.();
    } catch (err) {
      const res = err.response?.data;
      toast(res?.error || '가져오지 못했어요', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onFile}
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        onClick={pick}
        disabled={busy}
        title={`내려받아 둔 ${label} CSV 파일을 넣습니다`}
        style={{
          background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
          padding: '6px 11px', fontSize: 11.5, borderRadius: 'var(--radius)',
          cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          opacity: busy ? 0.6 : 1, ...style,
        }}
      >{busy ? '넣는 중…' : `${label} 가져오기`}</button>
    </>
  );
}
