/**
 * Non-blocking print / PDF export helper.
 *
 * Calling `window.print()` directly on a large React SPA with Recharts SVGs and
 * sticky/fixed containers can freeze mobile browsers and headless Chromium tabs.
 * This helper clones only the target printable element (or generates clean HTML)
 * inside an isolated hidden `<iframe>`, hides `.no-print` nodes and heavy charts,
 * triggers `iframe.contentWindow.print()` asynchronously after layout settles,
 * and cleans up cleanly without blocking the main app state.
 */

export interface SafePrintOptions {
  title?: string;
  elementId?: string;
  element?: HTMLElement | null;
  fallbackHtml?: string;
  onStart?: () => void;
  onComplete?: () => void;
}

const PRINT_BASE_CSS = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0f172a;
    font-family: 'Hind Siliguri', 'Noto Sans Bengali', system-ui, -apple-system, sans-serif;
    font-size: 12px;
    line-height: 1.5;
  }
  .print-wrapper {
    max-width: 780px;
    margin: 0 auto;
    padding: 16px;
  }
  .no-print,
  button,
  [data-no-print="true"],
  .recharts-wrapper,
  .recharts-responsive-container {
    display: none !important;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #f1f5f9;
    font-weight: 700;
  }
  h1, h2, h3, h4 {
    margin: 0 0 6px 0;
    color: #0f172a;
  }
  .grid { display: grid; gap: 8px; }
  .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .flex { display: flex; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
  .gap-2 { gap: 8px; }
  .gap-3 { gap: 12px; }
  .gap-4 { gap: 16px; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .font-bold, .font-extrabold, .font-black { font-weight: 700; }
  .border { border: 1px solid #e2e8f0; }
  .border-b { border-bottom: 1px solid #e2e8f0; }
  .border-t { border-top: 1px solid #e2e8f0; }
  .rounded-xl, .rounded-2xl { border-radius: 10px; }
  .p-3, .p-4, .p-5, .p-6 { padding: 10px; }
  .mt-2 { margin-top: 8px; }
  .mt-4 { margin-top: 16px; }
  .mb-2 { margin-bottom: 8px; }
  .space-y-2 > * + * { margin-top: 6px; }
  .space-y-3 > * + * { margin-top: 10px; }
  .space-y-4 > * + * { margin-top: 14px; }
  .text-xs { font-size: 11px; }
  .text-sm { font-size: 12px; }
  .text-base { font-size: 13px; }
  .text-lg { font-size: 15px; }
  .text-xl { font-size: 17px; }
  .text-emerald-700, .text-emerald-800 { color: #047857; }
  .text-rose-700, .text-rose-600 { color: #be123c; }
  .text-slate-500, .text-slate-600 { color: #475569; }
  .bg-slate-50 { background: #f8fafc; }
  .bg-emerald-50 { background: #ecfdf5; }
  @page {
    size: A4 portrait;
    margin: 12mm;
  }
`;

export function printElementSafely(options: SafePrintOptions = {}): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }

  options.onStart?.();

  return new Promise<void>((resolve) => {
    window.setTimeout(() => {
      try {
        const targetEl =
          options.element ||
          (options.elementId ? document.getElementById(options.elementId) : null);

        let bodyMarkup = options.fallbackHtml || '';
        if (targetEl) {
          const cloned = targetEl.cloneNode(true) as HTMLElement;
          cloned
            .querySelectorAll('.no-print, button, [data-no-print="true"], .recharts-wrapper, .recharts-responsive-container')
            .forEach((node) => node.remove());
          bodyMarkup = cloned.outerHTML;
        }

        if (!bodyMarkup) {
          options.onComplete?.();
          resolve();
          return;
        }

        // Remove any previous stale print iframe
        const prev = document.getElementById('shromik-sathi-print-frame');
        if (prev) prev.remove();

        const iframe = document.createElement('iframe');
        iframe.id = 'shromik-sathi-print-frame';
        iframe.title = options.title || 'Print Preview';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.style.border = '0';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';

        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc || !iframe.contentWindow) {
          iframe.remove();
          options.onComplete?.();
          resolve();
          return;
        }

        const safeTitle = (options.title || 'Shromik Sathi — Document').replace(/[<>]/g, '');
        iframeDoc.open();
        iframeDoc.write(`<!doctype html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <style>${PRINT_BASE_CSS}</style>
</head>
<body>
  <div class="print-wrapper">${bodyMarkup}</div>
</body>
</html>`);
        iframeDoc.close();

        const finishCleanup = () => {
          window.setTimeout(() => {
            const frame = document.getElementById('shromik-sathi-print-frame');
            if (frame) frame.remove();
            options.onComplete?.();
            resolve();
          }, 300);
        };

        const win = iframe.contentWindow;
        win.onafterprint = finishCleanup;

        // Trigger print asynchronously after layout completes
        window.setTimeout(() => {
          try {
            win.focus();
            win.print();
          } catch {
            // ignore environments where print dialog is blocked
          } finally {
            // Safety timeout in case onafterprint never fires (common on mobile WebViews)
            window.setTimeout(finishCleanup, 1200);
          }
        }, 120);
      } catch {
        options.onComplete?.();
        resolve();
      }
    }, 60);
  });
}
