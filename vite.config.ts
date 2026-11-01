import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png',
        ],
        manifest: {
          id: '/',
          name: 'শ্রমিক সাথী (Shromik Sathi)',
          short_name: 'শ্রমিক সাথী',
          description: 'বাংলাদেশের গার্মেন্টস শ্রমিকদের বেতন, ওভারটাইম, হাজিরা ও ব্যক্তিগত হিসাব সহকারী।',
          theme_color: '#047857',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          navigateFallback: '/index.html',
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
          runtimeCaching: [
            {
              urlPattern: ({ request }) =>
                request.mode === 'navigate' ||
                request.destination === 'document' ||
                request.destination === 'script' ||
                request.destination === 'style' ||
                request.destination === 'worker',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'shromik-sathi-app-shell-v1',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 90,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ request }) =>
                request.destination === 'image' || request.destination === 'font',
              handler: 'CacheFirst',
              options: {
                cacheName: 'shromik-sathi-media-cache-v1',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: false,
    },
  };
});
