import { useState } from 'react';
import {
  PITCHES, COUNTS, SPEEDS, SHAPES, NAME_MAX, MAX_TONES,
  buildTone, canAdd,
} from '../data/customTones';
import { playTone, setExtraTones } from '../data/alertSound';

// 내 소리 만들기 (2026-09-22).
//
// 기본 소리 넷(띵 · 종 · 삑 · 나무)으로는 모자라다는 말을 듣고 붙였다.
// **파일을 받지 않는다** — 재료를 주고 그 자리에서 만들게 한다
// (까닭은 `data/customTones.js` 에 적어뒀다).
//
// ── 만들면서 들린다 ──
//
// 고르개를 누를 때마다 **바로 울린다.** 알림음은 글자로는 못 고른다 —
// 「높게 · 3번 · 빠르게 · 날카롭게」가 어떤 소리인지 아무도 상상 못 한다.
// 그래서 고르는 것과 듣는 것을 한 동작으로 붙인다.

/** 고르개 한 줄. */
function Row({ label, items, value, onPick, idOf = (x) => x.id, nameOf = (x) => x.name }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {items.map((it) => {
          const id = idOf(it);
          const on = String(id) === String(value);
          return (
            <button
              key={id}
              onClick={() => onPick(id)}
              aria-pressed={on}
              style={{
                minHeight: 32, padding: '5px 11px', borderRadius: 6, fontSize: 11.5,
                fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border-hover)'}`,
                background: on ? 'var(--accent-dim)' : 'none',
                color: on ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >{nameOf(it)}</button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * @param tones   지금 만들어둔 것들
 * @param volume  들려줄 때 쓸 크기 (설정함이 들고 있는 값)
 * @param onSave  목록이 바뀌면 부른다
 */
export default function ToneMaker({ tones, volume, onSave, onPicked }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ pitch: 'mid', count: 3, speed: 'mid', shape: 'soft', name: '' });
  const [editId, setEditId] = useState(null);

  // 고를 때마다 **그 자리에서 울린다.** 만든 소리를 잠깐 얹어 울리고, 얹은 것은
  // 저장할 때 제대로 다시 얹는다 (지금 목록에 없는 소리를 재생해야 하기 때문이다)
  const tryIt = (next) => {
    const t = buildTone({ ...next, id: 'preview' });
    setExtraTones([...tones, t]);
    playTone('preview', volume);
  };

  const pick = (key) => (val) => {
    const next = { ...draft, [key]: val };
    setDraft(next);
    tryIt(next);
  };

  const save = () => {
    const t = buildTone({ ...draft, id: editId || undefined });
    const next = editId
      ? tones.map((x) => (x.id === editId ? t : x))
      : [...tones, t];
    onSave(next);
    setOpen(false);
    setEditId(null);
    setDraft({ pitch: 'mid', count: 3, speed: 'mid', shape: 'soft', name: '' });
    onPicked?.(t.id);      // 방금 만든 것을 **골라둔다** — 만들고 또 고르게 하지 않는다
  };

  const editOne = (t) => {
    setDraft({ ...t.draft, name: t.name });
    setEditId(t.id);
    setOpen(true);
  };

  const removeOne = (id) => onSave(tones.filter((x) => x.id !== id));

  return (
    <div style={{ marginTop: 10, paddingTop: 11, borderTop: '1px solid var(--border)' }}>
      {/* 만들어둔 것들 — 누르면 고쳐진다 */}
      {tones.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 7 }}>
            내가 만든 소리 {tones.length}/{MAX_TONES}
          </div>
          {tones.map((t) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 0', borderTop: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-primary)', flexShrink: 0 }}>{t.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.desc}
              </span>
              <button
                onClick={() => { setExtraTones(tones); playTone(t.id, volume); }}
                className="btn-secondary"
                style={{ width: 'auto', marginLeft: 'auto', flexShrink: 0, padding: '4px 9px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}
              >▶</button>
              <button
                onClick={() => editOne(t)}
                className="btn-secondary"
                style={{ width: 'auto', flexShrink: 0, padding: '4px 9px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}
              >고치기</button>
              <button
                onClick={() => removeOne(t.id)}
                style={{
                  flexShrink: 0, padding: '4px 9px', fontSize: 11, borderRadius: 6,
                  background: 'none', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', fontFamily: 'inherit', cursor: 'pointer',
                }}
              >지우기</button>
            </div>
          ))}
        </div>
      )}

      {!open ? (
        <button
          onClick={() => { setEditId(null); setOpen(true); }}
          disabled={!canAdd(tones)}
          className="btn-secondary"
          style={{
            width: '100%', minHeight: 38, fontFamily: 'inherit',
            cursor: canAdd(tones) ? 'pointer' : 'default',
            opacity: canAdd(tones) ? 1 : 0.5,
          }}
        >{canAdd(tones) ? '내 소리 만들기' : `${MAX_TONES}개까지 만들 수 있어요`}</button>
      ) : (
        <div style={{
          padding: 12, borderRadius: 8,
          border: '1px solid var(--border-hover)', background: 'var(--bg-tertiary)',
        }}>
          <Row label="얼마나 높게" items={PITCHES} value={draft.pitch} onPick={pick('pitch')} />
          <Row
            label="몇 번 울릴까"
            items={COUNTS.map((n) => ({ id: n, name: `${n}번` }))}
            value={draft.count}
            onPick={(v) => pick('count')(Number(v))}
          />
          <Row label="얼마나 빠르게" items={SPEEDS} value={draft.speed} onPick={pick('speed')} />
          <Row label="어떤 결로" items={SHAPES} value={draft.shape} onPick={pick('shape')} />

          <div style={{ display: 'flex', gap: 7, marginTop: 13 }}>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value.slice(0, NAME_MAX) })}
              placeholder="이름 (없으면 「내 소리」)"
              maxLength={NAME_MAX}
              style={{
                flex: 1, minWidth: 0, minHeight: 36, padding: '7px 10px',
                background: 'var(--bg-primary)', border: '1px solid var(--border-hover)',
                borderRadius: 6, color: 'var(--text-primary)', fontSize: 12.5, fontFamily: 'inherit',
              }}
            />
            <button
              onClick={() => tryIt(draft)}
              className="btn-secondary"
              style={{ width: 'auto', flexShrink: 0, padding: '0 12px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}
            >들어보기</button>
          </div>

          <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
            <button onClick={save} className="btn-primary" style={{ flex: 1, minHeight: 38, fontFamily: 'inherit', cursor: 'pointer' }}>
              {editId ? '고치기' : '저장'}
            </button>
            <button
              onClick={() => { setOpen(false); setEditId(null); setExtraTones(tones); }}
              className="btn-secondary"
              style={{ width: 'auto', padding: '0 14px', fontFamily: 'inherit', cursor: 'pointer' }}
            >그만</button>
          </div>
        </div>
      )}
    </div>
  );
}
