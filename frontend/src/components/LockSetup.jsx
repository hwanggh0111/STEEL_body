import { useState } from 'react';
import { useLockStore } from '../store/lockStore';
import { canLock, isPin, PIN_LEN, GRACE_MS, matches } from '../data/appLock';
import { toast } from './Toast';
import { confirmDialog } from './ConfirmModal';

// 앱 잠금 설정 — 걸기 · 바꾸기 · 풀기.
//
// **내 계정 시트 안에 둔다.** 기기와 계정에 관한 일이 모여 있는 자리이고,
// 이 앱에서 화면을 새로 만들 이유가 없는 크기다 (칸 두 개와 단추 하나).
//
// ── 화면이 지키는 것 ──
//
// · **무엇을 못 하는지 먼저 적는다.** 이건 잠깐 빌려준 폰에서 가리는 잠금이지
//   폰을 가져간 사람을 막는 잠금이 아니다. 그걸 안 적으면 사람은 더 믿고 빌려준다
// · **바꾸거나 풀 때는 지금 것을 먼저 맞춘다.** 열려 있는 폰을 잠깐 든 사람이
//   설정에서 바로 풀 수 있으면 잠금이 아니다
// · **두 번 치게 한다.** 한 번만 치고 잘못 기억하면 다음에 못 연다 —
//   그때 남는 길은 로그아웃뿐이다

const box = {
  letterSpacing: 8, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 20, padding: '10px 12px',
};

export default function LockSetup({ onClose }) {
  const enabled = useLockStore((s) => s.enabled);
  const setLock = useLockStore((s) => s.set);
  const removeLock = useLockStore((s) => s.remove);
  const lockNow = useLockStore((s) => s.lock);

  const [now, setNow] = useState('');      // 지금 걸려 있는 것 (바꾸거나 풀 때)
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);

  const digits = (v) => v.replace(/\D/g, '').slice(0, PIN_LEN);

  if (!canLock()) {
    // **못 거는 자리에서 거는 척하지 않는다.** `crypto.subtle` 은 https 에서만 있다
    return (
      <div style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        이 브라우저(또는 http 주소)에서는 잠금을 걸 수 없어요.
        <br />앱이나 https 주소에서 열면 됩니다.
      </div>
    );
  }

  const save = async () => {
    if (busy) return;
    if (enabled && !(await matches(now))) { toast('지금 쓰는 네 자리가 아니에요', 'error'); return; }
    if (!isPin(pin)) { toast(`${PIN_LEN}자리 숫자로 정해주세요`, 'error'); return; }
    if (pin !== again) { toast('두 번 친 것이 서로 달라요', 'error'); return; }
    setBusy(true);
    try {
      await setLock(pin);
      toast(enabled ? '네 자리를 바꿨어요' : '잠금을 걸었어요');
      onClose?.();
    } catch (err) {
      toast(err.message || '걸지 못했어요', 'error');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (busy) return;
    if (!(await matches(now))) { toast('지금 쓰는 네 자리가 아니에요', 'error'); return; }
    const yes = await confirmDialog('잠금을 풀까요? 이 기기에서는 앱이 바로 열립니다.',
      { title: '잠금 풀기', confirmText: '풉니다', danger: true });
    if (!yes) return;
    removeLock();
    toast('잠금을 풀었어요');
    onClose?.();
  };

  return (
    <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.75 }}>
        앱을 열 때와 {Math.round(GRACE_MS / 1000)}초 넘게 다른 앱을 보다 돌아올 때 네 자리를 묻습니다.
        <br />
        <span style={{ color: 'var(--text-secondary)' }}>잠깐 빌려준 폰에서 가리는 잠금</span>이지,
        폰을 가져간 사람을 막는 잠금은 아닙니다. 네 자리는 이 기기에만 담깁니다.
      </div>

      {enabled && (
        <input
          className="input"
          inputMode="numeric"
          value={now}
          onChange={(e) => setNow(digits(e.target.value))}
          placeholder="지금 네 자리"
          aria-label="지금 네 자리"
          style={box}
        />
      )}

      <input
        className="input"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(digits(e.target.value))}
        placeholder={enabled ? '새 네 자리' : '네 자리'}
        aria-label={enabled ? '새 네 자리' : '네 자리'}
        style={box}
      />
      <input
        className="input"
        inputMode="numeric"
        value={again}
        onChange={(e) => setAgain(digits(e.target.value))}
        placeholder="한 번 더"
        aria-label="한 번 더"
        style={box}
      />

      <div style={{ display: 'flex', gap: 7 }}>
        <button className="btn-primary" onClick={save} disabled={busy} style={{ flexGrow: 1, fontSize: 13, padding: '10px 0' }}>
          {enabled ? '바꾸기' : '잠금 걸기'}
        </button>
        {enabled && (
          <button className="btn-secondary" onClick={remove} disabled={busy}
            style={{ width: 'auto', fontSize: 12.5, padding: '10px 14px' }}>풀기</button>
        )}
      </div>

      {/* **지금 잠그기.** 돌아왔을 때 잠그는 것만으로는 정작 그 순간을 못 막는다 —
          「사진 좀 보여줘」는 앱이 열려 있는 채로 폰을 건네는 일이다 */}
      {enabled && (
        <button
          onClick={() => { lockNow(); onClose?.(); }}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '6px 0',
          }}
        >지금 잠그기</button>
      )}
    </div>
  );
}
