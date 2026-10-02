// 보안 로그의 **이름표가 서버를 따라가는가** (2026-10-02).
//
//   npm run logtypes     (npm run check 에도 들어 있다)
//
// 「해킹 보안」 화면은 로그 종류를 한국어로 바꿔 보여준다(`TYPES`). 모르는 종류가 오면
// **영문 키를 그대로 뿌린다** — 관리자 화면에 `username_change` · `refresh_reuse` 가
// 그냥 적힌다. 고장은 아니지만, 읽는 사람에게는 **안 만든 화면과 같은 것**이다.
//
// 이 자리는 **반드시 어긋난다.** 서버에 `addLog('새종류')` 를 한 줄 더하는 일과 화면의
// 표를 고치는 일은 파일이 다르고, 보통 한쪽만 한다. 실제로 열아홉 종류를 맞춰둔 뒤
// 10/2 에 다시 세어보니 **일곱이 밀려 있었다**(계정 삭제 셋 · 로그인 잠금 해제 ·
// 리프레시 토큰 둘 · 아이디 변경).
//
// 그래서 **양쪽을 같이 읽어 견준다.** 눈으로 보려면 그 종류의 일이 실제로 일어나야 한다
// (쓴 토큰 재사용 · 계정 삭제 실패 같은 것은 일부러 만들기도 어렵다).
const fs = require('fs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// ── 서버가 남기는 종류 ──
//
// `addLog('...')` 의 첫 값만 센다. 변수로 넘기는 자리는 없다(있으면 여기서 못 잡으니
// 그때는 이 검사도 같이 고쳐야 한다 — 아래에서 그것도 본다).
const ROUTES = 'src/routes';
const BACK = '../backend/';
const serverSrc = fs.readdirSync(BACK + ROUTES)
  .filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(BACK + ROUTES + '/' + f, 'utf-8'))
  .concat(
    fs.readdirSync(BACK + 'src/middleware')
      .filter((f) => f.endsWith('.js'))
      .map((f) => fs.readFileSync(BACK + 'src/middleware/' + f, 'utf-8')),
  )
  .join('\n');

const serverTypes = [...new Set(
  [...serverSrc.matchAll(/addLog\(\s*'([^']+)'/g)].map((m) => m[1]),
)].sort();

// 변수로 넘기는 자리가 생기면 위의 셈이 조용히 틀린다 — 그때 알아야 한다.
//
// **함수를 만드는 줄은 세지 않는다** (`function addLog(type, detail)`). 그것은 부르는
// 자리가 아니라 받는 자리다 — 안 빼면 이 검사가 언제나 실패해서, 곧 지워진다
const dynamic = [...serverSrc.matchAll(/addLog\(\s*([^'\s)][^,)]*)/g)]
  // 바로 앞에 `function` 이 있으면 만드는 줄이다
  .filter((m) => !/function\s+$/.test(serverSrc.slice(Math.max(0, m.index - 12), m.index)))
  .map((m) => m[1].trim());

// ── 화면이 아는 종류 ──
const panel = fs.readFileSync('src/components/HackingSecurityPanel.jsx', 'utf-8');
const block = panel.match(/const TYPES = \{([\s\S]*?)\n\};/);
if (!block) {
  console.log('FAIL 화면의 TYPES 표를 못 찾았다 — 이 검사가 먼저 고쳐져야 한다');
  process.exit(1);
}
const uiTypes = [...new Set(
  [...block[1].matchAll(/^\s+'?([A-Za-z_-]+)'?:\s*\{/gm)].map((m) => m[1]),
)].sort();

console.log('── 서버가 남기는 것을 화면이 다 아는가 ──');
console.log(`   서버 ${serverTypes.length}종 · 화면 ${uiTypes.length}종`);
const missing = serverTypes.filter((t) => !uiTypes.includes(t));
ok('이름표가 없는 종류', missing, []);

console.log('');
console.log('── 화면에만 있는 이름표는 없는가 ──');
//
// 아무도 안 남기는 종류를 표에 두면 **죽은 규칙**이다. 「토큰 만료」가 그랬다 —
// 서버는 그 종류를 한 번도 남기지 않는데 표에 적혀 있었고, 그래서 「그런 기록이
// 오는구나」라고 믿게 된다 (`repCount.js` 에서 걷어낸 것과 같은 종류)
const extra = uiTypes.filter((t) => !serverTypes.includes(t));
ok('아무도 안 남기는 이름표', extra, []);

console.log('');
console.log('── 이 검사가 눈을 감고 있지 않은가 ──');
ok('addLog 를 변수로 부르는 자리는 없다', dynamic, []);
ok('  서버 종류를 실제로 찾아냈다', serverTypes.length > 10, true);

console.log('');
console.log(bad ? bad + '건 실패' : '전부 통과');
process.exit(bad ? 1 : 0);
