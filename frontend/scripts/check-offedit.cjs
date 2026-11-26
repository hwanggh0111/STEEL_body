// **지하에서 적은 줄을 고치거나 지운 것이 서버까지 가는가** (2026-11-26 · 정석)
//
//   node scripts/check-offedit.cjs            (npm run check 가 찾아서 돈다)
//   node scripts/check-offedit.cjs --되돌려    옛 꼴을 먹여 **빨개지는지** 본다
//
// ── 왜 이 자가 생겼나 ──
//
// TODO 11/26 높음 1 (근호가 코드를 따라가 확인한 것) —
//
//   지하에서 적은 줄은 화면에 `local-…` id 로 그려진다. 그 줄이 신호가 돌아와
//   **올라가면 서버 번호가 생기는데**, 수정 칸을 먼저 열어둔 사람 손에는 **옛 로컬
//   id** 가 남는다. 그 손으로 80 을 85 로 고치면 — 화면은 「아직 안 올라간 것」으로
//   보고 **줄에서만** 고쳤고, 줄에는 이미 없으니 `editInQueue` 는 **아무것도 못 찾고**
//   그대로 `{ queued: true }` 를 돌려줬다. **서버는 80, 오류도 없다.**
//
// 지우기는 더 나쁘다 — 줄에서만 빼고 끝나서 **서버 줄이 남고, 다음 받기에서
// 지운 줄이 되살아난다.**
//
// ★ **같은 류를 메모에서도 닫았다** — `noteStore.removeNote` 가
// `serverId === null || isLocalNoteId(note.id)` 였다. `||` 라서 **서버 번호를 아는데도**
// 손에 든 옛 딱지가 이겼다. 「아는 사실이 손에 든 딱지를 이긴다」가 이 자의 뼈대다.
//
// ── 무엇을 보는가 ──
//
//   1 줄에 **없는** 로컬 id 로 고치면 PUT 이 서버로 간다 (지우면 DELETE)
//   2 줄에 **있는** 것은 여태처럼 줄에서 고친다 (서버에 안 간다)
//   3 **올리는 중**에 고치면 올라간 뒤 그 값으로 한 번 더 보낸다 (옛 값이 남지 않는다)
//   4 **올리는 중**에 지우면 올라간 뒤 서버에서 지운다 (줄만 비우고 끝내지 않는다)
//   5 **올리기 전**에 지운 줄은 올리지 않는다 (지운 줄이 서버에 생기지 않는다)
//   6 지운 줄은 화면에 안 그려지고 **세지도 않는다** (「1개 올리는 중」이 안 남는다)
//   7 메모 — 서버 번호를 알면 서버에서 지운다
//   8 올릴 때 **적은 시각**을 같이 보낸다 (TODO 11/26 ④ — 「올린 시각」으로 찍히면
//     `data/pace.js` 가 그 날을 「몰아 적은 날」로 보고 운동 시간 줄을 지운다)
//
// 저장소는 **진짜로 돌린다** (`check-todo1126` 과 같은 결) — 가짜 client 는 답을
// 손에 들고 있다가 시킬 때 내려놓아 **올리는 중**이라는 틈을 만든다.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const 되돌림 = process.argv.includes('--되돌려');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
  return pass;
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

// ── 가짜 client ──
//
// 답은 **method + 주소**로 찾는다 — POST 가 돌려주는 몸통(담은 줄)과 GET 이 돌려주는
// 몸통(목록 배열)이 같은 주소에 있어서, 주소만으로 고르면 한쪽이 다른 쪽을 먹는다.
const fakePath = path.resolve('.offedit-client.cjs');
made.push(fakePath);
fs.writeFileSync(fakePath, `
const held = [];
const M = {
  hold: false, bodies: {}, calls: [], sent: [],
  reset() { M.hold = false; M.calls.length = 0; M.sent.length = 0; held.length = 0; },
  bodyOf(method, url) { const c = M.sent.find((x) => x.method === method && x.url === url); return c ? c.body : null; },
  waiting() { return held.length; },
  release() { const q = held.splice(0); for (const r of q) r(); },
  _go(method, url, body) {
    M.calls.push(method + ' ' + url);
    M.sent.push({ method, url, body });
    const key = method + ' ' + String(url).split('?')[0];
    const data = M.bodies[key];
    const answer = { data: data === undefined ? null : data, status: 200, headers: {} };
    if (!M.hold) return Promise.resolve(answer);
    return new Promise((res) => held.push(() => res(answer)));
  },
  get(u) { return M._go('GET', u); },
  post(u, b) { return M._go('POST', u, b); },
  put(u, b) { return M._go('PUT', u, b); },
  patch(u, b) { return M._go('PATCH', u, b); },
  delete(u) { return M._go('DELETE', u); },
};
module.exports = M;
module.exports.default = M;
`, 'utf-8');
const fake = require(fakePath);

const sessPath = path.resolve('.offedit-session.cjs');
made.push(sessPath);
esbuild.buildSync({ entryPoints: ['src/store/session.js'], bundle: true, format: 'cjs',
  outfile: sessPath, platform: 'node', logLevel: 'silent' });

// ── ★ **옛 꼴은 소스를 되돌려 먹인다** ──
//
// 식(정규식)으로 「고친 자리가 아직 있나」를 보는 자가 아니다 — **돌려 보는** 자다.
// 되돌려-FAIL 도 그래야 뜻이 있다: 고침을 **지운 소스**를 지어 같은 판을 돌리고,
// 그 판정이 빨개지는지 본다. 11/24 에 과녁을 잘못 적어 「전부 통과」가 났던 자리의
// 되풀이를 막는 길이 이것이다 (`[[shell-eats-backslash]]`).
const 되돌림꼴 = {
  '고치기가 줄만 본다': { file: 'store/workoutStore.js', cases: ['1고침'],
    from: 'if (item && !item.removed) {', to: 'if (true) {' },
  '지우기가 줄만 본다': { file: 'store/workoutStore.js', cases: ['1지움'],
    from: 'const item = findInQueue(get().queue, id);\n      if (item) {',
    to:   'const item = findInQueue(get().queue, id) || {};\n      if (item) {' },
  '올린 뒤의 손을 안 본다': { file: 'store/workoutStore.js', cases: ['3', '4'],
    from: 'const after = findInQueue(get().queue, item.id);', to: 'const after = null;' },
  '올리기 전에 다시 안 본다': { file: 'store/workoutStore.js', cases: ['5'],
    from: 'const live = findInQueue(get().queue, item.id);', to: 'const live = item;' },
  '지운 줄을 그린다': { file: 'data/offline.js', cases: ['6'],
    from: '    if (q.removed) continue;', to: '' },
  // ★ 그리는 자리와 **세는 자리가 다른 줄**이다 — 한 꼴로 둘을 보려다 「그리기」만
  // 빨개지는 것을 봤다(세기는 그대로 통과했다). 그래서 꼴을 둘로 가른다
  '지운 줄을 센다': { file: 'data/offline.js', cases: ['6'],
    from: "const list = (Array.isArray(queue) ? queue : []).filter(q => q && !q.removed);",
    to:   'const list = Array.isArray(queue) ? queue : [];' },
  '적은 시각을 안 보낸다': { file: 'store/workoutStore.js', cases: ['8'],
    from: '{ ...live.payload, clientKey: item.id, createdAt: live.at });',
    to:   '{ ...live.payload, clientKey: item.id });' },
  '메모가 옛 딱지를 믿는다': { file: 'store/noteStore.js', cases: ['7'],
    from: 'if (serverId === null) {',
    to:   "if (serverId === null || String(note.id).startsWith('local-note-')) {" },
};

let 되돌릴것 = null;   // { file, from, to }
const swap = {
  name: 'swap-client',
  setup(build) {
    build.onResolve({ filter: /api[/]client$/ }, () => ({ path: fakePath, external: true }));
    build.onResolve({ filter: /store[/]session$|^[.][/]session$/ }, () => ({ path: sessPath, external: true }));
    // 되돌릴 파일 하나만 소스를 바꿔 먹인다
    build.onLoad({ filter: /\.jsx?$/ }, (args) => {
      if (!되돌릴것) return null;
      const want = path.normalize('src/' + 되돌릴것.file);
      if (!path.normalize(args.path).endsWith(want)) return null;
      const src = fs.readFileSync(args.path, 'utf-8');
      if (!src.includes(되돌릴것.from)) {
        throw new Error('되돌릴 자리를 못 찾았다 — ' + 되돌릴것.file + ' : ' + 되돌릴것.from.slice(0, 40));
      }
      return { contents: src.replace(되돌릴것.from, 되돌릴것.to), loader: 'jsx' };
    });
  },
};

let seq = 0;
const load = async (entry) => {
  const out = '.offedit-' + (seq += 1) + '.cjs';
  await esbuild.build({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node',
    define: { 'import.meta.env': '{}' }, plugins: [swap], logLevel: 'silent' });
  const full = path.resolve(out);
  delete require.cache[full];
  const m = require(full);
  fs.unlinkSync(full);
  return m;
};
const tick = (n = 1) => new Promise((r) => setTimeout(r, n));

const DAY = '2026-11-26';
const 일 = { date: DAY, exercise: '벤치프레스', weight: '80', sets: 1, reps: 10 };

// ── 판 하나 ──
//
// `which` 에 적힌 것만 돈다 (되돌려는 그 꼴이 건드린 자리만 본다).
// 돌린 판정의 통과 여부를 모아 돌려준다 — 되돌려는 **하나라도 FAIL 해야** 통과다
async function 판(which) {
  const 돈다 = (n) => !which || which.includes(n);
  const 본것 = [];
  const 봄 = (name, got, want) => { 본것.push(ok(name, got, want)); };

  const W = await load('src/store/workoutStore.js');
  const O = await load('src/data/offline.js');
  const store = () => W.useWorkoutStore.getState();
  const 비움 = () => {
    ls.clear();
    store().apply({}, []);
    W.useWorkoutStore.setState({ flushing: false, online: true, unsaved: false, tooFastUntil: 0 });
    fake.reset();
    fake.bodies = {
      'GET /workouts': [],
      'POST /workouts': { id: 7, workout: { id: 7, date: DAY, exercise: '벤치프레스', weight: '80', sets: 1, reps: 10, created_at: DAY + 'T10:00:00.000Z' }, tag: 'W/"t7"' },
      'PUT /workouts/7': { message: '수정 완료!' },
      'PUT /workouts/local-a': { message: '수정 완료!' },
      'DELETE /workouts/7': { tag: 'W/"t8"', message: '삭제 완료!' },
      'DELETE /workouts/local-a': { tag: 'W/"t8"', message: '삭제 완료!' },
    };
  };

  // ── 1 줄에 없는 로컬 id ──
  if (돈다('1고침')) {
    console.log('── 1 줄에 없는 로컬 id 로 고치면 ──');
    비움();
    // 그 사이 올라가서 줄은 비었고, 서버에는 그 줄이 번호를 달고 있다
    store().apply({ [DAY]: [{ id: 7, ...일, created_at: DAY + 'T10:00:00.000Z' }] }, []);
    const r = await store().updateWorkout('local-a', { ...일, weight: '85' }).catch((e) => ({ err: String(e) }));
    봄('**서버로 간다** (PUT)', fake.calls.filter((c) => c.startsWith('PUT /workouts/local-a')).length, 1);
    봄('  「담았어요」라고 거짓말하지 않는다', !r?.queued, true);
  }

  if (돈다('1지움')) {
    console.log('── 1 줄에 없는 로컬 id 로 지우면 ──');
    비움();
    store().apply({ [DAY]: [{ id: 7, ...일, created_at: DAY + 'T10:00:00.000Z' }] }, []);
    await store().deleteWorkout('local-a').catch(() => {});
    봄('**서버에서 지운다** (DELETE)', fake.calls.filter((c) => c === 'DELETE /workouts/local-a').length, 1);
    봄('  지운 뒤 목록을 다시 받는다', fake.calls.includes('GET /workouts'), true);
  }

  // ── 2 줄에 있는 것은 줄에서 ──
  if (돈다('2')) {
    console.log('── 2 줄에 있는 것은 여태처럼 줄에서 고친다 ──');
    비움();
    const item = O.makeQueued(일, 1764100000000, 0.5);
    store().apply({}, [item]);
    const r = await store().updateWorkout(item.id, { ...일, weight: '85' });
    봄('서버에 안 간다', fake.calls.length, 0);
    봄('  줄의 값이 바뀌었다', store().queue[0].payload.weight, '85');
    봄('  고침 횟수가 올라간다 (`rev`)', store().queue[0].rev, 1);
    봄('  「담았어요」로 답한다', r.queued, true);
  }

  // ── 3 올리는 중에 고쳤다 ──
  if (돈다('3')) {
    console.log('── 3 올리는 중에 고치면 ──');
    비움();
    const item = O.makeQueued(일, 1764100000000, 0.5);
    store().apply({}, [item]);
    fake.hold = true;
    const flushing = store().flushQueue();
    await tick();          // POST 가 떠서 손에 들려 있다
    봄('POST 가 날아가 있다', fake.waiting(), 1);
    await store().updateWorkout(item.id, { ...일, weight: '85' });
    fake.hold = false;
    fake.release();
    await flushing;
    await tick(2);
    봄('**고친 값으로 한 번 더 보낸다** (PUT · 서버 번호로)',
      fake.calls.filter((c) => c === 'PUT /workouts/7').length, 1);
    봄('  보낸 것이 고친 값이다', fake.bodyOf('PUT', '/workouts/7')?.weight, '85');
    봄('  줄은 비었다', store().queue.length, 0);
  }

  // ── 4 올리는 중에 지웠다 ──
  if (돈다('4')) {
    console.log('── 4 올리는 중에 지우면 ──');
    비움();
    const item = O.makeQueued(일, 1764100000000, 0.5);
    store().apply({}, [item]);
    fake.hold = true;
    const flushing = store().flushQueue();
    await tick();
    await store().deleteWorkout(item.id);
    봄('  줄에서 빼지 않고 적어둔다', store().queue.length, 1);
    봄('  화면에는 안 그려진다', (store().workouts[DAY] || []).length, 0);
    fake.hold = false;
    fake.release();
    await flushing;
    await tick(2);
    봄('**올라간 줄을 서버에서 지운다** (DELETE · 서버 번호로)',
      fake.calls.filter((c) => c === 'DELETE /workouts/7').length, 1);
    봄('  줄이 비었다', store().queue.length, 0);
  }

  // ── 5 올리기 전에 지웠다 ──
  if (돈다('5')) {
    console.log('── 5 앞 줄을 올리는 사이에 뒤 줄을 지우면 ──');
    비움();
    const a = O.makeQueued(일, 1764100000000, 0.5);
    const b = O.makeQueued({ ...일, exercise: '스쿼트' }, 1764100001000, 0.6);
    store().apply({}, [a, b]);
    fake.hold = true;
    const flushing = store().flushQueue();
    await tick();
    await store().deleteWorkout(b.id);     // 아직 안 올라간 뒤 줄
    fake.hold = false;
    fake.release();
    await flushing;
    await tick(2);
    봄('**지운 줄은 올리지 않는다** (POST 는 한 번)',
      fake.calls.filter((c) => c === 'POST /workouts').length, 1);
    봄('  지운 줄을 서버에서 또 지우러 가지 않는다',
      fake.calls.filter((c) => c.startsWith('DELETE')).length, 0);
    봄('  줄이 비었다', store().queue.length, 0);
  }

  // ── 6 지운 줄은 그리지도 세지도 않는다 ──
  if (돈다('6')) {
    console.log('── 6 지웠다고 적어둔 줄 ──');
    const q = [{ ...O.makeQueued(일, 1764100000000, 0.5), removed: true }];
    봄('화면에 안 그린다', Object.keys(O.mergeQueue({}, q)).length, 0);
    봄('**세지 않는다** (「1개 올리는 중」이 안 남는다)',
      O.offlineStatus({ online: true, queue: q }), null);
  }

  // ── 8 올릴 때 적은 시각을 싣는다 ──
  if (돈다('8')) {
    console.log('── 8 올리는 길이 **적은 시각**을 싣는가 ──');
    비움();
    // 지하에서 10:00 에 적었다. 신호는 그보다 한참 뒤에 돌아온다
    const 적은때 = Date.parse(DAY + 'T01:00:00.000Z');   // 지하에서 적은 그 순간
    const item = O.makeQueued(일, 적은때, 0.5);
    store().apply({}, [item]);
    await store().flushQueue();
    await tick(2);
    봄('**적은 순간을 보낸다** (받은 순간이 아니다)',
      fake.bodyOf('POST', '/workouts')?.createdAt, new Date(적은때).toISOString());
    봄('  줄이 들고 있던 그 값이다 (`makeQueued` 의 `at`)',
      fake.bodyOf('POST', '/workouts')?.createdAt, item.at);
  }

  // ── 7 메모도 같은 류 ──
  if (돈다('7')) {
    console.log('── 7 메모 — 서버 번호를 알면 서버에서 지운다 ──');
    fake.reset();
    fake.bodies = { 'DELETE /notes/5': { message: '삭제 완료!' }, 'GET /notes': {} };
    const N = await load('src/store/noteStore.js');
    N.useNoteStore.setState({ server: { [DAY]: { id: 5, date: DAY, body: '어깨가 아팠다' } }, queue: {} });
    await N.useNoteStore.getState().removeNote({ id: 'local-note-' + DAY, date: DAY }).catch(() => {});
    봄('**서버에서 지운다** — 손에 든 `local-note-…` 가 이기지 않는다',
      fake.calls.filter((c) => c === 'DELETE /notes/5').length, 1);
  }

  return 본것;
}

(async () => {
  try {
    if (!되돌림) {
      await 판(null);
      console.log('');
      if (bad > 0) { console.log(bad + '건 FAIL'); process.exit(1); }
      console.log('모두 통과');
      process.exit(0);
    }

    // ── 되돌려-FAIL ──
    console.log('── 되돌려-FAIL: 고침을 지운 소스를 먹여 빨개지는지 본다 ──');
    let 샌것 = 0;
    for (const [이름, 꼴] of Object.entries(되돌림꼴)) {
      console.log('');
      console.log('■ ' + 이름 + ' (' + 꼴.file + ')');
      되돌릴것 = 꼴;
      const 전 = bad;
      const 본것 = await 판(꼴.cases);
      되돌릴것 = null;
      const 떴다 = bad > 전;
      if (본것.length === 0) { console.log('  ⚠ 아무 판정도 안 돌았다 — 과녁이 비었다'); 샌것 += 1; continue; }
      if (떴다) console.log('  → FAIL 떴다 (자가 잡는다)');
      else { console.log('  → ★ 안 떴다 — **이 자는 그 자리를 못 본다**'); 샌것 += 1; }
      bad = 전;   // 되돌려의 FAIL 은 셈에서 뺀다 (그것이 통과다)
    }
    console.log('');
    if (샌것 > 0) { console.log(샌것 + '꼴을 못 잡는다'); process.exit(1); }
    console.log('되돌려 ' + Object.keys(되돌림꼴).length + '꼴 다 잡는다');
    process.exit(0);
  } catch (err) {
    console.error('터짐:', err);
    process.exit(1);
  }
})();
