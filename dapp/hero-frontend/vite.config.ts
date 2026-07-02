import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` matches the GitHub Pages project path (alilloig.github.io/display-v2-forum/);
// dev keeps serving at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/display-v2-forum/' : '/',
  plugins: [react()],
}));
