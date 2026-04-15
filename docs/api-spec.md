# IRON LOG API 명세서

Base URL: http://localhost:4000/api

## 인증
POST /auth/register   { email, password, nickname }
POST /auth/login      { email, password } → { token, nickname }
GET  /auth/me         헤더: Authorization: Bearer {token}

## 운동 기록
GET    /workouts           전체 목록
GET    /workouts/:date     날짜별 조회 (예: 2025-03-23)
POST   /workouts           { date, exercise, weight, sets, reps }
DELETE /workouts/:id       삭제

## 인바디
GET    /inbody             전체 목록
POST   /inbody             { date, height, weight, fat_pct, muscle_kg, water_l }
DELETE /inbody/:id         삭제

## 헬스체크
GET    /health             { status: "OK" }

## 공통 응답 형식
성공: { data: ..., message: "..." }
실패: { error: "에러 메시지" }
