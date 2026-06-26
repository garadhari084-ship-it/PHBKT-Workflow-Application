import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './', // important for Electron/Capacitor relative paths
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    entries: ['index.html'],
    exclude: ['firebase-admin', 'genkit', 'express']
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      external: ['firebase-admin', 'genkit', 'express']
    }
  }
});
