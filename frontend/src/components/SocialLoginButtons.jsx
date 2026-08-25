import { useState, useEffect } from 'react';
import client from '../api/client';

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

const OTHERS = [
  { key: 'naver', label: '네이버', background: '#03C75A', color: '#ffffff' },
  { key: 'facebook', label: '페이스북', background: '#1877F2', color: '#ffffff' },
  { key: 'instagram', label: '인스타그램', background: 'linear-gradient(45deg, #F58529, #DD2A7B, #8134AF)', color: '#ffffff' },
];

export default function SocialLoginButtons({ disabled, googleLabel = 'Google 로 계속하기' }) {
  const [providers, setProviders] = useState(null);

  useEffect(() => {
    client.get('/oauth/providers')
      .then(({ data }) => setProviders(data))
      // 못 물어봤으면 구글만 보여준다. 하나도 안 보여주는 것보다 낫다
      .catch(() => setProviders({ google: true }));
  }, []);

  const go = (provider) => {
    window.location.href = `${BACKEND_BASE}/api/oauth/${provider}`;
  };

  const others = OTHERS.filter(o => providers?.[o.key]);
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
            fontSize: 14, fontWeight: 600, fontFamily: "'Barlow', sans-serif",
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

      {/* 나머지는 한 줄에 나란히. 세로로 쌓으면 입력 칸이 화면 밖으로 밀린다 */}
      {others.length > 0 && (
        <div style={{ display: 'flex', gap: 8 }}>
          {others.map(o => (
            <button
              key={o.key}
              onClick={() => go(o.key)}
              disabled={disabled}
              style={{
                flexGrow: 1, padding: '11px 0', border: 'none', borderRadius: 'var(--radius)',
                background: o.background, color: o.color,
                fontSize: 13, fontWeight: 700, fontFamily: "'Barlow', sans-serif",
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >{o.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
