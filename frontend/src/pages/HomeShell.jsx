import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';

// HOME — 앱을 열면 나오는 자리.
//
// 여기에 둘이 같이 있다.
//
//   오늘     오늘 무엇을 하면 되는가 (매일 여는 이유)
//   그 밖    커뮤니티 · 소식 · 소개 — **읽으러 오는 자리**
//
// 원래는 「홈페이지」라는 이름으로 서랍에 따로 세웠는데, 그러면 앱을 여는 자리와
// 읽으러 가는 자리가 갈린다. 앱을 열면 늘 여기가 나오니 **여기가 곧 홈페이지다.**
//
// **「오늘」이 먼저다.** 매일 여는 사람은 오늘 할 것만 보고 나간다.
// 나머지 셋은 보러 올 때만 누른다 — 갈래를 옆에 두되 기본은 오늘이다.
//
// 갈래는 **주소에 남긴다** (`/home?v=community`). 남에게 「여기 보세요」라고
// 줄 수 있어야 하고, 새로고침해도 보던 자리에 있어야 한다.

const HomePage = lazy(() => import('./HomePage'));
const CommunityPage = lazy(() => import('./CommunityPage'));
const NoticeArchive = lazy(() => import('./support/NoticeArchive'));
const IntroPage = lazy(() => import('./IntroPage'));

const VIEWS = [
  { key: 'today', label: '오늘' },
  { key: 'community', label: '커뮤니티' },
  { key: 'news', label: '소식' },
  { key: 'about', label: '소개' },
];

function Loading() {
  return (
    <div style={{
      padding: 40, textAlign: 'center', color: 'var(--text-muted)',
      fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2,
    }}>LOADING...</div>
  );
}

export default function HomeShell() {
  const [params, setParams] = useSearchParams();
  const wanted = params.get('v');
  const view = VIEWS.some((v) => v.key === wanted) ? wanted : 'today';

  // 오늘은 주소를 안 붙인다 — 기본 자리라 `/home` 그대로가 맞다
  const go = (key) => {
    if (key === 'today') setParams({}, { replace: false });
    else setParams({ v: key }, { replace: false });
  };

  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 6, marginBottom: 18,
      }}>
        {VIEWS.map((v) => (
          <button
            key={v.key}
            className={`btn-secondary${view === v.key ? ' active' : ''}`}
            style={{ padding: '9px 0', fontSize: 13 }}
            aria-pressed={view === v.key}
            onClick={() => go(v.key)}
          >{v.label}</button>
        ))}
      </div>

      <Suspense fallback={<Loading />}>
        {view === 'today' && <HomePage />}
        {view === 'community' && <CommunityPage embedded />}
        {view === 'news' && <NoticeArchive embedded />}
        {view === 'about' && <IntroPage embedded />}
      </Suspense>
    </div>
  );
}
