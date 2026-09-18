// 운동 이름으로 부위를 알아낸다.
//
// 운동명은 자유 입력이라 ('인클라인 덤벨 프레스' · '벤치' · 'bench press') 정해진 목록으로는
// 맞출 수 없다. 이름에 들어 있는 말로 고른다.
//
// 낱말은 앱이 이미 쓰는 운동 이름에서 뽑았다 — 루틴 추천(backend/src/routes/routines.js)의
// 여섯 부위와 운동 검색 목록이다. 못 맞히면 **'기타'** 로 두고, 억지로 어딘가에 밀어 넣지 않는다.
// 부위 분포에서 '기타'가 크게 잡히면 그건 사전이 모자란 것이니 낱말을 늘리면 된다.

export const PARTS = ['가슴', '등', '어깨', '하체', '팔', '코어', '기타'];

// 순서가 곧 우선순위다. 위에서부터 맞는 것을 쓴다.
//
// 겹치는 말이 있어서 순서가 중요하다 —
// '클로즈그립 벤치프레스'는 삼두 운동이지만 이름에 '벤치'가 있고,
// '파이크 푸시업'은 어깨 운동이지만 이름에 '푸시업'이 있다.
// 더 좁은 말을 위에 둔다.
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

// 규칙 순서로 풀 수 없는 겹침. 더 좁은 이름이 넓은 이름 **아래** 규칙에 있을 때 여기 둔다.
//   레그레이즈 — 어깨의 '레이즈'가 코어의 '레그레이즈'보다 위에 있다
//   데드버그   — 등의 '데드'가 코어의 '데드버그'보다 위에 있다
const OVERRIDES = [
  ['레그레이즈', '코어'], ['legraise', '코어'],
  ['데드버그', '코어'], ['deadbug', '코어'],
];

const norm = (s) => String(s || '').toLowerCase().replace(/[\s.,!?~·・\-_'"()]/g, '');

// ── 낱말은 **한 번만** 다듬는다 ── (2026-09-17)
//
// 여기가 앱에서 제일 뜨거운 자리였다. 예전에는 `bodyPartOf` 안에서 `norm(w)` 를
// 돌렸다 — **부를 때마다 낱말 백 개를 전부 다시 다듬었다**는 뜻이다.
// 낱말은 이 파일에 적혀 있고 절대 안 바뀌는데도.
//
// 3년치(기록 3,125건)로 재보니 몸 지도 계산(`buildHeat`)이 **29.9ms** 였다.
// 그중 대부분이 여기였다 — 기록마다 정규식 백 번이니 30만 번이다. 홈을 그릴 때마다
// 돈다. 폰은 이 컴퓨터보다 서너 배 느리니 100ms 가 넘는다.
const N_OVERRIDES = OVERRIDES.map(([word, part]) => [norm(word), part]);
const N_RULES = RULES.map(([part, words]) => [part, words.map(norm)]);

// ── 같은 이름을 두 번 풀지 않는다 ──
//
// 기록 3,000건에 들어 있는 **운동 이름은 몇십 가지**다. 「벤치프레스」가 300번
// 나오면 300번 다 같은 답이 나온다. 한 번 풀어두고 다시 쓴다.
//
// **한도를 둔다.** 운동명은 자유 입력이라 오타까지 저마다 다른 이름이 된다 —
// 한도가 없으면 오래 켜둔 화면에서 이 표가 계속 자란다. 넘치면 통째로 비운다
// (하나씩 골라 버리는 것보다 싸고, 다시 채우는 데 몇 ms 면 된다).
const CACHE_MAX = 500;
const _cache = new Map();

/** 운동 이름 → 부위. 못 맞히면 '기타'. */
export function bodyPartOf(exercise) {
  const n = norm(exercise);
  if (!n) return '기타';

  const hit = _cache.get(n);
  if (hit !== undefined) return hit;

  let found = '기타';
  for (const [word, part] of N_OVERRIDES) {
    if (n.includes(word)) { found = part; break; }
  }
  if (found === '기타') {
    for (const [part, words] of N_RULES) {
      if (words.some((w) => n.includes(w))) { found = part; break; }
    }
  }

  if (_cache.size >= CACHE_MAX) _cache.clear();
  _cache.set(n, found);
  return found;
}

/**
 * 기록 목록의 부위 분포.
 *
 * 세는 단위는 **세트 수**다. 기록 건수로 세면 3세트짜리와 5세트짜리가 같아지고,
 * 볼륨(무게×세트×횟수)으로 세면 맨몸 운동이 통째로 0이 된다.
 *
 * [{ part, sets, ratio }] 를 많은 순으로 돌려준다. 0인 부위는 넣지 않는다.
 */
export function partDistribution(records) {
  const bySets = new Map();
  let total = 0;
  (records || []).forEach(r => {
    const sets = Number(r?.sets) || 0;
    if (sets <= 0) return;
    const part = bodyPartOf(r.exercise);
    bySets.set(part, (bySets.get(part) || 0) + sets);
    total += sets;
  });
  if (!total) return [];
  return [...bySets.entries()]
    .map(([part, sets]) => ({ part, sets, ratio: sets / total }))
    .sort((a, b) => b.sets - a.sets);
}
