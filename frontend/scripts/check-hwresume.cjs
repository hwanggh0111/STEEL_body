// 홈트에서 **멈춘 자리를 담아두는 것**이 맞는가 (2026-10-27)
//
//   npm run hwresume     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 「일시정지」는 10/24 에 생겼는데 멈춘 자리가 **화면이 들고 있는 값**이었다.
// 그래서 화면을 벗어나면 통째로 사라졌다 — 쉬는 20초에 기록을 들여다보고 와도,
// 알림을 따라 나갔다 와도, 앱이 뒤로 밀렸다 와도 **처음부터**였다.
//
// 이 자리는 **손으로 확인하기가 거의 안 된다** —
//
//   · 담아둔 글자가 깨졌을 때 (브라우저를 손으로 고쳐야 한다)
//   · 판을 갈아끼워 적혀 있던 이름이 없어졌을 때
//   · 여섯 시간이 지났을 때 · 기기 시계가 앞날로 돌아가 있을 때
//   · 칸 수가 줄어 적혀 있던 번호가 밖으로 나갔을 때
//
// 그래서 값으로 본다. 그리고 **화면 쪽도 글자로 센다** — 담아둔 것을 지우는 자리와
// 떠나는 길을 다 듣는 자리.
//
// ★ **주석을 걷고 센다.** 까닭을 주석에 길게 적어두는 집이라, 글자만 세면
// 「고쳤다는 주석」을 고친 코드로 읽는다 (10/26 에 두 번 밟았다).

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
const yes = (name, cond, why) => {
  if (!cond) bad += 1;
  console.log((cond ? 'OK   ' : 'FAIL ') + name + (cond ? '' : ' — ' + why));
};

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const R = bundle('src/data/homeworkoutResume.js', '.hwresume.cjs');
const PR = bundle('src/data/homeworkoutPrograms.js', '.hwprog.cjs');

const NOW = 1761523200000;                      // 2026-10-27 쯤. 고정 시각으로 본다
const NAME = '기능성(특수부대식)';
const PROGRAMS = PR.PROGRAMS;
const LEN = PROGRAMS[NAME].length;

// 담아둔 글자를 만든다 (화면이 적는 그 꼴 그대로)
const stash = (over = {}) => JSON.stringify({
  program: NAME, idx: 3, rest: false, leftMs: 12000, skipped: [1], at: NOW - 60000, ...over,
});
const read = (raw, now = NOW) => R.readResume(raw, { programs: PROGRAMS, now });

console.log('── 담아둔 것을 읽는다 ──');
ok('멀쩡한 것', read(stash()), { program: NAME, idx: 3, rest: false, leftMs: 12000, skipped: [1], at: NOW - 60000 });
ok('쉬는 칸', read(stash({ rest: true })).rest, true);

console.log('\n── 믿을 수 없는 것은 안 이어준다 ──');
ok('깨진 글자', read('{안녕'), null);
ok('빈 글자', read(''), null);
ok('null', read(null), null);
ok('글자가 아닌 것', read('12'), null);
ok('판 이름이 없다', read(stash({ program: '' })), null);
ok('없어진 판', read(stash({ program: '옛날 판' })), null);
ok('칸 번호가 밖으로', read(stash({ idx: LEN })), null);
ok('칸 번호가 음수', read(stash({ idx: -1 })), null);
ok('남은 것이 0', read(stash({ leftMs: 0 })), null);
ok('남은 것이 음수', read(stash({ leftMs: -5000 })), null);
ok('남은 것이 숫자가 아님', read(stash({ leftMs: 'abc' })), null);
ok('여섯 시간 넘음', read(stash({ at: NOW - R.RESUME_MAX_MS - 1000 })), null);
ok('여섯 시간 안쪽', read(stash({ at: NOW - R.RESUME_MAX_MS + 1000 })) !== null, true);
ok('앞날에 멈췄다', read(stash({ at: NOW + 600000 })), null);
ok('시계가 조금 어긋난 것은 받는다', read(stash({ at: NOW + 30000 })) !== null, true);
ok('멈춘 시각이 없다', read(stash({ at: null })), null);

console.log('\n── 지어낸 시간으로 안 이어준다 ──');
ok('한 칸 상한', read(stash({ leftMs: 99 * 60 * 1000 })).leftMs, R.LEFT_MAX_MS);

console.log('\n── 넘긴 번호 ──');
ok('겹친 것 · 차례 · 음수', read(stash({ skipped: [5, 1, 5, -2, 1] })).skipped, [1, 5]);
ok('칸 밖의 번호는 뺀다', read(stash({ skipped: [1, LEN + 3] })).skipped, [1]);
ok('배열이 아니면 빈 것', read(stash({ skipped: 'x' })).skipped, []);
ok('Set 도 받는다', R.packResume({ program: NAME, idx: 1, leftMs: 100, at: NOW, skipped: new Set([2, 0]) }).skipped, [0, 2]);

console.log('\n── 쉬는 칸이라고 적혀 있는데 쉬는 시간이 없는 동작 ──');
// 판의 마지막 동작은 쉬는 시간이 0 인 것이 있다 — 그 자리에서 「쉬는 중」은 어긋난 것이다
const noRest = PROGRAMS[NAME].findIndex((e) => !(Number(e.rest) > 0));
if (noRest < 0) {
  console.log('SKIP 쉬는 시간이 0 인 칸이 이 판에 없다');
} else {
  ok(`${noRest + 1}번째는 쉬는 시간이 0`, read(stash({ idx: noRest, rest: true })), null);
  ok(`${noRest + 1}번째를 운동으로는 이어준다`, read(stash({ idx: noRest, rest: false })) !== null, true);
}

console.log('\n── 한 줄로 적는 글자 (두 곳이 같이 쓴다) ──');
ok('운동에서 멈춤', R.resumeLine({ idx: 7, rest: false, leftMs: 11500 }), '8번째 운동에서 멈췄어요 · 12초 남음');
ok('휴식에서 멈춤', R.resumeLine({ idx: 0, rest: true, leftMs: 1 }), '1번째 휴식에서 멈췄어요 · 1초 남음');
ok('올림으로 센다', R.leftSeconds(11001), 12);
ok('칸이 없으면 안 적는다', R.resumeLine({}), null);

// ──────────────────────────────────────────────────────────────
// 화면 쪽은 **주석을 걷고** 센다
// ──────────────────────────────────────────────────────────────
//
// 글자만 세면 까닭을 적어둔 주석이 코드로 읽힌다. 문자열 · 템플릿 안의 `//` 도
// 주석으로 읽으면 안 된다 — 한 글자씩 보며 걷는다.
function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      out += c; i += 1;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') { out += src[i]; i += 1; }
        if (i < src.length) { out += src[i]; i += 1; }
      }
      out += c; i += 1; continue;
    }
    out += c; i += 1;
  }
  return out;
}

const PAGE = path.join(__dirname, '..', 'src', 'pages', 'HomeworkoutPage.jsx');
const code = stripComments(fs.readFileSync(PAGE, 'utf8'));
const count = (re) => (code.match(re) || []).length;

console.log('\n── 화면 (주석을 걷고 센다) ──');
yes('주석이 걷혔다', !code.includes('무엇이 잘못돼 있었나'), '주석 걷는 자리가 안 듣는다 — 아래 셈을 못 믿는다');

// 거는 자리 : 푸는 자리. 10/26 에 블랙리스트가 2:0 으로 나온 그 셈이다
// **끄는 자리가 진짜로 끄는지**까지 본다. `stopBreath` 를 빈 껍데기로 두면
// 부르는 자리는 그대로라 세기만 해서는 안 잡힌다 (되돌려 보고 알았다)
yes('끄는 자리가 진짜로 끈다', /const stopBreath = \(\) => \{[^}]*breath\.stop\(/.test(code),
  'stopBreath 가 아무것도 안 한다 — 부르는 자리만 있고 꺼지지는 않는다');
const starts = count(/breath\.start\(/g);
const stops = count(/stopBreath\(\)/g);
yes(`마이크 거는 자리 ${starts} : 푸는 자리 ${stops}`, starts > 0 && stops >= starts,
  '켜는 자리만 있고 끄는 자리가 모자란다 — 판을 그만둬도 녹음 표시가 남는다');

const writes = count(/saveLS\(HOME_RESUME_KEY/g);
const clears = count(/removeLS\(HOME_RESUME_KEY/g);
yes(`담아두는 자리 ${writes} : 지우는 자리 ${clears}`, writes > 0 && clears > 0,
  '담아두기만 하면 끝낸 판이 「멈춘 자리」로 계속 뜬다');
yes('지우는 자리를 네 곳이 부른다', count(/clearStash\(\)/g) >= 4,
  '처음부터 · 그만두기 · 끝냄 · 기록함 넷에서 지워야 한다');

yes('떠나는 길 셋을 다 듣는다',
  code.includes("addEventListener('visibilitychange'") && code.includes("addEventListener('pagehide'")
  && /return \(\) => \{[\s\S]{0,400}stashRef\.current\(\)/.test(code),
  '폰에서는 앱이 뒤로 밀리는 것이 더 흔하다 — 하나만 들으면 그 길로 나간 사람은 처음부터 한다');

yes('일시정지가 재던 회복 칸을 버린다',
  /const pauseProgram = \(\) => \{[\s\S]{0,600}recRef\.current = null/.test(code),
  '멈춰 있던 시간이 「숨이 가라앉는 데 걸린 초」로 이력에 쌓인다');

yes('일시정지가 마이크를 끈다',
  /const pauseProgram = \(\) => \{[\s\S]{0,900}stopBreath\(\)/.test(code),
  '폰을 딴 데 쓰려고 누른 단추인데 숨을 계속 듣는다');

yes('끝 화면이 떠둔 기준선을 쓴다',
  code.includes('hardestOf(peaksRef.current, baseSeenRef.current)') && !/hardestOf\([^)]*breath\.base/.test(code),
  '마이크를 끄면 기준선이 null 이 되어 「숨이 제일 찼던 동작」이 통째로 사라진다');

yes('멈춘 자리 한 줄을 두 곳이 같이 쓴다', count(/resumeLine\(/g) >= 2,
  '목록 카드와 판 화면이 따로 세면 하나만 고치는 날이 온다');

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
