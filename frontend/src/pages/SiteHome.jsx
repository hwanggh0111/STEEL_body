import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoMark, LogoWord } from '../components/Logo';
import NavIcon from '../components/NavIcon';
import client from '../api/client';
// **사전은 여기서 안 들여온다** (2026-10-16). 이 화면이 사전에서 쓰는 것은
// 부위 이름 일곱뿐인데, 그걸 쓰려고 **운동 사전 조각 22KB(gzip 10.2KB)를 첫 화면에서
// 같이 받고 있었다.** 여기는 로그인도 앱 설치도 없이 처음 오는 사람이 보는 자리다.
// 사전은 **칠 때** 받는다 (아래 `useEffect`).
import { PARTS, isPartName } from '../data/partNames';
// 증거 셋. **스크린샷을 올리지 않는다** — 그림을 올려두면 화면을 고칠 때마다 옛말이
// 된다. 셋 다 앱의 조각·계산을 그대로 쓴다 (2026-10-06 에 몸 지도로 정한 방식)
import MapPreview from '../components/site/MapPreview';
import FinishPreview from '../components/site/FinishPreview';
import WallPreview from '../components/site/WallPreview';
// 머리 오른쪽에 무엇을 띄울지, 그리고 **앱 안으로 가는 길을 정직하게 적는 데** 쓴다 —
// 들어와 있으면 「열어보기」, 아직이면 「가입하고 열기」다 (2026-10-20)
import { useAuthStore } from '../store/authStore';
// 소식 목록(`feedList.json`)은 **여기서 바로 안 들여온다.**
// 아래 `useEffect` 가 화면이 뜬 뒤에 받아온다 — 까닭은 그 자리에 적어뒀다

// 홈페이지 — **앱이 아니라 웹사이트다.**
//
// 2026-09-16 에 두 번 고쳤다. 아침 판은 껍데기만 웹사이트였고 **안에 든 것은
// 커뮤니티 하나**였다 — 커뮤니티를 걷으면서 통째로 비었다. 저녁에 소개 글 한 장으로
// 다시 지었고, 「포털처럼 여러 칸으로」가 다음 주문이어서 상자 일곱을 쌓았다.
//
// ── 2026-10-20 에 **증거 순서로 다시 짰다** ──
//
// 출시를 앞두고 보니 넷이 틀려 있었다 (시안을 내고 넷 다 고쳤다) —
//
//   ① **누를 수 없게 생긴 단추가 많았다.** 바로가기 여섯 칸과 「내 몸 지도 보기」는
//      `PrivateRoute` 안의 주소로 간다. 로그인하면 그 자리로 데려가주긴 하지만
//      (`PrivateRoute` 가 `from` 에 담아둔다), **계정이 없는 사람에게는 설명 없는
//      로그인 벽**이다. 보러 온 사람을 문 앞에서 돌려세우는 자리가 일곱이었다
//   ② **첫 화면에 네 덩이가 따로 말했다** — 제목 · 미리보기 카드 · 찾기 칸 ·
//      바로가기 여섯. 넷이 각각 테두리를 둘러서 무엇부터 읽을지가 안 정해진다
//   ③ **길잡이가 두 벌이었다** — 머리 아래 칸 이름 여덟과 오른쪽 따라오는 점 여덟이
//      같은 일을 했다. 처음 온 사람은 아직 길을 찾을 단계가 아니다
//   ④ **두 번째 자리가 운동 검색**이었다. 설치 전 사람에게 가장 안 급한 것이다
//
// 그래서 —
//
//   · **상자(카드)를 걷고 라벨 + 금실 한 줄로 가른다**(`Band`). 테두리가 사라지면
//     덩이가 아니라 리듬이 된다. 카드는 **「시작하기」 하나만** 남긴다 — 화면에
//     카드가 하나면 그것이 눈에 띈다
//   · **증거를 셋으로 늘린다** — 몸 지도 · 결산 · 1년 열두 판. 이 앱에서 그림이
//     가장 좋은 둘(결산 · 벽)을 여태 **안 보여주고 글로 설명**하고 있었다
//   · **바로가기 여섯을 걷는다.** 「이 앱이 하는 것」 여섯 줄이 같은 여섯 곳을
//     가리키는데 **설명까지 달려 있다.** 같은 일을 하는 자리가 두 벌이었다
//   · **앱으로 가는 길에는 그 말을 적는다** — 로그인 전이면 「가입하고 열기 ›」다.
//     길을 막는 것이 아니라 **무엇이 일어날지 먼저 말하는 것**이다
//   · **찾기를 맨 아래로 내린다.** 대신 「가입 전에도 찾아볼 수 있다」를 적는다 —
//     이 화면에서 **진짜로 끝까지 되는** 몇 안 되는 것이라 그게 값이다
//
// **로그인 없이 열린다.** 웹사이트인데 로그인해야 보이면 웹사이트가 아니다.
// 여기서 끝나는 것은 셋이다 —
//   · 소식은 뽑아둔 목록 파일(`feedList.json`)에서 읽는다
//   · 사진은 `/api/site-photos` 에서 받는다 (보는 쪽은 로그인이 없다)
//   · 찾기는 **이 화면에서** 끝난다. 운동 사전이 앱에 같이 실려 오는 파일이라
//     서버도 로그인도 필요 없다 — 기록하려고 누를 때 비로소 앱으로 간다
//
// **지어내지 않는다.** 쓰는 사람 수도 후기도 별점도 없다 — 아직 배포도 안 한 앱이다.
// 증거 셋은 전부 **예시**라고 적어둔다(라벨 오른쪽). 남의 기록을 내 것처럼
// 보이게 하는 것은 이 앱이 안 하기로 한 것 중 하나다.

const MAX = 860;

// 칸 하나 — **카드가 아니다.** 라벨 한 줄과 흐려지는 실선으로 가른다 (2026-10-20).
//
// 앞서는 상자(`Box`)였다. 테두리 · 그라디언트 · 둥근 모서리가 칸마다 붙어서
// **일곱 덩이가 각각 「나는 따로다」**라고 말했다. 가르는 일은 **선 하나로 충분하고**,
// 테두리를 걷으면 그 자리에 숨이 생긴다.
//
// `note` 는 라벨 오른쪽 끝의 작은 글이다 — 증거 칸의 「예시」가 거기 붙는다.
function Band({ id, title, note, children, style }) {
  return (
    <section id={id} style={{ paddingTop: 26, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 15, letterSpacing: 2.2,
          color: 'var(--accent-low)', margin: 0, fontWeight: 400, whiteSpace: 'nowrap',
        }}>{title}</h2>
        {/* 실선은 **흐려지며 나간다.** 양끝이 또렷한 선은 표의 줄이고, 흐려지는 선은 결이다 */}
        <span style={{
          flexGrow: 1, height: 1,
          background: 'linear-gradient(90deg, var(--border-hover), transparent)',
        }} />
        {note && (
          <span style={{ flexShrink: 0, fontSize: 10.5, color: 'var(--text-muted)' }}>{note}</span>
        )}
      </div>
      {children}
    </section>
  );
}

export default function SiteHome() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [photos, setPhotos] = useState([]);
  const [shot, setShot] = useState(null);     // 크게 볼 사진

  // 관리자가 걸어둔 사진. **못 받아오면 그 칸을 아예 안 그린다** —
  // 「사진이 없습니다」는 보러 온 사람에게 아무 쓸모가 없다
  useEffect(() => {
    client.get('/site-photos')
      .then(({ data }) => setPhotos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // 소식 — 뽑아둔 목록(`feedList.json`)에서 다섯 줄.
  //
  // ── 화면이 뜬 뒤에 받아온다 ── (2026-09-17 · 10/6 에 파일을 갈랐다)
  //
  // 원본 둘(`notices.json` + `changelog.json`)을 위에서 들여오면 **첫 화면에 같이
  // 딸려 온다** — 재보니 83,999B(gzip 29,451B)였고 무게의 거의 전부가 「자세히」의
  // `detail` 이다. **이 화면은 그것을 한 줄도 안 쓴다.** 뽑아둔 목록은 3,027B
  // (gzip 1,105B)고, 어긋나면 `npm run checkfeed` 가 잡는다.
  const [news, setNews] = useState([]);

  useEffect(() => {
    let alive = true;
    // 차례와 걸러내기는 **뽑을 때 이미 했다**(`gen-feed.mjs`) — 화면에서 또 하지 않는다
    import('../data/feedList.json').then((mod) => {
      if (!alive) return;
      const feed = mod.default || mod;
      setNews((feed?.items || []).slice(0, 5));
    // 못 받아와도 화면은 그대로 돈다 — 소식 칸만 안 그려진다
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const loggedIn = useAuthStore((s) => s.isLoggedIn);

  const go = (to) => navigate(to);

  // 머리 높이를 **재서** 쓴다. 주소에 `#site-find` 처럼 자리표를 달고 들어오는 사람이
  // 있어서 그만큼 비워야 **제목이 머리 밑에 깔리지 않는다** — 숫자를 손으로 적어두면
  // 머리를 한 줄 고칠 때마다 어긋난다.
  //
  // **머리의 칸 이름 줄과 따라오는 점은 걷었다** (2026-10-20 · 위 머리글 ③).
  const headRef = useRef(null);
  const [headH, setHeadH] = useState(60);
  useEffect(() => {
    const el = headRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setHeadH(el.offsetHeight || 60));
    ro.observe(el);
    setHeadH(el.offsetHeight || 60);
    return () => ro.disconnect();
  }, []);

  const anchorStyle = { scrollMarginTop: headH + 14 };

  // ── 찾기는 **이 화면에서** 한다 ── (2026-09-16)
  //
  // 앞서는 「찾기」가 앱의 검색 화면으로 넘겼다. 두 가지가 잘못이었다 —
  //   · 그 화면은 `?q=` 를 안 받는다. **친 말이 그대로 사라졌다**
  //   · 그 화면은 로그인해야 열린다. 찾아보러 온 사람을 문 앞에서 돌려세운 것
  //
  // 운동 사전은 앱에 같이 실려 오는 파일이라 **서버도 로그인도 필요 없다.**
  // 여기서 찾고 여기서 보여준다. 기록하려고 누를 때 비로소 앱으로 간다.
  //
  // **치는 동안 바로 나온다.** 단추를 눌러야 나오면 한 번 더 눌러야 하고,
  // 안 나오면 오타인지 없는 운동인지 알 수 없다. 단추는 자판의 엔터를 받는 자리로 남긴다.
  //
  // ── 사전은 **칠 때 받는다** ── (2026-10-16)
  //
  // 조건은 예전과 같다: 두 글자 이상이거나 부위 이름(「등」 · 「팔」). 그 판단은
  // 사전 없이도 할 수 있어서(`partNames.js`) 받기 전에 먼저 가른다.
  const term = q.trim();
  const wants = term.length >= 2 || isPartName(term);

  const [dict, setDict] = useState(null);
  // **못 받은 것은 못 받았다고 말한다** (2026-10-20).
  //
  // 처음에는 `catch` 를 비워두고 「못 받아도 다시 치면 다시 해본다」고 적어뒀는데
  // **그렇지 않았다.** 이 `useEffect` 가 보는 것은 `[wants, dict]` 둘뿐이라 글자가
  // 바뀌어도 다시 돌지 않는다 — 신호가 한 번 끊겨 못 받으면 **「찾는 중…」이 영원히
  // 남는다.** 지하 헬스장에서 열면 그 화면에서 끝난다.
  //
  // 그래서 못 받은 것을 적어두고(`failed`) **다시 해보는 단추**를 준다. 저절로
  // 다시 받지는 않는다 — 글자마다 다시 받으러 가면 안 되는 신호를 계속 두드린다.
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!wants || dict || failed) return;
    let live = true;
    import('../data/exerciseDict')
      .then((m) => { if (live) setDict(m); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [wants, dict, failed]);

  // `null` 은 **아직 찾을 때가 아니다**(상자를 안 그린다), `undefined` 는
  // **사전을 받는 중**이다. 둘을 가르지 않으면 받는 동안 「못 찾았어요」가 뜬다
  const hits = useMemo(() => {
    if (!wants) return null;
    if (!dict) return undefined;
    return dict.searchExercises(term, 8);
  }, [term, wants, dict]);

  // 앱 안으로 가는 길의 말. **로그인 전이면 그렇다고 적는다** (2026-10-20) —
  // 누르면 로그인 화면이 받고, 끝나면 `PrivateRoute` 가 담아둔 자리로 데려간다.
  // 그 일을 **누르기 전에** 말해주는 것이 이 한 줄이 하는 일이다
  const openLabel = loggedIn ? '열어보기 ›' : '가입하고 열기 ›';

  return (
    <div className="full-height" style={{ paddingBottom: 50 }}>

      {/* 머리 — **한 줄이다** (2026-10-20에 칸 이름 줄을 걷었다).
          여기는 붙어 있는(sticky) 자리라 **가입 단추가 늘 손에 닿는다** —
          그래서 화면 아래에 떠 있는 가입 띠를 따로 두지 않았다. 같은 일을 하는
          단추를 두 벌 두면 어느 쪽이 진짜인지 묻게 된다 (9/18 에 정한 것이다) */}
      <header ref={headRef} style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        backdropFilter: 'var(--surface-blur)',
        WebkitBackdropFilter: 'var(--surface-blur)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{
          maxWidth: MAX, margin: '0 auto', padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <LogoMark size={28} />
          <LogoWord cap={18} />

          {/* **이미 쓰는 사람과 처음 온 사람에게 할 말이 다르다.** 들어와 있으면
              「앱 열기」 하나로 끝이고(가입하라는 말은 틀린 말이다), 아직이면
              「로그인」과 「가입하기」다 */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {loggedIn ? (
              <a href="/home" style={{
                fontSize: 12.5, color: 'var(--text-secondary)', textDecoration: 'none',
                border: '1px solid var(--border-hover)', padding: '6px 13px',
                borderRadius: 'var(--radius)', whiteSpace: 'nowrap',
              }}>앱 열기</a>
            ) : (
              <>
                <a href="/login" style={{
                  fontSize: 12.5, color: 'var(--text-secondary)', textDecoration: 'none',
                  padding: '6px 9px', whiteSpace: 'nowrap',
                }}>로그인</a>
                <a href="/register" style={{
                  fontSize: 12.5, color: 'var(--on-accent)', textDecoration: 'none',
                  background: 'var(--accent)', padding: '7px 14px',
                  borderRadius: 'var(--radius)', fontWeight: 600, whiteSpace: 'nowrap',
                }}>가입하기</a>
              </>
            )}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: MAX, margin: '0 auto', padding: '26px 20px 0' }}>

        {/* ── 까닭을 먼저 ──
            `div` 로 적혀 있었다. 사람 눈에는 제목처럼 보이지만 **검색 엔진과
            읽어주는 도구에게는 이 페이지에 제목이 없는 것**이다 (2026-10-06 에 고쳤다) */}
        <h1
          className="serif-display"
          style={{
            fontSize: 'clamp(22px, 6.2vw, 27px)', lineHeight: 1.5, margin: '0 0 15px',
            fontWeight: 400, ...anchorStyle,
          }}
        >
          무게는 늘었는데<br /><span style={{ color: 'var(--accent)' }}>무엇이 늘었는지</span>는 아무도 안 알려준다
        </h1>

        {/* **제목 다음 한 줄이 비어 있었다** (2026-10-20에 넣었다).
            제목은 「무엇이 문제인가」만 말하고 바로 그림이 나와서, 「그래서 이 앱이
            무엇을 해주는가」를 말하는 줄이 한 줄도 없었다 */}
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.85, margin: 0 }}>
          세트를 적으면 <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>몸 그림 ·
          들어올린 무게 · 1년 열두 판</b>으로 돌려줍니다. 겨루는 상대는 지난주의
          자기 자신 하나입니다.
        </p>

        <hr className="rule-beam" style={{ marginTop: 24 }} />

        {/* ── 증거 하나 — 몸 지도 ──
            **「몸」 탭의 지도와 같은 조각을 쓴다** (2026-10-06).
            「내 몸 지도 보기」 단추는 **들어와 있을 때만** 준다 — 계정이 없는 사람에게는
            설명 없는 로그인 벽이고, 가입하는 길은 아래 「하는 것」과 머리에 이미 있다 */}
        <Band id="site-map" title="오늘 이렇게 말합니다" note="예시" style={anchorStyle}>
          <MapPreview onGo={loggedIn ? () => go('/map') : undefined} />
        </Band>

        {/* ── 증거 둘 — 결산 ── (2026-10-20) */}
        <Band id="site-finish" title="마치면 이렇게 셉니다" note="예시" style={anchorStyle}>
          <FinishPreview />
        </Band>

        {/* ── 증거 셋 — 1년 열두 판 ── (2026-10-20)
            계산은 벽이 쓰는 그것이다(`data/yearWall.js`) — 각인 규칙이 바뀌면 같이 바뀐다 */}
        <Band id="site-wall" title="한 해를 열두 판에" note="예시" style={anchorStyle}>
          <WallPreview />
        </Band>

        <hr className="rule-beam" style={{ marginTop: 26 }} />

        {/* 사진 — 관리자가 건 것. 없으면 이 칸이 통째로 없다 */}
        {photos.length > 0 && (
          <Band id="site-photos" title="사진" style={anchorStyle}>
            <div className="filter-row" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {photos.map((p) => (
                <figure key={p.id} style={{ margin: 0, flexShrink: 0, width: 168 }}>
                  <button
                    onClick={() => setShot(p)}
                    style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', display: 'block' }}
                    aria-label={p.caption || '사진 크게 보기'}
                  >
                    <img
                      src={p.data}
                      alt={p.caption || ''}
                      loading="lazy"
                      style={{
                        width: 168, height: 168, objectFit: 'cover', display: 'block',
                        borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                      }}
                    />
                  </button>
                  {p.caption && (
                    <figcaption style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 7, lineHeight: 1.5 }}>
                      {p.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </Band>
        )}

        {/* 소식 — **차기 전에는 안 그린다.** 빈 상자를 먼저 띄웠다가 채우면 그 사이에
            아래 칸들이 한 번 밀린다.
            「공지함」으로 가는 길은 **들어와 있을 때만** — 그 화면도 `PrivateRoute` 안이다 */}
        {news.length > 0 && (
          <Band id="site-news" title="소식" style={anchorStyle}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {news.map((n, i) => (
                <div key={`${n.date}-${i}`} style={{
                  display: 'flex', alignItems: 'baseline', gap: 10,
                  padding: '8px 0', borderBottom: i === news.length - 1 ? 'none' : '1px solid var(--bg-tertiary)',
                }}>
                  <span style={{
                    minWidth: 0, flexGrow: 1, fontSize: 13, color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{n.text}</span>
                  <span style={{ flexShrink: 0, fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {String(n.date).slice(5).replace('-', '.')}
                  </span>
                </div>
              ))}
            </div>
            {loggedIn && (
              <button
                onClick={() => go('/support/notices')}
                style={{
                  marginTop: 10, minHeight: 44, width: '100%', background: 'none',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--text-secondary)',
                }}
              >공지함 ›</button>
            )}
          </Band>
        )}

        {/* ── 하는 것 — **읽고 끝나던 글을 누를 수 있게 했다** ── (2026-10-07 · 시안 B안)

            여섯 중 **셋은 자기 화면이 없다.** 「운동 끝 결산」은 운동을 **마칠 때**
            뜨고, 「횟수 세기」는 **카메라를 켤 때** 돌고, 「1년 기록 벽」은 「기록」
            탭 안의 **한 갈래**다. 그래서 가는 곳(`to`)과 **거기서 무엇을 하는지
            (`where`)를 따로 적는다** — 탭 이름을 그대로 쓰니 앱에서도 그 글자를 찾으면 된다.

            ── 2026-10-20: **무엇이 일어날지 먼저 말한다** ──

            단추에 「열어보기 ›」라고만 적혀 있었다. 계정이 없는 사람이 누르면 로그인
            화면이 받는다 — 로그인이 끝나면 `PrivateRoute` 가 담아둔 그 자리로 데려가니
            **길이 끊긴 것은 아니지만**, 누르기 전에는 그 말이 어디에도 없었다.
            이제 로그인 전이면 **「가입하고 열기 ›」**다. 길을 막는 것이 아니라 말해주는 것이다.

            그리고 **바로가기 여섯 칸을 걷었다** — 이 여섯 줄이 같은 곳을 가리키는데
            **설명까지 달려 있다.** 아이콘 여섯만 있던 그 줄은 같은 일의 빈 껍데기였다. */}
        <Band id="site-does" title="이 앱이 하는 것" style={anchorStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              ['몸 지도', '최근에 자극한 부위가 금빛으로 달아 있고, 날이 갈수록 식는다',
                '「몸 지도」 화면', '/map'],
              ['운동 끝 결산', '마치면 오늘 들어올린 무게를 한 화면으로. 최고를 넘은 날에만 각인이 붙는다',
                '「운동」 탭 · 마칠 때', '/train'],
              ['1년 기록 벽', '한 해를 금속판 열두 장에 새긴다. 무겁게 든 날일수록 깊다',
                '「기록」 탭 · 기록의 벽', '/history'],
              // ── 아래 셋은 2026-09-30 에 더했다 ──
              // 앱에는 9/22~9/30 에 붙었는데 **이 페이지는 그것을 모르고 있었다.**
              // 앱이 하는 것을 홈페이지가 모르면, 읽은 사람은 없는 앱을 그려보고 들어온다
              ['체형 읽기', '사진을 올리면 그 사진에서 잰 비율로 실루엣을 다시 그린다. 견주는 상대는 지난 번의 나다',
                '「몸」 탭 · 체형', '/body'],
              ['회복 시간', '동작이 끝나고 숨이 가라앉는 데 걸린 초를 잰다. 같은 동작 뒤에 그 초가 줄면 전보다 덜 힘들어진 것이다',
                '「몸」 탭 · 회복', '/body'],
              ['횟수 세기', '폰을 옆에 세워두면 관절이 접혔다 펴지는 것을 세서 횟수 칸에 넣는다. 저장은 사람이 누른다',
                '「운동」 탭 · 카메라', '/train'],
            ].map(([t, d, where, to]) => (
              <div key={t}>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{t}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.75, marginTop: 3 }}>{d}</div>
                {/* **줄 전체가 아니라 이 칸만 누른다.** 설명 문장에 링크를 걸면
                    읽다가 손가락이 닿아서 화면이 바뀐다 — 읽으라고 쓴 글이다 */}
                <button
                  type="button"
                  onClick={() => go(to)}
                  /* 읽어주는 화면에는 **이름이 통째로** 들어간다. 「열어보기」만
                     여섯 번 읽히면 무엇을 여는지 알 수 없다 */
                  aria-label={`${t} ${loggedIn ? '열어보기' : '가입하고 열기'} — ${where}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 8, width: '100%', minHeight: 44, marginTop: 8, padding: '7px 11px',
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
                    fontFamily: "'Barlow', 'IBM Plex Sans KR', sans-serif",
                  }}
                >
                  <span style={{
                    fontSize: 11.5, color: 'var(--text-secondary)', minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{where}</span>
                  <span style={{
                    flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: 'var(--accent)',
                  }}>{openLabel}</span>
                </button>
              </div>
            ))}
          </div>
        </Band>

        {/* 안 하는 것 — **이쪽이 더 많은 것을 말한다.**
            글은 한 자도 안 고쳤다. 점(•)만 **짧은 금선**으로 바꿨다 (2026-10-20) —
            점은 목록이고 선은 새긴 자국이다 */}
        <Band id="site-doesnt" title="안 하는 것" style={anchorStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {[
              ['남과 겨루지 않는다', '랭킹도 순위도 없다. 견주는 상대는 지난주의 자기 자신 하나다'],
              ['말을 걸지 않는다', '커뮤니티를 뒀다가 걷어냈다. 운동하러 열었다가 남의 글을 읽고 나가는 자리는 필요 없었다'],
              ['광고가 없다', '화면에 파는 것이 없다. 그래서 아무것도 안 눌러도 된다'],
              // **여기가 앱과 어긋나 있었다** (2026-09-30 에 맞췄다).
              // 「회복 시간도 추정하지 않는다」고 적어뒀는데, 9/30 에 회복 시간을 붙였다 —
              // 짐작이 아니라 **숨을 들어 재는 것**이라 규칙을 깬 것은 아니지만,
              // 읽는 사람에게는 거짓말로 보인다. 재는 것과 추정하는 것을 갈라 적는다
              ['지어내지 않는다', '칼로리도 체지방률도 추정하지 않는다. 회복 시간은 짐작이 아니라 숨을 들어 재고, 못 재면 못 쟀다고 적는다'],
              // 폰 안에서 끝난다는 것은 **이 앱의 값 중 하나**인데 어디에도 안 적혀 있었다.
              // 사진이 서버에 저장되는 것은 사실이므로(비교 사진) **그것까지 같이 밝힌다** —
              // 안 밝히면 이 줄이 다음 거짓말이 된다
              ['읽는 일은 폰 안에서 끝난다', '사진에서 비율을 재고 · 숨을 듣고 · 횟수를 세는 일은 모두 기기에서 한다. 소리와 영상은 아무 데도 안 남는다 (견주기용 사진만 계정에 저장되고, 앱에서 지울 수 있다)'],
            ].map(([t, d]) => (
              <div key={t} style={{ display: 'flex', gap: 11 }}>
                <span style={{
                  width: 11, height: 1, background: 'var(--accent-low)', flexShrink: 0, marginTop: 10,
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 600 }}>{t}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.75, marginTop: 2 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </Band>

        {/* 지하 */}
        <Band id="site-offline" title="지하에서도" style={anchorStyle}>
          <div className="serif-display" style={{ fontSize: 17, lineHeight: 1.6, marginBottom: 10 }}>
            신호가 없어도<br />세트는 <span style={{ color: 'var(--accent)' }}>저장된다</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            헬스장은 대개 지하에 있다. 신호가 끊기면 적은 것을 폰에 담아뒀다가
            올라와서 저절로 올린다. 같은 기록이 두 번 올라가지 않는다.
          </div>
        </Band>

        {/* ── 찾기는 **맨 아래로 내렸다** ── (2026-10-20 · 위 머리글 ④)
            둘째 자리에 있을 것이 아니다 — 설치 전 사람에게 가장 안 급한 것이고,
            이 앱에서 가장 차별점이 없는 것이다. 대신 **여기서 끝까지 된다**는 사실을
            적는다. 이 화면에서 가입 없이 진짜로 되는 몇 안 되는 것이라 그게 값이다 */}
        <Band id="site-find" title="운동 찾기" style={anchorStyle}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 12 }}>
            이름 · 영어 이름 · 초성 · 부위로 찾습니다. <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
            가입 전에도 찾아볼 수 있어요</b> — 사전이 앱에 같이 실려 오는 파일이라
            서버도 로그인도 필요 없습니다.
          </div>

          <form
            onSubmit={(e) => e.preventDefault()}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
              background: 'var(--bg-secondary)', padding: '10px 13px',
            }}
          >
            <NavIcon name="search" size={17} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="운동 이름으로 찾아보기"
              aria-label="운동 검색"
              style={{
                flexGrow: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14,
              }}
            />
            {/* 친 것을 지우는 자리. 결과가 떠 있을 때만 나온다 */}
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="지우기"
                style={{
                  flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 16, padding: '2px 6px', lineHeight: 1,
                }}
              >×</button>
            )}
            <button type="submit" style={{
              flexShrink: 0, background: 'var(--accent)', color: 'var(--on-accent)', border: 'none',
              fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 14, letterSpacing: 1.5,
              padding: '7px 14px', borderRadius: 'var(--radius)', cursor: 'pointer',
            }}>찾기</button>
          </form>

          {/* 찾은 것 — **이 화면에서 바로 보여준다.** 없으면 없다고 말하고,
              부위 이름을 권한다(사전이 부위로도 찾기 때문이다) */}
          {(hits || hits === undefined) && wants && (
            <div style={{
              border: '1px solid var(--border)', background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)', padding: '6px 4px', marginTop: 12,
            }}>
              {failed && !dict ? (
                // **못 찾은 것과 못 받은 것은 다른 말이다.** 「없어요」라고 하면 없는 운동을
                // 찾은 줄 알고 나간다 — 여기서는 사전을 못 받았다고 말하고 길을 준다
                <div style={{ padding: '14px 12px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  운동 사전을 못 불러왔어요. 신호를 확인해 주세요.<br />
                  <button
                    type="button"
                    onClick={() => setFailed(false)}
                    style={{
                      marginTop: 8, minHeight: 36, padding: '7px 14px', cursor: 'pointer',
                      background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
                      fontFamily: 'inherit', fontSize: 13, color: 'var(--accent)',
                    }}
                  >다시 받기</button>
                </div>
              ) : hits === undefined ? (
                <div style={{ padding: '14px 12px', fontSize: 13, color: 'var(--text-muted)' }}>찾는 중…</div>
              ) : hits.length === 0 ? (
                <div style={{ padding: '14px 12px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  「{q.trim()}」로는 못 찾았어요.<br />
                  부위로도 찾을 수 있어요 — {PARTS.slice(0, 5).map((pp) => (
                    <button
                      key={pp}
                      onClick={() => setQ(pp)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px',
                        fontFamily: 'inherit', fontSize: 13, color: 'var(--accent)',
                      }}
                    >{pp}</button>
                  ))}
                </div>
              ) : (
                hits.map((h) => (
                  <button
                    key={h.ko}
                    // **찾은 운동을 들려 보낸다** (2026-09-17).
                    //
                    // 여태 `/train` 만 열었다 — **찾아낸 이름이 그 자리에서 사라졌다.**
                    // `state` 가 아니라 **주소에 싣는다.** 여기서 누르는 사람은 대개
                    // 아직 로그인 전이고, 로그인 화면을 거치면 `state` 는 사라진다
                    onClick={() => go(`/train?q=${encodeURIComponent(h.ko)}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44,
                      padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{
                      flexShrink: 0, fontSize: 11, color: 'var(--text-muted)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1px 6px',
                    }}>{dict.partOf(h.ko)}</span>
                    <span style={{ minWidth: 0, flexGrow: 1 }}>
                      <span style={{ display: 'block', fontSize: 14, color: 'var(--text-primary)' }}>{h.ko}</span>
                      <span style={{
                        display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{h.desc}</span>
                    </span>
                    <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--accent)' }}>
                      {loggedIn ? '기록 ›' : '가입하고 기록 ›'}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </Band>

        {/* ── 시작하기 — **이 화면의 카드는 이것 하나다** ──
            나머지 칸은 라벨과 선으로 가른다(`Band`). 카드가 하나면 그것이 눈에 띈다 */}
        <section id="site-start" style={{
          marginTop: 30,
          background: 'var(--card-bg)', border: '1px solid var(--accent)',
          boxShadow: 'var(--card-edge)', borderRadius: 'var(--radius)',
          padding: '20px 18px', ...anchorStyle,
        }}>
          <div className="serif-display" style={{ fontSize: 17, lineHeight: 1.5, marginBottom: 9 }}>
            오늘 한 세트부터
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 16 }}>
            적으면 됩니다. 이메일 하나면 가입이 끝나요.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={() => go('/register')}>가입하기</button>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => go('/login')}>로그인</button>
          </div>
        </section>

        {/* 꼬리 — **로그인 없이 되는 것만 남긴다** (2026-10-20).
            「고객센터」와 「소식(공지함)」은 둘 다 `PrivateRoute` 안이라, 계정이 없는
            사람에게는 누르면 로그인 화면이 받는 자리였다. 들어와 있을 때만 그린다.
            방침은 **플레이스토어가 요구하는 공개 주소**라 늘 둔다 (2026-10-09) */}
        <div style={{ marginTop: 30 }}>
          <hr className="rule-beam" style={{ marginBottom: 16 }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            fontSize: 12.5, color: 'var(--text-muted)',
          }}>
            <LogoMark size={16} />
            {loggedIn && (
              <>
                <a href="/support" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>고객센터</a>
                <a href="/support/notices" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>소식</a>
              </>
            )}
            <a href="/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>개인정보처리방침</a>
            <span style={{ marginLeft: 'auto' }}>BLACK IRON</span>
          </div>
        </div>
      </div>

      {/* 사진 크게 보기. **아무 데나 누르면 닫힌다** — 닫는 단추를 찾게 하지 않는다 */}
      {shot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={shot.caption || '사진'}
          onClick={() => setShot(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9997, background: 'rgba(8,7,5,0.92)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 20, cursor: 'zoom-out',
          }}
        >
          <img
            src={shot.data}
            alt={shot.caption || ''}
            style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 'var(--radius)' }}
          />
          {shot.caption && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 14, textAlign: 'center' }}>
              {shot.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
