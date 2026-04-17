const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../ironlog.json');

// 기본 데이터 구조
const DEFAULT_DATA = {
  users: [],
  workouts: [],
  inbody: [],
  measures: [],
  myRoutines: [],
  notices: [],
  photos: [],
  suspensions: [],   // { id, user_id, level, reason, ai_reason, expires_at, created_at }
  blacklist: [],     // { id, type, value, reason, created_at } — type: 'email'|'ip'|'ip_range'|'ua'
  _nextId: { users: 1, workouts: 1, inbody: 1, measures: 1, myRoutines: 1, notices: 1, photos: 1, suspensions: 1, blacklist: 1 },
};

// In-memory cache + debounced writes + write lock
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
    console.error('[DB] ironlog.json 파싱 실패, 초기화합니다:', err.message);
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

// Flush on process exit
process.on('exit', _flush);
process.on('SIGINT', () => { _flush(); process.exit(); });
process.on('SIGTERM', () => { _flush(); process.exit(); });

// 다음 ID 가져오기 (save는 호출자가 함)
function nextId(table) {
  const data = load();
  const id = data._nextId[table] || 1;
  data._nextId[table] = id + 1;
  return id;
}

// ── 인덱스 캐시 (O(n) → O(1) 조회) ──
const _index = { userById: null, userByEmail: null, userByUsername: null };

function rebuildIndex() {
  const data = load();
  _index.userById = new Map();
  _index.userByEmail = new Map();
  _index.userByUsername = new Map();
  for (const u of data.users) {
    _index.userById.set(u.id, u);
    _index.userByEmail.set(u.email, u);
    if (u.username) _index.userByUsername.set(u.username, u);
  }
}

function invalidateUserIndex() { _index.userById = null; }

const db = {
  // users (인덱스 기반 O(1) 조회)
  findUserByEmail(email) {
    if (!_index.userById) rebuildIndex();
    return _index.userByEmail.get(email) || null;
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
    if (data.users.some(u => u.email === email)) {
      throw new Error('DUPLICATE_EMAIL');
    }
    if (username && data.users.some(u => u.username === username)) {
      throw new Error('DUPLICATE_USERNAME');
    }
    const id = data._nextId.users || 1;
    data._nextId.users = id + 1;
    const role = (process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL) ? 'admin' : 'user';
    const user = { id, email, password, nickname, username: username || null, role, created_at: new Date().toISOString() };
    data.users.push(user);
    invalidateUserIndex();
    save(data);
    return { lastInsertRowid: id };
  },

  // workouts
  getWorkouts(userId) {
    const data = load();
    return (data.workouts || [])
      .filter(w => w.user_id === userId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
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
    save(data);
    return { lastInsertRowid: id };
  },
  deleteWorkout(id, userId) {
    const data = load();
    const idx = data.workouts.findIndex(w => w.id === id && w.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.workouts.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },

  // inbody
  getInbody(userId) {
    const data = load();
    return (data.inbody || [])
      .filter(r => r.user_id === userId)
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  createInbody(userId, date, height, weight, fat_pct, muscle_kg, water_l, bmi) {
    const id = nextId('inbody');
    const data = load();
    const record = { id, user_id: userId, date, height, weight, fat_pct, muscle_kg, water_l, bmi, created_at: new Date().toISOString() };
    data.inbody.push(record);
    save(data);
    return { lastInsertRowid: id };
  },
  deleteInbody(id, userId) {
    const data = load();
    const idx = data.inbody.findIndex(r => r.id === id && r.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.inbody.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },

  // user updates
  updateUserNickname(id, nickname) {
    const data = load();
    const user = data.users.find(u => u.id === id);
    if (!user) return { changes: 0 };
    user.nickname = nickname;
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
  deleteMyRoutine(id, userId) {
    const data = load();
    if (!data.myRoutines) return { changes: 0 };
    const idx = data.myRoutines.findIndex(r => r.id === id && r.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.myRoutines.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },

  // notices
  getNotices() {
    const data = load();
    return (data.notices || []).sort((a, b) => a.id - b.id);
  },
  createNotice(date, title, type, content) {
    const id = nextId('notices');
    const data = load();
    if (!data.notices) data.notices = [];
    const record = { id, date, title, type, content, created_at: new Date().toISOString() };
    data.notices.push(record);
    save(data);
    return { lastInsertRowid: id };
  },
  updateNotice(id, title, type, content) {
    const data = load();
    if (!data.notices) return { changes: 0 };
    const notice = data.notices.find(n => n.id === id);
    if (!notice) return { changes: 0 };
    if (title !== undefined) notice.title = title;
    if (type !== undefined) notice.type = type;
    if (content !== undefined) notice.content = content;
    save(data);
    return { changes: 1 };
  },
  deleteNotice(id) {
    const data = load();
    if (!data.notices) return { changes: 0 };
    const idx = data.notices.findIndex(n => n.id === id);
    if (idx === -1) return { changes: 0 };
    data.notices.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },

  // photos (profile + compare)
  getPhotos(userId) {
    const data = load();
    return (data.photos || []).filter(p => p.user_id === userId);
  },
  savePhoto(userId, type, dataUrl) {
    // type: 'profile' | 'before' | 'after'
    const data = load();
    if (!data.photos) data.photos = [];
    // For profile/before/after: replace existing of same type
    const idx = data.photos.findIndex(p => p.user_id === userId && p.type === type);
    if (idx !== -1) {
      data.photos[idx].data = dataUrl;
      data.photos[idx].updated_at = new Date().toISOString();
    } else {
      const id = data._nextId.photos || 1;
      data._nextId.photos = id + 1;
      data.photos.push({ id, user_id: userId, type, data: dataUrl, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    save(data);
    return { changes: 1 };
  },
  deletePhoto(userId, type) {
    const data = load();
    if (!data.photos) return { changes: 0 };
    const idx = data.photos.findIndex(p => p.user_id === userId && p.type === type);
    if (idx === -1) return { changes: 0 };
    data.photos.splice(idx, 1);
    save(data);
    return { changes: 1 };
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
    data.photos = (data.photos || []).filter(p => p.user_id !== userId);
    data.refreshTokens = (data.refreshTokens || []).filter(t => t.user_id !== userId);
    invalidateUserIndex();
    save(data);
    return { changes: 1 };
  },

  // refresh tokens
  saveRefreshToken(userId, token, expiresAt) {
    const data = load();
    if (!data.refreshTokens) data.refreshTokens = [];
    data.refreshTokens.push({ user_id: userId, token, expires_at: expiresAt, created_at: new Date().toISOString() });
    save(data);
  },
  findRefreshToken(token) {
    const data = load();
    if (!data.refreshTokens) return null;
    return data.refreshTokens.find(t => t.token === token && t.expires_at > new Date().toISOString()) || null;
  },
  deleteRefreshToken(token) {
    const data = load();
    if (!data.refreshTokens) return;
    data.refreshTokens = data.refreshTokens.filter(t => t.token !== token);
    save(data);
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

module.exports = db;
