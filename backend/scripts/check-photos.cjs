// 홈페이지 사진 — 관리자가 걸고 누구나 보는 것 (2026-09-16).
//
//   npm run photos     (npm run check 에도 들어 있다)
//
// **눈으로 보기 제일 어려운 자리다.** 화면에서 확인하려면 관리자로 로그인해 사진을
// 여러 장 올리고 순서를 바꿔봐야 하고, 「계정을 지워도 사이트 사진은 남는가」는
// 아예 확인할 방법이 없다(관리자 계정을 지워봐야 한다). 그래서 값으로 본다.
const path = require('path');
const fs = require('fs');

// 진짜 DB 를 건드리지 않는다. 검사용 파일을 따로 쓰고 끝나면 지운다
const TMP = path.join(__dirname, '..', '.photos-check.json');
process.env.DB_FILE = TMP;

const db = require('../src/db');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const IMG = 'data:image/png;base64,iVBORw0KGgo=';
const names = () => db.getSitePhotos().map((p) => p.caption);

console.log('── 홈페이지 사진 ──');

const a = db.addSitePhoto(IMG, '첫째');
const b = db.addSitePhoto(IMG, '둘째');
const c = db.addSitePhoto(IMG, '셋째');

// **새로 올린 것이 맨 뒤에 붙는다.** 위로 튀어 오르면 걸어둔 차례가 흐트러진다
ok('올린 차례대로 선다', names(), ['첫째', '둘째', '셋째']);
ok('번호가 겹치지 않는다', new Set([a.id, b.id, c.id]).size, 3);

// 순서는 한 칸씩만. 자리 번호를 통째로 받으면 화면과 어긋났을 때 엉뚱한 자리로 튄다
db.moveSitePhoto(c.id, 'up');
ok('한 칸 위로', names(), ['첫째', '셋째', '둘째']);
db.moveSitePhoto(c.id, 'down');
ok('한 칸 아래로', names(), ['첫째', '둘째', '셋째']);

// **끝에서 더 밀어도 실패가 아니다.** 실패로 답하면 화면이 「못 바꿨어요」를 띄우는데,
// 맨 위에서 위로 누른 것은 잘못한 일이 아니다
ok('맨 위에서 위로 눌러도 탈이 없다', db.moveSitePhoto(a.id, 'up'), true);
ok('  차례도 그대로', names(), ['첫째', '둘째', '셋째']);
ok('맨 아래에서 아래로 눌러도 탈이 없다', db.moveSitePhoto(c.id, 'down'), true);
ok('없는 사진은 못 옮긴다', db.moveSitePhoto(9999, 'up'), false);

ok('설명을 고친다', db.updateSitePhoto(b.id, '고친 설명').caption, '고친 설명');
ok('없는 사진은 못 고친다', db.updateSitePhoto(9999, 'x'), null);

// **가운데를 지워도 남은 차례는 안 흐트러진다** (자리 번호를 들고 있기 때문이다)
ok('가운데를 지운다', db.deleteSitePhoto(b.id), true);
ok('  남은 차례 그대로', names(), ['첫째', '셋째']);
ok('없는 사진은 못 지운다', db.deleteSitePhoto(9999), false);

// ── 여기가 이 검사의 핵심 ──
//
// 사람 사진(profile · before · after)과 **같은 파일**에 살지만 줄이 다르다.
// 섞여 있으면 **관리자가 계정을 지우는 날 사이트의 사진이 같이 사라진다.**
db.savePhoto(1, 'profile', IMG);
ok('사람 사진과 같은 파일에 있다', db.getPhotos(1).length, 1);
db.deleteUserPhotos(1);
ok('계정을 지우면 사람 사진은 지워지고', db.getPhotos(1).length, 0);
ok('  홈페이지 사진은 남는다', names(), ['첫째', '셋째']);

// 검사가 만든 파일은 스스로 치운다. **먼저 파일에 쓴 다음 지운다** —
// 안 그러면 지운 뒤에 미뤄둔 쓰기가 다시 써놓는다
if (typeof db.flushNow === 'function') db.flushNow();
setTimeout(() => {
  for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
}, 700);
