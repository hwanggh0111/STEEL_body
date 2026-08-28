import { useState, useEffect, useMemo } from 'react';
import { useToday } from '../data/useToday';
import { dateKey } from '../data/dateKey';
import client from '../api/client';

// 보안 로그 (관리자 화면의 「해킹 보안」).
//
// **이 화면은 아무것도 안 보여주고 있었다.** 서버의 `/security/logs` 는 로그 배열을
// 그대로 주는데, 화면은 그걸 객체로 받아
//
//     const { logs = [], securityScore = {}, threats = {} } = data;
//
// 라고 풀고 있었다. 배열에서 그런 이름을 꺼내면 전부 `undefined` 라 기본값이 들어간다.
// 그래서 로그 100건이 도착해도 **언제나 「보안 로그가 없습니다」**였고,
// 오늘 로그인 실패 · 차단된 요청 · 의심스러운 활동은 **언제나 0**,
// SECURITY SCORE 는 **언제나 0/100 에 빨간색**이었다.
//
// 관리자가 볼 수 있는 것이 「전부 0, 점수 0」뿐이면, 놀라거나 아니면 이 화면을
// 영영 안 믿게 된다. 둘 다 나쁘다.
//
// 다시 만들면서 **점수를 없앴다.** 100점 만점 점수와 체크리스트는 서버에 없는 값이다 —
// 화면이 혼자 지어내던 것이다. 인바디에서 몸에 등급을 안 매기기로 한 것과 같은 이유로,
// 없는 근거로 「50점」 같은 말을 하지 않는다. 대신 **실제로 온 로그를 세서** 보여준다.
//
// 로그는 서버 메모리에 최근 1000건까지만 쌓이고 **서버가 다시 뜨면 사라진다.**
// 화면에 그렇다고 적어둔다 — 0건인 것과 기록이 날아간 것은 다르다.

const TYPES = {
  login_success:          { label: '로그인 성공', tone: 'muted' },
  login_fail:             { label: '로그인 실패', tone: 'warn' },
  login_blocked:          { label: '로그인 차단', tone: 'danger' },
  block:                  { label: '유저 차단', tone: 'danger' },
  unblock:                { label: '차단 해제', tone: 'info' },
  register:               { label: '회원가입', tone: 'info' },
  password_change:        { label: '비밀번호 변경', tone: 'info' },
  password_reset:         { label: '비밀번호 재설정', tone: 'warn' },
  password_reset_unknown: { label: '없는 계정에 재설정 시도', tone: 'warn' },
  token_expired:          { label: '토큰 만료', tone: 'muted' },
  system:                 { label: '시스템', tone: 'muted' },
  // 아래는 관리자가 직접 한 일과 AI Guard 가 한 일이다.
  // 예전 화면은 다섯 종류만 한국어로 알고 나머지는 영문 키를 그대로 뿌렸다 —
  // 서버가 실제로 남기는 종류를 세어보니 열아홉이었다
  'ai-block':             { label: 'AI · IP 차단', tone: 'danger' },
  'ai-unblock':           { label: 'AI · IP 차단 해제', tone: 'info' },
  'make-admin':           { label: '관리자 부여', tone: 'warn' },
  'revoke-admin':         { label: '관리자 회수', tone: 'warn' },
  'security-scan':        { label: '보안 검사 실행', tone: 'muted' },
  CRITICAL:               { label: '심각', tone: 'danger' },
  ALERT:                  { label: '경보', tone: 'danger' },
  WARNING:                { label: '경고', tone: 'warn' },
  INFO:                   { label: '알림', tone: 'muted' },
};

const TONE = {
  danger: 'var(--danger)',
  warn:   'var(--warning)',
  info:   'var(--info)',
  muted:  'var(--text-muted)',
};

const typeOf = (t) => TYPES[t] || { label: t || '알 수 없음', tone: 'muted' };

// 눈여겨볼 것 — 세는 것이 무엇인지 화면에 그대로 적는다.
// 「의심스러운 활동」처럼 무엇을 세는지 알 수 없는 이름은 쓰지 않는다
const WATCH = [
  { key: 'login_fail', label: '로그인 실패', types: ['login_fail'], tone: 'warn' },
  { key: 'login_blocked', label: '로그인 차단', types: ['login_blocked'], tone: 'danger' },
  { key: 'reset', label: '비밀번호 재설정', types: ['password_reset', 'password_reset_unknown'], tone: 'warn' },
  { key: 'register', label: '가입', types: ['register'], tone: 'info' },
];

// 기록은 UTC 로 저장된다(`2026-08-28T15:20:00.000Z`). 앞 열 글자를 그냥 자르면
// 그것도 UTC 날짜다 — 한국에서 밤 9시 이후에 남은 기록이 「내일」로 넘어간다.
// 로컬 날짜로 바꿔서 센다 (dateKey 와 같은 규칙)
const dayOf = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : dateKey(d);
};
const timeOf = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
};

export default function HackingSecurityPanel() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    setFailed(false);
    client.get('/security/logs')
      // 서버는 **배열**을 준다. 예전에는 이걸 객체로 받아서 전부 놓쳤다
      .then(({ data }) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // 켜둔 채 날이 바뀌어도 오늘을 가리킨다 (useToday). 예전에는 UTC 기준이라
  // 새벽 0~9시에 어제 것을 오늘로 셌다
  const today = useToday();

  const counts = useMemo(() => {
    const out = {};
    WATCH.forEach(w => { out[w.key] = { today: 0, all: 0 }; });
    logs.forEach(l => {
      WATCH.forEach(w => {
        if (!w.types.includes(l.type)) return;
        out[w.key].all += 1;
        if (dayOf(l.timestamp) === today) out[w.key].today += 1;
      });
    });
    return out;
  }, [logs, today]);

  const kinds = useMemo(() => {
    const seen = new Map();
    logs.forEach(l => seen.set(l.type, (seen.get(l.type) || 0) + 1));
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [logs]);

  const shown = filter === 'all' ? logs : logs.filter(l => l.type === filter);

  if (loading) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        불러오는 중…
      </div>
    );
  }

  if (failed) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        보안 로그를 불러오지 못했습니다.
        <br />없어진 게 아니라 못 가져온 것입니다.
        <button className="btn-secondary" style={{ marginTop: 14 }} onClick={load}>다시 읽기</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2,
          color: 'var(--accent)', margin: 0,
        }}>보안 로그</h2>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>최근 {logs.length}건</span>
        <button
          onClick={load}
          style={{
            marginLeft: 'auto', background: 'none', border: '1px solid var(--border)',
            color: 'var(--text-muted)', padding: '5px 12px', fontSize: 11.5,
            borderRadius: 'var(--radius)', cursor: 'pointer',
          }}
        >새로 읽기</button>
      </div>

      {/* 무엇을 보고 있는 건지 밝힌다. 0건인 것과 기록이 날아간 것은 다르다 */}
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
        서버 메모리에 쌓이는 최근 기록입니다. <b style={{ color: 'var(--text-secondary)' }}>서버가 다시 뜨면 비워집니다</b> —
        여기가 비어 있다고 아무 일도 없었다는 뜻은 아닙니다.
      </div>

      {/* 눈여겨볼 것 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 18 }}>
        {WATCH.map(w => {
          const c = counts[w.key] || { today: 0, all: 0 };
          const color = c.today > 0 ? TONE[w.tone] : 'var(--text-muted)';
          return (
            <div key={w.key} className="card" style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 1.5,
                  color, lineHeight: 1,
                }}>{c.today}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>오늘</span>
                <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)' }}>
                  기록 {c.all}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5 }}>{w.label}</div>
            </div>
          );
        })}
      </div>

      {/* 종류로 거르기 — 있는 종류만 그린다 */}
      {kinds.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {[['all', `전체 ${logs.length}`], ...kinds.map(([k, n]) => [k, `${typeOf(k).label} ${n}`])].map(([key, label]) => {
            const on = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'var(--accent)' : 'transparent',
                  color: on ? 'var(--on-accent)' : 'var(--text-secondary)',
                  fontWeight: on ? 700 : 400, transition: 'all 0.15s',
                }}
              >{label}</button>
            );
          })}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
          {logs.length === 0 ? '아직 쌓인 기록이 없습니다.' : '이 종류의 기록이 없습니다.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {shown.map((log, i) => {
            const kind = typeOf(log.type);
            const color = TONE[kind.tone];
            return (
              <div
                key={`${log.timestamp}-${i}`}
                className="card"
                style={{ padding: '10px 12px', borderLeft: `3px solid ${color}` }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '1px 8px',
                    borderRadius: 'var(--radius)', color,
                    border: `1px solid ${color}`,
                  }}>{kind.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {timeOf(log.timestamp)}
                  </span>
                </div>
                {log.detail && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5, wordBreak: 'break-all' }}>
                    {log.detail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
