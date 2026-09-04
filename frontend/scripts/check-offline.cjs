// 신호가 없을 때 적은 것이 안 사라지는가.
//
//   npm run offline
//
// **헬스장은 지하가 많다.** 9/3 까지 이 앱은 신호가 없으면 적은 것을 그 자리에서
// 잃었다 — 저장을 누르면 「저장 실패」 토스트가 뜨고 방금 한 세트가 날아갔다.
// 목록도 메모리에만 있어서 지난 기록조차 안 보였다.
//
// 여기서 보는 것은 두 갈래다.
//
//   1. 값만 다루는 조각들 (`data/offline.js`) — 실패의 모양을 가르는가,
//      줄에 세운 것이 목록에 섞이는가, 화면에 뭐라고 적는가
//   2. **store 를 실제로 돌려본다** — 신호를 끊고 적고, 신호를 살리고 올린다.
//      브라우저 없이 `client` 만 가짜로 세운다. 여기가 진짜 확인이다
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' -> ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// ── 브라우저 흉내 ──
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
let ONLINE = true;
global.navigator = { onLine: true, userAgent: 'check' };
global.window = { addEventListener() {}, removeEventListener() {} };

const bundle = (entry, out, opts = {}) => {
  esbuild.buildSync({
    entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node',
    define: { 'import.meta.env': '{}' }, logLevel: 'silent', ...opts,
  });
  const m = require(path.resolve(out));
  fs.unlinkSync(out);
  return m;
};

const off = bundle('src/data/offline.js', '.off.cjs');

console.log('── 이 실패는 신호가 없는 것인가, 서버가 안 받는 것인가 ──');
// 이것을 잘못 가르면 둘 중 하나가 난다 — 적은 것을 잃거나, 영영 안 빠지는 줄이 생긴다
ok('답을 못 받았으면 신호 문제다', off.isOfflineError({ message: 'Network Error' }), true);
ok('시간 초과도 신호 문제다', off.isOfflineError({ code: 'ECONNABORTED' }), true);
ok('서버가 400 을 줬으면 아니다', off.isOfflineError({ response: { status: 400 } }), false);
ok('서버가 500 을 줬어도 아니다', off.isOfflineError({ response: { status: 500 } }), false);
ok('우리가 취소한 것은 아니다', off.isOfflineError({ code: 'ERR_CANCELED' }), false);
ok('아무것도 없으면 아니다', off.isOfflineError(null), false);

console.log('');
console.log('── 줄에 세운 것이 목록에 같이 보이는가 ──');
// 안 보이면 사람은 저장이 안 된 줄 알고 **한 번 더 적는다**
const q1 = off.makeQueued({ date: '2026-09-03', exercise: '벤치프레스', weight: 60, sets: 4, reps: 10 }, 1788000000000, 0.5);
ok('local- 로 시작하는 id 를 준다', off.isLocalId(q1.id), true);
ok('서버 id 는 local 이 아니다', off.isLocalId(12), false);

const server = { '2026-09-03': [{ id: 7, date: '2026-09-03', exercise: '스쿼트', weight: 80, sets: 5, reps: 5 }] };
const merged = off.mergeQueue(server, [q1]);
ok('같은 날에 붙는다', merged['2026-09-03'].length, 2);
ok('방금 적은 것이 그 날의 마지막이다', merged['2026-09-03'][1].exercise, '벤치프레스');
ok('아직 못 올렸다고 표시된다', merged['2026-09-03'][1].pending, true);
ok('서버 것은 표시가 없다', merged['2026-09-03'][0].pending, undefined);
ok('없던 날짜도 만들어진다', Object.keys(off.mergeQueue({}, [q1])), ['2026-09-03']);
ok('이상한 값이 와도 안 터진다', off.mergeQueue(null, null), {});
ok('날짜 없는 것은 버린다', off.mergeQueue({}, [{ id: 'local-x', payload: {} }]), {});

const failed = off.markFailed([q1], q1.id, '무엇을 할지 적어주세요');
ok('못 올린 것은 줄에 남는다 (버리지 않는다)', failed.length, 1);
ok('  못 올렸다고 표시한다', failed[0].failed, true);
ok('  이유도 들고 있는다', off.mergeQueue({}, failed)['2026-09-03'][0].error, '무엇을 할지 적어주세요');
ok('다시 시도하면 표시가 풀린다', off.clearFailedMark(failed)[0].failed, false);
ok('올린 것은 줄에서 빠진다', off.dropFromQueue([q1], q1.id).length, 0);
ok('줄에 있는 것을 고칠 수 있다', off.editInQueue([q1], q1.id, { weight: 70 })[0].payload.weight, 70);

console.log('');
console.log('── 화면 위에 뭐라고 적는가 ──');
ok('아무 일도 없으면 아무것도 안 띄운다', off.offlineStatus({ online: true, queue: [] }), null);
ok('신호만 없으면 그것만 말한다', off.offlineStatus({ online: false, queue: [] }).kind, 'offline');
ok('신호가 없고 적어둔 것이 있으면 개수를 말한다',
  off.offlineStatus({ online: false, queue: [q1] }).text, '신호가 없어요 · 적어둔 1개는 기기에 있어요');
ok('신호가 오면 올리는 중이라고 말한다', off.offlineStatus({ online: true, queue: [q1] }).kind, 'sending');
ok('못 올린 것이 있으면 그것이 먼저다',
  off.offlineStatus({ online: false, queue: failed }).kind, 'failed');

console.log('');
console.log('── 담아두는 것은 90일까지 ──');
// 몇 년치를 통째로 담으면 localStorage 가 찬다 (대개 5MB)
const today = new Date('2026-09-03T00:00:00Z');
off.saveCache({
  '2026-09-01': [{ id: 1, date: '2026-09-01' }],
  '2026-01-01': [{ id: 2, date: '2026-01-01' }],
  '2026-09-02': [],
}, 90, today);
const cached = off.readCache();
ok('최근 것은 담는다', !!cached['2026-09-01'], true);
ok('오래된 것은 안 담는다', !!cached['2026-01-01'], false);
ok('빈 날은 안 담는다', !!cached['2026-09-02'], false);

store.set('ironlog_workouts_cache', '{망가진 값');
ok('담아둔 것이 깨져 있으면 없던 것으로 본다', off.readCache(), null);
store.set('ironlog_workout_queue', '[{"없는id":1}]');
ok('줄이 깨져 있어도 안 터진다', off.readQueue(), []);

// ── store 를 실제로 돌린다 ──
//
// 여기가 진짜 확인이다. `client` 를 가짜로 세우고 신호를 껐다 켠다.
console.log('');
console.log('── 신호를 끊고 적고, 살리고 올린다 (store 를 실제로) ──');

const fakeClientPath = path.resolve('.fake-client.cjs');
const fakeNotePath = path.resolve('.fake-note-client.cjs');

// 메모용 가짜 서버. **하루 한 장**을 지킨다 — 같은 날짜로 또 오면 새로 만들지 않고
// 고친다 (진짜 서버의 `POST /notes` 가 그렇게 한다). 이걸 안 지키면 「줄에 선 것을
// 다시 보내도 두 장이 안 생긴다」를 확인할 수가 없다
const FAKE_NOTES = `
let rows = [];
let nextId = 500;
const offlineErr = () => new Error('Network Error');
const reject = (status, error) => { const e = new Error('bad'); e.response = { status, data: { error } }; return e; };
module.exports = {
  __state: { online: true, rejectNext: null, failNext: false },
  get rows() { return rows; },
  set rows(v) { rows = v; },
  async get(url, cfg) {
    if (!module.exports.__state.online) throw offlineErr();
    if (module.exports.__state.failNext) { module.exports.__state.failNext = false; throw reject(500, '서버 오류'); }
    const month = cfg && cfg.params && cfg.params.month;
    return { data: month ? rows.filter(r => String(r.date).startsWith(month)) : rows };
  },
  async post(url, body) {
    if (!module.exports.__state.online) throw offlineErr();
    const bad = module.exports.__state.rejectNext;
    if (bad) { module.exports.__state.rejectNext = null; throw reject(400, bad); }
    const exist = rows.find(r => r.date === body.date);
    if (exist) { exist.body = body.body; return { data: exist }; }
    const row = { ...body, id: nextId++ };
    rows.push(row);
    return { data: row };
  },
  async put() { if (!module.exports.__state.online) throw offlineErr(); return { data: {} }; },
  async delete(url) {
    if (!module.exports.__state.online) throw offlineErr();
    const id = Number(String(url).split('/').pop());
    const before = rows.length;
    rows = rows.filter(r => r.id !== id);
    if (rows.length === before) throw reject(404, '그 메모를 찾을 수 없어요');
    return { data: {} };
  },
};
module.exports.default = module.exports;
`;
fs.writeFileSync(fakeClientPath, `
let saved = [];
let nextId = 100;
const offlineErr = () => { const e = new Error('Network Error'); return e; };
const reject = (status, error) => { const e = new Error('bad'); e.response = { status, data: { error } }; return e; };
module.exports = {
  __state: { online: true, rejectNext: null },
  get saved() { return saved; },
  async get(url) {
    if (!module.exports.__state.online) throw offlineErr();
    return { data: saved };
  },
  async post(url, body) {
    if (!module.exports.__state.online) throw offlineErr();
    const bad = module.exports.__state.rejectNext;
    if (bad) { module.exports.__state.rejectNext = null; throw reject(400, bad); }
    const row = { ...body, id: nextId++, created_at: new Date().toISOString() };
    saved.push(row);
    return { data: row };
  },
  async put() { if (!module.exports.__state.online) throw offlineErr(); return { data: {} }; },
  async delete(url) {
    if (!module.exports.__state.online) throw offlineErr();
    const id = Number(String(url).split('/').pop());
    saved = saved.filter(w => w.id !== id);
    return { data: {} };
  },
};
module.exports.default = module.exports;
`, 'utf-8');

// 진짜 서버 대신 가짜를 물린다. **store 는 손대지 않는다** —
// 검사를 위해 코드를 바꾸기 시작하면 검사한 것과 도는 것이 갈라진다
const swapClient = {
  name: 'swap-client',
  setup(build) {
    // **바깥에 둔다**(external). 번들 안으로 딸려 들어가면 검사가 든 것과
    // store 가 쓰는 것이 서로 다른 사본이 되어, 신호를 껐는데 store 는 모른다
    build.onResolve({ filter: /api\/client$/ }, () => ({ path: fakeClientPath, external: true }));
  },
};

const fake = require(fakeClientPath);
let useStore;
const S = () => useStore.getState();

(async () => {
  try {
    await esbuild.build({
      entryPoints: ['src/store/workoutStore.js'], bundle: true, format: 'cjs',
      outfile: '.wstore.cjs', platform: 'node', plugins: [swapClient], logLevel: 'silent',
    });
    const mod = require(path.resolve('.wstore.cjs'));
    fs.unlinkSync('.wstore.cjs');
    useStore = mod.useWorkoutStore;

    // 1. 신호가 있을 때 하나 적는다
    await S().addWorkout({ date: '2026-09-03', exercise: '스쿼트', weight: 80, sets: 5, reps: 5 });
    ok('신호가 있으면 서버로 간다', fake.saved.length, 1);
    ok('  줄은 비어 있다', S().queue.length, 0);
    ok('  화면 목록에 있다', S().workouts['2026-09-03'].length, 1);

    // 2. 신호를 끊는다 — 여기가 헬스장 지하다
    fake.__state.online = false;
    const res = await S().addWorkout({ date: '2026-09-03', exercise: '벤치프레스', weight: 60, sets: 4, reps: 10 });
    ok('신호가 없어도 터지지 않는다', !!res.queued, true);
    ok('  서버에는 안 갔다', fake.saved.length, 1);
    ok('  줄에 섰다', S().queue.length, 1);
    ok('  **화면에는 바로 보인다**', S().workouts['2026-09-03'].length, 2);
    ok('  아직 못 올렸다고 표시된다', S().workouts['2026-09-03'][1].pending, true);
    ok('  신호가 없다고 안다', S().online, false);

    // 세 개 더 적는다 (한 세트만 하고 나가지 않는다)
    await S().addWorkout({ date: '2026-09-03', exercise: '인클라인', weight: 40, sets: 3, reps: 12 });
    await S().addWorkout({ date: '2026-09-03', exercise: '딥스', weight: '맨몸', sets: 3, reps: 15 });
    ok('여러 개도 순서대로 쌓인다', S().queue.length, 3);

    // 3. 신호가 없는 채로 앱을 껐다 켠다 (담아둔 것에서 되살아나야 한다)
    const keptQueue = S().queue.length;
    useStore.setState({ server: {}, workouts: {}, queue: [] });
    S().hydrate();
    ok('앱을 다시 열어도 적어둔 것이 남아 있다', S().queue.length, keptQueue);
    ok('  담아둔 지난 기록도 보인다', S().workouts['2026-09-03'].length, 4);

    // 4. 신호가 없는 채로 잘못 적은 것 하나를 지운다 (서버에는 없는 것이다)
    const localId = S().queue[2].id;
    await S().deleteWorkout(localId);
    ok('안 올라간 것은 줄에서 뺀다', S().queue.length, 2);
    ok('  화면에서도 빠진다', S().workouts['2026-09-03'].length, 3);

    // 5. 신호가 돌아왔다
    fake.__state.online = true;
    const flushed = await S().flushQueue();
    ok('밀린 것을 올린다', flushed.sent, 2);
    ok('  줄이 비었다', S().queue.length, 0);
    ok('  서버에 다 들어갔다', fake.saved.length, 3);
    ok('  순서를 지킨다', fake.saved.map(w => w.exercise), ['스쿼트', '벤치프레스', '인클라인']);
    ok('  화면 목록도 서버 것으로 맞춰진다', S().workouts['2026-09-03'].length, 3);

    // 6. 서버가 거절하는 것 — 다시 보내도 소용없다. 표시해두고 사람에게 맡긴다
    fake.__state.online = false;
    await S().addWorkout({ date: '2026-09-03', exercise: '이상한것', weight: 1, sets: 1, reps: 1 });
    fake.__state.online = true;
    fake.__state.rejectNext = '무엇을 할지 적어주세요';
    const bad2 = await S().flushQueue();
    ok('서버가 거절하면 못 올렸다고 표시한다', bad2.failed, 1);
    ok('  **버리지 않는다** (사람이 적은 것이다)', S().queue.length, 1);
    ok('  이유를 들고 있는다', S().workouts['2026-09-03'].find(w => w.failed).error, '무엇을 할지 적어주세요');
    ok('  화면에 「못 올렸어요」로 뜬다', off.offlineStatus({ online: true, queue: S().queue }).kind, 'failed');

    // 사람이 「다시 시도」를 누르면 (이번에는 서버가 받는다)
    const retried = await S().retryFailed();
    ok('다시 시도하면 올라간다', retried.sent, 1);
    ok('  줄이 비었다', S().queue.length, 0);

    // 7. 신호가 없는 채로 목록을 받아보면 — 담아둔 것으로 그린다
    fake.__state.online = false;
    useStore.setState({ server: {}, workouts: {} });
    await S().fetchAll(true);
    ok('못 받아와도 담아둔 것으로 그린다', Object.keys(S().workouts).length > 0, true);
    ok('  「없습니다」가 되지 않는다', S().workouts['2026-09-03'].length, 4);

    // ── 그날 메모 (2026-09-04) ──
    //
    // 9/3 에는 운동 기록에만 붙였다. **메모야말로 헬스장에서 적는 말이다** —
    // 「어깨가 안 좋아 가볍게」는 집에 와서 적는 것이 아니다.
    // 줄의 모양이 다르다: 메모는 **하루 한 장**이라 줄이 날짜로 찾는 것이다.
    console.log('');
    console.log('── 그날 메모도 신호 없이 적힌다 ──');

    const nt = bundle('src/data/offlineNotes.js', '.onote.cjs');

    // 같은 날을 세 번 고쳐도 줄에는 한 장이다. 배열이면 세 번 올린다
    let nq = nt.queueSave({}, '2026-09-04', '어깨 안좋아 가볍게', 1);
    nq = nt.queueSave(nq, '2026-09-04', '어깨 안좋아 가볍게 · 벤치 뺌', 2);
    nq = nt.queueSave(nq, '2026-09-04', '어깨 안좋아 가볍게 · 벤치 뺌 · 30분', 3);
    ok('같은 날을 여러 번 고쳐도 줄에는 한 장이다', Object.keys(nq).length, 1);
    ok('  마지막에 적은 것이 남는다', nq['2026-09-04'].body, '어깨 안좋아 가볍게 · 벤치 뺌 · 30분');

    const nServer = { '2026-09-01': { id: 5, date: '2026-09-01', body: '가슴' } };
    const nMerged = nt.mergeNotes(nServer, nq);
    ok('적은 순간 달력에 보인다', nMerged['2026-09-04'].body, '어깨 안좋아 가볍게 · 벤치 뺌 · 30분');
    ok('  아직 못 올렸다고 표시된다', nMerged['2026-09-04'].pending, true);
    ok('  id 가 local- 로 시작한다', nt.isLocalNoteId(nMerged['2026-09-04'].id), true);
    ok('  서버 것은 표시가 없다', nMerged['2026-09-01'].pending, undefined);

    // 지우기 — **서버에 있는 것이냐가 갈림길이다**
    ok('안 올라간 것을 지우면 줄에서 빠진다',
      Object.keys(nt.queueDelete(nq, '2026-09-04', null)).length, 0);
    const delQ = nt.queueDelete({}, '2026-09-01', 5);
    ok('서버에 있는 것은 지우기가 줄에 선다', delQ['2026-09-01'].op, 'delete');
    ok('  달력에서는 바로 사라진다', nt.mergeNotes(nServer, delQ)['2026-09-01'], undefined);

    const nFailed = nt.markNoteFailed(nq, '2026-09-04', '메모 내용을 적어주세요');
    ok('못 올린 것은 줄에 남는다 (버리지 않는다)', Object.keys(nFailed).length, 1);
    ok('  이유를 들고 있는다', nt.mergeNotes({}, nFailed)['2026-09-04'].error, '메모 내용을 적어주세요');
    ok('다시 시도하면 표시가 풀린다', nt.clearNoteFailed(nFailed)['2026-09-04'].failed, false);
    ok('사람이 버리면 그때 지운다', Object.keys(nt.dropFailedNotes(nFailed)).length, 0);

    // 띠는 하나다 — 운동 기록의 줄과 같이 세려면 배열이어야 한다
    ok('줄을 배열로 바꿔준다 (띠가 같이 센다)', nt.queueList(nFailed)[0].kind, 'note');
    ok('  못 올린 것으로 세어진다',
      off.offlineStatus({ online: true, queue: nt.queueList(nFailed) }).kind, 'failed');

    // 담아두는 것 — **달을 넘길 때 앞 달이 사라지면 안 된다**
    store.delete('ironlog_day_notes_cache');
    const nToday = new Date('2026-09-04T00:00:00Z');
    nt.saveNoteCache({ '2026-09-01': { id: 5, date: '2026-09-01', body: '가슴' } }, '2026-09', 90, nToday);
    nt.saveNoteCache({ '2026-08-20': { id: 4, date: '2026-08-20', body: '등' } }, '2026-08', 90, nToday);
    ok('앞 달을 담아둔 것이 안 사라진다', !!nt.readNoteCache()['2026-09-01'], true);
    ok('  그 달만 꺼내 그린다', Object.keys(nt.cachedMonth('2026-08')), ['2026-08-20']);
    nt.saveNoteCache({}, '2026-09', 90, nToday);
    ok('그 달에서 지워진 것은 담아둔 것에서도 빠진다', !!nt.readNoteCache()['2026-09-01'], false);
    ok('  다른 달은 그대로다', !!nt.readNoteCache()['2026-08-20'], true);
    nt.saveNoteCache({ '2026-01-05': { id: 1, date: '2026-01-05', body: '옛것' } }, '2026-01', 90, nToday);
    ok('90일보다 오래된 것은 안 담는다', !!nt.readNoteCache()['2026-01-05'], false);

    store.set('ironlog_day_note_queue', '{망가진 값');
    ok('줄이 깨져 있어도 안 터진다', nt.readNoteQueue(), {});
    store.set('ironlog_day_note_queue', '{"2026-09-04":{"op":"save"},"아무날":{"op":"save","body":"x"}}');
    ok('  모양이 안 맞는 줄은 버린다', nt.readNoteQueue(), {});
    store.delete('ironlog_day_note_queue');
    store.delete('ironlog_day_notes_cache');

    // ── store 를 실제로 돌린다 ──
    console.log('');
    console.log('── 신호를 끊고 메모를 적고, 살리고 올린다 (store 를 실제로) ──');

    fs.writeFileSync(fakeNotePath, FAKE_NOTES, 'utf-8');
    const fakeNote = require(fakeNotePath);
    const swapNoteClient = {
      name: 'swap-note-client',
      setup(build) {
        build.onResolve({ filter: /api[/]client$/ }, () => ({ path: fakeNotePath, external: true }));
      },
    };
    await esbuild.build({
      entryPoints: ['src/store/noteStore.js'], bundle: true, format: 'cjs',
      outfile: '.nstore.cjs', platform: 'node', plugins: [swapNoteClient], logLevel: 'silent',
    });
    const nmod = require(path.resolve('.nstore.cjs'));
    fs.unlinkSync('.nstore.cjs');
    const N = () => nmod.useNoteStore.getState();

    await N().fetchMonth('2026-09');
    await N().saveNote('2026-09-01', '가슴 · 벤치 5kg 올림');
    ok('신호가 있으면 서버로 간다', fakeNote.rows.length, 1);
    ok('  줄은 비어 있다', Object.keys(N().queue).length, 0);
    ok('  달력에 있다', N().notes['2026-09-01'].body, '가슴 · 벤치 5kg 올림');

    // 지하로 내려간다
    fakeNote.__state.online = false;
    const nres = await N().saveNote('2026-09-04', '어깨가 안 좋아 가볍게');
    ok('신호가 없어도 터지지 않는다', !!nres.queued, true);
    ok('  서버에는 안 갔다', fakeNote.rows.length, 1);
    ok('  **달력에는 바로 보인다**', N().notes['2026-09-04'].body, '어깨가 안 좋아 가볍게');
    ok('  아직 못 올렸다고 표시된다', N().notes['2026-09-04'].pending, true);
    ok('  신호가 없다고 안다', N().online, false);

    await N().saveNote('2026-09-04', '어깨가 안 좋아 가볍게 · 30분만');
    ok('같은 날을 고쳐도 줄은 한 장이다', Object.keys(N().queue).length, 1);
    ok('  고친 것이 달력에 보인다', N().notes['2026-09-04'].body, '어깨가 안 좋아 가볍게 · 30분만');

    // 신호가 없는 채로 앱을 껐다 켠다
    nmod.useNoteStore.setState({ server: {}, notes: {}, queue: {} });
    N().hydrate();
    ok('앱을 다시 열어도 적어둔 것이 남아 있다', Object.keys(N().queue).length, 1);
    ok('  적은 글 그대로다', N().notes['2026-09-04'].body, '어깨가 안 좋아 가볍게 · 30분만');

    // 신호가 없는 채로 **서버에 있는 메모**를 지운다
    await N().fetchMonth('2026-09');
    ok('못 받아와도 담아둔 것으로 그린다', N().notes['2026-09-01'].body, '가슴 · 벤치 5kg 올림');
    await N().removeNote(N().notes['2026-09-01']);
    ok('신호가 없어도 달력에서 지워진다', N().notes['2026-09-01'], undefined);
    ok('  서버에는 아직 있다', fakeNote.rows.length, 1);
    ok('  지우기가 줄에 섰다', N().queue['2026-09-01'].op, 'delete');

    // 신호가 돌아왔다
    fakeNote.__state.online = true;
    const nflush = await N().flushQueue();
    ok('밀린 것을 올린다', nflush.sent, 2);
    ok('  줄이 비었다', Object.keys(N().queue).length, 0);
    ok('  적은 메모가 서버에 들어갔다', fakeNote.rows.map(r => r.date), ['2026-09-04']);

    // 하루 한 장 — 줄에 선 것을 올릴 때도 두 장이 되지 않는다
    fakeNote.__state.online = false;
    await N().saveNote('2026-09-04', '어깨 · 30분만 · 스트레칭');
    fakeNote.__state.online = true;
    await N().flushQueue();
    ok('같은 날에 두 장이 생기지 않는다', fakeNote.rows.filter(r => r.date === '2026-09-04').length, 1);
    ok('  마지막에 적은 것이 서버에 있다',
      fakeNote.rows.find(r => r.date === '2026-09-04').body, '어깨 · 30분만 · 스트레칭');

    // 서버가 거절하는 것 — 버리지 않는다
    fakeNote.__state.online = false;
    await N().saveNote('2026-09-05', '거절될 메모');
    fakeNote.__state.online = true;
    fakeNote.__state.rejectNext = '메모 내용을 적어주세요';
    const nbad = await N().flushQueue();
    ok('서버가 거절하면 못 올렸다고 표시한다', nbad.failed, 1);
    ok('  **버리지 않는다** (사람이 적은 것이다)', Object.keys(N().queue).length, 1);
    ok('  이유를 들고 있는다', N().notes['2026-09-05'].error, '메모 내용을 적어주세요');
    const nretry = await N().retryFailed();
    ok('다시 시도하면 올라간다', nretry.sent, 1);
    ok('  줄이 비었다', Object.keys(N().queue).length, 0);

    // 이미 없는 것을 지우러 가는 것은 실패가 아니다 (다른 기기에서 먼저 지웠다)
    fakeNote.__state.online = false;
    await N().removeNote(N().notes['2026-09-04']);
    fakeNote.rows = fakeNote.rows.filter(r => r.date !== '2026-09-04');
    fakeNote.__state.online = true;
    const gone = await N().flushQueue();
    ok('이미 없는 것을 지우려 해도 줄이 안 막힌다', gone.failed, 0);
    ok('  줄에서 빠진다', Object.keys(N().queue).length, 0);

    // 서버가 답은 했는데 목록을 안 준 것 — 「없습니다」가 아니라 「못 불러왔다」다
    fakeNote.__state.failNext = true;
    await N().fetchMonth('2026-09');
    ok('못 불러온 것과 없는 것을 가른다', N().loadFailed, true);
    fakeNote.__state.failNext = false;
    await N().fetchMonth('2026-09');
    ok('  다시 불러오면 풀린다', N().loadFailed, false);
  } catch (err) {
    bad += 1;
    console.log('FAIL 검사가 도중에 터졌다 -> ' + err.message);
  } finally {
    fs.unlinkSync(fakeClientPath);
    if (fs.existsSync(fakeNotePath)) fs.unlinkSync(fakeNotePath);
    console.log('');
    console.log(bad ? bad + '건 실패' : '전부 통과');
    process.exit(bad ? 1 : 0);
  }
})();
