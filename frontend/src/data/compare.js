// 비교 화면이 쓰는 계산.
//
// 화면 안에 두면 눈으로만 확인된다. **이 화면은 눈으로 봐서는 틀린 것을 못 잡는 자리다** —
// 과거와 현재를 거꾸로 골라도 그래프는 멀쩡히 그려지고, 숫자만 조용히 반대로 말한다.
// 그래서 계산을 떼어내 `npm run check` 가 돌려본다.

/** 인바디 기록은 최신이 앞이다(0번이 제일 최근). 그래서 **과거일수록 인덱스가 크다.** */
export const NEWEST_FIRST = true;

/**
 * 고른 두 날짜를 **과거 → 현재** 순으로 바로잡는다.
 *
 * 예전에는 칸 둘이 서로를 안 봤다. BEFORE 에 최신을, AFTER 에 옛날을 골라도 막지 않아서
 * **5kg 뺀 사람의 화면에 「체중 5kg 증가」가 떴다.** 막지 않고 바로잡는다 —
 * 「그렇게 고르면 안 됩니다」라고 하는 것보다 알아서 앞뒤를 맞추는 편이 낫다.
 *
 * @returns {{ before:number, after:number, swapped:boolean, same:boolean }}
 */
export function orderPick(beforeIdx, afterIdx) {
  const b = Number(beforeIdx);
  const a = Number(afterIdx);
  if (!Number.isFinite(b) || !Number.isFinite(a)) return { before: b, after: a, swapped: false, same: false };
  if (b === a) return { before: b, after: a, swapped: false, same: true };
  // 인덱스가 큰 쪽이 과거다
  const swapped = b < a;
  return {
    before: swapped ? a : b,
    after: swapped ? b : a,
    swapped,
    same: false,
  };
}

/** 두 날짜 사이가 며칠인가. 못 읽으면 null (화면은 그 줄을 안 그린다) */
export function daysBetween(from, to) {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

/** 「84일 사이」 · 「3개월 사이」. 석 달이 넘으면 달로 읽는 편이 빠르다 */
export function spanLabel(days) {
  if (days == null) return '';
  if (days === 0) return '같은 날';
  const n = Math.abs(days);
  if (n < 90) return `${n}일 사이`;
  const months = Math.round(n / 30);
  return `${months}개월 사이 (${n}일)`;
}

// 견주는 다섯 가지. 화면 세 곳(요약 줄 · 표 · 막대)이 **이 목록 하나**를 본다 —
// 예전에는 세 곳이 각자 적어둬서, 한 곳만 고치면 다른 곳이 옛 목록으로 남았다
export const FIELDS = [
  { key: 'weight', label: '체중', unit: 'kg' },
  { key: 'muscle_kg', label: '골격근량', unit: 'kg' },
  { key: 'fat_pct', label: '체지방률', unit: '%' },
  { key: 'water_l', label: '체수분', unit: 'L' },
  { key: 'bmi', label: 'BMI', unit: '' },
];

/**
 * 무엇이 어느 쪽으로 갔나.
 *
 * **좋고 나쁨을 매기지 않는다.** 8/25 에 「몸에 등급을 안 매긴다」고 정했는데,
 * 이 화면의 「종합 평가」만 그 뒤로도 등급을 매기고 있었다 — 체중이 늘면 주황(주의),
 * 체지방이 늘면 빨강(위험). **벌크업 중인 사람에게 「체중 증가」를 경고색으로 줬다.**
 * 방향(`dir`)만 준다. 색은 화면이 방향으로만 고른다.
 */
export function changes(before, after) {
  if (!before || !after) return [];
  return FIELDS
    .filter((f) => before[f.key] != null && after[f.key] != null)
    .map((f) => {
      const diff = Number(after[f.key]) - Number(before[f.key]);
      const rounded = Number(diff.toFixed(1));
      return {
        ...f,
        before: Number(before[f.key]),
        after: Number(after[f.key]),
        diff: rounded,
        // 1: 늘었다 · -1: 줄었다 · 0: 그대로
        dir: rounded > 0 ? 1 : rounded < 0 ? -1 : 0,
      };
    });
}

/** 「+0.8kg」 · 「-3.0kg」 · 「그대로」 */
export function diffLabel(c) {
  if (c.dir === 0) return '그대로';
  return `${c.diff > 0 ? '+' : ''}${c.diff.toFixed(1)}${c.unit}`;
}
