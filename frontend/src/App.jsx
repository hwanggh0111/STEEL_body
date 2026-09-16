import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import MaintenanceScreen from './components/MaintenanceScreen';
import Toast from './components/Toast';
import ConfirmModalHost from './components/ConfirmModal';
import './styles/globals.css';

// lazy load 페이지들
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const RoutinePage = lazy(() => import('./pages/RoutinePage'));
const WorkoutPage = lazy(() => import('./pages/WorkoutPage'));
// 5차 리모델링 — 루틴 · 기록 · 검색 · 기능성운동을 한 흐름으로 (2026-09-04)
const TrainPage = lazy(() => import('./pages/TrainPage'));
// 5차 리모델링 — 인바디 · 측정 · 견주기를 한 자리로 (2026-09-04)
const BodyPage = lazy(() => import('./pages/BodyPage'));
// 몸 지도는 「몸」이 아니라 「오늘」에서 들어온다 (2026-09-16)
const BodyMapPage = lazy(() => import('./pages/BodyMapPage'));
// 앱 소개 — 고객센터에서 갈라 나왔다 (2026-09-04)
const IntroPage = lazy(() => import('./pages/IntroPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
// 홈페이지 — **앱 밖으로 나가 새 화면으로 열린다** (2026-09-04).
// 껍데기(Layout) 밖에 건다 — 아래 탭바도 내 계정도 없는, 웹사이트 같은 자리다
const SiteHome = lazy(() => import('./pages/SiteHome'));
const InbodyPage = lazy(() => import('./pages/InbodyPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const HomeworkoutPage = lazy(() => import('./pages/HomeworkoutPage'));
const MeasurePage = lazy(() => import('./pages/MeasurePage'));
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

function PrivateRoute({ children }) {
  const { isLoggedIn } = useAuthStore();
  return isLoggedIn ? children : <Navigate to="/login" />;
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
                <Route path="workout" element={<WorkoutPage />} />
                <Route path="train" element={<TrainPage />} />
                <Route path="body" element={<BodyPage />} />
                <Route path="map" element={<BodyMapPage />} />
                <Route path="inbody" element={<InbodyPage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="homeworkout" element={<HomeworkoutPage />} />
                <Route path="measure" element={<MeasurePage />} />
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
