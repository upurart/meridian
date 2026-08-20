import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'wwwroot/dist',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: 'wwwroot/js/main.js'
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 5173
    }
  }
});
