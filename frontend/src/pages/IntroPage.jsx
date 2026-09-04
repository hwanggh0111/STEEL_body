import { useNavigate } from 'react-router-dom';
import { useIntroStats, FEATURES } from './support/introData';
import NavIcon from '../components/NavIcon';
import pkg from '../../package.json';

// 앱 소개 — 「이 앱은」.
//
// **고객센터 안에 접혀 있었다.** 8/26 에 고객센터를 다시 짜면서 소개를 지우지 않고
// 맨 아래로 접어 뒀는데, 그때 적어둔 이유가 이랬다 — 「볼일을 보러 온 사람 앞에
// 소개를 세워둔 것이다」. 맞는 판단이었다. 그런데 **접어서 같은 화면에 두면 여전히
// 한 화면이 두 가지 일을 한다** — 고객센터는 도와주는 자리고, 소개는 보여주는 자리다.
//
// 5차에 갈랐다 (2026-09-04). 고객센터에는 **안 되는 것을 말하고 · 답을 찾고 ·
// 뭐가 바뀌었나 보는 것**만 남고, 소개는 여기다.
//
// **처음 온 사람이 읽는 자리다.** 그래서 큰 글씨와 문장으로 간다 — 표도 카드도
// 거의 쓰지 않는다. 내 숫자를 칸에 넣지 않고 문장 안에 박아 넣는 것이 이 페이지의
// 성격이고, 그 성격은 고객센터에 있을 때부터 그랬다.

function Num({ children }) {
  return (
    <span style={{
      fontFamily: "'Bebas Neue', sans-serif", fontSize: 26,
      color: 'var(--accent)', letterSpacing: 1, verticalAlign: -1,
    }}>{children}</span>
  );
}

function Sec({ children }) {
  return (
    <div style={{
      fontSize: 11, letterSpacing: 3, color: 'var(--text-muted)',
      marginBottom: 14, textTransform: 'uppercase',
    }}>{children}</div>
  );
}

export default function IntroPage() {
  const navigate = useNavigate();
  const s = useIntroStats();

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        이 앱은
      </div>

      <p style={{
        fontSize: 24, lineHeight: 1.45, color: 'var(--text-primary)',
        fontWeight: 300, margin: '0 0 18px', letterSpacing: -0.3,
      }}>
        쉬웠던 날은 없었다.<br />
        그래서 전부 <span style={{ color: 'var(--accent)', fontWeight: 600 }}>값</span>이 있다.
      </p>
      <p style={{
        fontSize: 14.5, lineHeight: 1.85, color: 'var(--text-secondary)',
        margin: '0 0 32px', maxWidth: 380,
      }}>
        빠진 날까지 전부 남는다.<br />
        언젠가 처음부터 읽게 된다.
      </p>

      {/* 내 이야기 — 숫자를 문장에 박되, 한 줄에 한 문장씩.
          한 문단으로 이어 붙이면 기록이 쌓일수록 글자벽이 된다 */}
      <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 18, marginBottom: 32 }}>
        {s.totalWorkouts > 0 ? (
          <div style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 300 }}>
            <div style={{ lineHeight: 1.9 }}>지금까지 <Num>{s.totalWorkouts.toLocaleString()}</Num>회 적었다.</div>
            <div style={{ lineHeight: 1.9 }}>
              {s.weekDays > 0
                ? <>이번 주만 <Num>{s.weekDays}</Num>일 나왔다.</>
                : <>이번 주는 오늘이 첫 날이 된다.</>}
            </div>
            {s.latest && (
              <div style={{ lineHeight: 1.9 }}>최근 체중은 <Num>{s.latest.weight}</Num>kg.</div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 16, lineHeight: 1.95, color: 'var(--text-primary)', margin: 0, fontWeight: 300 }}>
            누구의 첫 줄도 대단하지 않았다.<br />한 세트면 충분하다.
          </p>
        )}
      </div>

      {/* 무엇을 할 수 있나 — 번호 매긴 목록.
          **가는 주소는 5차 구조를 따른다** — 목록이 옛 주소를 가리키면 소개를 읽고
          눌러본 사람이 없어진 자리로 간다 */}
      <div style={{ marginBottom: 8 }}>
        <Sec>무엇을 할 수 있나</Sec>
        {FEATURES.map((f, i) => (
          <div
            key={f.path + f.name}
            onClick={() => navigate(f.path, f.state ? { state: f.state } : undefined)}
            style={{
              display: 'flex', gap: 16, alignItems: 'baseline', cursor: 'pointer',
              padding: '13px 0', borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 13,
              color: 'var(--text-muted)', width: 20, flexShrink: 0,
            }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{ color: 'var(--text-muted)', display: 'flex', flexShrink: 0, alignSelf: 'center' }} aria-hidden="true">
              <NavIcon name={f.icon} size={17} />
            </span>
            <span style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 500 }}>{f.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto', textAlign: 'right' }}>{f.short}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/train')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2,
          color: 'var(--accent)', borderBottom: '2px solid var(--accent)',
          paddingBottom: 4, marginTop: 26,
        }}
      >운동하러 가기 →</button>

      {/* 앱 정보 — 표로 벌려두면 세 줄짜리가 여섯 줄이 된다. 한 줄로 붙인다 */}
      <div style={{
        borderTop: '1px solid var(--border)', marginTop: 34, paddingTop: 20,
        fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.9,
      }}>
        <div>v{pkg.version} · 다크 전용 · 기록은 서버에 남습니다 (기기를 바꿔도 그대로)</div>
        <div>브라우저 메뉴의 <b style={{ color: 'var(--text-secondary)' }}>홈 화면에 추가</b>를 누르면 앱처럼 열립니다</div>
      </div>
    </div>
  );
}
