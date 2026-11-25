// **11/26 고칠 것(근호 전체 점검)의 ⑤ · ⑥ · ⑩ · ⑪ · ⑫ 를 값으로 지킨다** (2026-11-25 · 근호).
//
//   node scripts/check-todo1126.cjs      (npm run check 에도 들어 있다 — 찾아서 돈다)
//
// ── 무엇을 보는가 ──
//
//   ⑫ 그날 안에서 **가장 늦게 적은 줄**을 고른다 — 서버는 최신이 앞, 못 올린 줄은 뒤에
//      오래된 것부터 붙는다. 「지난번 무게」 · 「지난번 메모」가 첫 세트 · 옛 메모를 집지 않는가
//   ⑥ 메모 올리기가 **사람이 바뀌면 멈추는가** — 앞 사람 메모가 새 사람 쿠키로 안 가는가
//   ⑤ 루틴 진행 칸 — 기기에 담아둔 칸을 `fetch` 가 읽은 **바로 뒤에** 올리는가
//   ⑩ · ⑪ 화면 손 — 루틴에 더하기가 저장 중 잠금을 거는가 · 계획 담기가 「담겼나」를 답하고
//      시트가 그 답을 보고서야 글을 지우는가 (화면을 띄울 수 없어 그 손의 줄을 본다)
//
// 저장소는 **진짜로 돌린다** — `check-handoff` 와 같은 가짜 client · 한 사본 세대를 쓴다.
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
global.window = { addEventListener() {}, removeEventListener() {}, location: { href: '/' } };
global.document = { cookie: '' };

const made = [];
process.on('exit', () => { for (const f of made) { try { fs.unlinkSync(f); } catch { /* 없어도 된다 */ } } });

// ── 가짜 client — 답을 손에 들고 있다가 시킬 때 내려놓는다 ──
const fakePath = path.resolve('.todo1126-client.cjs');
made.push(fakePath);
fs.writeFileSync(fakePath, `
const held = [];
module.exports = {
  hold: false, bodies: {}, calls: [],
  release() { const q = held.splice(0); for (const r of q) r(); },
  _go(method, url, body) {
    module.exports.calls.push(method + ' ' + url + (body && body.body ? ' ' + body.body : ''));
    const data = module.exports.bodies[String(url).split('?')[0]];
    const answer = { data: data === undefined ? null : data, status: 200, headers: {} };
    if (!module.exports.hold) return Promise.resolve(answer);
    return new Promise((res) => held.push(() => res(answer)));
  },
  get(u) { return module.exports._go('GET', u); },
  post(u, b) { return module.exports._go('POST', u, b); },
  put(u, b) { return module.exports._go('PUT', u, b); },
  patch(u, b) { return module.exports._go('PATCH', u, b); },
  delete(u) { return module.exports._go('DELETE', u); },
};
module.exports.default = module.exports;
`, 'utf-8');
const fake = require(fakePath);

const sessPath = path.resolve('.todo1126-session.cjs');
made.push(sessPath);
esbuild.buildSync({ entryPoints: ['src/store/session.js'], bundle: true, format: 'cjs',
  outfile: sessPath, platform: 'node', logLevel: 'silent' });
const sess = require(sessPath);

const swap = {
  name: 'swap-client',
  setup(build) {
    build.onResolve({ filter: /api[/]client$/ }, () => ({ path: fakePath, external: true }));
    build.onResolve({ filter: /store[/]session$|^[.][/]session$/ }, () => ({ path: sessPath, external: true }));
  },
};
const load = async (entry, out) => {
  await esbuild.build({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node',
    define: { 'import.meta.env': '{}' }, plugins: [swap], logLevel: 'silent' });
  const m = require(path.resolve(out));
  fs.unlinkSync(out);
  return m;
};
const tick = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  try {
    // ─────────────────────────────────────────────────────────────
    console.log('── ⑫ 그날 안에서 가장 늦게 적은 줄 ──');
    const L = await load('src/data/lastSets.js', '.todo-last.cjs');
    const T = (hh) => `2026-11-20T${hh}:00:00.000Z`;
    // 서버 차례(최신이 앞) — 메모 둘
    const served = { '2026-11-20': [
      { id: 3, exercise: '벤치프레스', weight: '85', note: '새 메모', created_at: T('11') },
      { id: 2, exercise: '벤치프레스', weight: '80', note: '옛 메모', created_at: T('10') },
    ] };
    ok('지난번 메모는 그날 **가장 늦은** 메모다 (서버 차례)',
      L.lastNoteOf(served, '벤치프레스', '2026-11-25', '2026-11-25')?.note, '새 메모');
    ok('지난번 무게도 가장 늦은 줄이다 (서버 차례)',
      L.lastRecordOf(served, '벤치프레스', '2026-11-25', '2026-11-25')?.weight, '85');
    // 지하에서만 적은 날 — 못 올린 줄은 오래된 것부터 붙는다(mergeQueue)
    const queued = { '2026-11-21': [
      { id: 'local-1', exercise: '스쿼트', weight: '80', created_at: '2026-11-21T10:00:00.000Z', pending: true },
      { id: 'local-2', exercise: '스쿼트', weight: '85', created_at: '2026-11-21T10:05:00.000Z', pending: true },
    ] };
    ok('**지하에서만 적은 날**은 첫 세트가 아니라 마지막 세트 무게다',
      L.lastRecordOf(queued, '스쿼트', '2026-11-25', '2026-11-25')?.weight, '85');
    // 섞인 날 — 서버 줄(앞) + 그보다 늦은 못 올린 줄(뒤)
    const mixed = { '2026-11-22': [
      { id: 9, exercise: '데드리프트', weight: '100', created_at: '2026-11-22T09:00:00.000Z' },
      { id: 'local-9', exercise: '데드리프트', weight: '110', created_at: '2026-11-22T09:30:00.000Z', pending: true },
    ] };
    ok('섞인 날은 더 늦게 적은 못 올린 줄을 집는다',
      L.lastRecordOf(mixed, '데드리프트', '2026-11-25', '2026-11-25')?.weight, '110');
    // 시각이 없는 옛 줄뿐이면 서버 차례(앞이 최신)를 믿는다
    const noTime = { '2026-11-23': [
      { id: 5, exercise: '로우', weight: '50' }, { id: 4, exercise: '로우', weight: '45' },
    ] };
    ok('시각이 없는 줄뿐이면 앞 줄(서버 최신)을 쓴다',
      L.lastRecordOf(noTime, '로우', '2026-11-25', '2026-11-25')?.weight, '50');
    ok('  드롭 줄은 여전히 건너뛴다',
      L.lastRecordOf({ '2026-11-24': [
        { id: 7, exercise: '컬', weight: '10', link: 'drop', created_at: T('12') },
        { id: 6, exercise: '컬', weight: '14', created_at: T('11') },
      ] }, '컬', '2026-11-25', '2026-11-25')?.weight, '14');

    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── ⑥ 메모 올리기: 올리는 중에 사람이 바뀐다 ──');
    const N = await load('src/store/noteStore.js', '.todo-note.cjs');
    const S = () => N.useNoteStore.getState();
    N.useNoteStore.setState({
      queue: {
        '2026-11-01': { op: 'save', body: 'A-첫째', at: '2026-11-01T01:00:00.000Z', failed: false, error: null },
        '2026-11-02': { op: 'save', body: 'A-둘째', at: '2026-11-02T01:00:00.000Z', failed: false, error: null },
      },
      flushing: false,
    });
    fake.calls.length = 0;
    fake.hold = true;
    const p = S().flushQueue();
    await tick();
    ok('첫 메모를 보냈다 (모집단 0 을 통과로 내보내지 않는다)', fake.calls.filter((c) => c.startsWith('POST /notes')).length, 1);
    sess.newSession();               // A 가 나가고 B 가 들어왔다
    fake.hold = false;
    fake.release();
    const res = await p;
    ok('**사람이 바뀐 뒤에는 남은 메모를 안 보낸다**',
      fake.calls.filter((c) => c.includes('A-둘째')).length, 0);
    ok('  멈췄다고 답한다', res.stopped, true);

    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── ⑤ 루틴 진행 칸: 다시 켠 뒤 담아둔 칸을 올린다 ──');
    const keys = await load('src/data/localKeys.js', '.todo-keys.cjs');
    const OS = await load('src/data/offlineSession.js', '.todo-os.cjs');
    const R = await load('src/store/routineSessionStore.js', '.todo-rs.cjs');
    const startedAt = '2026-11-25T10:00:00.000Z';
    const session = { routineId: 1, name: '상체 A', startedAt,
      items: [{ name: '벤치', state: 'todo', setsDone: 0 }, { name: '로우', state: 'todo', setsDone: 0 }] };
    // 지하에서 첫 칸을 「했다」로 눌러 기기에 담아 둔 채로 앱을 닫았다
    OS.saveSessionQueue(OS.queueState({}, 0, 'done'), startedAt);
    ok('기기에 담겨 있다', ls.has(keys.SESSION_QUEUE_KEY), true);
    fake.bodies['/routine-session'] = { session };
    fake.calls.length = 0;
    // 켤 때의 올리기는 fetch 보다 먼저 돈다 — 그때 줄은 비어 있다
    const early = await R.useRoutineSessionStore.getState().flush();
    ok('  (켤 때 올리기는 빈 줄을 본다 — 이것이 그 틈이다)', early.sent, 0);
    await R.useRoutineSessionStore.getState().fetch();
    for (let i = 0; i < 5; i += 1) await tick();
    ok('**읽은 바로 뒤에 담아둔 칸을 서버에 보낸다**',
      fake.calls.some((c) => c.startsWith('PATCH /routine-session')), true);

    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── ⑩ · ⑪ 화면 손 ──');
    const rp = fs.readFileSync('src/pages/RoutinePage.jsx', 'utf-8');
    const add = rp.slice(rp.indexOf('const addToRoutine'), rp.indexOf('const deleteMyRoutine'));
    ok('루틴에 더하기를 찾았다', add.length > 0, true);
    ok('⑩ 저장 중이면 또 안 받는다', /if \(savingRoutine\) return/.test(add), true);
    ok('  저장 중 잠금을 걸고 · 끝나면 푼다',
      /setSavingRoutine\(true\)/.test(add) && /finally\s*\{\s*setSavingRoutine\(false\)/.test(add), true);
    const hp = fs.readFileSync('src/pages/HistoryPage.jsx', 'utf-8');
    const ap = hp.slice(hp.indexOf('const addPlan'), hp.indexOf('const removePlan'));
    ok('⑪ 계획 담기가 「담겼나」를 답한다 (성공 true · 실패 false)',
      /return true;/.test(ap) && /return false;/.test(ap), true);
    const ds = fs.readFileSync('src/components/DaySheet.jsx', 'utf-8');
    const ae = ds.slice(ds.indexOf('const addExercise'), ds.indexOf('return (', ds.indexOf('const addExercise')));
    ok('  시트는 답을 보고서야 글을 지운다', /\.then\(\(ok\)/.test(ae) && !/\n\s*setName\(''\);/.test(ae), true);

    console.log('');
    if (bad > 0) { console.log(bad + '건 FAIL'); process.exit(1); }
    console.log('모두 통과');
    process.exit(0);
  } catch (err) {
    console.error('터짐:', err);
    process.exit(1);
  }
})();
