import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

function buildVersion(): string {
  if (process.env.BUILD_VERSION) return process.env.BUILD_VERSION;
  try {
    return `dev-${execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()}`;
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  // Relative base so the build works at any host path (root domain or sub-path).
  base: './',
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion()),
  },
  build: {
    rollupOptions: { input: { main: 'index.html', gallery: 'gallery.html' } },
  },
  server: { host: true },
  preview: { host: true },
});
