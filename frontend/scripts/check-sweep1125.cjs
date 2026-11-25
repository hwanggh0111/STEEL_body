// **11/25 밤 둘째 점검에서 고친 화면 쪽 넷을 지킨다** (2026-11-25 · 근호).
//
//   node scripts/check-sweep1125.cjs     (npm run check 에도 들어 있다 — 찾아서 돈다)
//
//   ① 음성 기록 — 「일곱」이 1 로, 「마흔다섯」이 5 로 읽혔다 (값으로 본다)
//   ② 앱 잠금 — 틀린 횟수가 새로고침에 0 으로 돌아갔다 (저장소를 진짜로 돌린다)
//   ③ 스톱워치 — 돌던 중 초기화하면 정리 손이 옛 시간을 도로 적었다 (그 손의 줄을 본다)
//   ④ 숨 듣기 — 권한을 묻는 사이 닫힌 화면이 마이크를 열었다 (그 손의 줄을 본다)
//
// ③ · ④ 는 화면 · 마이크를 띄울 수 없어 **그 손의 모양**을 본다 — 고친 줄이 빠지면 운다.
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

const ls = new Map();
global.localStorage = {
  getItem: (k) => (ls.has(k) ? ls.get(k) : null),
  setItem: (k, v) => ls.set(k, String(v)),
  removeItem: (k) => ls.delete(k),
};
global.window = { addEventListener() {}, removeEventListener() {}, location: { href: '/' } };
global.navigator = { onLine: true, userAgent: 'check' };

const load = async (entry, out) => {
  await esbuild.build({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node',
    define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
  const m = require(path.resolve(out));
  fs.unlinkSync(out);
  return m;
};
const src = (p) => fs.readFileSync(p, 'utf-8');

(async () => {
  try {
    console.log('── ① 음성 기록 ──');
    const V = await load('src/data/voiceLog.js', '.sweep-voice.cjs');
    const say = (s) => { const o = V.parseSpoken(s); return [o.weight, o.reps, o.sets]; };
    ok('「팔십 일곱 개」 → 80kg · 7회', say('팔십 일곱 개'), ['80', 7, null]);
    ok('「일곱 개」 → 7회', say('일곱 개'), [null, 7, null]);
    ok('「마흔다섯 킬로 열 개」 → 45kg · 10회', say('마흔다섯 킬로 열 개'), ['45', 10, null]);
    ok('「쉰 킬로 여덟 개」 → 50kg · 8회', say('쉰 킬로 여덟 개'), ['50', 8, null]);
    ok('  옛 것도 그대로 — 「백이십 킬로 다섯 개」', say('백이십 킬로 다섯 개'), ['120', 5, null]);
    ok('  옛 것도 그대로 — 「60킬로 10개 3세트」', say('60킬로 10개 3세트'), ['60', 10, 3]);
    ok('  옛 것도 그대로 — 「스물다섯 개」 · 「열하나 개」', [say('스물다섯 개')[1], say('열하나 개')[1]], [25, 11]);

    console.log('');
    console.log('── ② 앱 잠금 — 틀린 횟수가 새로고침을 넘는다 ──');
    const keys = await load('src/data/localKeys.js', '.sweep-keys.cjs');
    const at = Date.now() - 1000;
    ls.set(keys.LOCK_TRIES_KEY, JSON.stringify({ tries: 5, lastTryAt: at }));
    const L1 = await load('src/store/lockStore.js', '.sweep-lock1.cjs');
    ok('**켜면 담아둔 틀린 횟수를 읽는다** (새로고침해도 0 이 아니다)', L1.useLockStore.getState().tries, 5);
    ok('  쉬는 시간이 남아 있다', L1.useLockStore.getState().cooldown() > 0, true);
    L1.useLockStore.getState().release();
    ok('놓으면(로그아웃 길) 담아둔 것도 지운다', ls.has(keys.LOCK_TRIES_KEY), false);
    ls.set(keys.LOCK_TRIES_KEY, '{깨진');
    const L2 = await load('src/store/lockStore.js', '.sweep-lock2.cjs');
    ok('깨진 값이면 0 으로 시작한다 (안 터진다)', L2.useLockStore.getState().tries, 0);

    console.log('');
    console.log('── ③ 스톱워치 초기화 ──');
    const sw = src('src/components/measure/StopwatchSection.jsx');
    const cleanup = sw.slice(sw.indexOf('return () => {'), sw.indexOf('}, [running, mode]);'));
    ok('정리 손이 「초기화했다」를 먼저 본다', /if \(resetRef\.current\)[^\n]*baseRef\.current = 0; return;/.test(cleanup), true);
    const reset = sw.slice(sw.indexOf('const handleReset'), sw.indexOf('const handleLap'));
    ok('  초기화가 돌던 중이면 그 표시를 세운다', /if \(running\) resetRef\.current = true;/.test(reset), true);

    console.log('');
    console.log('── ④ 숨 듣기 — 묻는 사이 닫힌 화면 ──');
    const br = src('src/data/useBreath.js');
    ok('부를 때마다 번호를 올린다', /const mine = \+\+genRef\.current;/.test(br), true);
    ok('  기다린 뒤 번호가 바뀌었으면 받은 트랙을 끄고 물러난다',
      /if \(mine !== genRef\.current\) \{[\s\S]{0,120}stream\.getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\);[\s\S]{0,20}return;/.test(br), true);
    ok('  묻는 중에 또 누르면 둘째 마이크를 안 연다', /if \(on \|\| askingRef\.current\) return;/.test(br), true);
    const stopFn = br.slice(br.indexOf('const stop = useCallback'), br.indexOf('const start = useCallback'));
    ok('  끄기와 화면 닫기가 번호를 올린다',
      /genRef\.current \+= 1/.test(stopFn) && /useEffect\(\(\) => \(\) => \{\s*genRef\.current \+= 1/.test(br), true);
    const rb = src('src/components/RestBreath.jsx');
    ok('  휴식이 끝나면 묻는 중이어도 끈다', /breath\.phase === 'asking'\) breath\.stop\(\)/.test(rb), true);

    console.log('');
    if (bad > 0) { console.log(bad + '건 FAIL'); process.exit(1); }
    console.log('모두 통과');
    process.exit(0);
  } catch (err) {
    console.error('터짐:', err);
    process.exit(1);
  }
})();
