import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoMark, LogoWord } from '../components/Logo';
import NavIcon from '../components/NavIcon';
import client from '../api/client';
import { searchExercises, partOf, isPart, PARTS } from '../data/exerciseDict';
import notices from '../data/notices.json';
import changelog from '../data/changelog.json';

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
function Box({ title, more, onMore, children, style }) {
  return (
    <section style={{
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
  // 앱의 공지함이 하는 일과 같은데, **여기서는 다섯 줄만** 보여준다
  const news = useMemo(() => {
    const a = (notices?.items || []).map((n) => ({ date: n.date, text: n.text, pinned: n.pinned }));
    const b = (changelog?.items || []).map((c) => ({ date: c.date, text: `${c.scope ? `${c.scope} · ` : ''}${c.text}` }));
    return [...a, ...b]
      .filter((n) => n.date && n.text)
      .sort((x, y) => (x.pinned === y.pinned ? String(y.date).localeCompare(String(x.date)) : x.pinned ? -1 : 1))
      .slice(0, 5);
  }, []);

  const go = (to) => navigate(to);

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

      {/* 머리 */}
      <header style={{
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
          <a href="/home" style={{
            marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-secondary)',
            textDecoration: 'none', border: '1px solid var(--border-hover)',
            padding: '6px 13px', borderRadius: 'var(--radius)',
          }}>앱 열기</a>
        </div>
      </header>

      <div style={{ maxWidth: MAX, margin: '0 auto', padding: '20px 20px 0' }}>

        {/* 한 줄 소개 + 검색 — 포털의 첫 줄 자리다 */}
        <div className="serif-display" style={{ fontSize: 'clamp(21px, 6vw, 26px)', lineHeight: 1.5, marginBottom: 16 }}>
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
                  onClick={() => go('/train')}
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
            <Box title="사진" style={{ gridColumn: '1 / -1' }}>
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

          {/* 소식 */}
          <Box title="소식" more="공지함" onMore={() => go('/support/notices')}>
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

          {/* 하는 것 */}
          <Box title="이 앱이 하는 것">
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
          <Box title="안 하는 것">
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
          <Box title="지하에서도">
            <div className="serif-display" style={{ fontSize: 17, lineHeight: 1.6, marginBottom: 10 }}>
              신호가 없어도<br />세트는 저장된다
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              헬스장은 대개 지하에 있다. 신호가 끊기면 적은 것을 폰에 담아뒀다가
              올라와서 저절로 올린다. 같은 기록이 두 번 올라가지 않는다.
            </div>
          </Box>

          {/* 시작하기 */}
          <Box title="시작하기" style={{ borderColor: 'var(--accent)' }}>
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
