/* eslint-disable node/no-unpublished-import */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * @type {import('vite').UserConfig}
 */
export default defineConfig({
  root: process.cwd() + '/view',
  plugins: [
    react({
    })
  ],
  server: {
    host: true,
  },
  build: {
    minify: true,
    emptyOutDir: true,
  },
});
