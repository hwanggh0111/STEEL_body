import { useState } from 'react';
import { toast } from '../Toast';
import { readLS } from '../../data/safeStorage';

// 통째로 떠받기 (2026-10-01).
//
// 이 앱의 기록 **전부**가 파일 두 장에 있다. 사람마다 자기 것 내려받기는 있었지만
// (`/api/export/*`), **통째로 떠서 되돌리는 길이 아무 데도 없었다.** 파일 하나가
// 잘못되면 아홉 사람의 기록이 한 번에 사라진다.
//
// 서버가 Render 에 있으면 `npm run backup` 은 못 돌린다 — 그래서 화면에도 둔다.
//
// **사진은 안 담긴다.** 사람마다 세 장씩이면 수십 MB 라 브라우저가 받다 죽고,
// 서버는 `--max-old-space-size=256` 으로 돈다. 그것까지 뜨려면 손으로 돌리는 쪽이다.
// **빠진 것을 적어두는 것이 이 화면의 일이다** — 받은 사람이 「다 떴다」고 믿으면
// 그 믿음이 더 위험하다.
export default function BackupAdmin() {
  const [busy, setBusy] = useState(false);

  const download = () => {
    if (busy) return;
    setBusy(true);
    const baseURL = import.meta.env.VITE_API_URL || '/api';
    const token = readLS('token');
    fetch(`${baseURL}/export/backup`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('backup failed');
        return res.blob();
      })
      .then(blob => {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `blackiron-${stamp}.json`;
        // 문서에 안 붙인 링크는 눌러도 아무 일이 없는 브라우저가 있다. 그리고
        // 곧바로 revoke 하면 받기가 시작되기 전에 주소가 사라져 빈 파일이 된다
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast('떠받았어요');
      })
      .catch(() => toast('떠받지 못했어요', 'error'))
      .finally(() => setBusy(false));
  };

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        통째로 떠받기
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 14px' }}>
        이 앱의 기록 <strong style={{ color: 'var(--text-primary)' }}>전부</strong>를 한 장으로 받습니다 —
        회원 · 운동 · 인바디 · 측정 · 루틴 · 메모 · 제보 · 목표 · 기구 세팅.
        <br />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          되돌릴 수 있어야 백업이라, 보기 좋은 표가 아니라 <b>서버가 들고 있는 그대로</b>의 모양입니다.
        </span>
      </p>

      {/* 빠진 것을 **먼저** 적는다. 받은 사람이 「다 떴다」고 믿는 쪽이 더 위험하다 */}
      <div className="card" style={{
        padding: '12px 14px', marginBottom: 12, borderLeft: '2px solid var(--warning)',
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>사진은 안 들어갑니다</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          프로필 · 전 · 후 사진은 따로 담겨 있고 수십 MB 라, 브라우저로 받으면 받다 멈춥니다.
          사진까지 뜨려면 서버에서 <code style={{ fontSize: 11 }}>npm run backup</code> 을 돌려야 합니다.
        </div>
      </div>

      <div className="card" style={{
        padding: '12px 14px', marginBottom: 12, borderLeft: '2px solid var(--danger)',
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>받은 파일은 간수하세요</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          회원들의 메일 주소와 <b>비밀번호 해시</b>가 들어 있습니다. 비밀번호를 빼면 되돌렸을 때
          아무도 로그인을 못 하니 뺄 수가 없어요. 메신저나 메일로 보내지 마시고,
          <b> 본인 컴퓨터에만</b> 두세요.
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={download}
        disabled={busy}
        style={{ width: '100%', minHeight: 44 }}
      >{busy ? '떠받는 중…' : '통째로 떠받기'}</button>

      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 12 }}>
        배포하기 전과 큰 것을 고치기 전에 한 번씩 떠두시면 됩니다.
      </div>
    </div>
  );
}
