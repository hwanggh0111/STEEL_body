import { useState, useEffect, useRef } from 'react';
import client from '../api/client';
import { toast } from './Toast';

const pulseKeyframes = `
@keyframes aiPulse {
  0% { box-shadow: 0 0 8px var(--accent), 0 0 20px transparent; }
  50% { box-shadow: 0 0 16px var(--accent), 0 0 40px var(--accent); }
  100% { box-shadow: 0 0 8px var(--accent), 0 0 20px transparent; }
}
@keyframes dotBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
`;

const LOG_STYLES = {
  block:      { icon: '\uD83D\uDEAB', color: 'var(--danger)', bg: 'var(--danger-dim)', label: 'BLOCK' },
  warning:    { icon: '\u26A0\uFE0F', color: 'var(--warning)', bg: 'var(--warning-dim)', label: 'WARNING' },
  suspicious: { icon: '\uD83D\uDD0D', color: 'var(--info)', bg: 'var(--info-dim)', label: 'SUSPECT' },
  system:     { icon: '\u2699\uFE0F', color: 'var(--text-muted)', bg: 'var(--bg-tertiary)', label: 'SYSTEM' },
};

export default function AiAdminPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [blockIp, setBlockIp] = useState('');
  const [blockMin, setBlockMin] = useState('');
  const [tab, setTab] = useState('overview');
  const styleRef = useRef(null);

  useEffect(() => {
    if (!styleRef.current) {
      const s = document.createElement('style');
      s.textContent = pulseKeyframes;
      document.head.appendChild(s);
      styleRef.current = s;
    }
    return () => { if (styleRef.current) { styleRef.current.remove(); styleRef.current = null; } };
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, []);

  const load = async () => {
    try {
      const { data: d } = await client.get('/security/ai-dashboard');
      setData(d);
      setError(false);
    } catch { setError(true); } finally { setLoading(false); }
  };

  const handleUnblock = async (ip) => {
    try {
      await client.post(`/security/ai-unblock/${ip}`);
      toast('IP 차단 해제: ' + ip);
      load();
    } catch { toast('해제 실패', 'error'); }
  };

  const handleBlock = async (e) => {
    e.preventDefault();
    if (!blockIp.trim() || !blockMin) return;
    try {
      await client.post('/security/ai-block', { ip: blockIp.trim(), minutes: Number(blockMin) });
      toast(blockIp + ' 차단 완료 (' + blockMin + '분)');
      setBlockIp(''); setBlockMin('');
      load();
    } catch (err) { toast(err.response?.data?.error || '차단 실패', 'error'); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>AI Guard 로딩 중...</div>;
  if (error || !data) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--danger)' }}>AI 대시보드 로드 실패</div>;

  const { stats = {}, threats = {}, blockedIps = [], logs = [], blacklist = [], suspensions = [] } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* AI Status */}
      <div className="card" style={{ padding: 24, textAlign: 'center', animation: 'aiPulse 3s ease-in-out infinite', border: '1px solid var(--accent)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse at center, var(--accent) 0%, transparent 70%)', opacity: 0.04, pointerEvents: 'none' }} />
        <div style={{ fontSize: 48, marginBottom: 6, filter: 'drop-shadow(0 0 12px var(--accent))' }}>🤖</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 4, color: 'var(--accent)', textShadow: '0 0 12px var(--accent)' }}>AI GUARD v2 ACTIVE</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontSize: 11, marginTop: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', animation: 'dotBlink 1.5s infinite' }} />
          REAL-TIME MONITORING
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap', marginTop: 16 }}>
          {[
            { label: '총 요청', value: stats.totalRequests || 0, color: 'var(--accent)' },
            { label: '차단', value: stats.totalBlocks || 0, color: 'var(--danger)' },
            { label: '경고', value: stats.totalWarnings || 0, color: 'var(--warning)' },
            { label: 'IP 잠금', value: stats.activeLocks || 0, color: 'var(--info)' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: s.color, textShadow: `0 0 8px ${s.color}` }}>
                {(s.value || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Threat Level Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'L1 경고', value: threats.level1 || 0, color: 'var(--warning)' },
          { label: 'L2 잠금', value: threats.level2 || 0, color: 'var(--accent)' },
          { label: 'L3 정지', value: threats.level3 || 0, color: 'var(--danger)' },
          // 「L4 삭제」라고 적혀 있었다. L4 는 지우는 것이 아니라 영구 정지다
          { label: 'L4 영구정지', value: threats.level4 || 0, color: 'var(--danger)' },
        ].map(t => (
          <div key={t.label} className="card" style={{ padding: 12, textAlign: 'center', borderColor: t.value > 0 ? t.color : 'var(--border)' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: t.value > 0 ? t.color : 'var(--text-muted)' }}>{t.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[
          { key: 'overview', label: '종합' },
          { key: 'ips', label: 'IP 관리 (' + blockedIps.length + ')' },
          { key: 'logs', label: '활동 로그 (' + logs.length + ')' },
          { key: 'blacklist', label: '블랙리스트 (' + (blacklist.length || 0) + ')' },
          { key: 'suspensions', label: '정지 이력 (' + (suspensions.length || 0) + ')' },
        ].map(t => (
          <button key={t.key} className={`btn-secondary${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)} style={{ fontSize: 11, padding: '6px 12px' }}>{t.label}</button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: '차단 IP', value: threats.blockedIpCount || 0, color: 'var(--danger)' },
              { label: '의심 IP', value: threats.suspiciousIpCount || 0, color: 'var(--info)' },
              { label: '활성 정지', value: threats.activeSuspensions || 0, color: 'var(--danger)' },
              { label: '영구 차단', value: threats.bannedUsers || 0, color: 'var(--danger)' },
              { label: '블랙리스트', value: threats.blacklistEntries || 0, color: 'var(--warning)' },
              { label: '차단 유저', value: threats.blockedUsers || 0, color: 'var(--accent)' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: s.value > 0 ? s.color : 'var(--text-muted)' }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* AI 기능 설명 */}
          {/* 무엇을 자동으로 하는가.
              예전 목록은 **「즉시 계정 삭제 (LEVEL 4)」 · 「영구 삭제」**라고 적혀 있었다.
              8/21 과 8/24 에 자동 판정에서 계정 삭제를 떼어냈는데(되돌릴 방법이 없어서),
              이 목록만 그대로였다 — **AI 가 안 하는 일을 한다고 적어둔 채** 관리자가
              이걸 보고 판단하고 있었다. 지금 실제로 하는 것으로 고쳤다 */}
          <div className="card" style={{ padding: 16, border: '1px solid var(--accent)' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 2, color: 'var(--accent)', marginBottom: 4 }}>
              자동으로 하는 것
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
              <b style={{ color: 'var(--text-secondary)' }}>계정과 기록을 지우는 일은 자동으로 하지 않습니다.</b>
              {' '}막는 것까지가 자동이고, 없애는 것은 「보안 관리」에서 사람이 확인하고 합니다.
            </div>
            {[
              '비정상 대량 요청 → IP 자동 잠금 (15/30/50회)',
              '로그인 브루트포스 → 3/5/10회 차단 (1시간 / 24시간 / 7일)',
              'XSS · SQL/NoSQL 인젝션 → 영구 정지 + 로그인 차단 (LEVEL 4, 기록은 남김)',
              '프로토타입 오염 → 영구 정지 + 로그인 차단 (LEVEL 4)',
              'API 스캔 공격 (404 반복) → 3일 잠금',
              '스팸 데이터 생성 (10건/분) → 7일 정지',
              '봇 · 크롤러 User-Agent → 3일 잠금',
              '정지 2회 누적 → 영구 정지 (자동 에스컬레이션)',
              '블랙리스트: 이메일 · IP · IP 대역 · User-Agent',
              'URL 인코딩 우회 시도 자동 감지',
              '관리자 계정은 자동 처벌 대상에서 뺀다 (자기 정지를 자기가 못 푼다)',
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IP Management */}
      {tab === 'ips' && (
        <div className="card" style={{ padding: 16 }}>
          {blockedIps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>차단된 IP 없음</div>
          ) : (
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['IP', 'Level', '남은 시간', ''].map(h => (
                      <th key={h || 'a'} style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {blockedIps.map(item => (
                    <tr key={item.ip} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 8, color: 'var(--danger)', fontFamily: "'Courier New', monospace", fontWeight: 600 }}>{item.ip}</td>
                      <td style={{ padding: 8 }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 2, background: item.level === 4 ? 'var(--danger-dim)' : item.level === 3 ? 'var(--danger-dim)' : 'var(--warning-dim)', color: item.level >= 3 ? 'var(--danger)' : 'var(--warning)' }}>
                          L{item.level}
                        </span>
                      </td>
                      <td style={{ padding: 8, color: 'var(--warning)' }}>{item.remaining === 'permanent' ? '영구' : item.remaining + '분'}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>
                        <button onClick={() => handleUnblock(item.ip)} style={{ background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '3px 10px', borderRadius: 2, fontSize: 11, cursor: 'pointer' }}>해제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>수동 IP 차단</div>
            <form onSubmit={handleBlock} style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={blockIp} onChange={e => setBlockIp(e.target.value)} placeholder="IP 주소" style={{ flex: 1, fontFamily: "'Courier New', monospace" }} />
              <input className="input" type="number" value={blockMin} onChange={e => setBlockMin(e.target.value)} placeholder="분" min="1" style={{ width: 70 }} />
              <button type="submit" style={{ background: 'var(--danger)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 2, fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 2, cursor: 'pointer' }}>차단</button>
            </form>
          </div>
        </div>
      )}

      {/* Activity Logs */}
      {tab === 'logs' && (
        <div className="card" style={{ padding: 16, maxHeight: 500, overflowY: 'auto' }}>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>활동 로그 없음</div>
          ) : logs.map((log, i) => {
            const s = LOG_STYLES[log.type] || LOG_STYLES.system;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', marginBottom: 3, borderRadius: 4, background: s.bg, borderLeft: `3px solid ${s.color}` }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{s.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: s.color, fontWeight: 700, padding: '1px 5px', border: `1px solid ${s.color}40`, borderRadius: 2 }}>{s.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{log.time ? new Date(log.time).toLocaleString() : '-'}</span>
                    {log.ip && <span style={{ fontSize: 10, color: s.color, fontFamily: "'Courier New', monospace" }}>{log.ip}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-word' }}>{log.message}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Blacklist */}
      {tab === 'blacklist' && (
        <div className="card" style={{ padding: 16 }}>
          {(!blacklist || blacklist.length === 0) ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>블랙리스트 없음</div>
          ) : blacklist.map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 2, background: b.type === 'email' ? 'var(--info-dim)' : b.type === 'ip' ? 'var(--danger-dim)' : 'var(--warning-dim)', color: b.type === 'email' ? 'var(--info)' : b.type === 'ip' ? 'var(--danger)' : 'var(--warning)', marginRight: 8 }}>{b.type}</span>
                <span style={{ fontSize: 12, fontFamily: "'Courier New', monospace", color: 'var(--text-secondary)' }}>{b.value}</span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{b.created_at?.substring(0, 10)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suspensions */}
      {tab === 'suspensions' && (
        <div className="card" style={{ padding: 16 }}>
          {(!suspensions || suspensions.length === 0) ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>정지 이력 없음</div>
          ) : suspensions.map((s, i) => (
            <div key={i} className="card" style={{ padding: 12, marginBottom: 6, borderColor: s.level === 4 ? 'var(--danger)' : s.level === 3 ? 'var(--danger)' : 'var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 2, background: s.level === 4 ? 'var(--danger-dim)' : 'var(--danger-dim)', color: s.level === 4 ? 'var(--danger)' : 'var(--danger)', fontWeight: 700 }}>LEVEL {s.level}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>User #{s.user_id}</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.expires_at === 'permanent' ? '영구' : s.expires_at?.substring(0, 10)}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
