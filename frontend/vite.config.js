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
    const version = `steelbody-${Date.now()}`;
    let content = fs.readFileSync(swPath, 'utf-8');
    content = content.replace(/__SW_VERSION__/g, version);
    fs.writeFileSync(swPath, content, 'utf-8');
    console.log(`[SW] cache version: ${version}`);
  },
});

export default defineConfig({
  plugins: [react(), swVersionPlugin()],
  server: {
    host: true,
    allowedHosts: ['7b3364939ce183.lhr.life'],
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
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
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          state: ['zustand', 'axios'],
        },
      },
    },
  },
});
