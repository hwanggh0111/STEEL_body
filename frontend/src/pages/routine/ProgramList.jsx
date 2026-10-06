import { useState, useEffect } from 'react';
import client from '../../api/client';

// 기성 프로그램 — **여러 날이 한 벌로 묶인 것** (2026-10-05).
//
// 추천 루틴은 「오늘 가슴에 뭘 하나」를 답한다. 이 화면은 **「일주일을 어떻게 짜나」**를
// 답한다. 처음 온 사람이 막히는 자리는 거기였다 — 빈 루틴에서 시작하게 두면
// 뭘 넣을지 아는 사람만 쓸 수 있다.
//
// 고르면 **그 날들이 그대로 「내 루틴」이 된다.** 3분할이면 내 루틴 셋이 한 번에
// 생기고, 그 뒤로는 평소처럼 고쳐 쓴다. 프로그램이 붙잡아두지 않는다 —
// 앱 어디에도 「너는 지금 PPL 2주차다」 같은 것을 남기지 않는다.

export default function ProgramList({ onAdopt, adopting }) {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  // 펼친 프로그램 하나. 다섯 개를 다 펼쳐두면 스크롤이 끝없이 길어진다
  const [openKey, setOpenKey] = useState(null);

  useEffect(() => {
    let alive = true;
    client.get('/routines/programs')
      .then(({ data }) => { if (alive) setPrograms(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setPrograms([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>불러오는 중…</div>;
  }
  if (!programs.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">·</div>
        <div className="empty-state-desc">프로그램을 못 불러왔어요. 신호를 확인하고 다시 들어와 주세요.</div>
      </div>
    );
  }

  return (
    <>
      <div className="section-title">
        <div className="accent-bar" />
        프로그램
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 14 }}>
        <b style={{ color: 'var(--text-secondary)' }}>일주일을 통째로 짜 둔 것</b>이에요.
        고르면 그 날들이 <b style={{ color: 'var(--text-secondary)' }}>내 루틴</b>으로 한 번에 들어갑니다 —
        그 다음부터는 평소처럼 고쳐 쓰시면 돼요. 앱이 붙잡아두지 않아요.
      </p>

      {programs.map((p) => {
        const open = openKey === p.key;
        const total = p.days.reduce((n, d) => n + d.exercises.length, 0);
        return (
          <div key={p.key} className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
            {/* 머리 — 누르면 펴진다 */}
            <button
              onClick={() => setOpenKey(open ? null : p.key)}
              aria-expanded={open}
              style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left', padding: '14px 16px', color: 'inherit', fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="display-sm" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                <span className="badge badge-accent">{p.level}</span>
                <span aria-hidden style={{
                  marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 11,
                  transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s',
                }}>▼</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, letterSpacing: 0.3 }}>
                주 {p.days_per_week}회 · {p.days.length}일 한 바퀴 · 종목 {total}개 · {p.weeks}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.6 }}>
                {p.who}
              </div>
            </button>

            {open && (
              <div style={{ padding: '0 16px 14px' }}>
                <hr className="rule-beam" style={{ margin: '2px 0 12px' }} />
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 14 }}>
                  {p.note}
                </p>

                {p.days.map((d) => (
                  <div key={d.name} style={{ marginBottom: 12 }}>
                    <div style={{
                      fontSize: 12, letterSpacing: 1, color: 'var(--accent)',
                      fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", marginBottom: 6,
                    }}>{d.name}</div>
                    {d.exercises.map((e) => (
                      <div key={e.name} style={{
                        display: 'flex', gap: 8, alignItems: 'baseline',
                        padding: '5px 0', borderBottom: '1px solid var(--border)',
                      }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', flexGrow: 1, minWidth: 0 }}>{e.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {e.sets} · {e.reps}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}

                <button
                  className="btn-primary"
                  disabled={!!adopting}
                  onClick={() => onAdopt(p)}
                  style={{ marginTop: 6 }}
                >
                  {adopting === p.key ? '넣는 중…' : `내 루틴에 ${p.days.length}개 넣기`}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
