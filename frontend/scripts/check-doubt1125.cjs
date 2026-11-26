// **근호가 「의심만」으로 남긴 자리 둘을 값으로 지킨다** (2026-11-26 · 정석)
//
//   node scripts/check-doubt1125.cjs            (npm run check 가 찾아서 돈다)
//   node scripts/check-doubt1125.cjs --되돌려    옛 꼴을 먹여 빨개지는지 본다
//
// `docs/TODO-2026-11-26.md` 의 「의심만 — 정석이 먼저 재 볼 것」 중 화면 쪽 둘.
// 둘 다 **재 보니 진짜였다.**
//
//   ⑴ **오래 막힌 계정이 새로고침 고리에 빠진다** (`AccountBlocked.jsx`)
//      `setTimeout` 은 `2^31-1`ms(24.8일)를 넘기면 그 값이 접혀 **바로 깨어난다** —
//      깨어나면 `reload()` 고, 다시 떠서 또 같은 자를 걸어 **고리**가 된다.
//      지금 정지는 7일까지라 안 나지만, 더 긴 정지가 생기는 날 난다.
//      → 판단을 `data/blockWake.js` 로 꺼내고 **하루씩 나눠 건다**
//
//   ⑵ **새로고침이 올리는 중인 사진을 덮는다** (`ComparePage.jsx`)
//      머리의 새로고침이 보낸 `GET /photos` 의 답이 **내 손보다 늦게** 오면, 그 답은
//      내가 올린 것을 모르는 옛 판이다 — 화면과 기기가 그것으로 덮여 **올린 사진이
//      사라지고 지운 사진이 되살아났다.**
//      → 판단을 `data/photoMerge.js` 로 꺼내고 **떠난 뒤에 손이 닿은 칸만** 지킨다
//
// 화면을 띄울 수 없으니 **판단을 순수 함수로 꺼내** 그 함수를 돌린다 — 꺼낸 자리를
// 화면이 진짜로 부르는지도 같이 본다(안 부르면 자만 초록인 꼴이 된다).
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

// ── 되돌림 꼴 — **고친 줄을 지운 소스**를 먹인다 ──
const 되돌림꼴 = {
  '한 번에 통째로 건다 (32비트로 접힌다)': { file: 'data/blockWake.js', cases: ['1'],
    from: 'return { kind: \'wait\', wait: Math.min(left + 1000, WAKE_STEP_MAX) };',
    to:   'return { kind: \'wait\', wait: left + 1000 };' },
  '늦은 답이 손이 닿은 칸도 덮는다': { file: 'data/photoMerge.js', cases: ['2'],
    from: 'if (!((닿은때[key] || 0) >= 떠난때 && 닿은때[key])) continue;',
    to:   'if (true) continue;' },
};

let 되돌릴것 = null;
const patch = {
  name: 'patch-src',
  setup(build) {
    build.onLoad({ filter: /\.jsx?$/ }, (args) => {
      if (!되돌릴것) return null;
      const want = path.normalize('src/' + 되돌릴것.file);
      if (!path.normalize(args.path).endsWith(want)) return null;
      const src = fs.readFileSync(args.path, 'utf-8');
      if (!src.includes(되돌릴것.from)) {
        throw new Error('되돌릴 자리를 못 찾았다 — ' + 되돌릴것.file);
      }
      return { contents: src.replace(되돌릴것.from, 되돌릴것.to), loader: 'jsx' };
    });
  },
};

let seq = 0;
const load = async (entry) => {
  const out = '.doubt-' + (seq += 1) + '.cjs';
  await esbuild.build({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out,
    platform: 'node', define: { 'import.meta.env': '{}' }, plugins: [patch], logLevel: 'silent' });
  const full = path.resolve(out);
  delete require.cache[full];
  const m = require(full);
  fs.unlinkSync(full);
  return m;
};

const DAY = 24 * 60 * 60 * 1000;

async function 판(which) {
  const 돈다 = (n) => !which || which.includes(n);
  const 본것 = [];
  const 봄 = (name, got, want) => { 본것.push(ok(name, got, want)); };

  if (돈다('1')) {
    console.log('── ⑴ 오래 막힌 계정 — 자를 하루씩 나눠 거는가 ──');
    const W = await load('src/data/blockWake.js');
    const now = Date.parse('2026-11-26T00:00:00.000Z');
    const 뒤 = (ms) => new Date(now + ms).toISOString();

    봄('기한이 없으면 자를 안 건다 (영구 정지 · 차단)', W.nextWake(null, now).kind, 'none');
    봄('  못 읽는 값도 그렇다', W.nextWake('어제', now).kind, 'none');
    봄('이미 지났으면 그 자리에서 푼다', W.nextWake(뒤(-1000), now).kind, 'open');
    봄('1분 남았으면 1분 뒤에 (+1초)', W.nextWake(뒤(60000), now).wait, 61000);
    봄('7일 남았으면 **하루**만 건다 (지금 정지의 최대)', W.nextWake(뒤(7 * DAY), now).wait, DAY);
    // ★ 이것이 그 자리다 — 60일이면 `2^31-1` 을 넘는다
    const 먼것 = W.nextWake(뒤(60 * DAY), now);
    봄('★ 60일 남았어도 **접히는 선을 넘지 않는다**', 먼것.wait <= W.TIMER_MAX, true);
    봄('  그 값이 하루다 (깨어나서 다시 잰다)', 먼것.wait, DAY);
    봄('  24.8일(2^31ms)보다 짧다', 먼것.wait < 2 ** 31 - 1, true);

    // **화면이 그 자를 진짜로 부르는가** — 안 부르면 자만 초록이다
    const src = fs.readFileSync('src/components/AccountBlocked.jsx', 'utf-8');
    봄('화면이 그 자를 부른다', /nextWake\(until\)/.test(src), true);
    봄('  화면에 생 `setTimeout(left` 가 남아 있지 않다', /setTimeout\([^,]*left/.test(src), false);
  }

  if (돈다('2')) {
    console.log('── ⑵ 새로고침의 늦은 답이 사진을 덮는가 ──');
    const P = await load('src/data/photoMerge.js');
    const 떠난때 = 1000;
    const 서버 = { before: '옛전', after: '옛후' };
    const 서버날 = { before: '2026-11-01T00:00:00.000Z', after: '2026-11-02T00:00:00.000Z' };

    // 손이 안 닿았으면 **서버가 진실이다** (다른 기기에서 지운 것이 여기 남지 않게)
    const 그대로 = P.mergeServerPhotos({
      server: 서버, serverAt: 서버날, local: { before: '옛전' }, localAt: {},
      touchedAt: {}, sentAt: 떠난때,
    });
    봄('손이 안 닿았으면 서버가 진실이다', 그대로.photos, 서버);
    봄('  지킨 칸이 없다', 그대로.kept, []);
    봄('  **한 장도 없다는 답도 답이다**',
      P.mergeServerPhotos({ server: {}, serverAt: {}, local: 서버, localAt: 서버날, touchedAt: {}, sentAt: 떠난때 }).photos, {});

    // ★ 떠난 뒤에 올렸다 — 그 칸은 지킨다
    const 올리는중 = P.mergeServerPhotos({
      server: 서버, serverAt: 서버날,
      local: { before: '방금올린것', after: '옛후' }, localAt: { before: '2026-11-26T01:00:00.000Z' },
      touchedAt: { before: 떠난때 + 500 }, sentAt: 떠난때,
    });
    봄('★ 떠난 뒤에 올린 칸은 **안 덮는다**', 올리는중.photos.before, '방금올린것');
    봄('  손 안 닿은 칸은 서버 것이다', 올리는중.photos.after, '옛후');
    봄('  날짜도 지금 것이다 (옛 날짜가 안 붙는다)', 올리는중.at.before, '2026-11-26T01:00:00.000Z');

    // ★ 떠난 뒤에 지웠다 — 서버가 들고 있어도 되살리지 않는다
    const 지우는중 = P.mergeServerPhotos({
      server: 서버, serverAt: 서버날,
      local: { after: '옛후' }, localAt: { after: 서버날.after },
      touchedAt: { before: 떠난때 + 500 }, sentAt: 떠난때,
    });
    봄('★ 떠난 뒤에 지운 칸은 **되살리지 않는다**', 'before' in 지우는중.photos, false);
    봄('  그 칸의 날짜도 걷힌다', 'before' in 지우는중.at, false);

    // 떠나기 **전**에 닿은 손은 서버 답이 이미 알고 있다 — 덮어도 된다
    const 전에닿음 = P.mergeServerPhotos({
      server: 서버, serverAt: 서버날, local: { before: '옛것보다먼저' }, localAt: {},
      touchedAt: { before: 떠난때 - 500 }, sentAt: 떠난때,
    });
    봄('떠나기 전에 닿은 손은 서버가 안다 (덮는다)', 전에닿음.photos.before, '옛전');

    const src = fs.readFileSync('src/pages/ComparePage.jsx', 'utf-8');
    봄('화면이 그 자를 부른다', /mergeServerPhotos\(\{/.test(src), true);
    봄('  올리기 · 지우기가 손이 닿았다고 적는다', (src.match(/touch\(photoKey\)/g) || []).length, 2);
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
    console.log('── 되돌려-FAIL: 고침을 지운 소스를 먹인다 ──');
    let 샌것 = 0;
    for (const [이름, 꼴] of Object.entries(되돌림꼴)) {
      console.log('');
      console.log('■ ' + 이름 + ' (' + 꼴.file + ')');
      되돌릴것 = 꼴;
      const 전 = bad;
      const 본것 = await 판(꼴.cases);
      되돌릴것 = null;
      if (본것.length === 0) { console.log('  ⚠ 아무 판정도 안 돌았다'); 샌것 += 1; continue; }
      if (bad > 전) console.log('  → FAIL 떴다 (자가 잡는다)');
      else { console.log('  → ★ 안 떴다 — **이 자는 그 자리를 못 본다**'); 샌것 += 1; }
      bad = 전;
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
