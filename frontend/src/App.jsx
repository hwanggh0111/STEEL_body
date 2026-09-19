import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import MaintenanceScreen from './components/MaintenanceScreen';
import Toast from './components/Toast';
import ConfirmModalHost from './components/ConfirmModal';
import AppLock from './components/AppLock';
import './styles/globals.css';

// lazy load 페이지들
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const RoutinePage = lazy(() => import('./pages/RoutinePage'));
// 5차 리모델링 — 루틴 · 기록 · 검색 · 기능성운동을 한 흐름으로 (2026-09-04)
const TrainPage = lazy(() => import('./pages/TrainPage'));
// 5차 리모델링 — 인바디 · 측정 · 견주기를 한 자리로 (2026-09-04)
const BodyPage = lazy(() => import('./pages/BodyPage'));
// 몸 지도는 「몸」이 아니라 「오늘」에서 들어온다 (2026-09-16)
const BodyMapPage = lazy(() => import('./pages/BodyMapPage'));
// 목표 — 앱이 여태 「한 것」만 보여주던 자리에 「어디까지 가려는가」를 놓는다 (2026-09-17).
// 홈의 목표 카드에서만 들어온다 — 탭바에도 서랍에도 안 건다 (길을 두 벌로 두지 않는다)
const GoalPage = lazy(() => import('./pages/GoalPage'));
// 기구 — 적어둔 세팅을 한눈에 (2026-09-17, 7차). 「운동」 안의 카드는 '하나',
// 이 탭은 '전부'다 — 같은 자리로 가는 두 벌의 길이 아니다
const GymPage = lazy(() => import('./pages/GymPage'));
// 앱 소개 — 고객센터에서 갈라 나왔다 (2026-09-04)
const IntroPage = lazy(() => import('./pages/IntroPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
// 홈페이지 — **앱 밖으로 나가 새 화면으로 열린다** (2026-09-04).
// 껍데기(Layout) 밖에 건다 — 아래 탭바도 내 계정도 없는, 웹사이트 같은 자리다
const SiteHome = lazy(() => import('./pages/SiteHome'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const HomeworkoutPage = lazy(() => import('./pages/HomeworkoutPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

const SupportPage = lazy(() => import('./pages/support/SupportPage'));
const RemindersPage = lazy(() => import('./pages/RemindersPage'));
const NoticeArchive = lazy(() => import('./pages/support/NoticeArchive'));

function Loading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: 'var(--text-muted)',
      fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2,
    }}>
      LOADING...
    </div>
  );
}

// 로그인해야 열리는 자리.
//
// **가려던 곳을 들려 보낸다** (2026-09-17). 예전에는 그냥 `/login` 으로 보냈고,
// 로그인하면 늘 `/home` 이 열렸다 — **어디로 가려 했는지가 그 자리에서 사라졌다.**
//
// 홈페이지(`/site`)가 바로 그 길이다. 로그인 없이 보는 자리라, 거기서 「몸 지도」나
// 「기록의 벽」을 누르는 사람은 **대개 아직 로그인 전**이다. 눌러서 로그인했더니
// 홈이 열리면, 보러 가려던 것을 다시 찾아 들어가야 한다. 소식 · 고객센터도 같다.
function PrivateRoute({ children }) {
  const { isLoggedIn } = useAuthStore();
  const location = useLocation();
  if (isLoggedIn) return children;
  // `replace` 로 보낸다 — 뒤로 가기를 누르면 못 여는 자리로 또 들어가고,
  // 그러면 로그인 화면으로 다시 튕긴다 (뒤로 가기가 안 먹는 것처럼 보인다)
  return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
}

export default function App() {
  return (
    <MaintenanceScreen>
      <Toast />
      <ConfirmModalHost />

      {/* 화면 하나가 죽어도 앱 전체가 흰 화면이 되지 않게. 배포 직후 옛 조각을
          못 받아오는 것도 여기서 받는다 — 잘못이 아니라 오래된 것이라 저절로 고친다 */}
      <ErrorBoundary>
        <BrowserRouter>
          {/* ── 앱 잠금 ── (2026-09-18)
              **화면 하나가 아니라 앱을 덮는다.** 탭바도 머리도 통째로 가려야 한다 —
              반쯤 가리면 그 틈으로 오늘 한 운동과 몸 사진 미리보기가 보인다.
              그래서 `Routes` 밖이다: 어느 화면에 있든 같은 것이 덮는다.

              **라우터 안에는 둔다** — 지금 어느 자리인지를 알아야 하기 때문이다.
              로그인 · 가입 · 홈페이지(`/site`)는 **안 덮는다**: 잠금이 가리려는 것은
              들어와 있는 사람의 기록이고, 그 셋에는 가릴 것이 없다. 게다가 로그인
              화면을 덮으면 잊었을 때 나갈 길(로그아웃)이 막힌다 */}
          <AppLock />
          <Suspense fallback={<Loading />}>
            <Routes>
              {/* 홈페이지 — **껍데기 밖이다.** 아래 탭바도 머리도 없이 열린다.
                  로그인은 그대로 필요하다 (남이 읽는 글이지만 아무나 읽지는 않는다) */}
              {/* 홈페이지 — **로그인 없이 열린다** (2026-09-16).
                  앱을 아직 안 쓰는 사람에게 이 앱이 무엇인지 말하는 자리다.
                  로그인해야 보이면 그 일을 아예 못 한다 */}
              <Route path="/site" element={<SiteHome />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route index element={<Navigate to="/home" />} />
                <Route path="home" element={<HomePage />} />
                <Route path="routine" element={<RoutinePage />} />
                {/* ── 옛 주소 셋은 **넘긴다** ── (2026-09-19)
                    `/workout`(옛 기록) · `/inbody` · `/measure` 는 앱 안에서 **가는 길이
                    하나도 없는데** 화면은 그대로 떠 있었다. 그 자리들에는 아래 탭바에
                    아무 칸도 안 켜져서, 들어간 사람은 **옆으로 건너갈 수가 없다.**
                    게다가 옛 기록 화면은 지금 「운동」과 같은 일을 하는 두 벌째 구현
                    (929줄)이었다 — 한쪽만 고치는 날이 오면 그때는 늦다.

                    **주소는 그대로 살린다** (북마크 · 폰 홈 화면 바로가기 · 옛 PWA
                    캐시가 그 주소로 온다). 대신 **지금 그 일을 하는 자리로 넘긴다.** */}
                <Route path="workout" element={<Navigate to="/train" replace />} />
                <Route path="train" element={<TrainPage />} />
                <Route path="body" element={<BodyPage />} />
                <Route path="map" element={<BodyMapPage />} />
                {/* 목표 — 홈의 목표 카드에서만 들어온다 (2026-09-17) */}
                <Route path="goal" element={<GoalPage />} />
                <Route path="gym" element={<GymPage />} />
                {/* 인바디 · 재는 도구는 「몸」 탭의 갈래다. 갈래까지 지정해서 넘긴다 —
                    그냥 `/body` 로 보내면 「재는 도구」를 북마크한 사람이 인바디를 본다 */}
                <Route path="inbody" element={<Navigate to="/body" replace state={{ tab: 'inbody' }} />} />
                <Route path="measure" element={<Navigate to="/body" replace state={{ tab: 'measure' }} />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="homeworkout" element={<HomeworkoutPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="support" element={<SupportPage />} />
                <Route path="reminders" element={<RemindersPage />} />
                <Route path="support/notices" element={<NoticeArchive />} />
                {/* 없어진 주소(북마크·홈 화면 바로가기·옛 PWA 캐시)는 홈으로 보낸다.
                    이벤트 페이지를 지우면서 /event 가 빈 화면이 됐다 — 라우트가 없으면
                    Layout 안이 통째로 비어서 앱이 죽은 것처럼 보인다. */}
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </MaintenanceScreen>
  );
}
