import { useState, useEffect } from 'react';
import NavIcon from './NavIcon';
import LockSetup from './LockSetup';
import { useLockStore } from '../store/lockStore';
import client from '../api/client';

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
  drawer = [], onGo,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nickname || '');
  // 앱 잠금 (2026-09-18). **줄 하나를 펴서 그 자리에서 건다** — 화면을 새로 만들
  // 크기가 아니고(칸 둘과 단추 하나), 기기·계정에 관한 일은 여기 모여 있다
  const [lockOpen, setLockOpen] = useState(false);
  const lockOn = useLockStore((s) => s.enabled);

  // ── 아이디 ── (2026-10-02)
  //
  // 이 시트는 **「내가 누구로 들어와 있나」**를 말하는 자리다(이름 · 메일). 그런데
  // 로그인에 치는 이름인 아이디만 빠져 있었다 — 설정함에만 있었다.
  //
  // **서버에만 있는 값이라 물어봐야 안다.** 이 파일은 시트를 열 때만 불려 오므로
  // (`Layout` 이 lazy 로 들고 있다) 여기서 물어보는 것이 가장 싸다 — 앱이 뜰 때마다
  // 묻지 않는다. 못 받아오면 줄을 안 그린다.
  const [username, setUsername] = useState('');
  // 구글로만 가입한 사람은 **비밀번호가 없다.** 「비밀번호 변경」은 현재 비밀번호를
  // 묻는 창을 여는데 그 사람은 모르는 값이라, 눌러도 끝까지 갈 수 없었다.
  // 같은 요청에서 같이 받아 **말과 가는 곳을 바꾼다**
  const [isSocial, setIsSocial] = useState(false);
  // 아이디를 **지금 바꿀 수 있나.** 0 이면 된다. 이 줄은 설정함으로 보내기만 하는데,
  // 막혀 있는 줄 모르고 건너가면 **가서야** 안다 — 설정함에서 누르기 전에 알려주기로
  // 한 것과 같은 선이다(6차). 며칠인지는 서버가 센다
  const [idDaysLeft, setIdDaysLeft] = useState(0);
  useEffect(() => {
    let alive = true;
    client.get('/auth/me')
      .then(({ data }) => {
        if (!alive) return;
        setUsername(data?.username || '');
        setIsSocial(!!data?.is_social);
        setIdDaysLeft(Number(data?.username_days_left) || 0);
      })
      .catch(() => { /* 아이디 줄만 안 보인다. 시트는 그대로 돌아간다 */ });
    return () => { alive = false; };
  }, []);

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
                fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 21, letterSpacing: 1.5,
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
              {/* 아이디는 메일 아래에 둔다. **둘 다 로그인에 치는 것**이라
                  한자리에 모여 있어야 「무엇으로 들어가지」가 한눈에 보인다 */}
              {username && (
                <div style={{
                  fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>아이디 {username}</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 서랍 ── (5차 리모델링, 2026-09-04)
          아래 탭바의 「더보기」를 걷고 여기로 옮겼다. **서랍이 둘이면 무엇이 어느
          쪽에 있는지를 사람이 외워야 한다** — 운동 알림은 더보기, 비밀번호는 여기.
          한 자리로 모으면 외울 것이 없다 */}
      {drawer.length > 0 && (
        <Group>
          {drawer.map((item) => (
            <Row
              key={item.path + (item.param || '')}
              icon={item.icon}
              label={item.label}
              badge={item.badge}
              onClick={() => onGo?.(item)}
            />
          ))}
        </Group>
      )}

      {/* ── 할 수 있는 것 ── */}
      <Group>
        <Row icon="pencil" label="이름 바꾸기" onClick={startEdit} />
        {/* **여기서 바꾸지 않고 설정함으로 보낸다.** 아이디는 중복 확인과 30일 제한이
            붙어 있어서 칸 하나로 끝나는 일이 아니다 — 고치는 자리를 두 벌로 만들면
            규칙도 두 벌이 된다(사진을 계정 시트 한 곳에만 둔 것과 같은 까닭).
            대신 **여기에 길이 있다는 것**은 알려준다 */}
        {username && (
          <Row
            icon="gear"
            label="아이디 바꾸기"
            // 막혀 있으면 **가기 전에** 적는다. 길은 막지 않는다 — 거기서 지금 아이디와
            // 까닭을 같이 보는 것이 낫다
            badgeText={idDaysLeft > 0 ? `${idDaysLeft}일 뒤` : null}
            muted={idDaysLeft > 0}
            onClick={() => onGo?.({ path: '/settings' })}
          />
        )}
        <Row icon="camera" label={photo ? '사진 바꾸기' : '사진 넣기'} onClick={onPickPhoto} />
        {photo && <Row icon="ban" label="사진 지우기" onClick={onDeletePhoto} muted />}
        {/* 없는 것을 「바꾼다」고 적지 않는다 — 이 앱이 거절해온 바로 그것이다
            (죽은 규칙을 두면 사람은 그 기능이 있다고 믿는다) */}
        <Row
          icon="lock"
          label={isSocial ? '비밀번호 만들기' : '비밀번호 변경'}
          onClick={() => onChangePw?.(isSocial)}
        />
        {/* ── 앱 잠금 ── (2026-09-18)
            **몸 사진이 들어 있는 앱**인데 폰을 잠깐 빌려주면 다 보인다. 앱은 늘
            로그인된 채로 열려 있어서 여는 데 아무것도 필요 없었다.
            켜져 있으면 그렇다고 오른쪽에 적는다 — 걸어뒀는지 눌러봐야 아는 것이
            제일 나쁘다 */}
        <Row
          icon="shield"
          label="앱 잠금"
          badgeText={lockOn ? '켜짐' : null}
          onClick={() => setLockOpen((v) => !v)}
        />
        {lockOpen && <LockSetup onClose={() => setLockOpen(false)} />}
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
// `badgeText` 는 **숫자가 아닌 표시**다 (「켜짐」) — 켜져 있는지 눌러봐야 아는 것이
// 제일 나쁘다. 숫자 배지(`badge`)와 색이 다르다: 그쪽은 「해야 할 것」이고
// 이쪽은 「지금 이렇다」다
function Row({ icon, label, onClick, muted, badge, badgeText }) {
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
      {badgeText && (
        <span style={{
          marginLeft: 'auto', color: 'var(--accent)',
          fontSize: 11, lineHeight: 1, fontFamily: "'Barlow', 'IBM Plex Sans KR', sans-serif",
        }}>{badgeText}</span>
      )}
      {badge > 0 && (
        <span style={{
          marginLeft: 'auto',
          background: 'var(--warning)', color: 'var(--on-accent)',
          fontSize: 10.5, lineHeight: 1, padding: '3px 6px',
          borderRadius: 'var(--radius)', fontFamily: "'Barlow', 'IBM Plex Sans KR', sans-serif",
        }}>{badge > 99 ? '99+' : badge}</span>
      )}
    </button>
  );
}
