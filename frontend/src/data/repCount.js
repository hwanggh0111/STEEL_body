// 횟수 세기 — **관절이 오갈 때마다 하나** (2026-09-30).
//
// 체형에 붙인 자세 인식(`poseModel.js`)이 이미 관절 33점을 잡는다. 스쿼트는 무릎이,
// 푸시업은 팔꿈치가 **접혔다 펴지면 한 번**이다. 세트 중에 숫자를 세는 일에서
// 사람을 놓아준다.
//
// ── 이 파일이 아는 것과 모르는 것 ──
//
// **아는 것** — 관절 각도가 오간 횟수. 그것뿐이다.
// **모르는 것** — 자세가 옳은지, 깊이가 충분한지, 무게가 맞는지. **말하지 않는다.**
// 「무릎이 안쪽으로 모였어요」 같은 말은 옆에서 찍은 한 대의 폰이 알 수 있는 것이
// 아니다. 그걸 적으면 짐작을 코치로 내놓는 것이고, 체형에서 거절한 바로 그것이다
// (`shapeRead.js` 에 적어둔 선과 같다).
//
// **셀 수 없는 운동은 셀 수 없다고 한다.** 플랭크 · 월싯은 버티는 것이라 오가는 것이
// 없고, 사전에 없는 이름은 어느 관절을 볼지 모른다 — 그때는 아예 안 연다.
//
// 이 파일은 카메라도 모델도 화면도 모른다. 점과 숫자만 받는다 — `npm run reps` 가 본다.

/** 볼 수 있는 관절. 이름은 화면이 그대로 적는다. */
export const JOINTS = {
  knee: { label: '무릎', down: 100, up: 155 },
  elbow: { label: '팔꿈치', down: 100, up: 150 },
};

/**
 * 한 번으로 세려면 이만큼은 걸려야 한다.
 *
 * 관절 자리는 프레임마다 조금씩 떨린다. 문턱을 스치락말락 하는 자리에서 그 떨림이
 * 오르내림으로 읽히면 **가만히 있어도 숫자가 올라간다.**
 */
export const MIN_REP_MS = 600;

// **「이만큼은 움직여야 한다」는 규칙을 안 둔다** (2026-09-30 에 검사가 잡았다).
//
// 처음에는 `MIN_RANGE = 25` 를 뒀는데, **한 번도 걸릴 수 없는 규칙**이었다 —
// 하나로 세려면 접힘 문턱(100도)과 펴짐 문턱(155도)을 **둘 다** 넘어야 하고, 그것이
// 이미 55도를 요구한다. 죽은 규칙을 두면 「폭도 본다」고 믿게 되므로 걷어냈다
// (9/29 에 위조 토큰 규칙이 세는 데 없이 이름만 있던 것과 같은 자리다).
//
// 떨림을 막는 것은 **문턱 사이의 55도**와 아래 `MIN_REP_MS` 둘이다.

/** 여기서 멈춘다. 이보다 많으면 세는 것이 아니라 뭔가 잘못된 것이다. */
export const MAX_REPS = 200;

/** 관절을 이만큼도 못 보면 셀 수 없다 (자세 인식이 주는 `visibility`). */
const SURE = 0.5;

// ── 어느 관절을 보나 ──
//
// 운동마다 다르다. **이름으로 고른다** — 부위로는 못 고른다(가슴 운동인 벤치프레스와
// 플라이는 같은 부위인데 하나는 팔꿈치가 접히고 하나는 거의 안 접힌다).
//
// **버티는 운동은 따로 걸러낸다.** 플랭크는 오가는 것이 없어서 「0」이 맞는 답인데,
// 0 을 세려고 카메라를 켜게 두면 안 된다.
const HOLD = ['플랭크', '월싯', '홀드', '버티기', '데드행', '사이드플랭크', '할로우'];
const KNEE = ['스쿼트', '런지', '점프스쿼트', '스텝업', '피스톨', '박스점프', '버피', '마운틴클라이머'];
const ELBOW = ['푸시업', '벤치프레스', '딥스', '풀업', '친업', '컬', '프레스', '로우', '푸쉬업', '팔굽혀펴기'];

const clean = (v) => String(v || '').replace(/\s+/g, '');

/**
 * 이 운동은 어느 관절로 세나. 모르면 `null`, 버티는 것이면 `'hold'`.
 *
 * **버티는 것과 모르는 것을 가른다** — 화면이 할 말이 다르다
 * (「버티는 운동은 셀 것이 없어요」 vs 「이 운동은 아직 셀 수 없어요」).
 */
export function jointFor(exercise) {
  const name = clean(exercise);
  if (!name) return null;
  if (HOLD.some((w) => name.includes(w))) return 'hold';
  // **무릎을 먼저 본다.** 「점프스쿼트」처럼 둘 다 걸리는 이름이 있는데, 그때 접히는
  // 것은 무릎이다
  if (KNEE.some((w) => name.includes(w))) return 'knee';
  if (ELBOW.some((w) => name.includes(w))) return 'elbow';
  return null;
}

/** 자세 인식의 33점 중 우리가 쓰는 자리 (`shapeRatio.js` 와 같은 번호다). */
export const LM = {
  shoulderL: 11, shoulderR: 12,
  elbowL: 13, elbowR: 14,
  wristL: 15, wristR: 16,
  hipL: 23, hipR: 24,
  kneeL: 25, kneeR: 26,
  ankleL: 27, ankleR: 28,
};

function pt(marks, i) {
  const p = marks?.[i];
  if (!p) return null;
  const vis = p.visibility ?? p.score ?? 1;
  if (vis < SURE) return null;
  return { x: p.x, y: p.y };
}

/**
 * 세 점이 만드는 각 (도). `b` 가 꼭짓점이다.
 *
 * **정규화 좌표를 그대로 쓴다.** 각도는 비율이 아니라 방향이라, 가로세로를 같은 자로
 * 되돌리지 않아도 된다… 는 **틀렸다.** 세로로 긴 사진에서 y 가 눌리면 각도도 눌린다.
 * 그래서 화면 비(`aspect` = 너비÷높이)를 받아 y 를 되돌린다.
 */
export function angleAt(a, b, c, aspect = 1) {
  if (!a || !b || !c) return null;
  const fix = (p) => ({ x: p.x, y: p.y / (aspect || 1) });
  const A = fix(a); const B = fix(b); const C = fix(c);
  const v1 = { x: A.x - B.x, y: A.y - B.y };
  const v2 = { x: C.x - B.x, y: C.y - B.y };
  const n1 = Math.hypot(v1.x, v1.y);
  const n2 = Math.hypot(v2.x, v2.y);
  if (!n1 || !n2) return null;
  let cos = (v1.x * v2.x + v1.y * v2.y) / (n1 * n2);
  cos = Math.max(-1, Math.min(1, cos));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
}

/**
 * 한 프레임에서 그 관절의 각도. **양쪽이 다 보이면 평균**, 한쪽만 보이면 그쪽.
 *
 * 둘 중 아무것도 못 보면 `null` — **0 이 아니다.** 0도는 「완전히 접혔다」는 뜻이라
 * 그대로 두면 안 보이는 순간마다 한 번씩 세어진다.
 */
export function jointAngle(marks, joint, aspect = 1) {
  if (joint === 'knee') {
    const l = angleAt(pt(marks, LM.hipL), pt(marks, LM.kneeL), pt(marks, LM.ankleL), aspect);
    const r = angleAt(pt(marks, LM.hipR), pt(marks, LM.kneeR), pt(marks, LM.ankleR), aspect);
    if (l !== null && r !== null) return Math.round((l + r) / 2);
    return l !== null ? l : r;
  }
  if (joint === 'elbow') {
    const l = angleAt(pt(marks, LM.shoulderL), pt(marks, LM.elbowL), pt(marks, LM.wristL), aspect);
    const r = angleAt(pt(marks, LM.shoulderR), pt(marks, LM.elbowR), pt(marks, LM.wristR), aspect);
    if (l !== null && r !== null) return Math.round((l + r) / 2);
    return l !== null ? l : r;
  }
  return null;
}

/**
 * 세기 시작. `joint` 는 `jointFor` 가 고른 것 ('knee' · 'elbow').
 *
 * `phase` 는 지금 어디인가 — 'wait'(아직 한 번도 못 봄) · 'up'(펴짐) · 'down'(접힘).
 * **처음을 'up' 으로 두지 않는다**: 이미 접힌 채로 시작한 사람의 첫 펴기가
 * 한 번으로 세어지면, 카메라를 켜자마자 1이 된다.
 */
export function startReps(joint) {
  return {
    joint,
    count: 0,
    phase: 'wait',
    // **펴진 데서 들어온 접힘인가.** 이것이 아니면 세지 않는다 — 이미 접힌 채로
    // 시작한 사람의 첫 펴기가 하나로 세어지면 카메라를 켜자마자 1이 된다
    fromUp: false,
    lastAt: 0,          // 마지막으로 하나 센 때 (0 이면 아직 하나도 안 셌다)
    seen: 0,            // 각도를 읽은 프레임 수
    missed: 0,          // 관절을 못 본 프레임 수
  };
}

/**
 * 프레임 하나를 먹인다. **새 칸을 돌려준다**(원래 것을 안 고친다 — 검사가 값으로 본다).
 *
 * angle 이 `null` 이면 **아무 판단도 안 한다.** 못 본 것은 못 본 것이고,
 * 그 사이에 몇 번을 했는지는 알 수 없다 — 지어내지 않는다.
 */
export function repTick(st, angle, now) {
  if (!st || !JOINTS[st.joint]) return st;
  if (angle === null || angle === undefined || !Number.isFinite(angle)) {
    return { ...st, missed: st.missed + 1 };
  }
  const { down, up } = JOINTS[st.joint];
  const s = { ...st, seen: st.seen + 1 };

  // 펴진 데 — 접힘에서 올라온 것이면 하나다
  if (angle >= up) {
    if (s.phase === 'down' && s.fromUp) {
      // **아직 하나도 안 셌으면 시간을 안 본다.** `MIN_REP_MS` 는 「하나와 다음 하나
      // 사이」의 자다 — 첫 하나에 걸면 카메라를 켠 지 얼마 안 된 사람의 첫 번이 빠진다
      const slow = s.lastAt === 0 || now - s.lastAt >= MIN_REP_MS;
      if (slow && s.count < MAX_REPS) {
        s.count += 1;
        s.lastAt = now;
      }
    }
    s.phase = 'up';
    return s;
  }

  // 접힌 데 — **펴진 데서 들어왔는지**를 같이 적어둔다
  if (angle <= down) {
    if (s.phase !== 'down') {
      s.fromUp = s.phase === 'up';
      s.phase = 'down';
    }
    return s;
  }

  // 가운데 — 오가는 중이다. 문턱을 넘을 때만 갈리므로 여기서는 아무것도 안 한다
  return s;
}

/**
 * 화면에 적을 한 줄. **자세를 평하지 않는다** — 세고 있는지, 못 보고 있는지만 말한다.
 *
 * 못 본 프레임이 절반을 넘으면 그 말을 먼저 한다. 숫자가 안 올라가는 까닭이
 * 「내가 잘못하고 있나」가 아니라 **카메라에 안 들어온 것**일 때가 많다.
 */
export function repsLine(st) {
  if (!st) return null;
  const total = st.seen + st.missed;
  if (total >= 12 && st.missed > total / 2) {
    return '몸이 화면에 다 안 들어와요 — 폰을 옆에 두고 온몸이 보이게 놓아주세요.';
  }
  if (st.seen === 0) return '아직 몸을 못 찾았어요.';
  const label = JOINTS[st.joint]?.label || '';
  if (st.count === 0) return `${label}이 접혔다 펴지면 하나씩 세요. 아직 0이에요.`;
  return `${st.count}번 셌어요.`;
}

/** 못 세는 운동에 할 말. 셀 수 있으면 `null`. */
export function cannotCount(exercise) {
  const joint = jointFor(exercise);
  if (joint === 'hold') return '버티는 운동은 셀 것이 없어요 (오가는 동작이 아니라서요).';
  if (joint === null) return '이 운동은 아직 셀 수 없어요 — 어느 관절을 볼지 정해두지 않았어요.';
  return null;
}
