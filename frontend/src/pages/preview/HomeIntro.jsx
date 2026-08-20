import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../../store/workoutStore';
import { useInbodyStore } from '../../store/inbodyStore';
import { usePachinkoStore } from '../../store/pachinkoStore';
import { calcExp, getLevelInfo, MAX_LEVEL, TRANSCEND, GENESIS, TRANSCEND_TIERS, GENESIS_TIERS } from '../../components/LevelSystem';
import { TICKET_RULE, LADDER, UL_TICKET } from '../../data/pachinkoData';
import ReportPreview from './ReportPreview';

// ─────────────────────────────────────────────────────────────
// STEEL BODY 홈페이지 시안
//
// 아직 앱에 붙이지 않았다. 탭에도 검색에도 없고 /preview/homepage 주소로만 열린다.
// 개발 빌드 전용 (App.jsx 에서 import.meta.env.DEV 로 갈린다).
//
// 숫자를 손으로 적지 않는다 — 레벨 상한도 티켓 규칙도 전부 실제 상수에서 읽는다.
// 밸런스를 바꾸면 이 페이지가 따라온다. 소개 문구와 실제가 어긋나는 게 제일 흔한 거짓말이라서다.
// 내 기록·레벨도 실제 스토어에서 읽는다.
// ─────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: '🏋️', name: '운동 기록',   path: '/workout',     desc: '무게 · 횟수 · 세트를 남긴다. 지난 기록이 옆에 떠서 오늘 얼마나 올릴지 바로 안다' },
  { icon: '📊', name: '인바디',      path: '/inbody',      desc: '체중 · 체지방 · 골격근을 넣으면 그래프로 이어진다. BMI 와 변화량을 같이 본다' },
  { icon: '📋', name: '루틴 추천',   path: '/routine',     desc: '2분할 · 3분할 · 5분할. 무엇을 할지 정하는 데 시간을 쓰지 않게' },
  { icon: '🏠', name: '홈트레이닝',  path: '/homeworkout', desc: '기구 없이 하는 맨몸 운동. 집에서도 기록이 끊기지 않는다' },
  { icon: '📐', name: '측정 시스템', path: '/measure',     desc: '전신 사이즈 · 1RM · 체력 테스트 · 심박수 존 · 스톱워치까지 한곳에' },
  { icon: '📅', name: '히스토리',    path: '/history',     desc: '달력으로 되짚는다. 빠진 날이 눈에 보여야 안 빠진다' },
];

function Stat({ label, value, unit, dim }) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 74, textAlign: 'center',
      padding: '12px 6px', background: 'var(--bg-secondary)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    }}>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif", fontSize: 23, letterSpacing: 1,
        color: dim ? 'var(--text-muted)' : 'var(--accent)', lineHeight: 1.1,
      }}>
        {value}<span style={{ fontSize: 12, marginLeft: 2, letterSpacing: 0 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

function Stage({ badge, color, title, range, sub, tiers, first, last }) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '14px 0',
      borderTop: '1px solid var(--border)',
    }}>
      <div style={{
        width: 34, height: 34, flexShrink: 0, borderRadius: '50%',
        background: 'var(--bg-tertiary)', border: `1px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>{badge}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 2, color,
          }}>{title}</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{range}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.65 }}>{sub}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.6 }}>
          {first} <span style={{ color: 'var(--text-muted)' }}>…</span> {last}
          <span style={{ color: 'var(--text-muted)' }}> · {tiers}등급</span>
        </div>
      </div>
    </div>
  );
}

export default function HomeIntro() {
  const navigate = useNavigate();
  const { workouts, fetchAll: fetchWorkouts } = useWorkoutStore();
  const { records, fetchAll: fetchInbody } = useInbodyStore();
  const pachinkoExp = usePachinkoStore(s => s.gained);

  useEffect(() => { fetchWorkouts(); fetchInbody(); }, []);

  const totalWorkouts = useMemo(() => Object.values(workouts).flat().length, [workouts]);
  const totalInbody = records.length;
  const latest = records[0] || null;

  // 이번 주 며칠 했나
  const weekDays = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = d.toISOString().split('T')[0];
      if (workouts[key]?.length) n++;
    }
    return n;
  }, [workouts]);

  const lv = getLevelInfo(calcExp(totalWorkouts, totalInbody, pachinkoExp));
  const started = totalWorkouts > 0 || totalInbody > 0;

  // 티켓 수급 규칙 — 상수에서 그대로 읽는다
  const ticketLine = `운동 ${TICKET_RULE.perWorkouts}회당 1장 · 인바디 ${TICKET_RULE.perInbody}회당 1장`;

  return (
    <div>
      {/* 시안 표시 — 붙일 때 지운다 */}
      <div style={{
        background: 'var(--warning-dim)', border: '1px solid var(--warning)',
        borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 20,
        fontSize: 12, color: 'var(--warning)', lineHeight: 1.6,
      }}>
        ⚠️ <b>시안입니다.</b> 아직 앱에 붙어 있지 않습니다. 숫자와 기록은 실제 값입니다.
      </div>

      {/* ─── 히어로 ─── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        background: 'linear-gradient(160deg, #150c06 0%, #0d0d0d 55%, #0a0a0a 100%)',
        padding: '30px 22px 26px', marginBottom: 14,
      }}>
        {/* 뒤에 깔리는 은은한 오렌지 */}
        <div style={{
          position: 'absolute', top: -70, right: -50, width: 220, height: 220,
          background: 'radial-gradient(circle, rgba(255,107,26,0.13) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'inline-block', fontSize: 10.5, letterSpacing: 2,
            color: 'var(--accent)', border: '1px solid var(--accent)',
            padding: '3px 9px', borderRadius: 'var(--radius)', marginBottom: 14,
          }}>운동 기록 PWA</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <svg width="46" height="46" viewBox="0 0 60 60" fill="none" style={{ flexShrink: 0 }}>
              <defs>
                <linearGradient id="introGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffd700" /><stop offset="100%" stopColor="#ff6b1a" />
                </linearGradient>
              </defs>
              <rect x="12" y="27" width="36" height="6" rx="3" fill="url(#introGrad)" />
              <rect x="6" y="18" width="8" height="24" rx="3" fill="url(#introGrad)" />
              <rect x="1" y="22" width="7" height="16" rx="2.5" fill="url(#introGrad)" opacity="0.7" />
              <rect x="46" y="18" width="8" height="24" rx="3" fill="url(#introGrad)" />
              <rect x="52" y="22" width="7" height="16" rx="2.5" fill="url(#introGrad)" opacity="0.7" />
            </svg>
            <div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, letterSpacing: 4,
                color: 'var(--text-primary)', lineHeight: 1,
              }}>STEEL BODY</div>
              <div style={{
                fontSize: 10, letterSpacing: 3, color: 'var(--text-muted)', marginTop: 5,
              }}>FORGE YOUR BODY · BREAK YOUR LIMITS</div>
            </div>
          </div>

          <p style={{
            fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.75,
            margin: '14px 0 20px', maxWidth: 460,
          }}>
            오늘 든 무게를 적으면 그게 경험치가 된다.<br />
            기록이 쌓일수록 레벨이 오르고, 오르는 게 눈에 보이면 계속하게 된다.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/workout')}
              className="btn-primary"
              style={{ width: 'auto', padding: '12px 26px' }}
            >{started ? '오늘 운동 기록하기' : '첫 기록 남기기'}</button>
            <button
              onClick={() => navigate('/routine')}
              className="btn-secondary"
              style={{ padding: '12px 22px' }}
            >루틴부터 고르기</button>
          </div>
        </div>
      </div>

      {/* ─── 지금 내 상태 ─── */}
      {started ? (
        <div style={{ display: 'flex', gap: 6, marginBottom: 30, flexWrap: 'wrap' }}>
          <Stat label="총 운동" value={totalWorkouts.toLocaleString()} unit="회" />
          <Stat label="이번 주" value={weekDays} unit={`/7`} />
          <Stat label="레벨" value={lv.level} unit={`/${MAX_LEVEL}`} />
          <Stat label="최근 체중" value={latest ? latest.weight : '—'} unit={latest ? 'kg' : ''} dim={!latest} />
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 30, textAlign: 'center', padding: '18px 16px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            아직 기록이 없습니다. 한 번만 남기면 여기에 내 숫자가 뜹니다.
          </div>
        </div>
      )}

      {/* ─── 어떻게 굴러가나 ─── */}
      <div className="section-title">
        <div className="accent-bar" />
        어떻게 굴러가나
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 30, flexWrap: 'wrap' }}>
        {[
          { n: '01', t: '적는다', d: '운동과 인바디를 남긴다' },
          { n: '02', t: '쌓인다', d: 'EXP 와 티켓이 붙는다' },
          { n: '03', t: '오른다', d: '레벨과 등급이 올라간다' },
        ].map(s => (
          <div key={s.n} className="card" style={{ flex: '1 1 120px', padding: 14 }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 13,
              letterSpacing: 2, color: 'var(--accent)', marginBottom: 6,
            }}>{s.n}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{s.t}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>{s.d}</div>
          </div>
        ))}
      </div>

      {/* ─── 기능 ─── */}
      <div className="section-title">
        <div className="accent-bar" />
        무엇을 할 수 있나
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 30 }}>
        {FEATURES.map(f => (
          <div
            key={f.path}
            className="card clickable"
            onClick={() => navigate(f.path)}
            style={{ display: 'flex', gap: 13, alignItems: 'flex-start', padding: 14 }}
          >
            <div style={{ fontSize: 21, lineHeight: 1.2, flexShrink: 0 }}>{f.icon}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3,
              }}>{f.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65 }}>{f.desc}</div>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 15, flexShrink: 0 }}>›</div>
          </div>
        ))}
      </div>

      {/* ─── 레벨 체계 ─── */}
      <div className="section-title">
        <div className="accent-bar" />
        레벨은 세 단계로 쌓인다
      </div>
      <div className="card" style={{ marginBottom: 30, paddingTop: 2 }}>
        <Stage
          badge="🌱" color="var(--accent)" title="일반"
          range={`LV 0 ~ ${MAX_LEVEL}`}
          sub="운동과 인바디로 얻는 EXP 로 오른다. 처음부터 열려 있다"
          tiers={30} first="입문" last="신화"
        />
        <Stage
          badge={TRANSCEND.icon} color="#ffffff" title={TRANSCEND.name.ko}
          range={`0 ~ ${TRANSCEND.maxLevel}`}
          sub={`LV ${MAX_LEVEL} 을 찍으면 열린다. 1레벨당 ${(TRANSCEND.expPerLevel / 1e12).toLocaleString()}조 EXP`}
          tiers={TRANSCEND_TIERS.length}
          first={TRANSCEND_TIERS[0].name.ko}
          last={TRANSCEND_TIERS[TRANSCEND_TIERS.length - 1].name.ko}
        />
        <Stage
          badge={GENESIS.icon} color={GENESIS.color} title={GENESIS.name.ko}
          range={`0 ~ ${GENESIS.maxLevel}`}
          sub={`${TRANSCEND.name.ko} 만렙에서 열린다. 일반 EXP 가 아니라 ⚡ 울트라 레전드 EXP 로 오른다`}
          tiers={GENESIS_TIERS.length}
          first={GENESIS_TIERS[0].name.ko}
          last={GENESIS_TIERS[GENESIS_TIERS.length - 1].name.ko}
        />
        <div style={{
          borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 2,
          fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7,
        }}>
          단계가 열리면 <b style={{ color: 'var(--text-secondary)' }}>0부터 다시</b> 시작한다.
          한 숫자로 끝까지 세면 자릿수가 뭉개져서, 마지막 단계는 아예 다른 값으로 센다
        </div>
      </div>

      {/* ─── 티켓과 게임 ─── */}
      <div className="section-title">
        <div className="accent-bar" />
        기록하면 티켓이 나온다
      </div>
      <div className="card" style={{ marginBottom: 30 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 14 }}>
          {ticketLine}. 모은 티켓으로 돌리면 EXP 가 한 번에 크게 들어온다.
          <br />운동을 계속할 이유를 하나 더 만들어 두는 장치다.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[
            { icon: '🎰', name: '파칭코',  cost: '🎫 1장',   d: '한 판씩. 낮은 확률로 크게 터진다' },
            { icon: '🪜', name: '사다리',  cost: `🎫 ${LADDER.cost}장`, d: '판돈이 큰 대신 기대값은 파칭코와 같다' },
            { icon: '🥏', name: '미니게임', cost: '무료',    d: '원판을 주워 모으면 티켓으로 바꾼다' },
            { icon: '🎟️', name: '교환소',  cost: `🎫 ${UL_TICKET.rate}장`, d: '울트라 티켓으로 바꿔 개벽 파칭코를 돌린다' },
          ].map(g => (
            <div key={g.name} style={{
              display: 'flex', alignItems: 'center', gap: 11,
              background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', padding: '10px 12px',
            }}>
              <span style={{ fontSize: 17, flexShrink: 0 }}>{g.icon}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{g.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.55 }}>{g.d}</div>
              </div>
              <span style={{
                fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0,
              }}>{g.cost}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.7 }}>
          확률표는 어느 화면에서나 <b style={{ color: 'var(--text-secondary)' }}>운영 확률</b>을 그대로 보여준다.
          부풀린 개발용 값은 경고와 함께 따로 적는다
        </div>
      </div>

      {/* ─── 제보함 (같은 페이지 아래쪽) ─── */}
      <div style={{
        borderTop: '1px solid var(--border)', paddingTop: 26, marginBottom: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <span style={{ fontSize: 21 }}>📮</span>
          <h3 style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 21, letterSpacing: 2.5,
            color: 'var(--accent)', margin: 0,
          }}>제보함</h3>
        </div>
        <p style={{
          fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.7,
        }}>
          안 되는 것, 이상한 것, 있었으면 하는 것을 알려주세요. 확인하면 여기에 답을 답니다.
        </p>
        <ReportPreview embedded />
      </div>

      {/* ─── 마무리 ─── */}
      <div style={{
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        background: 'var(--bg-secondary)', padding: '24px 20px',
        textAlign: 'center', marginBottom: 8,
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2.5,
          color: 'var(--text-primary)', marginBottom: 8,
        }}>오늘 것부터</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.75, marginBottom: 18 }}>
          {/* 인바디만 넣고 운동 기록이 아직 0 인 경우가 있다 — 그때 "0회 기록했습니다" 는 이상하다 */}
          {totalWorkouts > 0
            ? `지금까지 ${totalWorkouts.toLocaleString()}회 기록했습니다. 오늘 것도 남기면 이어집니다.`
            : '완벽한 계획보다 오늘 한 세트가 먼저입니다.'}
        </div>
        <button
          onClick={() => navigate('/workout')}
          className="btn-primary"
          style={{ width: 'auto', padding: '12px 30px' }}
        >운동 기록하기</button>
      </div>
    </div>
  );
}
