// 계정 삭제를 화면 없이 돌려본다.
//
//   npm run check
//
// 이건 **되돌릴 수 없는 일**이라 눈으로 한 번 보고 넘어가면 안 되는 자리다.
// 확인할 것이 셋이다.
//
//   1. 지운 뒤에 **정말 아무것도 안 남는가** — 8/31 까지 일곱 갈래가 남고 있었다
//      (제보 · 별점 · 알림설정 · 푸시구독 · 루틴진행 · 정지기록 · 욕설기록).
//      제보에는 쓴 글과 기기 정보가 들어 있고, 관리자 확인창은 그때도
//      「제보가 전부 사라집니다」라고 적고 있었다. 「지웠다」가 거짓말이었다.
//   2. 30일 **전에는 안 지워지고, 지나면 지워지는가**
//   3. 다시 로그인하면 **되살아나는가**
//
// 진짜 DB 는 건드리지 않는다 — DB_FILE 로 임시 파일을 가리킨 뒤 지운다.
const fs = require('fs');
const path = require('path');

const TMP = path.join(__dirname, '..', '.check-account.json');
for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
process.env.DB_FILE = TMP;
const db = require('../src/db');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
// 파일은 0.5초 뒤에 쓰인다. 검사가 파일을 읽으면 옛 내용을 본다 — 램을 본다
const raw = () => db.snapshot();
const DAY = 24 * 60 * 60 * 1000;

console.log('── 계정 삭제 ──');

// 사람 둘. 한 명은 지우고 한 명은 남는다 — **남는 사람 것까지 지우면 더 큰일이다**
db.createUser('gone@test.local', 'hash1', '지울사람', 'gone');
db.createUser('stay@test.local', 'hash2', '남을사람', 'stay');
const gone = db.findUserByEmail('gone@test.local').id;
const stay = db.findUserByEmail('stay@test.local').id;

// 한 사람에게 붙는 것을 갈래마다 하나씩 심는다. 두 사람 것을 같이 심어야
// 「내 것만 지웠는가」를 볼 수 있다
// **목록을 여기 따로 적는다.** db 의 목록을 그대로 가져다 심으면, 거기서 하나를
// 빠뜨려도 검사가 같이 빠뜨려서 늘 통과한다 — 검사가 코드를 따라가면 안 된다
const ALL = ['workouts', 'inbody', 'measures', 'myRoutines', 'refreshTokens',
             'reports', 'ratings', 'reminders', 'pushSubs', 'routineSessions',
             'suspensions', 'abuseLogs'];
const seed = db.snapshot();
for (const key of ALL) {
  seed[key] = [{ id: 1, user_id: gone }, { id: 2, user_id: stay }];
}

ok('한 사람에게 붙는 갈래를 열둘로 적어뒀다', ALL.filter(k => !db.USER_COLLECTIONS.includes(k)), []);
// 목록에서 빠뜨린 갈래가 있으면 그 갈래만 조용히 남는다.
// DB 에 실제로 있는 것 중 user_id 를 쓰는 것은 전부 목록에 있어야 한다
const withUser = Object.entries(raw())
  .filter(([k, v]) => Array.isArray(v) && v.some(r => r && r.user_id !== undefined))
  .map(([k]) => k);
ok('user_id 를 쓰는 갈래가 전부 목록에 있다 (빠뜨리면 그것만 남는다)',
  withUser.filter(k => !db.USER_COLLECTIONS.includes(k)), []);

// ── 1. 예약 ──
const info = db.requestUserDeletion(gone, new Date('2026-09-01T00:00:00.000Z'));
ok('예약하면 30일 뒤로 날이 잡힌다', info.delete_due_at, '2026-10-01T00:00:00.000Z');
ok('예약해도 사람은 아직 있다', !!db.findUserById(gone), true);
ok('예약하면 로그인 유지 열쇠는 그 자리에서 걷힌다',
  raw().refreshTokens.filter(t => t.user_id === gone), []);
ok('남을 사람 것은 안 건드린다', raw().refreshTokens.filter(t => t.user_id === stay).length, 1);

// ── 2. 유예 안에는 안 지운다 ──
ok('29일째에는 지울 것이 없다', db.dueDeletions(new Date('2026-09-30T00:00:00.000Z')).length, 0);
ok('30일이 지나면 지울 것으로 잡힌다',
  db.dueDeletions(new Date('2026-10-01T00:00:01.000Z')).map(u => u.id), [gone]);
// 예약 안 한 사람이 여기 섞이면 멀쩡한 사람이 지워진다
ok('예약 안 한 사람은 아무리 지나도 안 잡힌다',
  db.dueDeletions(new Date('2030-01-01T00:00:00.000Z')).map(u => u.id), [gone]);

// ── 3. 되살리기 ──
ok('다시 로그인하면 되살아난다', db.cancelUserDeletion(gone), true);
ok('되살아나면 지울 것에서 빠진다', db.dueDeletions(new Date('2030-01-01T00:00:00.000Z')).length, 0);
ok('되살린 사람은 날짜가 지워져 있다',
  ['deleting_at', 'delete_due_at'].filter(k => k in db.findUserById(gone)), []);
ok('예약한 적 없는 사람을 되살리려 해도 안 터진다', db.cancelUserDeletion(stay), false);

// ── 4. 진짜로 지운다 ──
db.requestUserDeletion(gone, new Date('2026-09-01T00:00:00.000Z'));
db.deleteUserCompletely(gone);
ok('지우면 사람이 없다', db.findUserById(gone) || null, null);
// 여기가 8/31 에 거짓말이던 자리다
const left = ALL.filter(k => (raw()[k] || []).some(r => r.user_id === gone));
ok('지우면 열두 갈래에 아무것도 안 남는다', left, []);
ok('남을 사람 것은 열둘 다 그대로다',
  ALL.filter(k => !(raw()[k] || []).some(r => r.user_id === stay)), []);
ok('남을 사람은 그대로 있다', !!db.findUserById(stay), true);

// ── 5. 비밀번호를 모르는 사람 ──
// 소셜로만 들어온 계정은 가입할 때 난수를 비밀번호로 넣는다. 그런 사람에게
// 비밀번호를 물으면 **영영 못 지운다**
ok('소셜로 만든 계정은 비밀번호를 안 묻는다', db.isSocialAccount({ username: 'naver_1a2b3c4d' }), true);
ok('구글도 마찬가지', db.isSocialAccount({ username: 'google_00ff11aa' }), true);
ok('이메일로 가입한 사람에게는 비밀번호를 묻는다', db.isSocialAccount({ username: 'hgh0901011' }), false);
// 아이디를 'naver_' 로 시작하게 짓는 사람이 있을 수 있다 — 여덟 자리 16진수까지 맞아야 한다
ok('이름만 비슷한 아이디는 소셜이 아니다', db.isSocialAccount({ username: 'naver_hello' }), false);
ok('아이디가 없어도 안 터진다', db.isSocialAccount({}), false);

for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
