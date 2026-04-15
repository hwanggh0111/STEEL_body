# IRON LOG QA 보고서

작성일: 2026-03-23
검토자: QA 에이전트

---

## 요약

| 항목 | 개수 |
|------|------|
| 심각한 버그 (즉시 수정 필요) | 0개 |
| 일반 버그 | 3개 |
| 개선 제안 | 5개 |
| 통과 항목 | 18개 |

---

## 심각한 버그 🔴

없음 — 보안 관련 치명적 이슈는 발견되지 않았습니다.

---

## 일반 버그 🟡

### [BUG-001] 인바디 POST에서 weight가 0일 때 통과됨

- **위치**: `backend/src/routes/inbody.js` 8번째 줄
- **문제**: `if (!weight)` 조건은 weight가 0일 때도 falsy로 처리되어 400 에러를 반환함. 체중 0kg은 비정상이지만, 입력 검증 메시지가 부정확할 수 있음.
- **영향**: 경미 — 실제 사용자가 0kg을 입력할 가능성은 낮음
- **수정 방법**: `if (weight === undefined || weight === null)` 또는 `if (!weight && weight !== 0)` 로 변경

### [BUG-002] 프론트엔드 Toast 컴포넌트 다중 마운트 이슈

- **위치**: `frontend/src/components/Toast.jsx` + 각 페이지
- **문제**: Toast가 WorkoutPage, InbodyPage, HistoryPage, LoginPage에 각각 마운트됨. 마지막으로 마운트된 인스턴스만 `showToastFn`을 갖게 되어, 이전 페이지에서 등록한 Toast는 작동 안 함.
- **영향**: 페이지 전환 시 Toast가 간헐적으로 안 보일 수 있음
- **수정 방법**: Toast를 App.jsx 또는 Layout.jsx에 한 번만 마운트하고, 전역 toast 함수 사용

### [BUG-003] SearchPage에서 wger.de API 응답 구조 변경 가능성

- **위치**: `frontend/src/pages/SearchPage.jsx` 20번째 줄
- **문제**: `data.suggestions`로 접근하는데, wger.de API 버전에 따라 응답 구조가 다를 수 있음
- **영향**: 검색 결과가 빈 배열로 표시될 수 있음
- **수정 방법**: API 응답 구조 검증 및 fallback 처리 추가

---

## 개선 제안 🔵

### [IMP-001] 운동 기록 수정(PUT) 기능 없음

- **위치**: `backend/src/routes/workouts.js`, `frontend/src/pages/WorkoutPage.jsx`
- **제안**: 운동 기록 수정 API(PUT /workouts/:id) 및 프론트엔드 편집 UI 추가
- **이유**: 현재는 잘못 입력 시 삭제 후 재입력만 가능

### [IMP-002] 인바디 기록 수정(PUT) 기능 없음

- **위치**: `backend/src/routes/inbody.js`, `frontend/src/pages/InbodyPage.jsx`
- **제안**: 인바디 수정 API 및 UI 추가
- **이유**: 동일하게 삭제 후 재입력만 가능

### [IMP-003] 삭제 시 확인 다이얼로그 없음

- **위치**: `frontend/src/components/WorkoutCard.jsx`, `frontend/src/components/InbodyCard.jsx`
- **제안**: `window.confirm()` 또는 모달로 삭제 확인
- **이유**: 실수로 삭제할 경우 복구 불가

### [IMP-004] 비밀번호 재설정 기능 없음

- **위치**: 전체 인증 시스템
- **제안**: 비밀번호 분실 시 이메일 기반 재설정 기능
- **이유**: MVP 이후 추가 고려

### [IMP-005] API 요청 Rate Limiting 없음

- **위치**: `backend/src/index.js`
- **제안**: express-rate-limit 패키지로 요청 제한 추가
- **이유**: DoS 공격 방지

---

## 통과 항목 ✅

### 백엔드 보안
- [x] 비밀번호 bcrypt 해시 처리됨 (`backend/src/routes/auth.js`)
- [x] SQL Injection 방어 — 모든 쿼리에 파라미터 바인딩(`?`) 사용
- [x] JWT 시크릿이 `.env`에 분리됨, 코드에 하드코딩 없음
- [x] `.env`가 `.gitignore`에 포함됨
- [x] 모든 보호 라우트에 `auth` 미들웨어 적용됨 (workouts, inbody)

### 백엔드 API 로직
- [x] 필수 입력값 검증 있음 (email, password, nickname, exercise, sets, reps, weight)
- [x] 다른 사용자 데이터 접근 차단됨 — 모든 쿼리에 `user_id` 필터 적용
- [x] 존재하지 않는 리소스 삭제 시 404 반환
- [x] 중복 이메일 가입 시 409 반환
- [x] BMI 계산 로직 올바름: `weight / ((height / 100) ** 2)`

### 프론트엔드 인증
- [x] 비로그인 시 PrivateRoute가 `/login`으로 리다이렉트
- [x] 401 응답 시 자동 로그아웃 + 리다이렉트 (axios interceptor)
- [x] 로그아웃 시 localStorage에서 token, nickname 삭제

### 프론트엔드 UX
- [x] 모든 API 요청에 로딩 상태 표시
- [x] API 실패 시 에러 메시지 표시 (빨간색)
- [x] 빈 상태(empty-state) 화면 구현됨 (모든 목록 페이지)
- [x] 저장/삭제 후 목록 자동 업데이트 (fetchAll 호출)
- [x] WeightChart가 2개 미만 데이터일 때 안내 메시지 표시
- [x] BMI 색상 올바름 (파랑: 저체중, 초록: 정상, 노랑: 과체중, 빨강: 비만)

### 보안
- [x] XSS 취약점 없음 — React JSX로 렌더링, dangerouslySetInnerHTML 미사용
- [x] 민감한 정보 URL 미노출
- [x] API 키/시크릿 프론트엔드 미노출

---

## 최종 의견

전체적으로 **코드 품질이 양호**합니다.

**강점:**
- 보안 기본기가 잘 갖추어짐 (bcrypt, JWT, SQL 파라미터 바인딩)
- 디자인 시스템이 일관성 있게 적용됨
- 에러 처리 및 빈 상태 화면이 모든 페이지에 구현됨
- 코드 구조가 깔끔하고 파일별 역할 분리가 명확함

**배포 전 필수 수정:**
1. BUG-002 (Toast 다중 마운트) — Layout.jsx로 Toast 이동 권장
2. IMP-003 (삭제 확인) — 사용자 실수 방지를 위해 필수

**배포 후 우선 개선:**
1. 수정(PUT) 기능 추가
2. Rate Limiting 적용
