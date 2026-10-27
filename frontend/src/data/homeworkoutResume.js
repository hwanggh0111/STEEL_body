// 홈트에서 **멈춘 자리를 담아둔다** (2026-10-27).
//
// ── 무엇이 잘못돼 있었나 ──
//
// 「일시정지」는 10/24 에 생겼다(그 전에는 「중지」였고 다시 시작하면 처음부터였다).
// 그런데 멈춘 자리가 **화면이 들고 있는 값**이었다 — `useRef` 와 `useState`.
// 그래서 화면을 벗어나면 통째로 사라졌다 —
//
//   · 쉬는 20초 동안 기록 화면을 들여다보고 돌아오면 **처음부터**
//   · 폰에서 앱을 밀어 없애거나 알림을 따라 나갔다 오면 **처음부터**
//   · 여덟째 동작에서 전화를 받고 앱이 뒤로 밀렸다 돌아오면 **처음부터**
//
// 열두 개짜리 판의 여덟째에서 그러면 일곱 개를 다시 한다. 「일시정지」가 있는데
// 정작 **멈출 만한 일이 생기면** 못 이어가는 셈이었다.
//
// ── 왜 이 파일인가 ──
//
// 담아두고 읽는 일을 화면 안에 적으면 **눈으로만 확인되는 자리**가 된다.
// 담아둔 것이 깨졌을 때, 판이 없어졌을 때, 하루가 지났을 때 — 전부 손으로는
// 만들기 어려운 자리다. 그래서 값만 다루는 이 자리에 두고 검사가 본다
// (`npm run hwresume`). `breathRecover.js` 와 같은 결이다 — 여기는 화면도,
// localStorage 도 모른다. 글자를 받아 칸을 주고, 칸을 받아 글자를 준다.
//
// ── 지키는 선 ──
//
// 1. **깨진 것은 없는 것으로 본다.** 여기서 터지면 홈트 화면이 통째로 안 열린다 —
//    있으면 좋은 값 하나 때문에 판을 못 돌리게 둘 수는 없다.
// 2. **없어진 판은 안 이어준다.** 프로그램을 갈아끼우면 적혀 있던 이름이 사라진다.
// 3. **오래된 것은 버린다.** 사흘 전에 멈춘 자리에서 「12초 남음」으로 이어가는 것은
//    이어가는 것이 아니다.
// 4. **셈을 두 벌로 두지 않는다.** 「몇 번째에서 멈췄나」를 적는 글자는 목록 카드와
//    판 화면 두 곳에 나오는데, 두 곳이 따로 세면 하나만 고치는 날이 온다.

/** 이보다 오래된 것은 안 이어준다. 같은 날 안에 돌아오는 것까지만 본다. */
export const RESUME_MAX_MS = 6 * 60 * 60 * 1000;

/**
 * 한 칸에 남은 시간의 상한.
 *
 * 홈트의 한 칸은 가장 긴 것이 60초다. 그보다 큰 값이 적혀 있으면 담아둔 것이
 * 깨진 것이거나 기기 시계가 틀어진 것이다 — **지어낸 시간으로 안 이어준다.**
 */
export const LEFT_MAX_MS = 5 * 60 * 1000;

// **`Number(null)` 은 `0` 이다.** 빈 것은 없는 것으로 둔다 (`breathRecover.js` 와 같은 자)
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const intOf = (v) => {
  const n = num(v);
  return n === null ? null : Math.floor(n);
};

/**
 * 담아둘 칸을 만든다. **못 담을 것이면 `null`** — 부르는 쪽이 그때는 적지 않는다.
 *
 * @param program  판 이름
 * @param idx      몇 번째 칸인가 (0 부터)
 * @param rest     쉬는 칸인가
 * @param leftMs   그 칸에 남은 밀리초
 * @param skipped  사람이 넘긴 번호들 (Set 또는 배열)
 * @param at       멈춘 시각
 */
export function packResume({ program, idx, rest, leftMs, skipped, at } = {}) {
  const name = String(program || '').trim();
  const i = intOf(idx);
  const left = num(leftMs);
  const when = num(at);
  // 남은 것이 없으면 이어줄 것이 없다 (0 은 「그 칸이 끝났다」는 뜻이다)
  if (!name || i === null || i < 0 || left === null || left <= 0 || when === null) return null;
  const list = skipped instanceof Set ? [...skipped] : (Array.isArray(skipped) ? skipped : []);
  const nums = [...new Set(list.map(intOf).filter((n) => n !== null && n >= 0))].sort((a, b) => a - b);
  return {
    program: name,
    idx: i,
    rest: !!rest,
    leftMs: Math.min(Math.round(left), LEFT_MAX_MS),
    skipped: nums,
    at: Math.round(when),
  };
}

/**
 * 담아둔 글자를 읽어 칸으로. **믿을 수 없으면 `null`.**
 *
 * @param raw          담아둔 글자 (JSON). 아무것이나 와도 안 터진다
 * @param opts.programs 지금 있는 판들 (`{ 이름: [동작…] }`) — 없어진 이름은 안 이어준다
 * @param opts.now     지금 시각
 */
export function readResume(raw, { programs, now } = {}) {
  let v = null;
  try {
    v = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;                              // 깨진 것은 없는 것으로 본다
  }
  const packed = packResume(v || {});
  if (!packed) return null;

  const t = num(now);
  if (t === null) return null;
  // **앞날에 멈출 수는 없다.** 기기 시계를 돌려놨거나 담아둔 것이 깨진 것이다
  // (1분은 시계가 조금 어긋난 것까지 받아주는 자리다)
  if (packed.at > t + 60000) return null;
  if (t - packed.at > RESUME_MAX_MS) return null;

  // **없어진 판은 안 이어준다.** 판을 갈아끼워도 화면이 안 터진다
  const list = programs?.[packed.program];
  if (!Array.isArray(list) || list.length === 0) return null;
  // 칸 수가 줄었으면 그 자리는 이제 없는 자리다
  if (packed.idx >= list.length) return null;
  // 쉬는 칸이라고 적혀 있는데 그 동작에 쉬는 시간이 없으면 어긋난 것이다
  if (packed.rest && !(Number(list[packed.idx]?.rest) > 0)) return null;

  return { ...packed, skipped: packed.skipped.filter((n) => n < list.length) };
}

/** 남은 초. 올림으로 센다 — 반올림하면 마지막 0.5초가 잘린다 (판 화면과 같은 자) */
export function leftSeconds(leftMs) {
  const n = num(leftMs);
  return n === null || n <= 0 ? 0 : Math.ceil(n / 1000);
}

/**
 * 「몇 번째에서 멈췄나」 한 줄.
 *
 * **두 곳이 쓴다** — 목록의 「멈춘 자리」 카드와 판 화면의 「이어서 하기」 위.
 * 두 곳이 따로 세면 하나만 고치는 날이 온다(10/26 에 「부위별 5줄」이 그랬다).
 */
export function resumeLine({ idx, rest, leftMs } = {}) {
  const i = intOf(idx);
  if (i === null || i < 0) return null;
  return `${i + 1}번째 ${rest ? '휴식' : '운동'}에서 멈췄어요 · ${leftSeconds(leftMs)}초 남음`;
}
