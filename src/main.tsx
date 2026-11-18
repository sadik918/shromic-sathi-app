import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  if ('caches' in window) {
    window.caches
      .keys()
      .then((keys) => {
        for (const key of keys) {
          if (key.startsWith('shromik-sathi-static-assets-')) {
            void window.caches.delete(key);
          }
        }
      })
      .catch(() => {
        // Ignore cache cleanup errors
      });
  }

  if ('serviceWorker' in navigator) {
    if (import.meta.env.PROD) {
      registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          if (registration) {
            void registration.update();
          }
        },
      });
    } else {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          for (const reg of regs) {
            void reg.unregister();
          }
        })
        .catch(() => {
          // Ignore SW cleanup errors in dev
        });
    }
  }
}

createRoot(document.getElementById('root')!).render(<App />);
