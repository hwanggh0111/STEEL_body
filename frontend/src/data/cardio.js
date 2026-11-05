// 유산소를 **시간과 거리로** 적는다 (2026-11-05).
//
// ── 앱이 세 자리에서 사과하고 있었다 ──
//
// 이 앱의 한 줄은 「운동 + 무게 + 세트 + 횟수」다. 런닝머신 30분을 적을 칸이 없어서
// **「1세트 1회」를 지어내야** 했고, 그렇게 지어낸 줄은 어느 셈에도 안 든다 —
//
//   기록 화면 머리글  「필수 칸에 맞춰 넘기고(**세트와 횟수를 지어내야 했다**)」
//   몸 지도           「유산소 · 전신 12건은 **지도에 자리가 없어요**」
//   부위 볼륨         「맨몸 · 유산소는 **뺐습니다**」
//
// 사전은 달리기 설명에 아예 **「거리와 시간으로 적는다」**고 적어놓고도 그 칸을
// 주지 않았다(11/03 에 달리기·줄넘기를 넣으면서 적은 말이다). 그래서 유산소만 하는
// 사람은 **매일 적어도 앱이 아무 말도 못 했다.**
//
// ── 어느 운동이 시간·거리로 적는 것인가 ──
//
// **사전이 든다**(`cardio: true`). 「전신 · 유산소」로 묶어 판단하면 안 된다 —
// 버피 · 점핑잭 · 케틀벨 스윙도 그 부위고, 그것들은 **세트 · 횟수가 맞는** 운동이다.
// 시간·거리로 적는 것은 유산소 **기계**들과 달리기 · 줄넘기다.
//
// ── 담긴 줄은 이름으로 판단하지 않는다 ──
//
// 칸을 바꿀 때는 **이름**으로 보고(`isCardioName`), 담긴 줄을 그릴 때는 **그 줄에
// 시간·거리가 적혀 있는가**로 본다(`isCardioRow`). 이 둘을 섞으면, 지어내어 적어둔
// 옛 「런닝머신 1세트 1회」가 갑자기 「유산소 줄」로 읽혀 **없는 시간을 0분으로**
// 그린다. 옛 줄은 옛 모양 그대로 보여주고, 고쳐 적으면 들어온다.
import { EXERCISE_DICT } from './exerciseDict';
import { MINUTES_MAX, DISTANCE_KM_MAX } from './limits';

export { MINUTES_MAX, DISTANCE_KM_MAX };

/** 사전과 같은 다듬기 — 공백 · 기호를 지우고 소문자로 (`exerciseDict` 의 `norm` 과 같다) */
const norm = (s) => String(s || '').toLowerCase().replace(/[\s.,!?~·・\-_'"()]/g, '');

/** 시간·거리로 적는 운동의 이름 전부 (한글 · 영어 · 별명) */
const CARDIO_NAMES = (() => {
  const out = new Set();
  for (const e of EXERCISE_DICT) {
    if (!e || !e.cardio) continue;
    for (const n of [e.ko, e.en, ...(e.alias || [])]) {
      const k = norm(n);
      if (k) out.add(k);
    }
  }
  return out;
})();

/** 그 이름이 몇 개나 잡히는가 — 자가 「사전이 비면 아무것도 안 잡는다」를 본다 */
export const cardioNameCount = () => CARDIO_NAMES.size;

/**
 * **이 이름은 시간·거리로 적는 운동인가.**
 *
 * 사람은 제 손으로 적는다 — 「아침 달리기」 · 「런닝머신 경사」. 그래서 사전 이름을
 * **품고 있으면** 그것으로 본다(`bodyPartOf` 가 쓰는 그 자). 품은 이름이 둘 이상이면
 * 더 긴 쪽이 센 증거이지만, 여기서는 「유산소인가」 하나만 가리므로 하나만 걸려도 참이다.
 */
export function isCardioName(exercise) {
  const n = norm(exercise);
  if (!n) return false;
  if (CARDIO_NAMES.has(n)) return true;
  for (const name of CARDIO_NAMES) {
    // 한 글자 이름은 없지만, 짧은 이름이 남의 이름 안에 들어가는 것은 막는다
    if (name.length >= 2 && n.includes(name)) return true;
  }
  return false;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** 담긴 줄이 유산소 줄인가 — **그 줄에 시간이나 거리가 적혀 있는가**로만 본다 */
export function isCardioRow(row) {
  return row != null && (num(row.minutes) !== null || num(row.distance_km) !== null);
}

/** 줄에서 시간·거리를 꺼낸다 (없으면 null) */
export function cardioOf(row) {
  if (!row) return { minutes: null, km: null };
  return { minutes: num(row.minutes), km: num(row.distance_km) };
}

/** 32 → '32분' · 95 → '1시간 35분' */
export function minuteLabel(min) {
  const n = num(min);
  if (n === null) return null;
  const m = Math.round(n);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}시간 ${r}분` : `${h}시간`;
}

/** 5.2 → '5.2km' (10m 자리까지, 0 은 떼고) */
export function kmLabel(km) {
  const n = num(km);
  if (n === null) return null;
  return `${Number(n.toFixed(2))}km`;
}

/**
 * **얼마나 빨랐나** — 1km 에 몇 분 몇 초. 둘 다 적혀 있을 때만.
 *
 * 지어내는 것이 아니라 **나눗셈**이다. 그래도 적는 데 조심한다 — 런닝머신에서
 * 걷다 뛰었으면 평균이고, 그 사실을 화면이 「평균」이라고 적는다.
 * 1km 에 한 시간이 넘으면(산책 · 재활) 적지 않는다 — 그 수는 뜻이 없다.
 */
export function paceLabel(minutes, km) {
  const m = num(minutes);
  const d = num(km);
  if (m === null || d === null) return null;
  const perKm = m / d;
  if (!Number.isFinite(perKm) || perKm <= 0 || perKm > 60) return null;
  const mm = Math.floor(perKm);
  const ss = Math.round((perKm - mm) * 60);
  // 59.6초가 60초로 올라가면 「6분 60초」가 된다
  const fixM = ss === 60 ? mm + 1 : mm;
  const fixS = ss === 60 ? 0 : ss;
  return `${fixM}분 ${String(fixS).padStart(2, '0')}초/km`;
}

/** 한 줄을 사람 말로 — '32분 · 5.2km' (하나만 있으면 그것만) */
export function cardioText(row) {
  const { minutes, km } = cardioOf(row);
  return [minuteLabel(minutes), kmLabel(km)].filter(Boolean).join(' · ');
}

/** 'YYYY-MM-DD' 에서 며칠 뒤로 (`bodyHeat.shiftBack` 과 같은 자) */
function shiftBack(key, days) {
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * **최근 이레의 유산소.** 몸 지도 아래 한 줄과 통계가 같은 것을 본다.
 *
 * 「이번 주」로 세지 않는다 — 월요일 아침마다 0 이 되어, 일요일에 10km 뛴 사람이
 * 월요일에 아무것도 안 한 사람이 된다 (`bodyHeat` 가 세트를 세는 그 규칙과 같다).
 * **앞날은 안 센다.**
 *
 * 돌려주는 것: `{ count, minutes, km, names, days }`
 */
export function cardioSummary(workouts, today = null, days = 7) {
  const from = today ? shiftBack(today, Math.max(0, days - 1)) : null;
  let count = 0;
  let minutes = 0;
  let km = 0;
  const names = [];
  Object.entries(workouts || {}).forEach(([date, list]) => {
    if (!date || !Array.isArray(list)) return;
    if (today && date > today) return;          // 앞날은 아직 한 것이 아니다
    if (from && date < from) return;
    list.forEach((row) => {
      if (!isCardioRow(row)) return;
      const { minutes: m, km: d } = cardioOf(row);
      count += 1;
      minutes += m || 0;
      km += d || 0;
      const nm = String(row?.exercise || '').trim();
      if (nm && !names.includes(nm)) names.push(nm);
    });
  });
  return { count, minutes, km: Number(km.toFixed(2)), names, days };
}

/** 최근 이레 유산소를 한 줄로 — '2시간 10분 · 14.2km'. 없으면 null */
export function summaryText(sum) {
  if (!sum || sum.count === 0) return null;
  return [minuteLabel(sum.minutes), kmLabel(sum.km)].filter(Boolean).join(' · ');
}
