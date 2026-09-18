// 측정 기록의 **사람이 읽는 이름표** (2026-09-18 에 여기로 옮겼다).
//
// 내보내기(`routes/export.js`)가 들고 있던 것인데, **가져오기가 같은 표를 거꾸로**
// 읽어야 해서 한 곳으로 옮겼다. 두 벌로 두면 항목 하나를 더할 때 한쪽만 고쳐지고,
// 그러면 **내보낸 파일을 그 앱이 다시 못 읽는다** — 그것도 되돌릴 길이 없는 잘못이다.
//
// 이름표를 쓰는 까닭은 하나다 — 파일을 열었을 때 `arm_l` 이 뭔지 몰라야 할 이유가 없다.

const MEASURE_LABEL = {
  bodySize: '전신 사이즈',
  oneRM: '1RM',
  fitness: '체력 테스트',
  flexibility: '유연성',
  shoulder: '어깨',
  stopwatch: '스톱워치',
};

// 화면에 적힌 이름 그대로 내보낸다
const FIELD_LABEL = {
  chest: '가슴둘레', waist: '허리둘레', hip: '엉덩이둘레',
  arm_l: '왼팔둘레', arm_r: '오른팔둘레', thigh_l: '왼허벅지', thigh_r: '오른허벅지',
  calf: '종아리둘레', neck: '목둘레',
  exercise: '운동', weight: '무게', reps: '횟수', orm: '예상 1RM',
  pushup: '푸시업 최대', pullup: '풀업 최대', plank: '플랭크 최대',
  run_1km: '1km 달리기', situp: '윗몸일으키기 1분', squat_max: '스쿼트 최대',
  sitreach: '앉아 앞으로 굽히기', shoulder_l: '왼쪽 어깨 유연성', shoulder_r: '오른쪽 어깨 유연성',
  squat_depth: '스쿼트 깊이',
  shoulder: '어깨 너비', ratio: '어깨:허리',
  // 스톱워치가 실제로 남기는 이름 (time · formatted · laps)
  time: '밀리초', formatted: '시간', laps: '랩',
};

/** 이름표 → 열쇠. **거꾸로 읽는 표는 만들어 쓴다** — 손으로 적으면 어긋난다 */
const flip = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]));

const MEASURE_TYPE_OF = flip(MEASURE_LABEL);
const FIELD_KEY_OF = flip(FIELD_LABEL);

module.exports = { MEASURE_LABEL, FIELD_LABEL, MEASURE_TYPE_OF, FIELD_KEY_OF };
