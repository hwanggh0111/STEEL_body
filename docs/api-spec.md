# STEEL BODY API 명세서

최종 확인: 2026-08-24 (실제 라우터에서 뽑아 맞춘 판본)

Base URL — 개발 `http://localhost:4000/api` · 운영 `https://steel-body.onrender.com/api`

## 인증 방식

httpOnly 쿠키가 기본이다. `Authorization: Bearer {token}` 도 받는다 (앱·도구용).

| 쿠키 | 내용 | 수명 | 경로 |
|---|---|---|---|
| `sb_access` | 액세스 토큰 (JWT, HS256) | 15분 | `/` |
| `sb_refresh` | 리프레시 토큰 | 7일 | `/api/auth` |
| `sb_csrf` | CSRF 토큰 (httpOnly 아님) | 7일 | `/` |

- **CSRF** — 쿠키로 인증하는 `GET`·`HEAD`·`OPTIONS` 외의 요청은 `X-CSRF-Token` 헤더가 `sb_csrf` 쿠키와 같아야 한다. `/api/auth/*` · `/api/oauth/*` 는 검사하지 않는다(로그인 전).
  인증 쿠키가 **없는** 순수 Bearer 요청은 검사를 건너뛴다.
- 설정값은 `backend/src/config/security.js` 한곳에 있다 (JWT 수명 · bcrypt · rate limit · body 한도).

## 표시 규칙

| 표시 | 뜻 |
|---|---|
| — | 로그인 없이 |
| 🔒 | 로그인 필요 |
| 🛡 | 관리자만 |

실패 응답은 언제나 `{ "error": "사람이 읽을 수 있는 한 줄" }` 이다.

---

## 인증 `/auth`

| | 경로 | 본문 · 비고 |
|---|---|---|
| POST | `/auth/register` | `{ email, password, nickname, username }` — 가입 즉시 로그인된다 |
| POST | `/auth/login` | `{ email, password }` — `email` 자리에 아이디도 받는다. **이메일은 대소문자를 가리지 않는다** |
| POST | `/auth/refresh` | 쿠키의 리프레시 토큰으로 재발급 (회전식 — 쓰면 옛 것은 지운다) |
| POST | `/auth/logout` | 쿠키 정리 |
| GET | `/auth/me` 🔒 | 내 정보 |
| PUT | `/auth/nickname` 🔒 | `{ nickname }` |
| PUT | `/auth/password` 🔒 | `{ currentPassword, newPassword }` |
| POST | `/auth/reset-password` | 인증코드로 재설정 |
| POST | `/auth/send-code` | 이메일 인증코드 발송 (1분 3회) |
| POST | `/auth/verify-code` | 코드 확인 |
| POST | `/auth/check-email` · `/auth/check-username` | 중복 확인 |

## 소셜 로그인 `/oauth`

| | 경로 |
|---|---|
| GET | `/oauth/google` · `/oauth/naver` · `/oauth/facebook` · `/oauth/instagram` — 각 제공자로 보낸다 |
| GET | `/oauth/{제공자}/callback` — 돌아오는 자리. state 는 1회용이고 10분이면 만료된다 |
| POST | `/oauth/google/code` | `{ code }` — 앱에서 받은 authorization code 를 교환한다 |

돌려보낼 곳은 허용 목록(`FRONTEND_URL`, `RENDER_EXTERNAL_URL`)에 있는 주소만 쓴다.

## 운동 기록 `/workouts` 🔒

| | 경로 | 본문 |
|---|---|---|
| GET | `/workouts` | 전체 |
| GET | `/workouts/:date` | `2026-08-24` 형식 |
| POST | `/workouts` | `{ date, exercise, weight, sets, reps }` |
| PUT | `/workouts/:id` | 같은 모양 |
| DELETE | `/workouts/:id` | |

무게는 자유 입력이다 (`맨몸` · `20, 30, 40` 같은 드롭세트도 받는다). 세트 100 · 횟수 1000 이 상한.

## 인바디 `/inbody` 🔒

| | 경로 | 본문 |
|---|---|---|
| GET | `/inbody` | 최신순 |
| POST | `/inbody` | `{ date, height, weight, fat_pct, muscle_kg, water_l }` |
| PUT | `/inbody/:id` | 같은 모양 |
| DELETE | `/inbody/:id` | |

## 측정 `/measures` 🔒

| | 경로 | 본문 |
|---|---|---|
| GET | `/measures` | 전체 |
| POST | `/measures` | `{ type, date, data }` — `type` 은 `bodySize` · `shoulder` · `oneRM` · `fitness` · `flexibility` · `stopwatch`. `data` 는 10KB 까지 |
| DELETE | `/measures/:id` | |

## 루틴

| | 경로 | 비고 |
|---|---|---|
| GET | `/routines` — | 추천 루틴 전체 |
| GET | `/routines/:type` — | `머신` · `맨몸` · `홈트` |
| GET | `/my-routines` 🔒 | 내가 만든 루틴 |
| POST | `/my-routines` 🔒 | `{ name, exercises[] }` — 운동 50개까지 |
| PUT | `/my-routines/:id` 🔒 | `{ name?, exercises? }` — 루틴에 운동을 더 넣을 때 쓴다 |
| DELETE | `/my-routines/:id` 🔒 | |

## 사진 `/photos` 🔒

| | 경로 | 비고 |
|---|---|---|
| GET | `/photos` | 내 사진 전체 |
| POST | `/photos` | `{ type, data }` — `type` 은 `profile` · `before` · `after`. `data` 는 `data:image/...;base64,` 로 시작해야 하고 2MB 까지 |
| DELETE | `/photos/:type` | |

## 내보내기 `/export` 🔒

| | 경로 | 비고 |
|---|---|---|
| GET | `/export/workouts` | CSV (엑셀용 BOM 포함) |
| GET | `/export/inbody` | CSV |

## 제보함 `/reports`

| | 경로 | 비고 |
|---|---|---|
| GET | `/reports` 🔒 | 내가 보낸 것만 |
| POST | `/reports` 🔒 | `{ kind, title, body?, meta?, device? }` — `kind` 는 `bug` · `ask` · `idea`. **막는 것은 유형과 제목뿐이다** |
| DELETE | `/reports/:id` 🔒 | 내 것만 |
| GET | `/reports/all` 🛡 | 전체 |
| PATCH | `/reports/:id` 🛡 | `{ status?, reply? }` — `status` 는 `received` · `checking` · `done` · `held`. **관리자도 내용은 못 고치고 못 지운다** |
| GET | `/reports/pending` 🛡 | 손볼 건수만 `{ open, abuse }` — 화면 구석 표시용이라 가볍다 |
| GET | `/reports/abuse` 🛡 | 욕설·비하로 걸린 기록 |
| PATCH | `/reports/abuse/:id` 🛡 | `{ reviewed?, dismissed? }` — `dismissed` 면 누적에서 빼고 그 때문에 걸린 정지도 푼다 |

욕설 판정은 `utils/profanity.js`, 처벌은 `utils/abusePolicy.js`. **최대 7일이고 계정 삭제는 없다.**

제보가 들어오거나 욕설로 걸리면 `ADMIN_EMAIL` 로 메일이 나간다 (`SMTP_HOST`·`SMTP_USER`·`SMTP_PASS` 설정 시).
안 나가도 앱은 영향이 없다.

## 만족도 `/ratings`

| | 경로 | 비고 |
|---|---|---|
| GET | `/ratings/me` 🔒 | 내가 매긴 점수 (`null` 이면 아직 안 매김) |
| POST | `/ratings` 🔒 | `{ score }` — 1~5. **한 사람당 한 줄, 다시 매기면 덮어쓴다** |
| GET | `/ratings/stats` 🛡 | 분포만. **누가 몇 점을 줬는지는 돌려주지 않는다** |

## 점검 `/maintenance`

| | 경로 | 비고 |
|---|---|---|
| GET | `/maintenance` — | 점검 목록. 로그인 없이도 읽는다 |
| PUT | `/maintenance` 🛡 | `{ schedules: [...] }` — 통째로 바꾼다. 20개까지, **하루를 넘는 점검은 안 받는다** |

한 항목: `{ startHour, startMin, durationMin, reason, date? , days?, type? }`
`date` 가 있으면 그 하루만, 없으면 `days`(0=일 ~ 6=토) 요일 반복. `days` 가 비면 매일.

## 보안 · 관리 `/security` 🛡

| | 경로 | 비고 |
|---|---|---|
| GET | `/security/dashboard` | 설정 현황 (JWT · rate limit · helmet · CORS · Node) |
| GET | `/security/users` | 전체 회원 (비밀번호 제외) |
| GET | `/security/logs` | 최근 100건 |
| POST | `/security/block-user/:id` | 차단. **관리자는 못 막는다** |
| POST | `/security/unblock-user/:id` | 해제. **차단된 사람만** |
| POST | `/security/make-admin/:id` | 관리자 부여 |
| POST | `/security/revoke-admin/:id` | 해제. **자기 자신 · 마지막 관리자는 못 내린다** |
| DELETE | `/security/user/:id` | **계정과 모든 데이터 삭제 — 되돌릴 수 없다.** 이미 막혀 있는 계정만, `{ confirmEmail }` 에 이메일을 정확히 적어야 한다 |
| GET | `/security/ai-dashboard` | AI Guard 현황 |
| POST | `/security/ai-block` · `/security/ai-unblock/:ip` | IP 수동 차단·해제 |
| POST | `/security/scan` · GET `/security/report` | 보안 자가 검사 |

## 헬스체크

| | 경로 | 응답 |
|---|---|---|
| GET | `/health` — | `{ status: "OK", uptime, memory }` |

---

## Rate limit

`backend/src/config/security.js` 가 원본이다. 보안 대시보드가 같은 값을 읽어 보고한다.

| 대상 | 창 | 횟수 |
|---|---|---|
| 전체 | 1분 | 100 |
| 로그인 · 가입 | 15분 | 20 |
| 인증코드 발송 | 1분 | 3 |
| 인증코드 확인 | 15분 | 10 |
| 아이디 · 이메일 중복 확인 | 1분 | 10 |
| OAuth | 1시간 | 10 |

1분에 60건이 넘는 POST 는 `429` 로 되돌려 보낸다 (정지시키지 않는다).

## 저장소

SQLite 가 아니라 **JSON 파일 한 개**(`backend/steelbody.json`)다. 메모리 캐시 + 지연 쓰기로 다룬다.
`.gitignore` 에 있으므로 저장소에는 올라가지 않는다.
