// **지문 · 얼굴로 잠금을 푼다** (2026-11-19 · 시안 1119 ⑤)
//
// ── 왜 생겼나 ──
//
// 잠금은 **네 자리 숫자뿐**이었다(`appLock.js`). 앱을 열 때마다 네 자리를 치는 사람은
// 결국 **잠금을 끈다** — 그러면 가리려던 것(몸 사진 · 인바디 · 다니는 헬스장)이 다시
// 다 보인다. 지문은 그보다 빠르고, **네 자리는 지문이 안 될 때 남는 길**로 그대로 둔다.
//
// ── ★ 플러그인이 아니라 WebAuthn 이다 ──
//
// 11/19 에 내가 「안드로이드 생체 인증 플러그인이 든다 — 지금 못 넣는다」고 적었는데
// **틀렸다.** 브라우저·웹뷰에 이미 있는 손으로 된다 — `navigator.credentials` 의
// **플랫폼 인증기**(platform authenticator)가 그 기기의 지문·얼굴을 쓴다. 새 짐이 0개고,
// **스토어 심사에 늘어나는 권한도 없다**(그래서 12/24 전에 넣을 수 있다).
//
// ── ★ 이것이 무엇이고 무엇이 아닌가 ──
//
// **네 자리와 정확히 같은 무게다 — 가리는 것이지 지키는 것이 아니다.**
// 서버에 아무것도 안 보내고 **서버가 아무것도 확인하지 않는다**(WebAuthn 을 제대로
// 쓰려면 서버가 도전값을 내고 서명을 검사해야 하는데, 여기서는 **기기의 가림막**이라
// 그 길을 안 만든다 — 만들면 그때부터 그것은 비밀번호가 되고, 잃어버렸을 때 되찾는 길 ·
// 털렸을 때 바꾸는 길 · 다른 기기와 맞추는 길이 전부 따라온다. `appLock.js` 머리글의
// 그 선과 같다).
//
// 그래서 **네 자리를 걸어둔 사람만** 지문을 켤 수 있다. 지문이 네 자리를 **대신하지
// 않고 빠른 길로 얹힌다** — 기기가 지문을 못 읽으면(젖은 손 · 인식기 고장) 네 자리가 있다.
//
// ── 무엇을 담나 ──
//
// 기기에 **「켰다」와 열쇠 이름 하나**뿐이다. 지문 자체는 **브라우저도 우리도 못 본다** —
// 기기의 보안 칸에만 있고, 우리는 「그 기기 주인이 맞다고 기기가 말했다」만 받는다.
import { canStore, readLS, saveLS, removeLS } from './safeStorage';
import { LOCK_BIO_KEY } from './localKeys';

/** 이 기기에서 지문·얼굴을 쓸 수 있나. **못 쓰면 단추를 아예 안 그린다** */
export async function 쓸수있나() {
  try {
    if (!canStore()) return false;                       // 기억할 곳이 없으면 켜도 안 남는다
    if (!window.isSecureContext) return false;           // http 로 열면 이 손이 없다
    const C = window.PublicKeyCredential;
    if (!C || !navigator.credentials) return false;
    // **「이 기기 안에 든 인증기가 있나」를 묻는다** — USB 열쇠가 아니라 지문·얼굴이다.
    // 이 물음을 안 하고 바로 만들면, 인식기가 없는 기기에서 **창이 떴다가 그냥 꺼진다**
    if (typeof C.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
    return await C.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

/** 지문으로 풀기를 켜 뒀나 */
export function 켜졌나() {
  return !!readLS(LOCK_BIO_KEY);
}

/** 끈다. **열쇠 이름만 지운다** — 기기에 만든 열쇠는 기기 설정에서 사람이 지운다 */
export function 끈다() {
  removeLS(LOCK_BIO_KEY);
}

const 아무값 = () => {
  // 도전값. **서버가 검사하지 않으므로 뜻이 없는 값**이고, 그래서 아무 값이나 괜찮다 —
  // 다만 매번 다른 값이어야 브라우저가 같은 물음을 캐시하지 않는다
  const a = new Uint8Array(32);
  (window.crypto || {}).getRandomValues?.(a);
  return a;
};

const b64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (str) => {
  const s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
};

/**
 * 켠다 — 이 기기에 열쇠를 하나 만든다. **그 자리에서 지문을 한 번 물어본다**
 * (켜고 나서 처음 풀 때 안 되는 것을 그때 알면 늦다).
 *
 * @returns true 면 켜졌다. 거절하거나 안 되면 false — **거짓으로 켜두지 않는다**
 */
export async function 켠다(이름표 = '블랙아이언 잠금') {
  if (!await 쓸수있나()) return false;
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: 아무값(),
        rp: { name: 'BLACK IRON' },
        // 사람 칸은 **비워 둘 수 없어** 기기에 남는 이름표만 둔다 — 메일 · 아이디를
        // 넣지 않는다(기기에 남는 값이고, 밖으로 나가는 값은 적을수록 맞다)
        user: { id: 아무값().slice(0, 16), name: 이름표, displayName: 이름표 },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: {
          // **이 기기 안의 인증기만** (USB 열쇠를 들고 다니게 하지 않는다)
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    });
    if (!cred || !cred.rawId) return false;
    saveLS(LOCK_BIO_KEY, b64(cred.rawId));
    return true;
  } catch {
    // 사람이 취소했거나 기기가 거절했다. **조용히 꺼둔 채로 둔다**
    return false;
  }
}

/**
 * 푼다 — 기기에 「주인이 맞나」를 묻는다.
 *
 * @returns true 면 기기가 맞다고 했다. false 면 **잠긴 채로 둔다**(네 자리가 남아 있다)
 */
export async function 풀어본다() {
  const id = readLS(LOCK_BIO_KEY);
  if (!id || !await 쓸수있나()) return false;
  try {
    const got = await navigator.credentials.get({
      publicKey: {
        challenge: 아무값(),
        allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!got;
  } catch {
    return false;
  }
}
