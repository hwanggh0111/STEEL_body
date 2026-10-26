// **막힌 403 을 사람 말로 바꾸는 자** (2026-10-24).
//
//   npm run block     (npm run check 에도 들어 있다)
//
// 서버는 정지된 사람에게 할 말을 다 적어 보낸다(까닭 · 기한). 그런데 그 403 을
// 읽는 자리가 앱에 한 곳도 없어서, 정지된 사람은 **까닭 없이 되돌아오는 로그인
// 화면**만 봤다 (`src/data/accountBlock.js` 머리글에 그 길을 적어뒀다).
//
// 여기가 지키는 것 둘 —
//   · **평범한 403 과 섞지 않는다.** 남의 줄을 건드린 403 에 「정지되었습니다」가
//     뜨면 그것이 더 나쁘다
//   · **없는 기한을 적지 않는다.** 영구 정지에 「풀리는 때」를 그리면 거짓말이다
// 「10월 31일(토) 15:12」는 **보는 사람의 시간대**로 적힌다 (앱도 그렇다).
// 검사가 돌아가는 컴퓨터의 시간대에 따라 답이 달라지면 안 되므로 여기서 고정한다
process.env.TZ = 'Asia/Seoul';
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const B = bundle('src/data/accountBlock.js', '.b1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 서버가 실제로 보내는 모양 (`backend/src/middleware/auth.js`)
const err = (status, data) => ({ response: { status, data } });
const UNTIL = '2026-10-31T06:12:45.123Z';
const suspended = err(403, { code: 'suspended', error: '계정이 정지되었습니다.', level: 3, reason: '욕설이 쌓여 7일 멈춤', expiresAt: UNTIL });

console.log('── 막힌 것만 집는다 ──');
ok('정지는 집는다', B.blockOf(suspended)?.kind, 'suspended');
ok('영구 정지도', B.blockOf(err(403, { code: 'banned', error: 'x' }))?.kind, 'banned');
ok('차단도', B.blockOf(err(403, { code: 'blocked', error: 'x' }))?.kind, 'blocked');
// **이쪽이 더 중요하다** — 평범한 403 에 「정지되었습니다」가 뜨면 거짓말이다
ok('남의 줄을 건드린 403 은 안 집는다', B.blockOf(err(403, { error: '권한이 없어요' })), null);
ok('  관리자 전용 길의 403 도', B.blockOf(err(403, { error: '관리자만 할 수 있어요' })), null);
ok('  모르는 코드도 안 집는다', B.blockOf(err(403, { code: 'teapot' })), null);
ok('401 · 429 · 500 은 안 집는다',
  [B.blockOf(err(401, { code: 'deleting' })), B.blockOf(err(429, {})), B.blockOf(err(500, {}))], [null, null, null]);
ok('응답이 없는 오류(망이 끊김)도 안 터진다',
  [B.blockOf({}), B.blockOf(null), B.blockOf(new Error('Network Error'))], [null, null, null]);

console.log('');
console.log('── 무엇을 보여주나 ──');
const b = B.blockOf(suspended);
ok('까닭을 그대로 들고 간다', b.reason, '욕설이 쌓여 7일 멈춤');
ok('기한을 사람 말로 적는다', b.untilLabel, '10월 31일(토) 15:12');   // 한국 시간
ok('  영구가 아니라고 안다', b.forever, false);
ok('빈 까닭은 안 그린다 (관리자가 손으로 건 것)',
  B.blockOf(err(403, { code: 'suspended', reason: '   ' })).reason, null);

const ban = B.blockOf(err(403, { code: 'banned', error: 'x' }));
ok('영구 정지에는 기한이 없다', [ban.forever, ban.untilLabel, ban.left], [true, null, null]);

console.log('');
console.log('── **주소가 막힌 것도 집는다** ── (2026-10-26)');
//
// AI 가드의 403 들에는 까닭 코드가 아예 없어서 **이 화면이 뜬 적이 없었다.**
// 더 나쁜 것은 입력 스캔으로 정지된 사람이다 — 그 벌은 계정 정지와 주소 차단을
// 같이 걸고, 주소 잠금은 **토큰을 보기 전에** 걸러진다. 즉 계정 쪽 403(`auth.js`)에
// 닿지도 못한다. 3일 동안 까닭을 한 번도 못 듣는 자리였다.
const ipBlocked = B.blockOf(err(403, {
  code: 'ip_blocked', error: '이 주소에서의 접근이 일시적으로 차단되었습니다.',
  level: 3, reason: '[AI Guard 판정] 위협 레벨: LEVEL 3', expiresAt: UNTIL, blockedUntil: UNTIL,
}));
ok('주소 차단을 집는다', ipBlocked?.kind, 'ip_blocked');
ok('  기한을 사람 말로 적는다', ipBlocked.untilLabel, '10월 31일(토) 15:12');
ok('  까닭을 들고 간다', /AI Guard 판정/.test(ipBlocked.reason), true);
// **계정 일이 아니다** — 로그아웃해도 안 풀린다. 화면이 그 단추를 안 그린다
ok('  계정 일이 아니라고 말해준다', ipBlocked.account, false);
ok('정지는 계정 일이다', b.account, true);
// 기한 이름이 두 벌이다 — 한쪽만 읽으면 「풀리는 때」가 조용히 사라진다
const onlyOld = B.blockOf(err(403, { code: 'ip_blocked', blockedUntil: UNTIL }));
ok('예전 이름(blockedUntil)만 와도 기한을 읽는다', onlyOld.untilLabel, '10월 31일(토) 15:12');
ok('  영구는 영구로 본다 (forever · permanent)',
  [B.blockOf(err(403, { code: 'ip_blocked', blockedUntil: 'forever' })).forever,
   B.blockOf(err(403, { code: 'suspended', expiresAt: 'permanent' })).forever], [true, true]);
ok('기한이 없으면 영구다 (레벨 4)', B.blockOf(err(403, { code: 'ip_blocked', level: 4 })).forever, true);

console.log('');
console.log('── 남은 시간 ──');
const REF = new Date('2026-10-24T12:00:00+09:00');
const at = (ms) => new Date(REF.getTime() + ms).toISOString();
ok('분', B.leftLabel(at(40 * 60000), REF), '40분 남음');
ok('시간', B.leftLabel(at(5 * 3600000), REF), '5시간 남음');
ok('일', B.leftLabel(at(3 * 86400000), REF), '3일 남음');
// 「0분 남음」을 보여주면 안 된다 — 그때는 이미 풀린 것이고 화면이 저절로 열려야 한다
ok('이미 지난 것은 안 적는다', B.leftLabel(at(-60000), REF), null);
ok('이상한 값도 안 터진다',
  [B.leftLabel('어제', REF), B.leftLabel(null, REF), B.untilLabel('어제'), B.untilLabel('permanent')],
  [null, null, null, null]);

console.log('');
console.log('── 읽고 그리는 자리가 이어져 있나 ──');
const client = fs.readFileSync('src/api/client.js', 'utf-8');
const app = fs.readFileSync('src/App.jsx', 'utf-8');
const screen = fs.readFileSync('src/components/AccountBlocked.jsx', 'utf-8');
ok('응답에서 읽는다', /blockOf\(err\)/.test(client), true);
ok('앱을 덮어 그린다', /<AccountBlocked \/>/.test(app), true);
ok('기한이 지나면 저절로 열린다', /location\.reload/.test(screen), true);
// 지금은 제보도 403 이다 — 보낼 수 없는 길을 가리키면 안 된다
ok('「지금 제보하세요」라고 하지 않는다', /지금은 제보도 보낼 수 없습니다/.test(screen), true);
// 할 수 없는 일을 단추로 내놓지 않는다 — 주소가 막힌 것은 로그아웃해도 안 풀린다
ok('계정 일일 때만 로그아웃을 그린다', /block\.account \?/.test(screen), true);
// 서버가 사람에게 보내는 글에는 `**굵게**` 가 적혀 있다. 그리는 자리가 관리자 화면
// 한 곳뿐이어서 **벌받은 사람만 별표를 글자로 읽고 있었다** (2026-10-26)
ok('까닭의 **굵게** 를 글자로 보여주지 않는다', /<Emphasis text=\{block\.reason\} \/>/.test(screen), true);
ok('  그 규칙은 한 자리에 있다', fs.existsSync('src/components/Emphasis.jsx'), true);


// ── 올리기 줄(큐)도 그것을 안다 ── (2026-10-24)
//
// 정지는 **그 줄의 잘못이 아니다.** 그런데 올리다 403 을 받고 「못 올렸어요」로
// 표시해 버리면, 표시된 줄은 다음 올리기에서 아예 빠지므로(`!q.failed`) 정지가
// 풀린 뒤에도 **사람이 「다시 시도」를 누를 때까지 영영 안 올라간다.**
// 헬스장에서 적어둔 기록이라 값이 크다
const wq = fs.readFileSync('src/store/workoutStore.js', 'utf-8');
const nq = fs.readFileSync('src/store/noteStore.js', 'utf-8');
const bar = fs.readFileSync('src/components/OfflineBar.jsx', 'utf-8');
ok('운동 줄은 막혔으면 표시 없이 멈춘다', /if \(blockOf\(err\)\) \{ blocked = true; break; \}/.test(wq), true);
ok('메모 줄도 같다', /if \(blockOf\(err\)\) \{ blocked = true; break; \}/.test(nq), true);
// 「막혔다」를 부르는 쪽까지 들고 간다 (10/24 늦게 `tooFastMs` 가 같이 붙었다)
ok('  멈춘 것을 부르는 쪽에 알려준다',
  /stopped, blocked,/.test(wq) && /stopped, blocked,/.test(nq), true);
ok('막혀서 멈춘 것에 「신호가 없어요」라고 하지 않는다', /a\.blocked \|\| b\.blocked/.test(bar), true);

console.log('');
console.log(bad === 0 ? '모두 통과' : bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
