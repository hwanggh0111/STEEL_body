import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MiniSplash from './MiniSplash';

const TABS = [
  { path: '/home',    label: '홈',    icon: '🏠' },
  { path: '/workout', label: '기록',  icon: '🏋️' },
  { path: '/inbody',  label: '인바디', icon: '📊' },
  { path: '/routine', label: '루틴',  icon: '📋' },
  { path: '/more',    label: '더보기', icon: '⋯' },
];

const MORE_ITEMS = [
  { path: '/homeworkout', label: '홈트레이닝', icon: '🏠' },
  { path: '/search',     label: '운동 검색',  icon: '🔍' },
  { path: '/measure',    label: '측정 시스템', icon: '📐' },
  { path: '/history',    label: '히스토리',   icon: '📅' },
  { path: '/event',      label: '이벤트',     icon: '🎉' },
  { path: '/game',       label: '미니게임',   icon: '🎮' },
  { path: '/notice',     label: '공지사항',   icon: '📢' },
  { path: '/admin',      label: '관리자',     icon: '⚙️' },
];

function useIsPC() {
  const [isPC, setIsPC] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsPC(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isPC;
}

export default function TabBar() {
  const [showMore, setShowMore] = useState(false);
  const [splash, setSplash] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isPC = useIsPC();

  const handleTab = (path) => {
    if (path === '/more') {
      setShowMore(!showMore);
      return;
    }
    setShowMore(false);
    if (path === '/home' && location.pathname === '/home') return;
    if (path === '/home') {
      setSplash(true);
      return;
    }
    navigate(path);
  };

  const isActive = (path) => {
    if (path === '/more') return showMore || MORE_ITEMS.some(m => location.pathname === m.path);
    return location.pathname === path;
  };

  // ─── PC: 좌측 사이드바 ───
  if (isPC) {
    return (
      <>
        {splash && <MiniSplash onDone={() => { setSplash(false); navigate('/home'); }} />}

        <nav aria-label="메인 네비게이션" style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: 200,
          background: 'var(--bg-primary)',
          borderRight: '1px solid var(--border)',
          zIndex: 9999,
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* 로고 영역 */}
          <div style={{
            padding: '20px 16px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 3,
              lineHeight: 1,
              background: 'linear-gradient(135deg, #ffd700, #ff6b1a, #ffd700)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              cursor: 'pointer',
            }} onClick={() => handleTab('/home')}>
              STEEL BODY
            </div>
          </div>

          {/* 메인 탭 */}
          <div style={{ flex: 1, padding: '8px 0' }}>
            {TABS.filter(t => t.path !== '/more').map(tab => {
              const active = isActive(tab.path);
              return (
                <div
                  key={tab.path}
                  onClick={() => handleTab(tab.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 20px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                    background: active ? 'var(--accent-dim)' : 'none',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'none'; }}
                >
                  <span style={{
                    fontSize: 20,
                    filter: active ? 'none' : 'grayscale(1) opacity(0.5)',
                    transition: 'filter 0.15s',
                  }}>{tab.icon}</span>
                  <span style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 15, letterSpacing: 1.5,
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    transition: 'color 0.15s',
                  }}>{tab.label}</span>
                </div>
              );
            })}

            {/* 구분선 */}
            <div style={{
              height: 1, background: 'var(--border)',
              margin: '8px 16px',
            }} />

            {/* 더보기 항목들 - PC에서는 항상 펼쳐서 표시 */}
            <div style={{ padding: '0' }}>
              <div style={{
                padding: '8px 20px 4px',
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 11, letterSpacing: 1.5,
                color: 'var(--text-muted)',
              }}>MORE</div>
              {MORE_ITEMS.map(item => {
                const active = location.pathname === item.path;
                return (
                  <div
                    key={item.path}
                    onClick={() => { navigate(item.path); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 20px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                      background: active ? 'var(--accent-dim)' : 'none',
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'none'; }}
                  >
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <span style={{
                      fontFamily: "'Barlow', sans-serif",
                      fontSize: 13, fontWeight: 500,
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      transition: 'color 0.15s',
                    }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </nav>
      </>
    );
  }

  // ─── 모바일: 기존 하단 탭바 ───
  return (
    <>
      {splash && <MiniSplash onDone={() => { setSplash(false); navigate('/home'); }} />}

      {/* 더보기 패널 */}
      {showMore && (
        <>
          <div
            onClick={() => setShowMore(false)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', zIndex: 9998,
            }}
          />
          <div style={{
            position: 'fixed', bottom: 60, left: 0, right: 0,
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border)',
            zIndex: 9999,
            padding: '12px 0',
            animation: 'moreSlide 0.2s ease',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 4, maxWidth: 'var(--max-width)', margin: '0 auto', padding: '0 12px',
            }}>
              {MORE_ITEMS.map(item => (
                <div
                  key={item.path}
                  onClick={() => { setShowMore(false); navigate(item.path); }}
                  style={{
                    textAlign: 'center', padding: '12px 4px', cursor: 'pointer',
                    borderRadius: 'var(--radius)',
                    background: location.pathname === item.path ? 'var(--accent-dim)' : 'none',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</div>
                  <div style={{
                    fontSize: 10, fontFamily: "'Barlow', sans-serif", fontWeight: 500,
                    color: location.pathname === item.path ? 'var(--accent)' : 'var(--text-muted)',
                  }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 하단 탭바 */}
      <nav aria-label="하단 네비게이션" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border)',
        zIndex: 9999,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex', width: '100%', maxWidth: 'var(--max-width)',
        }}>
          {TABS.map(tab => {
            const active = isActive(tab.path);
            return (
              <div
                key={tab.path}
                onClick={() => handleTab(tab.path)}
                style={{
                  flex: 1, textAlign: 'center',
                  padding: '8px 0 10px', cursor: 'pointer',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                {active && tab.path !== '/more' && (
                  <div style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: 24, height: 2, background: 'var(--accent)', borderRadius: 1,
                  }} />
                )}
                <div style={{
                  fontSize: tab.path === '/more' ? 24 : 20, marginBottom: 2,
                  filter: active ? 'none' : 'grayscale(1) opacity(0.5)',
                  transition: 'filter 0.15s',
                }}>
                  {tab.icon}
                </div>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 10, letterSpacing: 1,
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'color 0.15s',
                }}>
                  {tab.label}
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      <style>{`
        @keyframes moreSlide {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
