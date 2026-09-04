import { lazy, Suspense, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Logo from '../components/Logo';

// 홈페이지 — 앱 안에 있는 **웹사이트 같은 자리**.
//
// 이 앱은 지금까지 「혼자 쓰는 도구」였다. 운동을 적고 · 몸을 재고 · 되짚는다.
// 그 셋은 아래 탭바에 있고, 다 **자기 것만** 본다.
//
// 여기는 다르다. **읽으러 오는 자리다.**
//
//   소개    이 앱이 무엇을 하는지 (처음 온 사람이 읽는다)
//   소식    무엇이 바뀌었는지 (블로그처럼 시간순으로 쌓인다)
//   커뮤니티 같이 하는 사람들이 쓴 글 (남이 읽는다)
//
// **셋을 따로 두지 않는다.** 처음에 소개와 커뮤니티를 서랍의 다른 줄로 만들었는데,
// 그러면 「읽으러 가는 곳」이 서랍에 세 줄로 흩어진다 — 앱의 다른 자리에서 이미
// 두 번 겪은 일이다(더보기 서랍이 둘이던 것 · 소개가 고객센터 안에 접혀 있던 것).
// 하나로 들어와서 안에서 고른다.
//
// 안쪽 셋은 **그대로 쓴다.** 각자 잘 하고 있고 제목만 안 그리게 했다(`embedded`).
// 5차가 바꾸는 것은 경계지 안쪽이 아니다.

const IntroPage = lazy(() => import('./IntroPage'));
const NoticeArchive = lazy(() => import('./support/NoticeArchive'));
const CommunityPage = lazy(() => import('./CommunityPage'));

const TABS = [
  { key: 'intro', label: '소개' },
  { key: 'news', label: '소식' },
  { key: 'community', label: '커뮤니티' },
];

function Loading() {
  return (
    <div style={{
      padding: 40, textAlign: 'center', color: 'var(--text-muted)',
      fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2,
    }}>LOADING...</div>
  );
}

export default function SitePage() {
  const location = useLocation();
  // 어디로 바로 들어올 수 있다 — 서랍에서 「커뮤니티」를 누르면 그 갈래로 열린다
  const wanted = location.state?.tab;
  const [tab, setTab] = useState(
    TABS.some((t) => t.key === wanted) ? wanted : 'intro',
  );

  return (
    <div>
      {/* 머리 — **앱 화면이 아니라 사이트처럼 보이게** 로고를 세운다.
          여기 들어오면 도구를 쓰던 자리에서 잠깐 나온 것이다 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 11, marginBottom: 6,
      }}>
        {/* **크기를 직접 적지 않는다.** 로고는 시안에 있는 크기만 쓴다 —
            `npm run check` 가 시안에 없는 크기를 잡는다 */}
        <Logo cap={20} />
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: 0.5, marginLeft: 2 }}>
          적으면 남고, 남으면 보인다
        </div>
      </div>

      <div className="rule-beam" style={{ margin: '14px 0 16px' }} />

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 6, marginBottom: 18,
      }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn-secondary${tab === t.key ? ' active' : ''}`}
            style={{ padding: '9px 0', fontSize: 13 }}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >{t.label}</button>
        ))}
      </div>

      <Suspense fallback={<Loading />}>
        {tab === 'intro' && <IntroPage embedded />}
        {tab === 'news' && <NoticeArchive embedded />}
        {tab === 'community' && <CommunityPage embedded />}
      </Suspense>
    </div>
  );
}
