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
  get saved() { return saved; },
  reset() { saved = []; module.exports.cut = []; },
  _down(url) { return module.exports.cut.some((c) => String(url).includes(c)); },
  async get(url) { if (module.exports._down(url)) throw offline(); return { data: url.includes('routine-session') ? { session: null } : [] }; },
  async post(url, body) {
    if (module.exports._down(url)) throw offline();
    const row = { ...body, id: nextId++, date: body?.date, created_at: '2026-11-04T10:00:00.000Z' };
    saved.push(row);
    return { data: { workout: row, tag: 'W/"t' + row.id + '"' } };
  },
  async patch(url) { if (module.exports._down(url)) throw offline(); return { data: { session: null } }; },
  async put(url) { if (module.exports._down(url)) throw offline(); return { data: {} }; },
  async delete(url) { if (module.exports._down(url)) throw offline(); return { data: {} }; },
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
    const ITEMS = [{ name: '벤치프레스', sets: 4, reps: 10, state: 'todo', setsDone: 0 }];
    smod.useRoutineSessionStore.setState({ session: { routineId: 1, items: ITEMS, current: 0 }, loaded: true });

    fake.cut = ['routine-session'];
    let threw = null;
    try { await S().checkSet(0, 1); } catch (e) { threw = e; }
    // 못 올린 것은 알려야 한다 — 화면이 그것으로 「기록은 기기에 적는다」를 말한다
    ok('못 올렸다고 알린다 (던진다)', !!threw, true);
    ok('  신호 문제로 알아본다', off.isOfflineError(threw), true);
    // ★ **되돌리지 않는다** — 되돌리면 사람이 한 세트가 화면에서 사라진다
    ok('**눌린 세트가 화면에 남는다**', S().session.items[0].setsDone, 1);
    await S().checkSet(0, 2).catch(() => {});
    ok('  또 눌러도 쌓인다', S().session.items[0].setsDone, 2);

    // 서버가 「안 된다」고 말한 것은 되돌린다 (다시 눌러야 하는 자리다)
    smod.useRoutineSessionStore.setState({ session: { routineId: 1, items: ITEMS, current: 0 }, loaded: true });
    fake.cut = [];
    const bad400 = { response: { status: 400, data: { error: '세트 수가 올바르지 않아요' } } };
    const origPatch = fake.patch;
    fake.patch = async () => { throw bad400; };
    await S().checkSet(0, 3).catch(() => {});
    ok('서버가 거절한 것은 되돌린다', S().session.items[0].setsDone, 0);
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
    smod.useRoutineSessionStore.setState({ session: { routineId: 1, items: ITEMS, current: 0 }, loaded: true });
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
    const train = codeOf(fs.readFileSync('src/pages/TrainPage.jsx', 'utf-8'));
    // **여기가 오늘의 버그다.** 신호 문제인데 돌아서면 뒤의 저장까지 안 간다
    ok('신호 문제면 돌아서지 않는다', /if \(!isOfflineError\(err\)\) \{/.test(train), true);
    ok('  그냥 돌아서던 모양이 아니다',
      /catch \{\s*toast\('체크하지 못했어요[^]*?return;/.test(train.replace(/\s+/g, ' ')), false);
    // 조용히 두면 사람은 저장이 안 된 줄 알고 **또 적는다**
    ok('칸을 못 넘겼으면 말해준다',
      /진행표는 안 넘어갔어요/.test(train), true);
    ok('  서버가 거절한 것은 여태처럼 다시 누르라고 한다',
      /체크하지 못했어요\. 다시 눌러주세요/.test(train), true);

    const store = codeOf(fs.readFileSync('src/store/routineSessionStore.js', 'utf-8'));
    ok('스토어가 신호 문제를 가른다', /isOfflineError\(err\)/.test(store), true);
    // 되돌리는 줄이 신호 문제보다 **뒤**에 있어야 한다 (앞에 있으면 먼저 되돌린다)
    ok('  되돌리기는 그 뒤에 있다',
      store.indexOf('isOfflineError(err)') < store.indexOf('set({ session: prev })'), true);

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
