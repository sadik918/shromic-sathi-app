import type { Language } from '../types';

export interface ShareAppPayload {
  title: string;
  text: string;
  url: string;
  fullMessage: string;
}

export interface ShareChannelUrls {
  whatsapp: string;
  facebook: string;
  telegram: string;
  sms: string;
}

/**
 * Resolves a clean root URL for sharing the web app / installed PWA.
 * Strips query parameters and hashes so recipients land directly on the app entry page.
 */
export function getShareAppUrl(originOverride?: string): string {
  const raw =
    originOverride?.trim() ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://shromiksathi.app');

  return raw.replace(/\/+$/, '');
}

/**
 * Builds localized share metadata and message text for the app.
 */
export function buildSharePayload(
  lang: Language,
  originOverride?: string
): ShareAppPayload {
  const url = getShareAppUrl(originOverride);

  if (lang === 'bn') {
    const title = 'শ্রমিক সাথী';
    const text =
      'শ্রমিক সাথী — হাজিরা, ওভারটাইম, বেতন ও হিসাব রাখার সহজ অ্যাপ। এখনই ব্যবহার করুন:';
    return {
      title,
      text,
      url,
      fullMessage: `${text}\n${url}`,
    };
  }

  const title = 'Shromik Sathi';
  const text =
    'Shromik Sathi — Easily track attendance, overtime, salary & expenses. Try it now:';
  return {
    title,
    text,
    url,
    fullMessage: `${text}\n${url}`,
  };
}

/**
 * Generates direct share URLs for popular messaging & social platforms.
 */
export function buildShareChannelUrls(payload: ShareAppPayload): ShareChannelUrls {
  const encodedUrl = encodeURIComponent(payload.url);
  const encodedText = encodeURIComponent(payload.text);
  const encodedFull = encodeURIComponent(payload.fullMessage);

  return {
    whatsapp: `https://wa.me/?text=${encodedFull}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    sms: `sms:?body=${encodedFull}`,
  };
}

/**
 * Copies text to clipboard with a reliable fallback for mobile browsers and WebViews.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy execCommand fallback
    }
  }

  if (typeof document === 'undefined') return false;

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
