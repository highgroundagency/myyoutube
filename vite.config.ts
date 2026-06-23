/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Dev only middleware that serves the /api serverless functions inside the plain
 * Vite dev server, so `npm run dev` shows real videos with no Vercel CLI needed.
 *
 * It loads the server side YOUTUBE_API_KEY from .env into process.env (server
 * side only, never exposed to the client), then runs the same handler files used
 * in production via Vite's SSR module loader, with a minimal Vercel req/res shim.
 */
function devApiPlugin(mode: string): Plugin {
  return {
    name: 'gv-dev-api',
    apply: 'serve',
    configureServer(server) {
      // Load every env var from .env (including non VITE_ ones like the API key)
      // into process.env for the dev server process. Not exposed to the client.
      const env = loadEnv(mode, process.cwd(), '');
      for (const [k, v] of Object.entries(env)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }

      const ROUTES: Record<string, string> = {
        '/api/feed': '/api/feed.ts',
        '/api/live': '/api/live.ts',
        '/api/video': '/api/video.ts',
      };

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        if (!rawUrl.startsWith('/api/')) return next();

        const pathname = rawUrl.split('?')[0];
        const file = ROUTES[pathname];
        if (!file) return next();

        try {
          const mod = await server.ssrLoadModule(file);
          const handler = mod.default as (req: unknown, res: unknown) => Promise<void> | void;

          const url = new URL(rawUrl, 'http://localhost');
          const query: Record<string, string> = {};
          for (const [k, v] of url.searchParams.entries()) query[k] = v;

          let status = 200;
          const vReq = { query, method: req.method, headers: req.headers, url: rawUrl };
          const vRes = {
            status(code: number) {
              status = code;
              return vRes;
            },
            setHeader(key: string, value: string) {
              res.setHeader(key, value);
              return vRes;
            },
            json(body: unknown) {
              res.statusCode = status;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify(body));
            },
            send(body: unknown) {
              res.statusCode = status;
              res.end(typeof body === 'string' ? body : JSON.stringify(body));
            },
            end() {
              res.statusCode = status;
              res.end();
            },
          };

          await handler(vReq, vRes);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          server.config.logger.error(`[dev-api] ${pathname} failed: ${message}`);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'dev_api_error', message }));
        }
      });
    },
  };
}

// PWA + theme color. Default theme is light, so the manifest theme color is light.
// See section 19 of the build spec for the caching strategy:
//  - precache the app shell
//  - NetworkFirst for /api so live and feed data never get stuck stale
//  - autoUpdate so users are never trapped on an old cached version
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    devApiPlugin(mode),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'placeholder.svg'],
      manifest: {
        id: '/',
        name: 'GabesVideos',
        short_name: 'GabesVideos',
        description: 'A calm, curated personal video feed. Long form only.',
        lang: 'en',
        // Deliberately neutral. Avoids the word "youtube" anywhere visible (section 16).
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,woff}'],
        // Never let SPA navigation fallback swallow API routes.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // NetworkFirst for /api: try the network, fall back to a short cache.
            // This keeps live status and the feed fresh and never traps them stale.
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'gv-api',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Keep the service worker out of the way during dev to avoid stale-cache confusion.
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'api/**/*.{test,spec}.ts'],
    // Tests run in MOCK_MODE so UI tests exercise the fixtures with no network.
    env: { VITE_MOCK_MODE: 'true' },
  },
}));
