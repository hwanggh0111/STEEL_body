import { useState } from 'react';
import { toast } from '../Toast';

export default function SecurityScan() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [report, setReport] = useState(null);

  const runScan = async () => {
    setScanning(true);
    try {
      const { default: client } = await import('../../api/client');
      const { data } = await client.post('/security/scan');
      setResult(data);
      toast('보안 검사 완료! 등급: ' + data.grade);
    } catch (err) {
      toast('보안 검사 실패: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setScanning(false);
    }
  };

  const loadReport = async () => {
    try {
      const { default: client } = await import('../../api/client');
      const { data } = await client.get('/security/report');
      setReport(data);
    } catch (err) {
      toast('보고서 로드 실패', 'error');
    }
  };

  const gradeColor = (g) => {
    if (g === 'A') return 'var(--success)';
    if (g === 'B') return 'var(--warning)';
    return 'var(--danger)';
  };

  const sevColor = (s) => {
    if (s === 'CRITICAL') return 'var(--danger)';
    if (s === 'HIGH') return '#ff6b1a';
    if (s === 'MEDIUM') return 'var(--warning)';
    return 'var(--text-muted)';
  };

  return (
    <div>
      <div className="section-title"><div className="accent-bar" />자동 보안 검사</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        서버 환경, DB 무결성, 보안 헤더, XSS 필터, AI Guard 상태를 자동으로 검사합니다.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className="btn-primary" onClick={runScan} disabled={scanning} style={{ width: 'auto', padding: '12px 24px' }}>
          {scanning ? '검사 중...' : '보안 검사 실행'}
        </button>
        <button className="btn-secondary" onClick={loadReport} style={{ padding: '12px 20px' }}>
          보안 보고서
        </button>
      </div>

      {result && (
        <div style={{ marginBottom: 24 }}>
          <div className="card" style={{ padding: 20, marginBottom: 16, borderColor: gradeColor(result.grade), textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>보안 등급</div>
            <div style={{ fontSize: 64, fontFamily: "'Bebas Neue', sans-serif", color: gradeColor(result.grade), lineHeight: 1 }}>{result.grade}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
              {result.summary.safe}/{result.summary.total} SAFE | CRITICAL {result.summary.critical} | HIGH {result.summary.high}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{result.scannedAt}</div>
          </div>

          {result.results.map((r, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', borderBottom: '1px solid var(--border)',
              background: r.status === 'VULN' ? 'var(--danger-dim)' : 'transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 70 }}>[{r.category}]</span>
                <span style={{ fontSize: 13, color: r.status === 'SAFE' ? 'var(--text-secondary)' : 'var(--danger)' }}>{r.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {r.severity && <span style={{ fontSize: 10, color: sevColor(r.severity), fontWeight: 700 }}>{r.severity}</span>}
                <span style={{ fontSize: 12, color: r.status === 'SAFE' ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{r.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {report && (
        <div>
          <div className="section-title" style={{ marginTop: 24 }}><div className="accent-bar" />보안 보고서</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>서버</div>
              <div style={{ fontSize: 13 }}>Node {report.server.nodeVersion}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Uptime: {Math.floor(report.server.uptime / 60)}분</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>사용자</div>
              <div style={{ fontSize: 13 }}>총 {report.users.total}명</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>관리자 {report.users.admins} | 차단 {report.users.blocked}</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>위협 감지</div>
              <div style={{ fontSize: 13, color: 'var(--danger)' }}>L4: {report.threats.level4} | L3: {report.threats.level3}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>차단율: {report.threats.blockRate}</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>인증</div>
              <div style={{ fontSize: 13 }}>Access: {report.auth.accessTokenExpiry}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Refresh: {report.auth.refreshTokenExpiry}</div>
            </div>
          </div>

          <div className="section-title"><div className="accent-bar" />방어 시스템</div>
          <div className="card" style={{ padding: 12, marginBottom: 16 }}>
            {Object.entries(report.defense).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{key}</span>
                <span style={{ fontSize: 12, color: 'var(--success)' }}>{val}</span>
              </div>
            ))}
          </div>

          <div className="section-title"><div className="accent-bar" />최근 보안 로그</div>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {(report.recentLogs || []).map((log, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>[{log.timestamp?.substring(11, 19)}]</span> [{log.type}] {log.detail}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
