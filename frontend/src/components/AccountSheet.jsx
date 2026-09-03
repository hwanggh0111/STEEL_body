import { useState } from 'react';
import NavIcon from './NavIcon';

// 내 계정.
//
// 9/3 에 다시 만들었다. 그전 모양은 이랬다 —
//
//     +          ← 점선 원 안에 「+ 사진」, 그 위에 금색 동그라미와 ✎ 글자
//    사진
//   개발자3 ✎    ← 이름 옆에 ✎ 를 **글자로** 붙여놨다
//   비밀번호 변경  ← 11px 테두리 단추
//   사진 삭제     ← 10px 테두리 단추
//   로그아웃      ← 14px 빨간 줄
//   계정 삭제     ← 12px 회색 줄
//
// **한 화면에 크기가 다섯, 모양이 셋이었다** (테두리 단추 · 꽉 찬 줄 · 글자 아이콘).
// 눌러야 하는 것과 그냥 적힌 것이 구별되지 않고, ✎ 는 글꼴마다 다르게 그려진다.
//
// 다시 짠 규칙은 셋이다.
//
//   1. **위는 사람, 아래는 할 일.** 사진과 이름은 「내가 누구인가」고, 그 아래는
//      전부 같은 모양의 줄이다. 줄 높이 · 글자 크기 · 아이콘 크기가 하나다
//   2. **금색은 한 자리에만.** 아바타 테두리다. 단추마다 금색을 칠하면 어디를 눌러야
//      하는지가 사라진다. 나머지는 눌렀을 때만 살짝 밝아진다
//   3. **글자를 아이콘 자리에 쓰지 않는다.** ✎ 대신 앱의 선 아이콘(`NavIcon`)을 쓴다
//
// 되돌릴 수 없는 것(로그아웃 · 계정 삭제)은 **줄 사이를 띄워** 아래에 둔다.
// 계정 삭제는 제일 작고 흐리다 — 찾는 사람은 찾고, 안 찾는 사람 손에는 안 걸린다.
export default function AccountSheet({
  nickname, email, photo,
  onPickPhoto, onDeletePhoto, onZoomPhoto,
  onSaveNick, savingNick,
  onChangePw, onLogout, onDeleteAccount,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nickname || '');

  const startEdit = () => { setDraft(nickname || ''); setEditing(true); };
  const save = () => {
    const name = draft.trim();
    if (!name || savingNick) return;
    onSaveNick(name, () => setEditing(false));
  };

  return (
    <div style={{
      width: 268,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
      overflow: 'hidden',
    }}>
      {/* ── 누구인가 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '18px 16px 16px' }}>
        <button
          onClick={() => (photo ? onZoomPhoto(photo) : onPickPhoto())}
          title={photo ? '사진 크게 보기' : '사진 넣기'}
          style={{
            width: 52, height: 52, flexShrink: 0, padding: 0,
            borderRadius: '50%', cursor: photo ? 'zoom-in' : 'pointer',
            border: '1px solid var(--accent)',
            background: photo ? `center/cover no-repeat url(${photo})` : 'var(--bg-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
          }}
        >
          {/* 사진이 없을 때만 그린다. 점선 원과 「+ 사진」 두 줄이 있던 자리다 —
              무엇을 하는 자리인지는 아래 줄(「사진 넣기」)이 말한다 */}
          {!photo && <NavIcon name="camera" size={19} />}
        </button>

        <div style={{ minWidth: 0, flexGrow: 1 }}>
          {editing ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') setEditing(false);
                }}
                autoFocus
                maxLength={30}
                style={{ padding: '7px 9px', fontSize: 13 }}
                placeholder="이름"
                aria-label="새 이름"
              />
              <button
                onClick={save}
                disabled={savingNick}
                style={{
                  flexShrink: 0, border: 'none', cursor: 'pointer',
                  background: 'var(--accent)', color: 'var(--on-accent)',
                  padding: '0 12px', fontSize: 12, fontWeight: 700,
                  borderRadius: 'var(--radius)',
                }}
              >{savingNick ? '…' : '확인'}</button>
            </div>
          ) : (
            <>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 21, letterSpacing: 1.5,
                color: 'var(--text-primary)', lineHeight: 1.15,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{nickname || '이름 없음'}</div>
              {/* **지금 누구로 들어와 있는지**를 적는다. 예전에는 이 자리가
                  「BLACK IRON 회원」이었다 — 아무것도 말하지 않는 줄이었다.
                  기기를 같이 쓰는 사람에게는 이 한 줄이 제일 먼저 필요하다 */}
              {email && (
                <div style={{
                  fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{email}</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 할 수 있는 것 ── */}
      <Group>
        <Row icon="pencil" label="이름 바꾸기" onClick={startEdit} />
        <Row icon="camera" label={photo ? '사진 바꾸기' : '사진 넣기'} onClick={onPickPhoto} />
        {photo && <Row icon="ban" label="사진 지우기" onClick={onDeletePhoto} muted />}
        <Row icon="lock" label="비밀번호 변경" onClick={onChangePw} />
      </Group>

      {/* 되돌릴 수 없는 것은 띄워서 아래에 */}
      <Group>
        <Row icon="exit" label="로그아웃" onClick={onLogout} />
      </Group>

      <button
        onClick={onDeleteAccount}
        style={{
          display: 'block', width: '100%', background: 'none', cursor: 'pointer',
          border: 'none', borderTop: '1px solid var(--border)',
          padding: '11px 16px', fontSize: 11.5, color: 'var(--text-muted)',
          textAlign: 'center', fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >계정 삭제</button>
    </div>
  );
}

function Group({ children }) {
  return <div style={{ borderTop: '1px solid var(--border)', padding: '5px 0' }}>{children}</div>;
}

// 줄 하나. **모두 같은 모양이다** — 높이 · 글자 · 아이콘 크기가 하나라
// 무엇이 눌리는 자리인지 한눈에 보인다
function Row({ icon, label, onClick, muted }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        width: '100%', padding: '10px 16px',
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 13, fontFamily: 'inherit', textAlign: 'left',
        color: muted ? 'var(--text-muted)' : 'var(--text-secondary)',
        transition: 'background 0.13s, color 0.13s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-tertiary)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none';
        e.currentTarget.style.color = muted ? 'var(--text-muted)' : 'var(--text-secondary)';
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0, opacity: 0.85 }} aria-hidden="true">
        <NavIcon name={icon} size={16} />
      </span>
      {label}
    </button>
  );
}
