// 몸 사진을 파일로 챙겨 나가기.
//
// 내보내기는 운동 · 인바디 · 측정 셋을 CSV 로 빼주는데 **몸 사진만 길이 없었다.**
// 계정을 지우면 30일 유예 뒤에 사라지는데, 그 안에 사진을 못 가져가면 그냥 없어진다.
// 반년을 모은 전·후 사진이 그렇게 사라질 자리가 아니다.
//
// **서버에 새 길을 안 낸다.** 사진은 이미 `GET /api/photos` 가 `data:` 주소로 통째로
// 내려준다 — 화면이 받은 그것을 파일로 만들면 끝이다. 내려받자고 같은 것을 한 번 더
// 내려주는 길을 만들면 2MB 짜리가 두 번 오간다.
//
// **`fetch('data:…')` 를 쓰지 않는다.** 이 앱의 CSP 는 `connect-src` 를 `'self'` 로
// 묶어놨다 — `data:` 는 거기에 없어서 브라우저가 **조용히 막는다.** 에러도 안 뜨고
// 내려받기만 안 된다. 그래서 base64 를 손으로 푼다.

/** 어떤 사진인가 — 파일 이름에 적히는 말. 화면에 적힌 것과 같은 말을 쓴다. */
const TYPE_LABEL = { profile: '프로필', before: '과거', after: '나중' };

/** `data:image/jpeg;base64,…` 에서 종류를 꺼낸다. 아니면 null. */
export function mimeOf(dataUrl) {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(String(dataUrl || ''));
  return m ? m[1].toLowerCase() : null;
}

/** 확장자. 모르는 종류는 `img` 로 둔다 — 이름을 지어내는 것보다 낫다. */
export function extOf(mime) {
  if (!mime) return 'img';
  // 글자가 아닌 것이 와도 안 터진다 — 내보낸 함수라 나중에 다른 자리에서 부를 수 있다
  const sub = String(mime).split('/')[1] || '';
  if (sub === 'jpeg') return 'jpg';                 // 사람이 아는 이름으로
  if (/^[a-z0-9]{1,5}$/.test(sub)) return sub;      // png · gif · webp · avif
  return 'img';
}

/**
 * 내려받을 때 붙는 이름.
 *
 * **언제 찍은 것인지가 이름에 있어야 한다** — 파일 셋이 내려받기 폴더에 섞이면
 * `photo.jpg` 로는 어느 것이 과거인지 알 수 없다. 날짜를 모르면 날짜를 안 적는다
 * (`unknown` 같은 말을 끼워 넣지 않는다).
 */
export function photoFileName(type, at, dataUrl) {
  const label = TYPE_LABEL[type] || String(type || '사진');
  const day = typeof at === 'string' && /^\d{4}-\d{2}-\d{2}/.test(at) ? at.slice(0, 10) : null;
  return `blackiron_${label}${day ? `_${day}` : ''}.${extOf(mimeOf(dataUrl))}`;
}

/**
 * `data:` 주소를 Blob 으로.
 *
 * 사진이 아니거나 망가진 base64 면 **null** 을 돌려준다 — 던지지 않는다.
 * 세 장 중 하나가 이상하다고 나머지 둘까지 못 챙기면 안 된다.
 */
export function dataUrlToBlob(dataUrl) {
  const mime = mimeOf(dataUrl);
  if (!mime) return null;
  const base64 = String(dataUrl).slice(String(dataUrl).indexOf(',') + 1);
  try {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/**
 * 내려받을 수 있는 것만 골라 이름을 붙여 돌려준다.
 *
 * 서버가 주는 줄에는 프로필도 섞여 있다 — **그것도 내 사진이다.** 챙겨 나가는
 * 자리에서 골라낼 이유가 없다. 차례는 과거 → 나중 → 프로필로 둔다 (화면에 놓인 차례다).
 */
const ORDER = { before: 0, after: 1, profile: 2 };

export function downloadable(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((p) => p && mimeOf(p.data))
    .sort((a, b) => (ORDER[a.type] ?? 9) - (ORDER[b.type] ?? 9))
    .map((p) => ({
      type: p.type,
      dataUrl: p.data,
      name: photoFileName(p.type, p.updated_at || p.created_at, p.data),
    }));
}
