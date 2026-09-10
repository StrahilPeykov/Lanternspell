import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [cloudflare()],
  server: { host: '127.0.0.1', port: 5180, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
