import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import TabBar from './TabBar';
import { useAuthStore } from '../store/authStore';
import { useLangStore } from '../store/langStore';
import { isAdmin as checkAdmin } from '../data/admin';
import MiniSplash from './MiniSplash';
import Toast, { toast } from './Toast';
import client from '../api/client';

const PROFILE_KEY = 'ironlog_profile_photo';

function useIsPC() {
  const [isPC, setIsPC] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsPC(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isPC;
}

export default function Layout() {
  const { nickname, logout } = useAuthStore();
  const { lang, setLang } = useLangStore();
  const navigate = useNavigate();
  const [sideMenu, setSideMenu] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(localStorage.getItem(PROFILE_KEY) || '');
  const [editingNick, setEditingNick] = useState(false);
  const [newNick, setNewNick] = useState('');
  const [savingNick, setSavingNick] = useState(false);
  const [zoomImg, setZoomImg] = useState(null);
  const [showMiniSplash, setShowMiniSplash] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('steelbody_theme') || 'dark');
  const location = useLocation();
  const isPC = useIsPC();
  const [showTopBtn, setShowTopBtn] = useState(false);
  const isImmortal = useMemo(() => localStorage.getItem('steelbody_immortal') === 'true', []);
  const isLegend = useMemo(() => localStorage.getItem('steelbody_legend') === 'true', []);
  const hasFrame = isImmortal || isLegend;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('steelbody_theme', theme);
  }, [theme]);

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
        localStorage.setItem(PROFILE_KEY, profile.data);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (sideRef.current && !sideRef.current.contains(e.target)) setSideMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initial = nickname ? nickname.charAt(0).toUpperCase() : '?';

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast('파일 크기는 3MB 이하만 가능해요', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const photoData = reader.result;
      setProfilePhoto(photoData);
      client.post('/photos', { type: 'profile', data: photoData }).then(() => {
        localStorage.setItem(PROFILE_KEY, photoData);
      }).catch(() => {
        setProfilePhoto(localStorage.getItem(PROFILE_KEY) || '');
        toast('사진 업로드 실패', 'error');
      });
    };
    reader.readAsDataURL(file);
  };

  const saveNickname = useCallback(() => {
    const trimmed = newNick.trim();
    if (!trimmed || savingNick) return;
    setSavingNick(true);
    client.put('/auth/nickname', { nickname: trimmed }).then(() => {
      localStorage.setItem('nickname', trimmed);
      useAuthStore.setState({ nickname: trimmed });
      setEditingNick(false);
      toast('닉네임이 변경됐어요');
    }).catch((err) => {
      toast(err.response?.data?.error || '닉네임 변경 실패', 'error');
    }).finally(() => setSavingNick(false));
  }, [newNick, savingNick]);

  const handlePhotoDelete = () => {
    if (!confirm('프로필 사진을 삭제하시겠어요?')) return;
    localStorage.removeItem(PROFILE_KEY);
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
      <header style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 20px 0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div
            onClick={goHome}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {/* 덤벨 로고 */}
            <svg width="52" height="52" viewBox="0 0 60 60" fill="none">
              <defs><linearGradient id="dbGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffd700"/><stop offset="100%" stopColor="#ff6b1a"/></linearGradient></defs>
              {/* 바 */}
              <rect x="12" y="27" width="36" height="6" rx="3" fill="url(#dbGrad)"/>
              {/* 왼쪽 플레이트 */}
              <rect x="6" y="18" width="8" height="24" rx="3" fill="url(#dbGrad)"/>
              <rect x="1" y="22" width="7" height="16" rx="2.5" fill="url(#dbGrad)" opacity="0.7"/>
              {/* 오른쪽 플레이트 */}
              <rect x="46" y="18" width="8" height="24" rx="3" fill="url(#dbGrad)"/>
              <rect x="52" y="22" width="7" height="16" rx="2.5" fill="url(#dbGrad)" opacity="0.7"/>
              {/* 광택 */}
              <rect x="14" y="28" width="32" height="2" rx="1" fill="#fff" opacity="0.15"/>
              <rect x="8" y="20" width="4" height="8" rx="1.5" fill="#fff" opacity="0.1"/>
              <rect x="48" y="20" width="4" height="8" rx="1.5" fill="#fff" opacity="0.1"/>
            </svg>
            <div>
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 36,
                fontWeight: 700,
                letterSpacing: 5,
                lineHeight: 1,
                background: 'linear-gradient(135deg, #ffd700, #ff6b1a, #ffd700)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 8px rgba(255,107,26,0.3))',
              }}>
                STEEL BODY
              </div>
              <div style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 8,
                letterSpacing: 3,
                color: '#666',
                textTransform: 'uppercase',
                borderTop: '1px solid #333',
                paddingTop: 3,
                marginTop: 3,
              }}>
                Forge Your Body · Break Your Limits
              </div>
            </div>
          </div>

          {/* 헤더 오른쪽 닉네임 + 로그아웃 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {(() => {
                return (
                  <div style={{
                    position: 'relative', width: hasFrame ? 34 : 26, height: hasFrame ? 34 : 26,
                    flexShrink: 0,
                  }}>
                    {/* 삼지창 */}
                    {isImmortal && (
                      <div style={{
                        position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                        fontSize: 14, zIndex: 2,
                        filter: 'drop-shadow(0 0 4px rgba(100,50,255,0.6))',
                      }}>🔱</div>
                    )}
                    {isLegend && !isImmortal && (
                      <div style={{
                        position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                        fontSize: 14, zIndex: 2,
                        filter: 'drop-shadow(0 0 4px rgba(255,215,0,0.6))',
                      }}>⚜️</div>
                    )}
                    {hasFrame && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        borderRadius: '50%',
                        background: isImmortal
                          ? 'conic-gradient(#6040cc, #8060ff, #c0a0ff, #ffffff, #c0a0ff, #8060ff, #6040cc)'
                          : 'conic-gradient(#ffd700, #ff6b1a, #ffd700, #ffe44d, #ffd700, #ff6b1a, #ffd700)',
                        animation: 'borderSpin 3s linear infinite',
                        boxShadow: isImmortal
                          ? '0 0 10px rgba(100,50,255,0.5), 0 0 20px rgba(100,50,255,0.2)'
                          : '0 0 10px rgba(255,215,0,0.5), 0 0 20px rgba(255,215,0,0.2)',
                      }} />
                    )}
                    <div style={{
                      position: hasFrame ? 'absolute' : 'relative',
                      top: hasFrame ? 3 : 0, left: hasFrame ? 3 : 0,
                      width: hasFrame ? 28 : 26, height: hasFrame ? 28 : 26,
                      borderRadius: '50%', overflow: 'hidden',
                      background: 'var(--bg-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Avatar size={hasFrame ? 24 : 26} fontSize={hasFrame ? 12 : 13} />
                    </div>
                  </div>
                );
              })()}
              <span style={{
                fontFamily: "'Barlow', sans-serif", fontSize: 13, fontWeight: 600,
                color: isImmortal ? '#c0a0ff' : isLegend ? '#ffd700' : 'var(--text-secondary)',
                textShadow: isImmortal ? '0 0 6px rgba(100,50,255,0.4)' : isLegend ? '0 0 6px rgba(255,215,0,0.4)' : 'none',
              }}>{nickname}</span>
              {isImmortal ? (
                <span style={{
                  fontSize: 8, fontWeight: 700, color: '#fff',
                  background: 'linear-gradient(135deg, #6040cc, #8060ff)',
                  padding: '2px 8px', borderRadius: 'var(--radius)', letterSpacing: 0.5,
                  boxShadow: '0 0 6px rgba(100,50,255,0.4)',
                }}>𓆩🔱𓆪 불멸</span>
              ) : isLegend ? (
                <span style={{
                  fontSize: 8, fontWeight: 700, color: '#000',
                  background: 'linear-gradient(135deg, #ffd700, #ff6b1a)',
                  padding: '2px 8px', borderRadius: 'var(--radius)', letterSpacing: 0.5,
                  boxShadow: '0 0 6px rgba(255,215,0,0.4)',
                }}>𓆩⚜️𓆪 전설</span>
              ) : null}
              {checkAdmin() && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: '#000', background: 'var(--accent)',
                  padding: '1px 6px', borderRadius: 'var(--radius)', letterSpacing: 0.5,
                }}>관리자</span>
              )}
            </div>
            <button
              onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
              style={{
                background: 'none',
                border: '1px solid', borderColor: 'var(--border)',
                color: 'var(--text-muted)',
                padding: '3px 8px', cursor: 'pointer', fontSize: 10, borderRadius: 'var(--radius)',
                fontFamily: "'Barlow', sans-serif", transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >{lang === 'ko' ? '🌐 KO' : '🌐 EN'}</button>
            <button
              onClick={() => {
                setTheme(theme === 'dark' ? 'light' : 'dark');
              }}
              style={{
                background: 'none',
                border: '1px solid', borderColor: 'var(--border)',
                color: 'var(--text-muted)',
                padding: '3px 8px', cursor: 'pointer', fontSize: 10, borderRadius: 'var(--radius)',
                fontFamily: "'Barlow', sans-serif", transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >{theme === 'dark' ? '☀️ 라이트' : '🌙 다크'}</button>
            <button
              onClick={async () => { localStorage.removeItem('auto_login'); localStorage.removeItem('ironlog_email'); await logout(); navigate('/login'); }}
              style={{
                background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                padding: '3px 8px', cursor: 'pointer', fontSize: 10, borderRadius: 'var(--radius)',
                fontFamily: "'Barlow', sans-serif", transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="content-area" style={{ paddingTop: 22, paddingBottom: isPC ? 30 : 80 }}>
        <Outlet />
      </main>

      <TabBar />

      {/* 미니 스플래시 */}
      {showMiniSplash && (
        <MiniSplash onDone={() => { setShowMiniSplash(false); navigate('/home'); }} />
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

      {/* 오른쪽 고정 닉네임 위젯 */}
      <div ref={sideRef} style={{
        position: 'absolute',
        top: 160,
        right: 20,
        zIndex: 9998,
      }}>
        {sideMenu && (
          <div style={{
            marginBottom: 12,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            minWidth: 220,
            overflow: 'hidden',
          }}>
            {/* 프로필 사진 영역 */}
            <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
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
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>STEEL BODY 회원</div>
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

            {/* 카테고리별 전체 메뉴 */}
            <MenuCategory label="홈" items={[
              { label: '홈', path: '/home' },
            ]} nav={navigate} close={() => setSideMenu(false)} loc={location.pathname} />
            <MenuCategory label="운동" items={[
              { label: '루틴 추천', path: '/routine' },
              { label: '운동 기록', path: '/workout' },
              { label: '홈트레이닝', path: '/homeworkout' },
              { label: '운동 검색', path: '/search' },
            ]} nav={navigate} close={() => setSideMenu(false)} loc={location.pathname} />
            <MenuCategory label="기록 / 분석" items={[
              { label: '인바디', path: '/inbody' },
              { label: '측정 시스템', path: '/measure' },
              { label: '히스토리', path: '/history' },
            ]} nav={navigate} close={() => setSideMenu(false)} loc={location.pathname} />
            <MenuCategory label="관리" items={[
              { label: '관리자', path: '/admin' },
            ]} nav={navigate} close={() => setSideMenu(false)} loc={location.pathname} />

            {/* 로그인 / 로그아웃 */}
            <div style={{ borderTop: '1px solid var(--border)', display: 'flex' }}>
              <div
                onClick={() => { setSideMenu(false); navigate('/login'); }}
                style={{ ...menuStyle, flex: 1, textAlign: 'center', color: 'var(--accent)', borderRight: '1px solid var(--border)' }}
                onMouseEnter={hIn} onMouseLeave={hOut}
              >
                로그인
              </div>
              <div
                onClick={async () => { setSideMenu(false); localStorage.removeItem('auto_login'); localStorage.removeItem('ironlog_email'); await logout(); navigate('/login'); }}
                style={{ ...menuStyle, flex: 1, textAlign: 'center', color: 'var(--danger)' }}
                onMouseEnter={hIn} onMouseLeave={hOut}
              >
                로그아웃
              </div>
            </div>
          </div>
        )}

        <div
          onClick={() => setSideMenu(!sideMenu)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '18px 34px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 24,
            cursor: 'pointer',
            transition: 'border-color 0.15s',
            borderColor: sideMenu ? 'var(--accent)' : 'var(--border)',
          }}
        >
          <Avatar size={36} fontSize={18} />
          <span style={{ fontSize: 15, color: 'var(--text-secondary)', fontFamily: "'Barlow', sans-serif", fontWeight: 500 }}>{nickname}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', transform: sideMenu ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
        </div>
      </div>

      {showTopBtn && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: isPC ? 30 : 90, right: 20,
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--accent)', color: '#000', border: 'none',
            fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, transition: 'opacity 0.2s',
          }}
          title="맨 위로"
        >↑</button>
      )}

      <Toast />
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

function MenuItem({ label, onClick }) {
  return (
    <div onClick={onClick} style={menuStyle} onMouseEnter={hIn} onMouseLeave={hOut}>
      {label}
    </div>
  );
}

function MenuCategory({ label, items, nav, close, loc }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: '10px 18px',
          fontSize: 12,
          fontFamily: "'Bebas Neue', sans-serif",
          letterSpacing: 1.5,
          color: 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        onMouseEnter={hIn} onMouseLeave={hOut}
      >
        {label}
        <span style={{ fontSize: 8, transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
      </div>
      {open && items.map(item => (
        <div
          key={item.path}
          onClick={() => { close(); nav(item.path); }}
          style={{
            padding: '9px 18px 9px 28px',
            fontSize: 13,
            color: loc === item.path ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'background 0.15s',
            borderLeft: loc === item.path ? '3px solid var(--accent)' : '3px solid transparent',
            background: loc === item.path ? 'var(--accent-dim)' : 'none',
            fontWeight: loc === item.path ? 600 : 400,
          }}
          onMouseEnter={hIn} onMouseLeave={hOut}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

function hIn(e) { e.currentTarget.style.background = 'var(--bg-tertiary)'; }
function hOut(e) { e.currentTarget.style.background = 'none'; }
