/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA + theme color. Default theme is light, so the manifest theme color is light.
// See section 19 of the build spec for the caching strategy:
//  - precache the app shell
//  - NetworkFirst for /api so live and feed data never get stuck stale
//  - autoUpdate so users are never trapped on an old cached version
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'placeholder.svg'],
      manifest: {
        name: 'GabesVideos',
        short_name: 'GabesVideos',
        description: 'A calm, curated personal video feed. Long form only.',
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
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
