# 🏋️ IRON LOG — AI 팀 에이전트 가이드

> 고등학생도 할 수 있는 Claude Code 멀티 에이전트 웹사이트 제작

---

## 🤔 이게 뭐야?

우리가 만든 헬스 트래커(IRON LOG)를 **진짜 웹사이트**로 만들 거야.
혼자 다 코딩하는 게 아니라, **AI 에이전트들한테 역할을 나눠줘서** 팀처럼 일하게 하는 거야.

```
👔 PM 에이전트         → 전체 계획, 팀 조율
🎨 디자이너 에이전트   → 색상, 폰트, 버튼 스타일
⚙️ 백엔드 에이전트     → 데이터 저장 서버 (Node.js)
⚛️ 프론트엔드 에이전트 → 화면 만들기 (React)
🔍 QA 에이전트         → 버그 찾기, 테스트
```

각 에이전트는 `.md` 파일 하나야.
Claude Code가 이 파일을 읽으면 그 역할대로 일해줘.

---

## 📁 파일 목록

```
agents/
├── README.md          ← 지금 읽는 이 파일
├── agent-pm.md        ← PM (프로젝트 매니저)
├── agent-designer.md  ← 디자이너
├── agent-backend.md   ← 백엔드 개발자
├── agent-frontend.md  ← 프론트엔드 개발자
└── agent-qa.md        ← QA (테스터)
```

---

## 🛠️ 준비물 설치 (딱 한 번만)

### 1단계 — Node.js 설치 확인

터미널을 열어 (Mac: Terminal / Windows: PowerShell):

```bash
node --version
```

`v18.0.0` 이상이 나오면 OK!
없으면 → **https://nodejs.org** 에서 LTS 버전 설치

### 2단계 — Claude Code 설치

```bash
npm install -g @anthropic-ai/claude-code
```

### 3단계 — 설치 됐는지 확인

```bash
claude --version
```

버전 숫자가 나오면 성공! 🎉

### 4단계 — API 키 발급

Claude Code를 쓰려면 Anthropic API 키가 필요해.

1. https://console.anthropic.com 접속
2. 회원가입 or 로그인
3. 왼쪽 메뉴 → "API Keys" → "Create Key"
4. 키 복사해서 안전한 곳에 보관

---

## 📂 프로젝트 폴더 만들기

아무 곳에나 폴더 만들어:

```bash
mkdir ironlog-website
cd ironlog-website
mkdir agents frontend backend docs
```

그리고 이 `agents/` 폴더에 다운받은 `.md` 파일들 전부 넣어.

최종 구조:
```
ironlog-website/
├── agents/
│   ├── README.md
│   ├── agent-pm.md
│   ├── agent-designer.md
│   ├── agent-backend.md
│   ├── agent-frontend.md
│   └── agent-qa.md
├── frontend/     (나중에 자동 생성됨)
├── backend/      (나중에 자동 생성됨)
└── docs/         (나중에 자동 생성됨)
```

---

## 🚀 실행 방법 — 단계별

### STEP 1 — 프로젝트 폴더에서 Claude Code 시작

```bash
cd ironlog-website
claude
```

그럼 이런 화면이 뜸:
```
✓ Claude Code v1.x.x
? How can I help you?
>
```

여기에 명령을 입력하면 돼!

### STEP 2 — API 키 입력 (처음 한 번만)

처음 실행하면 API 키를 물어볼 거야. 아까 복사해둔 키 붙여넣기.

또는 미리 환경변수로 설정:
```bash
# Mac / Linux
export ANTHROPIC_API_KEY="sk-ant-여기에키입력"

# Windows PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-여기에키입력"
```

---

## 🤖 에이전트 순서대로 실행하기

### 순서가 중요해!

```
1번 디자이너  ──┐
               ├──▶  3번 프론트엔드  ──▶  4번 QA
2번 백엔드    ──┘
```

> 1번이랑 2번은 **동시에** 해도 돼. 서로 의존 안 해.
> 3번은 1, 2번이 끝난 다음에 해야 해.

---

### 🔵 0번 먼저 — PM에게 전체 계획 세우기

```
agents/agent-pm.md 파일을 읽고, IRON LOG 헬스 트래커 웹사이트 프로젝트 전체 계획을 세워줘.
docs/project-plan.md 와 docs/api-spec.md 파일을 만들어줘.
```

---

### 🎨 1번 — 디자이너 에이전트 실행

```
agents/agent-designer.md 파일을 읽고, IRON LOG 디자인 시스템을 만들어줘.
docs/design-system.md 파일을 생성하고, frontend/src/styles/globals.css 도 만들어줘.
```

---

### ⚙️ 2번 — 백엔드 에이전트 실행

```
agents/agent-backend.md 파일을 읽고, backend/ 폴더에 Express API 서버를 만들어줘.
운동 기록, 인바디 기록 CRUD API와 사용자 인증을 구현해줘.
```

백엔드가 완성되면 테스트:
```bash
cd backend
npm install
npm run dev
```
`http://localhost:4000/api/health` 접속해서 `{"status":"OK"}` 나오면 성공!

---

### ⚛️ 3번 — 프론트엔드 에이전트 실행

```
agents/agent-frontend.md 파일을 읽고, frontend/ 폴더에 React 앱을 만들어줘.
docs/design-system.md 디자인을 따르고, 백엔드 API(http://localhost:4000)에 연결해줘.
기존 IRON LOG 기능(루틴, 운동기록, 인바디, 장비추천, 히스토리)을 전부 포함해줘.
```

프론트엔드 실행:
```bash
cd frontend
npm install
npm run dev
```
`http://localhost:5173` 접속해서 화면 나오면 성공!

---

### 🔍 4번 — QA 에이전트 실행

```
agents/agent-qa.md 파일을 읽고, frontend/ 와 backend/ 코드 전체를 검토해줘.
버그와 개선점을 docs/qa-report.md 로 저장해줘.
```

---

## ⚡ 한 번에 다 돌리는 방법 (고급)

Claude Code에서 이렇게 입력하면 순서대로 다 해줘:

```
다음 순서로 IRON LOG 웹사이트를 만들어줘:

1. agents/agent-pm.md 읽고 docs/ 폴더에 프로젝트 계획 문서 작성
2. agents/agent-designer.md 읽고 디자인 시스템 생성
3. agents/agent-backend.md 읽고 backend/ 폴더에 Express 서버 구축
4. agents/agent-frontend.md 읽고 frontend/ 폴더에 React 앱 구축
5. agents/agent-qa.md 읽고 전체 코드 검토 후 docs/qa-report.md 작성

각 단계가 완료되면 완료 메시지를 알려줘.
```

---

## ❓ 자주 생기는 문제

| 문제 | 해결 방법 |
|------|-----------|
| `claude: command not found` | `npm install -g @anthropic-ai/claude-code` 다시 실행 |
| API 키 오류 | https://console.anthropic.com 에서 키 재확인 |
| 포트 충돌 (EADDRINUSE) | 기존에 실행 중인 서버 종료 후 재시작 |
| 모듈 없음 오류 | 해당 폴더에서 `npm install` 실행 |
| 에이전트가 역할을 모름 | `agents/agent-XX.md 파일을 읽고` 를 꼭 앞에 붙여서 입력 |

---

## 📚 더 공부하고 싶다면

- Claude Code 공식 문서: https://docs.claude.com/en/docs/claude-code/overview
- React 공식 문서: https://react.dev
- Express 공식 문서: https://expressjs.com
