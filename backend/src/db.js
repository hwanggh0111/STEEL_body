const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// 검사에서는 진짜 DB 를 건드리면 안 된다. 그때만 다른 파일을 가리킬 수 있게 열어둔다
// (`DB_FILE=.tmp.json node ...`). 안 주면 늘 쓰던 자리다
const DB_PATH = process.env.DB_FILE
  ? path.resolve(process.env.DB_FILE)
  : path.join(__dirname, '../blackiron.json');

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
const PHOTOS_PATH = process.env.DB_FILE
  ? path.resolve(process.env.DB_FILE).replace(/\.json$/, '') + '.photos.json'
  : path.join(__dirname, '../photos.json');

// 기본 데이터 구조
const DEFAULT_DATA = {
  users: [],
  workouts: [],
  inbody: [],
  measures: [],
  myRoutines: [],
  // 루틴을 짜기 전에 적어두는 메모. 루틴이 되기 전 단계라 따로 둔다 —
  // 반쯤 적다 만 것을 루틴 목록에 섞으면 「시작하기」를 누를 수 있는 것이 돼버린다
  notes: [],
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
  // 앞으로 할 것. 달력에서 날짜를 골라 미리 정해둔다.
  //
  // **기록(`workouts`)과 섞지 않는다.** 한 것과 할 것은 다른 이야기다 — 섞어두면
  // 「이번 달에 몇 번 나왔나」에 아직 하지도 않은 날이 같이 세어진다.
  // 계획대로 하면 기록이 따로 쌓이고, 그날이 지나도 계획은 계획으로 남는다
  // (안 한 날을 지워버리면 왜 못 했는지가 아무 데도 안 남는다).
  plans: [],         // { id, user_id, date, kind: 'routine'|'exercise', name, routine_id, created_at }
  // 목표. 한 사람당 **한 줄**이다.
  //
  // 이 앱은 지나간 것만 보여줬다 — 1년 벽도 주간 요약도 몸 지도도 「무엇을 했나」다.
  // 「이번 주 3일」이 잘한 것인지 모자란 것인지는 아무 데서도 안 말해줬다.
  // 목표가 있어야 그 수에 뜻이 생긴다.
  //
  // **여러 줄로 두지 않는다.** 목표를 여럿 들고 있으면 홈에 무엇을 띄울지부터
  // 정해야 하고, 그러면 목표가 또 하나의 목록이 된다. 지금 쫓는 것 하나만 둔다.
  //
  // `weight_start` 는 목표를 세운 날의 체중이다. **그때 값을 박아둔다** — 진행률을
  // 「시작에서 얼마나 왔나」로 재는데, 시작점을 매번 기록에서 다시 찾으면
  // 옛 기록을 하나 고칠 때마다 진행률이 흔들린다
  goals: [],         // { user_id, weekly_target, weight_target, weight_start, started_at, created_at, updated_at }
  // 기구 세팅. 「랫풀다운은 시트 4번, 발판 2번, 넓은 그립」.
  //
  // 기구 앞에서 **매번 다시 맞춘다.** 한두 번 틀리게 맞춘 뒤에야 몸이 기억해내고,
  // 그 사이에 세트 한두 개를 버린다. 운동 이름은 이미 알고 있으니 붙일 자리가 있었다.
  //
  // **헬스장마다 따로 둔다.** 기구가 다르면 시트 번호도 다르다 — 강남점 세팅을
  // 집 앞 헬스장에서 그대로 쓰면 틀린 값을 믿고 맞추는 셈이라, 아예 없느니만 못하다.
  // 그래서 열쇠는 (사람 · 헬스장 · 운동) 셋이다.
  //
  // 칸은 **비워둘 수 있다.** 기구마다 조절하는 것이 다르다 — 시트만 있는 것도 있고
  // 아무것도 없는 것도 있다. 안 적은 칸은 화면이 안 그린다.
  gymSettings: [],   // { id, user_id, gym, exercise, seat, foot, grip, note, created_at, updated_at }
  // 화면이 흰 화면이 됐을 때 브라우저가 보내온 것.
  //
  // **사람 것이 아니다** — 어느 계정 것인지 안 적는다. 무엇이 터졌는지와 어느 화면인지만
  // 남긴다. 백 건만 들고 있는다 (그 이상은 같은 것이 반복될 뿐이다)
  clientErrors: [],  // { at, message, stack, path, agent }
  // ── 방어막이 남기는 것 ──
  //
  // **막아놓은 것은 서버가 다시 떠도 남아야 한다.** 8/31 까지 차단은 전부 램에만
  // 있었다(`aiGuard` 의 Map 들). 서버가 한 번 재시작하면 「영구 정지」로 막아둔 IP 도
  // 그냥 풀렸다 — Render 무료 플랜은 15분만 놀아도 프로세스가 내려간다. 즉 공격자는
  // **기다리기만 하면 됐다.**
  blocks: [],        // { ip, until, level, reason, created_at } — until: ISO 또는 'forever'
  // 로그인 실패 누적. IP 별 · 계정별 둘 다 여기에 센다.
  // 계정별을 같이 세는 이유는 IP 를 바꿔가며 한 계정을 두들기는 것을 IP 별로는
  // 절대 못 잡기 때문이다 (한 IP 당 한두 번씩만 시도하면 된다)
  loginFails: [],    // { key, count, last, until } — key: 'ip:1.2.3.4' | 'user:12'
  suspensions: [],   // { id, user_id, level, reason, ai_reason, expires_at, created_at }
  blacklist: [],     // { id, type, value, reason, created_at } — type: 'email'|'ip'|'ip_range'|'ua'
  _nextId: { users: 1, workouts: 1, inbody: 1, measures: 1, myRoutines: 1, reports: 1, abuseLogs: 1, photos: 1, ratings: 1, faqGaps: 1, pushSubs: 1, suspensions: 1, blacklist: 1, plans: 1, gymSettings: 1 },
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

// 사진도 같은 대접을 한다 — 재보면 40MB 에 196ms 다 (2026-09-18).
// **여기는 들여쓰기를 안 넣는다** — 사람이 읽을 파일이 아니고 base64 덩어리다
function _flushPhotos() {
  if (!_photoDirty || !_photoCache) return;
  let text;
  try {
    text = JSON.stringify(_photoCache);
  } catch (err) {
    console.error('[DB] 사진 저장 실패(문자열):', err.message);
    return;
  }
  _photoDirty = false;
  _writeAtomic(PHOTOS_PATH, text).catch((err) => {
    console.error('[DB] 사진 저장 실패:', err.message);
    _photoDirty = true;
  });
}

/** 끝나는 자리용 — 동기로, 원자적으로 */
function _flushPhotosSync() {
  if (!_photoDirty || !_photoCache) return;
  try {
    _writeAtomicSync(PHOTOS_PATH, JSON.stringify(_photoCache));
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
    // **깨진 파일을 덮어쓰지 않는다** (2026-09-19). 아래 `_flushSync` 가 곧 이 자리에
    // 빈 DB 를 쓴다 — 그 전에 옆으로 치워두지 않으면 **되살릴 파일이 남지 않는다.**
    // 원자적 쓰기를 붙인 뒤로는 여기까지 올 일이 거의 없지만, 그 「거의」에 걸리는 날은
    // 기록 전부가 걸린 날이다. 사람이 손으로 꺼낼 수 있게 남긴다
    console.error('[DB] blackiron.json 파싱 실패, 초기화합니다:', err.message);
    try {
      const kept = DB_PATH + '.broken-' + new Date().toISOString().replace(/[:.]/g, '-');
      fs.renameSync(DB_PATH, kept);
      console.error('[DB] 깨진 파일을 옆에 치워뒀습니다:', path.basename(kept));
    } catch (e2) {
      console.error('[DB] 깨진 파일을 치우지도 못했습니다:', e2.message);
    }
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

const INDENT = () => (process.env.NODE_ENV === 'production' ? undefined : 2);
// 쓰다 죽어도 앞의 것이 남게 — **딴 이름으로 다 쓴 뒤 이름을 바꿔 끼운다**
const TMP_SUFFIX = '.writing';

/**
 * 파일 한 장을 **원자적으로** 쓴다 (2026-09-18).
 *
 * 여태 `writeFileSync(DB_PATH, …)` 로 제자리에 덮어썼다. 그 사이에 프로세스가 죽거나
 * (Render 는 메모리를 넘기면 바로 죽인다) 전원이 끊기면 **파일이 잘린 채로 남는다.**
 * 그러면 다음에 뜰 때 `JSON.parse` 가 터지고, `load()` 는 그것을 기본값으로 되돌린다 —
 * **기록 전부가 사라진다는 뜻이다.** 딴 이름으로 다 쓴 뒤 `rename` 으로 갈아끼우면
 * 그 순간이 없다 (같은 볼륨에서 rename 은 원자적이다. 재보면 6ms).
 */
function _writeAtomicSync(file, text) {
  const tmp = file + TMP_SUFFIX;
  fs.writeFileSync(tmp, text, 'utf-8');
  fs.renameSync(tmp, file);
}

async function _writeAtomic(file, text) {
  const tmp = file + TMP_SUFFIX;
  await fsp.writeFile(tmp, text, 'utf-8');
  await fsp.rename(tmp, file);
}

/**
 * 모아둔 것을 파일에 쓴다 — **기다리지 않고.** (2026-09-18)
 *
 * 여태 `writeFileSync` 였다. 재보면 사람 10명 · 5년치(29만 줄 · 61MB)에서 한 번에
 * **173ms** 이고, 그동안 **서버는 아무 요청도 못 받는다** (노드는 한 줄로 돈다).
 * 헬스장에서 여럿이 동시에 적는 시간대에 그 멈춤이 그대로 모두의 기다림이 된다.
 *
 * 쪼개 재보면 문자열로 바꾸는 데 196ms, 파일에 쓰는 데 215ms 다 (38MB 기준).
 * **쓰는 쪽 절반을 비동기로 넘긴다.** 문자열은 기다리기 전에 만들어 두므로,
 * 쓰는 동안 들어온 저장이 섞이지 않는다 (그 사이 것은 `_dirty` 로 남아 다음에 쓴다).
 */
function _flush() {
  if (!_dirty || !_cache) return;
  if (_writeLock) {
    // 쓰는 중에 또 바뀌었다 — 지금 것을 다 쓴 뒤 한 번 더
    _writeQueue.push(() => _flush());
    return;
  }
  _writeLock = true;
  // **기다리기 전에** 찍어둔다. 기다리는 동안 `_cache` 가 바뀌어도 이 판은 온전하다
  let text;
  try {
    text = JSON.stringify(_cache, null, INDENT());
  } catch (err) {
    console.error('[DB] 저장 실패(문자열):', err.message);
    _writeLock = false;
    return;
  }
  _dirty = false;
  _writeAtomic(DB_PATH, text)
    .catch((err) => {
      console.error('[DB] 저장 실패:', err.message);
      // 못 썼으면 **다시 써야 한다고 표시해 둔다** — 안 그러면 그 판이 조용히 사라진다
      _dirty = true;
    })
    .finally(() => {
      _writeLock = false;
      if (_writeQueue.length > 0) {
        const next = _writeQueue.shift();
        next();
      } else if (_dirty) {
        // 쓰는 동안 또 바뀌었거나 실패했다
        if (_saveTimer) clearTimeout(_saveTimer);
        _saveTimer = setTimeout(_flush, 500);
      }
    });
}

function _flushSync(data) {
  _writeAtomicSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Flush on process exit (즉시 동기 저장)
function _flushImmediate() {
  if (_dirty && _cache) {
    try {
      // 끝나는 자리에서는 기다릴 수 없다 — 동기로 쓴다. **그래도 원자적으로** 쓴다:
      // 종료 중에 죽는 것이 제일 흔하고, 그때 잘리면 기록 전부가 사라진다
      _writeAtomicSync(DB_PATH, JSON.stringify(_cache, null, INDENT()));
      _dirty = false;
    } catch (err) {
      console.error('[DB] 종료 시 저장 실패:', err.message);
    }
  }
}
process.on('exit', () => { _flushImmediate(); _flushPhotosSync(); });
process.on('SIGINT', () => { _flushImmediate(); _flushPhotosSync(); process.exit(); });
process.on('SIGTERM', () => { _flushImmediate(); _flushPhotosSync(); process.exit(); });

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

// **한 사람이 저장했다고 모두의 것을 비우지 않는다** (2026-09-17).
//
// 예전에는 기록 하나를 저장할 때마다 `_queryCache.clear()` 로 **표를 통째로** 비웠다.
// 캐시 열쇠에는 이미 사람 번호가 들어 있는데도 그랬다 — 그래서 **남이 세트 하나를
// 적으면 내 목록이 캐시에서 떨어져 나가고**, 다음에 내가 홈을 열면 3만 건을 다시 훑는다.
//
// 재보면 이렇다 (사람 50명 · 기록 3만 건):
//   아무도 안 썼을 때 내 목록   0.000 ms   (캐시가 맞는다)
//   남이 하나 저장한 뒤 내 목록  1.162 ms   ← 남의 저장이 내 비용이 된다
//
// 헬스장에서 여럿이 동시에 적는 시간대가 바로 그 시간대다. 쓰는 사람이 늘수록
// **모두가 서로의 캐시를 계속 떨어뜨린다.** 자기 것만 비우면 그 일이 안 생긴다.
function invalidateUserQueries(userId) {
  _queryCache.delete('w_' + userId);
  _queryCache.delete('i_' + userId);
}

/**
 * 운동·인바디 줄이 바뀌었다 — 표와 **사람별 색인**을 같이 버린다 (2026-09-18).
 *
 * 둘을 따로 부르면 한쪽을 빠뜨리는 날이 온다. 그날의 증상은 「지운 것이 계속 보인다」다.
 */
function afterRowChange(table, userId, change) {
  invalidateUserQueries(userId);
  // **색인은 그 자리만 고친다** (위 참고). 못 알아들을 것이 오면 통째로 버린다 —
  // 틀린 색인을 들고 있는 것보다 다시 만드는 것이 낫다
  if (change?.added) rowAdded(table, change.added);
  else if (change?.removedId != null) rowRemoved(table, userId, change.removedId);
  else if (change?.updated) { /* 같은 객체라 손댈 것이 없다 */ }
  else invalidateRows(table);
}

// ── 인덱스 캐시 (O(n) → O(1) 조회) ──
const _index = { userById: null, userByEmail: null, userByUsername: null };

// ── 사람별 줄 색인 ── (2026-09-18, `npm run bench` 로 잡았다)
//
// 목록을 받을 때마다 **모든 사람의 모든 줄**을 훑어 걸렀다. 재보면 사람 10명 ·
// 5년치(29만 줄)에서 한 번에 10.5ms 다 — 쓰는 사람이 늘면 그만큼 길어진다.
// 내 줄만 모아 들고 있으면 그 일이 없어진다.
//
// **표(`_queryCache`)와 다르다.** 표는 5초짜리 사본이고 이건 **어느 줄이 누구 것인지**를
// 들고 있는 것이다 — 줄이 생기거나 사라질 때만 버린다.
const _rowIndex = { workouts: null, inbody: null };

// ── 날짜 정렬은 **그냥 비교**로 한다 ── (2026-09-18, `npm run bench` 로 잡았다)
//
// `localeCompare` 는 나라별 규칙을 보는 함수다. 그런데 여기서 견주는 것은
// `2026-09-18` 같은 **ISO 날짜와 시각**이고, 그런 글자는 **사전 순서가 곧 시간 순서**다 —
// 나라 규칙을 볼 일이 없다. 재보면 29,200줄 정렬에 **29.1ms → 4.3ms** 이고,
// 결과는 한 줄도 다르지 않다 (같은지 값으로 맞춰봤다).
//
// 이 자리는 **목록을 받을 때마다** 지난다 — 화면이 뜰 때, 저장한 뒤, 새로고침 때.
const descStr = (a, b) => (a < b ? 1 : a > b ? -1 : 0);   // 최신이 앞
const ascStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);    // 적은 차례대로

function _buildRowIndex(table) {
  const data = load();
  const map = new Map();
  for (const row of data[table] || []) {
    if (!row || row.user_id == null) continue;
    const list = map.get(row.user_id);
    if (list) list.push(row); else map.set(row.user_id, [row]);
  }
  _rowIndex[table] = map;
  return map;
}

/** 그 사람의 줄만. **돌려주는 것을 고치지 말 것** — 색인이 들고 있는 그 배열이다 */
function rowsOf(table, userId) {
  const map = _rowIndex[table] || _buildRowIndex(table);
  return map.get(userId) || [];
}

/** 통째로 버린다. **계정을 지울 때만** 쓴다 — 그때는 어느 줄이 사라졌는지 세지 않는다 */
function invalidateRows(table) { _rowIndex[table] = null; }

// ── 색인은 **버리지 않고 그 자리만 고친다** ── (2026-09-18)
//
// 처음에는 줄이 바뀔 때마다 색인을 버렸다. 그런데 그러면 **저장한 뒤 첫 조회가 29만
// 줄을 다시 훑는다** — 고치려던 것과 같은 일을 하는 셈이다(재보니 13ms).
// 한 줄 늘었으면 그 사람 자리에 한 줄만 밀어 넣으면 된다.
//
// **고치기(update)는 아무것도 안 한다** — 줄은 제자리에서 값만 바뀌고, 색인이 들고
// 있는 것은 그 줄 자체(같은 객체)라 이미 바뀐 값을 들고 있다.
function rowAdded(table, row) {
  const map = _rowIndex[table];
  if (!map || !row || row.user_id == null) return;
  const list = map.get(row.user_id);
  if (list) list.push(row); else map.set(row.user_id, [row]);
}

function rowRemoved(table, userId, id) {
  const map = _rowIndex[table];
  if (!map) return;
  const list = map.get(userId);
  if (!list) return;
  const i = list.findIndex((r) => r.id === id);
  if (i >= 0) list.splice(i, 1);
}

// 이메일은 대소문자를 가리지 않는다.
//
// 예전에는 그대로 비교했다. 그래서 `Kevin@Gmail.com` 으로 가입한 사람이
// `kevin@gmail.com` 으로 로그인하면 "없는 계정" 이 되고, 게다가 그 주소로 **또 가입이 됐다.**
// 같은 사람의 계정이 둘로 갈리고 기록도 갈린다. 저장은 적은 그대로 두고, 찾고 비교할 때만 낮춘다.
const emailKey = (email) => String(email || '').trim().toLowerCase();

// 아이디도 이메일과 **같은 규칙**으로 맞춘다.
//
// 회원가입 화면은 친 것을 소문자로 낮춰 보낸다(`val.toLowerCase()`). 그런데 서버의
// 조회는 대소문자를 그대로 가리고 있었다 — `Kevin12` 로 가입한 줄 아는 사람이
// 로그인 화면에 `Kevin12` 를 치면 **없는 계정**이 된다. 화면은 「아이디 또는 비밀번호가
// 틀렸어요」라고만 하니 사람은 비밀번호를 의심한다.
//
// 이메일은 emailKey 로 이미 맞추고 있었다. 아이디만 빠져 있었다.
const usernameKey = (username) => String(username || '').trim().toLowerCase();

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
    if (u.username) _index.userByUsername.set(usernameKey(u.username), u);
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
    return _index.userByUsername.get(usernameKey(username)) || null;
  },
  createUser(email, password, nickname, username) {
    const data = load();
    if (data.users.some(u => emailKey(u.email) === emailKey(email))) {
      throw new Error('DUPLICATE_EMAIL');
    }
    if (username && data.users.some(u => usernameKey(u.username) === usernameKey(username))) {
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
    // **표에 있는 것도 사본으로 준다** (2026-09-19, `npm run save` 로 잡았다).
    // 여태 표에 담아둔 그 배열을 그대로 돌려줬다 — 받은 쪽이 `sort`·`reverse`·`push` 를
    // 한 번만 해도 **표가 그대로 오염되고, 5초 동안 모두가 그것을 본다.**
    // 줄을 베끼는 것이 아니라 가리키는 것만 베낀다 (29만 줄에 0.1ms 였다)
    if (_queryCache.has(cacheKey) && Date.now() - _queryCache.get(cacheKey).t < 5000) return _queryCache.get(cacheKey).d.slice();
    // **내 줄만 모아둔 것에서 가져온다** (2026-09-18) — 여태 모든 사람의 모든 줄을
    // 훑었다. 사람 10명 · 5년치에서 10.5ms → 0.2ms.
    // 정렬은 여기서 한다: 색인은 「누구 것인가」만 들고, 차례는 화면이 정하는 것이다.
    // **사본에 정렬한다** — 색인이 들고 있는 배열을 제자리에서 뒤집으면 그 배열을
    // 쓰는 다음 사람이 뒤집힌 것을 본다
    const result = [...rowsOf('workouts', userId)]
      .sort((a, b) => descStr(a.date, b.date) || descStr(a.created_at || '', b.created_at || ''));
    _queryCache.set(cacheKey, { d: result, t: Date.now() });
    return result.slice();   // 표에 담아둔 것과 **다른 배열**을 준다 (위 참고)
  },
  // 「그 날 한 것만」(`getWorkoutsByDate`) 은 2026-09-19 에 걷었다 —
  // 그것을 쓰던 길(`GET /api/workouts/:date`)을 앱이 한 번도 안 불렀다.
  // 하루치는 앱이 들고 있는 목록에서 걸러 쓴다 (`routes/workouts.js` 참고)

  // clientKey 는 오프라인에서 적어 **줄에 세워둔 것**을 올릴 때 그 줄의 로컬 id 다.
  //
  // 지하에서 적은 세트는 신호가 돌아오면 줄에서 하나씩 올린다. 그런데 서버가 받고
  // 나서 **답이 오는 길에 끊기면**, 화면은 「못 올렸다」로 알고 그 줄을 안 지운다 —
  // 다음에 또 올린다. 그러면 같은 세트가 서버에 둘로 남는다 (적어도-한-번 전송의 고질).
  // 그 줄의 id 를 같이 보내면, 두 번째부터는 이미 있는 것을 돌려주고 새로 만들지 않는다.
  // **온라인에서 바로 저장하는 것에는 이 키가 없다** — 그건 매번 새로 만드는 게 맞다.
  createWorkout(userId, date, exercise, weight, sets, reps, clientKey = null) {
    const data = load();
    if (clientKey) {
      const existing = data.workouts.find(w => w.user_id === userId && w.client_key === clientKey);
      if (existing) return { lastInsertRowid: existing.id, deduped: true };
    }
    const id = nextId('workouts');
    const workout = { id, user_id: userId, date, exercise, weight, sets, reps, created_at: new Date().toISOString() };
    if (clientKey) workout.client_key = clientKey;
    data.workouts.push(workout);
    afterRowChange('workouts', userId, { added: workout });
    save(data);
    return { lastInsertRowid: id };
  },
  deleteWorkout(id, userId) {
    const data = load();
    const idx = data.workouts.findIndex(w => w.id === id && w.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.workouts.splice(idx, 1);
    afterRowChange('workouts', userId, { removedId: id });
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
    afterRowChange('workouts', userId, { updated: true });
    save(data);
    return { changes: 1, workout };
  },

  // inbody
  getInbody(userId) {
    const cacheKey = 'i_' + userId;
    // 운동 쪽과 같은 이유로 **사본을 준다** (위 `getWorkouts` 참고)
    if (_queryCache.has(cacheKey) && Date.now() - _queryCache.get(cacheKey).t < 5000) return _queryCache.get(cacheKey).d.slice();
    const result = [...rowsOf('inbody', userId)].sort((a, b) => descStr(a.date, b.date));
    _queryCache.set(cacheKey, { d: result, t: Date.now() });
    return result.slice();
  },
  createInbody(userId, date, height, weight, fat_pct, muscle_kg, water_l, bmi) {
    const id = nextId('inbody');
    const data = load();
    const record = { id, user_id: userId, date, height, weight, fat_pct, muscle_kg, water_l, bmi, created_at: new Date().toISOString() };
    data.inbody.push(record);
    afterRowChange('inbody', userId, { added: record });
    save(data);
    return { lastInsertRowid: id };
  },
  deleteInbody(id, userId) {
    const data = load();
    const idx = data.inbody.findIndex(r => r.id === id && r.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.inbody.splice(idx, 1);
    afterRowChange('inbody', userId, { removedId: id });
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
    afterRowChange('inbody', userId, { updated: true });
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
      .sort((a, b) => descStr(a.date, b.date));
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

  // clientErrors — 흰 화면이 났을 때 브라우저가 보내온 것
  addClientError(row) {
    const data = load();
    if (!data.clientErrors) data.clientErrors = [];
    data.clientErrors.push({ at: new Date().toISOString(), ...row });
    // 백 건만. 오래된 것부터 버린다
    if (data.clientErrors.length > 100) data.clientErrors = data.clientErrors.slice(-100);
    save(data);
  },
  getClientErrors() {
    return [...(load().clientErrors || [])].reverse();   // 최신이 위
  },
  clearClientErrors() {
    const data = load();
    data.clientErrors = [];
    save(data);
  },

  // plans — 앞으로 할 것
  //
  // 날짜 오름차순으로 준다. 달력은 날짜로 찾아 쓰고, 목록은 가까운 날부터 본다
  getPlans(userId) {
    const data = load();
    return (data.plans || [])
      .filter(p => p.user_id === userId)
      .sort((a, b) => ascStr(a.date, b.date) || a.id - b.id);
  },
  createPlan(userId, plan) {
    const id = nextId('plans');
    const data = load();
    if (!data.plans) data.plans = [];
    const row = { id, user_id: userId, created_at: new Date().toISOString(), ...plan };
    data.plans.push(row);
    save(data);
    return row;
  },
  deletePlan(id, userId) {
    const data = load();
    if (!data.plans) return { changes: 0 };
    const idx = data.plans.findIndex(p => p.id === id && p.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.plans.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },

  // notes — 루틴 메모장
  getNotes(userId) {
    const data = load();
    return (data.notes || [])
      .filter(n => n.user_id === userId)
      // 최근에 고친 것이 위다. 메모장은 **지금 짜고 있는 것**을 보러 오는 자리다
      .sort((a, b) => descStr(String(a.updated_at), String(b.updated_at)));
  },
  // date 를 주면 **달력의 그날 메모**, 안 주면 루틴 메모다 (`routes/notes.js` 참고)
  createNote(userId, body, date = null) {
    const id = nextId('notes');
    const data = load();
    if (!data.notes) data.notes = [];
    const now = new Date().toISOString();
    const row = { id, user_id: userId, body, date, created_at: now, updated_at: now };
    data.notes.push(row);
    save(data);
    return row;
  },
  updateNote(id, userId, body) {
    const data = load();
    const note = (data.notes || []).find(n => n.id === id && n.user_id === userId);
    if (!note) return { changes: 0, note: null };
    note.body = body;
    note.updated_at = new Date().toISOString();
    save(data);
    return { changes: 1, note };
  },
  deleteNote(id, userId) {
    const data = load();
    if (!data.notes) return { changes: 0 };
    const idx = data.notes.findIndex(n => n.id === id && n.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.notes.splice(idx, 1);
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

  // ── 홈페이지 사진 (2026-09-16) ──
  //
  // **관리자가 올리고 누구나 보는 사진이다.** 사람 사진(profile · before · after)과
  // 같은 파일에 살지만 **줄을 따로 둔다** — 사람 사진은 `user_id` 로 묶여 계정을 지울
  // 때 같이 지워진다. 홈페이지 사진이 거기 섞이면 **관리자가 계정을 지우는 날
  // 사이트의 사진이 같이 사라진다.**
  //
  // 순서를 `order` 로 들고 있다. 배열 차례를 그대로 쓰면 가운데 한 장을 지웠을 때
  // 뒤엣것이 전부 한 칸씩 당겨지는데, 그걸 파일에 다시 쓰는 것보다 번호가 싸다.
  getSitePhotos() {
    const store = loadPhotos();
    return (store.sitePhotos || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  },
  addSitePhoto(dataUrl, caption) {
    const store = loadPhotos();
    if (!Array.isArray(store.sitePhotos)) store.sitePhotos = [];
    const id = store._nextSiteId || 1;
    store._nextSiteId = id + 1;
    // 맨 뒤에 붙는다. 새로 올린 것이 위로 튀어 오르면 걸어둔 차례가 흐트러진다
    const last = store.sitePhotos.reduce((n, p2) => Math.max(n, p2.order || 0), 0);
    const row = { id, data: dataUrl, caption: caption || '', order: last + 1, created_at: new Date().toISOString() };
    store.sitePhotos.push(row);
    savePhotoStore();
    return row;
  },
  updateSitePhoto(id, caption) {
    const store = loadPhotos();
    const row = (store.sitePhotos || []).find(p2 => p2.id === id);
    if (!row) return null;
    row.caption = caption || '';
    savePhotoStore();
    return row;
  },
  deleteSitePhoto(id) {
    const store = loadPhotos();
    if (!Array.isArray(store.sitePhotos)) return false;
    const before = store.sitePhotos.length;
    store.sitePhotos = store.sitePhotos.filter(p2 => p2.id !== id);
    if (store.sitePhotos.length === before) return false;
    savePhotoStore();
    return true;
  },
  // 한 칸씩만 옮긴다. 옆엣것과 번호를 맞바꾼다
  moveSitePhoto(id, dir) {
    const store = loadPhotos();
    const list = (store.sitePhotos || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const i = list.findIndex(p2 => p2.id === id);
    if (i === -1) return false;
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return true;   // 끝이면 그대로 둔다 (실패가 아니다)
    const tmp = list[i].order;
    list[i].order = list[j].order;
    list[j].order = tmp;
    savePhotoStore();
    return true;
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
  /**
   * **욕설로 걸린 정지만** 푼다 (2026-09-19).
   *
   * 여태 `clearSuspensions` 로 그 사람의 정지를 **통째로** 지웠다. 그래서 관리자가
   * 욕설 오탐 하나를 「사전이 틀렸음」 으로 처리하면 **AI 가드가 해킹 시도로 걸어둔
   * 영구 정지까지 같이 풀렸다** (`middleware/aiGuard.js` 의 level 3·4).
   * 관리자가 하려던 일은 사전을 고치는 것이고, 차단을 푸는 것이 아니다.
   *
   * 다시 걸어야 할지 계산하려고 **제일 먼저 걸린 때**도 같이 돌려준다 —
   * 지금부터 다시 세면 벌이 늘어난다.
   */
  clearAbuseSuspensions(userId) {
    const data = load();
    if (!data.suspensions) return { changes: 0, earliest: null };
    const mine = data.suspensions.filter(
      (s) => s.user_id === userId && (s.reason === 'abuse' || s.reason === 'abuse-hate'),
    );
    if (mine.length === 0) return { changes: 0, earliest: null };
    const earliest = mine.map((s) => s.created_at).sort()[0] || null;
    data.suspensions = data.suspensions.filter((s) => !mine.includes(s));
    save(data);
    return { changes: mine.length, earliest };
  },

  /** 그 사람의 욕설 기록만. 다시 계산할 때 쓴다 */
  abuseLogsOf(userId) {
    const data = load();
    return (data.abuseLogs || []).filter((a) => a.user_id === userId);
  },

  // 정지를 통째로 푼다. **해킹 차단까지 같이 풀리므로** 욕설 되돌리기에는 쓰지 않는다
  // (위의 `clearAbuseSuspensions` 를 쓴다)
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
  // 한 사람에게 붙은 것을 **전부** 지운다.
  //
  // 예전에는 여섯 갈래만 지웠다. 제보 · 별점 · 알림설정 · 푸시구독 · 루틴진행 ·
  // 정지기록 · 욕설기록 일곱이 그대로 남았다. 제보에는 쓴 글과 기기 정보가 들어 있고,
  // 관리자 확인창은 그때도 「제보가 전부 사라집니다」라고 적고 있었다 —
  // **「지웠다」가 거짓말이었다.** 알림설정과 푸시구독이 남으면 없는 사람에게 계속
  // 알림을 보내려 든다.
  //
  // 그래서 목록을 여기 한 곳에 적어둔다. 새 컬렉션을 만들면서 여기에 안 적으면
  // 또 남는다 — `npm run check` 가 이 목록과 실제 컬렉션을 맞춰본다.
  USER_COLLECTIONS: ['workouts', 'inbody', 'measures', 'myRoutines', 'refreshTokens',
                     'reports', 'ratings', 'reminders', 'pushSubs', 'routineSessions',
                     'suspensions', 'abuseLogs', 'plans', 'notes', 'goals', 'gymSettings',
                     // **커뮤니티는 2026-09-16 에 걷어냈다.** 그런데 목록에서는 안 뺀다 —
                     // 기능이 없어져도 **옛 줄은 DB 에 그대로 남아 있다.** 빼면 계정을
                     // 지운 사람의 글·댓글만 영영 남는다. 지우는 쪽은 계속 지운다
                     'posts', 'postComments', 'postLikes', 'postReports'],
  // 지금 램에 들고 있는 그대로.
  //
  // 파일은 0.5초 뒤에 쓰이므로 **검사가 파일을 읽으면 옛 내용을 본다.**
  // (서버를 켜둔 채 DB 파일을 손으로 고치면 안 되는 것과 같은 이유다.)
  // 고치지 말고 읽기만 할 것 — 돌려주는 것은 사본이 아니라 그 자체다
  snapshot() { return load(); },
  /**
   * 조회 표에 이 열쇠가 들어 있나 — **검사가 보는 창이다** (`npm run cache`).
   *
   * 「남이 저장해도 내 목록은 표에 남아 있다」는 **값으로는 확인할 수 없다** —
   * 비우든 안 비우든 답은 똑같이 맞게 나오고, 다른 것은 빠르기뿐이다.
   * 그래서 표 안을 한 번 들여다볼 창을 낸다. 읽기만 한다.
   */
  cacheHas(key) { return _queryCache.has(key); },
  /**
   * 지금 당장 파일에 쓴다.
   *
   * 보통은 0.5초 뒤에 몰아 쓴다 — 기록 하나 저장할 때마다 파일을 통째로 다시 쓰지 않으려는
   * 것이다. 그런데 **막았다는 사실은 그 0.5초 안에 서버가 죽어도 남아야 한다** (공격받는
   * 중에 죽는 것이 바로 그 상황이다). 검사도 다른 프로세스에서 파일을 읽어보려면 이게 필요하다
   */
  flushNow() { _flushImmediate(); },
  /**
   * 사진도 지금 쓴다.
   *
   * 사진은 딴 파일이고 딴 시계로 쓴다(500ms 모아 쓰기). 서버가 내려갈 때는
   * `process.on('exit')` 가 부르지만, **재보거나 확인하는 자리에서는 부를 길이
   * 없었다** — 그래서 재는 쪽이 0.00MB 를 보고 「사진은 가볍다」로 읽을 뻔했다 (2026-09-18)
   */
  flushPhotosNow() { _flushPhotosSync(); },

  // ── 계정 삭제 예약 (30일 유예) ──
  //
  // 누르는 순간 지우지 않는다. **30일 동안 잠가두고, 그 안에 다시 로그인하면 되살린다.**
  // 실수로 누른 사람과 홧김에 누른 사람을 구하려고 두는 시간이다.
  // 그동안 서버에 남아 있는 것은 사실이라, 화면에도 그렇게 적는다.
  //
  // 예약과 동시에 **로그인 열쇠를 전부 걷어낸다** — 지운다고 해놓고 그 기기에서
  // 계속 쓰이면 잠근 것이 아니다. 되살리려면 다시 로그인해야 한다.
  GRACE_DAYS: 30,
  requestUserDeletion(userId, now = new Date()) {
    const data = load();
    const user = data.users.find(u => u.id === userId);
    if (!user) return null;
    const due = new Date(now.getTime() + db.GRACE_DAYS * 24 * 60 * 60 * 1000);
    user.deleting_at = now.toISOString();
    user.delete_due_at = due.toISOString();
    data.refreshTokens = (data.refreshTokens || []).filter(t => t.user_id !== userId);
    invalidateUserIndex();
    save(data);
    return { deleting_at: user.deleting_at, delete_due_at: user.delete_due_at };
  },
  cancelUserDeletion(userId) {
    const data = load();
    const user = data.users.find(u => u.id === userId);
    if (!user || !user.deleting_at) return false;
    delete user.deleting_at;
    delete user.delete_due_at;
    invalidateUserIndex();
    save(data);
    return true;
  },
  // 유예가 끝난 계정. 시각을 넘겨받는 이유는 **검사에서 30일 뒤를 만들어 보기** 위해서다
  dueDeletions(now = new Date()) {
    const iso = now.toISOString();
    return load().users.filter(u => u.delete_due_at && u.delete_due_at <= iso);
  },

  // 소셜로만 들어온 계정은 **본인도 비밀번호를 모른다** (가입할 때 난수를 넣는다).
  // 그런 계정에 비밀번호를 물으면 영영 못 지운다
  isSocialAccount(user) {
    if (!user) return false;
    if (user.is_social) return true;
    return /^(google|naver|facebook|instagram)_[0-9a-f]{8}$/.test(user.username || '');
  },

  deleteUserCompletely(userId) {
    const data = load();
    data.users = data.users.filter(u => u.id !== userId);
    for (const key of db.USER_COLLECTIONS) {
      data[key] = (data[key] || []).filter(row => row.user_id !== userId);
    }
    invalidateUserIndex();
    // **표도 비운다** (2026-09-17 에 빠져 있던 것을 채웠다).
    //
    // 지운 사람의 기록이 조회 표(`_queryCache`)에 남아 있으면 최대 5초 동안
    // **없는 사람의 목록이 그대로 나온다.** 다른 자리는 저장할 때마다 비우니
    // 눈에 안 띄었지만, 계정 삭제는 그 뒤로 아무 저장도 안 일어나는 자리다.
    // 여기서는 통째로 비운다 — 지우는 일은 드물고, 남기는 것보다 싸다
    invalidateQueryCache();
    // **사람별 색인도 버린다** (2026-09-18). 색인은 「어느 줄이 누구 것인가」를 들고
    // 있으므로, 줄이 사라진 것을 모르면 지운 사람의 목록을 계속 돌려준다 —
    // 표(5초)와 달리 이건 저절로 낡지 않는다
    invalidateRows('workouts');
    invalidateRows('inbody');
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
    // **쓴 것은 못 찾은 것으로 친다.** 여기서 걸러야 재사용이 「없는 토큰」이 아니라
    // 재사용으로 보인다 (그 판단은 `findUsedRefreshToken` 이 한다)
    return data.refreshTokens.find(
      t => t.token_hash === hash && !t.used_at && t.expires_at > new Date().toISOString()
    ) || null;
  },
  deleteRefreshToken(token) {
    const data = load();
    if (!data.refreshTokens) return;
    const hash = refreshHash(token);
    data.refreshTokens = data.refreshTokens.filter(t => t.token_hash !== hash);
    save(data);
  },

  // ── 한 번 쓴 refresh token 은 지우지 않고 「썼다」고 적는다 ──
  //
  // 갱신할 때마다 새 토큰으로 바꾼다(rotation). 그런데 예전에는 쓴 토큰을 **지웠다** —
  // 지우고 나면 그게 새어나가 남이 쓴 것인지, 그냥 만료된 것인지 **구별할 수가 없다.**
  // 둘 다 401 이다.
  //
  // 토큰이 새면 이렇게 된다. 공격자가 먼저 갱신하면 그 사람은 새 토큰을 받아 계속 쓰고,
  // 진짜 주인은 다음 갱신에서 401 을 받아 다시 로그인한다 — **쫓겨나는 쪽이 주인이다.**
  //
  // 그래서 쓴 표시만 하고 만료까지 들고 있는다. 쓴 토큰이 또 오면 **둘 중 하나는
  // 도둑**이므로 그 계정의 로그인 유지를 전부 끊는다. 둘 다 다시 로그인해야 하는데,
  // 비밀번호를 아는 쪽만 돌아온다.
  useRefreshToken(token) {
    const data = load();
    if (!data.refreshTokens) return;
    const hash = refreshHash(token);
    const row = data.refreshTokens.find(t => t.token_hash === hash);
    if (!row) return;
    row.used_at = new Date().toISOString();
    save(data);
  },
  /** 이미 쓴 토큰으로 또 갱신하려 든 것인가. 맞으면 그 줄을 준다 (누구 것인지 알아야 끊는다) */
  findUsedRefreshToken(token) {
    const data = load();
    if (!data.refreshTokens) return null;
    const hash = refreshHash(token);
    return data.refreshTokens.find(t => t.token_hash === hash && t.used_at) || null;
  },

  // ── 방어막: 막아둔 것 ──
  //
  // 램이 아니라 파일에 적는다. 서버가 다시 떠도 막힌 것은 막힌 채여야 한다.
  // `until` 이 'forever' 면 사람이 풀어줄 때까지 안 풀린다
  blockIp(ip, untilMs, level, reason) {
    if (!ip) return;
    const data = load();
    if (!data.blocks) data.blocks = [];
    const until = untilMs === Infinity ? 'forever' : new Date(untilMs).toISOString();
    const row = data.blocks.find(b => b.ip === ip);
    if (row) {
      // 더 센 것으로만 덮어쓴다 — 뒤에 온 가벼운 판정이 영구 차단을 지우면 안 된다
      if (row.until === 'forever') return;
      if (until === 'forever' || until > row.until) Object.assign(row, { until, level, reason, created_at: new Date().toISOString() });
    } else {
      data.blocks.push({ ip, until, level, reason, created_at: new Date().toISOString() });
    }
    save(data);
  },
  /** 지금 막혀 있으면 그 줄을, 아니면 null. 지날 때가 지난 줄은 그 자리에서 걷는다 */
  findBlock(ip) {
    const data = load();
    if (!data.blocks || !data.blocks.length) return null;
    const row = data.blocks.find(b => b.ip === ip);
    if (!row) return null;
    if (row.until !== 'forever' && row.until <= new Date().toISOString()) {
      data.blocks = data.blocks.filter(b => b.ip !== ip);
      save(data);
      return null;
    }
    return row;
  },
  unblockIp(ip) {
    const data = load();
    if (!data.blocks) return false;
    const before = data.blocks.length;
    data.blocks = data.blocks.filter(b => b.ip !== ip);
    if (data.blocks.length === before) return false;
    save(data);
    return true;
  },
  listBlocks() {
    const data = load();
    const now = new Date().toISOString();
    return (data.blocks || []).filter(b => b.until === 'forever' || b.until > now);
  },
  cleanExpiredBlocks() {
    const data = load();
    if (!data.blocks || !data.blocks.length) return 0;
    const now = new Date().toISOString();
    const before = data.blocks.length;
    data.blocks = data.blocks.filter(b => b.until === 'forever' || b.until > now);
    const dropped = before - data.blocks.length;
    if (dropped > 0) save(data);
    return dropped;
  },

  // ── 방어막: 로그인 실패 누적 ──
  //
  // `key` 는 'ip:1.2.3.4' 또는 'user:12' 다. **계정별을 같이 세는 것이 요점이다** —
  // IP 별로만 세면 IP 를 바꿔가며 한 계정을 두들기는 것을 못 잡는다. 한 IP 당
  // 두 번씩만 시도하면 IP 카운터는 영영 안 찬다.
  recordLoginFail(key, windowMs, max, lockMs) {
    const data = load();
    if (!data.loginFails) data.loginFails = [];
    const now = Date.now();
    let row = data.loginFails.find(r => r.key === key);
    if (!row) {
      row = { key, count: 0, last: 0, until: 0 };
      data.loginFails.push(row);
    }
    // 오래 조용했으면 처음부터 센다
    if (now - row.last > windowMs) row.count = 0;
    row.count += 1;
    row.last = now;
    if (row.count >= max) row.until = now + lockMs;
    save(data);
    return row;
  },
  /** 지금 잠겨 있으면 남은 밀리초, 아니면 0 */
  loginLockLeft(key) {
    const data = load();
    const row = (data.loginFails || []).find(r => r.key === key);
    if (!row || !row.until) return 0;
    return Math.max(0, row.until - Date.now());
  },
  clearLoginFail(key) {
    const data = load();
    if (!data.loginFails) return;
    const before = data.loginFails.length;
    data.loginFails = data.loginFails.filter(r => r.key !== key);
    if (data.loginFails.length !== before) save(data);
  },
  /** 지금 잠겨 있는 것만. 관리자 화면이 이걸 보고 풀어준다 */
  listLoginLocks() {
    const data = load();
    const now = Date.now();
    return (data.loginFails || []).filter(r => r.until > now);
  },
  /** 다 식은 줄은 걷는다. 안 걷으면 시도한 IP 수만큼 파일이 커진다 */
  cleanLoginFails(windowMs) {
    const data = load();
    if (!data.loginFails || !data.loginFails.length) return 0;
    const now = Date.now();
    const before = data.loginFails.length;
    data.loginFails = data.loginFails.filter(r => now - r.last < windowMs || r.until > now);
    const dropped = before - data.loginFails.length;
    if (dropped > 0) save(data);
    return dropped;
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

  // ── 목표 ──
  //
  // 한 사람당 한 줄. 알림 설정과 같은 모양이라 같은 방식으로 다룬다.
  getGoal(userId) {
    const data = load();
    return (data.goals || []).find(g => g.user_id === userId) || null;
  },

  saveGoal(userId, patch) {
    const data = load();
    if (!data.goals) data.goals = [];
    const now = new Date().toISOString();
    let row = data.goals.find(g => g.user_id === userId);
    if (!row) {
      row = { user_id: userId, created_at: now };
      data.goals.push(row);
    }
    Object.assign(row, patch, { updated_at: now });
    save(data);
    return row;
  },

  // 목표를 접는다. **줄을 통째로 지운다** — 값만 비워두면 「목표를 세웠다가
  // 비운 사람」과 「한 번도 안 세운 사람」이 DB 에서 같아 보이지 않는다
  clearGoal(userId) {
    const data = load();
    const before = (data.goals || []).length;
    data.goals = (data.goals || []).filter(g => g.user_id !== userId);
    if (data.goals.length === before) return { changes: 0 };
    save(data);
    return { changes: 1 };
  },

  // ── 기구 세팅 ──
  //
  // 열쇠는 (사람 · 헬스장 · 운동) 셋이다. 같은 운동이라도 헬스장이 다르면 다른 줄이다.

  /** 내 세팅 전부. 헬스장을 주면 그 헬스장 것만. */
  getGymSettings(userId, gym) {
    const data = load();
    return (data.gymSettings || [])
      .filter((s) => s.user_id === userId && (gym == null || s.gym === gym))
      .sort((a, b) => descStr(a.updated_at || '', b.updated_at || ''));
  },

  /** 그 헬스장의 그 운동 하나. 없으면 null. */
  getGymSetting(userId, gym, exercise) {
    const data = load();
    return (data.gymSettings || [])
      .find((s) => s.user_id === userId && s.gym === gym && s.exercise === exercise) || null;
  },

  /**
   * 세우거나 고친다. **같은 (헬스장 · 운동) 은 한 줄뿐이다** —
   * 여러 줄이 되면 화면이 어느 것을 띄울지 정해야 하고, 그러면 세팅이 목록이 된다.
   */
  saveGymSetting(userId, gym, exercise, patch) {
    const data = load();
    if (!data.gymSettings) data.gymSettings = [];
    const now = new Date().toISOString();
    let row = data.gymSettings.find((s) => s.user_id === userId && s.gym === gym && s.exercise === exercise);
    if (!row) {
      row = { id: nextId('gymSettings'), user_id: userId, gym, exercise, created_at: now };
      data.gymSettings.push(row);
    }
    Object.assign(row, patch, { updated_at: now });
    save(data);
    return row;
  },

  deleteGymSetting(userId, gym, exercise) {
    const data = load();
    const idx = (data.gymSettings || [])
      .findIndex((s) => s.user_id === userId && s.gym === gym && s.exercise === exercise);
    if (idx === -1) return { changes: 0 };
    data.gymSettings.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },

  /**
   * 내가 다니는 곳 — **따로 적어두지 않는다.**
   *
   * 세팅에 이미 헬스장 이름이 붙어 있으므로 거기서 뽑는다. 목록을 따로 들고 있으면
   * 세팅을 다 지운 헬스장이 목록에만 남는 날이 온다.
   */
  getGyms(userId) {
    const data = load();
    const count = new Map();
    for (const s of data.gymSettings || []) {
      if (s.user_id !== userId || !s.gym) continue;
      count.set(s.gym, (count.get(s.gym) || 0) + 1);
    }
    return [...count.entries()]
      .map(([name, settings]) => ({ name, settings }))
      .sort((a, b) => b.settings - a.settings || a.name.localeCompare(b.name));
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

  // 사람이 「이 기기 끄기」를 눌렀을 때. **주인을 확인하고 지운다.**
  //
  // 아래 `deletePushSubByEndpoint` 는 주인을 안 본다 — 죽은 구독을 걷는 쪽이라
  // 그래야 맞다(그때는 우리가 서버에서 스스로 부른다). 그런데 화면에서 오는 요청까지
  // 그것을 쓰고 있었다. 구독 주소만 알면 **남의 기기 알림을 끌 수 있었다.**
  deletePushSubOfUser(userId, endpoint) {
    const data = load();
    if (!data.pushSubs) return { changes: 0 };
    const idx = data.pushSubs.findIndex(s => s.endpoint === endpoint && s.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.pushSubs.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },

  // 브라우저가 404/410 을 돌려주면 그 구독은 죽은 것이다. 그대로 두면 매번 실패한다.
  // **여기는 주인을 안 본다** — 서버가 스스로 걷는 자리다. 사람이 부르는 길에는
  // 위의 `deletePushSubOfUser` 를 쓴다
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

  // 세트마다 누른 수. 9/14 전에 시작한 진행표에는 이 칸이 없다 — 없으면 0 으로 친다
  setRoutineItemSets(userId, index, setsDone) {
    const data = load();
    const row = (data.routineSessions || []).find(s => s.user_id === userId);
    if (!row || !row.items[index]) return null;
    row.items[index].setsDone = setsDone;
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
