import { useState, useMemo } from 'react';
import { useGymStore } from '../store/gymStore';
import { toast } from './Toast';
import { confirmDialog } from './ConfirmModal';
import {
  SLOTS, NUMBERS, GRIPS, NOTE_MAX, GYM_MAX, SLOT_MAX,
  hasSetting, filledSlots, toPayload, isKnownGym, copyableFrom,
} from '../data/gymSetting';

// 기구 세팅 — 운동 화면에 붙는 카드.
//
// **크게 안 띄운다.** 안 적은 사람에게는 한 줄이고, 적어둔 사람에게만 커진다 —
// 이 앱이 「없는 것을 크게 안 띄운다」고 정해둔 그대로다.
//
// 적는 데 드는 힘이 크면 아무도 안 적는다. 그래서 **고르는 것만으로 끝나게** 뒀다 —
// 숫자 여섯과 그립 넷을 미리 놓고, 자판은 「한마디」에서만 올라온다.

const BOX = {
  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: 13, marginBottom: 12,
};

function Chips({ options, value, onPick, allowFree }) {
  // 직접 칸에 친 것. **칩을 누르면 비운다** — 칩으로 고른 뒤에도 칸에 옛 글자가
  // 남아 있으면 무엇이 저장될지 두 곳이 서로 다른 말을 한다
  const [typed, setTyped] = useState(options.includes(value) ? '' : (value || ''));
  const pick = (v) => { setTyped(''); onPick(v); };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = value === o;
        return (
          <button
            key={o}
            type="button"
            // **누른 것을 다시 누르면 꺼진다** — 그 칸이 없는 기구가 있다
            onClick={() => pick(on ? '' : o)}
            style={{
              minWidth: 44, minHeight: 40, padding: '0 12px',
              fontFamily: o.length > 2 ? 'inherit' : "'Bebas Neue', sans-serif",
              fontSize: o.length > 2 ? 13 : 17, letterSpacing: o.length > 2 ? 0 : 1,
              background: on ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
              color: on ? 'var(--accent)' : 'var(--text-muted)',
              borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
          >{o}</button>
        );
      })}
      {/* 미리 놓은 것에 없는 기구가 있다 — 「8」 · 「12」 · 「A」 같은 것.
          **칸이 제가 친 것을 들고 있는다** (2026-09-18 리뷰에서 잡았다) —
          예전에는 `options.includes(value) ? '' : value` 로 그려서, 「12」를 치려고
          `1` 을 누른 순간 그 값이 미리 놓은 칩과 같아져 **칸이 스스로 비었다.**
          그래서 1~6 으로 시작하는 두 자리(10 · 12 · 15 · 21)를 아예 칠 수 없었다.
          칩을 눌러 고른 값은 칩이 켜져서 보이므로, 이 칸은 **친 것만** 보여주면 된다 */}
      {allowFree && (
        <input
          className="input"
          value={typed}
          onChange={(e) => { setTyped(e.target.value); onPick(e.target.value); }}
          placeholder="직접"
          maxLength={SLOT_MAX}
          style={{ width: 62, minHeight: 40, textAlign: 'center', padding: '0 6px' }}
        />
      )}
    </div>
  );
}

export default function GymSetting({ exercise }) {
  const gym = useGymStore((s) => s.gym);
  const setGym = useGymStore((s) => s.setGym);
  const gyms = useGymStore((s) => s.gyms);
  const all = useGymStore((s) => s.settings);
  const loaded = useGymStore((s) => s.loaded);
  const save = useGymStore((s) => s.save);
  const remove = useGymStore((s) => s.remove);

  // ── 적는 칸은 **어느 운동 것인지를 같이 들고 있는다** ── (2026-09-18)
  //
  // 예전에는 `editing` 이 그냥 참/거짓이었다. 그런데 이 카드는 「운동」 화면 안에
  // 있고, **적는 칸을 펴둔 채로 운동이 바뀔 수 있다** — 「운동 바꾸기」로 다른 것을
  // 고르거나, 루틴이 다음 칸으로 넘어갈 때다. 그러면 제목만 새 운동으로 바뀌고
  // 칸에는 앞 운동의 값이 남아 있었고, 저장을 누르면 **그 값이 새 운동 이름으로
  // 적혔다** — 새 운동에 이미 적어둔 세팅이 있었으면 그것을 조용히 덮어썼다.
  //
  // 참/거짓 대신 **운동 이름**을 들면 그 일이 구조적으로 안 생긴다. 이름이 바뀌는
  // 순간 `editing` 이 저절로 거짓이 되므로 **한 프레임도 어긋난 채로 안 그려진다**
  // (effect 로 닫으면 렌더 뒤에 닫혀서 그 한 프레임이 생긴다).
  const [editFor, setEditFor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ seat: '', foot: '', grip: '', note: '' });
  const [gymInput, setGymInput] = useState('');

  const name = String(exercise || '').trim();
  const setting = useMemo(
    () => (name && gym ? all.find((s) => s.gym === gym && s.exercise === name) || null : null),
    [all, gym, name],
  );
  // 다른 헬스장에 같은 운동을 적어뒀나 — 맨땅부터 적게 하면 대개 안 적는다
  const copyable = useMemo(() => copyableFrom(all, gym, name), [all, gym, name]);

  if (!name) return null;
  // 아직 못 받아왔으면 아무것도 안 그린다 — 「적어둘까요?」를 깜빡 띄웠다 지우지 않는다
  if (!loaded) return null;

  // ── 어디에 있는지부터 ──
  //
  // 헬스장을 안 고르면 세팅을 어디 것으로 적을지 정할 수 없다.
  // **위치는 안 본다** — GPS 는 권한을 물어야 하고 지하에서는 잡히지도 않는다.
  if (!gym) {
    return (
      <div style={BOX}>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.7 }}>
          기구 세팅을 적어두려면 <b style={{ color: 'var(--text-primary)' }}>어디인지</b>부터 골라주세요.
          기구가 다르면 시트 번호도 다릅니다.
        </div>
        {gyms.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
            {gyms.map((g) => (
              <button
                key={g.name}
                onClick={() => setGym(g.name)}
                className="btn-secondary"
                style={{ fontSize: 12.5 }}
              >{g.name}</button>
            ))}
          </div>
        )}
        {/* **`.btn-primary` 는 `width: 100%` 다.** flex 줄 안에 그대로 넣으면
            제 몫으로 줄 전체를 달라고 해서 카드를 넘어간다 — 입력 칸은 쪼그라들고
            단추는 오른쪽으로 잘려 나갔다 (캡처에서 잡았다).
            줄 안에서는 `width: auto` 로 되돌리고, 입력 칸에는 `minWidth: 0` 을 준다 */}
        <div style={{ display: 'flex', gap: 7 }}>
          <input
            className="input"
            value={gymInput}
            onChange={(e) => setGymInput(e.target.value)}
            placeholder="예: 강남점 · 집 앞"
            maxLength={GYM_MAX}
            style={{ flexGrow: 1, minWidth: 0 }}
          />
          <button
            className="btn-primary"
            disabled={!gymInput.trim()}
            onClick={() => { setGym(gymInput.trim()); setGymInput(''); }}
            style={{ flexShrink: 0, width: 'auto', padding: '11px 16px', fontSize: 15 }}
          >여기로</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.7 }}>
          이 기기에만 남습니다 — 폰과 PC 가 같은 곳에 있지는 않으니까요
        </div>
      </div>
    );
  }

  const startEdit = (base) => {
    setForm({
      seat: base?.seat || '', foot: base?.foot || '',
      grip: base?.grip || '', note: base?.note || '',
    });
    setEditFor(name);
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await save(toPayload(gym, name, form));
      setEditFor(null);
      toast(res?.removed ? '세팅을 지웠어요' : '세팅을 적어뒀어요');
    } catch (err) {
      toast(err.response?.data?.error || '저장하지 못했어요', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    const yes = await confirmDialog(`${gym}의 ${name} 세팅을 지울까요?`,
      { confirmText: '지웁니다', danger: true });
    if (!yes) return;
    try {
      await remove(gym, name);
      setEditFor(null);
      toast('지웠어요');
    } catch (err) {
      toast(err.response?.data?.error || '지우지 못했어요', 'error');
    }
  };

  // ── 적는 칸 ──
  // **이 운동 것을 펴둔 것일 때만** 적는 칸이다 (위 참고)
  if (editFor === name) {
    return (
      <div style={{ ...BOX, borderColor: 'var(--accent)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
          <span className="label" style={{ marginBottom: 0 }}>{name} 세팅</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{gym}</span>
        </div>

        {SLOTS.map((slot) => (
          <div key={slot.key} style={{ marginBottom: 14 }}>
            <div className="label" style={{ marginBottom: 7 }}>{slot.label}</div>
            <Chips
              options={slot.key === 'grip' ? GRIPS : NUMBERS}
              value={form[slot.key]}
              onPick={(v) => setForm((f) => ({ ...f, [slot.key]: v }))}
              allowFree={slot.key !== 'grip'}
            />
          </div>
        ))}

        <div className="label" style={{ marginBottom: 7 }}>한마디 (안 적어도 됩니다)</div>
        <input
          className="input"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          placeholder="가슴 살짝 열고 팔꿈치로 당긴다"
          maxLength={NOTE_MAX}
          style={{ marginBottom: 14 }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" style={{ flexGrow: 1 }} onClick={submit} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
          {/* 줄바꿈을 막는다 — 좁은 폰에서 「그만 / 두기」로 두 줄이 됐다 (캡처에서 잡았다) */}
          <button
            className="btn-secondary"
            onClick={() => setEditFor(null)}
            disabled={saving}
            style={{ flexShrink: 0, width: 'auto', whiteSpace: 'nowrap', padding: '13px 14px' }}
          >그만두기</button>
        </div>
        {setting && (
          <button
            onClick={onRemove}
            style={{
              width: '100%', marginTop: 9, padding: 9, background: 'none', border: 'none',
              color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >이 세팅 지우기</button>
        )}
      </div>
    );
  }

  // ── 아직 안 적었으면 한 줄 ──
  if (!hasSetting(setting)) {
    return (
      <div style={{ ...BOX, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)' }}>
            이 기구 세팅을 적어둘까요?
          </span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            {/* 처음 오는 곳에서 맨땅부터 적게 하면 대개 안 적는다 */}
            {copyable
              ? `${copyable.gym} 것을 베껴올 수 있어요`
              : '한 번만 적으면 다음부터 저절로 뜹니다'}
          </span>
        </span>
        <span style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
          {copyable && (
            <button
              onClick={() => startEdit(copyable)}
              style={{
                background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)',
                padding: '7px 10px', fontSize: 11.5, borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >베껴오기</button>
          )}
          <button
            onClick={() => startEdit(null)}
            style={{
              background: 'none', border: 'none', color: 'var(--accent)',
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '7px 2px',
            }}
          >적기 ›</button>
        </span>
      </div>
    );
  }

  // ── 적어뒀으면 크게 ──
  const slots = filledSlots(setting);
  return (
    <div style={{ ...BOX, borderColor: 'var(--accent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <span className="label" style={{ marginBottom: 0 }}>내 세팅</span>
        <button
          onClick={() => startEdit(setting)}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >고치기</button>
      </div>

      {slots.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: setting.note ? 12 : 0 }}>
          {slots.map((f) => (
            <div key={f.key} style={{
              flex: 1, textAlign: 'center', background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '11px 4px',
            }}>
              {/* **숫자만 Bebas 로 쓴다.** Bebas Neue 에는 한글이 없어서
                  「넓게」를 그 글꼴로 쓰면 대체 글꼴로 떨어지면서 자간이 어긋난다
                  (캡처에서 글자가 겹쳐 보였다). 우리말은 본문 글꼴로 둔다 */}
              <div style={{
                fontFamily: /^[\d.]+$/.test(f.value) ? "'Bebas Neue', sans-serif" : 'inherit',
                letterSpacing: /^[\d.]+$/.test(f.value) ? 1 : 0,
                fontWeight: /^[\d.]+$/.test(f.value) ? 400 : 600,
                color: 'var(--accent)',
                fontSize: /^[\d.]+$/.test(f.value) ? 27 : 17,
                lineHeight: 1.25,
              }}>{f.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{f.label}</div>
            </div>
          ))}
        </div>
      )}

      {setting.note && (
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          「{setting.note}」
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          border: `1px solid ${isKnownGym(gyms, gym) ? 'var(--success)' : 'var(--border-hover)'}`,
          color: isKnownGym(gyms, gym) ? 'var(--success)' : 'var(--text-muted)',
          borderRadius: 'var(--radius)', padding: '1px 7px',
        }}>{gym}</span>
        에서 쓰던 세팅입니다
        <button
          onClick={() => setGym('')}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >다른 곳</button>
      </div>
    </div>
  );
}
