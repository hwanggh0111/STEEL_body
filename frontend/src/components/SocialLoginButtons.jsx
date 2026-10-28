import { useState, useEffect } from 'react';
import client from '../api/client';
import { euro } from '../data/particle';
import { readLS, saveLS } from '../data/safeStorage';
import { PROVIDERS_KEY } from '../data/localKeys';

// 소셜 로그인 버튼들. 로그인 화면과 회원가입 화면이 같이 쓴다.
//
// 소셜로 들어오면 계정이 저절로 만들어진다. 그런데 **회원가입 화면에는 이게 아예
// 없었다** — 구글로 가입하려면 「로그인」 쪽으로 가야 한다는 걸 알아내야 했다.
//
// **되는 것만 그린다.** 제공자마다 열쇠가 따로 있어서, 없는 것을 누르면 오류로
// 되돌아온다. 서버에 물어서 쓸 수 있다고 한 것만 버튼으로 만든다.

const BACKEND_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
  : '';

// ── 길은 둘이다 — 구글 · 네이버 ── (2026-10-09)
//
//   카카오      코드도 검사도 다 됐는데 **쓰기 불안하다**는 판단으로 뺐다
//   페이스북    고른 셋에 안 들어서 같이 걷어냈다
//   인스타그램  10/9 에 열쇠까지 꽂았는데 **인스타가 막았다** — 심사 전에는 역할에
//               등록된 계정만, 끝까지 가도 **프로페셔널 계정만** 들어온다.
//               쓰는 사람에게 그걸 시킬 수 없어서 접었다 (길은 살아 있다)
//   트위터(X)   막힌 것은 없다. 열쇠 받는 손을 안 쓰기로 한 것이다 (길은 살아 있다)
//
// **되는 것만 그린다.** 서버의 `/oauth/providers` 가 열쇠가 꽂힌 것만 `true` 로
// 주고, 아래 `filter` 가 그것만 남긴다. 열쇠가 없는 제공자는 단추 자체가 안 뜬다.
//
// ── 생김새는 B안: 로고만 ── (10/7 에 본인이 고름)
//
// 구글은 제일 많이 눌리는 길이라 **넓은 줄**로 두고, 나머지는 **크기가 똑같은
// 네모**에 로고만 넣는다. 글자를 넣으면 「인스타그램」이 「X」보다 다섯 배 넓어서
// 줄이 흔들리고, 제공자가 늘 때마다 폭을 다시 맞춰야 한다.
// 로고만으로 못 알아볼까 봐 **아래에 한 줄**을 적고, 읽어주는 화면에는 단추마다
// 이름이 통째로 들어간다(`aria-label`).
const OTHERS = [
  {
    key: 'naver',
    label: '네이버',
    background: '#03C75A',
    color: '#ffffff',
    // 네이버는 로고 가이드가 **초록 바탕 + 흰 N** 을 못 박아뒀다 (나중에 검수한다)
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
        <path fill="currentColor" d="M11.6 10.7 8.2 5.5H5v9h3.3V9.2l3.5 5.3H15v-9h-3.4v5.2z" />
      </svg>
    ),
  },
];

// `to` — 로그인이 끝나고 **가려던 자리** (2026-10-20).
//
// 이 길은 서버를 거쳐 돌아온다(`window.location.href`). 그래서 화면이 들고 있던
// 자리가 그대로 사라졌고, 홈페이지에서 「가입하고 열기 — 「몸 지도」 화면」을 누른
// 사람이 **소셜로 들어오면 「오늘」로** 갔다. 서버에게 알려주면 서버가 **서명된
// state 쿠키에 담아뒀다가** 돌아올 때 주소에 실어 보낸다 (`routes/oauth.js`).
// 지난번에 서버가 말해준 것. 깨져 있으면 없는 것으로 본다
const lastKnown = () => {
  try {
    const got = JSON.parse(readLS(PROVIDERS_KEY) || 'null');
    if (got && typeof got === 'object' && !Array.isArray(got)) return got;
  } catch { /* 깨진 것은 없는 것으로 */ }
  return null;
};

export default function SocialLoginButtons({ disabled, googleLabel = 'Google 로 계속하기', to }) {
  const [providers, setProviders] = useState(null);

  useEffect(() => {
    client.get('/oauth/providers')
      // 어느 것이 켜져 있는지 담긴 객체다. 다른 모양이면 구글만 보여준다
      .then(({ data }) => {
        const got = data && typeof data === 'object' && !Array.isArray(data) ? data : { google: true };
        setProviders(got);
        // **다음에 못 물어볼 때 쓸 것을 적어둔다** (2026-10-28)
        saveLS(PROVIDERS_KEY, JSON.stringify(got));
      })
      // ── 못 물어봤을 때 **지어내지 않는다** ── (2026-10-28)
      //
      // 여태 `{ google: true }` 를 지어냈다. 서버는 구글 · 네이버 둘을 켜 두는데,
      // 그러면 **네이버로 가입한 사람은 그 순간 들어올 길이 사라진다** —
      // 소셜로만 들어온 사람에게는 비밀번호가 없다. 지난번에 서버가 말해준 것을
      // 쓰고, 그것도 없으면(이 기기에서 처음이면) 구글만 — 하나도 안 보여주는
      // 것보다는 낫다는 그 선은 그대로 둔다
      .catch(() => setProviders(lastKnown() || { google: true }));
  }, []);

  const go = (provider) => {
    // 거르는 것은 **받는 쪽이 한다** — 서버가 한 번(`safeTo`), 돌아와서 화면이
    // 한 번 더(`data/afterAuth.js`). 여기서는 들고만 간다
    const q = to ? `?to=${encodeURIComponent(to)}` : '';
    window.location.href = `${BACKEND_BASE}/api/oauth/${provider}${q}`;
  };

  const others = OTHERS.filter(o => providers?.[o.key]);
  // ── 하나만 남으면 **이름을 적는다** ── (2026-10-09)
  //
  // 로고만 두는 B안은 **단추가 나란히 설 때** 뜻이 산다 — 폭이 같아지고 줄이
  // 안 흔들린다. 한 칸짜리는 그 이점이 없고, 네모 하나에 그림만 있으면
  // 「이게 뭐지」가 된다. 제공자가 둘 이상이 되는 날 저절로 로고만으로 돌아간다
  const only = others.length === 1;
  if (!providers?.google && others.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
      {providers?.google && (
        <button
          onClick={() => go('google')}
          disabled={disabled}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '12px 16px',
            border: '1px solid #dadce0', borderRadius: 'var(--radius)',
            background: '#ffffff', color: '#3c4043',
            fontSize: 14, fontWeight: 600, fontFamily: "'Barlow', 'IBM Plex Sans KR', sans-serif",
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          {googleLabel}
        </button>
      )}

      {/* 나머지는 **크기가 똑같은 네모**로 한 줄에 나란히 (B안 — 로고만).
          세로로 쌓으면 입력 칸이 화면 밖으로 밀린다 */}
      {others.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            {others.map(o => (
              <button
                key={o.key}
                onClick={() => go(o.key)}
                disabled={disabled}
                // 로고만 있는 단추다 — **읽어주는 화면에는 이름이 통째로** 들어간다
                aria-label={`${euro(o.ariaLabel || o.label)} 계속하기`}
                title={`${euro(o.ariaLabel || o.label)} 계속하기`}
                style={{
                  flex: '1 1 0', minWidth: 0, height: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: o.border || 'none', borderRadius: 'var(--radius)',
                  background: o.background, color: o.color,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                {o.icon}
                {only && (
                  <span style={{
                    marginLeft: 8, fontSize: 14, fontWeight: 600,
                    fontFamily: "'Barlow', 'IBM Plex Sans KR', sans-serif",
                  }}>{euro(o.label)} 계속하기</span>
                )}
              </button>
            ))}
          </div>
          {/* 로고만으로 못 알아보는 사람을 위한 한 줄. 단추 이름을 그대로 잇는다 */}
          {!only && <p style={{
            margin: 0, textAlign: 'center',
            fontSize: 12, color: 'var(--text-muted)',
          }}>{others.map(o => o.label).join(' · ')} 로도 계속할 수 있어요</p>}
        </>
      )}
    </div>
  );
}
