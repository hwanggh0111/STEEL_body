import { useState, useEffect } from 'react';
import { useLangStore } from '../store/langStore';
import client from '../api/client';

const T = {
  ko: {
    title: 'HACKING SECURITY PANEL',
    securityLogs: 'SECURITY LOGS',
    securityScore: 'SECURITY SCORE',
    threatStatus: 'THREAT STATUS',
    loginFails: '오늘 로그인 실패',
    blockedRequests: '오늘 차단된 요청',
    suspiciousActivity: '의심스러운 활동',
    checklist: '보안 체크리스트',
    passed: '통과',
    failed: '미통과',
    score: '점',
    time: '시간',
    type: '타입',
    detail: '상세',
    noLogs: '보안 로그가 없습니다.',
    loading: '로딩 중...',
    error: '데이터를 불러올 수 없습니다.',
    login_success: '로그인 성공',
    login_fail: '로그인 실패',
    login_blocked: '로그인 차단',
    register: '회원가입',
    token_expired: '토큰 만료',
  },
  en: {
    title: 'HACKING SECURITY PANEL',
    securityLogs: 'SECURITY LOGS',
    securityScore: 'SECURITY SCORE',
    threatStatus: 'THREAT STATUS',
    loginFails: 'Login Failures Today',
    blockedRequests: 'Blocked Requests Today',
    suspiciousActivity: 'Suspicious Activity',
    checklist: 'Security Checklist',
    passed: 'Passed',
    failed: 'Failed',
    score: 'pts',
    time: 'Time',
    type: 'Type',
    detail: 'Detail',
    noLogs: 'No security logs.',
    loading: 'Loading...',
    error: 'Failed to load data.',
    login_success: 'Login Success',
    login_fail: 'Login Failed',
    login_blocked: 'Login Blocked',
    register: 'Register',
    token_expired: 'Token Expired',
  },
};

const LOG_STYLES = {
  login_success: { color: '#00c853', icon: '[ OK ]', bg: '#00c85312' },
  login_fail:    { color: '#ff1744', icon: '[ !! ]', bg: '#ff174412' },
  login_blocked: { color: '#ff9100', icon: '[ XX ]', bg: '#ff910012' },
  register:      { color: '#448aff', icon: '[ ++ ]', bg: '#448aff12' },
  token_expired: { color: '#888888', icon: '[ -- ]', bg: '#88888812' },
};

function getLogStyle(type) {
  return LOG_STYLES[type] || { color: 'var(--text-muted)', icon: '[ ?? ]', bg: 'transparent' };
}

export default function HackingSecurityPanel() {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await client.get('/security/logs');
      setData(res.data);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        {t.loading}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', color: '#ff1744' }}>
        {t.error}
      </div>
    );
  }

  const { logs = [], securityScore = {}, threats = {} } = data;
  const { checklist = [], totalScore = 0 } = securityScore;
  const { loginFails = 0, blockedRequests = 0, suspiciousActivity = 0 } = threats;

  const scoreColor = totalScore >= 80 ? '#00c853' : totalScore >= 50 ? '#ffab00' : '#ff1744';

  return (
    <div>
      {/* Title */}
      <h2 style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 22,
        letterSpacing: 2,
        color: 'var(--accent)',
        marginBottom: 16,
      }}>
        {t.title}
      </h2>

      {/* Threat Status */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 15,
          letterSpacing: 1.5,
          color: 'var(--accent)',
          marginBottom: 10,
        }}>
          {t.threatStatus}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {/* Login Fails */}
          <div className="card" style={{ padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: "'Barlow', sans-serif", marginBottom: 4 }}>
              {t.loginFails}
            </div>
            <div style={{
              fontSize: 24,
              fontFamily: "'Bebas Neue', sans-serif",
              color: loginFails > 10 ? '#ff1744' : loginFails > 3 ? '#ffab00' : '#00c853',
              letterSpacing: 1,
            }}>
              {loginFails}
            </div>
          </div>

          {/* Blocked Requests */}
          <div className="card" style={{ padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: "'Barlow', sans-serif", marginBottom: 4 }}>
              {t.blockedRequests}
            </div>
            <div style={{
              fontSize: 24,
              fontFamily: "'Bebas Neue', sans-serif",
              color: blockedRequests > 20 ? '#ff1744' : blockedRequests > 5 ? '#ff9100' : '#00c853',
              letterSpacing: 1,
            }}>
              {blockedRequests}
            </div>
          </div>

          {/* Suspicious Activity */}
          <div className="card" style={{ padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: "'Barlow', sans-serif", marginBottom: 4 }}>
              {t.suspiciousActivity}
            </div>
            <div style={{
              fontSize: 24,
              fontFamily: "'Bebas Neue', sans-serif",
              color: suspiciousActivity > 5 ? '#ff1744' : suspiciousActivity > 0 ? '#ffab00' : '#00c853',
              letterSpacing: 1,
            }}>
              {suspiciousActivity}
            </div>
          </div>
        </div>
      </div>

      {/* Security Score */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 15,
            letterSpacing: 1.5,
            color: 'var(--accent)',
            margin: 0,
          }}>
            {t.securityScore}
          </h3>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28,
            color: scoreColor,
            letterSpacing: 1,
          }}>
            {totalScore}<span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/100{t.score}</span>
          </div>
        </div>

        {/* Score Bar */}
        <div style={{
          height: 10,
          borderRadius: 5,
          background: 'var(--bg-secondary)',
          overflow: 'hidden',
          marginBottom: 14,
        }}>
          <div style={{
            height: '100%',
            borderRadius: 5,
            width: `${Math.min(totalScore, 100)}%`,
            background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}cc)`,
            transition: 'width 0.6s ease',
            boxShadow: `0 0 8px ${scoreColor}50`,
          }} />
        </div>

        {/* Checklist */}
        <div style={{ fontSize: 11, fontFamily: "'Barlow', sans-serif" }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>
            {t.checklist}
          </div>
          {checklist.map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: i < checklist.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ color: item.passed ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {item.name}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 8px',
                borderRadius: 'var(--radius)',
                background: item.passed ? '#00c85318' : '#ff174418',
                color: item.passed ? '#00c853' : '#ff1744',
                border: `1px solid ${item.passed ? '#00c85340' : '#ff174440'}`,
              }}>
                {item.passed ? t.passed : t.failed}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Security Logs */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 15,
          letterSpacing: 1.5,
          color: 'var(--accent)',
          marginBottom: 10,
        }}>
          {t.securityLogs}
        </h3>

        {logs.length === 0 ? (
          <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            {t.noLogs}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {logs.map((log, i) => {
              const style = getLogStyle(log.type);
              return (
                <div
                  key={i}
                  className="card"
                  style={{
                    padding: '10px 12px',
                    background: style.bg,
                    borderLeft: `3px solid ${style.color}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {/* Icon */}
                    <span style={{
                      fontFamily: "'Barlow', sans-serif",
                      fontSize: 10,
                      fontWeight: 700,
                      color: style.color,
                      letterSpacing: 0.5,
                    }}>
                      {style.icon}
                    </span>

                    {/* Type Badge */}
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 8px',
                      borderRadius: 'var(--radius)',
                      background: `${style.color}20`,
                      color: style.color,
                      border: `1px solid ${style.color}40`,
                    }}>
                      {t[log.type] || log.type}
                    </span>

                    {/* Time */}
                    <span style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      fontFamily: "'Barlow', sans-serif",
                      marginLeft: 'auto',
                    }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}
                    </span>
                  </div>

                  {/* Detail */}
                  {log.detail && (
                    <div style={{
                      fontSize: 11,
                      fontFamily: "'Barlow', sans-serif",
                      color: 'var(--text-muted)',
                      paddingLeft: 42,
                    }}>
                      {log.detail}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
