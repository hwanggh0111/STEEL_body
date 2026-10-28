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

// 나가는 길에 임시 DB 를 치운다 — `db.js` 의 exit 손이 되살리는 것까지 (2026-10-28)

require('./_tmpdb.cjs')(TMP);

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

// ── 필요한 것만 받는가 ── (2026-10-05)
//
// 껍데기가 앱을 열 때마다 `/photos` 를 부른다. 그냥 부르면 **세 장을 base64 로
// 통째로**(최대 6MB) 받는데, 거기서 쓰는 것은 32px 아바타 하나다.
// `?type=profile` 로 한 장만 받게 고쳤고, **되돌아가기 쉬운 자리**라 못을 박는다 —
// 누가 params 를 지워도 화면은 똑같이 보이고 느려지기만 한다.
const layoutSrc = fs.readFileSync('../frontend/src/components/Layout.jsx', 'utf-8');
ok('껍데기는 프로필 한 장만 받는다',
  /client\.get\('\/photos',\s*\{\s*params:\s*\{\s*type:\s*'profile'\s*\}/.test(layoutSrc), true);
const routeSrc = fs.readFileSync('src/routes/photos.js', 'utf-8');
ok('  서버가 type 을 거른다', /req\.query\.type/.test(routeSrc), true);
// 오타(`?type=profil`)에 빈 배열을 주면 화면이 「사진 없음」으로 읽고 있던 것을 지운다
ok('  아는 칸 이름일 때만 거른다', /PHOTO_TYPES\.includes\(want\)/.test(routeSrc), true);
// 비교 화면은 셋이 다 필요하다 — 아무것도 안 주면 전부 와야 한다
const compareSrc = fs.readFileSync('../frontend/src/pages/ComparePage.jsx', 'utf-8');
ok('  비교 화면은 그대로 전부 받는다', /client\.get\('\/photos'\)/.test(compareSrc), true);


console.log('');
console.log('── 깨진 파일을 덮어쓰지 않는가 ── (2026-09-19 · 10/20 에 사진도)');
//
// 읽다가 터지면(`JSON.parse` 실패) 둘 다 **빈 것으로 시작한다** — 그래야 앱이 뜬다.
// 그런데 그 다음 저장이 **깨진 파일을 덮어쓴다.** 원자적 쓰기를 붙인 뒤로는 거의 없는
// 일이지만, 그 「거의」에 걸리는 날은 **기록 전부가 걸린 날**이다.
//
// 본 DB 는 9/19 부터 옆으로 치워뒀는데(`*.broken-<시각>`) **사진은 안 하고 있었다.**
// 사진은 base64 덩어리라 한 번 덮으면 되살릴 길이 없다. 10/20 에 같은 대접을 한다.
{
  const dbSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'db.js'), 'utf8');
  const main = dbSrc.indexOf('blackiron.json 파싱 실패');
  const photo = dbSrc.indexOf('photos.json 파싱 실패');
  const near = (at) => dbSrc.slice(at, at + 420);
  ok('본 DB 는 깨진 파일을 치워둔다', /keepBroken\(storage\.MAIN\)/.test(near(main)), true);
  ok('  사진도 치워둔다', /keepBroken\(storage\.PHOTOS\)/.test(near(photo)), true);
  // 치우다 또 터져도 앱은 떠야 한다 — 거기서 던지면 서버가 아예 안 뜬다
  ok('  치우다 터져도 앱은 뜬다', (near(photo).match(/catch \(e2\)/g) || []).length, 1);
  // 옆으로 치운 이름에 **시각**이 들어가야 두 번째 사고가 첫 번째를 안 덮는다
  ok('치운 이름에 시각이 들어간다', /broken-' \+ new Date\(\)\.toISOString\(\)/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'storage.js'), 'utf8')), true);
}

console.log('');
console.log('── 바깥에서 사진 파일을 바꾸면 ── (2026-10-24)');
//
// DB 는 램에 있고 파일은 그것을 흘려둔 자취다. 램이 늘 이기면 서버가 떠 있는 동안
// 바깥의 고침이 **다음 저장 한 번에 조용히 되돌아간다.** 본체는 9/30 부터 이것을
// 보는데 **사진은 안 보고 있었다** — 백업에서 사진 파일을 되돌려 놓고(서버를 안
// 내리고) 프로필 사진 한 장을 바꾸면 되돌려 놓은 판이 옛 판으로 덮인다.
// **사진은 base64 덩어리라 한 번 덮으면 되살릴 길이 없다.**
const photoFile = TMP.replace(/\.json$/, '') + '.photos.json';
{
  // 지금까지 적은 것을 파일로 내린다
  if (typeof db.flushPhotosNow === 'function') db.flushPhotosNow();
  else if (typeof db.flushNow === 'function') db.flushNow();
}
setTimeout(() => {
  const before = db.getSitePhotos().length;
  ok('지금 걸린 사진 수를 안다', before > 0, true);

  // **바깥에서** 한 장을 더해 놓는다 (백업에서 되돌린 자리를 흉내 낸다)
  const onDisk = JSON.parse(fs.readFileSync(photoFile, 'utf8'));
  // 홈페이지 사진은 같은 파일의 `sitePhotos` 에 있다 (사람 사진은 `photos`)
  if (!Array.isArray(onDisk.sitePhotos)) onDisk.sitePhotos = [];
  onDisk.sitePhotos.push({
    id: 9999, data: IMG, caption: '바깥에서 넣은 것',
    order: 99, created_at: new Date().toISOString(),
  });
  // 시각이 바뀌어야 한다 — 같은 밀리초에 쓰면 못 본다
  const t = Date.now() + 1500;
  fs.writeFileSync(photoFile, JSON.stringify(onDisk), 'utf8');
  fs.utimesSync(photoFile, new Date(t), new Date(t));

  // 다음 읽기에서 **파일 쪽을 읽어 맞춘다** (안 쓴 것이 없을 때만).
  // 파일 시각을 보는 일은 **1초에 한 번으로 묶여 있다**(요청마다 stat 하지 않는다) —
  // 그래서 그만큼 기다렸다 본다. 실제로도 최대 1초 늦게 따라온다
  setTimeout(() => {
    const after = db.getSitePhotos();
    ok('바깥에서 넣은 것이 보인다', after.some((p) => p.caption === '바깥에서 넣은 것'), true);
    ok('  있던 것도 그대로다', after.length, before + 1);

    // 그 다음 저장이 **바깥의 고침을 안 지운다** (이것이 이 버그였다)
    db.addSitePhoto(IMG, '그 뒤에 올린 것');
    const names2 = db.getSitePhotos().map((p) => p.caption);
    ok('그 뒤에 저장해도 안 사라진다', names2.includes('바깥에서 넣은 것'), true);
    ok('  새로 올린 것도 있다', names2.includes('그 뒤에 올린 것'), true);

    finish();
  }, 1200);
}, 800);

function finish() {
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
}
