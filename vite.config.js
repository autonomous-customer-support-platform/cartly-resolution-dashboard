import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  envDir: '../',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/ingestion': {
        target: 'http://34.55.48.151',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:      resolve(__dirname, 'src/index.html'),
        about:     resolve(__dirname, 'src/about.html'),
        dashboard: resolve(__dirname, 'src/dashboard.html'),
        chat:      resolve(__dirname, 'src/chat.html'),
      },
    },
  },
});
