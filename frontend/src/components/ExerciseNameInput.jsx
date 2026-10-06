import { useState, useMemo, useRef, useEffect } from 'react';
import { searchExercises, partOf } from '../data/exerciseDict';
import { bodyPartOf } from '../data/bodyPart';

// 운동 이름 칸 — **치는 동안 사전이 거든다** (2026-10-06).
//
// ── 왜 만들었나 ──
//
// 루틴을 짤 때 운동 이름을 **맨 글자로** 치고 있었다. 앱에는 사전이 437개 있고
// 「운동」 탭과 「운동 검색」은 그것을 쓰는데(`ExerciseFinder`), 루틴 폼만 안 썼다.
//
// 그게 그냥 불편한 정도가 아니다. **루틴은 그 사람이 매번 하는 운동**이다.
// 이름이 사전에 없으면 `bodyPartOf` 가 '기타'로 떨어지고, 그러면 그 운동은
// **몸 지도에 영영 안 들어간다** — 한 번이 아니라 **매번** 그렇다.
// 「랫풀다운」을 「렛풀다운」으로 적어두면 등은 영영 식은 채로 보인다.
//
// ── `ExerciseFinder` 를 안 쓴 까닭 ──
//
// 그것은 **화면 한 판**이다 — 카드 목록 · 자세 설명 · 인터넷 검색까지 붙어 있다.
// 폼의 한 줄에 그것을 띄우면 적던 것이 가려진다. 여기는 **칸 하나와 밑에 뜨는
// 목록**이면 된다. 사전을 읽는 함수(`searchExercises`)는 같은 것을 쓴다.
//
// ── 자유 입력을 막지 않는다 ──
//
// 운동명은 자유 입력이다(사전은 437개고 사람이 치는 이름은 끝이 없다).
// 그래서 **고르지 않고 그냥 치고 넘어가도 된다** — 목록은 거드는 것이고
// 가두는 것이 아니다. 다만 **부위를 못 알아보는 이름이면 그 자리에서 말한다.**

const MAX = 6;

export default function ExerciseNameInput({
  value, onChange, placeholder = '운동명', style, inputStyle, autoFocus,
}) {
  const [open, setOpen] = useState(false);
  // 자판으로 짚고 있는 줄. -1 은 **아무것도 안 짚은 상태**다 —
  // 그때 Enter 는 「고르기」가 아니라 적던 것을 그대로 두는 것이다
  const [cursor, setCursor] = useState(-1);
  const wrapRef = useRef(null);

  const hits = useMemo(() => {
    const q = String(value || '').trim();
    if (!q) return [];
    return searchExercises(q, MAX);
  }, [value]);

  // 고른 이름이 그대로면 목록을 다시 안 띄운다 — 고르자마자 또 펴지면
  // 다음 칸으로 가는 길을 목록이 막는다
  const exact = hits.length === 1 && hits[0].ko === String(value || '').trim();
  const show = open && hits.length > 0 && !exact;

  // 바깥을 누르면 닫는다. **칸을 떠나는 것(blur)으로 닫지 않는다** —
  // 목록을 누르는 그 순간이 blur 라서, blur 로 닫으면 누른 것이 안 골라진다
  useEffect(() => {
    if (!show) return;
    const away = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [show]);

  const pick = (name) => {
    onChange(name);
    setOpen(false);
    setCursor(-1);
  };

  const onKeyDown = (e) => {
    if (!show) {
      // 닫혀 있을 때 ↓ 는 **목록을 편다** — 치다 말고 뭐가 있나 보고 싶을 때다
      if (e.key === 'ArrowDown' && hits.length > 0) { e.preventDefault(); setOpen(true); setCursor(0); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => (c + 1) % hits.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => (c <= 0 ? hits.length - 1 : c - 1)); }
    else if (e.key === 'Enter') {
      // **짚은 것이 없으면 Enter 를 가로채지 않는다.** 적던 이름 그대로 두고
      // 폼이 하던 일(다음 칸 · 저장)을 한다
      if (cursor >= 0) { e.preventDefault(); pick(hits[cursor].ko); }
      else setOpen(false);
    } else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setCursor(-1); }
  };

  // 적어둔 이름이 어느 부위로 읽히나. **사전에 없어도 낱말로 맞혀본다**
  // (`bodyPartOf` 가 그 일을 한다) — 「라잉 레그컬」 같은 변형이 거기서 잡힌다
  const typed = String(value || '').trim();
  const part = typed ? bodyPartOf(typed) : null;
  const unknown = !!typed && part === '기타';

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      <input
        className="input"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setCursor(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
        aria-autocomplete="list"
        style={{ width: '100%', marginBottom: 0, ...inputStyle }}
      />

      {/* ── 적은 이름이 어느 부위인가 ──
          **못 알아보면 그때만 말한다.** 알아본 부위를 매 줄에 적으면 폼이
          라벨 밭이 되는데, 사람이 알아야 하는 것은 **안 잡힌 줄 하나**다 */}
      {unknown && (
        <div style={{
          fontSize: 10.5, color: 'var(--warning)', lineHeight: 1.5,
          marginTop: 3, letterSpacing: -0.1,
        }}>
          부위를 못 알아봐요 · 몸 지도에 안 들어갑니다
        </div>
      )}

      {show && (
        <ul
          role="listbox"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
            margin: '3px 0 0', padding: 0, listStyle: 'none',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-hover)',
            borderRadius: 'var(--radius)', boxShadow: '0 6px 18px rgba(0,0,0,.45)',
            maxHeight: 232, overflowY: 'auto',
          }}
        >
          {hits.map((h, i) => {
            const on = i === cursor;
            return (
              <li key={h.ko} role="option" aria-selected={on}>
                <button
                  type="button"
                  // **mousedown 에서 고른다.** click 은 blur 뒤에 와서,
                  // 그 사이에 목록이 닫히면 눌린 것이 사라진다
                  onMouseDown={(e) => { e.preventDefault(); pick(h.ko); }}
                  onMouseEnter={() => setCursor(i)}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 8, width: '100%',
                    padding: '8px 10px', background: on ? 'var(--accent-dim)' : 'none',
                    border: 'none', borderBottom: '1px solid var(--border)',
                    fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  <span style={{
                    fontSize: 13, color: on ? 'var(--accent)' : 'var(--text-primary)',
                    minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{h.ko}</span>
                  {/* 부위를 같이 적는다 — 같은 이름의 변형이 여럿일 때
                      어느 것을 고르는지가 이름만으로는 안 갈린다 */}
                  {partOf(h) && (
                    <span style={{
                      marginLeft: 'auto', flexShrink: 0, fontSize: 10.5,
                      color: 'var(--text-muted)', letterSpacing: 0.4,
                    }}>{partOf(h)}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
