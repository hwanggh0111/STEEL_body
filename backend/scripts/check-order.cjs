// **적은 뒤 꽂는 차례가 서버와 같은가** (2026-10-31)
//
//   npm run order     (npm run check 가 찾아서 돈다)
//
// ── 왜 ──
//
// 여태 한 줄을 적으면 화면이 **목록을 통째로** 다시 받았다 — 5년치면 4.15MB
// (gzip 210KB)고, 그 왕복이 **세트를 적을 때마다** 일어난다(`npm run http`).
// 이제 서버가 **담은 줄을 돌려주고** 화면이 그것을 제자리에 꽂는다
// (`store/workoutStore.js` 의 `putRow`).
//
// **그 차례가 서버와 어긋나면** 슈퍼세트·드롭세트 묶음이 어긋나 보이고, 다음에
// 목록을 받는 순간 줄이 저절로 움직인다. 그래서 **값으로 맞춘다** —
// 진짜 서버에 적고, 화면이 꽂은 모양과 **서버가 주는 모양**을 견준다.
//
// 글자로 「꽂는다」를 지키는 것으로는 모자란다: 꽂는 자리가 한 칸 어긋나도 글자는
// 그대로다 (10/28 ⑯ 의 자 — 검사가 틀린 코드를 글자로 지킬 수 있다).
const { spawn } = require('child_process');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const PORT = 4315;
const BASE = `http://127.0.0.1:${PORT}/api`;
// 사람 UA 로 두드린다 — 가드가 도구를 막는다
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';

let token = '';
const call = async (method, p, body) => {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* 몸통이 없을 수 있다 */ }
  return { status: res.status, data };
};

(async () => {
  const env = {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'test',
    // 검사 계정이 제 기록을 만들고 지운다. 본 DB 를 안 건드리게 딴 파일을 쓴다
    DB_FILE: path.join(__dirname, '.check-order.json'),
    PHOTOS_FILE: path.join(__dirname, '.check-order.photos.json'),
    RATE_LIMIT_GLOBAL_MAX: '100000',
    // 서른두 자가 넘어야 서버가 뜬다 (`index.js` 가 그 자리에서 멈춘다)
    JWT_SECRET: 'check-order-secret-0123456789-abcdefghijklmnop',
    // 번호를 응답에 실어 달라고 한다 (`check-shield` 머리글에 까닭이 적혀 있다)
    DEV_ECHO_CODE: '1',
    VAPID_PUBLIC_KEY: '',
    VAPID_PRIVATE_KEY: '',
  };
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'index.js')], {
    cwd: path.join(__dirname, '..'),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  srv.stdout.on('data', (d) => { if (process.env.SESSION_DEBUG) process.stdout.write('[서버] ' + d); });
  srv.stderr.on('data', (d) => { if (process.env.SESSION_DEBUG) process.stderr.write('[서버] ' + d); });

  const stop = () => { try { srv.kill(); } catch { /* 이미 죽었다 */ } };
  process.on('exit', stop);

  // **떴는지는 두드려서 본다** — stdout 한 줄을 기다리면 그 줄이 바뀌는 날 멈춘다
  let up = false;
  for (let i = 0; i < 150 && !up; i += 1) {
    try { up = (await fetch(`${BASE}/health`)).ok; } catch { /* 아직 */ }
    if (!up) await new Promise((r) => setTimeout(r, 100));
  }
  if (!up) { console.log('FAIL 서버가 안 떴다'); stop(); process.exit(1); }

  const email = `ord${Date.now() % 100000}@check.local`;
  try {
    const sent = await call('POST', '/auth/send-code', { email });
    const code = sent.data?.code;
    if (!code) throw new Error('번호를 못 받았다 (SMTP 가 켜져 있으면 메일로만 간다)');
    const reg = await call('POST', '/auth/register', {
      email, password: 'check12345', nickname: '차례검사', username: `ord${Date.now() % 100000}`, code,
    });
    token = reg.data?.token || '';
    ok('들어갔다', [reg.status, !!token], [201, true]);
    if (!token) throw new Error('토큰을 못 받았다');

    // ── 화면이 쓰는 자를 **그 파일에서 떼어 온다** ──
    //
    // 규칙을 여기 또 적으면 두 벌이 된다 — 한쪽을 고치는 날 이 검사가 거짓 통과한다
    const storeSrc = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'frontend', 'src', 'store', 'workoutStore.js'), 'utf8');
    const at = storeSrc.indexOf('const putRow = (server, row) => {');
    ok('화면에서 꽂는 자를 찾았다', at >= 0, true);
    let depth = 0; let body = '';
    for (let i = storeSrc.indexOf('{', at + 30); i < storeSrc.length; i += 1) {
      if (storeSrc[i] === '{') depth += 1;
      else if (storeSrc[i] === '}') { depth -= 1; if (depth === 0) { body = storeSrc.slice(at, i + 1); break; } }
    }
    const putRow = new Function(`${body}; return putRow;`)();

    // 날짜별로 묶는 자도 **같은 파일에서** 떼어 온다
    const gAt = storeSrc.indexOf('function groupByDate(list) {');
    let gd = 0; let gBody = '';
    for (let i = storeSrc.indexOf('{', gAt + 20); i < storeSrc.length; i += 1) {
      if (storeSrc[i] === '{') gd += 1;
      else if (storeSrc[i] === '}') { gd -= 1; if (gd === 0) { gBody = storeSrc.slice(gAt, i + 1); break; } }
    }
    const groupByDate = new Function(`${gBody}; return groupByDate;`)();

    // ── 한 날에 넉 줄을 적는다 (묶음까지) ──
    const DAY = '2026-10-30';
    let server = {};
    const rows = [
      { exercise: '벤치프레스', weight: '80', sets: 3, reps: 10 },
      { exercise: '인클라인덤벨프레스', weight: '24', sets: 3, reps: 12, link: 'super' },
      { exercise: '케이블 푸시다운', weight: '30', sets: 3, reps: 15 },
      { exercise: '벤치프레스', weight: '70', sets: 1, reps: 8, link: 'drop' },
    ];
    for (const r of rows) {
      const res = await call('POST', '/workouts', { date: DAY, ...r });
      ok(`적었다 — ${r.exercise}`, res.status, 201);
      ok('  담은 줄을 돌려준다', !!res.data?.workout?.id, true);
      // **화면이 하는 그대로** 꽂는다
      server = putRow(server, res.data.workout);
    }

    // ── 서버가 주는 차례와 견준다 ──
    const got = await call('GET', '/workouts');
    const fromServer = groupByDate(got.data);
    const ids = (o) => (o[DAY] || []).map((w) => w.id);
    ok('꽂은 차례가 서버와 같다', ids(server), ids(fromServer));
    ok('  그 날 넉 줄이다', ids(server).length, 4);
    // 묶음 표시도 그대로 와야 한다 — 어긋나면 슈퍼·드롭이 딴 줄에 붙는다
    const links = (o) => (o[DAY] || []).map((w) => w.link || null);
    ok('  묶음 표시도 같다', links(server), links(fromServer));
    // 서버가 **다듬은 이름**을 돌려주는가 (화면이 날글을 얹지 않게)
    const dirty = await call('POST', '/workouts', { date: DAY, exercise: '  벤치   프레스  ', weight: '60', sets: 1, reps: 5 });
    ok('다듬은 이름을 돌려준다', dirty.data?.workout?.exercise, '벤치 프레스');

    // ── 지우면 그 줄만 빠진다 ──
    const delId = ids(fromServer)[0];
    await call('DELETE', `/workouts/${delId}`);
    const after = groupByDate((await call('GET', '/workouts')).data);
    ok('지운 줄만 빠졌다', (after[DAY] || []).some((w) => w.id === delId), false);
    ok('  나머지는 그대로다', (after[DAY] || []).length, 4);

    // ── **보내는 칸마다 「누가 읽는가」를 적는다** ── (2026-10-31)
    //
    // 오늘 목록을 깎다가 `created_at` 을 뺄 뻔했다 — 「차례 매기는 데만 쓴다」고
    // 봤는데 **`data/pace.js` 가 그것으로 운동 속도를 잰다**(오늘 결산의 「보통
    // 이만큼 쉰다」). 뺐으면 그 기능이 **조용히 없는 것**이 됐다.
    //
    // 그래서 **칸마다 읽는 자를 적어둔다.** 서버가 적혀 있지 않은 칸을 보내면
    // 「누가 읽는지 적어라」로 FAIL 하고, 적어둔 칸이 안 오면 그것도 FAIL 한다.
    // (`check-twins` · `bounds` 와 같은 손 — **쓰이지 않는 줄은 걷게 한다**)
    console.log('');
    const 읽는자 = {
      id: '화면이 줄을 짚는다 (고치기 · 지우기)',
      date: '날짜별로 묶는다 (`groupByDate`)',
      exercise: '운동 이름 — 부위 맞히기 · 사전',
      weight: '무게 (글자다 — 「맨몸」·「밴드」)',
      sets: '세트',
      reps: '횟수',
      created_at: '`data/pace.js` — 기록 사이 시간으로 속도를 잰다',
      link: '슈퍼세트 · 드롭세트 묶음 (있을 때만)',
      updated_at: '고친 줄 (있을 때만)',
    };
    const 온칸 = new Set();
    for (const w of (await call('GET', '/workouts')).data) Object.keys(w).forEach((k) => 온칸.add(k));
    ok('누가 읽는지 안 적힌 칸', [...온칸].filter((k) => !읽는자[k]), []);
    // 적어두고 안 오는 칸 — `link`·`updated_at` 은 있을 때만 오므로 뺀다
    const 늘오는것 = Object.keys(읽는자).filter((k) => k !== 'link' && k !== 'updated_at');
    ok('적어뒀는데 안 오는 칸', 늘오는것.filter((k) => !온칸.has(k)), []);
    ok('  안 읽는 칸은 안 보낸다 (user_id · client_key)',
      ['user_id', 'client_key'].filter((k) => 온칸.has(k)), []);

    // **값으로 본다** — 속도를 재는 자에게 서버가 준 줄을 그대로 먹여본다.
    // 글자로 「보낸다」를 지키는 것으로는 모자란다(10/28 ⑯ 의 자)
    const paceSrc = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'frontend', 'src', 'data', 'pace.js'), 'utf8');
    const paceMod = new Function(`${paceSrc.replace(/export /g, '')}; return { buildPace };`)();
    const day = (await call('GET', '/workouts')).data;
    const byDate = {};
    for (const w of day) { (byDate[w.date] = byDate[w.date] || []).push(w); }
    // **시각을 벌려 놓는다** — 검사는 몇 초 안에 넉 줄을 적으므로 그대로 먹이면
    // 「한꺼번에 적은 날」(`batched`)이 맞는 답이다. 그건 못 읽은 것이 아니다
    const spread = (rows, keep = true) => rows.map((w, i) => {
      const o = { ...w };
      if (keep) o.created_at = new Date(Date.parse(`${DAY}T10:00:00Z`) + i * 20 * 60000).toISOString();
      else delete o.created_at;
      return o;
    });
    const 잰다 = paceMod.buildPace({ [DAY]: spread(byDate[DAY]) }, DAY);
    ok('속도를 잰다 (서버가 준 칸으로)', [잰다.usable, 잰다.medianMs], [true, 20 * 60000]);
    // **그 칸을 빼면 못 잰다** — 깎으면 기능이 조용히 사라진다는 증거다
    const 못잰다 = paceMod.buildPace({ [DAY]: spread(byDate[DAY], false) }, DAY);
    ok('  그 칸이 없으면 못 잰다 (빼면 기능이 사라진다)', 못잰다.usable, false);

    await call('POST', '/auth/delete', { password: 'check12345' });
  } catch (e) {
    bad += 1;
    console.log('FAIL 돌리다 터졌다 →', e.message);
  }

  stop();
  for (const f of ['.check-order.json', '.check-order.photos.json']) {
    try { require('fs').unlinkSync(path.join(__dirname, f)); } catch { /* 없으면 그만 */ }
  }
  console.log('');
  console.log(bad === 0 ? '전부 통과' : bad + '건 실패');
  process.exit(bad === 0 ? 0 : 1);
})();
