import { useMemo, useState } from 'react';
import { bestList, daysBetween } from '../data/personalRecord';
import { dateKey } from '../data/dateKey';

// 종목별 최고 기록.
//
// 기록 화면 아래에 접힌 채로 붙는다. 펼치면 종목마다 자기 최고가 언제였는지 보인다.
// **오래 멈춘 종목에 표를 붙인다** — 목록의 쓸모는 「무엇을 세웠나」보다
// 「무엇이 멈춰 있나」에 있다.

const STALE_DAYS = 60;
const SHOWN = 8;

const fmt = (e) => (e.kind === 'bodyweight' ? `${e.reps}회` : `${e.kg}kg × ${e.reps}회`);

function ago(days) {
  if (days === null) return '';
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  return `${months}개월 전`;
}

export default function BestRecords({ workouts }) {
  const [open, setOpen] = useState(false);
  const today = dateKey();

  const list = useMemo(() => bestList(workouts).map(e => ({
    ...e,
    days: daysBetween(e.date, today),
  })), [workouts, today]);

  if (list.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          paddingBottom: 10, borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="accent-bar" />
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2,
          color: 'var(--text-primary)',
        }}>종목별 최고 기록</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {list.length}종목
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{open ? '접기' : '펼치기'}</span>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {list.slice(0, SHOWN).map(e => (
            <div key={`${e.exercise}-${e.kind}`} className="card list-item" style={{
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{e.exercise}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {e.date.slice(5).replace('-', '/')} · {fmt(e)}
                </div>
              </div>
              {e.days !== null && e.days >= STALE_DAYS ? (
                <span className="badge badge-warning" style={{ flexShrink: 0 }}>{ago(e.days)}</span>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{ago(e.days)}</span>
              )}
            </div>
          ))}

          {list.length > SHOWN && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 2 }}>
              최근에 세운 {SHOWN}종목만 보여줍니다. 나머지 {list.length - SHOWN}종목은 히스토리에 있습니다.
            </div>
          )}

          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 4 }}>
            무게가 있는 종목은 1RM 으로 환산해 견줍니다 — 70kg 12회가 80kg 5회보다 셀 수 있어서입니다.
            맨몸 운동은 횟수로 셉니다.
          </div>
        </div>
      )}
    </div>
  );
}
