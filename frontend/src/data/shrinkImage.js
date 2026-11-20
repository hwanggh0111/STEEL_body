import { PHOTO_MAX_BASE64 } from './photoLimit';

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
export async function shrinkImage(file, { maxEdge = MAX_EDGE, always = false } = {}) {
  const original = await readAsDataURL(file);
  if (typeof original !== 'string') throw new Error('read');

  // 이미 넉넉하면 그대로 둔다. 다시 구우면 화질만 손해다.
  // **`always` 면 크기와 상관없이 줄인다** — 프로필처럼 **그리는 크기가 정해진**
  // 자리에서는 「한도 안이니 그대로」가 300KB 를 26px 에 쓰는 일이 된다 (2026-10-31)
  if (!always && original.length <= PHOTO_MAX_BASE64) {
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
    try {
      await loadImage(original);
    } catch {
      return { data: original, shrunk: false, unreadable: true };
    }
    return { data: original, shrunk: false };
  }

  try {
    const img = await loadImage(original);
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
      if (out.length <= PHOTO_MAX_BASE64) {
        // **더 커졌으면 원본을 둔다** — 이미 작고 잘 눌린 그림을 다시 구우면
        // 커지는 일이 있다(작은 PNG → JPEG). 줄이려고 부른 자가 늘리면 안 된다
        if (always && out.length >= original.length) return { data: original, shrunk: false };
        return { data: out, shrunk: true };
      }
    }
    // 세 번을 낮춰도 안 되면 마지막 것을 준다. 부르는 쪽이 한도를 다시 보고 안내한다
    return { data: canvas.toDataURL('image/jpeg', QUALITIES[QUALITIES.length - 1]), shrunk: true };
  } catch {
    // 브라우저가 못 여는 형식. 원본을 그대로 돌려주고 **못 읽었다고 말한다**
    return { data: original, shrunk: false, unreadable: true };
  }
}

export default shrinkImage;
