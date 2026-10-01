import { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';
import { toast } from '../Toast';
import { confirmDialog } from '../ConfirmModal';

// 화면 오류.
//
// 화면이 흰 화면이 되면 `ErrorBoundary` 가 서버로 한 줄 보낸다. 받는 쪽도,
// 비우는 쪽도 9월부터 있었다 — **그런데 그것을 여는 화면이 없었다.**
// `routes/clientErrors.js` 머리에는 「관리자 화면에서 본다」고 적혀 있는데
// 앱 어디에서도 `/client-error` 를 부르지 않았다. 그래서 26건이 한 달 동안
// 아무도 모르게 쌓여 있었다 (2026-10-01 에 찾았다).
//
// **같은 말은 묶는다.** 한 번 터진 자리는 그 화면을 여는 사람마다 터지므로,
// 26줄을 훑는 것과 11가지를 보는 것은 다르다. 몇 번 났는지가 곧 「얼마나
// 자주 걸리는 길인지」다.
//
// **사람이 적은 것은 여기 없다.** 터진 말 · 어느 화면 · 언제 · 어떤 브라우저뿐이고,
// 기록도 글도 안 보낸다 (보내는 쪽에서 아예 안 담는다).

// 묶기 — 터진 말이 같으면 한 줄로. 가장 많이 난 것이 위로 온다
function group(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.message || '(빈 메시지)';
    let g = map.get(key);
    if (!g) {
      g = { key, count: 0, paths: [], first: r.at, last: r.at, stack: r.stack, agent: r.agent };
      map.set(key, g);
    }
    g.count += 1;
    if (r.path && !g.paths.includes(r.path)) g.paths.push(r.path);
    // 들어올 때 최신이 위다. 그래도 양쪽을 다 보고 정한다 — 순서를 믿고 쓰면
    // 나중에 서버가 순서를 바꿀 때 조용히 틀린 날짜가 뜬다
    if (r.at && r.at < g.first) g.first = r.at;
    if (r.at && r.at > g.last) g.last = r.at;
    if (!g.stack && r.stack) g.stack = r.stack;
  }
  return [...map.values()].sort((a, b) => b.count - a.count || String(b.last).localeCompare(String(a.last)));
}

const day = (s) => (s ? String(s).slice(5, 10).replace('-', '월 ') + '일' : '');

export default function ErrorAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    client.get('/client-error')
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setError('목록을 불러오지 못했어요'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const clearAll = async () => {
    const ok = await confirmDialog(
      `쌓인 ${rows.length}건을 모두 지웁니다.\n\n고친 것을 확인한 뒤에 비웁니다. 지운 것은 되돌릴 수 없어요.`,
      { title: '다 지울까요', confirmText: '다 지우기' },
    );
    if (!ok) return;
    try {
      await client.delete('/client-error');
      setRows([]);
      setOpen(null);
      toast('지웠어요');
    } catch {
      toast('지우지 못했어요', 'error');
    }
  };

  const groups = group(rows);
  const span = rows.length
    ? `${day(groups.reduce((m, g) => (g.first < m ? g.first : m), groups[0].first))} ~ ${day(groups.reduce((m, g) => (g.last > m ? g.last : m), groups[0].last))}`
    : '';

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        화면 오류
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 14px' }}>
        화면이 흰 화면이 됐을 때 서버로 보내진 한 줄입니다. <strong style={{ color: 'var(--text-primary)' }}>같은 말은 묶어서</strong> 몇 번 났는지로 보여줍니다.
        <br />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          터진 말 · 어느 화면 · 언제만 남습니다. 사람이 적은 기록이나 글은 보내지 않습니다.
          백 건까지만 두고 오래된 것부터 버립니다.
        </span>
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>불러오는 중…</div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>
          <button className="btn-secondary" onClick={load}>다시 시도</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <div className="empty-state-title">없음</div>
          <div className="empty-state-desc">
            터진 화면이 없습니다. 좋은 상태예요.
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{
            padding: '12px 14px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <div>
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 1,
                color: 'var(--accent)', lineHeight: 1,
              }}>{rows.length}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginLeft: 6 }}>
                건 · {groups.length}가지
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{span}</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="btn-secondary" onClick={load}>다시 읽기</button>
              <button className="btn-secondary" onClick={clearAll}>다 지우기</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {groups.map(g => {
              const opened = open === g.key;
              return (
                <div key={g.key} className="card" style={{ padding: '12px 14px' }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpen(opened ? null : g.key)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(opened ? null : g.key); } }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  >
                    <div style={{
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 1,
                      // 여러 번 난 것은 **여러 사람이 걸린 길**이다. 한 번과 다르게 보여야 한다
                      color: g.count >= 3 ? 'var(--danger)' : 'var(--text-secondary)',
                      lineHeight: 1, minWidth: 30, textAlign: 'right', flexShrink: 0,
                    }}>{g.count}</div>

                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{g.key}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {g.paths.join(' · ') || '어느 화면인지 모름'} · {day(g.last)}
                      </div>
                    </div>

                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {opened ? '접기' : '자세히'}
                    </span>
                  </div>

                  {opened && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                        처음 {day(g.first)} · 마지막 {day(g.last)}
                      </div>
                      {/* 스택은 앞 다섯 줄만 온다 — 어디서 터졌는지 알기엔 그것으로 충분하다 */}
                      <pre style={{
                        margin: 0, fontSize: 11, lineHeight: 1.7, color: 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        background: 'var(--bg-primary)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', padding: '8px 10px',
                      }}>{g.stack || '스택이 없습니다'}</pre>
                      {g.agent && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, wordBreak: 'break-all' }}>
                          {g.agent}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
