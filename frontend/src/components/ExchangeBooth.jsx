import { useState, useEffect, useRef } from 'react';
import { useLangStore } from '../store/langStore';
import { usePachinkoStore } from '../store/pachinkoStore';
import { toast } from './Toast';
import { UL_EXP } from './LevelSystem';
import { UL_TICKET } from '../data/pachinkoData';
import { useHoldRepeat } from './useHoldRepeat';

// 교환소 — 일반 티켓을 울트라 티켓으로 바꾼다.
//
// 처음에는 울트라 레전드 파칭코 카드 안에 한 줄로 넣었는데, 지갑이 둘로 갈린 뒤로는
// "지금 뭘 얼마나 갖고 있고 몇 장 바꿀 수 있는지"가 한눈에 보여야 해서 따로 뺐다.
// 교환은 한 방향뿐이다 (울트라 → 일반 은 없다).
//
// 수량 버튼은 담기만 하고, 실제 차감은 확정 버튼에서 한 번에 일어난다.
// 바로 나가면 잘못 눌렀을 때 되돌릴 방법이 없다 — 한 방향 교환이라 더 그렇다.
//
// 예외가 하나 있다: "최대"를 **꾹 누르고 있으면** 담기와 확정이 함께 반복된다.
// 짧게 탭하는 것은 지금까지처럼 담기만 하므로, 실수로 스친 손가락이 지갑을 비우지는 않는다.
// 되돌릴 수 없는 일을 하려면 0.4초를 계속 누르고 있어야 한다는 뜻이다.

const T = {
  ko: {
    title: '교환소',
    base: '일반 티켓',
    ul: '울트라 티켓',
    rate: `🎫 ${UL_TICKET.rate}장`,
    into: `${UL_TICKET.icon} 1장`,
    max: '최대',
    amount: '바꿀 수량',
    spend: '나가는 티켓',
    confirm: '확정',
    clear: '비우기',
    maxHold: '최대를 꾹 누르고 있으면 바로 교환됩니다',
    locked: '잠김',
    lockedWhy: 'LV 150을 다 채우고 초월 단계에 들어가면 열립니다',
    use: '울트라 레전드 파칭코에서 씁니다 — 한 판에 1장',
    done: (n) => `${UL_TICKET.icon} 울트라 티켓 ${n}장으로 바꿨어요`,
    fail: '바꿀 일반 티켓이 모자라요',
    pickFirst: '수량을 먼저 고르세요',
  },
  en: {
    title: 'Exchange',
    base: 'Regular tickets',
    ul: 'Ultra tickets',
    rate: `🎫 ${UL_TICKET.rate}`,
    into: `${UL_TICKET.icon} 1`,
    max: 'MAX',
    amount: 'Amount',
    spend: 'Costs',
    confirm: 'CONFIRM',
    clear: 'CLEAR',
    maxHold: 'Hold MAX to exchange right away',
    locked: 'LOCKED',
    lockedWhy: 'Unlocks once LV 150 is full and Transcend begins',
    use: 'Spent at the Ultra Legend Pachinko — 1 per spin',
    done: (n) => `Got ${n} ${UL_TICKET.icon} ultra ticket(s)`,
    fail: 'Not enough regular tickets',
    pickFirst: 'Pick an amount first',
  },
};

const STEPS = [1, 5, 10];

export default function ExchangeBooth({ available = 0, unlocked = false }) {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;
  const { ulTickets, exchangeUlTickets } = usePachinkoStore();

  // 담아둔 수량. 확정을 눌러야 실제로 차감된다.
  const [pending, setPending] = useState(0);

  // 지금 티켓으로 몇 장까지 바꿀 수 있나. 무한 티켓이면 available 이 큰 수라 자연히 커진다.
  const affordable = Math.floor(available / UL_TICKET.rate);

  // 티켓이 줄면(다른 모드에서 썼거나 상한 소멸) 담아둔 수량이 살 수 없는 값이 된다.
  // 확정에서 실패하게 두지 말고 살 수 있는 데까지 자동으로 내린다.
  useEffect(() => {
    setPending(p => Math.min(p, affordable));
  }, [affordable]);

  // 담기. 더 담을 수 없으면 false 를 돌려준다 — 꾹 누르고 있던 반복이 여기서 멈춘다.
  const add = (n) => {
    if (pending + n > affordable) return false;
    setPending(p => Math.min(p + n, affordable));
    return true;
  };

  // +1 · +5 · +10 은 꾹 누르고 있으면 계속 담긴다.
  // 100장을 담으려고 +10 을 열 번 누르는 게 이 화면에서 제일 잦은 일이었다.
  const holdAdd = useHoldRepeat(add);

  // 확정이 같은 프레임에 두 번 들어오는 것을 막는다 (모바일 더블탭).
  // 두 번째 호출은 첫 번째가 반영되기 전의 available 을 그대로 들고 들어와
  // 검사를 통과해 버린다. 받는 울트라 티켓 수는 제값이라 손익은 없지만,
  // used 가 earned 를 넘어 "아직 못 번 티켓을 미리 쓴" 상태가 된다.
  //
  // 성공했을 때만 잠근다. 실패는 스토어를 안 건드려 리렌더가 없으므로
  // 여기서 잠그면 아래 effect 가 안 돌아 버튼이 영영 잠긴다.
  const busyRef = useRef(false);
  useEffect(() => { busyRef.current = false; });   // 리렌더될 때마다 해제

  const confirm = () => {
    if (!unlocked || busyRef.current) return;
    if (pending < 1) { toast(t.pickFirst, 'error'); return; }
    const got = exchangeUlTickets(pending, available);
    if (got > 0) {
      busyRef.current = true;
      toast(t.done(got));
      setPending(0);
    } else {
      toast(t.fail, 'error');
    }
  };

  const cost = pending * UL_TICKET.rate;

  // 최대 버튼이 살아 있는 조건 — 바꿀 티켓이 하나라도 있으면 된다.
  // 담아둔 수량은 보지 않는다 (위 버튼의 주석 참고).
  const maxOk = unlocked && affordable >= 1;

  // 최대 — 탭이면 담기만, 꾹 누르고 있으면 바꿀 수 있는 만큼 실제로 교환하기를 반복한다.
  // 지갑이 비면 affordable 이 0 이 되어 false 로 멈춘다.
  const holdMax = useHoldRepeat((_, isRepeat) => {
    if (!maxOk) return false;
    if (!isRepeat) { setPending(affordable); return true; }
    // 확정 버튼과 같은 연타 방어를 공유한다. 아직 반영 전이면 이번 tick 만 거른다
    // (여기서 멈춰 버리면 손은 누르고 있는데 아무 일도 안 일어난 채로 끝난다).
    if (busyRef.current) return true;
    const got = exchangeUlTickets(affordable, available);
    if (got < 1) return false;
    busyRef.current = true;
    setPending(0);
    toast(t.done(got));
    return true;
  });

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16, opacity: unlocked ? 1 : 0.72 }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 'var(--radius)',
          background: `${UL_EXP.color}18`, border: `1px solid ${UL_EXP.color}66`,
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 11,
          letterSpacing: 1.5, color: UL_EXP.color,
        }}>
          {UL_TICKET.icon} {t.title}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {unlocked ? t.use : `🔒 ${t.lockedWhy}`}
        </div>
      </div>

      {/* 두 지갑 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          flex: 1, textAlign: 'center', padding: '8px 6px',
          borderRadius: 'var(--radius)',
          background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>{t.base}</div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, lineHeight: 1.3,
            color: 'var(--accent)',
          }}>
            🎫 {available.toLocaleString()}
          </div>
        </div>

        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 16,
          color: 'var(--text-muted)', flexShrink: 0,
        }}>
          →
        </div>

        <div style={{
          flex: 1, textAlign: 'center', padding: '8px 6px',
          borderRadius: 'var(--radius)',
          background: `${UL_EXP.color}0e`, border: `1px solid ${UL_EXP.color}44`,
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>{t.ul}</div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, lineHeight: 1.3,
            color: UL_EXP.color,
          }}>
            {UL_TICKET.icon} {ulTickets.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 교환비 */}
      <div style={{
        textAlign: 'center', marginBottom: 10,
        fontSize: 12, color: 'var(--text-secondary)',
      }}>
        {t.rate} <span style={{ color: 'var(--text-muted)' }}>→</span>{' '}
        <span style={{ color: UL_EXP.color }}>{t.into}</span>
      </div>

      {/* 담아둔 수량과 나갈 티켓 — 확정 전에 얼마가 나가는지 먼저 보여준다 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, flexWrap: 'wrap',
        marginBottom: 8, padding: '8px 12px',
        borderRadius: 'var(--radius)',
        background: pending > 0 ? `${UL_EXP.color}0e` : 'var(--bg-tertiary)',
        border: `1px solid ${pending > 0 ? `${UL_EXP.color}55` : 'var(--border)'}`,
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>
          {t.amount}
        </span>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, lineHeight: 1,
          color: pending > 0 ? UL_EXP.color : 'var(--text-muted)',
        }}>
          {UL_TICKET.icon} {pending.toLocaleString()}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {t.spend}{' '}
          <span style={{ color: pending > 0 ? 'var(--danger)' : 'inherit' }}>
            🎫 {cost.toLocaleString()}
          </span>
        </span>
      </div>

      {/* 수량 버튼 — 담기만 하고 차감하지 않는다.
          +N 은 더 담을 수 없으면 눌리지 않는다 (눌린 뒤 실패하면 왜인지 알 수가 없다).
          최대는 예외로 항상 눌린다 — 아래 참고. */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {STEPS.map(n => {
          const ok = unlocked && pending + n <= affordable;
          return (
            <button
              key={n}
              {...holdAdd(n)}
              disabled={!ok}
              style={{
                flex: 1,
                touchAction: 'manipulation', userSelect: 'none',
                background: 'var(--bg-tertiary)',
                border: `1px solid ${ok ? `${UL_EXP.color}66` : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                color: ok ? UL_EXP.color : 'var(--text-muted)',
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1,
                padding: '8px 0',
                cursor: ok ? 'pointer' : 'not-allowed',
              }}
            >
              +{n}
            </button>
          );
        })}
        {/* 최대 — 탭하면 담기, 꾹 누르면 교환이 반복된다 (holdMax 참고).
            바꿀 티켓이 하나라도 있으면 언제나 눌린다. 예전에는 담아둔 수량이 꽉 차면
            (pending >= affordable) 같이 잠갔는데, 확정하고 다시 최대를 누르는 흐름에서
            버튼이 회색으로 죽어 보여 "왜 안 눌리지"가 됐다. */}
        <button
          {...holdMax(null)}
          disabled={!maxOk}
          style={{
            flex: 1.2,
            background: 'var(--bg-tertiary)',
            border: `1px solid ${maxOk ? `${UL_EXP.color}66` : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            color: maxOk ? UL_EXP.color : 'var(--text-muted)',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1,
            padding: '8px 0',
            touchAction: 'manipulation', userSelect: 'none',
            cursor: maxOk ? 'pointer' : 'not-allowed',
          }}
        >
          {t.max}
        </button>
        <button
          onClick={() => setPending(0)}
          disabled={pending < 1}
          style={{
            flex: 1.2,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: pending > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1,
            padding: '8px 0',
            cursor: pending > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          {t.clear}
        </button>
      </div>

      {/* 꾹 누르기는 화면에 안 보이는 동작이라 한 줄로 알려준다 */}
      {maxOk && (
        <div style={{
          fontSize: 10, color: 'var(--text-muted)',
          textAlign: 'right', marginBottom: 8,
        }}>
          {t.maxHold}
        </div>
      )}

      {/* 확정 — 여기서만 실제로 티켓이 나간다 (최대를 꾹 누르는 경우는 위 holdMax) */}
      <button
        className="btn-primary"
        onClick={confirm}
        disabled={!unlocked || pending < 1}
        style={{ width: '100%' }}
      >
        {t.confirm}
        {pending > 0 && ` · 🎫 ${cost.toLocaleString()} → ${UL_TICKET.icon} ${pending.toLocaleString()}`}
      </button>
    </div>
  );
}
