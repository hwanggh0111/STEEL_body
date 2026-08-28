import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MiniSplash from './MiniSplash';
import Logo from './Logo';
import { isAdmin } from '../data/admin';
import { useIsPC } from './useIsPC';
import { usePendingReports } from './usePendingReports';

const TABS = [
  { path: '/home',    label: '홈',    icon: '🏠' },
  { path: '/workout', label: '기록',  icon: '🏋️' },
  { path: '/inbody',  label: '인바디', icon: '📊' },
  { path: '/routine', label: '루틴',  icon: '📋' },
  { path: '/more',    label: '더보기', icon: '⋯' },
];

const MORE_ITEMS_ALL = [
  { path: '/homeworkout', label: '홈트레이닝', icon: '🏠' },
  { path: '/search',     label: '운동 검색',  icon: '🔍' },
  { path: '/measure',    label: '측정 시스템', icon: '📐' },
  { path: '/history',    label: '히스토리',   icon: '📅' },
  { path: '/reminders',  label: '운동 알림',  icon: '🔔' },
  { path: '/support',    label: '고객센터',   icon: '📮' },
  { path: '/admin',      label: '관리자',     icon: '⚙️', adminOnly: true },
];

// ─── 통일 디자인 토큰 ──────────────────
const NAV_TOKENS = {
  iconSize: 22,
  iconSizeSmall: 20,
  labelSize: 11,
  labelLetterSpacing: 1,
  labelFont: "'Bebas Neue', sans-serif",
  paddingY: 10,
  paddingX: 16,
  activeBarSize: 24,
};


export default function TabBar() {
  const [showMore, setShowMore] = useState(false);
  const [splash, setSplash] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(isAdmin());
  const location = useLocation();
  const navigate = useNavigate();
  const isPC = useIsPC();
  // 손볼 제보가 있으면 관리자 항목에 숫자를 붙인다 — 화면을 열어봐야만 알던 것이다
  const pending = usePendingReports();

  // 관리자 권한 변경 감지 (다른 탭에서 로그인/로그아웃 시)
  useEffect(() => {
    const handler = () => setIsAdminUser(isAdmin());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // 권한 기반 메뉴 필터링
  const moreItems = useMemo(
    () => MORE_ITEMS_ALL
      .filter(i => !i.adminOnly || isAdminUser)
      .map(i => (i.path === '/admin' ? { ...i, badge: pending.total } : i)),
    [isAdminUser, pending.total]
  );

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

  // 하위 주소도 그 항목으로 친다 — /support/notices(공지함)에서 더보기가 꺼져 있으면
  // 지금 어디에 있는지가 아무 데도 안 뜬다
  const onPath = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const isActive = (path) => {
    if (path === '/more') return showMore || moreItems.some(m => onPath(m.path));
    return onPath(path);
  };

  // ─── 공통 셀 컴포넌트 (모양/크기 통일) ───
  const NavCell = ({ item, active, onClick, layout = 'vertical' }) => (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: layout === 'vertical' ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: layout === 'vertical' ? 4 : 12,
        padding: layout === 'vertical' ? `${NAV_TOKENS.paddingY}px 4px` : `${NAV_TOKENS.paddingY}px ${NAV_TOKENS.paddingX}px`,
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.15s',
        borderLeft: layout === 'horizontal' && active ? '3px solid var(--accent)' : '3px solid transparent',
        background: active ? 'var(--accent-dim)' : 'none',
        borderRadius: layout === 'vertical' ? 'var(--radius)' : 0,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'none'; }}
    >
      {/* 모바일 상단 active bar */}
      {layout === 'vertical' && active && (
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: NAV_TOKENS.activeBarSize, height: 2, background: 'var(--accent)', borderRadius: 1,
        }} />
      )}
      <span style={{
        fontSize: NAV_TOKENS.iconSize,
        opacity: active ? 1 : 0.7,
        transition: 'opacity 0.15s, transform 0.15s',
        transform: active ? 'scale(1.05)' : 'scale(1)',
        lineHeight: 1,
        position: 'relative',
      }}>
        {item.icon}
        {item.badge > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -8,
            minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 8, background: 'var(--danger-strong)', color: '#fff',
            fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
            fontFamily: "'Barlow', sans-serif",
          }}>{item.badge > 99 ? '99+' : item.badge}</span>
        )}
      </span>
      <span style={{
        fontFamily: NAV_TOKENS.labelFont,
        fontSize: NAV_TOKENS.labelSize,
        letterSpacing: NAV_TOKENS.labelLetterSpacing,
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        transition: 'color 0.15s',
        whiteSpace: 'nowrap',
      }}>{item.label}</span>
    </div>
  );

  // ─── PC: 좌측 사이드바 ───
  if (isPC) {
    return (
      <>
        {splash && <MiniSplash onDone={() => { setSplash(false); navigate('/home'); }} />}

        <nav aria-label="메인 네비게이션" style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: 200,
          background: 'var(--surface)',
          backdropFilter: 'var(--surface-blur)',
          WebkitBackdropFilter: 'var(--surface-blur)',
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
            <Logo cap={19} style={{ cursor: 'pointer' }} onClick={() => handleTab('/home')} />
          </div>

          {/* 메인 탭 */}
          <div style={{ flex: 1, padding: '8px 0' }}>
            {TABS.filter(t => t.path !== '/more').map(tab => (
              <NavCell
                key={tab.path}
                item={tab}
                active={isActive(tab.path)}
                onClick={() => handleTab(tab.path)}
                layout="horizontal"
              />
            ))}

            {/* 구분선 */}
            <div style={{
              height: 1, background: 'var(--border)',
              margin: '8px 16px',
            }} />

            {/* 더보기 항목들 */}
            <div>
              <div style={{
                padding: '8px 20px 4px',
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 11, letterSpacing: 1.5,
                color: 'var(--text-muted)',
              }}>더보기</div>
              {moreItems.map(item => (
                <NavCell
                  key={item.path}
                  item={item}
                  active={onPath(item.path)}
                  onClick={() => navigate(item.path)}
                  layout="horizontal"
                />
              ))}
            </div>
          </div>
        </nav>
      </>
    );
  }

  // ─── 모바일: 하단 탭바 + 더보기 패널 ───
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
              {moreItems.map(item => (
                <NavCell
                  key={item.path}
                  item={item}
                  active={onPath(item.path)}
                  onClick={() => { setShowMore(false); navigate(item.path); }}
                  layout="vertical"
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* 하단 탭바 */}
      <nav aria-label="하단 네비게이션" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)',
        backdropFilter: 'var(--surface-blur)',
        WebkitBackdropFilter: 'var(--surface-blur)',
        borderTop: '1px solid var(--border)',
        zIndex: 9999,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex', width: '100%', maxWidth: 'var(--max-width)',
        }}>
          {TABS.map(tab => (
            <div key={tab.path} style={{ flex: 1 }}>
              <NavCell
                item={tab.path === '/more' ? { ...tab, badge: pending.total } : tab}
                active={isActive(tab.path)}
                onClick={() => handleTab(tab.path)}
                layout="vertical"
              />
            </div>
          ))}
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
