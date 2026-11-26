// ── **사진을 담아둘 크기까지 줄이는가** ── (2026-11-26 · 근호 용량 점검)
//
//   npm run photosize   (frontend/ · npm run check 에도 들어 있다)
//
// 근호가 11/25 밤에 재 보니 **사진을 다 채운 사람 40~50명이면 무료 512MB 가 넘친다.**
// 한 장짜리 JSON DB 를 통째로 메모리에 올리는 구조라 사진도 힙에 올라간다.
//
// 까닭은 줄이는 자가 **거절하는 선(2MB)을 「여기까지는 그냥 둔다」로** 쓰고 있었던 것이다 —
// 1.4MB 짜리를 고르면 **원본 그대로** 올라갔다. 그런데 화면에 그리는 크기는 긴 변
// 1280px 이면 넉넉하고(몸 사진을 견주는 용도다) 그건 대개 **200~400KB** 다.
// **쓰지도 않는 해상도를 사람마다 1MB 넘게** 들고 있었던 셈이다.
//
// 여기서 보는 것:
//
//   1. 선이 **둘로 갈려 있다** — 거절하는 선(서버와 같은 2MB) · 담아둘 선(500KB)
//   2. 담아둘 선을 넘으면 줄인다 (★ 고친 그것 — 여태 2MB 까지 그냥 뒀다)
//   3. **긴 변이 크면 줄인다** — 300KB 짜리 4000px 사진이 그대로 올라가던 자리
//   4. 작고 잘 눌린 그림은 **다시 굽지 않는다** (화질만 손해다)
//   5. 프로필은 `always` 로 늘 줄인다 (26px 에 그리는 그림이다)
//   6. **서버의 벽과 거절하는 선이 같은 수다** — 어긋나면 한쪽에서만 거절된다
//   7. 사람마다 담기는 양이 **얼마나 줄었나** (수로 적는다)
//
// 되돌려-FAIL: `--되돌려` 를 주면 담아둘 선을 거절하는 선과 같게(2MB) 돌린다 →
// FAIL 이 보여야 한다
'use strict';
const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const SRC = path.join(__dirname, '../src');
const 되돌림 = process.argv.includes('--되돌려');

// ── 값만 보는 손을 떼어 돌린다 ──
//
// `shrinkImage.js` 는 브라우저 것이다(`Image` · `canvas`). 그중 **판단하는 손**
// (`needsShrink`)만 값으로 돌아가므로 그것만 꺼내 돌린다 — 그래서 그 손을 따로 뽑았다.
function 손만들기() {
  const 한도 = fs.readFileSync(path.join(SRC, 'data/photoLimit.js'), 'utf-8');
  let shrink = fs.readFileSync(path.join(SRC, 'data/shrinkImage.js'), 'utf-8');
  const 수 = (글, 이름) => {
    const m = 글.match(new RegExp('export const ' + 이름 + ' = ([^;]+);'));
    if (!m) throw new Error(이름 + ' 을 못 찾았다');
    // eslint-disable-next-line no-new-func
    return new Function('return (' + m[1] + ');')();
  };
  const MAX = 수(한도, 'PHOTO_MAX_BASE64');
  let TARGET = 수(한도, 'PHOTO_TARGET_BASE64');
  if (되돌림) TARGET = MAX;                 // 옛 꼴: 거절하는 선까지 그냥 둔다

  const 시작 = shrink.indexOf('export function needsShrink');
  const 끝 = shrink.indexOf('\n}', 시작) + 2;
  if (시작 < 0) throw new Error('needsShrink 를 못 찾았다');
  const 몸통 = shrink.slice(시작, 끝).replace('export function', 'function');
  const MAX_EDGE = (() => {
    const m = shrink.match(/const MAX_EDGE = (\d+);/);
    return m ? Number(m[1]) : null;
  })();
  const PROFILE_EDGE = 수(shrink, 'PROFILE_EDGE');

  // eslint-disable-next-line no-new-func
  const needsShrink = new Function('PHOTO_TARGET_BASE64', 'MAX_EDGE',
    몸통 + '\nreturn needsShrink;')(TARGET, MAX_EDGE);
  return { needsShrink, MAX, TARGET, MAX_EDGE, PROFILE_EDGE };
}

const { needsShrink, MAX, TARGET, MAX_EDGE, PROFILE_EDGE } = 손만들기();
if (되돌림) console.log('── 되돌려: 담아둘 선을 거절하는 선과 같게(2MB) — 아래에 FAIL 이 있어야 한다 ──');

const KB = 1024;
const MB = 1024 * KB;

// ── ⑴ 선이 둘인가 ─────────────────────────────────────────────────────────
console.log('── ⑴ 선이 둘로 갈려 있다 ──');
ok('거절하는 선은 2MB 그대로다 (서버와 맞춘 벽)', MAX, 2 * MB);
ok('★ 담아둘 선이 그보다 작다', TARGET < MAX, true);
ok('  담아둘 선이 1280px JPEG 보다 넉넉하다 (200~400KB)', TARGET >= 400 * KB, true);
ok('  그리는 크기는 1280px · 프로필은 256px', [MAX_EDGE, PROFILE_EDGE], [1280, 256]);

// ── ⑵⑶⑷⑸ 판단 ───────────────────────────────────────────────────────────
console.log('\n── ⑵ 담아둘 선을 넘으면 줄인다 ──');
ok('★ 1.4MB 는 줄인다 (여태 그냥 뒀다 — 이것이 그 버그다)',
  needsShrink(Math.round(1.4 * MB), 3000), true);
ok('  600KB 도 줄인다', needsShrink(600 * KB, 2000), true);
ok('  8MB 짜리 폰 사진은 당연히', needsShrink(8 * MB, 4032), true);

console.log('\n── ⑶ 긴 변이 크면 줄인다 (크기는 작아도) ──');
ok('★ 300KB 짜리 4000px 은 줄인다', needsShrink(300 * KB, 4000), true);
ok('  1280px 보다 조금 큰 것도', needsShrink(300 * KB, 1281), true);

console.log('\n── ⑷ 작고 잘 눌린 그림은 다시 굽지 않는다 ──');
ok('300KB · 1280px 은 그대로 둔다', needsShrink(300 * KB, 1280), false);
ok('  40KB · 800px 도 그대로', needsShrink(40 * KB, 800), false);
ok('  긴 변을 모르면(아직 안 열어봤다) 크기만 본다',
  [needsShrink(300 * KB, Infinity), needsShrink(600 * KB, Infinity)], [false, true]);
ok('  빈 것에 터지지 않는다', [needsShrink(0, 0), needsShrink(NaN, NaN)], [false, false]);

console.log('\n── ⑸ 프로필은 늘 줄인다 ──');
ok('always 면 작아도 줄인다 (26px 에 그리는 그림이다)',
  needsShrink(20 * KB, 200, { always: true, maxEdge: PROFILE_EDGE }), true);
ok('  프로필 자로 보면 300px 도 크다',
  needsShrink(20 * KB, 300, { maxEdge: PROFILE_EDGE }), true);

// ── ⑹ 서버의 벽과 같은 수인가 ─────────────────────────────────────────────
console.log('\n── ⑹ 서버의 벽과 같은 수다 ──');
const 서버 = fs.readFileSync(path.join(__dirname, '../../backend/src/routes/photos.js'), 'utf-8');
const m = 서버.match(/data\.length > ([^)]+?)\)/);
// eslint-disable-next-line no-new-func
const 서버벽 = m ? new Function('return (' + m[1] + ');')() : null;
ok('서버가 거절하는 수를 찾았다', 서버벽 !== null, true);
ok('★ 화면의 거절하는 선과 같다 (어긋나면 한쪽에서만 거절된다)', 서버벽, MAX);

// ── ⑺ 얼마나 줄었나 ───────────────────────────────────────────────────────
console.log('\n── ⑺ 사람마다 담기는 양 ──');
const 장수 = 3;
const 옛값 = MAX * 장수;
const 새값 = TARGET * 장수;
const 몇명 = (한사람) => Math.floor((256 * MB) / 한사람);   // 힙 한도(--max-old-space-size=256)
console.log(`     전: 한 사람 최대 ${(옛값 / MB).toFixed(1)}MB → 사진만으로 ${몇명(옛값)}명에서 찬다`);
console.log(`     후: 한 사람 최대 ${(새값 / MB).toFixed(1)}MB → 사진만으로 ${몇명(새값)}명에서 찬다`);
ok('★ 담기는 양이 네 배 넘게 줄었다', 옛값 / 새값 >= 4, true);
ok('  그래서 버티는 사람 수가 네 배 넘게 늘었다', 몇명(새값) / 몇명(옛값) >= 4, true);

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
