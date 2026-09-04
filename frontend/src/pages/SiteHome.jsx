import { lazy, Suspense } from 'react';
import Logo from '../components/Logo';

// 홈페이지 — **앱 밖으로 나가 새 화면으로 열리는 자리**.
//
// 앱 안에 탭으로 끼워 넣었다가 걷었다. 링크를 눌러 **새 화면**으로 열리는 것이
// 홈페이지다 — 앱을 쓰던 자리는 그대로 두고, 읽는 것은 따로 연다. 운동을 적다가
// 커뮤니티를 보러 갔다 오면 적던 자리가 그대로 있어야 한다.
//
// 그래서 이 화면은 **껍데기를 안 쓴다** (`App.jsx` 에서 `Layout` 밖에 걸었다).
// 아래 탭바도 머리의 내 계정도 없다. 앱이 아니라 **웹사이트처럼** 보인다.
//
// 안에 든 것은 **커뮤니티 하나다.** 소개와 소식은 여기 없다 —
// 소개는 고객센터에서 열고, 소식(공지함)은 고객센터 안에 있다.

const CommunityPage = lazy(() => import('./CommunityPage'));

function Loading() {
  return (
    <div style={{
      padding: 60, textAlign: 'center', color: 'var(--text-muted)',
      fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2,
    }}>LOADING...</div>
  );
}

export default function SiteHome() {
  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      {/* 머리 — 사이트의 것이다. 앱의 머리(로고 + 내 계정)와 다르다 */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        backdropFilter: 'var(--surface-blur)',
        WebkitBackdropFilter: 'var(--surface-blur)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{
          maxWidth: 'var(--max-width)', margin: '0 auto',
          padding: '14px var(--padding-x)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Logo cap={18} />
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: 0.5 }}>
            커뮤니티
          </span>
          {/* 앱으로 돌아가는 길. **새 화면으로 열렸으면 닫으면 그만이지만**,
              주소를 직접 치고 들어온 사람에게는 돌아갈 길이 있어야 한다 */}
          <a
            href="/home"
            style={{
              marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-secondary)',
              textDecoration: 'none', border: '1px solid var(--border-hover)',
              padding: '5px 12px', borderRadius: 'var(--radius)',
            }}
          >앱으로</a>
        </div>
      </header>

      <main style={{
        maxWidth: 'var(--max-width)', margin: '0 auto',
        padding: '20px var(--padding-x) 60px',
      }}>
        <Suspense fallback={<Loading />}>
          <CommunityPage />
        </Suspense>
      </main>
    </div>
  );
}
