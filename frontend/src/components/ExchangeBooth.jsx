import { useState, useEffect, useRef } from 'react';
import { useLangStore } from '../store/langStore';
import { usePachinkoStore } from '../store/pachinkoStore';
import { toast } from './Toast';
import { UL_EXP } from './LevelSystem';
import { UL_TICKET } from '../data/pachinkoData';

// 교환소 — 일반 티켓을 울트라 티켓으로 바꾼다.
//
// 처음에는 울트라 레전드 파칭코 카드 안에 한 줄로 넣었는데, 지갑이 둘로 갈린 뒤로는
// "지금 뭘 얼마나 갖고 있고 몇 장 바꿀 수 있는지"가 한눈에 보여야 해서 따로 뺐다.
// 교환은 한 방향뿐이다 (울트라 → 일반 은 없다).
//
// 수량 버튼은 담기만 하고, 실제 차감은 확정 버튼에서 한 번에 일어난다.
// 바로 나가면 잘못 눌렀을 때 되돌릴 방법이 없다 — 한 방향 교환이라 더 그렇다.

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

  const add = (n) => setPending(p => Math.min(p + n, affordable));

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
          더 담을 수 없는 버튼은 눌리지 않는다 (눌린 뒤 실패하면 왜인지 알 수가 없다). */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {STEPS.map(n => {
          const ok = unlocked && pending + n <= affordable;
          return (
            <button
              key={n}
              onClick={() => add(n)}
              disabled={!ok}
              style={{
                flex: 1,
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
        <button
          onClick={() => setPending(affordable)}
          disabled={!unlocked || affordable < 1 || pending >= affordable}
          style={{
            flex: 1.2,
            background: 'var(--bg-tertiary)',
            border: `1px solid ${unlocked && pending < affordable ? `${UL_EXP.color}66` : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            color: unlocked && pending < affordable ? UL_EXP.color : 'var(--text-muted)',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1,
            padding: '8px 0',
            cursor: unlocked && pending < affordable ? 'pointer' : 'not-allowed',
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

      {/* 확정 — 여기서만 실제로 티켓이 나간다 */}
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
