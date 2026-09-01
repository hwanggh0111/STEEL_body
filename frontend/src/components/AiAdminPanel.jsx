import { useState, useEffect, useRef, useCallback } from 'react';
import client from '../api/client';
import NavIcon from './NavIcon';
import { toast } from './Toast';

// 관리자 화면의 「AI 관리자」 — **자동 판정이 어떻게 돌고 있는가**를 보는 자리.
//
// 9/1 에 다시 만들었다. 그 전 화면의 문제는 셋이었다.
//
//  1. **규칙을 손으로 적어두고 있었고, 그 숫자가 틀렸다.** 「대량 요청 15/30/50회」라고
//     적혀 있었지만 실제는 200/300/500 이었고, 「로그인 3/5/10회」는 7/10/20 이었다.
//     「스팸 10건/분」은 60 이고, 이미 없앤 SQL·몽고 인젝션도 그대로 적혀 있었다.
//     **틀린 방어 규칙을 보고 판단하는 것이, 규칙을 모르는 것보다 나쁘다.**
//     이제 서버가 실제 상수에서 만들어 준다(`policy`).
//  2. **숫자가 무엇을 센 것인지 안 적혀 있었다.** 들어온 요청 · 막은 요청 · 경고는 전부
//     램이라 서버가 다시 뜨면 0 부터 다시 센다. 「요청 12건」이 하루치인지 방금 뜬 뒤
//     1분치인지 알 수가 없었다. 이제 **언제부터 센 것인지**를 같이 적는다.
//  3. **차단 IP 목록이 「해킹 보안」과 겹쳤다.** 같은 것을 두 화면이 각자 그리면 어느
//     쪽이 맞는지 사람이 판단해야 한다. 지금 막혀 있는 것과 푸는 일은 「해킹 보안」이
//     맡고, 여기서는 **몇 건인지만** 보여주고 그쪽으로 보낸다.
//
// 그리고 **10초마다 쉬지 않고 서버를 부르던 것**을 고쳤다 — 탭을 안 보고 있어도
// 계속 불렀다(하루 8,640번). 이제 보고 있을 때만 부르고, 앞의 요청이 아직
// 안 왔으면 건너뛴다.

const PULL_MS = 15 * 1000;

const LOG_STYLES = {
  // 이모지가 아니라 직접 그린 아이콘의 이름이다 (`components/NavIcon.jsx`).
  // 이모지 그림은 폰 만든 회사 것이라 남의 것이고, 폰마다 다르게 나온다
  block:      { icon: 'ban', color: 'var(--danger)', label: '막음' },
  warning:    { icon: 'siren', color: 'var(--warning)', label: '경고' },
  suspicious: { icon: 'search', color: 'var(--info)', label: '의심' },
  system:     { icon: 'gear', color: 'var(--text-muted)', label: '시스템' },
};

const timeOf = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
};

// 「2시간 12분째」처럼 읽히게. 「7,932초」는 아무도 못 읽는다
const sinceText = (iso) => {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return '';
  const min = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (min < 60) return `${min}분째`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 ${min % 60}분째`;
  return `${Math.floor(h / 24)}일 ${h % 24}시간째`;
};

// 접었다 펴는 자리. 이력은 늘 볼 것이 아니라서 접어둔다
function Fold({ title, count, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ padding: 0, marginBottom: 8 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{title}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{count}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{open ? '접기' : '펴기'}</span>
      </div>
      {open && <div style={{ padding: '0 14px 14px' }}>{children}</div>}
    </div>
  );
}

export default function AiAdminPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [readAt, setReadAt] = useState(null);
  const [blockIp, setBlockIp] = useState('');
  const [blockMin, setBlockMin] = useState('');
  const [busy, setBusy] = useState(false);
  // 앞의 요청이 아직 안 왔으면 새로 보내지 않는다 — 느린 망에서 요청만 쌓인다
  const inflight = useRef(false);

  const load = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const { data: d } = await client.get('/security/ai-dashboard');
      setData(d);
      setFailed(false);
      setReadAt(new Date());
    } catch {
      setFailed(true);
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, []);

  // **보고 있을 때만 부른다.**
  //
  // 예전에는 10초마다 무조건 불렀다 — 관리자가 탭을 열어두고 딴 일을 하면
  // 하루에 8,640번이다. 서버가 싸다고 해도 폰이면 배터리와 데이터고,
  // 아무도 안 보는 화면을 그리려고 쓰는 것이다.
  useEffect(() => {
    let timer = null;
    const start = () => {
      if (timer) return;
      load();
      timer = setInterval(load, PULL_MS);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVisible = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisible);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  const handleBlock = async (e) => {
    e.preventDefault();
    const ip = blockIp.trim();
    const min = Number(blockMin);
    if (!ip || !(min > 0)) {
      toast('주소와 분을 적어주세요', 'error');
      return;
    }
    setBusy(true);
    try {
      const { data: r } = await client.post('/security/ai-block', { ip, minutes: min });
      toast(r?.message || '막았어요');
      setBlockIp('');
      setBlockMin('');
      await load();
    } catch (err) {
      toast(err?.response?.data?.error || '못 막았어요', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        불러오는 중…
      </div>
    );
  }

  if (failed && !data) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        AI 관리자 정보를 불러오지 못했습니다.
        <br />없어진 게 아니라 못 가져온 것입니다.
        <button className="btn-secondary" style={{ marginTop: 14 }} onClick={load}>다시 읽기</button>
      </div>
    );
  }

  const stats = data?.stats || {};
  const threats = data?.threats || {};
  const shield = data?.shield || { blocks: 0, loginLocks: 0 };
  const policy = Array.isArray(data?.policy) ? data.policy : [];
  const logs = Array.isArray(data?.logs) ? data.logs : [];
  const blacklist = Array.isArray(data?.blacklist) ? data.blacklist : [];
  const suspensions = Array.isArray(data?.suspensions) ? data.suspensions : [];

  const Num = ({ label, value, color }) => (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 1.5, lineHeight: 1,
        color: value > 0 ? (color || 'var(--accent)') : 'var(--text-muted)',
      }}>{Number(value || 0).toLocaleString()}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5 }}>{label}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2,
          color: 'var(--accent)', margin: 0,
        }}>AI 관리자</h2>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {readAt ? `${readAt.toLocaleTimeString()} 에 읽음` : ''}
          {failed ? ' · 새로 읽기 실패' : ''}
        </span>
        <button
          onClick={load}
          style={{
            marginLeft: 'auto', background: 'none', border: '1px solid var(--border)',
            color: 'var(--text-muted)', padding: '5px 12px', fontSize: 11.5,
            borderRadius: 'var(--radius)', cursor: 'pointer',
          }}
        >새로 읽기</button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 18 }}>
        사람이 안 보고 있을 때는 안 읽습니다. 보고 있는 동안 {PULL_MS / 1000}초마다 새로 읽습니다.
      </div>

      {/* ── 지금 막혀 있는 것 (파일 · 재시작해도 남는다) ── */}
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>지금 막혀 있는 것</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 8 }}>
        <b style={{ color: 'var(--text-secondary)' }}>서버가 다시 떠도 그대로 남습니다.</b>{' '}
        자세히 보고 풀어주는 것은 「해킹 보안」에서 합니다 — 같은 것을 두 화면이 따로 그리면 어느 쪽이 맞는지 헷갈립니다.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 18 }}>
        <Num label="막아둔 주소" value={shield.blocks} color="var(--danger)" />
        <Num label="잠긴 로그인" value={shield.loginLocks} color="var(--warning)" />
        <Num label="정지 중인 사람" value={threats.activeSuspensions} color="var(--danger)" />
        <Num label="영구 정지" value={threats.bannedUsers} color="var(--danger)" />
      </div>

      {/* ── 서버가 뜬 뒤로 센 것 (램 · 재시작하면 0) ── */}
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>서버가 뜬 뒤로</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 8 }}>
        {data?.since
          ? <>{timeOf(data.since)} 부터 <b style={{ color: 'var(--text-secondary)' }}>{sinceText(data.since)}</b> 센 것입니다. </>
          : null}
        <b style={{ color: 'var(--text-secondary)' }}>서버가 다시 뜨면 0 부터 다시 셉니다</b> — 여기가 작다고 아무 일도 없었다는 뜻은 아닙니다.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
        <Num label="들어온 요청" value={stats.totalRequests} />
        <Num label="되돌려 보낸 요청" value={stats.totalBlocks} color="var(--danger)" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 18 }}>
        {[
          { label: '경고', value: threats.level1, color: 'var(--warning)' },
          { label: '잠금', value: threats.level2, color: 'var(--accent)' },
          { label: '정지', value: threats.level3, color: 'var(--danger)' },
          // 「L4 삭제」라고 적혀 있던 자리다. L4 는 지우는 것이 아니라 영구 정지다
          { label: '영구정지', value: threats.level4, color: 'var(--danger)' },
        ].map((t) => (
          <div key={t.label} className="card" style={{ padding: 10, textAlign: 'center' }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 20,
              color: t.value > 0 ? t.color : 'var(--text-muted)',
            }}>{t.value || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* ── 자동으로 하는 규칙 (서버가 실제 값으로 준다) ── */}
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>자동으로 하는 규칙</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 8 }}>
        서버가 <b style={{ color: 'var(--text-secondary)' }}>지금 쓰는 값을 그대로</b> 보내줍니다.
        화면에 손으로 적어두면 코드가 바뀔 때 여기만 옛 숫자로 남습니다 — 실제로 그랬습니다.
      </div>
      {policy.length === 0 ? (
        <div className="card" style={{ padding: 14, fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18 }}>
          규칙을 못 받아왔습니다.
        </div>
      ) : (
        <div className="card" style={{ padding: '4px 14px', marginBottom: 18 }}>
          {policy.map((r, i) => (
            <div key={r.title} style={{
              padding: '10px 0',
              borderBottom: i === policy.length - 1 ? 'none' : '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 3 }}>{r.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                {/* 서버가 **굵게** 로 보내는 자리를 그대로 굵게 그린다 */}
                {String(r.detail || '').split('**').map((part, j) => (
                  j % 2
                    ? <b key={j} style={{ color: 'var(--text-secondary)' }}>{part}</b>
                    : <span key={j}>{part}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 손으로 막기 ── */}
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>손으로 막기</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 8 }}>
        막은 것은 「해킹 보안」 목록에 뜨고, 거기서 풀 수 있습니다.
        <b style={{ color: 'var(--text-secondary)' }}> 대역(/24)은 통째로 막지 않습니다</b> — 통신사 NAT 뒤에서는 수만 명이 같은 주소로 나옵니다.
      </div>
      <form onSubmit={handleBlock} className="card" style={{ padding: 14, display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          className="input"
          value={blockIp}
          onChange={(e) => setBlockIp(e.target.value)}
          placeholder="주소 (예: 203.0.113.7)"
          style={{ flex: '1 1 160px', minWidth: 0 }}
        />
        <input
          className="input"
          type="number"
          value={blockMin}
          onChange={(e) => setBlockMin(e.target.value)}
          placeholder="분"
          min="1"
          style={{ width: 90 }}
        />
        <button className="btn-secondary" style={{ width: 'auto' }} type="submit" disabled={busy}>
          {busy ? '막는 중…' : '막기'}
        </button>
      </form>

      {/* ── 최근에 한 판정 ── */}
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>최근에 한 판정</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 8 }}>
        이것도 램에 쌓입니다 — <b style={{ color: 'var(--text-secondary)' }}>서버가 다시 뜨면 비워집니다.</b>
      </div>
      {logs.length === 0 ? (
        <div className="card" style={{ padding: 14, fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18 }}>
          아직 판정한 것이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18, maxHeight: 420, overflowY: 'auto' }}>
          {logs.slice(0, 50).map((log, i) => {
            const kind = LOG_STYLES[log.type] || LOG_STYLES.system;
            return (
              <div key={`${log.time}-${i}`} className="card" style={{ padding: '10px 12px', borderLeft: `3px solid ${kind.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: kind.color, display: 'flex' }} aria-hidden="true">
                    <NavIcon name={kind.icon} size={14} />
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 'var(--radius)',
                    color: kind.color, border: `1px solid ${kind.color}`,
                  }}>{kind.label}</span>
                  {log.ip && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{log.ip}</span>}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{timeOf(log.time)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5, wordBreak: 'break-word', lineHeight: 1.6 }}>
                  {log.message}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 이력 (늘 볼 것은 아니라 접어둔다) ── */}
      <Fold title="정지 이력" count={`${suspensions.length}건`}>
        {suspensions.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>정지된 적이 없습니다.</div>
        ) : suspensions.map((s) => (
          <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-secondary)' }}>사람 {s.user_id}</span>
              <span style={{ color: 'var(--text-muted)' }}>레벨 {s.level}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 11 }}>
                {s.expires_at === 'permanent' ? '영구' : `${String(s.expires_at).slice(0, 10)} 까지`}
              </span>
            </div>
            {s.reason && <div style={{ color: 'var(--text-muted)', fontSize: 11.5, marginTop: 3 }}>{s.reason}</div>}
          </div>
        ))}
      </Fold>

      <Fold title="블랙리스트" count={`${blacklist.length}건`}>
        {blacklist.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>올려둔 것이 없습니다.</div>
        ) : blacklist.map((b) => (
          <div key={b.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)' }}>{b.type}</span>
              <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{b.value}</span>
            </div>
            {b.reason && <div style={{ color: 'var(--text-muted)', fontSize: 11.5, marginTop: 3 }}>{b.reason}</div>}
          </div>
        ))}
      </Fold>
    </div>
  );
}
