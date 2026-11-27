import { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';
import { toast } from '../Toast';

// 서버 오류.
//
// 500 을 만든 자리는 `index.js` 의 마지막 오류 손인데, 거기서 **운영에서는 아무것도
// 안 적었다** — 라이브에서 난 500 은 아무 데도 남지 않았다(`utils/errorLog.js` 머리글).
// 11/26 에 적는 길을 냈고, 꺼내는 길도 그때 함께 났다(`GET /api/security/errors`).
//
// **그런데 그것을 여는 화면이 없었다.** 지금까지 꺼내 보는 길이 둘뿐이었다 —
// `npm run errors`(고치는 쪽이 제 컴퓨터에서 돈다) · 주소를 손으로 치는 것.
// 10/01 의 「화면 오류」와 **같은 꼴**이다: 보내는 쪽도 받는 쪽도 있는데 여는 화면만
// 없어서 26건이 한 달 동안 아무도 모르게 쌓였다. 같은 일을 또 두지 않는다.
//
// ── 화면 오류와 무엇이 다른가 ──
//
// 저쪽은 **사람 브라우저가 흰 화면이 된 것**이고, 이쪽은 **서버가 거절한 것**이다.
// 사람에게는 「서버에 문제가 생겼어요」 한 줄만 가고 그 뒤는 안 보인다.
//
// ── 비우는 단추가 없다 ──
//
// 서버 오류는 보안 기록과 **같은 표**에 `server_error` 갈래로 쌓인다. 비우려면 보안
// 기록까지 함께 날아간다 — 로그인 실패 · 차단 기록이 그 안에 있다. 그래서 여기는
// **읽는 자리**로만 둔다. 상한(보안 기록과 같다)에 닿으면 오래된 것부터 저절로 빠진다.
//
// ── 무엇이 안 담겨 있나 ──
//
// 본문 · 쿼리 · 쿠키 · 헤더는 **적지 않는다**(`errorLog.js` 의 선). 로그인 본문에는
// 비번이, 메모 본문에는 사람이 적은 글이 들어 있다. 그래서 여기에 사람 글은 없다.

/** 서버가 묶어 보낸 한 줄을 눈으로 읽을 조각으로 가른다.
 *
 * 묶인 글은 `errorLog.js` 가 ` · ` 로 이어 붙인 것이다 —
 * `GET /api/workouts/812 · TypeError: x is not a function · src/db.js:120 | src/a.js:9`.
 * 앞은 **어느 길**, 가운데가 **터진 말**, 끝이 **우리 코드 줄**이다. 다만 길이 없는
 * 것(`rejection` · `job`)도 있어서 **꼴로 가른다** — 자리로 세면 그때 한 칸씩 밀린다.
 */
function parts(what) {
  const chunks = String(what || '').split(' · ');
  const 길 = /^[A-Z]+ \//.test(chunks[0]) ? chunks.shift() : '';
  // 코드 줄은 `파일:줄` 이 ` | ` 로 이어진 꼴이다. 없을 수도 있다(남의 꾸러미에서 터짐)
  const 자리 = chunks.length > 1 && /:\d+/.test(chunks[chunks.length - 1]) ? chunks.pop() : '';
  return { 길, 말: chunks.join(' · ') || '(까닭이 안 적혔다)', 자리 };
}

const 날 = (s) => (s ? String(s).slice(5, 10).replace('-', '월 ') + '일' : '');
const 때 = (s) => (s ? String(s).slice(5, 16).replace('-', '월 ').replace('T', '일 ') : '');

// ── 「전부 복사」 ── (화면 오류의 그것과 같은 까닭)
//
// 여기 쌓인 것을 **고치는 자리는 이 화면이 아니다.** 터진 말과 코드 줄을 들고 코드로
// 가야 한다. 묶은 그대로 한 덩이 글로 만들면 붙여넣은 것이 곧 할 일 목록이 된다 —
// 많이 난 것이 위에 오고, 고칠 차례가 그 차례다.
function asText(groups, total) {
  const lines = [`서버 오류 ${total}건 · ${groups.length}가지`, ''];
  groups.forEach((g, i) => {
    const p = parts(g.what);
    lines.push(`${i + 1}. [${g.count}번] ${p.말}`);
    if (p.길) lines.push(`   길: ${p.길}`);
    if (p.자리) lines.push(`   자리: ${p.자리}`);
    lines.push(`   때: ${때(g.first)} ~ ${때(g.last)}`);
    lines.push('');
  });
  return lines.join('\n');
}

export default function ServerErrorAdmin() {
  const [data, setData] = useState({ total: 0, groups: [], recent: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  // 최근 줄을 펼치는 자리 — 묶은 것만 보면 **언제 몰려 났는지**가 안 보인다
  const [raw, setRaw] = useState(false);
  // 클립보드가 막힌 기기에서 글을 펼쳐 두는 자리 (앱 웹뷰 · http 로 연 화면)
  const [dump, setDump] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    client.get('/security/errors')
      .then(({ data: d }) => setData({
        total: Number(d?.total) || 0,
        groups: Array.isArray(d?.groups) ? d.groups : [],
        recent: Array.isArray(d?.recent) ? d.recent : [],
      }))
      .catch(() => setError('목록을 불러오지 못했어요'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const copyAll = async () => {
    const text = asText(data.groups, data.total);
    try {
      await navigator.clipboard.writeText(text);
      toast(`${data.total}건을 복사했어요`);
    } catch {
      setDump(text);
      toast('복사가 막혀서 아래에 펼쳤어요 — 길게 눌러 고르세요');
    }
  };

  const span = data.groups.length
    ? `${날(data.groups.reduce((m, g) => (g.first < m ? g.first : m), data.groups[0].first))}`
      + ` ~ ${날(data.groups.reduce((m, g) => (g.last > m ? g.last : m), data.groups[0].last))}`
    : '';

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        서버 오류
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 14px' }}>
        서버가 거절한 것(500)입니다. 사람에게는 <strong style={{ color: 'var(--text-primary)' }}>「서버에 문제가 생겼어요」</strong> 한 줄만 가고, 그 뒤가 여기 남습니다.
        <br />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          어느 길 · 터진 말 · 우리 코드 세 줄만 남습니다. 본문·쿠키·헤더는 적지 않습니다.
          비우는 단추는 없습니다 — 보안 기록과 같은 표라 함께 날아갑니다.
        </span>
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>불러오는 중…</div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>
          <button className="btn-secondary" onClick={load}>다시 시도</button>
        </div>
      ) : data.total === 0 ? (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <div className="empty-state-title">없음</div>
          <div className="empty-state-desc">
            서버가 거절한 것이 없습니다. 좋은 상태예요.
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
                fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif", fontSize: 24, letterSpacing: 1,
                color: 'var(--accent)', lineHeight: 1,
              }}>{data.total}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 6 }}>
                건 · {data.groups.length}가지
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{span}</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="btn-secondary" onClick={copyAll}>전부 복사</button>
              <button className="btn-secondary" onClick={load}>다시 읽기</button>
            </div>
          </div>

          {dump && (
            <textarea
              aria-label="서버 오류 묶음 글 (읽기만)"
              readOnly
              value={dump}
              onFocus={(e) => e.target.select()}
              style={{
                width: '100%', minHeight: 180, marginBottom: 12, padding: 10,
                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, lineHeight: 1.6,
              }}
            />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.groups.map((g, i) => {
              const p = parts(g.what);
              const opened = open === i;
              return (
                <div key={g.what || i} className="card" style={{ padding: '12px 14px' }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpen(opened ? null : i)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(opened ? null : i); } }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  >
                    <div style={{
                      fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif", fontSize: 24, letterSpacing: 1,
                      // 여러 번 난 것은 **여러 사람이 걸린 길**이다. 한 번과 다르게 보여야 한다
                      color: g.count >= 3 ? 'var(--danger)' : 'var(--text-secondary)',
                      lineHeight: 1, minWidth: 30, textAlign: 'right', flexShrink: 0,
                    }}>{g.count}</div>

                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{p.말}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {p.길 || '길 없음 (손 밖에서 터졌다)'} · {날(g.last)}
                      </div>
                    </div>

                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {opened ? '접기' : '자세히'}
                    </span>
                  </div>

                  {opened && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                        처음 {때(g.first)} · 마지막 {때(g.last)}
                      </div>
                      {/* 우리 코드 세 줄 — 그것이 곧 고칠 자리다 */}
                      <pre style={{
                        margin: 0, fontSize: 11, lineHeight: 1.7, color: 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        background: 'var(--bg-primary)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', padding: '8px 10px',
                      }}>{p.자리 ? p.자리.split(' | ').join('\n') : '코드 줄이 없습니다 (남의 꾸러미에서 터졌다)'}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── 최근 줄 그대로 ──
              묶은 것만 보면 **언제 몰려 났는지**가 안 보인다. 배포 직후에 쏟아진
              것인지, 하루에 한 번씩 꾸준한 것인지는 고칠 급함이 다르다 */}
          {data.recent.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <button
                className="btn-secondary"
                onClick={() => setRaw(!raw)}
                style={{ fontSize: 12 }}
              >
                {raw ? '최근 줄 접기' : `최근 줄 그대로 보기 (${data.recent.length})`}
              </button>
              {raw && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {data.recent.map((r, i) => (
                    <div key={`${r.timestamp}-${i}`} style={{
                      fontSize: 11, lineHeight: 1.7, color: 'var(--text-secondary)',
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      background: 'var(--bg-primary)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', padding: '6px 8px',
                      wordBreak: 'break-word',
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>{때(r.timestamp)}</span>
                      {' '}{r.detail}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
