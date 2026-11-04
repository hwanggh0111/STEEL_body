// **지하에서 루틴으로 운동하면 기록이 적히는가** (2026-11-04).
//
//   npm run basement     (npm run check 에도 들어 있다)
//
// ── 무엇이 틀렸나 ──
//
// 이 앱은 「헬스장은 지하가 많다」를 적어두고 그 대비를 만들어 뒀다 —
// 신호가 없으면 적은 것을 기기에 담고 줄에 세운다(`workoutStore` 의 `queue`,
// `npm run offline` 이 지킨다). 그런데 **루틴으로 운동하는 길만** 그 줄에
// 닿지 못했다.
//
// 루틴을 돌 때 기록을 저장하는 것은 **마지막 세트를 체크하는 그 누름**이다 —
//
//     tapSet → checkSet(진행표 PATCH) → … → saveRoutineSets → addWorkout(줄에 선다)
//
// 그 첫 칸(`checkSet`)이 **서버에 묻는 일**이라 지하에서 실패한다. 그러면
// `tapSet` 이 거기서 돌아섰고, **뒤의 저장까지 안 갔다** —
// 지하에서 루틴으로 한 운동은 **한 줄도 안 적혔다.** 「신호가 없어도 안 사라진다」는
// 약속이 **길 하나에서만** 깨져 있었다. 그리고 눌린 세트 체크는 **되돌아갔다**
// (사람이 한 세트가 화면에서 사라지고, 다시 눌러도 또 사라진다).
//
// ── 어떻게 보는가 ──
//
// 화면으로는 못 본다 — 지하에 내려가야 하고, 내려가도 「안 적혔다」는 것은 올라와서
// 목록을 봐야 안다. 그래서 **스토어 둘을 같이 돌린다**(`check-offline.cjs` 와 같은
// 방식). 가짜 `client` 가 진행표 PATCH 만 신호 없음으로 떨구고, 그 뒤에
// **기록이 줄에 섰는지**를 본다. 가르는 자(`isOfflineError`)도 값으로 본다.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// ── 브라우저 흉내 ──
const ls = new Map();
global.localStorage = {
  getItem: (k) => (ls.has(k) ? ls.get(k) : null),
  setItem: (k, v) => ls.set(k, String(v)),
  removeItem: (k) => ls.delete(k),
};
global.navigator = { onLine: true, userAgent: 'check' };
global.window = { addEventListener() {}, removeEventListener() {} };

// ── 가짜 client ── **길마다 신호를 따로 끊을 수 있다**
//
// 지하는 길을 가려서 끊지 않지만, 이 검사가 보려는 것은 「진행표를 못 올렸을 때
// 기록이 어디로 가는가」다. 그래서 진행표만 끊어 **그 한 걸음의 값**을 본다
const fakePath = path.resolve('.basement-client.cjs');
fs.writeFileSync(fakePath, `
let saved = [];
let nextId = 100;
const offline = () => new Error('Network Error');
module.exports = {
  // 어느 길을 끊을지 — 주소 조각을 적는다
  cut: [],
  // 주소별로 돌려줄 몸통 (없으면 아래 기본값)
  bodies: {},
  // **서버에 닿은 것만** 센다 (끊긴 요청은 서버가 받은 것이 아니다).
  // 「통째로 또 받지 않았나」· 「지하에서 하나도 안 갔나」를 세는 데 쓴다
  calls: [],
  get saved() { return saved; },
  reset() { saved = []; module.exports.cut = []; module.exports.calls = []; module.exports.bodies = {}; },
  _down(url) { return module.exports.cut.some((c) => String(url).includes(c)); },
  _note(method, url) { module.exports.calls.push(method + ' ' + String(url).split('?')[0]); },
  _body(url, fallback) {
    const key = String(url).split('?')[0];
    const b = module.exports.bodies[key];
    return b === undefined ? fallback : b;
  },
  async get(url) {
    if (module.exports._down(url)) throw offline();
    module.exports._note('GET', url);
    return { data: module.exports._body(url, url.includes('routine-session') ? { session: null } : []) };
  },
  async post(url, body) {
    if (module.exports._down(url)) throw offline();
    module.exports._note('POST', url);
    const row = { ...body, id: nextId++, date: body?.date, created_at: '2026-11-04T10:00:00.000Z' };
    saved.push(row);
    return { data: { workout: row, tag: 'W/"t' + row.id + '"' } };
  },
  async patch(url, body) {
    if (module.exports._down(url)) throw offline();
    module.exports._note('PATCH', url);
    return { data: module.exports._body(url, { session: null }) };
  },
  async put(url) { if (module.exports._down(url)) throw offline(); module.exports._note('PUT', url); return { data: {} }; },
  async delete(url) { if (module.exports._down(url)) throw offline(); module.exports._note('DELETE', url); return { data: {} }; },
};
module.exports.default = module.exports;
`, 'utf-8');
const fake = require(fakePath);

const sessPath = path.resolve('.basement-session.cjs');
esbuild.buildSync({
  entryPoints: ['src/store/session.js'], bundle: true, format: 'cjs',
  outfile: sessPath, platform: 'node', logLevel: 'silent',
});

const swap = {
  name: 'swap-client',
  setup(build) {
    build.onResolve({ filter: /api[/]client$/ }, () => ({ path: fakePath, external: true }));
    build.onResolve({ filter: /store[/]session$|^[.][/]session$/ }, () => ({ path: sessPath, external: true }));
  },
};

const load = async (entry, out) => {
  await esbuild.build({
    entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node',
    define: { 'import.meta.env': '{}' }, plugins: [swap], logLevel: 'silent',
  });
  const m = require(path.resolve(out));
  fs.unlinkSync(out);
  return m;
};

const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');

(async () => {
  try {
    const off = await load('src/data/offline.js', '.b-off.cjs');

    console.log('── 이 실패는 신호가 없는 것인가 ──');
    // 이것을 잘못 가르면 **지하에서 기록을 잃거나**, 서버가 거절한 것을 지하로 읽는다
    ok('답을 못 받았으면 신호 문제다', off.isOfflineError({ message: 'Network Error' }), true);
    ok('  400 은 아니다 (다시 눌러야 한다)', off.isOfflineError({ response: { status: 400 } }), false);
    ok('  409 도 아니다 (진행표가 바뀐 것이다)', off.isOfflineError({ response: { status: 409 } }), false);

    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 지하에서 세트를 체크했다 ──');
    const smod = await load('src/store/routineSessionStore.js', '.b-s.cjs');
    const S = () => smod.useRoutineSessionStore.getState();
    const ITEMS = [
      { name: '벤치프레스', sets: 4, reps: 10, state: 'todo', setsDone: 0 },
      { name: '인클라인', sets: 4, reps: 10, state: 'todo', setsDone: 0 },
    ];
    const SRV = {
      routineId: 1, name: '가슴 루틴', startedAt: '2026-11-04T10:00:00.000Z',
      items: ITEMS, done: 0, completed: 0, skipped: 0, current: 0, total: 2,
    };
    smod.useRoutineSessionStore.setState({ server: SRV, session: SRV, queue: {}, loaded: true });

    fake.cut = ['routine-session'];
    ls.clear();
    const r1 = await S().checkSet(0, 1);
    // **던지지 않는다** — 줄에 섰으면 실패가 아니다 (운동 줄의 `addWorkout` 과 같은 결)
    ok('줄에 섰다고 돌려준다', [!!r1.queued, !!r1.unsaved], [true, false]);
    // ★ **되돌리지 않는다** — 되돌리면 사람이 한 세트가 화면에서 사라진다
    ok('**눌린 세트가 화면에 남는다**', S().session.items[0].setsDone, 1);
    await S().checkSet(0, 2);
    ok('  또 눌러도 쌓인다', S().session.items[0].setsDone, 2);
    ok('  줄에는 한 칸만 선다', Object.keys(S().queue).length, 1);
    // ★ 11/04 아침까지는 화면에만 남기고 **담지 않았다** — 앱을 닫으면 사라졌다
    ok('  **기기에 담긴다**', [...ls.keys()].length, 1);

    // 서버가 「안 된다」고 말한 것은 되돌린다 (다시 눌러야 하는 자리다)
    S().reset();
    smod.useRoutineSessionStore.setState({ server: SRV, session: SRV, queue: {}, loaded: true });
    fake.cut = [];
    const bad400 = { response: { status: 400, data: { error: '세트 수가 올바르지 않아요' } } };
    const origPatch = fake.patch;
    fake.patch = async () => { throw bad400; };
    await S().checkSet(0, 3).catch(() => {});
    ok('서버가 거절한 것은 되돌린다', S().session.items[0].setsDone, 0);
    ok('  줄에도 안 남는다', Object.keys(S().queue).length, 0);
    fake.patch = origPatch;

    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 그리고 기록은 줄에 서는가 ──');
    const wmod = await load('src/store/workoutStore.js', '.b-w.cjs');
    const W = () => wmod.useWorkoutStore.getState();
    fake.reset();
    fake.cut = ['routine-session'];     // 진행표만 못 올린다

    // 화면이 하는 일: 체크를 못 올려도 **멈추지 않고** 기록을 적는다
    await S().checkSet(0, 4).catch(() => {});
    const res = await W().addWorkout({ date: '2026-11-04', exercise: '벤치프레스', weight: 90, sets: 4, reps: 10 });
    ok('기록은 서버로 갔다 (기록 길은 살아 있다)', fake.saved.length, 1);
    ok('  적힌 것이 그 운동이다', fake.saved[0].exercise, '벤치프레스');
    ok('  줄에 설 일이 없었다', W().queue.length, 0);

    // 이제 **기록 길까지 끊는다** — 진짜 지하다
    fake.reset();
    fake.cut = ['routine-session', 'workouts'];
    smod.useRoutineSessionStore.setState({ server: SRV, session: SRV, queue: {}, loaded: true });
    wmod.useWorkoutStore.setState({ workouts: {}, server: {}, queue: [] });
    await S().checkSet(0, 4).catch(() => {});
    const res2 = await W().addWorkout({ date: '2026-11-04', exercise: '벤치프레스', weight: 90, sets: 4, reps: 10 });
    ok('**기록이 줄에 섰다**', W().queue.length, 1);
    ok('  서버에는 안 갔다', fake.saved.length, 0);
    ok('  화면 목록에는 바로 보인다', W().workouts['2026-11-04'].length, 1);
    ok('  「이 기기에 적어뒀다」를 돌려준다', !!res2.queued, true);
    ok('  그리고 세트 체크는 화면에 남아 있다', S().session.items[0].setsDone, 4);

    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 화면이 그 길을 막지 않는가 ──');
    //
    // ★ **이 뭉치는 11/04 하루에 두 번 모양이 바뀌었다.** 아침에는 「신호 문제면
    // 돌아서지 않는다」(`if (!isOfflineError(err))`)를 지켰다 — 그때는 화면이 신호를
    // 갈랐다. D안 뒤로는 **스토어가 줄에 세우고 던지지 않으므로** 화면에 가를 일이
    // 없다. 지키려던 뜻은 그대로다: **신호 때문에 기록 길이 막히지 않는다.**
    // 그것은 위에서 값으로 봤다(`기록이 줄에 섰다`). 여기서는 **화면이 다시 가르기
    // 시작하지 않는지**를 본다 — 두 곳에서 가르면 한쪽만 고치는 날이 온다
    const train = codeOf(fs.readFileSync('src/pages/TrainPage.jsx', 'utf-8'));
    ok('화면은 신호를 가르지 않는다 (스토어가 한다)', /isOfflineError/.test(train), false);
    ok('  그냥 돌아서던 모양도 아니다',
      /catch \{\s*toast\('체크하지 못했어요[^]*?return;/.test(train.replace(/\s+/g, ' ')), false);
    // 담지 못한 때는 **말해줘야 한다** — 앱을 닫으면 사라지는 값이다
    ok('담지 못한 때만 말한다', /res\?\.unsaved/.test(train), true);
    ok('  서버가 거절한 것은 그 말을 그대로 전한다',
      /err\.response\?\.data\?\.error \|\| '체크하지 못했어요/.test(train), true);

    const store = codeOf(fs.readFileSync('src/store/routineSessionStore.js', 'utf-8'));
    ok('스토어가 신호 문제를 가른다', /isOfflineError\(err\)/.test(store), true);
    // 되돌리는 줄이 신호 문제보다 **뒤**에 있어야 한다 (앞에 있으면 먼저 되돌린다)
    ok('  되돌리기는 그 뒤에 있다',
      store.indexOf('isOfflineError(err)') < store.lastIndexOf('prevQueue'), true);
    // 담는 자리는 **한 곳**이다 (`apply`) — 두 곳에서 담으면 한쪽만 고쳐진다
    ok('담는 자리가 하나다', (store.match(/saveSessionQueue\(/g) || []).length, 1);

    // ─────────────────────────────────────────────────────────────
    // **진행표도 줄에 선다** (2026-11-04, D안)
    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 진행표 줄의 셈 ──');
    const sq = await load('src/data/offlineSession.js', '.b-sq.cjs');

    // 같은 칸을 세 번 눌러도 올릴 것은 **마지막 하나**다 — 배열로 쌓으면 세 번 올리고
    // 그 셋은 같은 자리를 덮어쓰기만 한다 (메모 줄이 날짜로 찾는 것과 같은 까닭)
    let q = sq.queueSets({}, 0, 1);
    q = sq.queueSets(q, 0, 2);
    q = sq.queueSets(q, 0, 3);
    ok('한 칸은 한 줄만 선다', Object.keys(q).length, 1);
    ok('  마지막 누름이 남는다', q[0].setsDone, 3);
    q = sq.queueState(q, 0, 'done');
    ok('세트와 칸 넘김을 **한 칸에 같이** 든다', [q[0].setsDone, q[0].state], [3, 'done']);
    q = sq.queueSets(q, 2, 1);
    ok('다른 칸은 따로 선다', sq.pendingCount(q), 2);
    ok('  올릴 차례는 자리 번호 차례다', sq.pendingIndexes(q), [0, 2]);
    // 서버가 「안 된다」고 답한 것은 다시 보내도 같다 — 표시하고 빼둔다
    q = sq.markSessionFailed(q, 2, '잘못된 자리예요');
    ok('표시된 칸은 올릴 것에서 빠진다', sq.pendingIndexes(q), [0]);
    ok('  그래도 줄에는 남아 있다 (까닭을 보여준다)', q[2].error, '잘못된 자리예요');
    ok('올라간 칸은 줄에서 빠진다', Object.keys(sq.dropIndex(q, 0)), ['2']);
    // 이상한 값이 들어와도 줄이 더러워지지 않는다
    ok('자리 번호가 아니면 안 세운다',
      [Object.keys(sq.queueSets({}, -1, 1)).length, Object.keys(sq.queueSets({}, 'a', 1)).length], [0, 0]);
    ok('  깨진 줄이 와도 안 터진다', Object.keys(sq.queueSets(null, 0, 1)), ['0']);

    console.log('');
    console.log('── 얹을 자리가 없는 누름 ──');
    // 담아둔 줄에 칸 번호 5 가 남아 있는데 지금 진행표가 두 칸이면 — 화면에는 그 칸이
    // **없는데** 「올릴 것 1」이 뜨고, 올리면 서버가 「잘못된 자리예요」로 돌려보낸다
    const TWO = {
      routineId: 1, startedAt: '2026-11-04T10:00:00.000Z',
      items: [{ name: 'A', state: 'todo', setsDone: 0 }, { name: 'B', state: 'todo', setsDone: 0 }],
      done: 0, completed: 0, skipped: 0, current: 0, total: 2,
    };
    const far = sq.queueState(sq.queueSets({}, 5, 3), 5, 'done');
    ok('진행표 밖의 칸은 걷어낸다', Object.keys(sq.trimQueue(far, 2)), []);
    ok('  안쪽 칸은 남긴다', Object.keys(sq.trimQueue(sq.queueSets(far, 1, 2), 2)), ['1']);
    ok('  칸 수를 모르면 그대로 둔다', Object.keys(sq.trimQueue(far, null)), ['5']);
    // 스토어가 그 자를 쓴다 — 서버 진행표를 받을 때 맞춘다
    ls.clear();
    S().reset();
    smod.useRoutineSessionStore.setState({ server: TWO, session: TWO, queue: far, loaded: true });
    S().apply(TWO, far);
    ok('스토어도 받을 때 걷어낸다', [Object.keys(S().queue).length, S().session.items.length], [0, 2]);

    console.log('');
    console.log('── 진행표가 없으면 담지 않는다 ──');
    // 어느 진행표의 것도 아닌 누름이 **다음 진행표에 얹히면** 하지도 않은 운동이
    // 끝난 것이 된다. 여태 둘 다 비면 `'' === ''` 로 같다고 보고 살려줬다
    ls.clear();
    ok('진행표가 없으면 담지 않는다',
      [sq.saveSessionQueue(sq.queueSets({}, 0, 2), undefined), [...ls.keys()].length], [true, 0]);
    sq.saveSessionQueue(sq.queueSets({}, 0, 2), '2026-11-04T10:00:00.000Z');
    ok('  진행표 없이 읽으면 빈 줄이다', sq.readSessionQueue(undefined), {});
    ok('  그 진행표로 읽으면 그대로다', Object.keys(sq.readSessionQueue('2026-11-04T10:00:00.000Z')), ['0']);

    console.log('');
    console.log('── 줄을 화면에 얹는다 ──');
    const SESSION = {
      routineId: 7,
      startedAt: '2026-11-04T10:00:00.000Z',
      items: [
        { name: '벤치프레스', sets: 4, state: 'todo', setsDone: 0 },
        { name: '인클라인', sets: 4, state: 'todo', setsDone: 0 },
        { name: '체스트 프레스', sets: 4, state: 'todo', setsDone: 0 },
        { name: '숄더프레스', sets: 4, state: 'todo', setsDone: 0 },
      ],
      done: 0, completed: 0, skipped: 0, current: 0, total: 4,
    };
    let q2 = sq.queueState(sq.queueSets({}, 0, 4), 0, 'done');
    q2 = sq.queueState(q2, 1, 'skip');
    q2 = sq.queueSets(q2, 2, 2);
    const shown = sq.applyQueue(SESSION, q2);
    ok('눌린 세트가 화면에 보인다', shown.items[0].setsDone, 4);
    ok('  넘긴 칸도 보인다', shown.items[1].state, 'skip');
    ok('  아직 못 올렸다고 표시된다', shown.items[0].pending, true);
    // ★ **여기가 고치려던 그 모습이다** — 칸은 넘어갔는데 막대가 1/8 에 머무는 것
    ok('**진행 수를 다시 센다**', [shown.done, shown.completed, shown.skipped], [2, 1, 1]);
    ok('  그래서 다음 칸으로 넘어간다', shown.current, 2);
    ok('줄이 비면 서버 것이 그대로다', sq.applyQueue(SESSION, {}), SESSION);
    ok('  진행표가 없으면 그대로 없다', sq.applyQueue(null, q2), null);

    console.log('');
    console.log('── 루틴을 새로 시작했으면 앞 줄을 버린다 ──');
    // 자리 번호의 뜻이 달라진다 — 앞 루틴의 「3번 칸을 끝냈다」가 새 루틴의 3번 칸에
    // 얹히면 **하지도 않은 운동이 끝난 것**이 된다
    const box = { for: '2026-11-04T10:00:00.000Z', queue: q2 };
    ok('같은 진행표면 그대로 쓴다', Object.keys(sq.keepFor(box, '2026-11-04T10:00:00.000Z')).length, 3);
    ok('  다른 진행표면 버린다', sq.keepFor(box, '2026-11-04T18:00:00.000Z'), {});
    ok('  진행표가 없으면 버린다', sq.keepFor(box, null), {});
    ok('깨진 것이 담겨 있어도 빈 줄로 본다', sq.keepFor('x', 'a'), {});

    console.log('');
    console.log('── 기기에 담고 다시 읽는다 ──');
    ls.clear();
    ok('담았다고 돌려준다', sq.saveSessionQueue(q2, SESSION.startedAt), true);
    ok('  다시 읽으면 그대로다', Object.keys(sq.readSessionQueue(SESSION.startedAt)).length, 3);
    ok('  다른 진행표로 읽으면 빈 줄이다', sq.readSessionQueue('딴것'), {});
    ok('빈 줄을 담으면 자리를 비운다', [sq.saveSessionQueue({}, SESSION.startedAt), [...ls.keys()].length], [true, 0]);
    sq.saveSessionQueue(q2, SESSION.startedAt);
    sq.clearSessionQueue();
    ok('그만두면 지워진다', [...ls.keys()].length, 0);

    // 실패를 가르는 자는 **운동 줄과 같은 것**을 쓴다 (두 벌로 적으면 한쪽만 고쳐진다)
    ok('신호 가르는 자를 같이 쓴다', sq.isOfflineError({ message: 'Network Error' }), true);

    // ─────────────────────────────────────────────────────────────
    // **지하에서 한 판을 끝까지 걷는다** (2026-11-04, D안)
    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 지하에서 여덟 칸 루틴을 돈다 ──');
    const EIGHT = Array.from({ length: 8 }, (_, i) => ({
      name: '운동' + (i + 1), sets: 4, reps: 10, state: 'todo', setsDone: 0,
    }));
    const BIG = {
      routineId: 9, name: '가슴 · 어깨 루틴', startedAt: '2026-11-04T11:00:00.000Z',
      items: EIGHT, done: 0, completed: 0, skipped: 0, current: 0, total: 8,
    };
    ls.clear();
    S().reset();
    smod.useRoutineSessionStore.setState({ server: BIG, session: BIG, queue: {}, loaded: true });
    fake.cut = ['routine-session', 'workouts'];   // 진짜 지하다

    for (let i = 0; i < 8; i += 1) {
      await S().checkSet(i, 4);
      await S().mark(i, 'done');
    }
    // ★ **여기가 고치려던 그 모습이다** — 여태 여덟 칸이 끝까지 1/8 이었다
    ok('여덟 칸이 다 지나갔다', S().session.done, 8);
    ok('  막대도 다 찼다 (current = -1)', S().session.current, -1);
    ok('  줄에 여덟 칸이 섰다', Object.keys(S().queue).length, 8);
    ok('  서버에는 아무것도 안 갔다', fake.calls.filter((c) => c.includes('routine-session')).length, 0);
    const last = await S().mark(7, 'done');
    ok('끝났다고 말해준다 (결산을 띄울 수 있다)', [!!last.queued, !!last.finished], [true, true]);

    // 앱을 닫았다 열어도 그대로 보인다 — 서버에서 진행표를 다시 받는 길
    console.log('');
    console.log('── 앱을 닫았다 열었다 ──');
    S().reset();
    ok('로그아웃·그만두기는 담아둔 줄도 지운다', [...ls.keys()].length, 0);

    ls.clear();
    smod.useRoutineSessionStore.setState({ server: BIG, session: BIG, queue: {}, loaded: true });
    await S().checkSet(2, 3);
    await S().mark(0, 'skip');
    const kept = [...ls.keys()].length;
    smod.useRoutineSessionStore.setState({ server: null, session: null, queue: {}, loaded: false });
    fake.cut = [];
    fake.bodies['/routine-session'] = { session: BIG };
    await S().fetch(true);
    ok('담아둔 줄이 남아 있다', kept, 1);
    ok('  다시 받으면 그 줄이 그대로 얹힌다', S().session.items[2].setsDone, 3);
    ok('  넘긴 칸도 그대로다', S().session.items[0].state, 'skip');
    ok('  진행 수도 그 줄을 세서 나온다', S().session.done, 1);

    // **다른 루틴을 시작했으면 앞 줄을 버린다** — 자리 번호의 뜻이 달라진다
    const OTHER = { ...BIG, routineId: 10, startedAt: '2026-11-04T19:00:00.000Z', items: EIGHT };
    smod.useRoutineSessionStore.setState({ server: null, session: null, queue: {}, loaded: false });
    fake.bodies['/routine-session'] = { session: OTHER };
    await S().fetch(true);
    ok('새 루틴에는 앞 줄이 안 얹힌다', S().session.items[2].setsDone, 0);

    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 신호가 돌아왔다 ──');
    ls.clear();
    S().reset();
    fake.reset();
    smod.useRoutineSessionStore.setState({ server: BIG, session: BIG, queue: {}, loaded: true });
    fake.cut = ['routine-session'];
    await S().checkSet(0, 4);
    await S().mark(0, 'done');
    await S().checkSet(1, 2);
    ok('줄에 두 칸이 섰다', Object.keys(S().queue).length, 2);

    fake.cut = [];
    fake.calls.length = 0;
    fake.bodies['/routine-session'] = { session: { ...BIG, done: 1, current: 1 } };
    const up = await S().flush();
    ok('**올라갔다**', [up.sent, up.failed, up.stopped], [2, 0, false]);
    ok('  줄이 비었다', Object.keys(S().queue).length, 0);
    // 세트 수를 **먼저**, 칸 넘김을 **나중에** 보낸다 — 넘긴 뒤에 세트를 보내면 튕긴다
    ok('  한 칸에 둘이 쌓였으면 세 번 보낸다 (4 · done · 2)',
      fake.calls.filter((c) => c === 'PATCH /routine-session').length, 3);

    // 서버가 거절한 칸은 **표시만** 하고 다음 칸으로 간다
    ls.clear();
    S().reset();
    smod.useRoutineSessionStore.setState({ server: BIG, session: BIG, queue: {}, loaded: true });
    fake.cut = ['routine-session'];
    await S().checkSet(0, 4);
    await S().checkSet(1, 4);
    fake.cut = [];
    let once = true;
    const realPatch = fake.patch;
    fake.patch = async (url, body) => {
      if (once && body && body.index === 0) { once = false; throw { response: { status: 400, data: { error: '잘못된 자리예요' } } }; }
      return realPatch(url, body);
    };
    const up2 = await S().flush();
    fake.patch = realPatch;
    ok('거절당한 칸은 표시만 한다', [up2.sent, up2.failed], [1, 1]);
    ok('  그 하나 때문에 뒤의 칸이 막히지 않는다', S().queue[0].failed, true);
    // 표시된 칸은 **사람이 누를 때까지** 다시 안 보낸다 (운동 줄과 같은 규칙)
    fake.calls.length = 0;
    const up2b = await S().flush();
    ok('  표시된 칸은 다시 올리지 않는다', [up2b.sent, fake.calls.length], [0, 0]);

    // 다른 기기가 다른 루틴을 시작했으면(409) **줄을 버리고 서버 것으로 간다**
    ls.clear();
    S().reset();
    smod.useRoutineSessionStore.setState({ server: BIG, session: BIG, queue: {}, loaded: true });
    fake.cut = ['routine-session'];
    await S().checkSet(3, 2);
    fake.cut = [];
    const FRESH = { ...BIG, routineId: 11, startedAt: '2026-11-05T09:00:00.000Z', items: EIGHT };
    fake.patch = async () => { throw { response: { status: 409, data: { error: '진행표가 바뀌었어요', session: FRESH } } }; };
    const up3 = await S().flush();
    fake.patch = realPatch;
    ok('409 면 멈춘다', up3.stopped, true);
    ok('  줄을 버린다 (자리 번호의 뜻이 달라졌다)', Object.keys(S().queue).length, 0);
    ok('  서버 것으로 갈아끼운다', S().session.routineId, 11);

    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 화면이 그 길을 쓰는가 ──');
    const train2 = codeOf(fs.readFileSync('src/pages/TrainPage.jsx', 'utf-8'));
    // 줄에 섰으면 **말이 달라야 한다** — 「못 올렸어요」가 아니다
    ok('담지 못한 때만 말한다', /res\?\.unsaved/.test(train2), true);
    ok('  신호 때문에 멈추지 않는다', /if \(!isOfflineError\(err\)\)/.test(train2), false);
    const layout = codeOf(fs.readFileSync('src/components/Layout.jsx', 'utf-8'));
    ok('신호가 돌아오면 진행표도 올린다', /useRoutineSessionStore\.getState\(\)\.flush\(\)/.test(layout), true);
    // 기록 · 메모와 **같은 자리**에서 올린다 (두 벌로 두면 한쪽만 고쳐진다)
    ok('  기록·메모와 같은 자리다',
      layout.indexOf('useNoteStore.getState().flushQueue()') < layout.indexOf('useRoutineSessionStore.getState().flush()'), true);
    const keys = codeOf(fs.readFileSync('src/data/localKeys.js', 'utf-8'));
    ok('줄 열쇠가 로그아웃 목록에 있다',
      /PER_USER_KEYS = \[[\s\S]*?SESSION_QUEUE_KEY[\s\S]*?\];/.test(keys), true);

    // ─────────────────────────────────────────────────────────────
    // **담은 뒤에 또 받는 자리** — 거기서 「저장 실패」를 말하면 거짓이 된다
    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 담는 일과 받는 일을 가르는가 ──');
    // 담기는 끝났는데 받기가 끊기면 「저장에 실패했어요」가 **거짓이다** — 그 말을
    // 들은 사람은 같은 것을 다시 적고, 기록이 **두 벌** 쌓인다. 홈트에서 이미 배운
    // 자리인데(`HomeworkoutPage` 머리글) 측정 길에는 안 닿아 있었다.
    //
    // 한 `try` 안에서 **쓰기 뒤에 읽기**가 또 오는 자리를 통째로 쓴다
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = dir + '/' + e.name;
      return e.isDirectory() ? walk(p) : (/\.jsx?$/.test(e.name) ? [p] : []);
    });
    const mixed = [];
    for (const p of walk('src')) {
      const src = codeOf(fs.readFileSync(p, 'utf-8'));
      const re = /try \{([\s\S]*?)\n\s*\} catch/g;
      let m;
      while ((m = re.exec(src))) {
        const body = m[1];
        const w = body.search(/await client\.(post|put|patch|delete)\(/);
        const g = body.search(/await client\.get\(/);
        if (w >= 0 && g > w) {
          mixed.push(p.replace('src/', '') + ':' + src.slice(0, m.index).split('\n').length);
        }
      }
    }
    ok('한 뭉치에서 담고 또 받는 자리가 없다', mixed, []);

    const measure = codeOf(fs.readFileSync('src/pages/MeasurePage.jsx', 'utf-8'));
    // 담기가 끝난 뒤의 말은 **「저장했다」**여야 한다
    ok('측정: 목록을 못 받아도 저장했다고 말한다', /저장했어요 — 목록은 못 받아왔어요/.test(measure), true);
    ok('  신호가 없으면 그렇게 말한다', /신호가 없어 저장하지 못했어요/.test(measure), true);
    // 서버가 「그렇게는 안 받는다」고 답한 것은 그 말을 그대로 전한다 (어제 세운 선)
    ok('  서버가 한 말을 그대로 전한다', /err\.response\?\.data\?\.error \|\| '저장에 실패했어요'/.test(measure), true);

    // ─────────────────────────────────────────────────────────────
    // **서버가 적어 보낸 까닭을 버리지 않는가**
    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 왜 안 되는지 말해주는가 ──');
    // 서버는 쓰는 길마다 **까닭**을 적어 보낸다 — 「세트는 1~100 범위여야 해요
    // (벤치프레스: 999999)」 · 「이 서버는 아직 알림을 보낼 수 없어요 (키 설정 전)」.
    // 그 말을 「못 했어요」로 덮으면 사람은 무엇을 고쳐야 하는지 모른 채 다시 누른다.
    //
    // 11/04 에 **열한 자리**가 그러고 있었다 — 그중 둘은 **같은 파일의 바로 옆 함수가
    // 그 말을 쓰고 있었다**(`RoutinePage` · `RemindersPage`). 한 벌만 고치면 갈린다
    const dropped = [];
    for (const p of walk('src')) {
      const src = codeOf(fs.readFileSync(p, 'utf-8'));
      const re = /try \{([\s\S]*?)\n(\s*)\} catch(?: \(([A-Za-z_]+)\))? \{([\s\S]*?)\n\2\}/g;
      let m;
      while ((m = re.exec(src))) {
        const body = m[1];
        const caught = m[4];
        // 쓰는 길만 본다 — 읽기가 실패한 것은 사람이 고칠 것이 없다
        if (!/await client\.(post|put|patch|delete)\(/.test(body)) continue;
        // 서버 말을 쓰고 있으면 됐다
        if (/response\?\.data|response\.data/.test(caught)) continue;
        // 사람에게 아무 말도 안 하는 자리는 다른 일이다 (조용히 넘기는 것이 맞는 자리가 있다)
        if (!/toast\(|setError\(/.test(caught)) continue;
        dropped.push(p.replace('src/', '') + ':' + src.slice(0, m.index).split('\n').length);
      }
    }
    ok('서버가 한 말을 버리는 자리가 없다', dropped, []);

    console.log('');
    if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
    console.log('다 통과');
  } catch (err) {
    console.log('터졌다: ' + (err && err.stack || err));
    process.exit(1);
  } finally {
    for (const p of [fakePath, sessPath]) { try { fs.unlinkSync(p); } catch {} }
  }
})();
