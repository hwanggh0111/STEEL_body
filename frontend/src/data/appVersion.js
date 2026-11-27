// **이 판이 무슨 판인가** — 한 자리에서만 말한다 (2026-11-27 · 정석)
//
// ── 무엇이 틀렸었나 ──
//
// 버전이 **세 자리에 따로** 박혀 있었다:
//   `package.json` 의 `1.0.0` · `android/app/build.gradle` 의 `versionName "1.0"` ·
//   그리고 화면 넷이 `pkg.version` 을 그대로 그렸다.
// 스토어는 「1.0」, 앱은 「v1.0.0」 — **사람이 제보할 때 다른 수를 말한다.**
//
// 더 큰 것은 **그 수가 안 변한다**는 것이다. 설정 화면의 주석은
// 「판 번호는 제보할 때 필요한 것이다 · 지금 무슨 판을 쓰고 있나를 눈으로 볼 자리가
// 아무 데도 없었다」로 적혀 있는데, 11월에 커밋 마흔 몇 개가 라이브로 나가는 동안
// 화면은 **내내 `v1.0.0`** 이었다. 제보에 붙는 `appVersion` 도 늘 `1.0.0` 이라
// **어느 판에서 난 일인지 짚을 수 없었다** — 부총재가 받는 500 도 같다.
//
// ── 어떻게 고쳤나 ──
//
// 사람에게 보이는 수는 **버전 + 판 번호**다. 판 번호는 `changelog.json` 의 맨 윗
// 커밋이다 — 빌드할 때마다 `gen-changelog.mjs` 가 다시 뽑고 **커밋되어** 라이브로
// 간다(Render 는 얕은 클론이라 빌드 때 git 을 다시 읽지 못한다. 그래서 새 파일을
// 만들지 않고 **그 산출물을 뽑는 손이 한 줄 더 뽑게** 한다 —
// `changelog.json` 자체를 들여오면 **75KB 가 첫 화면 묶음에 따라온다**(이 집이
// 10/16 에 `feedData.js` 에서 일부러 떼어낸 그 무게다). 그래서 맨 윗 커밋만 담은
// `build.json` 을 따로 뽑고, `check-version` 이 둘이 같은 커밋인지 본다.
//
// `android/app/build.gradle` 은 이제 `package.json` 을 읽는다 — 손으로 맞출 자리가
// 없어졌다. `check-version` 이 셋이 한 수를 말하는지 본다.
import pkg from '../../package.json';
import build0 from './build.json';

/** `1.0.0` — 사람이 말하는 버전. **이 수를 고치는 자리는 `package.json` 하나다** */
export const version = pkg.version;

/** `ba178ee` — 이 판이 지어진 커밋. 못 읽으면 빈 글자(화면이 괄호를 안 그린다) */
export const build = build0.hash || '';

/** `v1.0.0 (ba178ee)` — 화면과 제보가 같이 쓰는 한 줄. 판 번호를 못 읽으면 `v1.0.0` */
export const label = build ? `v${version} (${build})` : `v${version}`;

/**
 * 제보 · 오류에 붙는 글자. `1.0.0+ba178ee`.
 *
 * **스무 자 안이어야 한다** — 서버가 `DEVICE_FIELDS.appVersion = 20` 으로 자른다.
 * `1.0.0+ba178ee` 는 열세 자다. 버전이 `10.10.10` 까지 커져도 열여섯 자다
 */
export const stamp = build ? `${version}+${build}` : version;
