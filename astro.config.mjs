import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  // Emit flat files (dist/game.html) to match the /game.html links in
  // landing.js — the single-origin server does not serve directory indexes.
  build: { format: 'file' },
});
