const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '../steelbody.json');

// ── 사진은 따로 담는다 ──
//
// 사진은 base64 로 들어온다 — 한 장에 최대 2MB, 사람마다 세 장(프로필 · 전 · 후).
// 그런데 이 앱은 **바뀔 때마다 파일을 통째로 다시 쓴다.** 사진이 본체에 같이 있으면
// 세트 하나를 저장할 때마다 사진 전부를 다시 문자열로 만들어 디스크에 붓는 셈이다.
//
// 재보면 이렇다 — 사람 10명이 세 장씩 채우면 파일이 **60MB** 다. 그걸 기록 하나마다
// 다시 쓴다. 게다가 그 60MB 는 캐시로 램에 늘 떠 있는데, 서버는
// `--max-old-space-size=256` 으로 돈다. 서른 명이면 문자열로 만드는 도중에 죽는다.
//
// 사진은 **드물게 바뀌고 크다.** 나머지는 자주 바뀌고 작다. 갈라 두면 서로를 안 건드린다.
const PHOTOS_PATH = path.join(__dirname, '../photos.json');

// 기본 데이터 구조
const DEFAULT_DATA = {
  users: [],
  workouts: [],
  inbody: [],
  measures: [],
  myRoutines: [],
  // 제보함. 공지사항 기능을 없애면서 notices 자리를 이쪽으로 돌렸다 —
  // "레코드 목록 + 본인 것만 조회 + 관리자 전체 조회" 라는 모양이 같다.
  reports: [],
  // 욕설·비하로 걸린 기록. 처벌 수위를 올리려면 누적이 서버 재시작을 넘어 남아야 한다
  abuseLogs: [],
  photos: [],
  // 점검 스케줄.
  //
  // 예전에는 관리자 브라우저의 localStorage 에만 있었다. 그래서 점검을 잡아도
  // **다른 사람에게는 아무 일도 일어나지 않았다** — 점검 화면도 안 뜨고 고객센터의
  // '점검 예정' 도 영영 비어 있었다. 관리자가 브라우저를 바꾸면 자기 설정도 사라졌다.
  maintenance: [],
  // 만족도 — 한 사람당 한 줄만 남는다 (다시 매기면 덮어쓴다).
  // 점수만 받는다. 이유는 제보함이 받는다 — 두 곳에서 같은 것을 물으면 둘 다 부실해진다
  ratings: [],
  // 고객센터 「무엇이 궁금하세요?」에서 쳤는데 **답이 하나도 안 나온 말**.
  // FAQ 를 무엇으로 늘릴지 감으로 정하지 않으려고 남긴다.
  // 친 말과 횟수·날짜만 남긴다 — 누가 쳤는지는 남기지 않는다
  faqGaps: [],
  // 운동 알림 설정. 한 사람당 한 줄.
  // **서버가 들고 있어야 한다** — 기기를 바꾸면 설정이 사라지면 안 되고,
  // 정해진 시각에 보내는 것도 서버가 한다
  reminders: [],
  // 웹 푸시 구독. 한 사람이 기기마다 하나씩 갖는다 (폰과 PC 는 다른 구독이다)
  pushSubs: [],
  // 진행 중인 루틴. 한 사람당 한 줄 — 한 번에 한 운동을 한다.
  // 서버에 두는 이유는 폰으로 시작해서 다른 기기로 이어갈 수 있어야 해서다
  routineSessions: [],
  suspensions: [],   // { id, user_id, level, reason, ai_reason, expires_at, created_at }
  blacklist: [],     // { id, type, value, reason, created_at } — type: 'email'|'ip'|'ip_range'|'ua'
  _nextId: { users: 1, workouts: 1, inbody: 1, measures: 1, myRoutines: 1, reports: 1, abuseLogs: 1, photos: 1, ratings: 1, faqGaps: 1, pushSubs: 1, suspensions: 1, blacklist: 1 },
};

// In-memory cache + debounced writes + write lock
let _photoCache = null;
let _photoDirty = false;
let _photoTimer = null;

function loadPhotos() {
  if (_photoCache) return _photoCache;
  try {
    if (fs.existsSync(PHOTOS_PATH)) {
      _photoCache = JSON.parse(fs.readFileSync(PHOTOS_PATH, 'utf-8'));
      if (!Array.isArray(_photoCache.photos)) _photoCache.photos = [];
      return _photoCache;
    }
  } catch (err) {
    console.error('[DB] photos.json 파싱 실패, 초기화합니다:', err.message);
  }
  _photoCache = { photos: [], _nextId: 1 };
  return _photoCache;
}

function _flushPhotos() {
  if (!_photoDirty || !_photoCache) return;
  try {
    fs.writeFileSync(PHOTOS_PATH, JSON.stringify(_photoCache), 'utf-8');
    _photoDirty = false;
  } catch (err) {
    console.error('[DB] 사진 저장 실패:', err.message);
  }
}

// 들여쓰기를 넣지 않는다. 사람이 읽을 파일이 아니고, base64 덩어리라 줄바꿈만 늘어난다
function savePhotoStore() {
  _photoDirty = true;
  if (_photoTimer) clearTimeout(_photoTimer);
  _photoTimer = setTimeout(_flushPhotos, 500);
}

// 계정을 지울 때 사진도 같이 지운다
function deleteUserPhotos(userId) {
  const store = loadPhotos();
  const before = store.photos.length;
  store.photos = store.photos.filter(p => p.user_id !== userId);
  if (store.photos.length !== before) savePhotoStore();
  return { changes: before - store.photos.length };
}

let _cache = null;
let _dirty = false;
let _saveTimer = null;
let _writeLock = false;
let _writeQueue = [];

function load() {
  if (_cache) return _cache;
  try {
    if (fs.existsSync(DB_PATH)) {
      _cache = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      // refresh token 저장소 초기화
      if (!_cache.refreshTokens) _cache.refreshTokens = [];
      return _cache;
    }
  } catch (err) {
    console.error('[DB] steelbody.json 파싱 실패, 초기화합니다:', err.message);
  }
  _cache = { ...DEFAULT_DATA, refreshTokens: [] };
  _flushSync(_cache);
  return _cache;
}

function save(data) {
  _cache = data;
  _dirty = true;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_flush, 500);
}

function _flush() {
  if (!_dirty || !_cache) return;
  if (_writeLock) {
    _writeQueue.push(() => _flush());
    return;
  }
  _writeLock = true;
  try {
    const indent = process.env.NODE_ENV === 'production' ? undefined : 2;
    fs.writeFileSync(DB_PATH, JSON.stringify(_cache, null, indent), 'utf-8');
    _dirty = false;
  } catch (err) {
    console.error('[DB] 저장 실패:', err.message);
  } finally {
    _writeLock = false;
    if (_writeQueue.length > 0) {
      const next = _writeQueue.shift();
      next();
    }
  }
}

function _flushSync(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Flush on process exit (즉시 동기 저장)
function _flushImmediate() {
  if (_dirty && _cache) {
    try {
      const indent = process.env.NODE_ENV === 'production' ? undefined : 2;
      fs.writeFileSync(DB_PATH, JSON.stringify(_cache, null, indent), 'utf-8');
      _dirty = false;
    } catch (err) {
      console.error('[DB] 종료 시 저장 실패:', err.message);
    }
  }
}
process.on('exit', () => { _flushImmediate(); _flushPhotos(); });
process.on('SIGINT', () => { _flushImmediate(); _flushPhotos(); process.exit(); });
process.on('SIGTERM', () => { _flushImmediate(); _flushPhotos(); process.exit(); });

// 다음 ID 가져오기
function nextId(table) {
  const data = load();
  const id = data._nextId[table] || 1;
  data._nextId[table] = id + 1;
  save(data);
  return id;
}

// ── 쿼리 캐시 (5초 TTL) ──
const _queryCache = new Map();
function invalidateQueryCache() { _queryCache.clear(); }

// ── 인덱스 캐시 (O(n) → O(1) 조회) ──
const _index = { userById: null, userByEmail: null, userByUsername: null };

// 이메일은 대소문자를 가리지 않는다.
//
// 예전에는 그대로 비교했다. 그래서 `Kevin@Gmail.com` 으로 가입한 사람이
// `kevin@gmail.com` 으로 로그인하면 "없는 계정" 이 되고, 게다가 그 주소로 **또 가입이 됐다.**
// 같은 사람의 계정이 둘로 갈리고 기록도 갈린다. 저장은 적은 그대로 두고, 찾고 비교할 때만 낮춘다.
const emailKey = (email) => String(email || '').trim().toLowerCase();

// refresh token 은 해시로만 담는다. `this.` 로 부르지 않는다 —
// 이 파일의 다른 도우미(load · save · emailKey)처럼 모듈 함수로 둬야, 나중에
// `const { saveRefreshToken } = db` 처럼 떼어 쓰는 사람이 생겨도 안 깨진다
const refreshHash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

function rebuildIndex() {
  const data = load();
  _index.userById = new Map();
  _index.userByEmail = new Map();
  _index.userByUsername = new Map();
  for (const u of data.users) {
    _index.userById.set(u.id, u);
    _index.userByEmail.set(emailKey(u.email), u);
    if (u.username) _index.userByUsername.set(u.username, u);
  }
}

function invalidateUserIndex() { _index.userById = null; }

const db = {
  // users (인덱스 기반 O(1) 조회)
  findUserByEmail(email) {
    if (!_index.userById) rebuildIndex();
    return _index.userByEmail.get(emailKey(email)) || null;
  },
  findUserById(id) {
    if (!_index.userById) rebuildIndex();
    return _index.userById.get(id) || null;
  },
  findUserByUsername(username) {
    if (!_index.userById) rebuildIndex();
    return _index.userByUsername.get(username) || null;
  },
  createUser(email, password, nickname, username) {
    const data = load();
    if (data.users.some(u => emailKey(u.email) === emailKey(email))) {
      throw new Error('DUPLICATE_EMAIL');
    }
    if (username && data.users.some(u => u.username === username)) {
      throw new Error('DUPLICATE_USERNAME');
    }
    const id = data._nextId.users || 1;
    data._nextId.users = id + 1;
    const role = (process.env.ADMIN_EMAIL && emailKey(email) === emailKey(process.env.ADMIN_EMAIL)) ? 'admin' : 'user';
    const user = { id, email, password, nickname, username: username || null, role, created_at: new Date().toISOString() };
    data.users.push(user);
    invalidateUserIndex();
    save(data);
    return { lastInsertRowid: id };
  },

  // workouts
  getWorkouts(userId) {
    const cacheKey = 'w_' + userId;
    if (_queryCache.has(cacheKey) && Date.now() - _queryCache.get(cacheKey).t < 5000) return _queryCache.get(cacheKey).d;
    const data = load();
    const result = (data.workouts || [])
      .filter(w => w.user_id === userId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
    _queryCache.set(cacheKey, { d: result, t: Date.now() });
    return result;
  },
  getWorkoutsByDate(userId, date) {
    const data = load();
    return (data.workouts || [])
      .filter(w => w.user_id === userId && w.date === date)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  createWorkout(userId, date, exercise, weight, sets, reps) {
    const id = nextId('workouts');
    const data = load();
    const workout = { id, user_id: userId, date, exercise, weight, sets, reps, created_at: new Date().toISOString() };
    data.workouts.push(workout);
    invalidateQueryCache();
    save(data);
    return { lastInsertRowid: id };
  },
  deleteWorkout(id, userId) {
    const data = load();
    const idx = data.workouts.findIndex(w => w.id === id && w.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.workouts.splice(idx, 1);
    invalidateQueryCache();
    save(data);
    return { changes: 1 };
  },
  updateWorkout(id, userId, fields) {
    const data = load();
    const workout = data.workouts.find(w => w.id === id && w.user_id === userId);
    if (!workout) return { changes: 0 };
    if (fields.date !== undefined) workout.date = fields.date;
    if (fields.exercise !== undefined) workout.exercise = fields.exercise;
    if (fields.weight !== undefined) workout.weight = fields.weight;
    if (fields.sets !== undefined) workout.sets = fields.sets;
    if (fields.reps !== undefined) workout.reps = fields.reps;
    workout.updated_at = new Date().toISOString();
    invalidateQueryCache();
    save(data);
    return { changes: 1, workout };
  },

  // inbody
  getInbody(userId) {
    const cacheKey = 'i_' + userId;
    if (_queryCache.has(cacheKey) && Date.now() - _queryCache.get(cacheKey).t < 5000) return _queryCache.get(cacheKey).d;
    const data = load();
    const result = (data.inbody || [])
      .filter(r => r.user_id === userId)
      .sort((a, b) => b.date.localeCompare(a.date));
    _queryCache.set(cacheKey, { d: result, t: Date.now() });
    return result;
  },
  createInbody(userId, date, height, weight, fat_pct, muscle_kg, water_l, bmi) {
    const id = nextId('inbody');
    const data = load();
    const record = { id, user_id: userId, date, height, weight, fat_pct, muscle_kg, water_l, bmi, created_at: new Date().toISOString() };
    data.inbody.push(record);
    invalidateQueryCache();
    save(data);
    return { lastInsertRowid: id };
  },
  deleteInbody(id, userId) {
    const data = load();
    const idx = data.inbody.findIndex(r => r.id === id && r.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.inbody.splice(idx, 1);
    invalidateQueryCache();
    save(data);
    return { changes: 1 };
  },
  updateInbody(id, userId, fields) {
    const data = load();
    const record = data.inbody.find(r => r.id === id && r.user_id === userId);
    if (!record) return { changes: 0 };
    if (fields.date !== undefined) record.date = fields.date;
    if (fields.height !== undefined) record.height = fields.height;
    if (fields.weight !== undefined) record.weight = fields.weight;
    if (fields.fat_pct !== undefined) record.fat_pct = fields.fat_pct;
    if (fields.muscle_kg !== undefined) record.muscle_kg = fields.muscle_kg;
    if (fields.water_l !== undefined) record.water_l = fields.water_l;
    if (fields.bmi !== undefined) record.bmi = fields.bmi;
    record.updated_at = new Date().toISOString();
    invalidateQueryCache();
    save(data);
    return { changes: 1, record };
  },

  // user updates
  // 성별. 참고 범위를 그리는 데만 쓴다.
  //
  // **안 고를 수 있다.** null 이면 화면이 범위를 안 그리고 숫자만 보여준다 —
  // 필수로 받으면, 알려주기 싫은 사람이 인바디 화면을 아예 못 쓰게 된다.
  updateUserSex(id, sex) {
    const data = load();
    const user = data.users.find(u => u.id === id);
    if (!user) return { changes: 0 };
    if (sex === null) delete user.sex;
    else user.sex = sex;
    invalidateUserIndex();
    save(data);
    return { changes: 1 };
  },

  updateUserNickname(id, nickname) {
    const data = load();
    const user = data.users.find(u => u.id === id);
    if (!user) return { changes: 0 };
    user.nickname = nickname;
    invalidateUserIndex();
    save(data);
    return { changes: 1 };
  },

  updateUserPassword(id, hashedPassword) {
    const data = load();
    const user = data.users.find(u => u.id === id);
    if (!user) return { changes: 0 };
    user.password = hashedPassword;
    invalidateUserIndex();
    save(data);
    return { changes: 1 };
  },

  // measures
  getMeasures(userId) {
    const data = load();
    return (data.measures || [])
      .filter(m => m.user_id === userId)
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  createMeasure(userId, type, date, measureData) {
    const id = nextId('measures');
    const data = load();
    if (!data.measures) data.measures = [];
    const record = { id, user_id: userId, type, date, data: measureData, created_at: new Date().toISOString() };
    data.measures.push(record);
    save(data);
    return { lastInsertRowid: id };
  },
  deleteMeasure(id, userId) {
    const data = load();
    if (!data.measures) return { changes: 0 };
    const idx = data.measures.findIndex(m => m.id === id && m.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.measures.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },

  // myRoutines
  getMyRoutines(userId) {
    const data = load();
    return (data.myRoutines || []).filter(r => r.user_id === userId);
  },
  createMyRoutine(userId, name, exercises) {
    const id = nextId('myRoutines');
    const data = load();
    if (!data.myRoutines) data.myRoutines = [];
    const record = { id, user_id: userId, name, exercises, created_at: new Date().toISOString() };
    data.myRoutines.push(record);
    save(data);
    return { lastInsertRowid: id };
  },
  // 루틴에 운동을 더 넣을 때 쓴다. 이름을 바꾸는 데도 같은 자리를 쓴다.
  // 남의 루틴은 못 고친다 — user_id 까지 맞아야 찾는다
  updateMyRoutine(id, userId, fields) {
    const data = load();
    if (!data.myRoutines) return { changes: 0 };
    const record = data.myRoutines.find(r => r.id === id && r.user_id === userId);
    if (!record) return { changes: 0 };
    if (fields.name !== undefined) record.name = fields.name;
    if (fields.exercises !== undefined) record.exercises = fields.exercises;
    record.updated_at = new Date().toISOString();
    save(data);
    return { changes: 1, record };
  },
  deleteMyRoutine(id, userId) {
    const data = load();
    if (!data.myRoutines) return { changes: 0 };
    const idx = data.myRoutines.findIndex(r => r.id === id && r.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.myRoutines.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },

  // maintenance — 점검 스케줄
  getMaintenance() {
    const data = load();
    return Array.isArray(data.maintenance) ? data.maintenance : [];
  },
  saveMaintenance(list) {
    const data = load();
    data.maintenance = list;
    save(data);
    return data.maintenance;
  },

  // ratings — 만족도
  //
  // 한 사람당 한 줄이다. 여러 줄을 쌓으면 자주 누른 사람이 평균을 끌고 간다.
  // 다시 매기면 덮어쓰고 시각만 갱신한다.
  getRating(userId) {
    const data = load();
    return (data.ratings || []).find(r => r.user_id === userId) || null;
  },

  saveRating(userId, score) {
    const data = load();
    if (!data.ratings) data.ratings = [];
    const now = new Date().toISOString();
    const found = data.ratings.find(r => r.user_id === userId);
    if (found) {
      found.score = score;
      found.updated_at = now;
      save(data);
      return found;
    }
    const record = { id: nextId('ratings'), user_id: userId, score, created_at: now, updated_at: now };
    data.ratings.push(record);
    save(data);
    return record;
  },

  // 관리자가 보는 것은 분포뿐이다. 누가 몇 점을 줬는지는 돌려주지 않는다 —
  // 점수를 보고 사람을 대하게 되면 솔직한 점수가 안 들어온다
  getRatingStats() {
    const data = load();
    const list = data.ratings || [];
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of list) {
      if (dist[r.score] === undefined) continue;
      dist[r.score] += 1;
      sum += r.score;
    }
    const count = list.length;
    return {
      count,
      avg: count ? Number((sum / count).toFixed(2)) : 0,
      dist,
      updatedAt: list.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), ''),
    };
  },

  // reports — 제보함 (버그 · 문의 · 건의)
  //
  // 최신이 위다. 목록을 그리는 쪽에서 매번 세우지 않게 여기서 한 번만 세운다.
  // id 로 세운다 — 같은 날 여러 건이 들어와도 순서가 흔들리지 않는다.
  getReports(userId) {
    const data = load();
    return (data.reports || []).filter(r => r.user_id === userId).sort((a, b) => b.id - a.id);
  },
  getAllReports() {
    const data = load();
    return (data.reports || []).sort((a, b) => b.id - a.id);
  },
  createReport(userId, fields) {
    const id = nextId('reports');
    const data = load();
    if (!data.reports) data.reports = [];
    const now = new Date().toISOString();
    const record = {
      id,
      user_id: userId,
      kind: fields.kind,
      title: fields.title,
      body: fields.body || '',
      meta: fields.meta || {},
      device: fields.device || null,
      // 짜증 섞인 말로 통과한 것 표시. 처벌 대상이 아니라 관리자 눈에 띄게만 한다
      flagged: fields.flagged || null,
      status: 'received',
      reply: null,
      reply_at: null,
      created_at: now,
      updated_at: now,
    };
    data.reports.push(record);
    save(data);
    return record;
  },
  deleteReport(id, userId) {
    const data = load();
    if (!data.reports) return { changes: 0 };
    // 본인 것만 지운다. 관리자라도 남의 제보를 목록에서 없애지는 않는다 —
    // 답을 달아야 할 대상이 조용히 사라지면 안 된다
    const idx = data.reports.findIndex(r => r.id === id && r.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.reports.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },
  // 관리자용 — 상태와 답변만 바꾼다. 사용자가 쓴 내용은 건드리지 않는다
  updateReport(id, fields) {
    const data = load();
    if (!data.reports) return { changes: 0 };
    const report = data.reports.find(r => r.id === id);
    if (!report) return { changes: 0 };
    if (fields.status !== undefined) report.status = fields.status;
    if (fields.reply !== undefined) {
      report.reply = fields.reply;
      report.reply_at = fields.reply ? new Date().toISOString() : null;
    }
    report.updated_at = new Date().toISOString();
    save(data);
    return { changes: 1, report };
  },

  // photos (profile + compare)
  getPhotos(userId) {
    return loadPhotos().photos.filter(p => p.user_id === userId);
  },
  savePhoto(userId, type, dataUrl) {
    // type: 'profile' | 'before' | 'after'
    const store = loadPhotos();
    // For profile/before/after: replace existing of same type
    const idx = store.photos.findIndex(p => p.user_id === userId && p.type === type);
    if (idx !== -1) {
      store.photos[idx].data = dataUrl;
      store.photos[idx].updated_at = new Date().toISOString();
    } else {
      const id = store._nextId || 1;
      store._nextId = id + 1;
      store.photos.push({ id, user_id: userId, type, data: dataUrl, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    savePhotoStore();
    return { changes: 1 };
  },
  deletePhoto(userId, type) {
    const store = loadPhotos();
    const idx = store.photos.findIndex(p => p.user_id === userId && p.type === type);
    if (idx === -1) return { changes: 0 };
    store.photos.splice(idx, 1);
    savePhotoStore();
    return { changes: 1 };
  },

  // 계정을 지울 때 사진도 같이 지운다 (본체와 파일이 갈렸으니 따로 불러야 한다)
  deleteUserPhotos,

  // 본체에 남아 있던 사진을 새 파일로 옮긴다. 서버가 뜰 때 한 번 부른다
  migratePhotos() {
    const data = load();
    if (!Array.isArray(data.photos) || data.photos.length === 0) return 0;
    const store = loadPhotos();
    const known = new Set(store.photos.map(p => `${p.user_id}:${p.type}`));
    let moved = 0;
    for (const p of data.photos) {
      if (known.has(`${p.user_id}:${p.type}`)) continue;
      store.photos.push(p);
      store._nextId = Math.max(store._nextId || 1, (p.id || 0) + 1);
      moved += 1;
    }
    data.photos = [];
    save(data);
    savePhotoStore();
    _flushPhotos();
    return moved;
  },

  // suspensions
  getSuspension(userId) {
    const data = load();
    if (!data.suspensions) return null;
    const now = new Date().toISOString();
    return data.suspensions.find(s => s.user_id === userId && (s.expires_at === 'permanent' || s.expires_at > now)) || null;
  },
  createSuspension(userId, level, reason, aiReason, expiresAt) {
    const id = nextId('suspensions');
    const data = load();
    if (!data.suspensions) data.suspensions = [];
    const record = { id, user_id: userId, level, reason, ai_reason: aiReason, expires_at: expiresAt, created_at: new Date().toISOString() };
    data.suspensions.push(record);
    save(data);
    return { lastInsertRowid: id };
  },
  getSuspensions() {
    const data = load();
    return data.suspensions || [];
  },

  // abuseLogs — 욕설·비하로 걸린 기록
  //
  // 메모리에 두면 서버가 다시 뜰 때마다 초회로 돌아간다. Render 는 자주 다시 뜬다.
  // 처벌 수위를 올리려면 누적이 남아 있어야 한다.
  // 원문도 같이 남긴다 — 사전이 잘못 잡은 건지 사람이 판단할 수 있어야 한다.
  addAbuseLog(userId, fields) {
    const id = nextId('abuseLogs');
    const data = load();
    if (!data.abuseLogs) data.abuseLogs = [];
    const record = {
      id,
      user_id: userId,
      level: fields.level,
      hits: fields.hits || [],
      where: fields.where || '',
      text: String(fields.text || '').slice(0, 500),
      action: fields.action || '',
      days: fields.days || 0,
      reviewed: false,
      created_at: new Date().toISOString(),
    };
    data.abuseLogs.push(record);
    save(data);
    return record;
  },
  // 사다리에 쓰는 누적 횟수. 짜증 섞인 말(mild)은 세지 않는다 —
  // 그건 막지도 않았으니 벌점으로 쌓으면 안 된다.
  // 관리자가 '사전이 잘못 잡았다' 고 표시한 것도 빼준다.
  countAbuse(userId) {
    const data = load();
    return (data.abuseLogs || []).filter(
      a => a.user_id === userId && a.level !== 'mild' && !a.dismissed
    ).length;
  },
  getAbuseLogs() {
    const data = load();
    return (data.abuseLogs || []).sort((a, b) => b.id - a.id);
  },
  // 사전이 잘못 잡아 정지된 사람을 풀어준다. 되돌릴 길이 없으면 자동 처벌을 걸 수 없다
  clearSuspensions(userId) {
    const data = load();
    if (!data.suspensions) return { changes: 0 };
    const before = data.suspensions.length;
    data.suspensions = data.suspensions.filter(s => s.user_id !== userId);
    save(data);
    return { changes: before - data.suspensions.length };
  },
  updateAbuseLog(id, fields) {
    const data = load();
    if (!data.abuseLogs) return { changes: 0 };
    const log = data.abuseLogs.find(a => a.id === id);
    if (!log) return { changes: 0 };
    if (fields.reviewed !== undefined) log.reviewed = !!fields.reviewed;
    if (fields.dismissed !== undefined) log.dismissed = !!fields.dismissed;
    save(data);
    return { changes: 1, log };
  },

  // blacklist
  isBlacklisted(email, ip, ua) {
    const data = load();
    if (!data.blacklist || data.blacklist.length === 0) return false;
    return data.blacklist.some(b => {
      if (b.type === 'email' && email && b.value === email) return true;
      if (b.type === 'ip' && ip && b.value === ip) return true;
      if (b.type === 'ip_range' && ip) {
        const range = b.value.replace('/24', '').replace(/\.\d+$/, '');
        const ipPrefix = ip.replace(/\.\d+$/, '');
        if (range === ipPrefix) return true;
      }
      if (b.type === 'ua' && ua && b.value === ua) return true;
      return false;
    });
  },
  addBlacklist(type, value, reason) {
    const id = nextId('blacklist');
    const data = load();
    if (!data.blacklist) data.blacklist = [];
    const record = { id, type, value, reason, created_at: new Date().toISOString() };
    data.blacklist.push(record);
    save(data);
    return { lastInsertRowid: id };
  },
  getBlacklist() {
    const data = load();
    return data.blacklist || [];
  },
  removeBlacklist(id) {
    const data = load();
    if (!data.blacklist) return { changes: 0 };
    const idx = data.blacklist.findIndex(b => b.id === id);
    if (idx === -1) return { changes: 0 };
    data.blacklist.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },

  // user ban + delete
  banUser(userId) {
    const data = load();
    const user = data.users.find(u => u.id === userId);
    if (!user) return { changes: 0 };
    user.is_banned = true;
    invalidateUserIndex();
    save(data);
    return { changes: 1 };
  },
  deleteUserCompletely(userId) {
    const data = load();
    data.users = data.users.filter(u => u.id !== userId);
    data.workouts = (data.workouts || []).filter(w => w.user_id !== userId);
    data.inbody = (data.inbody || []).filter(r => r.user_id !== userId);
    data.measures = (data.measures || []).filter(m => m.user_id !== userId);
    data.myRoutines = (data.myRoutines || []).filter(r => r.user_id !== userId);
    data.refreshTokens = (data.refreshTokens || []).filter(t => t.user_id !== userId);
    invalidateUserIndex();
    save(data);
    // 사진은 다른 파일에 있다. 여기서 안 부르면 지운 계정의 사진이 남는다
    deleteUserPhotos(userId);
    return { changes: 1 };
  },

  // ── refresh token ──
  //
  // **해시로 담는다.** 예전에는 있는 그대로 적어뒀다. 그 파일 한 줄만 읽으면 그 줄의
  // 주인으로 그대로 로그인할 수 있다 — 비밀번호를 몰라도, 바꿔도 그렇다.
  // 백업 파일 · 로그 · 실수로 올라간 덤프까지 전부 열쇠 꾸러미가 된다.
  //
  // 비밀번호처럼 bcrypt 를 쓰지는 않는다. 이건 사람이 지은 말이 아니라 48바이트 난수라
  // 사전 대입이 통하지 않고, 요청마다 확인해야 해서 느리면 안 된다. SHA-256 이면 된다.
  //
  // **바꾸는 값이라 옛 줄은 못 알아본다** — 지금 로그인해 있는 사람은 한 번 다시
  // 로그인해야 한다. 배포 전에 하는 이유가 그것이다. 나중에 하면 그 값이 쓰는 사람 수만큼
  // 커진다. 옛 줄은 시작할 때 걷어낸다 (`dropLegacyRefreshTokens`).
  refreshHash,
  saveRefreshToken(userId, token, expiresAt) {
    const data = load();
    if (!data.refreshTokens) data.refreshTokens = [];
    data.refreshTokens.push({
      user_id: userId,
      token_hash: refreshHash(token),
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });
    save(data);
  },
  findRefreshToken(token) {
    const data = load();
    if (!data.refreshTokens) return null;
    const hash = refreshHash(token);
    return data.refreshTokens.find(t => t.token_hash === hash && t.expires_at > new Date().toISOString()) || null;
  },
  deleteRefreshToken(token) {
    const data = load();
    if (!data.refreshTokens) return;
    const hash = refreshHash(token);
    data.refreshTokens = data.refreshTokens.filter(t => t.token_hash !== hash);
    save(data);
  },

  // 있는 그대로 적혀 있던 옛 줄을 걷어낸다. 그대로 두면 못 알아보는 줄이 만료될 때까지
  // 파일에 남는데, 그 줄들이 바로 새면 안 되는 값이다. 몇 줄이었는지는 적어둔다 —
  // 그만큼의 사람이 다시 로그인해야 한다는 뜻이다
  dropLegacyRefreshTokens() {
    const data = load();
    if (!data.refreshTokens) return 0;
    const before = data.refreshTokens.length;
    data.refreshTokens = data.refreshTokens.filter(t => t && t.token_hash);
    const dropped = before - data.refreshTokens.length;
    if (dropped > 0) save(data);
    return dropped;
  },
  deleteUserRefreshTokens(userId) {
    const data = load();
    if (!data.refreshTokens) return;
    data.refreshTokens = data.refreshTokens.filter(t => t.user_id !== userId);
    save(data);
  },
  cleanExpiredRefreshTokens() {
    const data = load();
    if (!data.refreshTokens) return;
    const now = new Date().toISOString();
    data.refreshTokens = data.refreshTokens.filter(t => t.expires_at > now);
    save(data);
  },

  // ── 답이 안 나온 말 ──
  //
  // 같은 말은 한 줄에 모으고 횟수만 올린다. 줄마다 쌓으면 목록이 금세 못 읽게 되고,
  // 무엇이 자주 묻는 것인지도 안 보인다.
  //
  // key 는 공백·기호를 지운 소문자다 ('비 번' 과 '비번' 은 같은 말이다).
  // 화면에 보여주는 것은 처음 친 그대로의 term 이다.
  recordFaqGap(term, key) {
    const data = load();
    if (!data.faqGaps) data.faqGaps = [];
    const now = new Date().toISOString();
    const found = data.faqGaps.find(g => g.key === key);
    if (found) {
      found.count += 1;
      found.last_at = now;
      save(data);
      return found;
    }
    const record = { id: nextId('faqGaps'), key, term, count: 1, first_at: now, last_at: now };
    data.faqGaps.push(record);
    save(data);
    return record;
  },

  getFaqGaps(sinceIso) {
    const data = load();
    const all = data.faqGaps || [];
    const rows = sinceIso ? all.filter(g => g.last_at >= sinceIso) : all;
    // 자주 물은 것이 위로. 같은 횟수면 최근에 물은 것이 위로
    return [...rows].sort((a, b) => (b.count - a.count) || (a.last_at < b.last_at ? 1 : -1));
  },

  deleteFaqGap(id) {
    const data = load();
    if (!data.faqGaps) return { changes: 0 };
    const idx = data.faqGaps.findIndex(g => g.id === id);
    if (idx === -1) return { changes: 0 };
    data.faqGaps.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },

  // ── 운동 알림 ──
  getReminder(userId) {
    const data = load();
    return (data.reminders || []).find(r => r.user_id === userId) || null;
  },

  saveReminder(userId, patch) {
    const data = load();
    if (!data.reminders) data.reminders = [];
    const now = new Date().toISOString();
    let row = data.reminders.find(r => r.user_id === userId);
    if (!row) {
      row = { user_id: userId, created_at: now };
      data.reminders.push(row);
    }
    Object.assign(row, patch, { updated_at: now });
    save(data);
    return row;
  },

  getEnabledReminders() {
    const data = load();
    return (data.reminders || []).filter(r => r.enabled);
  },

  // 같은 날 두 번 보내지 않으려고 보낸 날을 적어둔다.
  // **사용자 기준 날짜**다 — 서버가 UTC 로 돌아도 사람은 자기 시간대로 산다
  markReminderSent(userId, localDate) {
    const data = load();
    const row = (data.reminders || []).find(r => r.user_id === userId);
    if (!row) return;
    row.last_sent_date = localDate;
    save(data);
  },

  // 「오래 쉬고 계세요」를 보낸 쉼을 적어둔다 — 그때의 마지막 운동 날짜다.
  // 같은 쉼에 두 번 보내지 않으려는 것이다. 다시 운동하면 날짜가 바뀌어 풀린다
  markStreakNudged(userId, lastWorkoutDate) {
    const data = load();
    const row = (data.reminders || []).find(r => r.user_id === userId);
    if (!row) return;
    row.last_streak_workout = lastWorkoutDate;
    save(data);
  },

  // ── 웹 푸시 구독 ──
  //
  // endpoint 가 곧 그 기기다. 같은 endpoint 가 다시 오면 새 줄을 만들지 않는다 —
  // 앱을 열 때마다 구독을 다시 보내므로, 안 그러면 기기 하나가 수십 줄이 된다
  savePushSub(userId, sub) {
    const data = load();
    if (!data.pushSubs) data.pushSubs = [];
    const found = data.pushSubs.find(s => s.endpoint === sub.endpoint);
    if (found) {
      found.user_id = userId;
      found.keys = sub.keys;
      found.seen_at = new Date().toISOString();
      save(data);
      return found;
    }
    const record = {
      id: nextId('pushSubs'), user_id: userId,
      endpoint: sub.endpoint, keys: sub.keys,
      created_at: new Date().toISOString(), seen_at: new Date().toISOString(),
    };
    data.pushSubs.push(record);
    save(data);
    return record;
  },

  getPushSubs(userId) {
    const data = load();
    return (data.pushSubs || []).filter(s => s.user_id === userId);
  },

  // 브라우저가 404/410 을 돌려주면 그 구독은 죽은 것이다. 그대로 두면 매번 실패한다
  deletePushSubByEndpoint(endpoint) {
    const data = load();
    if (!data.pushSubs) return { changes: 0 };
    const idx = data.pushSubs.findIndex(s => s.endpoint === endpoint);
    if (idx === -1) return { changes: 0 };
    data.pushSubs.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },

  // ── 진행 중인 루틴 ──
  getRoutineSession(userId) {
    const data = load();
    return (data.routineSessions || []).find(s => s.user_id === userId) || null;
  },

  // 시작하면 루틴의 운동 목록을 **베껴 담는다.**
  // 진행 중에 루틴을 고쳐도 하던 것이 흔들리지 않게 하려는 것이다
  startRoutineSession(userId, routineId, name, items) {
    const data = load();
    if (!data.routineSessions) data.routineSessions = [];
    const now = new Date().toISOString();
    const row = {
      user_id: userId, routine_id: routineId, name, items,
      started_at: now, updated_at: now,
    };
    const idx = data.routineSessions.findIndex(s => s.user_id === userId);
    if (idx === -1) data.routineSessions.push(row);
    else data.routineSessions[idx] = row;
    save(data);
    return row;
  },

  setRoutineItemState(userId, index, state) {
    const data = load();
    const row = (data.routineSessions || []).find(s => s.user_id === userId);
    if (!row || !row.items[index]) return null;
    row.items[index].state = state;
    row.updated_at = new Date().toISOString();
    save(data);
    return row;
  },

  endRoutineSession(userId) {
    const data = load();
    if (!data.routineSessions) return { changes: 0 };
    const idx = data.routineSessions.findIndex(s => s.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.routineSessions.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },

  // security
  getAllUsers() {
    const data = load();
    return data.users;
  },
  updateUserRole(id, role) {
    const data = load();
    const user = data.users.find(u => u.id === id);
    if (!user) return { changes: 0 };
    user.role = role;
    invalidateUserIndex();
    save(data);
    return { changes: 1 };
  },
};

db.emailKey = emailKey;

module.exports = db;
