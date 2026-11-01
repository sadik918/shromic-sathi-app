import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Handled by VitePWA
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
