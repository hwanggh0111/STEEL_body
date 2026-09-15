import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
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

// 폰 앱 시험용 터널을 열 때만 그 주소를 허락한다 (`cloudflared tunnel --url http://localhost:5173`).
// **리포에는 주소를 안 박는다.** 개발 서버를 밖에 내놓는 설정이라, `.trycloudflare.com` 을
// 통째로 박아두면 아무 데서나 켜둔 개발 서버에 그 도메인 호스트 헤더로 들어올 수 있다.
// 쓸 때만 켠다: `TUNNEL_HOSTS=.trycloudflare.com npm run dev` (쉼표로 여럿).
const tunnelHosts = (process.env.TUNNEL_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react(), swVersionPlugin()],
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
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
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
