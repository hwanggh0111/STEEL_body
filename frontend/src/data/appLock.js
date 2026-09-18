// 앱 잠금 — 네 자리 (2026-09-18).
//
// **몸 사진이 들어 있는 앱이다.** 전·후 사진, 인바디 숫자, 어디 헬스장에 다니는지까지
// 들어 있는데, 폰을 잠깐 빌려주면(사진 좀 보여줘 · 전화 한 통 하자) 그게 다 보인다.
// 앱은 늘 로그인된 채로 열려 있으므로 **앱을 여는 데는 아무것도 필요 없다.**
//
// ── 이것이 무엇이고 무엇이 아닌가 ──
//
// **가리는 것이지 지키는 것이 아니다.** 네 자리는 기기 안에만 있고, 마음먹은 사람은
// 브라우저 저장소를 지워 풀 수 있다. 그래서 화면에도 그렇게 적는다 —
// 「잠깐 빌려준 폰에서 가리는 잠금입니다」. 서버 자물쇠(로그인)를 대신하지 않는다.
//
// **서버에 안 보낸다.** 보내면 그때부터 그것은 비밀번호가 된다 — 잃어버렸을 때 되찾는
// 길, 털렸을 때 바꾸는 길, 다른 기기와 맞추는 길이 전부 따라온다. 이건 기기의 가림막이다.
//
// **기기의 것이라 로그아웃해도 안 지운다.** 헬스장 이름(`gymStore`)과 같은 결이다 —
// 그 기기가 어디에 있고 누구 손에 있는지는 계정이 바뀌어도 그대로다.
// 대신 **잊었을 때는 로그아웃으로 푼다** — 로그아웃은 잠금이 가리려던 것(내 기록)을
// 통째로 치우는 일이라, 그걸 할 수 있는 사람에게는 잠금이 이미 뜻이 없다.
//
// 계산은 여기 한 곳에 둔다 — 화면으로는 확인하기 어려운 것들이다(90초를 기다려야 하고,
// 다섯 번 틀려야 한 번 나온다). `npm run lock` 이 값으로 본다.

import { readLS, saveLS, removeLS } from './safeStorage';

/** 기기에 담는 자리. **사람마다가 아니라 기기마다**라 로그아웃해도 안 지운다 */
export const LOCK_KEY = 'steelbody_lock';

/** 네 자리. 여섯 자리로 늘리면 「기억해야 하는 것」이 하나 더 무거워진다 */
export const PIN_LEN = 4;

/** 다른 앱을 보다 돌아왔을 때, 이만큼 넘게 비워뒀으면 잠근다 (45초) */
export const GRACE_MS = 45 * 1000;

/** 이만큼 틀리면 잠깐 쉬게 한다 */
export const MAX_TRIES = 5;
/** 쉬는 시간 (30초). 늘려가지 않는다 — 이건 기기의 가림막이지 서버 자물쇠가 아니다 */
export const COOLDOWN_MS = 30 * 1000;

/** 네 자리 숫자인가. **글자가 섞이면 안 받는다** — 자판을 따로 그리는 이유도 그것이다 */
export function isPin(v) {
  return typeof v === 'string' && new RegExp(`^\\d{${PIN_LEN}}$`).test(v);
}

/**
 * 네 자리를 그대로 담지 않는다.
 *
 * 기기 안이라 해도 저장소를 열어보면 보이는 자리다 — 「1234」가 그대로 적혀 있으면
 * 잠금이 있는 척만 하는 셈이다. **기기마다 다른 소금**을 섞어 해시로 담는다.
 *
 * `crypto.subtle` 은 **https(와 localhost)에서만** 있다. 없는 자리에서는 잠금을
 * 아예 못 걸게 한다 — 약한 방법으로 대신 걸면 사람은 걸린 줄 알고 폰을 빌려준다.
 */
export function canLock() {
  return typeof crypto !== 'undefined' && !!crypto.subtle && typeof TextEncoder !== 'undefined';
}

export async function hashPin(pin, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 담아둔 것. 모양이 아니면 **없는 것으로 친다** (손으로 고쳐 넣은 값) */
export function readLock() {
  const raw = readLS(LOCK_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v.salt !== 'string' || typeof v.hash !== 'string') return null;
    return { salt: v.salt, hash: v.hash, at: v.at || null };
  } catch {
    return null;
  }
}

export const isLockSet = () => !!readLock();

/** 건다. 이미 걸려 있으면 바꾸는 것이다 (지금 것을 먼저 맞춰야 한다 — 화면이 묻는다) */
export async function setPin(pin) {
  if (!isPin(pin)) throw new Error(`${PIN_LEN}자리 숫자로 정해주세요`);
  if (!canLock()) throw new Error('이 브라우저에서는 잠금을 걸 수 없어요');
  const salt = newSalt();
  const hash = await hashPin(pin, salt);
  saveLS(LOCK_KEY, JSON.stringify({ salt, hash, at: new Date().toISOString() }));
  return true;
}

/** 푼다(잠금 자체를 지운다). **지금 것을 맞춘 뒤에만** 부른다 */
export function clearPin() {
  removeLS(LOCK_KEY);
}

export async function matches(pin) {
  const saved = readLock();
  if (!saved || !isPin(pin) || !canLock()) return false;
  const h = await hashPin(pin, saved.salt);
  // 길이가 같은 두 글자를 견준다. 시간차로 알아내는 공격은 기기 안 가림막에
  // 의미가 없지만, 견주는 방법을 굳이 헐겁게 둘 이유도 없다
  if (h.length !== saved.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ saved.hash.charCodeAt(i);
  return diff === 0;
}

/**
 * 돌아왔을 때 잠가야 하는가.
 *
 * **앱을 다시 띄웠으면 무조건 잠근다**(`hiddenAt` 이 없다) — 폰을 껐다 켰거나 앱을
 * 종료했다 연 것이고, 그때가 남의 손에 있었을 수 있는 때다.
 *
 * 화면을 잠깐 벗어난 것(알림 확인 · 음악 앱)까지 잠그면 세트 사이마다 네 자리를 친다.
 * 그래서 **비워둔 시간**으로 가른다.
 */
export function shouldLock(hiddenAt, now = Date.now(), graceMs = GRACE_MS) {
  if (!isLockSet()) return false;
  if (!hiddenAt) return true;
  const gone = now - hiddenAt;
  if (!Number.isFinite(gone)) return true;
  return gone > graceMs;
}

/**
 * 여러 번 틀렸을 때 얼마나 쉬어야 하나 (밀리초). 0 이면 바로 칠 수 있다.
 *
 * **늘려가지 않는다.** 서버 자물쇠라면 늘려야 하지만, 여기는 기기 안의 가림막이라
 * 오래 잠가둬 봐야 주인만 곤란해진다 — 정작 마음먹은 사람은 저장소를 지운다.
 */
export function cooldownLeft(tries, lastTryAt, now = Date.now(), cooldownMs = COOLDOWN_MS) {
  if (!(tries >= MAX_TRIES) || !lastTryAt) return 0;
  const left = cooldownMs - (now - lastTryAt);
  return left > 0 ? left : 0;
}
