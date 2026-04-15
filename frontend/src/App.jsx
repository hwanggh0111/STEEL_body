import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import MaintenanceScreen from './components/MaintenanceScreen';
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
const NoticePage = lazy(() => import('./pages/NoticePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const EventPage = lazy(() => import('./pages/EventPage'));
const GamePage = lazy(() => import('./pages/GamePage'));

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
              <Route path="notice" element={<NoticePage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="event" element={<EventPage />} />
              <Route path="game" element={<GamePage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </MaintenanceScreen>
  );
}
