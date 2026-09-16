// 갈래 줄.
//
// **칸을 똑같이 나누지 않는다** (2026-09-16).
//
// 「몸」 탭은 갈래 넷을 `repeat(4, 1fr)` 로 나눠 썼다. 폰(390px)에서 한 칸이 84px 인데
// 「재는 도구」는 그 안에 안 들어가서 **잘렸다.** 갈래를 하나 더 붙이면 다섯이 되고,
// 그때는 전부 잘린다 — 칸을 나누는 방식은 **글자 수가 늘 때마다 무너진다.**
//
// 글자만큼만 차지하고, 넘치면 **옆으로 민다.** 앱에 이미 같은 결의 줄이 있다 —
// 옆으로 미는 거르개 한 줄(`.filter-row`)이다. 스크롤바는 안 그린다: 넘어간다는 것은
// **잘린 칩이 알려준다**(그 줄에 적어둔 판단을 여기서도 따른다).
//
// 화면 넷이 같은 줄을 쓴다(몸 · 기록 · 앞으로 붙을 것들). 두 벌로 두면 한쪽만
// 고치는 날이 오고, 그러면 같은 자리가 화면마다 다르게 생긴다.
export default function SegRow({ items, value, onChange, ariaLabel }) {
  return (
    <div
      className="filter-row"
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: 'flex', gap: 7, overflowX: 'auto',
        // 줄은 화면 끝까지 흐르게 두고 안쪽만 띄운다 — 밀 때 칸이 가장자리에서
        // 잘려 보이는 것이 「더 있다」는 신호다
        margin: '0 calc(var(--padding-x) * -1) 16px',
        padding: '0 var(--padding-x) 2px',
      }}
    >
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.key)}
            style={{
              flexShrink: 0,
              minHeight: 40,
              padding: '8px 14px',
              fontFamily: 'inherit',
              fontSize: 13,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              borderRadius: 'var(--radius)',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--border-hover)'}`,
              background: on ? 'var(--accent-dim)' : 'none',
              color: on ? 'var(--accent)' : 'var(--text-secondary)',
              transition: 'border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease',
            }}
          >{it.label}</button>
        );
      })}
    </div>
  );
}
