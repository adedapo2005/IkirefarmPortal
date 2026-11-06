import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    {
      name: 'serve-approved-signin-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/approved-signin' || req.url === '/approved-signin/' || (req.url && req.url.startsWith('/approved-signin/?'))) {
            req.url = '/approved-signin/index.html' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
          }
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
