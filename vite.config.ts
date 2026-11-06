import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
  server: {
    port: 3000,
    open: false,
  },
});
