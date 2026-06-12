import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/client',
  base: './',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    target: 'es2022'
  },
  server: {
    port: 5174,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true
      },
      '/healthz': 'http://localhost:3001'
    }
  }
});
