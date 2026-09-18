import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoMark, LogoWord } from '../components/Logo';
import NavIcon from '../components/NavIcon';
import client from '../api/client';
import { searchExercises, partOf, isPart, PARTS } from '../data/exerciseDict';
// 머리 오른쪽에 무엇을 띄울지 정하는 데만 쓴다 — 들어와 있으면 「앱 열기」,
// 아직이면 「로그인 · 가입하기」다 (2026-09-18)
import { useAuthStore } from '../store/authStore';
// 소식 두 파일(`notices.json` · `changelog.json`)은 **여기서 바로 안 들여온다.**
// 아래 `useEffect` 가 화면이 뜬 뒤에 받아온다 — 까닭은 그 자리에 적어뒀다

// 홈페이지 — **앱이 아니라 웹사이트다.**
//
// 2026-09-16 에 두 번 고쳤다. 아침 판은 껍데기만 웹사이트였고 **안에 든 것은
// 커뮤니티 하나**였다 — 커뮤니티를 걷으면서 통째로 비었다. 저녁에 소개 글 한 장으로
// 다시 지었는데, 「포털처럼 여러 칸으로」 가 다음 주문이었다.
//
// **그래서 칸을 나눴다.** 찾기 한 줄 · 바로가기 여섯 · 사진 · 소식 · 하는 것 ·
// 안 하는 것. 한 화면에 여러 상자가 촘촘히 놓이는 결이다. 폰에서는 한 줄로 흐르고
// 넓어지면 두 줄이 된다(`--site-two` 미디어 쿼리 대신 CSS 그리드 `auto-fit` 을 쓴다 —
// 상자마다 최소 폭만 정해두면 화면이 알아서 접는다).
//
// **로그인 없이 열린다.** 웹사이트인데 로그인해야 보이면 웹사이트가 아니다.
// 그래서 여기서 쓰는 것은 **로그인 없이 되는 것뿐**이다 —
//   · 소식은 앱에 같이 실려 오는 파일(notices.json · changelog.json)에서 읽는다
//   · 사진은 `/api/site-photos` 에서 받는다 (보는 쪽은 로그인이 없다)
//   · 찾기는 **이 화면에서** 끝난다. 운동 사전이 앱에 같이 실려 오는 파일이라
//     서버도 로그인도 필요 없다 — 기록하려고 누를 때 비로소 앱으로 간다
//
// **지어내지 않는다.** 쓰는 사람 수도 후기도 별점도 없다 — 아직 배포도 안 한 앱이다.

const MAX = 860;

// 상자 하나. 제목 줄 + 안쪽. 「더보기」는 있을 때만 그린다
function Box({ id, title, more, onMore, children, style }) {
  return (
    <section id={id} style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      boxShadow: 'var(--card-edge)', borderRadius: 'var(--radius)',
      padding: '15px 16px 16px', ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
        <span style={{ width: 3, height: 15, background: 'var(--accent)', flexShrink: 0 }} />
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 2,
          color: 'var(--text-primary)', margin: 0, fontWeight: 400,
        }}>{title}</h2>
        {more && (
          <button
            onClick={onMore}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12, color: 'var(--text-muted)', padding: 4,
            }}
          >{more} ›</button>
        )}
      </div>
      {children}
    </section>
  );
}

// 바로가기 한 칸. 앱 안으로 들어가는 길이라, 로그인 전이면 로그인 화면이 받는다
function Shortcut({ icon, label, to, onGo }) {
  return (
    <button
      onClick={() => onGo(to)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
        minHeight: 72, padding: '10px 4px', cursor: 'pointer',
        background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        color: 'var(--text-secondary)', fontFamily: 'inherit',
      }}
    >
      <NavIcon name={icon} size={20} />
      <span style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

// ── 머리 내비게이션 ── (2026-09-18)
//
// **이 화면에는 길찾기가 없었다.** 상자 일곱을 위로 쌓아 놓고 머리에는 로고와
// 「앱 열기」뿐이라, 소식을 보러 온 사람도 시작하려고 온 사람도 **끝까지 내려가며
// 찾았다.** 앱 안은 탭바가 그 일을 하는데 이 화면만 비어 있었다.
//
// 시안 셋을 내고 **셋 다** 붙였다. 셋이 서로 다른 것을 말하기 때문이다 —
//   A 칸 이름 줄  **무엇이 있는가** (머리 아래 한 줄. 누르면 그 상자로 내려간다)
//   B 로그인·가입  **여기서 무엇을 할 수 있는가** (머리 오른쪽 끝)
//   C 따라오는 점  **지금 어디를 읽고 있는가** (넓은 화면 오른쪽. 폰에서는 안 그린다)
//
// 셋을 합칠 때 **한 가지만 덜어냈다** — A 의 줄 끝에 있던 「시작하기 ›」다.
// B 의 「가입하기」와 같은 일이고, 같은 일을 하는 단추를 한 머리에 두 벌 두면
// 어느 쪽이 진짜인지 묻게 된다. 칸 이름 줄에는 **칸 이름만** 남긴다.
//
// **주소는 안 늘린다.** 다 같은 화면 안의 자리라 `#` 도 라우트도 새로 안 만든다 —
// 길을 늘리는 것과 **지금 보고 있는 것을 말해주는 것**은 다른 일이다.

// 칸과 그 이름. **실제로 그려지는 칸만** 내비에 오른다 (사진·소식은 없을 수 있다)
const SITE_SECTIONS = [
  { id: 'site-find',   label: '찾기' },
  { id: 'site-photos', label: '사진',      when: (s) => s.photos > 0 },
  { id: 'site-news',   label: '소식',      when: (s) => s.news > 0 },
  { id: 'site-does',   label: '하는 것' },
  { id: 'site-doesnt', label: '안 하는 것' },
  // 「지하에서도」도 칸이다. 빠뜨리면 그 칸을 읽는 동안 앞 칸이 켜진 채로 남아서
  // **점이 틀린 말을 한다** — 길찾기가 지금 어디인지를 잘못 말하면 없는 것보다 나쁘다
  { id: 'site-offline', label: '지하에서도' },
  { id: 'site-start',  label: '시작하기' },
];

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

  // 소식 — 손으로 적은 공지와 커밋에서 뽑힌 것을 날짜순으로 섞는다.
  // 앱의 공지함이 하는 일과 같은데, **여기서는 다섯 줄만** 보여준다.
  //
  // ── 화면이 뜬 뒤에 받아온다 ── (2026-09-17)
  //
  // 두 파일을 위에서 그냥 들여오면 **첫 화면에 같이 딸려 온다.** 재보면 73KB 다
  // (`notices.json` 41KB + `changelog.json` 32KB, 묶으면 gzip 23.7KB).
  // 그런데 이 화면이 쓰는 것은 **날짜와 한 줄, 그것도 다섯 개뿐**이다 —
  // 무게의 거의 전부는 「자세히」에 들어가는 `detail` 이고, 그건 공지함이 쓴다.
  //
  // **여기는 로그인도 앱 설치도 없이 처음 오는 사람이 보는 자리다.** 아직 이 앱을
  // 쓸지 말지도 모르는 사람에게 제일 먼저 23KB 를 받게 할 이유가 없다. 다섯 줄은
  // 조금 늦게 차도 되는 것이고, 그동안 찾기도 바로가기도 이미 눌린다.
  //
  // **파일을 새로 만들어 두지 않는다.** 다섯 줄짜리를 빌드 때 따로 뽑아둘 수도
  // 있지만, 그러면 같은 소식이 두 곳에 있게 되고 한쪽만 낡는 날이 온다.
  // 출처는 그대로 하나로 두고 **받는 때만** 미룬다.
  const [news, setNews] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      import('../data/notices.json'),
      import('../data/changelog.json'),
    ]).then(([nMod, cMod]) => {
      if (!alive) return;
      const notices = nMod.default || nMod;
      const changelog = cMod.default || cMod;
      const a = (notices?.items || []).map((n) => ({ date: n.date, text: n.text, pinned: n.pinned }));
      const b = (changelog?.items || []).map((c) => ({ date: c.date, text: `${c.scope ? `${c.scope} · ` : ''}${c.text}` }));
      setNews([...a, ...b]
        .filter((n) => n.date && n.text)
        .sort((x, y) => (x.pinned === y.pinned ? String(y.date).localeCompare(String(x.date)) : x.pinned ? -1 : 1))
        .slice(0, 5));
    // 못 받아와도 화면은 그대로 돈다 — 소식 칸만 안 그려진다
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const loggedIn = useAuthStore((s) => s.isLoggedIn);

  const go = (to) => navigate(to);

  // ── 내비게이션이 들고 있는 것 ── (2026-09-18)
  //
  // 머리 높이를 **재서** 쓴다. 칸으로 내려갈 때 그만큼 비워야 붙어 있는 머리가
  // 제목을 덮지 않는다 — 숫자를 손으로 적어두면 머리를 한 줄 고칠 때마다 어긋난다.
  const headRef = useRef(null);
  const [headH, setHeadH] = useState(92);
  useEffect(() => {
    const el = headRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setHeadH(el.offsetHeight || 92));
    ro.observe(el);
    setHeadH(el.offsetHeight || 92);
    return () => ro.disconnect();
  }, []);

  const sections = useMemo(
    () => SITE_SECTIONS.filter((s) => !s.when || s.when({ photos: photos.length, news: news.length })),
    [photos.length, news.length],
  );

  // 지금 읽고 있는 칸. **머리 바로 아래를 지난 칸**을 그것으로 본다.
  //
  // `IntersectionObserver` 를 쓰지 않는다 — 문턱을 넘을 때만 알려주는 물건이라
  // 「어느 것이 제일 위인가」를 알려면 문턱을 여러 개 걸어야 하고, 그래도 상자
  // 높이가 저마다 다르면 어긋난다. 여기는 칸이 여섯이라 스크롤을 직접 보는 것이
  // 더 정확하고 싸다. **프레임마다 한 번만** 센다 (`requestAnimationFrame`).
  const [active, setActive] = useState(sections[0]?.id || '');
  useEffect(() => {
    let raf = 0;
    const pick = () => {
      raf = 0;
      const line = headH + 16;
      let found = sections[0]?.id || '';
      for (const s of sections) {
        const top = document.getElementById(s.id)?.getBoundingClientRect().top;
        if (top == null) continue;
        if (top <= line) found = s.id;
      }
      // 맨 아래에 닿았으면 마지막 칸을 켠다 — 짧은 칸은 화면에 다 들어와도
      // 그 위를 지나지 못해서, 끝까지 내려도 앞 칸이 켜진 채로 남는다
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 4;
      if (atBottom && sections.length) found = sections[sections.length - 1].id;
      setActive((prev) => (prev === found ? prev : found));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(pick); };
    pick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [sections, headH]);

  // 칸으로 데려간다. **부드럽게 미는 것은 그러길 원하는 사람에게만** —
  // OS 에서 「동작 줄이기」를 켠 사람에게는 멀미가 나는 움직임이다
  const jump = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const smooth = !(typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    setActive(id);
  };

  // 칸마다 붙인다. 붙어 있는 머리 높이만큼 위를 비운다 (위 `headH` 참고) —
  // 안 비우면 내려간 자리에서 **제목이 머리 밑에 깔린다**
  const anchorStyle = { scrollMarginTop: headH + 14 };

  // ── 찾기는 **이 화면에서** 한다 ── (2026-09-16)
  //
  // 앞서는 「찾기」가 앱의 검색 화면으로 넘겼다. 두 가지가 잘못이었다 —
  //   · 그 화면은 `?q=` 를 안 받는다. **친 말이 그대로 사라졌다**
  //   · 그 화면은 로그인해야 열린다. 홈페이지는 로그인 없이 보는 자리인데,
  //     찾기를 누르면 **로그인 화면이 받았다.** 찾아보러 온 사람을 문 앞에서 돌려세운 것
  //
  // 운동 사전은 앱에 같이 실려 오는 파일이라 **서버도 로그인도 필요 없다.**
  // 여기서 찾고 여기서 보여준다. 기록하려고 누를 때 비로소 앱으로 간다.
  //
  // **치는 동안 바로 나온다.** 단추를 눌러야 나오면 한 번 더 눌러야 하고,
  // 안 나오면 오타인지 없는 운동인지 알 수 없다. 단추는 자판의 엔터를 받는 자리로 남긴다.
  const hits = useMemo(() => {
    const term = q.trim();
    // 사전은 한 글자로는 안 찾는다(거의 다 걸려서 도움이 안 된다).
    // 다만 부위 이름은 한 글자여도 찾는다 — 「등」 · 「팔」
    if (term.length < 2 && !isPart(term)) return null;
    return searchExercises(term, 8);
  }, [q]);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 50 }}>

      {/* 머리 — 두 줄이다 (2026-09-18).
          위: 로고 + 할 수 있는 것(B) · 아래: 이 화면이 가진 칸의 이름(A) */}
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

          {/* ── 여기서 할 수 있는 것 ── (B)
              **이미 쓰는 사람과 처음 온 사람에게 할 말이 다르다.** 들어와 있으면
              「앱 열기」 하나로 끝이고(가입하라는 말은 틀린 말이다), 아직 아니면
              「로그인」과 「가입하기」다. 둘을 같이 띄우면 늘 한쪽은 남의 단추가 된다 */}
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

        {/* ── 이 화면이 가진 칸 ── (A)
            **줄 하나에 칸 이름만.** 누르면 그 상자로 내려가고, 읽고 있는 칸이 켜진다.
            폰에서는 좌우로 흐른다 (`.site-nav` — 줄바꿈으로 두 줄이 되면 머리가 자란다) */}
        <nav aria-label="이 화면의 칸" className="site-nav" style={{
          maxWidth: MAX, margin: '0 auto', padding: '0 20px',
          display: 'flex', alignItems: 'center', gap: 18,
          borderTop: '1px solid var(--bg-tertiary)',
        }}>
          {sections.map((s) => {
            const on = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => jump(s.id)}
                aria-current={on ? 'true' : undefined}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, whiteSpace: 'nowrap', padding: '10px 2px',
                  color: on ? 'var(--accent)' : 'var(--text-secondary)',
                  borderBottom: `2px solid ${on ? 'var(--accent)' : 'transparent'}`,
                }}
              >{s.label}</button>
            );
          })}
        </nav>
      </header>

      {/* ── 따라오는 점 ── (C)
          **어디까지 왔나**를 말한다. 이름은 대거나 키보드로 짚었을 때만 나온다 —
          늘 적어두면 그것이 또 하나의 목록이 되고, 위 줄과 같은 말을 두 번 한다.
          **폰에서는 아예 안 그린다** (`.site-dots` — 3px 여섯을 손가락으로 못 겨냥한다) */}
      <div className="site-dots" aria-hidden="true" style={{
        position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)',
        flexDirection: 'column', alignItems: 'flex-end', gap: 10, zIndex: 9,
      }}>
        {sections.map((s) => {
          const on = active === s.id;
          return (
            <button
              key={s.id}
              className="site-dot"
              tabIndex={-1}
              onClick={() => jump(s.id)}
              title={s.label}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer', padding: '5px 0',
                fontFamily: 'inherit',
              }}
            >
              <span className="site-dot-label" style={{
                fontSize: 11.5, color: 'var(--accent)', whiteSpace: 'nowrap',
              }}>{s.label}</span>
              <span style={{
                display: 'block', width: 3, borderRadius: 2,
                height: on ? 18 : 8,
                background: on ? 'var(--accent)' : 'var(--border-hover)',
                transition: 'height 0.15s ease, background 0.15s ease',
              }} />
            </button>
          );
        })}
      </div>

      <div style={{ maxWidth: MAX, margin: '0 auto', padding: '20px 20px 0' }}>

        {/* 한 줄 소개 + 검색 — 포털의 첫 줄 자리다.
            머리의 「찾기」가 데려오는 자리라 자리표를 단다 (2026-09-18) */}
        <div id="site-find" className="serif-display" style={{ fontSize: 'clamp(21px, 6vw, 26px)', lineHeight: 1.5, marginBottom: 16, ...anchorStyle }}>
          무게는 늘었는데<br /><span style={{ color: 'var(--accent)' }}>무엇이 늘었는지</span>는 아무도 안 알려준다
        </div>

        <form
          onSubmit={(e) => e.preventDefault()}
          style={{
          display: 'flex', alignItems: 'center', gap: 9,
          border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
          background: 'var(--bg-secondary)', padding: '10px 13px', marginBottom: 16,
        }}>
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
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5,
            padding: '7px 14px', borderRadius: 'var(--radius)', cursor: 'pointer',
          }}>찾기</button>
        </form>

        {/* 찾은 것 — **이 화면에서 바로 보여준다.** 없으면 없다고 말하고,
            부위 이름을 권한다(사전이 부위로도 찾기 때문이다) */}
        {hits && (
          <div style={{
            border: '1px solid var(--border)', background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius)', padding: '6px 4px', marginBottom: 16,
          }}>
            {hits.length === 0 ? (
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
                  // 「벤치프레스」를 찾아 「기록 ›」을 눌렀는데 빈 운동 화면이 열리니,
                  // 거기서 이름을 **다시 쳐야** 했다. 홈페이지에서 찾아준 일이
                  // 아무 데도 안 이어지는 셈이다.
                  //
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
                  }}>{partOf(h.ko)}</span>
                  <span style={{ minWidth: 0, flexGrow: 1 }}>
                    <span style={{ display: 'block', fontSize: 14, color: 'var(--text-primary)' }}>{h.ko}</span>
                    <span style={{
                      display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{h.desc}</span>
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--accent)' }}>기록 ›</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* 바로가기 여섯 */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
          gap: 8, marginBottom: 18,
        }}>
          <Shortcut icon="body" label="몸 지도" to="/map" onGo={go} />
          <Shortcut icon="dumbbell" label="운동 기록" to="/train" onGo={go} />
          <Shortcut icon="calendar" label="기록의 벽" to="/history" onGo={go} />
          <Shortcut icon="chart" label="인바디" to="/body" onGo={go} />
          <Shortcut icon="bell" label="운동 알림" to="/reminders" onGo={go} />
          <Shortcut icon="inbox" label="고객센터" to="/support" onGo={go} />
        </div>

        {/* 상자들 — 폰에서 한 줄, 넓어지면 두 줄. 화면이 알아서 접는다 */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 12, alignItems: 'start',
        }}>

          {/* 사진 — 관리자가 건 것. 없으면 이 칸이 통째로 없다 */}
          {photos.length > 0 && (
            <Box id="site-photos" title="사진" style={{ gridColumn: '1 / -1', ...anchorStyle }}>
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
            </Box>
          )}

          {/* 소식 — **차기 전에는 안 그린다.** 빈 상자를 먼저 띄웠다가 채우면
              그 사이에 아래 상자들이 한 번 밀린다 (사진 칸을 못 받아오면 아예 안
              그리는 것과 같은 규칙이다) */}
          {news.length > 0 && (
          <Box id="site-news" title="소식" style={anchorStyle} more="공지함" onMore={() => go('/support/notices')}>
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
          </Box>
          )}

          {/* 하는 것 */}
          <Box id="site-does" title="이 앱이 하는 것" style={anchorStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['몸 지도', '최근에 자극한 부위가 금빛으로 달아 있고, 날이 갈수록 식는다'],
                ['운동 끝 결산', '마치면 오늘 들어올린 무게를 한 화면으로. 최고를 넘은 날에만 각인이 붙는다'],
                ['1년 기록 벽', '한 해를 금속판 열두 장에 새긴다. 무겁게 든 날일수록 깊다'],
              ].map(([t, d]) => (
                <div key={t}>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{t}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 3 }}>{d}</div>
                </div>
              ))}
            </div>
          </Box>

          {/* 안 하는 것 — **이쪽이 더 많은 것을 말한다** */}
          <Box id="site-doesnt" title="안 하는 것" style={anchorStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['남과 겨루지 않는다', '랭킹도 순위도 없다. 견주는 상대는 지난주의 자기 자신 하나다'],
                ['말을 걸지 않는다', '커뮤니티를 뒀다가 걷어냈다. 운동하러 열었다가 남의 글을 읽고 나가는 자리는 필요 없었다'],
                ['광고가 없다', '화면에 파는 것이 없다. 그래서 아무것도 안 눌러도 된다'],
                ['지어내지 않는다', '회복 시간도 칼로리도 추정하지 않는다. 적은 것으로 셀 수 있는 것만 센다'],
              ].map(([t, d]) => (
                <div key={t} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent-low)', flexShrink: 0, marginTop: 8 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{t}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 2 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </Box>

          {/* 지하 */}
          <Box id="site-offline" title="지하에서도" style={anchorStyle}>
            <div className="serif-display" style={{ fontSize: 17, lineHeight: 1.6, marginBottom: 10 }}>
              신호가 없어도<br />세트는 저장된다
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              헬스장은 대개 지하에 있다. 신호가 끊기면 적은 것을 폰에 담아뒀다가
              올라와서 저절로 올린다. 같은 기록이 두 번 올라가지 않는다.
            </div>
          </Box>

          {/* 시작하기 */}
          <Box id="site-start" title="시작하기" style={{ borderColor: 'var(--accent)', ...anchorStyle }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 14 }}>
              오늘 한 세트부터 적으면 됩니다. 이메일 하나면 가입이 끝나요.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => go('/register')}>가입하기</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => go('/login')}>로그인</button>
            </div>
          </Box>

        </div>

        {/* 꼬리 */}
        <div style={{ marginTop: 28 }}>
          <hr className="rule-beam" style={{ marginBottom: 16 }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            fontSize: 12.5, color: 'var(--text-muted)',
          }}>
            <LogoMark size={16} />
            <a href="/support" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>고객센터</a>
            <a href="/support/notices" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>소식</a>
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
