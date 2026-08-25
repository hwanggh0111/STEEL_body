import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import MaintenanceScreen from './components/MaintenanceScreen';
import Toast from './components/Toast';
import ConfirmModalHost from './components/ConfirmModal';
import './styles/globals.css';

// lazy load 페이지들
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const RoutinePage = lazy(() => import('./pages/RoutinePage'));
const WorkoutPage = lazy(() => import('./pages/WorkoutPage'));
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
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Navigate to="/home" />} />
              <Route path="home" element={<HomePage />} />
              <Route path="routine" element={<RoutinePage />} />
              <Route path="workout" element={<WorkoutPage />} />
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
    </MaintenanceScreen>
  );
}
