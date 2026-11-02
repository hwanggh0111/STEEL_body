// **적은 뒤 다음 받기가 0바이트인가** (2026-11-02)
//
//   npm run tag       (npm run check 가 찾아서 돈다)
//
// ── 왜 ──
//
// 10/31 에 「적은 뒤 통째로 다시 받는 것」을 걷었다(`npm run order`). 그런데 **그
// 다음 번 받기**가 남아 있었다 — 적으면 서버 딱지가 올라가므로(`bumpVer`), 30초
// 뒤 화면을 옮겨 목록을 다시 부르면 브라우저의 옛 딱지로는 **200 · 5년치 209KB**다.
// 화면은 이미 서버와 같은 목록을 들고 있는데(`putRow`) 그 말을 할 길이 없었다.
//
// 이제 적는 길이 **그 뒤의 딱지**를 같이 주고, 화면이 그것을 들고 물어본다.
// 여기서는 그것을 **진짜 서버로 값으로** 본다 —
//
//   · 적기 · 지우기가 딱지를 준다 · **고치기는 안 준다**(주면 고친 것이 안 보인다)
//   · 그 딱지로 물어보면 **304 이고 몸통이 0바이트**다
//   · 옛 딱지로 물어보면 **200** 이다 (안 그러면 바뀐 것이 안 보인다는 뜻)
//   · 적은 줄은 그 뒤의 목록에 **진짜로 들어 있다** (딱지만 맞고 줄이 없으면 최악이다)
//   · 화면이 그 딱지를 **읽고 · 보내고 · 304 를 답으로 받는지**를 그 파일에서 본다
//     (글자로 「보낸다」를 지키는 것으로는 모자라지만, 브라우저는 여기서 못 띄운다)
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const PORT = 4317;
const BASE = `http://127.0.0.1:${PORT}/api`;
// 사람 UA 로 두드린다 — 가드가 도구를 막는다
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';

let token = '';
/** 딱지와 **몸통 바이트**까지 돌려준다 — 여기서 재는 것이 그것이다 */
const call = async (method, p, body, headers = {}) => {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* 304 는 몸통이 없다 */ }
  return { status: res.status, data, bytes: Buffer.byteLength(text), etag: res.headers.get('etag') };
};

(async () => {
  const env = {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'test',
    // 검사 계정이 제 기록을 만들고 지운다. 본 DB 를 안 건드리게 딴 파일을 쓴다
    DB_FILE: path.join(__dirname, '.check-tag.json'),
    PHOTOS_FILE: path.join(__dirname, '.check-tag.photos.json'),
    RATE_LIMIT_GLOBAL_MAX: '100000',
    JWT_SECRET: 'check-tag-secret-0123456789-abcdefghijklmnop',
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

  const stamp = Date.now() % 100000;
  const email = `tag${stamp}@check.local`;
  try {
    const sent = await call('POST', '/auth/send-code', { email });
    const code = sent.data?.code;
    if (!code) throw new Error('번호를 못 받았다 (SMTP 가 켜져 있으면 메일로만 간다)');
    const reg = await call('POST', '/auth/register', {
      email, password: 'check12345', nickname: '딱지검사', username: `tag${stamp}`, code,
    });
    token = reg.data?.token || '';
    ok('들어갔다', [reg.status, !!token], [201, true]);
    if (!token) throw new Error('토큰을 못 받았다');

    const DAY = '2026-10-30';
    // 목록을 한 번 받아 **적기 전의 딱지**를 들고 있는다 (브라우저가 하는 그대로)
    await call('POST', '/workouts', { date: DAY, exercise: '스쿼트', weight: '100', sets: 5, reps: 5 });
    const first = await call('GET', '/workouts');
    const oldTag = first.etag;
    ok('목록이 딱지를 준다', !!oldTag, true);

    // ── 적는다 ──
    const post = await call('POST', '/workouts', { date: DAY, exercise: '벤치프레스', weight: '80', sets: 3, reps: 10 });
    ok('적었다', post.status, 201);
    ok('  적는 길이 새 딱지를 준다', typeof post.data?.tag === 'string' && post.data.tag.length > 0, true);
    ok('  적기 전 딱지와 다르다', post.data?.tag !== oldTag, true);

    // ── 그 딱지로 물어보면 0바이트다 ──
    const same = await call('GET', '/workouts', undefined, { 'If-None-Match': post.data?.tag || 'x' });
    ok('새 딱지로 물어보면 304', same.status, 304);
    ok('  몸통이 0바이트다', same.bytes, 0);

    // ── 옛 딱지로는 받아야 한다 ── (이게 200 이 아니면 「바뀐 것이 안 보인다」)
    const changed = await call('GET', '/workouts', undefined, { 'If-None-Match': oldTag });
    ok('옛 딱지로 물어보면 200', changed.status, 200);
    ok('  적은 줄이 거기 있다', (changed.data || []).some((w) => w.id === post.data.id), true);
    // **딱지가 맞는데 줄이 없는 것**이 제일 나쁘다 — 그래서 둘을 같이 본다
    ok('  그 몸통의 딱지가 적는 길이 준 것과 같다', changed.etag, post.data?.tag);

    // ── 지우기도 딱지를 준다 ──
    const del = await call('DELETE', `/workouts/${post.data.id}`);
    ok('지웠다', del.status, 200);
    ok('  지우는 길이 새 딱지를 준다', typeof del.data?.tag === 'string' && del.data.tag.length > 0, true);
    const afterDel = await call('GET', '/workouts', undefined, { 'If-None-Match': del.data?.tag || 'x' });
    ok('  그 딱지로 물어보면 304', afterDel.status, 304);

    // ── **고치기는 딱지를 안 준다** ──
    //
    // 날짜를 고치면 그 줄이 그 날 안에서 자리를 옮긴다. 화면은 그 자를 들고 있지
    // 않아서 목록을 다시 받는데, 딱지를 주면 **그것을 들고 물어보다 304** 를 받고
    // 고친 것이 영영 안 보인다
    // **지운 줄을 고르지 않는다** — 목록은 「적은 때 내림」이라 [0] 이 방금 지운 줄이었다
    const keep = (changed.data || []).find((w) => w.exercise === '스쿼트');
    const put = await call('PUT', `/workouts/${keep.id}`, {
      date: DAY, exercise: '스쿼트', weight: '105', sets: 5, reps: 5,
    });
    ok('고쳤다', put.status, 200);
    ok('  고치는 길은 딱지를 안 준다', put.data?.tag === undefined, true);

    // ── **딱지 안에 쉼표가 없다** ── (2026-11-02)
    //
    // `If-None-Match` 는 쉼표로 여러 딱지를 싣는 자리다(`utils/fresh.js` 의
    // `matches` 가 쉼표로 쪼갠다). 딱지에 쉼표가 들어가면 그것이 두 조각으로
    // 갈려 **영영 안 맞는다** — 비교 화면이 둘만 달라고 할 때 그 자리를 밟았다
    for (const q of ['', '?type=profile', '?type=before,after']) {
      const r = await call('GET', '/photos' + q);
      ok(`사진 딱지에 쉼표가 없다 (${q || '셋 다'})`, (r.etag || '').includes(','), false);
      if (r.etag) {
        const again = await call('GET', '/photos' + q, undefined, { 'If-None-Match': r.etag });
        ok('  그 딱지로 물어보면 304', again.status, 304);
      }
    }

    // ── 화면 쪽은 그 파일에서 본다 ──
    const storePath = path.join(__dirname, '..', '..', 'frontend', 'src', 'store', 'workoutStore.js');
    const store = fs.readFileSync(storePath, 'utf8');
    ok('화면이 딱지를 보낸다 (If-None-Match)', /If-None-Match/.test(store), true);
    ok('  304 를 답으로 받는다 (validateStatus)', /validateStatus/.test(store) && /status === 304/.test(store), true);
    ok('  적는 길이 준 딱지를 받아 적는다', /keepTag\(data\.tag\)/.test(store), true);
    ok('  지우는 길도 그렇다', /keepTag\(data\?\.tag\)/.test(store), true);
    // **들고 있는 것이 없으면 딱지를 안 보낸다** — 304 를 받아도 그릴 것이 없다
    ok('  목록이 비면 딱지를 안 보낸다', /serverTag && hasRows/.test(store), true);
    // 다음 사람 자리에 앞 사람 딱지를 남기지 않는다
    const at = store.indexOf('export function resetCache');
    ok('  로그아웃하면 딱지를 비운다', /serverTag = ''/.test(store.slice(at, at + 500)), true);
    // **고치기 쪽에서는 딱지를 안 받는다** (받으면 고친 것이 안 보인다)
    const upd = store.slice(store.indexOf('updateWorkout: async'), store.indexOf('deleteWorkout: async'));
    ok('  고치기는 딱지를 안 받는다', /keepTag/.test(upd), false);

    await call('POST', '/auth/delete', { password: 'check12345' });
  } catch (e) {
    bad += 1;
    console.log('FAIL 돌리다 터졌다 →', e.message);
  }

  stop();
  for (const f of ['.check-tag.json', '.check-tag.photos.json']) {
    try { fs.unlinkSync(path.join(__dirname, f)); } catch { /* 없으면 그만 */ }
  }
  console.log('');
  console.log(bad === 0 ? '전부 통과' : bad + '건 실패');
  process.exit(bad === 0 ? 0 : 1);
})();
