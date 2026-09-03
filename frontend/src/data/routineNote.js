// 적어둔 메모에서 루틴을 뽑아낸다.
//
// 루틴을 만들려면 이름 · 운동 · 세트 · 횟수를 정해진 칸에 넣어야 한다. 그런데 루틴은
// 그렇게 완성된 채로 떠오르지 않는다 — 헬스장 가는 길에 「월요일 가슴 / 벤치 5x5 /
// 인클라인 3x12」 하고 적어보다가 고친다. 그렇게 적은 것을 **다시 칸에 옮겨 적게 하면
// 메모장을 만든 뜻이 없다.**
//
// 그래서 사람이 적는 대로 읽는다. 사람마다 적는 법이 다르므로 **여러 모양을 받는다** —
//
//     가슴 · 삼두              ← 콜론이나 가운뎃점으로 끝나면 제목으로 본다
//     - 벤치프레스 5x10
//     2. 인클라인 덤벨 3세트 12회
//     케이블 푸시다운 60kg 4x15   ← 무게는 떼어낸다 (루틴에는 무게 칸이 없다)
//     딥스
//
// **못 알아본 줄은 버리지 않고 그대로 이름으로 둔다.** 우리가 못 읽었다고 사람이 적은
// 것을 없애면, 루틴을 만들고 나서야 빠진 것을 알게 된다. 세트·횟수가 없으면 빈 칸으로
// 두면 될 뿐이다 — 어차피 다음 화면에서 고칠 수 있다.

// 글머리표 · 번호. 적을 때 습관대로 붙이는 것들이다
const BULLET = /^\s*(?:[-*·•+]|\d+[.)])\s*/;

// 세트 × 횟수. `5x10` · `5X10` · `5*10` · `5×10` · `5세트 10회` · `10회 5세트`
const SETS_X_REPS = /(\d{1,2})\s*[xX*×]\s*(\d{1,3})/;
const SETS_THEN_REPS = /(\d{1,2})\s*세트\s*(?:씩\s*)?(\d{1,3})\s*(?:회|번|개|reps?)/;
const REPS_THEN_SETS = /(\d{1,3})\s*(?:회|번|개)\s*(?:씩\s*)?(\d{1,2})\s*세트/;
const ONLY_SETS = /(\d{1,2})\s*세트/;
const ONLY_REPS = /(\d{1,3})\s*(?:회|번|개)/;

// 무게. 루틴에는 무게 칸이 없다 — **이름에 붙여두면 안 된다.**
// 「벤치프레스 60kg」이 운동 이름이 되면 기록 화면의 자동완성과 최고 기록이
// 무게마다 다른 운동으로 갈라진다
// (`\b` 는 한글 뒤에서 안 걸린다 — `100킬로` 의 `로` 다음은 둘 다 낱말 문자가
//  아니라 경계가 없다. 영문·숫자가 아닌 것만 확인한다)
const WEIGHT = /(?<![A-Za-z0-9.])\d{1,3}(?:\.\d)?\s*(?:kg|킬로|파운드|lb|lbs)(?![A-Za-z0-9])/gi;

// 제목 줄인가 — 콜론으로 끝나거나(`월요일:`), 운동 없이 부위만 적은 머리말
const isHeading = (line) => /[:：]\s*$/.test(line);

function cleanName(raw) {
  return raw
    .replace(WEIGHT, ' ')
    // 남은 구분 기호와 겹친 공백을 정리한다. `벤치프레스 -` 같은 꼬리표가 남으면 안 된다
    .replace(/[,\/|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—·•\s]+|[-–—·•\s]+$/g, '')
    .trim();
}

// 한 줄에서 운동 하나를 읽는다. 못 읽으면 null
export function parseLine(rawLine) {
  const line = String(rawLine || '').replace(BULLET, '').trim();
  if (!line) return null;
  if (isHeading(line)) return null;

  let sets = '';
  let reps = '';
  let rest = line;

  const take = (re, order) => {
    const m = rest.match(re);
    if (!m) return false;
    sets = order === 'sr' ? m[1] : m[2];
    reps = order === 'sr' ? m[2] : m[1];
    rest = rest.replace(m[0], ' ');
    return true;
  };

  // 순서가 있다. `5세트 10회` 를 먼저 보지 않으면 `5x10` 규칙이 엉뚱한 숫자를 문다
  if (!take(SETS_THEN_REPS, 'sr') && !take(REPS_THEN_SETS, 'rs') && !take(SETS_X_REPS, 'sr')) {
    // 둘 중 하나만 적은 경우
    const s = rest.match(ONLY_SETS);
    if (s) { sets = s[1]; rest = rest.replace(s[0], ' '); }
    const r = rest.match(ONLY_REPS);
    if (r) { reps = r[1]; rest = rest.replace(r[0], ' '); }
  }

  const name = cleanName(rest);
  // 이름이 없으면 그 줄은 숫자만 적힌 것이다. 이름 없는 운동은 루틴에 못 넣는다
  if (!name) return null;

  return { name: name.slice(0, 60), sets, reps };
}

// 메모 한 장을 루틴 하나로 읽는다.
//
//   { name, exercises: [{ name, sets, reps }] }
//
// 루틴 이름은 **첫 줄**에서 가져온다 — 대개 사람은 거기에 무엇을 하는 날인지 적는다.
// 첫 줄이 운동이면(제목이 아니면) 그 줄도 운동으로 세고, 이름은 비워 둔다.
// 이름을 우리가 지어내지 않는다 — 「메모 1」 같은 이름이 루틴 목록에 쌓이면 못 알아본다.
export function noteToRoutine(body, maxExercises = 50) {
  const lines = String(body || '').split(/\r?\n/);
  const first = lines.find(l => l.trim());
  let name = '';
  let start = 0;

  if (first !== undefined) {
    const trimmed = first.trim();
    // 제목 줄이거나, 운동으로 안 읽히는 짧은 줄이면 이름으로 쓴다
    const asExercise = parseLine(trimmed);
    if (isHeading(trimmed) || (asExercise && !asExercise.sets && !asExercise.reps && trimmed.length <= 20
        && lines.filter(l => l.trim()).length > 1)) {
      name = cleanName(trimmed.replace(/[:：]\s*$/, '').replace(BULLET, ''));
      start = lines.indexOf(first) + 1;
    }
  }

  const exercises = [];
  for (const line of lines.slice(start)) {
    const parsed = parseLine(line);
    if (parsed) exercises.push(parsed);
    if (exercises.length >= maxExercises) break;
  }

  return { name: name.slice(0, 100), exercises };
}

// 목록에 보여줄 한 줄 이름. 메모에는 제목 칸이 없다 — **첫 줄이 곧 제목**이다.
// 칸을 따로 두면 적으러 온 사람이 제목부터 정해야 한다
export function noteTitle(body) {
  const first = String(body || '').split(/\r?\n/).find(l => l.trim());
  if (!first) return '(빈 메모)';
  const clean = first.replace(BULLET, '').replace(/[:：]\s*$/, '').trim();
  return clean.length > 40 ? clean.slice(0, 40) + '…' : (clean || '(빈 메모)');
}

// 몇 줄이 운동으로 읽히는지. 「루틴으로 만들기」를 눌러도 되는지 미리 보여준다 —
// 눌렀더니 빈 루틴이 나오면 무엇이 잘못됐는지 알 길이 없다
export function countExercises(body) {
  return noteToRoutine(body).exercises.length;
}
