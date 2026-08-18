import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    assetsInlineLimit: 100000000, // inline everything (fonts, mascot) for a single-file artifact
    cssCodeSplit: false,
  },
});
