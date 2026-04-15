# ⚙️ 백엔드 에이전트 — API 서버

## 네 역할

너는 IRON LOG의 **백엔드 개발자**야.
Node.js + Express로 REST API 서버를 만들고,
SQLite로 데이터를 저장하고, JWT로 사용자 인증을 처리해.

---

## 기술 스택

| 항목 | 기술 | 이유 |
|------|------|------|
| 런타임 | Node.js 18+ | 가볍고 빠름 |
| 프레임워크 | Express.js | 가장 많이 쓰는 Node.js 서버 프레임워크 |
| DB | SQLite (better-sqlite3) | 파일 하나로 DB 관리, 설치 불필요 |
| 인증 | JWT (jsonwebtoken) | 서버 재시작해도 토큰 유효 |
| 비밀번호 | bcryptjs | 비밀번호 암호화 |
| 기타 | cors, dotenv | 프론트 연결, 환경변수 관리 |

---

## 폴더 구조

`backend/` 폴더 안에 이렇게 만들어:

```
backend/
├── src/
│   ├── index.js              ← 서버 시작점
│   ├── db.js                 ← SQLite 연결 + 테이블 생성
│   ├── middleware/
│   │   └── auth.js           ← JWT 인증 미들웨어
│   └── routes/
│       ├── auth.js           ← 회원가입 / 로그인
│       ├── workouts.js       ← 운동 기록 CRUD
│       ├── inbody.js         ← 인바디 기록 CRUD
│       └── routines.js       ← 루틴 목록 (고정 데이터)
├── .env                      ← 비밀 설정값 (깃에 올리면 안 됨!)
├── .env.example              ← 환경변수 예시
├── .gitignore
└── package.json
```

---

## package.json

```json
{
  "name": "ironlog-backend",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.4.3",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

---

## `.env` 파일

```env
PORT=4000
JWT_SECRET=ironlog_change_this_in_production_please
FRONTEND_URL=http://localhost:5173
```

## `.env.example` 파일

```env
PORT=4000
JWT_SECRET=your_secret_key_here
FRONTEND_URL=http://localhost:5173
```

## `.gitignore` 파일

```
node_modules/
.env
ironlog.db
```

---

## `src/db.js` — 데이터베이스

```javascript
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../ironlog.db'));

// 성능 향상
db.pragma('journal_mode = WAL');

// 테이블 생성 (없으면 만들고, 있으면 그냥 넘어감)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT    UNIQUE NOT NULL,
    password   TEXT    NOT NULL,
    nickname   TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    date       TEXT    NOT NULL,
    exercise   TEXT    NOT NULL,
    weight     TEXT    DEFAULT '맨몸',
    sets       INTEGER NOT NULL,
    reps       INTEGER NOT NULL,
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS inbody (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    date       TEXT    NOT NULL,
    height     REAL,
    weight     REAL    NOT NULL,
    fat_pct    REAL,
    muscle_kg  REAL,
    water_l    REAL,
    bmi        REAL,
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

module.exports = db;
```

---

## `src/index.js` — 서버 시작점

```javascript
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

// 미들웨어
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// 라우터 연결
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/workouts', require('./routes/workouts'));
app.use('/api/inbody',   require('./routes/inbody'));
app.use('/api/routines', require('./routes/routines'));

// 서버 살아있는지 확인용
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString() });
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '서버 오류가 발생했어요' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 IRON LOG 서버 실행 중: http://localhost:${PORT}`);
  console.log(`   헬스체크: http://localhost:${PORT}/api/health`);
});
```

---

## `src/middleware/auth.js` — JWT 인증

```javascript
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Authorization: Bearer {토큰} 에서 토큰 꺼내기
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '로그인이 필요해요' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: '토큰이 만료됐거나 유효하지 않아요' });
  }
};
```

---

## `src/routes/auth.js` — 회원가입 / 로그인

```javascript
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../db');

// 회원가입
router.post('/register', (req, res) => {
  const { email, password, nickname } = req.body;

  if (!email || !password || !nickname) {
    return res.status(400).json({ error: '이메일, 비밀번호, 닉네임을 모두 입력해주세요' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '비밀번호는 6자 이상이어야 해요' });
  }

  const hashed = bcrypt.hashSync(password, 10);

  try {
    const result = db.prepare(
      'INSERT INTO users (email, password, nickname) VALUES (?, ?, ?)'
    ).run(email, hashed, nickname);

    res.status(201).json({ message: '회원가입 완료!', userId: result.lastInsertRowid });
  } catch {
    res.status(409).json({ error: '이미 사용 중인 이메일이에요' });
  }
});

// 로그인
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 틀렸어요' });
  }

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, nickname: user.nickname });
});

// 내 정보
router.get('/me', require('../middleware/auth'), (req, res) => {
  const user = db.prepare('SELECT id, email, nickname, created_at FROM users WHERE id = ?').get(req.userId);
  res.json(user);
});

module.exports = router;
```

---

## `src/routes/workouts.js` — 운동 기록

```javascript
const router = require('express').Router();
const auth   = require('../middleware/auth');
const db     = require('../db');

// 전체 목록 조회
router.get('/', auth, (req, res) => {
  const workouts = db.prepare(
    'SELECT * FROM workouts WHERE user_id = ? ORDER BY date DESC, created_at DESC'
  ).all(req.userId);
  res.json(workouts);
});

// 날짜별 조회
router.get('/:date', auth, (req, res) => {
  const workouts = db.prepare(
    'SELECT * FROM workouts WHERE user_id = ? AND date = ? ORDER BY created_at'
  ).all(req.userId, req.params.date);
  res.json(workouts);
});

// 추가
router.post('/', auth, (req, res) => {
  const { date, exercise, weight, sets, reps } = req.body;

  if (!date || !exercise || !sets || !reps) {
    return res.status(400).json({ error: '날짜, 운동명, 세트, 횟수는 필수에요' });
  }

  const result = db.prepare(
    'INSERT INTO workouts (user_id, date, exercise, weight, sets, reps) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.userId, date, exercise, weight || '맨몸', Number(sets), Number(reps));

  res.status(201).json({ id: result.lastInsertRowid, message: '운동 기록 저장 완료!' });
});

// 삭제
router.delete('/:id', auth, (req, res) => {
  const result = db.prepare(
    'DELETE FROM workouts WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: '기록을 찾을 수 없어요' });
  }
  res.json({ message: '삭제 완료!' });
});

module.exports = router;
```

---

## `src/routes/inbody.js` — 인바디 기록

```javascript
const router = require('express').Router();
const auth   = require('../middleware/auth');
const db     = require('../db');

// 전체 목록
router.get('/', auth, (req, res) => {
  const records = db.prepare(
    'SELECT * FROM inbody WHERE user_id = ? ORDER BY date DESC'
  ).all(req.userId);
  res.json(records);
});

// 추가
router.post('/', auth, (req, res) => {
  const { date, height, weight, fat_pct, muscle_kg, water_l } = req.body;

  if (!weight) {
    return res.status(400).json({ error: '체중은 필수에요' });
  }

  // BMI 자동 계산
  const bmi = height ? +(weight / ((height / 100) ** 2)).toFixed(1) : null;

  const result = db.prepare(`
    INSERT INTO inbody (user_id, date, height, weight, fat_pct, muscle_kg, water_l, bmi)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.userId,
    date || new Date().toISOString().split('T')[0],
    height || null,
    weight,
    fat_pct || null,
    muscle_kg || null,
    water_l || null,
    bmi
  );

  res.status(201).json({ id: result.lastInsertRowid, bmi, message: '인바디 기록 저장!' });
});

// 삭제
router.delete('/:id', auth, (req, res) => {
  const result = db.prepare(
    'DELETE FROM inbody WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: '기록을 찾을 수 없어요' });
  }
  res.json({ message: '삭제 완료!' });
});

module.exports = router;
```

---

## `src/routes/routines.js` — 루틴 (고정 데이터)

```javascript
const router = require('express').Router();

const ROUTINES = {
  머신: {
    가슴: ['벤치프레스 머신', '체스트 플라이 머신', '케이블 크로스오버', '펙덱 머신'],
    등:   ['랫풀다운', '시티드 로우', '케이블 로우', '티바 로우 머신'],
    어깨: ['숄더프레스 머신', '래터럴 레이즈 머신', '케이블 레이즈', '리어델트 머신'],
    하체: ['레그프레스', '레그 익스텐션', '레그 컬', '핵 스쿼트 머신'],
    팔:   ['케이블 바이셉 컬', '트라이셉 푸시다운', '프리쳐 컬 머신', '케이블 트라이셉'],
  },
  맨몸: {
    가슴: ['푸시업', '와이드 푸시업', '다이아몬드 푸시업', '인클라인 푸시업'],
    등:   ['풀업', '친업', '인버티드 로우', '슈퍼맨'],
    어깨: ['파이크 푸시업', '핸드스탠드 푸시업', '사이드 플랭크 레이즈', '암서클'],
    하체: ['스쿼트', '런지', '불가리안 스플릿 스쿼트', '힙쓰러스트'],
    팔:   ['좁은 푸시업', '딥스', '친업', '네거티브 컬'],
  },
};

// 전체 루틴
router.get('/', (req, res) => {
  res.json(ROUTINES);
});

// 타입별 (머신 or 맨몸)
router.get('/:type', (req, res) => {
  const data = ROUTINES[req.params.type];
  if (!data) return res.status(400).json({ error: '머신 또는 맨몸만 가능해요' });
  res.json(data);
});

module.exports = router;
```

---

## 실행 방법

```bash
cd backend
npm install
npm run dev    # 개발 모드 (파일 수정 시 자동 재시작)
```

테스트:
```
GET http://localhost:4000/api/health
→ { "status": "OK" } 가 나오면 성공!
```

---

## 중요 원칙

- 모든 `/api/workouts`, `/api/inbody` 라우트에 `auth` 미들웨어 적용
- 에러 응답 형식: `{ error: "메시지" }` 로 통일
- SQL에서 사용자 입력값은 반드시 `?` 파라미터 바인딩 사용 (보안)
- `.env` 파일은 절대 깃에 올리지 마
- `JWT_SECRET`은 실제 배포 시 길고 복잡한 랜덤 문자열로 교체
