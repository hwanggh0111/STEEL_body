import { useState, useEffect } from 'react';
import NavIcon from './NavIcon';
import LockSetup from './LockSetup';
import { useLockStore } from '../store/lockStore';
import client from '../api/client';
import { NICKNAME_MAX } from '../data/limits';

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
  photoStage = null, photoFail = '', onClearPhotoFail,
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

  // ── ★ **사진 일을 동그라미 한 자리로 모은다** ── (2026-11-20 · 시안 1120-photo C안)
  //
  // 여태 세 자리에 흩어져 있었다 — 동그라미(크게 보기) · 줄 「사진 바꾸기」 ·
  // 줄 「사진 지우기」. 그런데 **사진이 있으면 동그라미로는 바꿀 수가 없었다**
  // (누르면 크게 보기다). 사람은 동그라미를 먼저 누르고, 거기서 아무것도 못 한다.
  // 동그라미 하나에 셋을 모으고 **연필 딱지로 「누를 수 있다」를 그림으로** 말한다.
  const [photoMenu, setPhotoMenu] = useState(false);
  // **하는 중에는 안 열린다** — 바꾸는 사이에 또 바꾸라고 열어주면 안 된다
  const busyPhoto = !!photoStage;
  useEffect(() => { if (busyPhoto) setPhotoMenu(false); }, [busyPhoto]);
  // 메뉴는 Esc 로 닫힌다 — 떠 있는 것에 **나갈 길**을 안 주면 갇힌다 (집안 규칙)
  useEffect(() => {
    if (!photoMenu) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setPhotoMenu(false); } };
    // **잡는 차례(capture)로 듣는다** (2026-11-23). 서랍의 Esc 는 `document` 에서
    // 듣는데, 거품 차례에서는 `document` 가 `window` 보다 먼저라 여기서 멈춰도 늦었다 —
    // Esc 한 번에 메뉴만이 아니라 **계정 서랍 전체**가 닫혔다
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [photoMenu]);

  // 걸음을 **사람 말로** 적는다. 느린 까닭이 다르다 — 읽기·굽기는 폰 탓, 올리기는 신호 탓
  const STAGE_SAY = { read: '사진 읽는 중…', shrink: '사진 줄이는 중…', upload: '올리는 중…' };

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
        {/* 동그라미 하나가 사진 일 전부를 쥔다. 사진이 없으면 누르자마자 고르는 칸이
            열리고(갈래가 하나뿐이라 메뉴를 열면 걸음만 는다), 있으면 세 갈래를 낸다 */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => {
              if (busyPhoto) return;
              if (!photo) { onPickPhoto(); return; }
              setPhotoMenu((v) => !v);
            }}
            title={photo ? '사진 바꾸기 · 크게 보기 · 지우기' : '사진 넣기'}
            aria-label={photo ? '사진' : '사진 넣기'}
            aria-haspopup={photo ? 'menu' : undefined}
            aria-expanded={photo ? photoMenu : undefined}
            disabled={busyPhoto}
            style={{
              width: 52, height: 52, flexShrink: 0, padding: 0,
              borderRadius: '50%', cursor: busyPhoto ? 'default' : 'pointer',
              border: '1px solid var(--accent)',
              background: photo ? `center/cover no-repeat url(${photo})` : 'var(--bg-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            {/* 사진이 없을 때만 그린다. 점선 원과 「+ 사진」 두 줄이 있던 자리다 */}
            {!photo && <NavIcon name="camera" size={19} />}
          </button>

          {/* **하는 중에는 그 사진 위에서 고리가 돈다** — 일이 어디서 벌어지는지가
              한눈에 선다. 글자는 이름 아래 줄이 맡는다 */}
          {busyPhoto && (
            <span aria-hidden="true" style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              // ★ 고리도 **금을 안 쓴다.** 이 시트의 금 세 자리는 이미 차 있다 —
              // 아바타 테두리 · 이름 확인 단추 · 줄의 딱지 글씨(`check-data` 가 센다).
              // 고리는 **움직임으로** 보인다(도는 것). 색을 더 쓸 까닭이 없다
              border: '2px solid var(--border)', borderTopColor: 'var(--text-primary)',
              animation: 'spin 0.9s linear infinite',
            }} />
          )}

          {/* 연필 딱지 — **누를 수 있다는 것을 그림으로** 말한다.
              `pointerEvents: none` 이라 딱지를 눌러도 동그라미가 받는다
              (딱지가 과녁을 쪼개면 44px 규칙이 깨진다) */}
          {photo && !busyPhoto && (
            <span aria-hidden="true" style={{
              position: 'absolute', right: -3, bottom: -3,
              width: 20, height: 20, borderRadius: '50%', pointerEvents: 'none',
              // ★ **금을 안 쓴다.** 집안 규칙이 「금색은 한 자리」이고(`check-data` 가
              // 센다) 이 시트에서 그 자리는 **아바타 테두리**다. 딱지까지 금으로 칠하면
              // 「어디를 눌러야 하나」가 흩어진다 — 11/20 에 그 자가 울어서 되돌렸다.
              // 딱지는 **모양으로** 말한다(동그라미 + 연필), 색으로 말하지 않는다
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-hover)',
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><NavIcon name="pencil" size={11} /></span>
          )}

          {/* ── 세 갈래 ── 바깥을 눌러도 닫힌다(아래 덮개) · Esc 로도 닫힌다 */}
          {photoMenu && photo && (
            <>
              <div
                onClick={() => setPhotoMenu(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 1 }}
                aria-hidden="true"
              />
              <div
                role="menu"
                aria-label="사진"
                style={{
                  position: 'absolute', left: 0, top: 58, zIndex: 2, width: 186,
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-hover)',
                  borderRadius: 'var(--radius)', boxShadow: '0 14px 30px rgba(0,0,0,0.5)',
                  overflow: 'hidden',
                }}
              >
                <MenuItem icon="search" label="크게 보기"
                  onClick={() => { setPhotoMenu(false); onZoomPhoto(photo); }} />
                <MenuItem icon="camera" label="사진 바꾸기"
                  onClick={() => { setPhotoMenu(false); onPickPhoto(); }} />
                <MenuItem icon="ban" label="사진 지우기" danger
                  onClick={() => { setPhotoMenu(false); onDeletePhoto(); }} />
              </div>
            </>
          )}
        </div>

        <div style={{ minWidth: 0, flexGrow: 1 }}>
          {editing ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // 한글을 조합하는 중의 Enter 는 글자를 끝내는 것이지 저장이 아니다 (2026-11-23)
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return; 
                  if (e.key === 'Enter') save();
                  // 고치기만 접는다 — 안 멈추면 서랍의 Esc 까지 닿아 서랍째 닫힌다
                  if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); }
                }}
                autoFocus
                maxLength={NICKNAME_MAX}
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
                fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif", fontSize: 22, letterSpacing: 1.5,
                color: 'var(--text-primary)', lineHeight: 1.15,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{nickname || '이름 없음'}</div>
              {/* **지금 누구로 들어와 있는지**를 적는다. 예전에는 이 자리가
                  「BLACK IRON 회원」이었다 — 아무것도 말하지 않는 줄이었다.
                  기기를 같이 쓰는 사람에게는 이 한 줄이 제일 먼저 필요하다 */}
              {email && (
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)', marginTop: 3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{email}</div>
              )}
              {/* 아이디는 메일 아래에 둔다. **둘 다 로그인에 치는 것**이라
                  한자리에 모여 있어야 「무엇으로 들어가지」가 한눈에 보인다 */}
              {username && (
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)', marginTop: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>아이디 {username}</div>
              )}
              {/* **지금 무엇을 하는 중인가.** 말줄임을 걸지 않는다 — 이 줄은 짧고,
                  글자를 키운 폰에서 잘리면 안 되는 쪽이다 */}
              {busyPhoto && (
                // 금은 고리가 쓴다 — 글자까지 금이면 금이 두 자리가 된다 (집안 규칙)
                <div role="status" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                  {STAGE_SAY[photoStage] || '하는 중…'}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── ★ **까닭은 그 자리에 남는다** ── (2026-11-20 · A안)
          토스트는 3초면 사라져 「무엇을 하라는 거였지」가 된다. 못 읽은 형식 · 큰 사진 ·
          못 올린 것 — 셋 다 **다음 걸음**이 있어야 뜻이 있다. 그래서 그 걸음을 **단추로**
          붙인다(「다시 고르기」). 금색 바탕은 안 쓴다 — 최고 기록 배너가 입는 옷이라
          그 옷을 알림이 입으면 **잘했다는 줄 알고 넘긴다**(11/13 · `_s.css` 머리글) */}
      {photoFail && !busyPhoto && (
        <div role="alert" style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)',
          borderLeft: '2px solid var(--danger)',
          padding: '11px 14px 12px', fontSize: 12, lineHeight: 1.7,
          color: 'var(--text-secondary)',
        }}>
          <span aria-hidden="true" style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }}>
            {/* `alert` 라는 이름은 이 집에 **없다** — 없는 이름을 적으면 조용히
                빈 자리가 된다(그려지지 않는다). 있는 것 중 「주의」에 가장 가까운
                `siren` 을 쓴다 (2026-11-20 · `NavIcon.jsx` 의 이름 45개를 세어 골랐다) */}
            <NavIcon name="siren" size={14} />
          </span>
          <span style={{ minWidth: 0 }}>
            {photoFail}
            <span style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={onPickPhoto}
                style={{
                  minHeight: 32, background: 'none', border: '1px solid var(--border-hover)',
                  color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 12,
                  padding: '6px 11px', borderRadius: 'var(--radius)', cursor: 'pointer',
                }}
              >다시 고르기</button>
              <button
                onClick={() => onClearPhotoFail?.()}
                style={{
                  minHeight: 32, background: 'none', border: 'none',
                  color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: 12,
                  padding: '6px 9px', cursor: 'pointer',
                }}
              >닫기</button>
            </span>
          </span>
        </div>
      )}

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
        {/* ── 사진 줄 둘을 걷었다 ── (2026-11-20 · C안)
            「사진 바꾸기」 · 「사진 지우기」가 여기 있었다. **동그라미 하나로 모았다** —
            사진 일이 세 자리에 흩어져 있어서, 사람이 동그라미를 눌러도 바꿀 수가 없었다.
            **사진이 없을 때만** 줄을 남긴다: 그때는 동그라미에 아무것도 안 그려져 있어
            **누를 자리인지 모른다**(점선 원과 「+ 사진」을 걷은 9/3 이후로 그렇다).
            없는 것을 「바꾼다」고 적지 않는 선은 그대로다 */}
        {!photo && <Row icon="camera" label="사진 넣기" onClick={onPickPhoto} />}
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
          padding: '11px 16px', fontSize: 11, color: 'var(--text-muted)',
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
/**
 * 메뉴 한 줄. **44px 과녁**을 지킨다 — 손가락 기기에서 `globals.css` 가 단추 높이를
 * 44 로 키우므로, 여기서 더 작게 두면 폰에서만 꼴이 달라진다(11/18 의 그 류).
 */
function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        minHeight: 44, padding: '0 13px',
        background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
        color: danger ? 'var(--danger)' : 'var(--text-secondary)',
        fontSize: 13, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      <span style={{ display: 'flex', flexShrink: 0, opacity: 0.85 }} aria-hidden="true">
        <NavIcon name={icon} size={15} />
      </span>
      {label}
    </button>
  );
}

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
          fontSize: 11, lineHeight: 1, fontFamily: "'Barlow', 'BI Sans KR', sans-serif",
        }}>{badgeText}</span>
      )}
      {badge > 0 && (
        <span style={{
          marginLeft: 'auto',
          background: 'var(--warning)', color: 'var(--on-accent)',
          fontSize: 11, lineHeight: 1, padding: '3px 6px',
          borderRadius: 'var(--radius)', fontFamily: "'Barlow', 'BI Sans KR', sans-serif",
        }}>{badge > 99 ? '99+' : badge}</span>
      )}
    </button>
  );
}
