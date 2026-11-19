import { useEffect, useState } from 'react';
import { useLockStore } from '../store/lockStore';
// ⑤ 지문·얼굴로 풀기 (2026-11-19 · 시안 1119 ⑤). 네 자리를 **대신하지 않고 얹힌다**
import { 쓸수있나 as bioReady, 켜졌나 as bioOn, 켠다 as bioStart, 끈다 as bioStop } from '../data/lockBio';
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
  letterSpacing: 8, textAlign: 'center', fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif",
  fontSize: 20, padding: '10px 12px',
};

export default function LockSetup({ onClose }) {
  const enabled = useLockStore((s) => s.enabled);
  const setLock = useLockStore((s) => s.set);
  const removeLock = useLockStore((s) => s.remove);
  const lockNow = useLockStore((s) => s.lock);

  const [now, setNow] = useState('');      // 지금 걸려 있는 것 (바꾸거나 풀 때)
  const [pin, setPin] = useState('');
  // ⑤ 이 기기가 지문을 읽을 수 있나 · 지금 켜져 있나.
  // **못 읽으면 줄을 아예 안 그린다** — 눌러도 아무 일이 안 나는 줄을 두지 않는다
  const [bioCan, setBioCan] = useState(false);
  const [bioIsOn, setBioIsOn] = useState(bioOn());
  const [bioBusy, setBioBusy] = useState(false);
  useEffect(() => {
    let 살아있다 = true;
    bioReady().then((yes) => { if (살아있다) setBioCan(yes); });
    return () => { 살아있다 = false; };
  }, []);
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);

  const digits = (v) => v.replace(/\D/g, '').slice(0, PIN_LEN);

  if (!canLock()) {
    // **못 거는 자리에서 거는 척하지 않는다.** `crypto.subtle` 은 https 에서만 있고,
    // **사이트 데이터를 막아둔 브라우저는 네 자리를 담아주지 않는다**
    // (2026-10-31에 보탰다 — 담기지 않으면 「걸었습니다」가 거짓말이 된다)
    return (
      <div style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        이 브라우저에서는 잠금을 걸 수 없어요.
        <br />https 주소(또는 앱)에서 열고, <b>사이트 데이터 저장</b>이 막혀 있지 않은지 봐주세요.
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

      {/* ── ⑤ 지문·얼굴로 풀기 ── (2026-11-19 · 시안 1119 ⑤)
          **네 자리를 걸어둔 사람에게만** 보인다 — 지문은 네 자리를 **대신하지 않고
          빠른 길로 얹힌다**(기기가 못 읽으면 네 자리가 남는 길이다). 그래서 잠금이
          없는 사람에게 이 줄을 먼저 보이면 **잠금을 안 걸고 지문만 켠 셈**이 된다.
          ★ **무게는 네 자리와 똑같다** — 서버에 아무것도 안 보내고 서버가 아무것도
          확인하지 않는다(`data/lockBio.js` 머리글). 그 말을 여기에도 적는다 */}
      {enabled && bioCan && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13 }}>지문 · 얼굴로 풀기</span>
            <button
              className={bioIsOn ? 'btn-secondary active' : 'btn-secondary'}
              disabled={bioBusy}
              onClick={async () => {
                setBioBusy(true);
                if (bioIsOn) { bioStop(); setBioIsOn(false); toast('지문으로 풀기를 껐어요'); }
                else {
                  // **그 자리에서 한 번 물어본다** — 켜고 나서 처음 풀 때 안 되는 것을
                  // 그때 알면 늦다. 거절하면 **거짓으로 켜두지 않는다**
                  const ok = await bioStart();
                  setBioIsOn(ok);
                  toast(ok ? '이제 지문으로도 풀 수 있어요' : '지문을 못 읽었어요 — 네 자리는 그대로예요',
                    ok ? undefined : 'error');
                }
                setBioBusy(false);
              }}
              style={{ marginLeft: 'auto', width: 'auto', fontSize: 12.5, padding: '8px 14px' }}
              aria-pressed={bioIsOn}
            >{bioIsOn ? '켜짐' : '켜기'}</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.75, marginTop: 7 }}>
            네 자리는 <b style={{ color: 'var(--text-secondary)' }}>그대로 남습니다</b> — 지문이 안 될 때 쓰는 길이에요.
            지문은 이 기기 안에만 있고 <b style={{ color: 'var(--text-secondary)' }}>서버로 보내지 않습니다</b>.
          </div>
        </div>
      )}

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
