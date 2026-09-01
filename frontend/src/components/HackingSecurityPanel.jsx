import { useState, useEffect, useMemo } from 'react';
import { useToday } from '../data/useToday';
import { dateKey } from '../data/dateKey';
import client from '../api/client';
import { toast } from './Toast';

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
//
// **그리고 로그만 있으면 반쪽이다.** 로그는 「무슨 일이 있었나」인데, 관리자가 정작
// 알아야 하는 것은 **「지금 누가 막혀 있나」**다. 풀어달라는 사람이 와도 볼 자리가
// 없었다 — 막힌 목록은 어느 화면에도 없었고, 9/1 에 넣은 로그인 잠금도 마찬가지였다.
//
// 그래서 위에 「지금 막혀 있는 것」을 둔다. 이쪽은 로그와 반대로 **파일에 남는다** —
// 서버가 다시 떠도 그대로다. 두 자리의 성격이 다르다는 것을 화면에 적어둔다.

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

// 남은 시간을 사람 말로. 「1440분」은 아무도 하루로 안 읽는다
const leftText = (minutes) => {
  if (minutes === null || minutes === undefined) return '풀 때까지';
  if (minutes < 60) return `${minutes}분 남음`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 남음`;
  return `${Math.floor(minutes / (60 * 24))}일 남음`;
};

const LEVEL_TEXT = {
  2: '자동 · 일시 잠금',
  3: '자동 · 정지',
  4: '자동 · 영구 차단',
};

export default function HackingSecurityPanel() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState('all');
  // 지금 막혀 있는 것. **로그를 못 불러와도 이쪽은 따로 보여준다** — 둘은 다른 자리다
  const [shield, setShield] = useState(null);
  const [shieldFailed, setShieldFailed] = useState(false);
  const [busy, setBusy] = useState('');

  const loadShield = () => {
    setShieldFailed(false);
    // **프로미스를 돌려준다.** 안 돌려주면 푸는 쪽이 목록 갱신을 못 기다리고
    // 단추부터 풀어버려서, 방금 푼 줄이 잠깐 그대로 남는다
    return client.get('/security/shield')
      .then(({ data }) => setShield({
        blocks: Array.isArray(data?.blocks) ? data.blocks : [],
        loginLocks: Array.isArray(data?.loginLocks) ? data.loginLocks : [],
      }))
      .catch(() => { setShield(null); setShieldFailed(true); });
  };

  const load = () => {
    setLoading(true);
    setFailed(false);
    loadShield();
    client.get('/security/logs')
      // 서버는 **배열**을 준다. 예전에는 이걸 객체로 받아서 전부 놓쳤다
      .then(({ data }) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };

  // 푸는 자리 둘. 누르는 동안 그 줄만 잠가둔다 — 연타로 두 번 보내면
  // 두 번째는 「목록에 없어요」가 되어 푼 사람에게 실패로 보인다.
  //
  // **안 풀렸으면 안 풀렸다고 말한다.** 처음에는 `.catch(() => {})` 로 삼키고 있었다 —
  // 그러면 단추가 「푸는 중…」에서 도로 「풀기」가 되고 줄은 그대로 남는데, 관리자는
  // 「풀렸는데 목록이 늦은 것」인지 「안 풀린 것」인지 알 길이 없다. 사람을 막아둔 자리라
  // 그 차이가 크다. 그리고 목록을 다시 읽는 것까지 기다렸다가 단추를 풀어준다
  const unblockIp = (ip) => {
    setBusy('ip:' + ip);
    client.post(`/security/ai-unblock/${encodeURIComponent(ip)}`)
      .then(() => loadShield())
      .then(() => toast(`${ip} 차단을 풀었어요`))
      .catch((e) => toast(e?.response?.data?.error || '못 풀었어요. 잠시 뒤에 다시 해주세요', 'error'))
      .finally(() => setBusy(''));
  };
  const unlockLogin = (key) => {
    setBusy(key);
    client.post('/security/unlock-login', { key })
      .then(() => loadShield())
      .then(() => toast('잠금을 풀었어요'))
      .catch((e) => toast(e?.response?.data?.error || '못 풀었어요. 잠시 뒤에 다시 해주세요', 'error'))
      .finally(() => setBusy(''));
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

  // 지금 막혀 있는 것. **로그와 따로 그린다** — 로그를 못 불러왔다고 이것까지
  // 안 보여주면, 정작 사람이 「왜 막혔냐」고 물어온 순간에 볼 자리가 없다
  const shieldBlock = (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: 'var(--accent)', margin: 0 }}>
          지금 막혀 있는 것
        </h2>
        {shield && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            주소 {shield.blocks.length} · 로그인 잠금 {shield.loginLocks.length}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 12 }}>
        아래 기록과 달리 <b style={{ color: 'var(--text-secondary)' }}>서버가 다시 떠도 그대로 남습니다.</b>{' '}
        잘못 걸린 사람은 여기서 풀어주면 됩니다.
      </div>

      {shieldFailed ? (
        <div className="card" style={{ padding: 16, fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>
          막혀 있는 목록을 불러오지 못했습니다 — 없는 게 아니라 못 가져온 것입니다.
          <button className="btn-secondary" style={{ marginTop: 12 }} onClick={loadShield}>다시 읽기</button>
        </div>
      ) : !shield ? (
        <div className="card" style={{ padding: 16, fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>불러오는 중…</div>
      ) : (
        <>
          {/* 막힌 주소 */}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>차단된 주소</div>
          {shield.blocks.length === 0 ? (
            <div className="card" style={{ padding: 14, fontSize: 12.5, color: 'var(--text-muted)' }}>막아둔 주소가 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {shield.blocks.map((b) => (
                <div key={b.ip} className="card" style={{ padding: '10px 12px', borderLeft: '3px solid ' + (b.remaining === null ? TONE.danger : TONE.warn) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, wordBreak: 'break-all' }}>{b.ip}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{LEVEL_TEXT[b.level] || '자동'}</span>
                    <span style={{ fontSize: 11.5, color: b.remaining === null ? TONE.danger : 'var(--text-muted)', marginLeft: 'auto' }}>
                      {leftText(b.remaining)}
                    </span>
                    <button
                      className="btn-secondary"
                      style={{ width: 'auto', fontSize: 11.5, padding: '4px 10px' }}
                      disabled={busy === 'ip:' + b.ip}
                      onClick={() => unblockIp(b.ip)}
                    >{busy === 'ip:' + b.ip ? '푸는 중…' : '풀기'}</button>
                  </div>
                  {/* 왜 막혔는지를 같이 적는다 — 이유를 모르면 풀지 말지 정할 수가 없다 */}
                  {b.reason && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{b.reason}</div>
                  )}
                  {b.createdAt && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>막은 때 {timeOf(b.createdAt)}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 로그인 잠금 */}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '14px 0 6px' }}>잠긴 로그인</div>
          {shield.loginLocks.length === 0 ? (
            <div className="card" style={{ padding: 14, fontSize: 12.5, color: 'var(--text-muted)' }}>잠긴 로그인이 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {shield.loginLocks.map((l) => (
                <div key={l.key} className="card" style={{ padding: '10px 12px', borderLeft: '3px solid ' + TONE.warn }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 'var(--radius)',
                      color: TONE.warn, border: '1px solid ' + TONE.warn,
                    }}>{l.kind === 'account' ? '계정' : '주소'}</span>
                    <span style={{ fontSize: 13, wordBreak: 'break-all' }}>{l.target}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {l.count}번 틀림 · {leftText(l.remaining)}
                    </span>
                    <button
                      className="btn-secondary"
                      style={{ width: 'auto', fontSize: 11.5, padding: '4px 10px' }}
                      disabled={busy === l.key}
                      onClick={() => unlockLogin(l.key)}
                    >{busy === l.key ? '푸는 중…' : '풀기'}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* 계정 잠금은 남이 일부러 걸 수 있다. 관리자가 알고 있어야 풀어줄지 정할 수 있다 */}
          {shield.loginLocks.some((l) => l.kind === 'account') && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 8 }}>
              계정 잠금은 <b style={{ color: 'var(--text-secondary)' }}>남이 그 아이디로 일부러 틀려서</b> 걸 수도 있습니다.
              본인이 못 들어온다고 하면 풀어주세요 — 15분이면 저절로 풀립니다.
            </div>
          )}
        </>
      )}
    </div>
  );

  if (failed) {
    return (
      <div>
        {shieldBlock}
        <div className="card" style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          보안 로그를 불러오지 못했습니다.
          <br />없어진 게 아니라 못 가져온 것입니다.
          <button className="btn-secondary" style={{ marginTop: 14 }} onClick={load}>다시 읽기</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {shieldBlock}
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
