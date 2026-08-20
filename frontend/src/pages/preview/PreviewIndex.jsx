import { useNavigate } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────
// 시안 목록 — /preview
//
// 만들어 둔 시안을 한자리에서 고른다. 이것도 앱에 붙어 있지 않다.
// 결정이 끝나면 이 파일과 pages/preview/ 를 통째로 지우면 흔적이 없다.
// ─────────────────────────────────────────────────────────────

const VERSIONS = [
  {
    key: 'A', path: '/preview/homepage', name: '소개 + 제보함',
    tag: '한 페이지에 다', height: '3,984px',
    desc: '히어로 · 내 숫자 · 굴러가는 방식 · 기능 6개 · 레벨 3단계 · 티켓 · 제보함 · 마무리를 순서대로. 처음 보는 사람에게 앱을 설명하는 얼굴.',
    good: '설명이 가장 충분하다',
    bad: '길다. 제보하러 온 사람이 소개를 다 지나쳐야 한다',
  },
  {
    key: 'B', path: '/preview/homepage-b', name: '깔끔한 쪽',
    tag: '선과 여백만', height: '1,816px',
    desc: '상자와 아이콘을 걷어내고 얇은 선과 여백으로만 나눈다. 오렌지는 버튼과 숫자에만. 제보함은 접어둔다.',
    good: '짧고 정돈돼 있다',
    bad: '히어로가 심심하다. 등급 이름 같은 재미 요소가 빠졌다',
  },
  {
    key: 'C', path: '/preview/homepage-c', name: '대시보드형',
    tag: '오늘 뭐 할 차례', height: '1,290px',
    desc: '소개를 거의 하지 않는다. 오늘 했는지 · 이번 주 7칸 · 레벨 진행바 · 바로 가기 타일. 매일 여는 사람의 첫 화면.',
    good: '매일 쓰기에 가장 쓸모 있다',
    bad: '홈 탭과 역할이 가장 많이 겹친다',
  },
  {
    key: 'D', path: '/preview/homepage-d', name: '문장형',
    tag: '읽히는 페이지', height: '1,674px',
    desc: '카드를 거의 안 쓴다. 큰 문장으로 열고, 내 숫자를 칸이 아니라 문장 안에 박아 넣는다. 기능은 번호 매긴 목록.',
    good: '분위기가 가장 뚜렷하다',
    bad: '정보를 훑기보다 읽어야 한다. 급할 때 느리다',
  },
  {
    key: 'E', path: '/preview/homepage-e', name: '타일형',
    tag: '고르는 페이지', height: '1,288px',
    desc: '전부 같은 크기 타일. 오늘 · 숫자 4개 · 기능 6개 · 레벨 · 티켓 · 제보함이 격자로 놓인다. 앱 런처에 가깝다.',
    good: '손가락으로 고르기 가장 쉽다',
    bad: '설명할 자리가 없다. 처음 온 사람은 뭔지 모른다',
  },
];

export default function PreviewIndex() {
  const navigate = useNavigate();

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 3,
          color: 'var(--accent)', margin: '0 0 6px',
        }}>시안 목록</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
          공지사항이 있던 자리에 넣을 페이지 후보입니다.
          <b style={{ color: 'var(--text-primary)' }}> 아직 STEEL BODY 에는 아무것도 안 붙였습니다</b> —
          탭에도 검색에도 없고, 운영 빌드에도 안 담깁니다.
        </p>
      </div>

      {VERSIONS.map(v => (
        <div
          key={v.key}
          className="card clickable"
          onClick={() => navigate(v.path)}
          style={{ marginBottom: 10, padding: 16 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1,
              color: 'var(--accent)', width: 20,
            }}>{v.key}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{v.name}</span>
            <span style={{
              fontSize: 10.5, color: 'var(--text-muted)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '2px 7px',
            }}>{v.tag}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{v.height}</span>
          </div>

          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>
            {v.desc}
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, lineHeight: 1.6 }}>
            <div style={{ flex: '1 1 130px' }}>
              <span style={{ color: 'var(--success)' }}>좋은 점</span>
              <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{v.good}</div>
            </div>
            <div style={{ flex: '1 1 130px' }}>
              <span style={{ color: 'var(--warning)' }}>걸리는 점</span>
              <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{v.bad}</div>
            </div>
          </div>
        </div>
      ))}

      <div
        className="card clickable"
        onClick={() => navigate('/preview/report')}
        style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <span style={{ fontSize: 20 }}>📮</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>제보함만 따로 보기</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            A · B 안에 얹혀 있는 것과 같은 화면입니다
          </div>
        </div>
        <span style={{ color: 'var(--text-muted)' }}>›</span>
      </div>

      <div style={{
        marginTop: 22, fontSize: 11.5, color: 'var(--text-muted)',
        textAlign: 'center', lineHeight: 1.8,
      }}>
        섞고 싶은 부분을 찍어주시면 그대로 맞춥니다.<br />
        넣으라고 하시면 그때 STEEL BODY 에 붙입니다.
      </div>
    </div>
  );
}
