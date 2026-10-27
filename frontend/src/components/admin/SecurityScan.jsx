import { useState } from 'react';
import { toast } from '../Toast';
import { clockOf, stampOf } from '../../data/dateKey';

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

  // 서버는 코드로 말한다(ENV · CRITICAL …). 코드는 그대로 두고 **화면에서만** 옮긴다 —
  // 서버 쪽 이름을 우리말로 바꾸면 로그·검사·문서가 같이 흔들린다
  const CAT = {
    ENV: '환경변수', DB: '데이터', HEADERS: '헤더',
    AI_GUARD: '가드', XSS_FILTER: 'XSS', INJECTION: '주입', FILES: '파일',
  };
  const SEV = { CRITICAL: '심각', HIGH: '높음', MEDIUM: '보통', LOW: '낮음' };

  // ── 서버가 주는 모양을 **한 자리에서 받는다** ── (2026-10-27)
  //
  // 여태 그리는 자리마다 `result.summary.safe` · `report.server.nodeVersion` 처럼
  // 바로 파고들었다. 그 줄 하나가 터지면 **관리자 화면이 통째로 흰 화면**이 된다 —
  // 이 화면 안에서도 「내보내는 헤더」와 「최근 보안 로그」는 이미 `|| {}` 로
  // 감싸고 있었다. 어떤 줄은 감싸고 어떤 줄은 안 감싼 채였다.
  //
  // **없는 것은 없다고 적는다**(`-`). 0 으로 때우면 「아무 일도 없다」로 읽힌다
  const sum = (result && typeof result.summary === 'object' && result.summary) || null;
  const rows = Array.isArray(result?.results) ? result.results : [];
  const srv = report?.server || {};
  const usr = report?.users || {};
  const thr = report?.threats || {};
  const aut = report?.auth || {};
  /** 숫자가 안 왔으면 `-`. **0 과 「안 왔다」는 다른 말이다** */
  const n = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : '-');

  const sevColor = (s) => {
    if (s === 'CRITICAL') return 'var(--danger)';
    if (s === 'HIGH') return 'var(--accent)';
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
            <div style={{ fontSize: 64, fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", color: gradeColor(result.grade), lineHeight: 1 }}>{result.grade}</div>
            {/* **감싸서 읽는다** (2026-10-27). 여태 `result.summary.safe` 를 바로
                읽었다 — 서버가 다른 모양을 주면(배포본이 한 판 뒤처졌을 때 · 앞에 선
                것이 오류 쪽지를 끼워 보낼 때) 그 줄에서 터지고 **관리자 화면이 통째로
                흰 화면**이 된다. 바로 아래 「내보내는 헤더」와 「최근 보안 로그」는
                이미 감싸고 있었다 — 같은 화면에서 어떤 줄은 감싸고 어떤 줄은 안
                감싸고 있었던 셈이다 */}
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
              {sum ? (
                <>
                  {n(sum.safe)}/{n(sum.total)} 통과 | 심각 {n(sum.critical)} | 높음 {n(sum.high)}
                  {/* 서버가 세어 보내는데 아무 데도 안 쓰고 있던 칸이다 */}
                  {Number(sum.vulnerable) > 0 && <> | <b style={{ color: 'var(--danger)' }}>걸림 {n(sum.vulnerable)}</b></>}
                </>
              ) : '요약을 못 읽었어요 (서버가 보낸 모양이 다릅니다)'}
            </div>
            {/* **ISO 글자를 그대로 뿌리고 있었다** (2026-10-27) —
                `2026-10-27T09:12:33.123Z`. 읽기 어려운 것은 둘째고, 끝의 `Z` 는
                UTC 라서 한국에서는 **아홉 시간 전**을 적은 것이었다 */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{stampOf(result.scannedAt)} 에 검사</div>
          </div>

          {/* 걸린 것을 위로 올린다. 통과한 것 스무 줄 사이에 섞어두면 못 찾는다 */}
          {[...rows].sort((a, b) => (a.status === b.status ? 0 : a.status === 'VULN' ? -1 : 1)).map((r, i) => (
            <div key={i} style={{
              padding: '9px 12px', borderBottom: '1px solid var(--border)',
              background: r.status === 'VULN' ? 'var(--danger-dim)' : 'transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 62, flexShrink: 0 }}>{CAT[r.category] || r.category}</span>
                  <span style={{ fontSize: 13, color: r.status === 'SAFE' ? 'var(--text-secondary)' : 'var(--danger)' }}>{r.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {r.severity && <span style={{ fontSize: 10, color: sevColor(r.severity), fontWeight: 700 }}>{SEV[r.severity] || r.severity}</span>}
                  <span style={{ fontSize: 12, color: r.status === 'SAFE' ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                    {r.status === 'SAFE' ? '통과' : '걸림'}
                  </span>
                </div>
              </div>
              {/* **서버는 왜 걸렸는지를 `detail` 로 같이 보내는데 화면이 버리고 있었다.**
                  「NODE_ENV · HIGH · VULN」만 보고는 무엇을 고쳐야 하는지 알 수 없다 —
                  「production 이 아님: development」가 있어야 손을 댈 수 있다 */}
              {r.detail && (
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 5, paddingLeft: 70, lineHeight: 1.6, wordBreak: 'break-all' }}>
                  {r.detail}
                </div>
              )}
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
              <div style={{ fontSize: 13 }}>Node {srv.nodeVersion || '-'}</div>
              {/* **`env` 를 보내는데 안 읽고 있었다** (2026-10-27). 바로 위 검사가
                  「NODE_ENV 가 production 이 아님」으로 등급을 깎는 자리라, 지금 어느
                  쪽으로 떠 있는지가 이 화면에서 제일 먼저 보여야 하는 값이다 */}
              <div style={{ fontSize: 11, color: srv.env === 'production' ? 'var(--text-muted)' : 'var(--warning)' }}>
                {srv.env === 'production' ? '운영' : `개발 (${srv.env || '모름'})`} · 뜬 지 {n(Math.floor((Number(srv.uptime) || 0) / 60))}분
              </div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>사용자</div>
              <div style={{ fontSize: 13 }}>총 {n(usr.total)}명</div>
              {/* **`banned` 를 보내는데 안 읽고 있었다** — 「차단」(권한)과 「정지」는
                  다른 일이다. 10/26 에 고친 것이 전부 정지 쪽인데 그 수가 이 화면에
                  없었다 */}
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                관리자 {n(usr.admins)} · 차단 {n(usr.blocked)} · 정지 {n(usr.banned)}
              </div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>위협 감지</div>
              <div style={{ fontSize: 13, color: 'var(--danger)' }}>영구정지 {n(thr.level4)} · 정지 {n(thr.level3)} · 잠금 {n(thr.level2)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                되돌려 보낸 비율 {thr.blockRate || '-'} ({n(thr.totalBlocked)}/{n(thr.totalRequests)})
              </div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>인증</div>
              <div style={{ fontSize: 13 }}>{aut.jwtAlgorithm || '-'} · {aut.accessTokenExpiry || '-'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                다시 받기 {aut.refreshTokenExpiry || '-'} · 암호 {n(aut.bcryptRounds)}회
              </div>
            </div>
            {/* ── **지금 걸려 있는 것** ── (2026-10-27)
                서버는 셋을 세어 보내는데(`activeLocks` · `suspensions` ·
                `blacklistEntries`) 화면에 한 칸도 없었다. 위의 「위협 감지」는
                **서버가 뜬 뒤로 몇 번 있었나**이고, 이것은 **지금 몇이 걸려 있나**다 —
                풀어달라는 사람이 왔을 때 봐야 하는 쪽은 이쪽이다 */}
            <div className="card" style={{ padding: 12, gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>지금 걸려 있는 것</div>
              <div style={{ fontSize: 13 }}>
                막힌 주소 {n(thr.activeLocks)} · 정지 {n(thr.suspensions)} · 가입 막음 {n(thr.blacklistEntries)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                푸는 것은 「해킹 보안」 화면에서 합니다.
              </div>
            </div>
          </div>

          <div className="section-title"><div className="accent-bar" />방어 시스템</div>
          <div className="card" style={{ padding: 12, marginBottom: 16 }}>
            {Object.entries(report.defense || {}).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{key}</span>
                <span style={{ fontSize: 12, color: 'var(--success)' }}>{val}</span>
              </div>
            ))}
          </div>

          {/* ── 내보내는 헤더 ── (2026-10-21 에 붙였다)
              서버는 이것을 **줄곧 보내고 있었는데 화면이 안 그렸다.** `routes/security.js` 의
              `permissionsPolicy` 자리에 「화면이 「설정됨」이라고 읽는 자리다」라고 적혀
              있는데 읽는 데가 없었다 — 8/27 에 그 값을 진짜로 나가는 것으로 고친 일이
              **아무 데도 보이지 않고 있었다.** 방어 시스템과 같은 모양으로 그린다 */}
          <div className="section-title"><div className="accent-bar" />내보내는 헤더</div>
          <div className="card" style={{ padding: 12, marginBottom: 16 }}>
            {Object.entries(report.headers || {}).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{key}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right', wordBreak: 'break-all' }}>
                  {String(val)}
                </span>
              </div>
            ))}
          </div>

          <div className="section-title"><div className="accent-bar" />최근 보안 로그</div>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {(report.recentLogs || []).map((log, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                {/* **UTC 글자를 그대로 잘라 쓰고 있었다** (2026-10-27) —
                    `substring(11, 19)` 는 `Z` 가 붙은 시각의 가운데라, 저녁 6시에
                    일어난 일이 **오전 9시**로 적혔다. 같은 로그를 그리는 AI 관리자
                    화면은 맞게 적고 있었다 — 두 화면이 아홉 시간 다르게 말했다 */}
                <span style={{ color: 'var(--text-secondary)' }}>[{clockOf(log.timestamp)}]</span> [{log.type}] {log.detail}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
