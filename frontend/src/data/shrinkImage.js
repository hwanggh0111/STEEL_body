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
 * @returns {Promise<{ data: string, shrunk: boolean }>}
 *   data   — 올릴 data URL
 *   shrunk — 우리가 줄였는지 (화면에서 그렇다고 알려줄 때 쓴다)
 */
export async function shrinkImage(file) {
  const original = await readAsDataURL(file);
  if (typeof original !== 'string') throw new Error('read');

  // 이미 넉넉하면 그대로 둔다. 다시 구우면 화질만 손해다
  if (original.length <= PHOTO_MAX_BASE64) return { data: original, shrunk: false };

  try {
    const img = await loadImage(original);
    const edge = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = edge > MAX_EDGE ? MAX_EDGE / edge : 1;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return { data: original, shrunk: false };
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const q of QUALITIES) {
      const out = canvas.toDataURL('image/jpeg', q);
      if (out.length <= PHOTO_MAX_BASE64) return { data: out, shrunk: true };
    }
    // 세 번을 낮춰도 안 되면 마지막 것을 준다. 부르는 쪽이 한도를 다시 보고 안내한다
    return { data: canvas.toDataURL('image/jpeg', QUALITIES[QUALITIES.length - 1]), shrunk: true };
  } catch {
    // 브라우저가 못 여는 형식. 원본을 그대로 돌려준다
    return { data: original, shrunk: false };
  }
}

export default shrinkImage;
