#!/usr/bin/env node
/**
 * 가운데 뜨는 덮개가 작은 화면에서 잘리지 않는가 (2026-11-13 · 맵시)
 *
 * ── 왜 이 자가 생겼나 ──
 * 덮개(`position:fixed` + 가운데 정렬) 열두 자리를 세어 보니 `maxHeight` 와 `overflow` 를
 * **둘 다 가진 것이 하나뿐**이었다(`AccountDeleteModal`). 나머지는 내용이 화면보다 길면
 * **위아래가 잘린 채 스크롤이 안 되어 단추에 영영 못 닿는다.**
 *
 * 제일 큰 자리가 `ConfirmModal` 이었다 — 전 앱 공용인데 설정 되돌리기 알림이 **541자 ·
 * 줄바꿈 19개**라 670px 가 필요했다. **세로 640 이하 기기(iPhone SE 568 · 375×667)와
 * 가로로 돌린 모든 폰**에서 「되돌리기」가 화면 밖이었다.
 *
 * 한 자리만 고쳐진 채 남은 까닭은 **자가 없었기 때문**이다. 눈으로는 안 보인다 —
 * 개발 화면은 세로가 길고, 긴 알림은 설정 깊은 곳에서만 뜬다.
 *
 * ── 무엇을 보나 ──
 * `position: 'fixed'` 와 가운데 정렬(`alignItems:'center'` + `justifyContent:'center'`)을
 * 같이 쓰는 파일에서, **그 덮개 안쪽 상자**가 높이를 묶었는지(`maxHeight`) 그리고 넘칠 때
 * 흐르는지(`overflow`)를 본다. 둘 중 하나라도 없으면 FAIL.
 *
 * 화면을 통째로 덮고 제 스크롤을 따로 가진 것(카메라 · 잠금 · 점검 화면)은 상자가 아니라
 * **화면**이라 여기서 뺀다 — 아래 `덮개아닌것` 에 까닭과 함께 적는다.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

// 상자가 아니라 **화면**인 것들 — 까닭을 적어둔다 (적어두지 않으면 다음 사람이 못 가린다).
// 스스로 `role="dialog"` 라 말하면서도 가운데 상자가 아닌 넷이다
const 덮개아닌것 = {
  'components/AppLock.jsx': '잠금 — 덮개가 아니라 앱 앞을 막는 한 장짜리 화면이다',
  'components/OverlayCamera.jsx': '카메라 미리보기 — 화면을 통째로 쓴다. 상자가 없다',
  'components/RepCounter.jsx': '횟수 세기 — 카메라 위에 겹치는 화면이다',
  'pages/SiteHome.jsx': '소개 쪽의 안내 — 제 화면 안에서 흐른다',
};

const 파일들 = [];
(function 훑기(dir) {
  for (const 이름 of fs.readdirSync(dir)) {
    const 자리 = path.join(dir, 이름);
    const st = fs.statSync(자리);
    if (st.isDirectory()) 훑기(자리);
    else if (이름.endsWith('.jsx')) 파일들.push(자리);
  }
})(SRC);

const 걸린것 = [];
const 통과한것 = [];

for (const 자리 of 파일들) {
  const 글 = fs.readFileSync(자리, 'utf8');
  const 상대 = path.relative(SRC, 자리).split(path.sep).join('/');

  // **스스로 「나는 대화상자다」라고 말하는 것만 본다.** 가운데 정렬만으로 고르면
  // 첫 그림 · 탭바 · 점검 화면처럼 **상자가 아닌 것**이 줄줄이 걸려 자가 거짓말을 한다
  // (처음에 그렇게 짰다가 둘을 헛물켰다). 모달은 낭독기를 위해 이미 이 표를 달고 있다
  const 대화상자 = /role="dialog"|aria-modal/.test(글);
  const 고정 = /position:\s*'fixed'/.test(글);
  if (!대화상자 || !고정) continue;

  if (덮개아닌것[상대]) continue;

  const 높이묶음 = /maxHeight:/.test(글);
  const 흐름 = /overflowY:\s*'auto'|overflow:\s*'auto'|overflowY:\s*'scroll'/.test(글);

  if (높이묶음 && 흐름) 통과한것.push(상대);
  else 걸린것.push({ 상대, 높이묶음, 흐름 });
}

// 적어둔 예외가 아직 그 파일에 있는가 — 없어진 예외를 들고 있으면 다음 자리가 조용히 샌다
const 죽은예외 = Object.keys(덮개아닌것).filter(
  (p) => !fs.existsSync(path.join(SRC, p)),
);

console.log('── 가운데 뜨는 덮개가 작은 화면에서 잘리지 않는가 ──\n');
for (const p of 통과한것) console.log(`OK   ${p}`);
for (const { 상대, 높이묶음, 흐름 } of 걸린것) {
  const 빠진것 = [!높이묶음 && 'maxHeight', !흐름 && 'overflow'].filter(Boolean).join(' · ');
  console.log(`FAIL ${상대} — ${빠진것} 가 없다`);
}
if (죽은예외.length) {
  console.log('');
  for (const p of 죽은예외) console.log(`FAIL 없어진 파일을 예외로 들고 있다 — ${p}`);
}

console.log('');
if (걸린것.length || 죽은예외.length) {
  console.log('내용이 화면보다 길면 **위아래가 잘린 채 스크롤이 안 되어 단추에 못 닿습니다.**');
  console.log("상자에 `maxHeight: '85vh'` 와 `overflowY: 'auto'` 를 주세요");
  console.log('(글만 흐르게 하고 단추를 제자리에 두려면 `ConfirmModal.jsx` 를 보세요).');
  console.log('덮개가 아니라 화면이면 이 파일의 `덮개아닌것` 에 까닭과 함께 적습니다.');
  process.exit(1);
}
console.log(`덮개 ${통과한것.length} 자리가 작은 화면에서도 닿습니다 (가린 것 ${Object.keys(덮개아닌것).length})`);
