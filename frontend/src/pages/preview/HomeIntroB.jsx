import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../../store/workoutStore';
import { useInbodyStore } from '../../store/inbodyStore';
import { usePachinkoStore } from '../../store/pachinkoStore';
import { calcExp, getLevelInfo, MAX_LEVEL, TRANSCEND, GENESIS } from '../../components/LevelSystem';
import { TICKET_RULE, LADDER, UL_TICKET } from '../../data/pachinkoData';
import ReportPreview from './ReportPreview';

// ─────────────────────────────────────────────────────────────
// STEEL BODY 홈페이지 시안 — B안 (깔끔한 쪽)
//
// A안(HomeIntro.jsx)과 같은 내용을 다루되 방식이 다르다.
//   · 상자를 겹치지 않는다. 구분은 얇은 선과 여백으로만 한다
//   · 아이콘·그라디언트·강조색을 최소로 쓴다. 오렌지는 버튼 하나와 숫자에만
//   · 설명을 줄인다. 읽을 것보다 볼 것을 남긴다
//   · 제보함은 접어둔다 — 필요할 때만 펼친다
//
// 숫자는 A안과 똑같이 실제 상수에서 읽는다.
// ─────────────────────────────────────────────────────────────

const FEATURES = [
  { name: '운동 기록',   path: '/workout',     desc: '무게 · 횟수 · 세트' },
  { name: '인바디',      path: '/inbody',      desc: '체중 · 체지방 · 골격근' },
  { name: '루틴 추천',   path: '/routine',     desc: '2 · 3 · 5분할' },
  { name: '홈트레이닝',  path: '/homeworkout', desc: '기구 없이 맨몸으로' },
  { name: '측정 시스템', path: '/measure',     desc: '사이즈 · 1RM · 체력' },
  { name: '히스토리',    path: '/history',     desc: '달력으로 되짚기' },
];

const RULE = 'linear-gradient(90deg, var(--border) 0%, var(--border) 100%)';

function Divider({ mt = 34, mb = 34 }) {
  return <div style={{ height: 1, background: RULE, marginTop: mt, marginBottom: mb }} />;
}

// 제목 — 상자도 막대도 없이 글자만으로 층을 만든다
function Head({ children, note }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 3,
        color: 'var(--text-muted)', textTransform: 'uppercase',
      }}>{children}</div>
      {note && (
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 7, lineHeight: 1.7 }}>
          {note}
        </div>
      )}
    </div>
  );
}

export default function HomeIntroB() {
  const navigate = useNavigate();
  const { workouts, fetchAll: fetchWorkouts } = useWorkoutStore();
  const { records, fetchAll: fetchInbody } = useInbodyStore();
  const pachinkoExp = usePachinkoStore(s => s.gained);
  const [openReport, setOpenReport] = useState(false);

  useEffect(() => { fetchWorkouts(); fetchInbody(); }, []);

  const totalWorkouts = useMemo(() => Object.values(workouts).flat().length, [workouts]);
  const totalInbody = records.length;
  const latest = records[0] || null;

  const weekDays = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      if (workouts[d.toISOString().split('T')[0]]?.length) n++;
    }
    return n;
  }, [workouts]);

  const lv = getLevelInfo(calcExp(totalWorkouts, totalInbody, pachinkoExp));

  const stats = [
    { v: totalWorkouts.toLocaleString(), u: '회',              l: '총 운동' },
    { v: weekDays,                       u: '/7',              l: '이번 주' },
    { v: lv.level,                       u: `/${MAX_LEVEL}`,   l: '레벨' },
    { v: latest ? latest.weight : '—',   u: latest ? 'kg' : '', l: '최근 체중' },
  ];

  return (
    <div style={{ paddingBottom: 10 }}>
      {/* 시안 표시 — 붙일 때 지운다 */}
      <div style={{
        fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: 0.5,
        borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 40,
      }}>
        시안 B · 깔끔한 쪽 — 아직 앱에 붙어 있지 않습니다
      </div>

      {/* ─── 히어로 ─── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          fontSize: 10.5, letterSpacing: 3, color: 'var(--text-muted)', marginBottom: 18,
        }}>운동 기록 PWA</div>

        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 46, letterSpacing: 5,
          color: 'var(--text-primary)', lineHeight: 0.98,
        }}>STEEL<br />BODY</div>

        <div style={{
          width: 42, height: 2, background: 'var(--accent)', margin: '20px 0 18px',
        }} />

        <p style={{
          fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.8,
          margin: '0 0 26px', maxWidth: 380,
        }}>
          오늘 든 무게를 적으면 그게 경험치가 된다.<br />
          오르는 게 보이면 계속하게 된다.
        </p>

        <button
          onClick={() => navigate('/workout')}
          style={{
            background: 'var(--accent)', color: '#000', border: 'none',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2,
            padding: '13px 30px', borderRadius: 'var(--radius)', cursor: 'pointer',
          }}
        >기록하기</button>
      </div>

      {/* ─── 내 숫자 — 선 하나로 나눈 한 줄 ─── */}
      <div style={{
        display: 'flex', borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)', padding: '18px 0',
      }}>
        {stats.map((s, i) => (
          <div key={s.l} style={{
            flex: 1, textAlign: 'center',
            borderLeft: i === 0 ? 'none' : '1px solid var(--border)',
          }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 1,
              color: 'var(--text-primary)', lineHeight: 1,
            }}>
              {s.v}<span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 1 }}>{s.u}</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 7 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <Divider />

      {/* ─── 기능 — 2열, 아이콘 없이 ─── */}
      <Head>무엇을 할 수 있나</Head>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)' }}>
        {FEATURES.map(f => (
          <button
            key={f.path}
            onClick={() => navigate(f.path)}
            style={{
              background: 'var(--bg-primary)', border: 'none', textAlign: 'left',
              padding: '16px 14px', cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-primary)'; }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{f.desc}</div>
          </button>
        ))}
      </div>

      <Divider />

      {/* ─── 레벨 — 세 칸 한 줄 ─── */}
      <Head note="단계가 열리면 0부터 다시 시작한다. 한 숫자로 끝까지 세면 자릿수가 뭉개지기 때문이다.">
        레벨
      </Head>
      <div style={{ display: 'flex', gap: 1, background: 'var(--border)' }}>
        {[
          { n: '일반',                lo: 0, hi: MAX_LEVEL,          u: 'EXP' },
          { n: TRANSCEND.name.ko,     lo: 0, hi: TRANSCEND.maxLevel, u: 'EXP' },
          { n: GENESIS.name.ko,       lo: 0, hi: GENESIS.maxLevel,   u: 'UL EXP' },
        ].map(s => (
          <div key={s.n} style={{ flex: 1, background: 'var(--bg-primary)', padding: '14px 10px' }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 2,
              color: 'var(--text-primary)',
            }}>{s.n}</div>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1,
              color: 'var(--accent)', marginTop: 5,
            }}>{s.lo}–{s.hi}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 5 }}>{s.u}</div>
          </div>
        ))}
      </div>

      <Divider />

      {/* ─── 티켓 — 한 문장 + 한 줄 ─── */}
      <Head note={`운동 ${TICKET_RULE.perWorkouts}회당 1장, 인바디 ${TICKET_RULE.perInbody}회당 1장. 모아서 돌리면 EXP 가 한 번에 들어온다.`}>
        티켓
      </Head>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          ['파칭코', '🎫 1'],
          ['사다리', `🎫 ${LADDER.cost}`],
          ['미니게임', '무료'],
          ['교환소', `🎫 ${UL_TICKET.rate}`],
        ].map(([n, c]) => (
          <div key={n} style={{
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            padding: '8px 13px', fontSize: 12, color: 'var(--text-secondary)',
          }}>
            {n} <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{c}</span>
          </div>
        ))}
      </div>

      <Divider />

      {/* ─── 제보함 — 접어둔다 ─── */}
      <Head note="안 되는 것, 이상한 것, 있었으면 하는 것.">제보함</Head>
      {!openReport ? (
        <button
          onClick={() => setOpenReport(true)}
          style={{
            width: '100%', background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', padding: '14px', cursor: 'pointer',
            borderRadius: 'var(--radius)', fontSize: 13, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >제보 쓰기 · 내 제보 보기</button>
      ) : (
        <ReportPreview embedded />
      )}

      <div style={{
        marginTop: 40, paddingTop: 18, borderTop: '1px solid var(--border)',
        fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1,
      }}>
        STEEL BODY · FORGE YOUR BODY · BREAK YOUR LIMITS
      </div>
    </div>
  );
}
