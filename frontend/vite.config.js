import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import os from 'os';
import path from 'path';

// 빌드마다 SW 캐시 버전 갱신 (사용자에게 새 번들 강제 적용)
const swVersionPlugin = () => ({
  name: 'sw-version-replace',
  closeBundle() {
    const swPath = path.resolve('dist/sw.js');
    if (!fs.existsSync(swPath)) return;
    const version = `blackiron-${Date.now()}`;
    let content = fs.readFileSync(swPath, 'utf-8');
    content = content.replace(/__SW_VERSION__/g, version);
    fs.writeFileSync(swPath, content, 'utf-8');
    console.log(`[SW] cache version: ${version}`);
  },
});

// `/dev` 로 개발 미리보기(`dev/preview.html`)를 연다 — 모바일 브라우저 틀과 앱 웹뷰 틀을
// 한 화면에 나란히 띄우는 자리다. **개발 서버에서만 산다**: `apply: 'serve'` 라 build 에는
// 안 끼고, 파일도 `public/` 이 아닌 `dev/` 에 있어서 dist 로 복사되지 않는다
const devPreviewPlugin = () => ({
  name: 'dev-preview',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = req.url.split('?')[0];
      if (path === '/dev' || path === '/dev/') {
        req.url = '/dev/preview.html' + req.url.slice(path.length);
      }
      // ── 이 PC 의 LAN 주소를 미리보기가 물어볼 수 있게 ── (2026-10-15)
      //
      // **폰으로 직접 보려면 그 주소를 알아야 한다.** vite 가 뜰 때 한 번 찍어주지만
      // 그 줄은 터미널을 스크롤하면 사라지고, 와이파이를 옮기면 바뀐다.
      // 미리보기 화면에 늘 띄워두면 폰을 들고 그대로 치면 된다.
      //
      // 개발 서버에서만 산다(`apply: 'serve'`). 내보내는 것은 **사설 IP** 뿐이고,
      // 그 주소로 들어올 수 있는 사람은 이미 같은 와이파이에 있는 사람이다.
      if (path === '/dev/net.json') {
        const nets = os.networkInterfaces();
        const urls = [];
        for (const [name, list] of Object.entries(nets)) {
          for (const n of list || []) {
            if (n.family !== 'IPv4' || n.internal) continue;
            // 사설 대역만 — 공인 IP 가 잡히는 환경에서 그걸 적어두면 오해를 부른다
            if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address)) continue;
            urls.push({ name, address: n.address });
          }
        }
        const port = server.config.server.port || 5173;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ port, urls }));
        return;
      }
      next();
    });
  },
});

// 폰 앱 시험용 터널을 열 때만 그 주소를 허락한다 (`cloudflared tunnel --url http://localhost:5173`).
// **리포에는 주소를 안 박는다.** 개발 서버를 밖에 내놓는 설정이라, `.trycloudflare.com` 을
// 통째로 박아두면 아무 데서나 켜둔 개발 서버에 그 도메인 호스트 헤더로 들어올 수 있다.
// 쓸 때만 켠다: `TUNNEL_HOSTS=.trycloudflare.com npm run dev` (쉼표로 여럿).
const tunnelHosts = (process.env.TUNNEL_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react(), swVersionPlugin(), devPreviewPlugin()],
  server: {
    host: true,
    // 아무것도 안 주면 localhost/LAN 만. 터널을 열 때만 TUNNEL_HOSTS 로 그 주소를 더한다
    allowedHosts: tunnelHosts,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        // 터널 주소(https://….trycloudflare.com)로 열면 브라우저가 그 주소를 Origin 에 싣고,
        // 백엔드 CORS 허용 목록에 없어서 로그인부터 막힌다. 여기를 지난 요청은 화면과 같은
        // 주소에서 온 것이니 Origin 을 떼서 「같은 서버」로 보낸다. 백엔드 목록은 안 넓힌다
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.removeHeader('origin');
            // ── 터널로 들어온 주소를 백엔드에 알려준다 ── (2026-10-09)
            //
            // `changeOrigin` 이 Host 를 `localhost:4000` 으로 바꿔 쓴다. 그러면 소셜
            // 로그인이 제공자에게 「돌아올 주소」로 **localhost 를 적어 보낸다** —
            // 메타는 `http://localhost` 를 **아예 등록도 못 하게** 막는다(10/9 확인).
            // 원래 들어온 주소를 따로 실어 보내면 백엔드가 그걸로 콜백 주소를 짓는다.
            if (req.headers.host) proxyReq.setHeader('x-forwarded-host', req.headers.host);
          });
        },
      },
    },
  },
  build: {
    cssMinify: true,
    sourcemap: false,
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // recharts 는 직접 묶지 않는다.
        // 한 덩어리로 묶어두면 선 그래프만 있는 화면에서도 레이더 차트 코드까지 같이 받는다.
        // 나눠두면 각 화면이 자기가 쓰는 것만 받는다 (비교 탭의 레이더는 비교 탭에서만).
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          state: ['zustand', 'axios'],
        },
      },
    },
  },
});
