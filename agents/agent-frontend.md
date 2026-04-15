# ⚛️ 프론트엔드 에이전트 — React 앱

## 네 역할

너는 IRON LOG의 **프론트엔드 개발자**야.
React + Vite로 모든 화면을 만들고, 백엔드 API에 연결해.
반드시 `docs/design-system.md`와 `frontend/src/styles/globals.css`를 따라야 해.

---

## 기술 스택

| 항목 | 기술 |
|------|------|
| 빌드 | Vite |
| 프레임워크 | React 18 |
| 라우팅 | React Router v6 |
| 상태 관리 | Zustand |
| HTTP 요청 | Axios |
| 차트 | Recharts |
| 스타일 | globals.css (CSS 변수 기반) |

---

## 셋업

```bash
cd frontend
npm create vite@latest . -- --template react
npm install react-router-dom zustand axios recharts
```

---

## 폴더 구조

```
frontend/
├── index.html
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── styles/
│   │   └── globals.css          ← 디자이너 에이전트가 만든 CSS
│   ├── api/
│   │   └── client.js            ← Axios 기본 설정
│   ├── store/
│   │   ├── authStore.js         ← 로그인 상태
│   │   ├── workoutStore.js      ← 운동 기록 상태
│   │   └── inbodyStore.js       ← 인바디 기록 상태
│   ├── pages/
│   │   ├── LoginPage.jsx        ← 로그인 / 회원가입
│   │   ├── RoutinePage.jsx      ← 운동 루틴 추천
│   │   ├── WorkoutPage.jsx      ← 운동 기록 입력
│   │   ├── InbodyPage.jsx       ← 인바디 기록
│   │   ├── EquipmentPage.jsx    ← 장비 추천
│   │   ├── SearchPage.jsx       ← 운동 검색 (API)
│   │   └── HistoryPage.jsx      ← 히스토리 + 대시보드
│   └── components/
│       ├── Layout.jsx           ← 공통 레이아웃 (탭바 포함)
│       ├── TabBar.jsx           ← 하단 탭 네비게이션
│       ├── WorkoutCard.jsx      ← 운동 기록 카드
│       ├── InbodyCard.jsx       ← 인바디 기록 카드
│       ├── EquipmentCard.jsx    ← 장비 추천 카드
│       ├── StatBox.jsx          ← 통계 숫자 박스
│       ├── ProgressBar.jsx      ← 체지방률 바
│       ├── WeightChart.jsx      ← 체중 변화 라인 차트
│       └── Toast.jsx            ← 토스트 알림
```

---

## `src/api/client.js` — Axios 설정

```javascript
import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

// 요청 인터셉터: 토큰 자동 첨부
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 응답 인터셉터: 401이면 로그아웃
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
```

---

## `src/store/authStore.js` — 인증 상태

```javascript
import { create } from 'zustand';
import client from '../api/client';

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('token'),
  nickname: localStorage.getItem('nickname'),
  isLoggedIn: !!localStorage.getItem('token'),

  login: async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('nickname', data.nickname);
    set({ token: data.token, nickname: data.nickname, isLoggedIn: true });
  },

  register: async (email, password, nickname) => {
    await client.post('/auth/register', { email, password, nickname });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('nickname');
    set({ token: null, nickname: null, isLoggedIn: false });
  },
}));
```

---

## `src/store/workoutStore.js` — 운동 기록 상태

```javascript
import { create } from 'zustand';
import client from '../api/client';

export const useWorkoutStore = create((set, get) => ({
  workouts: {},   // { 'YYYY-MM-DD': [{ id, exercise, weight, sets, reps }] }
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    const { data } = await client.get('/workouts');
    // 날짜별로 그룹핑
    const grouped = data.reduce((acc, w) => {
      if (!acc[w.date]) acc[w.date] = [];
      acc[w.date].push(w);
      return acc;
    }, {});
    set({ workouts: grouped, loading: false });
  },

  addWorkout: async (workout) => {
    const { data } = await client.post('/workouts', workout);
    await get().fetchAll(); // 목록 새로고침
    return data;
  },

  deleteWorkout: async (id) => {
    await client.delete(`/workouts/${id}`);
    await get().fetchAll();
  },
}));
```

---

## `src/store/inbodyStore.js` — 인바디 상태

```javascript
import { create } from 'zustand';
import client from '../api/client';

export const useInbodyStore = create((set, get) => ({
  records: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    const { data } = await client.get('/inbody');
    set({ records: data, loading: false });
  },

  addRecord: async (record) => {
    const { data } = await client.post('/inbody', record);
    await get().fetchAll();
    return data;
  },

  deleteRecord: async (id) => {
    await client.delete(`/inbody/${id}`);
    await get().fetchAll();
  },
}));
```

---

## `src/App.jsx` — 라우팅

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RoutinePage from './pages/RoutinePage';
import WorkoutPage from './pages/WorkoutPage';
import InbodyPage from './pages/InbodyPage';
import EquipmentPage from './pages/EquipmentPage';
import SearchPage from './pages/SearchPage';
import HistoryPage from './pages/HistoryPage';
import './styles/globals.css';

function PrivateRoute({ children }) {
  const { isLoggedIn } = useAuthStore();
  return isLoggedIn ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/routine" />} />
          <Route path="routine"   element={<RoutinePage />} />
          <Route path="workout"   element={<WorkoutPage />} />
          <Route path="inbody"    element={<InbodyPage />} />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="search"    element={<SearchPage />} />
          <Route path="history"   element={<HistoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

---

## `src/components/Layout.jsx` — 공통 레이아웃

```jsx
import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';
import { useAuthStore } from '../store/authStore';

export default function Layout() {
  const { nickname, logout } = useAuthStore();

  return (
    <div className="page-wrapper">
      {/* 헤더 */}
      <header style={{
        background: '#0d0d0d',
        borderBottom: '1px solid var(--border)',
        padding: '16px 20px 0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 4, color: 'var(--accent)' }}>
            IRON LOG
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'Barlow', fontSize: 13, color: 'var(--text-muted)' }}>{nickname}</span>
            <button onClick={logout} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '4px 10px', cursor: 'pointer', fontSize: 12, borderRadius: 'var(--radius)' }}>
              로그아웃
            </button>
          </div>
        </div>
        <TabBar />
      </header>

      {/* 페이지 내용 */}
      <main className="content-area" style={{ paddingTop: 22, paddingBottom: 40 }}>
        <Outlet />
      </main>
    </div>
  );
}
```

---

## `src/components/TabBar.jsx` — 탭 네비게이션

```jsx
import { NavLink } from 'react-router-dom';

const TABS = [
  { path: '/routine',   label: '루틴'   },
  { path: '/workout',   label: '기록'   },
  { path: '/inbody',    label: '인바디' },
  { path: '/equipment', label: '장비'   },
  { path: '/search',    label: '검색'   },
  { path: '/history',   label: '히스토리' },
];

export default function TabBar() {
  return (
    <nav className="tab-bar">
      {TABS.map(({ path, label }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
```

---

## `src/components/WeightChart.jsx` — 체중 차트

```jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function WeightChart({ records }) {
  const data = [...records]
    .reverse()
    .map(r => ({ date: r.date.slice(5), weight: r.weight }));

  if (data.length < 2) return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13, fontFamily: 'Barlow' }}>
      인바디 기록이 2개 이상 있어야 차트가 표시돼요
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 11 }} />
        <YAxis tick={{ fill: '#555', fontSize: 11 }} domain={['auto', 'auto']} />
        <Tooltip contentStyle={{ background: '#111', border: '1px solid #1e1e1e', color: '#f0f0f0' }} />
        <Line type="monotone" dataKey="weight" stroke="#ff6b1a" strokeWidth={2} dot={{ fill: '#ff6b1a', r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

## 각 페이지가 구현해야 할 기능

### LoginPage.jsx
- 이메일 + 비밀번호 입력 폼
- 로그인 / 회원가입 탭 전환
- `useAuthStore().login()` / `.register()` 호출
- 로그인 성공 시 `/routine` 으로 이동

### RoutinePage.jsx
- 머신 / 맨몸 버튼 전환
- 부위 선택 칩 (가슴, 등, 어깨, 하체, 팔)
- `/api/routines/:type` 에서 데이터 가져오기
- 운동 클릭 시 WorkoutPage로 이동하면서 운동명 전달

### WorkoutPage.jsx
- 날짜, 운동명, 무게, 세트, 횟수 입력
- `useWorkoutStore().addWorkout()` 호출
- 오늘 날짜 기록 목록도 같이 보여주기

### InbodyPage.jsx
- 날짜, 키, 체중, 체지방률, 골격근량, 체수분 입력
- BMI 실시간 계산 + 색상 표시
- `useInbodyStore().addRecord()` 호출
- 과거 인바디 기록 카드 목록 표시

### EquipmentPage.jsx
- 카테고리 필터 (홈짐 입문 / 중급 / 유산소 / 보조 용품)
- 각 장비 카드: 이름, 가격대, 용도, 필수/추천/선택 뱃지

### SearchPage.jsx
- `https://wger.de/api/v2/exercise/search/?term=...&language=english` API 호출
- 영어로 검색 (bench press, squat 등)
- 결과 클릭 시 WorkoutPage로 이동

### HistoryPage.jsx
- 전체 통계 박스 (총 운동일, 총 운동 수, 인바디 기록 수)
- WeightChart 컴포넌트로 체중 변화 차트
- 날짜별 운동 기록 목록

---

## 환경변수 파일

`frontend/.env`:
```env
VITE_API_URL=http://localhost:4000/api
```

---

## 실행 방법

```bash
cd frontend
npm install
npm run dev
```

`http://localhost:5173` 접속해서 화면 나오면 성공!

---

## 중요 원칙

- `globals.css`에 있는 CSS 클래스를 최대한 활용해
- 새 스타일이 필요하면 인라인 style 쓰되, CSS 변수(`var(--accent)` 등) 사용
- 로딩 중일 때 빈 화면 대신 로딩 표시 보여주기
- 에러 발생 시 빨간색으로 에러 메시지 표시
- 빈 목록일 때 empty-state 클래스 활용
- 모든 중요 액션 후 토스트 알림 표시 (저장됨, 삭제됨 등)
