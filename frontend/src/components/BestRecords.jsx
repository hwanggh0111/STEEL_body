import { useMemo, useState } from 'react';
import { bestRecords, sortBest, daysBetween } from '../data/personalRecord';
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

  // **기록 전부를 한 번만 훑는다** (2026-09-19).
  //
  // 접힌 채로도 「몇 종목인지」는 보여준다 — 그것까지 숨기면 펼칠 이유가 안 보인다.
  // 그런데 세는 것도 목록을 만드는 것도 **같은 훑기**(`bestRecords`)다. 예전에는
  // 펼치는 순간 그 훑기를 한 번 더 했다 — 5년치(29만 줄)에서 22ms 짜리 훑기라
  // 펼칠 때 화면이 한 번 걸렸다. 한 번 훑어 놓고 세는 것과 줄 세우는 것에 같이 쓴다.
  const best = useMemo(() => bestRecords(workouts), [workouts]);
  const count = best.size;
  // 줄을 세우는 것(정렬)은 펼칠 때만 한다. 접힌 채로는 차례가 필요 없다
  const list = useMemo(() => (open
    ? sortBest(best).map(e => ({ ...e, days: daysBetween(e.date, today) }))
    : []), [open, best, today]);

  if (count === 0) return null;

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
          {count}종목
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

          {count > SHOWN && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 2 }}>
              최근에 세운 {SHOWN}종목만 보여줍니다. 나머지 {count - SHOWN}종목은 히스토리에 있습니다.
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
