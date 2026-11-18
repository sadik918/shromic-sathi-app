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
        injectRegister: 'auto',
        includeAssets: [
          'icon.svg',
          'alarm-sw-helper.js',
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
          importScripts: ['/alarm-sw-helper.js'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/__\//],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
          globIgnores: ['**/Screenshot_*', '**/Glossy_Green_*', '**/WhatsApp_*'],
          runtimeCaching: [
            {
              urlPattern: ({ request }) =>
                request.destination === 'image' || request.destination === 'font',
              handler: 'CacheFirst',
              options: {
                cacheName: 'shromik-sathi-media-cache-v3',
                expiration: {
                  maxEntries: 80,
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
          enabled: false,
          type: 'module',
        },
      }),
    ],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /node_modules\/(react|react-dom|scheduler)\//,
              },
              {
                name: 'vendor-firebase',
                test: /node_modules\/(firebase|@firebase)\//,
              },
              {
                name: 'vendor-charts',
                test: /node_modules\/(recharts|d3-.*|victory-vendor)\//,
              },
              {
                name: 'vendor-icons',
                test: /node_modules\/lucide-react\//,
              },
            ],
          },
        },
      },
    },
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
