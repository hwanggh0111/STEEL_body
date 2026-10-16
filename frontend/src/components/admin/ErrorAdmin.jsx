import { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';
import { toast } from '../Toast';
import { confirmDialog } from '../ConfirmModal';
import { markSeen } from '../useNewClientErrors';

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

// ── 「전부 복사」 ── (2026-10-16)
//
// 여기 쌓인 것을 **고치는 자리는 이 화면이 아니다.** 터진 말과 터진 자리를 들고
// 코드로 가야 하는데, 여태 길이 하나뿐이었다 — **폰이나 PC 화면에서 눈으로 읽어
// 손으로 옮겨 적기.** 스택은 접혀 있고 길다. 스물여섯 건을 그렇게 옮기는 사람은 없다.
//
// 그래서 **묶은 그대로 한 덩이 글**로 만든다. 붙여넣으면 그게 곧 할 일 목록이다.
// 많이 난 것이 위에 온다 — 고칠 차례가 그 차례다.
//
// **사람이 적은 것은 여기에도 없다** (받는 쪽에서 아예 안 담는다).
function asText(groups, rows) {
  const lines = [`화면 오류 ${rows.length}건 · ${groups.length}가지`, ''];
  groups.forEach((g, i) => {
    lines.push(`${i + 1}. [${g.count}번] ${g.key}`);
    lines.push(`   화면: ${g.paths.join(' · ') || '모름'}`);
    lines.push(`   때: ${day(g.first)} ~ ${day(g.last)}`);
    if (g.agent) lines.push(`   브라우저: ${g.agent}`);
    if (g.stack) {
      // 스택은 **앞 여섯 줄**이면 터진 자리를 찾는 데 넉넉하다. 통째로 넣으면
      // 붙여넣은 글이 수백 줄이 되어 오히려 안 읽힌다
      String(g.stack).split('\n').slice(0, 6).forEach((l) => lines.push(`   ${l.trim()}`));
    }
    lines.push('');
  });
  return lines.join('\n');
}

export default function ErrorAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  // 클립보드가 막힌 기기에서 글을 펼쳐 두는 자리
  const [dump, setDump] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    client.get('/client-error')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        setRows(list);
        // **본 것은 「새」에서 뺀다.** 관리자 머리의 숫자가 이걸 보고 줄어든다 —
        // 안 빼면 그 숫자가 영영 안 줄어들고, 안 줄어드는 숫자는 아무 말도 안 한다.
        // 최신이 위라 첫 줄이 가장 나중 것이다
        if (list.length) markSeen(list[0].at);
      })
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
      // 비웠으면 「새」도 없다. 다음에 쌓이는 것부터 다시 센다
      markSeen(new Date().toISOString());
      setOpen(null);
      toast('지웠어요');
    } catch {
      toast('지우지 못했어요', 'error');
    }
  };

  const groups = group(rows);

  /**
   * 묶은 것을 한 덩이 글로 복사한다 (2026-10-16).
   *
   * **클립보드가 막히는 자리가 있다** — 앱 웹뷰 · http 로 연 화면 · 권한을 거절한
   * 브라우저. 그때 아무 일도 안 일어나면 사람은 복사된 줄 알고 붙여넣는다.
   * 그래서 막히면 **글을 화면에 펼쳐** 길게 눌러 고르게 한다.
   */
  const copyAll = async () => {
    const text = asText(groups, rows);
    try {
      await navigator.clipboard.writeText(text);
      toast(`${rows.length}건을 복사했어요`);
    } catch {
      setDump(text);
      toast('복사가 막혀서 아래에 펼쳤어요 — 길게 눌러 고르세요');
    }
  };
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
                fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 24, letterSpacing: 1,
                color: 'var(--accent)', lineHeight: 1,
              }}>{rows.length}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginLeft: 6 }}>
                건 · {groups.length}가지
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{span}</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="btn-secondary" onClick={copyAll}>전부 복사</button>
              <button className="btn-secondary" onClick={load}>다시 읽기</button>
              <button className="btn-secondary" onClick={clearAll}>다 지우기</button>
            </div>
          </div>

          {dump && (
            <textarea
              readOnly
              value={dump}
              onFocus={(e) => e.target.select()}
              style={{
                width: '100%', minHeight: 180, marginBottom: 12, padding: 10,
                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, lineHeight: 1.6,
              }}
            />
          )}

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
                      fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 24, letterSpacing: 1,
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
