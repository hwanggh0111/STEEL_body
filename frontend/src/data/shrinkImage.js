import { PHOTO_TARGET_BASE64 } from './photoLimit';

// 사진을 올릴 수 있는 크기로 줄인다.
//
// **한도를 지키라고 말하는 대신 우리가 줄인다.**
//
// 서버는 base64 2MB 까지 받는다 — 원본으로 치면 1.5MB 다. 그런데 요즘 폰 사진은
// 한 장에 3~8MB 다. 그래서 카메라 앨범에서 고른 사진은 **거의 다 거절당했다.**
// 「1.5MB 이하만 가능해요」라는 말을 듣고 나면 할 수 있는 일이 없다 — 사진 편집
// 앱을 따로 열어 줄여 오라는 뜻인데, 그럴 사람은 거의 없다. 전 · 후 사진 기능이
// 사실상 없는 것과 같았다.
//
// 줄이는 것은 브라우저가 이미 할 수 있는 일이다. 긴 변을 1280px 로 맞추고 JPEG 으로
// 다시 굽는다. 몸 사진을 견주는 용도에 1280px 이면 넉넉하고, 대개 200~400KB 로 떨어진다.
//
// **못 줄이면 원본을 그대로 돌려준다.** 브라우저가 못 여는 형식(데스크톱 크롬의 HEIC
// 같은)이 있는데, 그때 실패로 끝내면 오히려 지금보다 나빠진다. 원본이 한도를 넘으면
// 부르는 쪽이 여느 때처럼 안내한다.

const MAX_EDGE = 1280;

/**
 * **줄여야 하나.** (2026-11-26 · 근호 용량 점검)
 *
 * 여태 이 판단이 「거절하는 선(`PHOTO_MAX_BASE64`) 안이면 그대로」였다. 그래서
 * 1.4MB 짜리가 원본대로 올라가 쌓였다 — 사람마다 3장이면 4MB 가 넘고, 그것이
 * **사진 다 채운 40~50명에서 서버가 넘치던** 까닭이다(`photoLimit.js` 머리글).
 *
 * 이제 **담아둘 선**(`PHOTO_TARGET_BASE64`)으로 본다. 두 가지 중 하나라도 걸리면 줄인다 —
 *
 *   · 담아둘 선보다 크다
 *   · 긴 변이 우리가 그리는 크기보다 크다 (1280px · 프로필은 256px)
 *
 * **둘 다 아니면 다시 굽지 않는다.** 작고 잘 눌린 그림을 다시 구우면 화질만 손해다.
 *
 * 값만 보는 손이라 자가 그대로 부른다(`npm run photosize`) — 브라우저 없이 돈다.
 * 판단을 그리는 자리에 섞어두면 **잴 수가 없다.**
 */
export function needsShrink(len, edge, { maxEdge = MAX_EDGE, always = false } = {}) {
  if (always) return true;
  if (!(len > 0)) return false;
  if (len > PHOTO_TARGET_BASE64) return true;
  return Number.isFinite(edge) && edge > maxEdge;
}

/**
 * **프로필 사진은 더 줄인다** (2026-10-31).
 *
 * 프로필은 화면에 **26px 동그라미 하나**로 그린다(`Layout` 의 `Avatar`, 쓰는 자리는
 * 거기 하나다). 그런데 여태 전·후 사진과 **같은 자**로 줄였다 — 한도(2MB) 안에만
 * 들면 **아예 안 줄인다.** 그래서 폰에서 고른 300KB 짜리가 그대로 올라갔다.
 *
 * 그 300KB 는 **기기를 바꿀 때마다 한 번씩 내려오고**(`/photos?type=profile`),
 * 기기에도 그대로 담긴다. 26px 짜리 그림에 그만큼 쓸 까닭이 없다.
 *
 * 256px 로 둔다 — 26px 의 **세 배(78px)보다 넉넉**해서 다음에 더 크게 쓰더라도
 * 다시 올리지 않아도 된다. 긴 변 256 의 JPEG 은 대개 10~20KB 다.
 */
export const PROFILE_EDGE = 256;
// 한 번에 안 되면 화질을 낮춰 다시 굽는다. 마지막 0.5 는 눈에 띄지만 못 올리는 것보다 낫다
const QUALITIES = [0.85, 0.7, 0.55];

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = dataUrl;
  });
}

/**
 * @param {File} file 고른 파일
 * @returns {Promise<{ data: string, shrunk: boolean, unreadable?: boolean }>}
 *   data       — 올릴 data URL
 *   shrunk     — 우리가 줄였는지 (화면에서 그렇다고 알려줄 때 쓴다)
 *   unreadable — ★ **브라우저가 이 그림을 못 열었다** (2026-11-20)
 *
 * ── `unreadable` 이 왜 생겼나 ──
 *
 * 못 여는 형식(데스크톱 크롬의 HEIC 같은)이면 아래 `catch` 가 **원본을 그대로**
 * 돌려준다. 그 원본이 한도를 넘으면 부르는 쪽이 「사진은 1.5MB 이하만 가능해요」를
 * 띄웠다 — **1.2MB 짜리를 골라도 같은 말**이다. 까닭이 **사실과 다르고**(크기 탓이
 * 아니라 우리가 못 읽은 것이다) **다음 걸음도 없다**(줄여 와도 또 안 된다).
 *
 * 그래서 「못 읽었다」를 **값으로** 돌려준다. 말은 `photoLimit.js` 의
 * `photoRejectMessage` **한 자리**에서 만든다 — 세 자리(프로필 · 전후 사진 ·
 * 홈페이지 사진)가 같은 손을 부른다. 두 벌로 두면 한쪽만 고치는 날이 온다.
 */
/**
 * `onStage` — **지금 무엇을 하는 중인지** 부르는 쪽에 알려준다 (2026-11-20).
 *
 * 폰에서 고른 8MB 사진은 **읽기와 다시 굽기에 1~3초**가 걸린다. 그동안 화면이
 * 그대로면 사람은 **한 번 더 누르고**, 그러면 요청이 둘이 된다. 걸음을 둘로
 * 나눠 주는 까닭은 **느린 까닭이 다르기 때문**이다 — 읽기는 폰 탓, 올리기는
 * 신호 탓이라 사람이 기다릴지 말지를 그걸 보고 정한다. 안 주면 지금과 같다.
 */
export async function shrinkImage(file, { maxEdge = MAX_EDGE, always = false, onStage } = {}) {
  onStage?.('read');
  const original = await readAsDataURL(file);
  if (typeof original !== 'string') throw new Error('read');

  // 이미 넉넉하면 그대로 둔다. 다시 구우면 화질만 손해다.
  // **`always` 면 크기와 상관없이 줄인다** — 프로필처럼 **그리는 크기가 정해진**
  // 자리에서는 「한도 안이니 그대로」가 300KB 를 26px 에 쓰는 일이 된다 (2026-10-31)
  //
  // ★ **판단은 `needsShrink` 한 손이 한다** (2026-11-26) — 여태 이 자리가 「거절하는
  // 선 안이면 그대로」였고, 그래서 1.4MB 가 원본대로 쌓였다(그 머리글에 까닭).
  // 크기만으로는 **긴 변**을 못 보므로, 한 번 열어 본 뒤 다시 묻는다(아래 `긴변`)
  if (!needsShrink(original.length, Infinity, { maxEdge, always })) {
    // ── ★ **한도 안이어도 열어는 본다** ── (2026-11-20 · 정석 1차)
    //
    // 11/20 에 「못 읽은 것을 크다고 말하지 않는다」를 고쳤는데, **못 읽었는지 묻는
    // 자리 자체가 한도 밖에만 있었다.** 이 줄이 한도 안이면 **그대로 돌려주고 끝**이라
    // `unreadable` 이 **아예 안 붙는다** — 1MB 짜리 HEIC 은 못 읽었는지 알 수조차 없다.
    //
    // 그 길로 가면 못 여는 그림이 **그대로 올라간다.** 그러면 이 기기에서도 깨져
    // 보이고(`<img>` 가 같은 손으로 못 읽는다) 남의 기기에서도 깨진다 — 홈페이지
    // 사진은 **손님에게 깨진 그림**이 걸린다. 「크기가 괜찮다」는 「읽을 수 있다」가
    // 아니다.
    //
    // 그래서 **열어만 본다.** 다시 굽지 않으므로 화질은 그대로다. 보여주려면
    // 브라우저가 어차피 한 번 풀어야 하는 그림이라 값도 늘지 않는다.
    let 열어본것;
    try {
      열어본것 = await loadImage(original);
    } catch {
      return { data: original, shrunk: false, unreadable: true };
    }
    // **긴 변까지 보고 다시 묻는다** (2026-11-26) — 300KB 짜리 4000px 사진이 있다.
    // 크기는 담아둘 선 안이지만 **우리가 그리는 크기보다 훨씬 크다**. 그대로 두면
    // 기기마다 그 4000px 을 받아 1280 으로 줄여 그린다(받는 값 · 푸는 값이 다 든다)
    const 긴변 = Math.max(열어본것.naturalWidth || 0, 열어본것.naturalHeight || 0);
    if (!needsShrink(original.length, 긴변, { maxEdge, always })) {
      return { data: original, shrunk: false };
    }
    // 줄여야 한다 — 아래 굽는 자리로 **이미 열어둔 그림을 들고** 내려간다
    return bake(열어본것, original, { maxEdge, always, onStage });
  }

  try {
    onStage?.('shrink');
    const img = await loadImage(original);
    return bake(img, original, { maxEdge, always, onStage });
  } catch {
    // 브라우저가 못 여는 형식. 원본을 그대로 돌려주고 **못 읽었다고 말한다**
    return { data: original, shrunk: false, unreadable: true };
  }
}

/**
 * 다시 굽는다. **두 길이 이 한 손을 쓴다** (2026-11-26) — 「담아둘 선을 넘어 들어온
 * 길」과 「선 안이지만 긴 변이 큰 길」이다. 베껴 두면 한쪽만 고쳐진다
 */
function bake(img, original, { maxEdge = MAX_EDGE, always = false, onStage } = {}) {
  try {
    onStage?.('shrink');
    const edge = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = edge > maxEdge ? maxEdge / edge : 1;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return { data: original, shrunk: false, unreadable: true };
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const q of QUALITIES) {
      const out = canvas.toDataURL('image/jpeg', q);
      // **담아둘 선**으로 본다 (2026-11-26) — 여태 거절하는 선(2MB)으로 봐서,
      // 첫 화질이 1.9MB 여도 통과했다. 1280px 이면 대개 200~400KB 라 첫 번에 든다
      if (out.length <= PHOTO_TARGET_BASE64) {
        // **더 커졌으면 원본을 둔다** — 이미 작고 잘 눌린 그림을 다시 구우면
        // 커지는 일이 있다(작은 PNG → JPEG). 줄이려고 부른 자가 늘리면 안 된다
        if (out.length >= original.length) return { data: original, shrunk: false };
        return { data: out, shrunk: true };
      }
    }
    // 세 번을 낮춰도 담아둘 선에 안 들면 마지막 것을 준다. **거절하는 선(2MB)보다
    // 작으면 올라간다** — 담아둘 선은 목표고, 거절하는 선은 서버와 맞춘 벽이다
    const 마지막 = canvas.toDataURL('image/jpeg', QUALITIES[QUALITIES.length - 1]);
    if (마지막.length >= original.length) return { data: original, shrunk: false };
    return { data: 마지막, shrunk: true };
  } catch {
    // 굽다 터졌다(캔버스가 막힌 기기 등). 원본을 그대로 둔다 — 부르는 쪽이 한도를 본다
    return { data: original, shrunk: false };
  }
}

export default shrinkImage;
