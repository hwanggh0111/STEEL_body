import { useState, useEffect, useRef } from 'react';
import { useLangStore } from '../store/langStore';
import client from '../api/client';

const T = {
  ko: {
    title: 'AI AUTO-ADMIN PANEL',
    statusActive: 'AI GUARD ACTIVE',
    totalRequests: '총 처리 요청',
    totalBlocks: '총 차단',
    totalWarnings: '총 경고',
    threatOverview: 'REAL-TIME THREAT STATUS',
    blockedIps: '차단된 IP',
    todayWarnings: '오늘 경고',
    suspiciousIps: '의심 IP',
    blockedIpList: 'BLOCKED IP LIST',
    ip: 'IP',
    blockedAt: '차단 시간',
    remaining: '남은 시간',
    unblock: '해제',
    manualBlock: '수동 IP 차단',
    ipPlaceholder: 'IP 주소 입력',
    minutesPlaceholder: '분',
    blockBtn: '차단',
    activityLog: 'AI ACTIVITY LOG',
    time: '시간',
    type: '타입',
    message: '메시지',
    logIp: 'IP',
    noLogs: '활동 로그가 없습니다.',
    noBlocked: '차단된 IP가 없습니다.',
    aboutTitle: 'AI ADMIN OVERVIEW',
    aboutDesc: '이 AI는 관리자 부재 시 자동으로 서버를 감시합니다.',
    feature1: '비정상적인 대량 요청 감지 및 차단',
    feature2: '로그인 브루트포스 공격 감지',
    feature3: '경로 스캔 공격 감지',
    feature4: '차단 IP 자동 만료 관리',
    loading: '로딩 중...',
    error: '데이터를 불러올 수 없습니다.',
    min: '분',
  },
  en: {
    title: 'AI AUTO-ADMIN PANEL',
    statusActive: 'AI GUARD ACTIVE',
    totalRequests: 'Total Requests',
    totalBlocks: 'Total Blocks',
    totalWarnings: 'Total Warnings',
    threatOverview: 'REAL-TIME THREAT STATUS',
    blockedIps: 'Blocked IPs',
    todayWarnings: 'Warnings Today',
    suspiciousIps: 'Suspicious IPs',
    blockedIpList: 'BLOCKED IP LIST',
    ip: 'IP',
    blockedAt: 'Blocked At',
    remaining: 'Remaining',
    unblock: 'Unblock',
    manualBlock: 'Manual IP Block',
    ipPlaceholder: 'Enter IP address',
    minutesPlaceholder: 'Minutes',
    blockBtn: 'Block',
    activityLog: 'AI ACTIVITY LOG',
    time: 'Time',
    type: 'Type',
    message: 'Message',
    logIp: 'IP',
    noLogs: 'No activity logs.',
    noBlocked: 'No blocked IPs.',
    aboutTitle: 'AI ADMIN OVERVIEW',
    aboutDesc: 'This AI automatically monitors the server when the admin is absent.',
    feature1: 'Detect and block abnormal mass requests',
    feature2: 'Detect login brute-force attacks',
    feature3: 'Detect path scanning attacks',
    feature4: 'Auto-expire blocked IPs',
    loading: 'Loading...',
    error: 'Failed to load data.',
    min: 'min',
  },
};

const LOG_TYPE_STYLES = {
  warning:    { icon: '\u26A0\uFE0F', color: '#ffab00', bg: '#ffab0015', label: 'WARNING' },
  block:      { icon: '\uD83D\uDEAB', color: '#ff1744', bg: '#ff174415', label: 'BLOCK' },
  unblock:    { icon: '\u2705', color: '#00c853', bg: '#00c85315', label: 'UNBLOCK' },
  suspicious: { icon: '\uD83D\uDD0D', color: '#448aff', bg: '#448aff15', label: 'SUSPICIOUS' },
  system:     { icon: '\u2699\uFE0F', color: '#888888', bg: '#88888815', label: 'SYSTEM' },
};

function getLogTypeStyle(type) {
  return LOG_TYPE_STYLES[type] || LOG_TYPE_STYLES.system;
}

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

export default function AiAdminPanel() {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [blockIp, setBlockIp] = useState('');
  const [blockMinutes, setBlockMinutes] = useState('');
  const styleRef = useRef(null);

  useEffect(() => {
    if (!styleRef.current) {
      const style = document.createElement('style');
      style.textContent = pulseKeyframes;
      document.head.appendChild(style);
      styleRef.current = style;
    }
    return () => {
      if (styleRef.current) {
        styleRef.current.remove();
        styleRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const res = await client.get('/security/ai-dashboard');
      setData(res.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (ip) => {
    try {
      await client.post(`/security/ai-unblock/${ip}`);
      loadData();
    } catch {
      // silent
    }
  };

  const handleManualBlock = async (e) => {
    e.preventDefault();
    if (!blockIp.trim() || !blockMinutes) return;
    try {
      await client.post('/security/ai-block', { ip: blockIp.trim(), minutes: Number(blockMinutes) });
      setBlockIp('');
      setBlockMinutes('');
      loadData();
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontFamily: 'Barlow, sans-serif' }}>
        {t.loading}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--danger)', fontFamily: 'Barlow, sans-serif' }}>
        {t.error}
      </div>
    );
  }

  const { stats = {}, blockedIps = [], logs = [], threats = {} } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* AI Status Card */}
      <div
        className="card"
        style={{
          padding: 28,
          textAlign: 'center',
          animation: 'aiPulse 3s ease-in-out infinite',
          border: '1px solid var(--accent)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at center, var(--accent) 0%, transparent 70%)',
          opacity: 0.05, pointerEvents: 'none',
        }} />
        <div style={{ fontSize: 56, marginBottom: 8, filter: 'drop-shadow(0 0 12px var(--accent))' }}>
          {'\uD83E\uDD16'}
        </div>
        <div style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: 28,
          letterSpacing: 4,
          color: 'var(--accent)',
          textShadow: '0 0 12px var(--accent)',
          marginBottom: 4,
        }}>
          {t.statusActive}
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16,
          color: 'var(--success)', fontSize: 12, fontFamily: 'Barlow, sans-serif',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', animation: 'dotBlink 1.5s infinite' }} />
          ONLINE
        </div>
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap',
        }}>
          {[
            { label: t.totalRequests, value: stats.totalRequests ?? 0 },
            { label: t.totalBlocks, value: stats.totalBlocks ?? 0 },
            { label: t.totalWarnings, value: stats.totalWarnings ?? 0 },
          ].map((item) => (
            <div key={item.label} style={{ minWidth: 100 }}>
              <div style={{
                fontFamily: 'Bebas Neue, sans-serif', fontSize: 30,
                color: 'var(--accent)', textShadow: '0 0 8px var(--accent)',
              }}>
                {item.value.toLocaleString()}
              </div>
              <div style={{
                fontFamily: 'Barlow, sans-serif', fontSize: 11,
                color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase',
              }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time Threat Overview */}
      <div>
        <div style={{
          fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, letterSpacing: 2,
          color: 'var(--accent)', marginBottom: 10,
        }}>
          {t.threatOverview}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: t.blockedIps, value: threats.blockedIpCount ?? 0, color: '#ff1744', bg: '#ff174418' },
            { label: t.todayWarnings, value: threats.todayWarnings ?? 0, color: '#ffab00', bg: '#ffab0018' },
            { label: t.suspiciousIps, value: threats.suspiciousIpCount ?? 0, color: '#448aff', bg: '#448aff18' },
          ].map((item) => (
            <div
              key={item.label}
              className="card"
              style={{
                padding: '16px 12px',
                textAlign: 'center',
                border: `1px solid ${item.color}40`,
                background: item.bg,
              }}
            >
              <div style={{
                fontFamily: 'Bebas Neue, sans-serif', fontSize: 32,
                color: item.color, textShadow: `0 0 10px ${item.color}60`,
              }}>
                {item.value}
              </div>
              <div style={{
                fontFamily: 'Barlow, sans-serif', fontSize: 11,
                color: item.color, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85,
              }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Blocked IP List */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{
          fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, letterSpacing: 2,
          color: 'var(--accent)', marginBottom: 14,
        }}>
          {t.blockedIpList}
        </div>
        {blockedIps.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '20px 0',
            color: 'var(--text-muted)', fontFamily: 'Barlow, sans-serif', fontSize: 13,
          }}>
            {t.noBlocked}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Barlow, sans-serif', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[t.ip, t.blockedAt, t.remaining, ''].map((h) => (
                    <th
                      key={h || 'action'}
                      style={{
                        padding: '8px 10px', textAlign: 'left',
                        color: 'var(--text-muted)', fontWeight: 600,
                        fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {blockedIps.map((item) => (
                  <tr key={item.ip} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px', color: '#ff1744', fontFamily: "'Courier New', monospace", fontWeight: 600 }}>
                      {item.ip}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-muted)' }}>
                      {item.blockedAt ? new Date(item.blockedAt).toLocaleString() : '-'}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--warning)' }}>
                      {item.remaining ?? '-'} {t.min}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleUnblock(item.ip)}
                        style={{
                          background: 'transparent', border: '1px solid var(--danger)',
                          color: 'var(--danger)', padding: '4px 12px', borderRadius: 4,
                          fontFamily: 'Barlow, sans-serif', fontSize: 12, cursor: 'pointer',
                          letterSpacing: 1, transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { e.target.style.background = 'var(--danger)'; e.target.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--danger)'; }}
                      >
                        {t.unblock}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Manual Block Form */}
        <div style={{
          marginTop: 16, paddingTop: 16,
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{
            fontFamily: 'Barlow, sans-serif', fontSize: 12,
            color: 'var(--text-muted)', marginBottom: 8,
            letterSpacing: 1, textTransform: 'uppercase',
          }}>
            {t.manualBlock}
          </div>
          <form onSubmit={handleManualBlock} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={blockIp}
              onChange={(e) => setBlockIp(e.target.value)}
              placeholder={t.ipPlaceholder}
              style={{
                flex: '1 1 160px', padding: '8px 12px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'inherit',
                fontFamily: "'Courier New', monospace", fontSize: 13,
                outline: 'none',
              }}
            />
            <input
              type="number"
              value={blockMinutes}
              onChange={(e) => setBlockMinutes(e.target.value)}
              placeholder={t.minutesPlaceholder}
              min="1"
              style={{
                width: 80, padding: '8px 12px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'inherit',
                fontFamily: 'Barlow, sans-serif', fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '8px 20px',
                background: 'var(--danger)', border: 'none',
                borderRadius: 4, color: '#fff',
                fontFamily: 'Bebas Neue, sans-serif', fontSize: 15,
                letterSpacing: 2, cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => { e.target.style.opacity = '0.8'; }}
              onMouseLeave={(e) => { e.target.style.opacity = '1'; }}
            >
              {t.blockBtn}
            </button>
          </form>
        </div>
      </div>

      {/* AI Activity Log */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{
          fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, letterSpacing: 2,
          color: 'var(--accent)', marginBottom: 14,
        }}>
          {t.activityLog}
        </div>
        {logs.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '20px 0',
            color: 'var(--text-muted)', fontFamily: 'Barlow, sans-serif', fontSize: 13,
          }}>
            {t.noLogs}
          </div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {logs.slice(0, 50).map((log, i) => {
              const style = getLogTypeStyle(log.type);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', marginBottom: 4, borderRadius: 6,
                    background: style.bg,
                    borderLeft: `3px solid ${style.color}`,
                    fontFamily: 'Barlow, sans-serif', fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{style.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{
                        fontFamily: 'Bebas Neue, sans-serif', fontSize: 12,
                        color: style.color, letterSpacing: 1,
                        padding: '1px 6px', borderRadius: 3,
                        border: `1px solid ${style.color}50`,
                      }}>
                        {style.label}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        {log.time ? new Date(log.time).toLocaleString() : '-'}
                      </span>
                      {log.ip && (
                        <span style={{
                          color: style.color, fontSize: 11,
                          fontFamily: "'Courier New', monospace",
                          opacity: 0.8,
                        }}>
                          {log.ip}
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {log.message}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Admin Overview */}
      <div
        className="card"
        style={{
          padding: 24,
          border: '1px solid var(--accent)',
          background: 'linear-gradient(135deg, var(--bg-secondary) 0%, transparent 100%)',
        }}
      >
        <div style={{
          fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, letterSpacing: 2,
          color: 'var(--accent)', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ filter: 'drop-shadow(0 0 6px var(--accent))' }}>{'\u2699\uFE0F'}</span>
          {t.aboutTitle}
        </div>
        <p style={{
          fontFamily: 'Barlow, sans-serif', fontSize: 14,
          color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6,
        }}>
          {t.aboutDesc}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[t.feature1, t.feature2, t.feature3, t.feature4].map((feat, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 6,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                fontFamily: 'Barlow, sans-serif', fontSize: 13,
                color: 'var(--text-muted)',
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent)',
                boxShadow: '0 0 6px var(--accent)',
                flexShrink: 0,
              }} />
              {feat}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
