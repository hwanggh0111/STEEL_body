// 사진을 **폰 밖으로 내보내는 길** (2026-10-15)
//
// ── 왜 ──
//
// 여태 길은 하나였다 — `a.download` 로 파일 내려받기. PC 브라우저에서는 된다.
// 그런데 이 앱은 **폰에서 쓰는 앱**이고, 폰에서는 그 길이 두 군데서 막힌다.
//
//   · **앱 웹뷰**는 `blob:` 내려받기를 잡아줄 자리가 없어서 눌러도 아무 일이 안 난다
//   · 폰 브라우저도 **여러 장을 연달아** 내려받으면 둘째부터 막는다
//     (`ComparePage` 에 「한 박자씩 띄운다」고 적어둔 자리가 그 까닭이다)
//
// 그리고 내려받기는 **챙기는 것**뿐이다. 이 앱이 하려는 것은 「몸이 변하는 걸 눈으로
// 보여주는 것」인데, **보여줄 상대에게 보낼 길이 없었다.** 기능 하나가 빠진 게 아니라
// 하려는 일의 마지막 걸음이 끊겨 있었다.
//
// ── 어떻게 ──
//
// 폰의 **공유 시트**(`navigator.share`)로 넘긴다. 사진 앱 · 메시지 · 드라이브는
// 폰이 알아서 보여준다 — 우리가 목록을 들고 있을 필요가 없다. 웹뷰에서도 된다.
//
// **내려받기를 지우지 않는다.** PC 에는 공유 시트가 없다. 되는 쪽을 골라 쓴다.

import { dataUrlToBlob, photoFileName } from './photoFile';

/**
 * 이 기기가 **파일을 공유할 수 있나.**
 *
 * `navigator.share` 가 있는 것만으로는 모른다 — 글·주소는 되고 **파일은 안 되는**
 * 기기가 있다(옛 안드로이드 · 데스크톱 사파리). 그래서 `canShare` 에 실제로
 * 물어본다. 물어볼 것이 없으면(파일 0개) 묻지 않는다.
 */
export function canShareFiles(files) {
  if (!files || files.length === 0) return false;
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;                 // 이상한 값을 주면 던지는 기기가 있다
  }
}

/**
 * **단추에 뭐라고 적을지** 정하려고 쓴다 — 「보내기」냐 「내려받기」냐.
 *
 * 파일을 손에 들기 전에는 `canShare` 에 물어볼 수 없으니, 공유 시트가 **있을 만한
 * 기기인지**만 본다. 틀려도 손해가 없다 — 눌렀을 때 안 되면 내려받기로 이어진다.
 */
export function shareSheetLikely() {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}

/** `{ type, dataUrl, at }` 줄들을 공유용 `File` 로. 망가진 것은 건너뛴다 */
export function toFiles(rows) {
  const out = [];
  for (const r of rows || []) {
    const blob = dataUrlToBlob(r.dataUrl);
    if (!blob) continue;          // 한 장이 망가졌다고 나머지까지 못 보내면 안 된다
    const name = r.name || photoFileName(r.type, r.at, r.dataUrl);
    try {
      out.push(new File([blob], name, { type: blob.type }));
    } catch {
      // `File` 생성자가 없는 기기 — 공유는 못 해도 내려받기로 간다
      return [];
    }
  }
  return out;
}

/**
 * 공유 시트를 띄운다.
 *
 * 돌려주는 값은 **무엇이 일어났는가**다 —
 *   `'shared'`    보냈다
 *   `'cancelled'` 사람이 시트를 닫았다 (실패가 아니다. 토스트를 띄우면 안 된다)
 *   `'unsupported'` 이 기기는 파일 공유를 못 한다 → 부르는 쪽이 내려받기로 간다
 *   `'failed'`    띄우려다 막혔다 → 부르는 쪽이 내려받기로 간다
 *
 * **취소를 실패와 가르는 것이 핵심이다.** 사람이 그냥 닫은 것에 「보내지 못했어요」가
 * 뜨면, 아무 일도 안 했는데 뭔가 고장난 것처럼 보인다.
 */
export async function shareFiles(files, { title, text } = {}) {
  if (!canShareFiles(files)) return 'unsupported';
  try {
    await navigator.share({ files, ...(title ? { title } : {}), ...(text ? { text } : {}) });
    return 'shared';
  } catch (e) {
    // 사람이 닫으면 `AbortError` 다. 브라우저마다 글자가 조금 다르다
    const name = e && e.name;
    if (name === 'AbortError') return 'cancelled';
    // iOS 는 **누른 손짓과 같은 차례에서** 부르지 않으면 `NotAllowedError` 를 준다.
    // 사진을 서버에서 받아온 뒤에 부르면 그 사이에 차례가 끊긴다 — 그때 여기로 온다.
    // 그래서 부르는 쪽은 **반드시 내려받기로 이어가야 한다**
    return 'failed';
  }
}
