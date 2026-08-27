import { useState, useRef, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, useNavigationType } from 'react-router-dom';
import TabBar from './TabBar';
import RestBar from './RestBar';
import { useRestTimerStore } from '../store/restTimerStore';
import { useAuthStore } from '../store/authStore';
import { isAdmin as checkAdmin } from '../data/admin';
import MiniSplash from './MiniSplash';
import { toast } from './Toast';
import { confirmDialog } from './ConfirmModal';
import client from '../api/client';
import { readLS, removeLS, saveLS } from '../data/safeStorage';
import { PHOTO_MAX_BASE64, PHOTO_MAX_LABEL } from '../data/photoLimit';
import { shrinkImage } from '../data/shrinkImage';
import PasswordChangeModal from './PasswordChangeModal';
import { useIsPC } from './useIsPC';

const PROFILE_KEY = 'ironlog_profile_photo';


export default function Layout() {
  const { nickname, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sideMenu, setSideMenu] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(readLS(PROFILE_KEY) || '');
  const [editingNick, setEditingNick] = useState(false);
  const [newNick, setNewNick] = useState('');
  const [savingNick, setSavingNick] = useState(false);
  const [zoomImg, setZoomImg] = useState(null);
  const [changingPw, setChangingPw] = useState(false);
  const [showMiniSplash, setShowMiniSplash] = useState(false);
  const location = useLocation();
  const navType = useNavigationType();
  const isPC = useIsPC();
  // 휴식 띠가 떠 있으면 그만큼 아래를 비워둔다 — 안 그러면 마지막 줄이 띠에 가린다
  const restShowing = useRestTimerStore(
    s => s.deadline != null || s.pausedLeft != null || s.finished,
  );
  const [showTopBtn, setShowTopBtn] = useState(false);

  // 다른 화면으로 가면 맨 위에서 시작한다.
  //
  // 없으면 스크롤 위치가 그대로 남아, 히스토리를 한참 내려보다 루틴으로 넘어가면
  // 루틴 화면이 한가운데부터 보인다. 뒤로 가기(POP)일 때는 건드리지 않는다 —
  // 보던 자리로 돌아가는 게 맞다.
  useEffect(() => {
    if (navType === 'POP') return;
    window.scrollTo(0, 0);
  }, [location.pathname, navType]);

  useEffect(() => {
    const handleScroll = () => setShowTopBtn(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const goHome = useCallback(() => {
    if (location.pathname === '/home') return;
    setShowMiniSplash(true);
  }, [location.pathname]);
  const sideRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    client.get('/photos').then(({ data }) => {
      const profile = data.find(p => p.type === 'profile');
      if (profile) {
        setProfilePhoto(profile.data);
        saveLS(PROFILE_KEY, profile.data);
      }
    }).catch(() => {});
  }, []);

  // 바깥을 누르면 닫는 일은 **뒤에 깔린 판**이 한다.
  //
  // 예전에는 `document` 의 mousedown 을 듣고 시트 밖이면 닫았다. 시트를 머리의
  // 아바타 아래로 옮기고 나면 그 방식이 깨진다 — 아바타를 눌러 닫으려 하면
  // mousedown 이 먼저 닫고 click 이 다시 열어서 영영 안 닫힌다.
  // 판이 아바타를 덮고 있으니 판만 있으면 된다.

  // 열려 있는 동안 Esc 로도 닫는다
  useEffect(() => {
    if (!sideMenu) return;
    const onKey = (e) => { if (e.key === 'Escape') setSideMenu(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sideMenu]);

  const initial = nickname ? nickname.charAt(0).toUpperCase() : '?';

  // **한도를 지키라고 말하는 대신 우리가 줄인다.**
  // 요즘 폰 사진은 3~8MB 라, 예전에는 앨범에서 고른 것이 거의 다 거절당했다
  // (shrinkImage 주석 참고). 그래도 안 되는 것만 안내한다
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    let photoData;
    try {
      ({ data: photoData } = await shrinkImage(file));
    } catch {
      toast('사진을 읽지 못했어요', 'error');
      return;
    }
    if (typeof photoData !== 'string' || photoData.length > PHOTO_MAX_BASE64) {
      toast(`사진은 ${PHOTO_MAX_LABEL} 이하만 가능해요`, 'error');
      return;
    }
    setProfilePhoto(photoData);
    client.post('/photos', { type: 'profile', data: photoData }).then(() => {
      saveLS(PROFILE_KEY, photoData);
    }).catch(() => {
      setProfilePhoto(readLS(PROFILE_KEY) || '');
      toast('사진 업로드 실패', 'error');
    });
  };

  const saveNickname = useCallback(() => {
    const trimmed = newNick.trim();
    if (!trimmed || savingNick) return;
    setSavingNick(true);
    client.put('/auth/nickname', { nickname: trimmed }).then(() => {
      saveLS('nickname', trimmed);
      useAuthStore.setState({ nickname: trimmed });
      setEditingNick(false);
      toast('닉네임이 변경됐어요');
    }).catch((err) => {
      toast(err.response?.data?.error || '닉네임 변경 실패', 'error');
    }).finally(() => setSavingNick(false));
  }, [newNick, savingNick]);

  const handlePhotoDelete = async () => {
    const ok = await confirmDialog('프로필 사진을 삭제할까요?', { title: '프로필 사진 삭제', confirmText: '삭제' });
    if (!ok) return;
    removeLS(PROFILE_KEY);
    setProfilePhoto('');
    client.delete('/photos/profile').catch(() => {});
  };

  const Avatar = ({ size, fontSize }) => (
    profilePhoto ? (
      <img src={profilePhoto} alt="프로필" style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover',
        border: '2px solid var(--accent)',
      }} />
    ) : (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--accent)', color: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Bebas Neue', sans-serif", fontSize, fontWeight: 700,
      }}>
        {initial}
      </div>
    )
  );

  return (
    <div className="page-wrapper">
      {/* 머리.
          예전에는 52px 로고 + 36px 워드마크 + 「Forge Your Body · Break Your Limits」
          태그라인이 **모든 화면 위에** 있었다. 앱 이름은 매일 오는 사람이 이미 알고,
          태그라인은 고객센터 소개에 있다. 한 줄로 줄여 본문에 자리를 내준다 */}
      <header style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          {/* PC 에서는 왼쪽 사이드바가 이미 STEEL BODY 를 크게 달고 있다.
              머리에도 그대로 두면 **같은 워드마크 두 개가 나란히** 놓인다.
              PC 는 사이드바가 이름과 길찾기를, 머리가 계정을 맡는다 */}
          <div
            onClick={goHome}
            style={{
              cursor: 'pointer', display: isPC ? 'none' : 'flex',
              alignItems: 'center', gap: 8, minWidth: 0,
            }}
          >
            <svg width="30" height="30" viewBox="0 0 60 60" fill="none" aria-hidden="true">
              <defs><linearGradient id="dbGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffd700"/><stop offset="100%" stopColor="#ff6b1a"/></linearGradient></defs>
              <rect x="12" y="27" width="36" height="6" rx="3" fill="url(#dbGrad)"/>
              <rect x="6" y="18" width="8" height="24" rx="3" fill="url(#dbGrad)"/>
              <rect x="1" y="22" width="7" height="16" rx="2.5" fill="url(#dbGrad)" opacity="0.7"/>
              <rect x="46" y="18" width="8" height="24" rx="3" fill="url(#dbGrad)"/>
              <rect x="52" y="22" width="7" height="16" rx="2.5" fill="url(#dbGrad)" opacity="0.7"/>
            </svg>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 21, fontWeight: 700, letterSpacing: 3, lineHeight: 1,
              background: 'linear-gradient(135deg, #ffd700, #ff6b1a, #ffd700)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              whiteSpace: 'nowrap',
            }}>
              STEEL BODY
            </div>
          </div>

          {/* 내 계정 — 누르면 시트가 열린다.
              예전에는 이 자리가 「아바타 + 닉네임 + 로그아웃 단추」였고, 계정을 손보려면
              화면 **오른쪽 아래에 떠 있는 56px 원형 버튼**을 따로 눌러야 했다.
              같은 사람에 대한 것이 두 자리에 있었고, 떠 있는 쪽은 화면 모서리를 늘 가렸다 */}
          <button
            onClick={() => setSideMenu(v => !v)}
            aria-label="내 계정"
            aria-expanded={sideMenu}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
              background: 'none', cursor: 'pointer', padding: '3px 8px 3px 3px',
              border: `1px solid ${sideMenu ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 999, transition: 'border-color 0.15s',
            }}
          >
            <Avatar size={26} fontSize={13} />
            <span style={{
              fontFamily: "'Barlow', sans-serif", fontSize: 13, fontWeight: 600,
              color: 'var(--text-secondary)', maxWidth: 90,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{nickname}</span>
            {checkAdmin() && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#000', background: 'var(--accent)',
                padding: '1px 6px', borderRadius: 'var(--radius)', letterSpacing: 0.5, flexShrink: 0,
              }}>관리자</span>
            )}
          </button>
        </div>
      </header>

      <main className="content-area" style={{ paddingTop: 22, paddingBottom: (isPC ? 30 : 80) + (restShowing ? 58 : 0) }}>
        {/* 주소를 key 로 준다. content-area 자체는 라우트가 바뀌어도 남아 있어서
            여기에 걸린 등장 애니메이션이 첫 화면에서 한 번만 돌고 말았다 */}
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      {/* 휴식 띠 — 탭 바 바로 위. PC 는 아래 탭 바가 없으므로 바닥에 붙는다 */}
      <RestBar bottom={isPC ? 0 : 60} />

      <TabBar />

      {/* 미니 스플래시 */}
      {showMiniSplash && (
        <MiniSplash onDone={() => { setShowMiniSplash(false); navigate('/home'); }} />
      )}

      {/* 비밀번호 변경.
          바꾸면 서버가 모든 기기의 로그인을 끊는다 — 그래서 여기서도 로그아웃하고 로그인으로 보낸다.
          그대로 두면 다음 요청에서 401 을 맞고 영문 모른 채 튕긴다 */}
      {changingPw && (
        <PasswordChangeModal
          onClose={() => setChangingPw(false)}
          onChanged={async () => {
            setChangingPw(false);
            await logout();
            navigate('/login');
          }}
        />
      )}

      {/* 이미지 확대 모달 */}
      {zoomImg && (
        <div
          onClick={() => setZoomImg(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={zoomImg}
            alt="확대"
            style={{
              maxWidth: '90vw',
              maxHeight: '85vh',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--accent)',
              objectFit: 'contain',
            }}
          />
          <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            color: 'var(--text-primary)',
            fontSize: 24,
            cursor: 'pointer',
          }}>✕</div>
        </div>
      )}

      {/* 내 계정 시트 — 머리의 아바타 아래에 붙는다.
          **길찾기는 여기 없다.** 예전에는 이 안에 「홈 / 운동 / 기록·분석 / 도움 / 관리」
          다섯 무리 열한 줄이 들어 있었다. 아래 탭바와 더보기가 이미 같은 곳을 전부
          담고 있어서, 앱의 세 번째 메뉴였다. 여기는 **나에 대한 것**만 한다 —
          사진 · 닉네임 · 비밀번호 · 로그아웃 */}
      {sideMenu && (
        <div
          onClick={() => setSideMenu(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9997, background: 'rgba(0,0,0,0.35)' }}
        />
      )}
      <div ref={sideRef} style={{
        position: 'fixed',
        top: 58,
        right: 12,
        zIndex: 9998,
        display: sideMenu ? 'flex' : 'none',
        flexDirection: 'column', alignItems: 'flex-end',
      }}>
        {sideMenu && (
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            minWidth: 240,
            maxHeight: '75vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}>
            {/* 프로필 사진 영역 */}
            <div style={{ padding: '20px 18px', textAlign: 'center' }}>
              <div
                onClick={() => fileRef.current?.click()}
                style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}
              >
                {profilePhoto ? (
                  <img src={profilePhoto} alt="프로필"
                    onClick={(e) => { e.stopPropagation(); setZoomImg(profilePhoto); }}
                    style={{
                    width: 70, height: 70, borderRadius: '50%', objectFit: 'cover',
                    border: '3px solid var(--accent)', cursor: 'zoom-in',
                  }} />
                ) : (
                  <div style={{
                    width: 70, height: 70, borderRadius: '50%',
                    background: 'var(--bg-tertiary)', border: '2px dashed var(--accent)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ fontSize: 20, color: 'var(--text-muted)' }}>+</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>사진</div>
                  </div>
                )}
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--accent)', color: '#000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>✎</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />

              {/* 닉네임 (클릭하면 수정) */}
              {editingNick ? (
                <div style={{ marginTop: 10, display: 'flex', gap: 4, justifyContent: 'center' }}>
                  <input
                    className="input"
                    value={newNick}
                    onChange={(e) => setNewNick(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveNickname(); }}
                    autoFocus
                    style={{ width: 120, fontSize: 13, padding: '6px 8px', textAlign: 'center' }}
                    placeholder="새 닉네임"
                  />
                  <button
                    onClick={saveNickname}
                    disabled={savingNick}
                    style={{
                      background: 'var(--accent)', color: '#000', border: 'none',
                      padding: '6px 10px', fontSize: 11, borderRadius: 'var(--radius)',
                      cursor: 'pointer', fontWeight: 700,
                    }}
                  >
                    확인
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => { setNewNick(nickname); setEditingNick(true); }}
                  style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: 'var(--accent)', marginTop: 10, cursor: 'pointer' }}
                  title="클릭하여 닉네임 변경"
                >
                  {nickname} ✎
                </div>
              )}
              {/* 「STEEL BODY 회원」이라고 적혀 있던 자리다. 아무 것도 말하지 않는
                  줄이라 없앴다 — 여기 온 사람은 자기가 회원인 것을 안다 */}

              {/* 비밀번호 변경.
                  로그인 화면의 '비밀번호를 잊으셨나요?' 는 찾기(이메일 인증)라서 다른 것이다.
                  로그인한 채로 바꾸는 자리는 지금까지 어디에도 없었다 */}
              <button
                onClick={() => { setSideMenu(false); setChangingPw(true); }}
                style={{
                  marginTop: 10, background: 'none', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', padding: '4px 12px', cursor: 'pointer',
                  fontSize: 11, borderRadius: 'var(--radius)', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >비밀번호 변경</button>
              {profilePhoto && (
                <button
                  onClick={handlePhotoDelete}
                  style={{
                    marginTop: 8, background: 'none', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', padding: '2px 8px', cursor: 'pointer',
                    fontSize: 10, borderRadius: 'var(--radius)', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  사진 삭제
                </button>
              )}
            </div>

            {/* 나가기 하나.
                예전에는 여기 「로그인」과 「로그아웃」이 나란히 있었다.
                **이미 로그인한 사람에게 로그인 단추**를 준 셈이고, 그걸 누르면
                로그아웃도 없이 로그인 화면으로 갔다. 헤더에도 로그아웃이 또 있었다 */}
            <div
              onClick={async () => { setSideMenu(false); await logout(); navigate('/login'); }}
              style={{ ...menuStyle, borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--danger)' }}
              onMouseEnter={hIn} onMouseLeave={hOut}
            >
              로그아웃
            </div>
          </div>
        )}
      </div>

      {showTopBtn && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: isPC ? 30 : 90, left: 20,
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--accent)', color: '#000', border: 'none',
            fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, transition: 'opacity 0.2s',
          }}
          title="맨 위로"
        >↑</button>
      )}
    </div>
  );
}

const menuStyle = {
  padding: '12px 18px',
  fontSize: 14,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'background 0.15s',
};

function hIn(e) { e.currentTarget.style.background = 'var(--bg-tertiary)'; }
function hOut(e) { e.currentTarget.style.background = 'none'; }
