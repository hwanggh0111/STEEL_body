// **나간 뒤에 앞 사람 것이 다시 꽂히지 않는가** (2026-11-04).
//
//   npm run handoff     (npm run check 에도 들어 있다)
//
// ── 무엇을 보는가 ──
//
// 저장소들은 다 「기다린 뒤에 꽂는다」로 생겼고, 로그아웃은 「기다린 뒤에 비운다」로
// 생겼다(`authStore.logout` 이 `/auth/logout` 을 먼저 기다린다). **그 둘의 차례가
// 뒤집히면** 비우기가 먼저 끝나고 날아가 있던 답이 그 뒤에 내려앉는다 —
// 다음에 로그인한 사람 화면에 **앞 사람의 기록 · 몸 · 목표 · 세팅 · 제보 · 진행표**가 뜬다.
//
// 가장 나쁜 자리는 운동 목록이다. 그 길은 받은 것을 `saveCache` 로 **기기에까지
// 담으므로**, 로그아웃이 지운 자리에 앞 사람 5년치가 다시 적히고 다음 사람이 앱을
// 켜면 `hydrate()` 가 그것을 먼저 그린다 — **잠깐이 아니라 남는다.**
//
// ── 어떻게 보는가 ──
//
// 화면으로는 못 본다. 「목록을 받는 중에 나가기를 누른다」를 손으로 맞히려면 느린
// 신호에서 몇 번을 눌러봐야 하고, 맞아도 다음 사람으로 로그인해 봐야 보인다.
// 그래서 **저장소를 진짜로 돌린다** — 가짜 `client` 가 답을 손에 들고 있다가,
// 그 사이에 `reset()`(과 세대 올리기)을 끼워 넣고 그 뒤에 답을 내려놓는다.
// `check-offline.cjs` 가 신호를 끊어 보는 것과 같은 방식이다.
//
// **자가 아예 없던 저장소 셋**(`blockStore` · `reportStore` · `routineSessionStore`)은
// 여기서 처음으로 값으로 본다 — 세 가지 다 「두 화면이 같은 것을 본다」라서,
// 틀어지면 여러 화면이 같이 틀어지는 자리다 (11/03 위험 지도의 밀도 1위).
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

// ── 가짜 client ── **답을 손에 들고 있다가 시킬 때 내려놓는다**
//
// 그 틈이 이 검사의 전부다. 밖에 두어야(external) 저장소가 쓰는 것과 같은 사본이 된다
const fakePath = path.resolve('.handoff-client.cjs');
fs.writeFileSync(fakePath, `
const held = [];
module.exports = {
  // 다음 요청을 손에 들고 있을지
  hold: false,
  // 주소별로 돌려줄 몸통
  bodies: {},
  calls: [],
  get held() { return held; },
  /** 들고 있던 답을 다 내려놓는다. 거꾸로 내려놓으면 **늦게 온 옛 답**이 된다 */
  release(reverse) { const q = held.splice(0); if (reverse) q.reverse(); for (const r of q) r(); },
  _go(method, url) {
    module.exports.calls.push(method + ' ' + url);
    const key = String(url).split('?')[0];
    const data = module.exports.bodies[key];
    const answer = { data: data === undefined ? null : data, status: 200, headers: {} };
    if (!module.exports.hold) return Promise.resolve(answer);
    return new Promise((res) => held.push(() => res(answer)));
  },
  get(url) { return module.exports._go('GET', url); },
  post(url) { return module.exports._go('POST', url); },
  put(url) { return module.exports._go('PUT', url); },
  patch(url) { return module.exports._go('PATCH', url); },
  delete(url) { return module.exports._go('DELETE', url); },
};
module.exports.default = module.exports;
`, 'utf-8');
const fake = require(fakePath);

// ── 세대는 **한 사본**이어야 한다 ──
//
// 저장소를 하나씩 따로 번들로 묶는데, 그대로 두면 `store/session.js` 가 **번들마다
// 딸려 들어가** 저장소마다 제 세대를 갖는다. 그러면 내가 올린 세대를 저장소가 모르고,
// 검사는 「안 막혔다」고 말한다 — **고쳐 놓고도 FAIL 이 뜬다**(처음에 그렇게 났다).
// 진짜 앱에서는 Vite 가 한 사본으로 묶으므로, 밖에 두는 쪽이 도는 모양과 같다.
// `client` 를 밖에 두는 것과 같은 까닭이다
const sessPath = path.resolve('.handoff-session.cjs');
esbuild.buildSync({
  entryPoints: ['src/store/session.js'], bundle: true, format: 'cjs',
  outfile: sessPath, platform: 'node', logLevel: 'silent',
});
const sess = require(sessPath);

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

// 기다릴 틈을 준다 (들고 있던 답이 내려앉을 자리)
const tick = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  try {
    console.log('── 세대 ──');
    ok('처음에는 같은 사람이다', sess.isSameSession(sess.sessionEpoch()), true);
    const before = sess.sessionEpoch();
    sess.newSession();
    ok('사람이 바뀌면 앞 세대는 남이 된다', sess.isSameSession(before), false);
    ok('  바뀐 뒤의 세대는 그 사람이다', sess.isSameSession(sess.sessionEpoch()), true);

    // ─────────────────────────────────────────────────────────────
    // 운동 목록 — 가장 나쁜 자리 (기기에까지 담는다)
    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 운동 목록: 받는 중에 나갔다 ──');
    const wmod = await load('src/store/workoutStore.js', '.h-w.cjs');
    const W = () => wmod.useWorkoutStore.getState();
    const ROWS = [{ id: 1, date: '2026-11-04', exercise: '벤치프레스', weight: 60, sets: 5, reps: 5 }];
    fake.bodies['/workouts'] = ROWS;

    // 1. 보통 때는 들어온다 (자가 아무것도 안 막는 것은 아니다)
    await W().fetchAll(true);
    ok('받으면 목록에 들어온다', Object.keys(W().server).length, 1);

    // 2. 이제 받는 중에 나간다
    fake.hold = true;
    const flying = W().fetchAll(true);
    // 로그아웃이 하는 일 — 세대를 올리고 비운다 (`authStore.logout` 의 차례와 같다)
    sess.newSession();
    wmod.resetCache();
    wmod.useWorkoutStore.setState({ workouts: {}, server: {}, queue: [], loading: false, flushing: false });
    ls.clear();                                  // 로그아웃이 담아둔 것을 지운다
    fake.release(); fake.hold = false;           // 날아가 있던 답이 **이제** 내려앉는다
    await flying; await tick();

    ok('**앞 사람 목록이 다시 꽂히지 않는다**', Object.keys(W().server).length, 0);
    ok('  화면 목록도 비어 있다', Object.keys(W().workouts).length, 0);
    // 여기가 핵심이다 — 기기에 담기면 다음 사람이 앱을 켤 때 그것부터 그린다
    ok('  **기기에도 다시 담기지 않는다**', [...ls.keys()].length, 0);

    // 3. 적는 길도 같다 — 적고 나가는 그 틈
    fake.bodies['/workouts'] = { workout: { id: 9, date: '2026-11-04', exercise: '스쿼트', weight: 80, sets: 5, reps: 5 }, tag: 'W/"x"' };
    fake.hold = true;
    const saving = W().addWorkout({ date: '2026-11-04', exercise: '스쿼트', weight: 80, sets: 5, reps: 5 });
    sess.newSession();
    wmod.useWorkoutStore.setState({ workouts: {}, server: {}, queue: [] });
    ls.clear();
    fake.release(); fake.hold = false;
    await saving.catch(() => {}); await tick();
    ok('적은 줄도 나간 뒤에는 안 꽂힌다', Object.keys(W().server).length, 0);
    ok('  기기에도 안 담긴다', [...ls.keys()].length, 0);

    // ─────────────────────────────────────────────────────────────
    // 몸 · 목표 · 기구 세팅 — 같은 모양의 다섯 자리
    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 같은 모양의 자리들 ──');

    const imod = await load('src/store/inbodyStore.js', '.h-i.cjs');
    const I = () => imod.useInbodyStore.getState();
    fake.bodies['/inbody'] = [{ id: 1, date: '2026-11-04', weight: 72.4, bodyFat: 14.2 }];
    await I().fetchAll(true);
    ok('몸: 받으면 들어온다', I().records.length, 1);
    fake.hold = true;
    const iflying = I().fetchAll(true);
    sess.newSession();
    imod.resetCache();
    imod.useInbodyStore.setState({ records: [], loading: false });
    fake.release(); fake.hold = false;
    await iflying; await tick();
    ok('  **앞 사람 몸무게·체지방이 안 꽂힌다**', I().records.length, 0);

    const gmod = await load('src/store/goalStore.js', '.h-g.cjs');
    const G = () => gmod.useGoalStore.getState();
    fake.bodies['/goals'] = { weeklyTarget: 4, targetWeight: 68 };
    await G().fetch(true);
    ok('목표: 받으면 들어온다', G().goal?.targetWeight, 68);
    fake.hold = true;
    const gflying = G().fetch(true);
    sess.newSession();
    G().reset();
    fake.release(); fake.hold = false;
    await gflying; await tick();
    ok('  **앞 사람 체중 목표가 안 꽂힌다**', G().goal, null);
    ok('  「목표를 받아봤다」고도 안 적는다', G().loaded, false);

    const ymod = await load('src/store/gymStore.js', '.h-y.cjs');
    const Y = () => ymod.useGymStore.getState();
    fake.bodies['/gym-settings'] = { gyms: ['강남점'], settings: [{ gym: '강남점', exercise: '벤치프레스', seat: 3 }] };
    await Y().fetch(true);
    ok('기구 세팅: 받으면 들어온다', Y().settings.length, 1);
    fake.hold = true;
    const yflying = Y().fetch(true);
    sess.newSession();
    Y().reset();
    fake.release(); fake.hold = false;
    await yflying; await tick();
    ok('  **앞 사람 헬스장 세팅이 안 꽂힌다**', Y().settings.length, 0);

    // ─────────────────────────────────────────────────────────────
    // 제보함 — 자가 아예 없던 저장소 ①
    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 제보함 ──');
    const rmod = await load('src/store/reportStore.js', '.h-r.cjs');
    const R = () => rmod.useReportStore.getState();
    fake.bodies['/reports'] = [
      { id: 1, title: '첫 제보', reply_at: '2026-11-01T09:00:00.000Z' },
      { id: 2, title: '둘째', reply_at: null },
      { id: 3, title: '셋째', reply_at: '2026-11-03T09:00:00.000Z' },
    ];
    await R().fetchAll();
    ok('받으면 목록에 들어온다', R().items.length, 3);
    ok('  받고 나면 「불러오는 중」이 꺼진다', R().loading, false);
    // 고객센터 한 화면에서 두 곳이 같은 목록을 본다 — 각자 부르면 요청이 두 번 나간다
    fake.calls.length = 0;
    fake.hold = true;
    const two = [R().fetchAll(), R().fetchAll()];
    fake.release(); fake.hold = false;
    await Promise.all(two);
    ok('두 곳이 같이 불러도 요청은 한 번이다', fake.calls.filter(c => c === 'GET /reports').length, 1);
    // 답이 달린 것 중 가장 최근. ISO 글자라 사전순이 곧 시간순이다
    ok('새 답변은 가장 최근 것을 든다', R().latestReplyAt(), '2026-11-03T09:00:00.000Z');
    rmod.useReportStore.setState({ items: [{ id: 1, reply_at: null }] });
    ok('  답이 하나도 없으면 빈 글자다', R().latestReplyAt(), '');
    rmod.useReportStore.setState({ items: [] });
    ok('  목록이 비어도 안 터진다', R().latestReplyAt(), '');
    // 못 받아온 것과 하나도 없는 것은 다르다 — 보낸 게 있는데 빈 화면이면 지워진 줄 안다
    fake.bodies['/reports'] = undefined;
    R().setFailed(false);
    rmod.useReportStore.setState({ items: [] });
    await R().fetchAll();
    ok('답이 배열이 아니면 빈 목록으로 친다', R().items.length, 0);

    fake.bodies['/reports'] = [{ id: 7, title: '앞 사람 제보', reply_at: '2026-11-04T01:00:00.000Z' }];
    fake.hold = true;
    const rflying = R().fetchAll();
    sess.newSession();
    R().reset();
    fake.release(); fake.hold = false;
    await rflying; await tick();
    ok('**나간 뒤에 앞 사람 제보가 안 꽂힌다**', R().items.length, 0);
    ok('  「새 답변」도 안 뜬다', R().latestReplyAt(), '');
    // `reset` 은 「아직 안 받아왔다」로 돌려놓는다. 늦게 온 답이 이것을 끄면
    // 다음 사람 화면이 **빈 제보함을 다 받아온 것처럼** 그린다
    ok('  아직 안 받아온 것으로 남는다', R().loading, true);

    // ─────────────────────────────────────────────────────────────
    // 진행 중인 루틴 — 자가 아예 없던 저장소 ②
    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 진행 중인 루틴 ──');
    const smod = await load('src/store/routineSessionStore.js', '.h-s.cjs');
    const S = () => smod.useRoutineSessionStore.getState();
    const ITEMS = [{ exercise: '벤치프레스', sets: 5, setsDone: 0 }, { exercise: '스쿼트', sets: 5, setsDone: 0 }];
    fake.bodies['/routine-session'] = { session: { id: 3, items: ITEMS } };
    await S().fetch();
    ok('받으면 진행표가 들어온다', S().session?.items.length, 2);
    ok('  받아봤다고 적어둔다', S().loaded, true);
    // 없다는 것도 답이다 — 알고 나면 다시 묻지 않는다
    fake.calls.length = 0;
    await S().fetch();
    ok('한 번 받았으면 다시 안 묻는다', fake.calls.length, 0);

    // 모양이 아닌 것이 오면 화면이 통째로 죽는다 (`session.items` 를 바로 map 으로 돈다)
    for (const [label, body] of [['배열', { session: [] }], ['글자', { session: 'x' }],
                                 ['items 가 없는 것', { session: { id: 1 } }]]) {
      fake.bodies['/routine-session'] = body;
      await S().fetch(true);
      ok(`${label} 이 오면 없는 것으로 친다`, S().session, null);
    }
    fake.bodies['/routine-session'] = { session: null };
    await S().fetch(true);
    ok('진행 중인 것이 없는 것은 정상이다', [S().session, S().loaded], [null, true]);

    // 세트 체크 — 누르자마자 화면에 먼저 반영하고, **마지막으로 누른 것의 답만** 쓴다
    fake.bodies['/routine-session'] = { session: { id: 3, items: ITEMS } };
    await S().fetch(true);
    fake.hold = true;
    // 답마다 **그때의 몸통**을 쥐여준다 (가짜가 부를 때 몸통을 떠 간다)
    const answerWith = (n) => { fake.bodies['/routine-session'] = { session: { id: 3, items: [{ ...ITEMS[0], setsDone: n }, ITEMS[1]] } }; };
    answerWith(1);
    const c1 = S().checkSet(0, 1);
    ok('누르자마자 화면에 보인다', S().session.items[0].setsDone, 1);
    answerWith(2);
    const c2 = S().checkSet(0, 2);
    ok('  연달아 눌러도 화면이 따라온다', S().session.items[0].setsDone, 2);
    // **거꾸로** 내려놓는다 — 첫 번째 것의 답(1)이 두 번째 것(2) **뒤에** 온다.
    // 세트 사이에 빨리 두 번 누르면 실제로 이렇게 온다
    fake.release(true); fake.hold = false;
    await Promise.all([c1, c2]).catch(() => {});
    await tick();
    ok('  늦게 온 옛 답이 새 체크를 덮지 않는다', S().session.items[0].setsDone, 2);

    // 그리고 나가는 그 틈
    fake.bodies['/routine-session'] = { session: { id: 9, items: ITEMS } };
    fake.hold = true;
    const sflying = S().fetch(true);
    sess.newSession();
    S().reset();
    fake.release(); fake.hold = false;
    await sflying; await tick();
    ok('**나간 뒤에 앞 사람 진행표가 안 꽂힌다**', S().session, null);
    ok('  받아봤다고도 안 적는다', S().loaded, false);

    // 시작하는 길도 같다
    fake.hold = true;
    const starting = S().start(4);
    sess.newSession();
    S().reset();
    fake.release(); fake.hold = false;
    await starting.catch(() => {}); await tick();
    ok('  시작한 진행표도 안 꽂힌다', S().session, null);

    // ─────────────────────────────────────────────────────────────
    // 계정이 막혔다 — 자가 아예 없던 저장소 ③
    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 계정이 막혔다 ──');
    const bmod = await load('src/store/blockStore.js', '.h-b.cjs');
    const B = () => bmod.useBlockStore.getState();
    ok('처음에는 안 막혀 있다', B().block, null);
    const blk = { kind: 'abuse', until: '2026-11-11T00:00:00.000Z', reason: '욕설' };
    B().setBlock(blk);
    ok('막히면 받아 든다', B().block.reason, '욕설');
    // 요청 열 개가 한꺼번에 403 이 된다 — 같은 것이 또 와도 다시 그리지 않는다
    const kept = B().block;
    B().setBlock({ ...blk });
    ok('같은 것이 또 와도 그 자리를 안 바꾼다', B().block === kept, true);
    B().setBlock({ ...blk, until: '2026-11-18T00:00:00.000Z' });
    ok('  기간이 달라지면 바꾼다', B().block.until, '2026-11-18T00:00:00.000Z');
    B().setBlock(null);
    ok('빈 것이 오면 푼다', B().block, null);
    B().setBlock(blk);
    B().clear();
    ok('풀면 비워진다', B().block, null);
    // `api/client.js` 가 이것을 들여오므로, 여기서 스토어나 화면을 들여오면
    // 고리가 생겨 **앱이 뜨다 멎는다**. 머리글이 그렇게 적어뒀다 — 값으로 지킨다
    const bsrc = fs.readFileSync('src/store/blockStore.js', 'utf-8');
    const imports = [...bsrc.matchAll(/^import .*?from '(.+?)';$/gm)].map((m) => m[1]);
    ok('들여오는 것은 zustand 하나뿐이다', imports, ['zustand']);

    // ─────────────────────────────────────────────────────────────
    // 로그아웃이 세대를 **먼저** 올리는가
    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('── 로그아웃의 차례 ──');
    const auth = fs.readFileSync('src/store/authStore.js', 'utf-8');
    const body = auth.slice(auth.indexOf('logout: async'));
    const upAt = body.indexOf('newSession()');
    const askAt = body.indexOf("client.post('/auth/logout')");
    ok('세대를 올린다', upAt >= 0, true);
    // 서버에 묻는 동안이 가장 넓은 틈이다 — 그 앞에서 올려야 한다
    ok('  **서버에 묻기 전에** 올린다', upAt >= 0 && upAt < askAt, true);
    ok('  들어올 때도 올린다 (나가기를 거치지 않는 길)', /login: async[\s\S]{0,400}?newSession\(\)/.test(auth), true);

    // 기다린 뒤에 꽂는 자리에 자가 다 박혀 있는가 — 새로 쓴 길이 이것을 잊는다
    console.log('');
    console.log('── 기다린 뒤에 꽂는 자리마다 ──');
    for (const f of ['workoutStore', 'inbodyStore', 'goalStore', 'gymStore',
                     'reportStore', 'routineSessionStore']) {
      const src = fs.readFileSync(`src/store/${f}.js`, 'utf-8');
      ok(`${f} — 세대를 받아 둔다`, /const mine = sessionEpoch\(\)/.test(src), true);
      ok(`  ${f} — 꽂기 전에 본다`, /isSameSession\(mine\)/.test(src), true);
    }
    // ── 화면이 **기기에 담는** 자리도 같다 ── (2026-11-04)
    //
    // 저장소만 막으면 반쪽이다. 화면이 직접 `client` 를 부르고 그 답을
    // `localStorage` 에 담는 자리가 둘 있었다 — 머리의 **프로필 사진**과 견주기의
    // **전·후 몸 사진**. 둘 다 `PER_USER_KEYS`(로그아웃이 지우는 목록)에 들어 있는
    // 자리라, 받는 중에 나가면 **지운 자리에 앞 사람 사진이 다시 적힌다.**
    //
    // 화면이 들고 있는 값(`setState`)은 괜찮다 — 나가면 그 화면이 사라진다.
    // **기기에 담는 것만** 남는다. 그래서 「담는 화면」을 통째로 쓸어 본다
    console.log('');
    console.log('── 화면이 기기에 담는 자리 ──');
    const screens = [
      ['src/components/Layout.jsx', '머리의 프로필 사진'],
      ['src/pages/ComparePage.jsx', '견주기의 전·후 몸 사진'],
    ];
    for (const [file, what] of screens) {
      const src = fs.readFileSync(file, 'utf-8');
      ok(`${what} — 세대를 받아 둔다`, /const mine = sessionEpoch\(\)/.test(src), true);
      ok(`  ${what} — 담기 전에 본다`, /isSameSession\(mine\)/.test(src), true);
    }
    // ── **빠진 자리를 찾아낸다** ──
    //
    // `client` 를 부르면서 **사람에 딸린 열쇠**(`PER_USER_KEYS`)에 담는 화면이
    // 또 생기면 여기 걸린다. 목록은 `localKeys.js` 에서 **그 배열 안만** 읽는다 —
    // 처음에 파일 끝까지 읽었더니 `MAINT_KEY`·`PROVIDERS_KEY`(기기의 것, 배열 뒤에
    // 적혀 있다)까지 집어 와서 **멀쩡한 화면 둘을 걸었다.** 자가 넓으면 거짓을 말한다
    const perUser = fs.readFileSync('src/data/localKeys.js', 'utf-8');
    const from = perUser.indexOf('export const PER_USER_KEYS');
    const userKeys = (perUser.slice(from, perUser.indexOf('];', from))
      .match(/[A-Z][A-Z0-9_]*_KEY/g) || []);

    // **일부러 안 보는 것은 까닭과 함께 적는다** (`scripts/run-checks.cjs` 와 같은 결).
    //
    // 아래 넷은 담는 자리가 **사람이 누른 그 자리**다 — 받아온 답이 늦게 내려앉는
    // 길이 아니라, 누르고 답을 받아 바로 담는다. 들어오는 길(로그인·가입)은 **담는
    // 그 사람이 방금 들어온 사람**이고(세대는 `login` 이 이미 올렸다), 고객센터의
    // 「새 답변 본 시각」은 **스토어 값을 보고** 담으므로 저장소 쪽 자가 이미 지킨다
    const EXEMPT = {
      'pages/LoginPage.jsx': '들어오는 길 — 담는 사람이 방금 들어온 그 사람이다',
      'pages/RegisterPage.jsx': '가입하는 길 — 위와 같다',
      'pages/SettingsPage.jsx': '사람이 이메일을 고친 그 자리에서 담는다',
      'pages/support/SupportPage.jsx': '스토어의 `latestReplyAt()` 을 보고 담는다 — 저장소 쪽 자가 지킨다',
    };
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = dir + '/' + e.name;
      return e.isDirectory() ? walk(p) : (/\.jsx?$/.test(e.name) ? [p] : []);
    });
    const missing = [];
    for (const p of walk('src/pages').concat(walk('src/components'))) {
      const src = fs.readFileSync(p, 'utf-8');
      if (!/client\.(get|post|put|patch|delete)\(/.test(src)) continue;
      // 담는 자리가 있나 — 그 열쇠가 **사람에 딸린 것**일 때만 본다
      const saves = [...src.matchAll(/saveLS\(\s*([A-Za-z0-9_]+)/g)].map((m) => m[1]);
      const hits = saves.filter((k) => userKeys.includes(k) || userKeys.includes(k.replace(/^LS_/, '')));
      if (hits.length === 0) continue;
      const name = p.replace('src/', '');
      if (EXEMPT[name]) continue;
      if (!/isSameSession\(/.test(src)) missing.push(name + ' → ' + hits.join(','));
    }
    ok('담는 화면 중 자가 없는 곳이 없다', missing, []);
    // 면제한 것이 **아직 있는 파일인지** 본다 — 이름이 바뀌면 그 면제가 조용히 비어
    // 돌고, 그 화면은 아무도 안 보는 채로 남는다 (10/28 에 겪은 「빈 자」의 모양)
    ok('  면제한 넷이 다 있는 파일이다',
      Object.keys(EXEMPT).filter((n) => !fs.existsSync('src/' + n)), []);

    // `noteStore` 는 **달로** 같은 일을 이미 막고 있다 (「어느 달의 답인지 보고 아니면
    // 버린다」 + `resetNoteCache` 가 그 달을 비운다). 자를 두 벌 두지 않고 그것을 지킨다
    const note = fs.readFileSync('src/store/noteStore.js', 'utf-8');
    ok('noteStore — 어느 달의 답인지 보고 버린다', /loadedMonth !== mine/.test(note), true);
    ok('  로그아웃이 그 달을 비운다', /resetNoteCache[\s\S]{0,80}loadedMonth = null/.test(note), true);

    console.log('');
    if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
    console.log('다 통과');
  } catch (err) {
    console.log('터졌다: ' + (err && err.stack || err));
    process.exit(1);
  } finally {
    try { fs.unlinkSync(fakePath); } catch {}
    try { fs.unlinkSync(sessPath); } catch {}
  }
})();
