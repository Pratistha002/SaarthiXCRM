import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The app always calls relative /api/... paths. In production the gateway (Nginx) routes them;
// this proxy is only used by `npm run dev`. Override the target with API_PROXY_TARGET
// (e.g. API_PROXY_TARGET=http://localhost:5175 to go through the running Docker gateway).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5175,
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:8082',
          changeOrigin: true,
        },
      },
    },
  };
});
