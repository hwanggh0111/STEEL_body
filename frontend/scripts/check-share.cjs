// 사진을 **폰 밖으로 내보내는 길**이 서 있는가 (2026-10-15)
//
//   npm run share     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 여태 길은 `a.download` 하나였다. PC 에서는 된다 — 그래서 **내 컴퓨터에서는 아무
// 문제가 없어 보인다.** 폰에서만 막힌다(앱 웹뷰는 `blob:` 내려받기를 잡아줄 자리가
// 없고, 폰 브라우저도 여러 장을 연달아 받으면 둘째부터 막는다).
//
// 그래서 공유 시트를 먼저 쓰게 했다. 그런데 이 자리는 **되돌아가기 쉽다** —
// 공유는 PC 에서 시험이 안 되니, 누가 「안 되는 것 같다」며 내려받기만 남겨도
// 검사 없이는 아무도 모른다.
//
// 보는 것 셋 —
//   1. 취소를 **실패와 가르는가** (사람이 시트를 닫은 것에 「못 보냈어요」가 뜨면 안 된다)
//   2. 공유가 안 되는 기기에서 **내려받기로 이어지는가**
//   3. 전·후를 **한 장으로 합치는 계산**이 맞는가 (비율 · 한 장만 있을 때)

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// ── 브라우저 흉내 ──
const bundle = (entry, out) => {
  esbuild.buildSync({
    entryPoints: [entry], bundle: true, format: 'cjs', outfile: out,
    platform: 'node', define: { 'import.meta.env': '{}' }, logLevel: 'silent',
  });
  const m = require(path.resolve(out));
  fs.unlinkSync(out);
  return m;
};

global.File = class FakeFile {
  constructor(parts, name, opts) { this.parts = parts; this.name = name; this.type = (opts || {}).type; }
};
global.Blob = class FakeBlob {
  constructor(parts, opts) { this.parts = parts; this.type = (opts || {}).type || ''; }
};
global.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');

// Node 24 는 `navigator` 를 **제 것으로 들고 있다** — `global.navigator = …` 는
// 조용히 안 먹는다(그래서 처음에 여섯 건이 「공유를 못 하는 기기」로 읽혔다 —
// 코드가 아니라 흉내가 틀린 것이었다). 자리를 바꿔 끼운다
function setNavigator(v) {
  Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true, writable: true });
}

let shareCalls = [];
let shareBehavior = 'ok';
setNavigator({
  canShare: (data) => Array.isArray(data.files) && data.files.length > 0,
  share: async (data) => {
    shareCalls.push(data);
    if (shareBehavior === 'cancel') { const e = new Error('닫음'); e.name = 'AbortError'; throw e; }
    if (shareBehavior === 'blocked') { const e = new Error('손짓 차례가 끊김'); e.name = 'NotAllowedError'; throw e; }
  },
});

const share = bundle('src/data/sharePhotos.js', '.share.cjs');

// 1×1 짜리 참 jpeg (base64) — 모양만 맞으면 된다
const TINY = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDIzNP/AABEIAAEAAQMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoLDBAAEQACAgEDAgQDBQUEBAAAAX0AAQIDAAQRBSExQQYSUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoLDBAAEQACAgEDAgQDBQUEBAAAAX0AAQIDBAUGBwgJCgv/2gAMAwEAAhEDEQA/AJQA/9k=';

console.log('── 무엇을 보낼 수 있나 ──');
ok('파일이 없으면 공유를 안 묻는다', share.canShareFiles([]), false);
ok('파일이 있으면 공유할 수 있다', share.canShareFiles([new File([], 'a.jpg')]), true);
ok('단추 글자를 정할 수 있다 (share · canShare 둘 다 있다)', share.shareSheetLikely(), true);

const files = share.toFiles([{ type: 'before', dataUrl: TINY, at: '2026-06-02' }]);
ok('사진을 파일로 만든다', files.length, 1);
ok('이름에 날짜가 들어간다', /2026-06-02/.test(files[0].name), true);
ok('망가진 것은 건너뛴다', share.toFiles([{ dataUrl: 'data:text/plain;base64,aaa' }]).length, 0);

console.log('\n── 보냈나 · 닫았나 · 막혔나 ──');
(async () => {
  shareBehavior = 'ok'; shareCalls = [];
  ok('보내면 shared', await share.shareFiles(files, { title: 'ㅅ' }), 'shared');
  ok('공유 시트를 한 번만 띄웠다', shareCalls.length, 1);

  // **여기가 이 검사의 핵심이다.** 사람이 그냥 닫은 것에 「못 보냈어요」가 뜨면,
  // 아무 일도 안 했는데 뭔가 고장난 것처럼 보인다
  shareBehavior = 'cancel';
  ok('사람이 닫으면 cancelled (실패가 아니다)', await share.shareFiles(files), 'cancelled');

  // iOS 가 손짓 차례를 끊었을 때 — 부르는 쪽이 **내려받기로 이어가야** 한다
  shareBehavior = 'blocked';
  ok('막히면 failed (부르는 쪽이 내려받기로 간다)', await share.shareFiles(files), 'failed');

  // 공유 자체가 없는 기기(PC) — 길이 갈려야 한다
  const saved = globalThis.navigator;
  setNavigator({});
  const share2 = bundle('src/data/sharePhotos.js', '.share2.cjs');
  ok('공유가 없는 기기에서는 unsupported', await share2.shareFiles([new File([], 'a.jpg')]), 'unsupported');
  ok('그 기기 단추는 「내려받기」로 적는다', share2.shareSheetLikely(), false);
  setNavigator(saved);

  console.log('\n── 화면이 길을 둘 다 들고 있는가 ──');
  // 공유만 남기고 내려받기를 지우면 PC 에서 사진을 못 챙긴다.
  // 내려받기만 남기면 폰에서 못 챙긴다. **둘 다 있어야 한다**
  const page = fs.readFileSync('src/pages/ComparePage.jsx', 'utf8');
  ok('공유를 먼저 쓴다', /shareFiles\(/.test(page), true);
  ok('내려받기가 그대로 남아 있다', /a\.download/.test(page), true);
  ok('취소를 조용히 넘긴다', /cancelled'\)\s*return/.test(page.replace(/\s+/g, ' ').replace(/ /g, ' ')) || /'cancelled'/.test(page), true);
  ok('전·후 한 장 길이 있다', /mergeBeforeAfter/.test(page), true);
  // 예시 숫자가 그림에 박히면 거짓이 된다
  ok('예시로 그려진 숫자는 그림에 안 적는다', /isExample \|\| sameDay \? null/.test(page), true);

  console.log('');
  if (bad) {
    console.log(bad + '건 실패 — 폰에서 사진을 못 챙길 수 있습니다.');
    process.exit(1);
  }
  
console.log('');
console.log('── 남이 링크를 보낼 때 보이는 것 ── (2026-10-20)');
//
// 카카오톡 · X · 슬랙에 주소를 붙이면 **제목도 그림도 없는 맨 링크**였다. 앱에
// 공유 단추를 붙여둔 날(10/15)부터 이 자리가 비어 있던 셈이다.
//
// **눈으로는 안 보인다** — 내 브라우저에서는 아무 차이가 없고, 남이 보낸 링크를
// 받아본 사람만 안다. 그래서 검사가 센다.
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const meta = (prop) => (html.match(new RegExp(`property="${prop}" content="([^"]*)"`)) || [])[1] || '';

  ok('제목·설명·그림이 있다',
    ['og:title', 'og:description', 'og:image'].filter((k) => !meta(k)), []);
  // 크롤러는 **상대 주소를 못 푼다** — 통째로 적어야 그림이 뜬다
  ok('  그림 주소를 통째로 적었다', /^https:\/\//.test(meta('og:image')), true);
  const img = meta('og:image').replace(/^https?:\/\/[^/]+/, '');
  ok('  그 그림이 진짜 있다', fs.existsSync(path.join(__dirname, '..', 'public', img)), true);
  // X 는 이 한 줄이 없으면 작은 네모로 펴고, 그러면 글자가 안 읽힌다
  ok('  X 가 크게 펴게 적었다', /name="twitter:card" content="summary_large_image"/.test(html), true);
  // 크기를 적어두면 받는 쪽이 자리를 먼저 잡는다(그림이 늦게 와도 안 흔들린다)
  ok('  크기도 적어뒀다', [meta('og:image:width'), meta('og:image:height')], ['1024', '500']);
  // 사람이 처음 닿아야 하는 자리는 `/site` 다 — `/` 는 로그인으로 보낸다
  ok('  주소가 /site 를 가리킨다', /\/site$/.test(meta('og:url')), true);
}

console.log('공유와 내려받기 두 길이 다 서 있습니다');
})();
