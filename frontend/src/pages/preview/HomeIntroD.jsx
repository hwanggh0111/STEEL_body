import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntroStats, FEATURES, LEVEL_ROWS, TICKET_LINE } from './introData';
import ReportPreview from './ReportPreview';
import { getSchedules } from '../../components/MaintenanceScreen';
import pkg from '../../../package.json';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 최근 바뀐 것 — 손으로 적지 않는다.
// scripts/gen-changelog.mjs 가 git 커밋에서 뽑아 changelog.json 을 만들고, dev·build 앞에서 자동으로 돈다.
// 커밋으로 설명이 안 되는 것은 data/notices.json 에 손으로 적는다. 둘은 feed.jsx 에서 한 목록으로 합쳐진다.
import { FEED, FeedList } from './feed';

const CHANGES_SHOWN = 6;

// 자주 묻는 것 — 문의로 같은 질문이 반복되면 여기로 올린다
const FAQ = [
  {
    q: '티켓은 어떻게 모으나요',
    a: '운동 3회당 1장, 인바디 1회당 1장 나옵니다. 미니게임에서 원판을 주워 모아도 바꿀 수 있습니다.',
  },
  {
    q: '초월 · 개벽은 언제 열리나요',
    a: '일반 LV 149 를 찍으면 초월이 열리고, 초월 만렙에서 개벽이 열립니다. 단계가 열리면 레벨은 0부터 다시 시작합니다.',
  },
  {
    q: '확률표에 뜨는 숫자를 믿어도 되나요',
    a: '표에 뜨는 값은 언제나 실제로 돌아가는 운영 확률입니다. 개발용으로 부풀린 값이 있을 때는 경고와 함께 따로 적습니다.',
  },
  {
    q: '기록이 사라지면 어떻게 하나요',
    a: '기록은 서버에 저장됩니다. 기기를 바꿔도 같은 계정으로 로그인하면 그대로 있습니다. 안 보이면 아래 제보함에 남겨주세요.',
  },
];

function Sec({ children }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 3, color: 'var(--text-muted)', marginBottom: 20 }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// D안 — 문장형 (에디토리얼)
//
// 표도 카드도 거의 쓰지 않는다. 큰 글씨와 문장으로 읽히게 한다.
// 내 숫자를 칸에 넣지 않고 문장 안에 박아 넣는 게 이 안의 성격이다.
// ─────────────────────────────────────────────────────────────

const Num = ({ children }) => (
  <span style={{
    fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35em',
    letterSpacing: 1, color: 'var(--accent)',
  }}>{children}</span>
);

export default function HomeIntroD() {
  const navigate = useNavigate();
  const s = useIntroStats();
  const [openFaq, setOpenFaq] = useState(null);

  // 점검은 진짜 스케줄을 읽는다. 잡힌 게 없으면 이 구역 자체가 안 나온다 —
  // "예정된 점검 없음" 을 굳이 알릴 이유가 없다
  let schedules = [];
  try { schedules = getSchedules() || []; } catch { schedules = []; }

  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{
        fontSize: 11.5, color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 40,
      }}>시안 D · 문장형 — 아직 앱에 붙어 있지 않습니다</div>

      {/* 한 문장으로 여는 히어로 */}
      <div style={{ marginBottom: 40 }}>
        <p style={{
          fontSize: 27, lineHeight: 1.45, color: 'var(--text-primary)',
          fontWeight: 300, margin: 0, letterSpacing: -0.3,
        }}>
          오늘 든 무게를 적으면<br />
          그게 <span style={{ color: 'var(--accent)', fontWeight: 600 }}>경험치</span>가 된다.
        </p>
        <p style={{
          fontSize: 14.5, lineHeight: 1.85, color: 'var(--text-secondary)',
          margin: '20px 0 0', maxWidth: 380,
        }}>
          운동과 인바디를 기록하는 앱이다. 그게 전부다.
        </p>
      </div>

      {/* 점검 예정 — 잡혀 있을 때만 나온다 */}
      {schedules.length > 0 && (
        <div style={{
          borderLeft: '2px solid var(--warning)', paddingLeft: 18, marginBottom: 40,
        }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: 'var(--warning)', marginBottom: 8 }}>점검 예정</div>
          {schedules.slice(0, 3).map((sc, i) => {
            const end = sc.startHour * 60 + sc.startMin + sc.durationMin;
            const hhmm = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            return (
              <div key={i} style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.85, fontWeight: 300 }}>
                {sc.days?.length ? `매주 ${sc.days.map(d => DAY_LABELS[d]).join('·')} ` : ''}
                {hhmm(sc.startHour, sc.startMin)} – {hhmm(Math.floor(end / 60) % 24, end % 60)}
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}> · {sc.reason}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 내 이야기 — 숫자를 문장에 박되, 한 줄에 한 문장씩.
          한 문단으로 이어 붙이면 기록이 쌓일수록 첫 화면이 글자벽이 된다.
          줄을 끊어두면 1,240회가 되든 12만회가 되든 줄 수는 그대로다. */}
      <div style={{
        borderLeft: '2px solid var(--accent)', paddingLeft: 18, margin: '0 0 40px',
      }}>
        {s.totalWorkouts > 0 ? (
          <div style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 300 }}>
            <div style={{ lineHeight: 1.9 }}>지금까지 <Num>{s.totalWorkouts.toLocaleString()}</Num>회 기록했다.</div>
            <div style={{ lineHeight: 1.9 }}>이번 주는 <Num>{s.weekDays}</Num>일 했다.</div>
            <div style={{ lineHeight: 1.9 }}>
              레벨은 <Num>{s.lv.level}</Num>
              {s.lv.tierInfo?.name?.ko && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}> · {s.lv.tierInfo.name.ko}</span>
              )}
              {s.latest && <>, 최근 체중은 <Num>{s.latest.weight}</Num>kg.</>}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 16, lineHeight: 1.95, color: 'var(--text-primary)', margin: 0, fontWeight: 300 }}>
            아직 기록이 없다.<br />오늘 한 세트만 남겨도 여기에 문장이 생긴다.
          </p>
        )}
      </div>

      <button
        onClick={() => navigate('/workout')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2,
          color: 'var(--accent)', borderBottom: '2px solid var(--accent)',
          paddingBottom: 4, marginBottom: 44,
        }}
      >기록하러 가기 →</button>

      {/* 기능 — 번호 매긴 목록 */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          fontSize: 11, letterSpacing: 3, color: 'var(--text-muted)', marginBottom: 20,
        }}>무엇을 할 수 있나</div>
        {FEATURES.map((f, i) => (
          <div
            key={f.path}
            onClick={() => navigate(f.path)}
            style={{
              display: 'flex', gap: 16, alignItems: 'baseline', cursor: 'pointer',
              padding: '13px 0', borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 13,
              color: 'var(--text-muted)', width: 20, flexShrink: 0,
            }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 500 }}>{f.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto', textAlign: 'right' }}>{f.short}</span>
          </div>
        ))}
      </div>

      {/* 레벨 — 문장 + 얇은 표 */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          fontSize: 11, letterSpacing: 3, color: 'var(--text-muted)', marginBottom: 20,
        }}>레벨은 세 단계로 쌓인다</div>
        {LEVEL_ROWS.map(r => (
          <div key={r.name} style={{
            padding: '14px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 2,
                color: 'var(--text-primary)', width: 52, flexShrink: 0,
              }}>{r.name}</span>
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 1, color: 'var(--accent)',
              }}>{r.lo}–{r.hi}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 'auto' }}>{r.opens}</span>
            </div>
            {/* 등급 이름 — 이 앱에서 제일 분위기 있는 재료라 빼지 않는다.
                이름과 개수 모두 실제 등급표에서 읽는다 */}
            <div style={{
              fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 7, letterSpacing: 0.3,
            }}>
              {r.first}
              <span style={{ color: 'var(--text-muted)', margin: '0 7px' }}>—</span>
              {r.last}
              <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}> · {r.tiers}등급</span>
            </div>
          </div>
        ))}
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, marginTop: 16 }}>
          단계가 열리면 0부터 다시 시작한다.
          한 숫자로 끝까지 세면 자릿수가 뭉개져서, 마지막 단계는 아예 다른 값으로 센다.
        </p>
      </div>

      {/* 티켓 — 한 문단 */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          fontSize: 11, letterSpacing: 3, color: 'var(--text-muted)', marginBottom: 20,
        }}>기록하면 티켓이 나온다</div>
        <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.9, margin: 0 }}>
          {TICKET_LINE}. 모아서 파칭코나 사다리를 돌리면 EXP 가 한 번에 크게 들어온다.
          운동을 계속할 이유를 하나 더 만들어 두는 장치다.
          확률표는 언제나 운영 확률을 그대로 보여준다.
        </p>
      </div>

      {/* 최근 바뀐 것 — 공지사항이 하던 일 중 쓸모 있던 부분 */}
      <div style={{ marginBottom: 40 }}>
        <Sec>최근 바뀐 것</Sec>
        <FeedList items={FEED.slice(0, CHANGES_SHOWN)} />

        {/* 여기 여섯 줄만 보여준다. 나머지는 공지함에 있다 */}
        <button
          onClick={() => navigate('/preview/notices')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            marginTop: 16, color: 'var(--accent)', fontSize: 13.5,
          }}
        >공지함에서 전부 보기 ({FEED.length}) →</button>
      </div>

      {/* 자주 묻는 것 — 같은 질문이 문의로 반복되면 여기로 올린다 */}
      <div style={{ marginBottom: 40 }}>
        <Sec>자주 묻는 것</Sec>
        {FAQ.map((f, i) => {
          const on = openFaq === i;
          return (
            <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <div
                onClick={() => setOpenFaq(on ? null : i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 0', cursor: 'pointer',
                }}
              >
                <span style={{
                  fontSize: 15, color: on ? 'var(--accent)' : 'var(--text-primary)',
                  fontWeight: 400, flex: 1,
                }}>{f.q}</span>
                <span style={{
                  color: 'var(--text-muted)', fontSize: 15, flexShrink: 0,
                  transform: on ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s',
                }}>+</span>
              </div>
              {on && (
                <div style={{
                  fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.85,
                  padding: '0 0 16px', maxWidth: 440,
                }}>{f.a}</div>
              )}
            </div>
          );
        })}
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.7 }}>
          찾는 게 없으면 아래 제보함에 <b style={{ color: 'var(--text-secondary)' }}>문의</b>로 남겨주세요.
        </div>
      </div>

      {/* 제보함 — 이 페이지의 본래 첫 내용이라 링크로 내보내지 않는다.
          다만 펼쳐두면 폼과 목록이 페이지의 절반을 먹는다. 필요할 때만 연다 */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 26 }}>
        <Sec>제보함</Sec>
        <p style={{
          fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.85,
          margin: '0 0 22px', fontWeight: 300,
        }}>
          안 되는 게 있으면 알려주세요.<br />
          확인하고 여기에 답을 답니다.
        </p>
        <ReportPreview embedded />
      </div>

      {/* 앱 정보 — 표로 벌려두면 세 줄짜리가 여섯 줄이 된다. 한 줄로 붙인다.
          맨 아래 로고 줄은 지웠다 — 화면 위 헤더에 이미 있다 */}
      <div style={{
        borderTop: '1px solid var(--border)', marginTop: 40, paddingTop: 20,
        fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.9,
      }}>
        <div>v{pkg.version} · 다크 전용 · 기록은 서버에, 게임 진행은 이 기기에</div>
        <div>브라우저 메뉴의 <b style={{ color: 'var(--text-secondary)' }}>홈 화면에 추가</b>를 누르면 앱처럼 열립니다</div>
      </div>
    </div>
  );
}
