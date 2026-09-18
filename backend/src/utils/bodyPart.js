// 운동 이름 → 부위, 그리고 **가장 식은 부위**.
//
// ── 왜 서버에도 있나 ──
//
// 화면에는 이미 있다(`frontend/src/data/bodyPart.js` · `bodyHeat.js`). 몸 지도와
// 홈의 「오늘 할 곳」이 그것을 쓴다. 그런데 **알림은 앱이 닫혀 있을 때 나간다** —
// 그때 화면의 계산은 돌지 않는다. 「등이 9일째 식었습니다」를 보내려면
// **서버가 부위를 알아야 한다.**
//
// ── 두 벌인 것을 어떻게 다루나 ──
//
// 이 앱은 「같은 것을 두 곳에 두지 않는다」가 규칙이다. 그런데 여기는 어쩔 수 없다 —
// 화면은 ESM, 서버는 CommonJS 다. **그래서 그래프 색과 같은 방법을 쓴다**
// (`frontend/src/data/chartColors.js`: 토큰과 같은 값을 손으로 맞춰 두고 검사가 비교한다).
//
//   `npm run cold` 가 **양쪽에 같은 운동 이름 서른 개를 넣어 답을 맞춰본다.**
//   한쪽에만 낱말을 더하면 그 자리에서 걸린다.
//
// 낱말을 고칠 때는 **둘 다** 고친다.

// 순서가 곧 우선순위다. 위에서부터 맞는 것을 쓴다 (화면 쪽과 같은 차례여야 한다)
const RULES = [
  ['팔',   ['바이셉', '트라이셉', '이두', '삼두', '컬', 'curl', '푸시다운', 'pushdown', '킥백',
            '프리쳐', '해머', 'hammer', '딥스', 'dip', '클로즈그립', '좁은 푸시업', '리스트', '전완']],
  ['어깨', ['숄더', 'shoulder', '레이즈', 'raise', '오버헤드', 'overhead', 'ohp', '델트', 'delt',
            '밀리터리', 'military', '업라이트', '슈러그', 'shrug', '파이크', '핸드스탠드', '암서클', '월 워크']],
  ['등',   ['랫', 'lat', '풀업', 'pull up', 'pullup', '친업', 'chin', '로우', 'row', '데드리프트',
            'deadlift', '데드', '풀다운', '광배', '견갑', '티바', '슈퍼맨', '스노우엔젤']],
  ['가슴', ['벤치', 'bench', '체스트', 'chest', '푸시업', 'push up', 'pushup', '팔굽혀', '플라이', 'fly',
            '펙덱', '크로스오버', '덤벨프레스', 'dumbbell press', '인클라인', 'incline',
            '디클라인', 'decline']],
  ['하체', ['스쿼트', 'squat', '레그', 'leg', '런지', 'lunge', '힙', 'hip',
            '카프', 'calf', '종아리', '허벅지', '둔근', '글루트', 'glute', '브릿지', 'bridge',
            '스플릿']],
  ['코어', ['플랭크', 'plank', '크런치', 'crunch', '복근', 'ab', '싯업', 'sit up', 'situp', '윗몸',
            '레그레이즈', '레그 레이즈', '러시안 트위스트', '데드버그', '마운틴 클라이머', '버피',
            '점핑잭', '터키시', '전신']],
];

// 규칙 순서로 풀 수 없는 겹침 (화면 쪽과 같다)
const OVERRIDES = [
  ['레그레이즈', '코어'], ['legraise', '코어'],
  ['데드버그', '코어'], ['deadbug', '코어'],
];

/** 지도에 자리가 있는 부위. '기타'는 뺀다 — 어디를 칠할지 모르니 '기타'인 것이다 */
const MAP_PARTS = ['가슴', '등', '어깨', '하체', '팔', '코어'];

const norm = (s) => String(s || '').toLowerCase().replace(/[\s.,!?~·・\-_'"()]/g, '');

// 낱말은 **한 번만** 다듬는다 (화면 쪽에서 재보니 이게 제일 뜨거운 자리였다)
const N_OVERRIDES = OVERRIDES.map(([w, p]) => [norm(w), p]);
const N_RULES = RULES.map(([p, ws]) => [p, ws.map(norm)]);

/** 운동 이름 → 부위. 못 맞히면 '기타'. */
function bodyPartOf(exercise) {
  const n = norm(exercise);
  if (!n) return '기타';
  for (const [word, part] of N_OVERRIDES) if (n.includes(word)) return part;
  for (const [part, words] of N_RULES) if (words.some((w) => n.includes(w))) return part;
  return '기타';
}

/** 'YYYY-MM-DD' 두 개 사이의 날 수. 못 세면 null. */
function daysBetween(from, to) {
  if (typeof from !== 'string' || typeof to !== 'string') return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * 가장 식은 부위 하나.
 *
 * `rows` 는 `db.getWorkouts(userId)` 가 주는 그대로다 ({ date, exercise, … }).
 *
 * **한 번도 안 한 부위가 제일 앞이다** — 「6일 전」보다 「한 번도 안 함」이 더 빈 자리다.
 * 다만 **알림으로는 안 보낸다**(아래 `coldPartFor` 참고) — 이제 막 시작한 사람에게
 * 「등을 한 번도 안 했어요」는 나무라는 말로 읽힌다.
 *
 * 앞날 기록은 안 센다 — 달력에서 앞날에 적을 수 있는데, 아직 하지도 않은 운동으로
 * 부위가 달아오르면 알림이 거짓말을 한다.
 *
 * @returns { part, days, date } | null   days 가 null 이면 한 번도 안 한 부위
 */
function partDays(rows, today) {
  const last = {};
  MAP_PARTS.forEach((p) => { last[p] = null; });

  let any = false;
  for (const w of rows || []) {
    const date = w?.date;
    if (typeof date !== 'string') continue;
    if (today && date > today) continue;
    const part = bodyPartOf(w?.exercise);
    if (!MAP_PARTS.includes(part)) continue;
    any = true;
    if (!last[part] || date > last[part]) last[part] = date;
  }
  if (!any) return null;

  return MAP_PARTS
    .map((p) => ({ part: p, date: last[p], days: last[p] ? daysBetween(last[p], today) : null }))
    .sort((a, b) => {
      if (a.days === null && b.days === null) return MAP_PARTS.indexOf(a.part) - MAP_PARTS.indexOf(b.part);
      if (a.days === null) return -1;
      if (b.days === null) return 1;
      if (b.days !== a.days) return b.days - a.days;
      return MAP_PARTS.indexOf(a.part) - MAP_PARTS.indexOf(b.part);
    });
}

function coldestPart(rows, today) {
  const list = partDays(rows, today);
  return list ? list[0] : null;
}

/** 이보다 오래 안 건드린 부위만 알림에 싣는다. 사흘은 쉬는 것이지 식은 것이 아니다 */
const COLD_DAYS = 6;

/**
 * 알림에 실을 만한 「식은 부위」가 있는가.
 *
 * **없으면 null 이고, 그러면 알림은 원래 하던 말을 한다.** 억지로 부위를 찾아
 * 말을 만들지 않는다 — 고루 하고 있는 사람에게 굳이 한 곳을 짚어주면
 * 그 말이 틀린 말이 된다.
 */
function coldPartFor(rows, today) {
  const list = partDays(rows, today);
  if (!list) return null;

  // **한 번도 안 한 부위는 빼고 고른다** (2026-09-17 에 고쳤다).
  //
  // 처음에는 지도와 같은 차례를 그대로 썼다 — 지도에서는 「한 번도 안 함」이 맨 앞이다.
  // 그런데 알림에서는 그게 **두 가지로 다 나빴다**:
  //
  //   · 이제 막 시작한 사람에게 「등을 한 번도 안 했어요」는 알려주는 말이 아니라
  //     **나무라는 말**이다
  //   · 더 나쁜 것은 — 코어나 팔을 따로 안 하는 사람은 그 자리가 **영영 비어 있다.**
  //     맨 앞이 늘 「한 번도 안 함」이니 **알림이 한 번도 안 나간다.**
  //     정작 12일째 식은 하체는 아무도 안 짚어준다
  //
  // 그래서 **그 사람이 실제로 하는 부위 중에서** 제일 오래된 것을 고른다.
  // 검사(`npm run cold`)가 이것을 잡아줬다.
  // 목록은 이미 「한 번도 안 함」이 앞, 그 뒤는 오래된 순이다 —
  // 앞쪽(null)을 걷어내면 맨 앞이 곧 제일 오래된 것이다
  const done = list.filter((p) => p.days !== null);
  if (done.length === 0) return null;

  const cold = done[0];
  // 사흘은 쉬는 것이지 식은 것이 아니다
  if (cold.days < COLD_DAYS) return null;
  return cold;
}

module.exports = { bodyPartOf, coldestPart, coldPartFor, daysBetween, MAP_PARTS, COLD_DAYS };
