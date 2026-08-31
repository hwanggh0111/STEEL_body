import { useState, useEffect, useRef } from 'react';

// 그래프는 가로를 부모에 맞춘다.
//
// viewBox 하나로 늘리는 방법도 있지만 그러면 글자까지 같이 늘어난다 —
// 폰에서 11px 이던 축 글씨가 PC 에서 20px 이 된다. 가로만 재서 좌표를 다시 잡는다.
export function useWidth(fallback = 320) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(Math.max(200, Math.round(el.clientWidth)));
    read();
    // 창 크기 · 사이드바 · 탭 전환으로 폭이 바뀐다. 다 잡으려면 이게 제일 싸다
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, w];
}

// 축 눈금 — 사람이 읽는 숫자로 끊는다 (1 · 2 · 5 · 10 …).
// 그냥 최소~최대를 3등분하면 「71.33」 같은 눈금이 나온다.
export function niceScale(min, max, ticks = 4) {
  if (!(max > min)) {
    const v = max || 0;
    return { min: v - 1, max: v + 1, values: [v - 1, v, v + 1] };
  }
  const raw = (max - min) / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].find(s => s * mag >= raw) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const values = [];
  // 부동소수 오차로 눈금이 하나 더 생기거나 빠지는 것을 막는다
  for (let v = lo; v <= hi + step / 1000; v += step) values.push(Number(v.toFixed(6)));
  return { min: lo, max: hi, values };
}

// 12.0 → 12, 12.34 → 12.3. 축과 말풍선이 같은 규칙을 쓴다
export const fmt = (v) =>
  (v == null || Number.isNaN(v)) ? '-' : String(Number(Number(v).toFixed(1)));

// 날짜를 다 적으면 글자가 서로 겹친다. 폭에 맞춰 몇 칸씩 건너뛴다.
//
// 화면 밖으로 떼어 놓는다 — 폰에서 날짜가 몇 칸씩 뛰는지는 폭이 진짜로 바뀌어야
// 보이는 것이라 브라우저로만 확인되던 자리였다. 계산만 남기면 화면 없이 돌려본다.
export function labelEvery(count, innerW, gap = 46) {
  const slots = Math.max(2, Math.floor(innerW / gap));
  return Math.max(1, Math.ceil(count / slots));
}

// 실제로 적을 칸을 고른다. 마지막 날은 늘 적는다 — 「지금」이 안 적히면 그래프가
// 어디서 끝났는지 모른다. 다만 바로 앞 것과 붙어 버리면 앞의 것을 뺀다.
// 겹쳐 적느니 하나만 적는 게 낫다
export function labelIndices(count, innerW, gap = 46) {
  if (count <= 0) return [];
  const every = labelEvery(count, innerW, gap);
  const out = [];
  for (let i = 0; i < count; i += every) out.push(i);
  const last = count - 1;
  if (out[out.length - 1] !== last) {
    if (out.length > 1 && last - out[out.length - 1] < every) out.pop();
    out.push(last);
  }
  return out;
}

// 짚은 자리(그래프 왼쪽 끝에서 잰 거리)가 몇 번째 칸인가.
// 밖으로 나가면 양 끝으로 붙인다 — 손가락은 그래프 밖까지 미끄러진다
export function pickIndex(rel, innerW, count) {
  if (count <= 1) return 0;
  const i = Math.round((rel / innerW) * (count - 1));
  return Math.min(count - 1, Math.max(0, Number.isFinite(i) ? i : 0));
}
