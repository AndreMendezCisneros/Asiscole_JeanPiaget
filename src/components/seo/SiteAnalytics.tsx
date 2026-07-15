import { useEffect } from 'react';

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

/** Google Analytics 4 — requiere VITE_GA_MEASUREMENT_ID y CSP con googletagmanager.com */
export function SiteAnalytics() {
  useEffect(() => {
    if (!GA_ID || document.querySelector('script[data-sie-ga]')) return;

    const script = document.createElement('script');
    script.src = '/ga-init.js';
    script.defer = true;
    script.setAttribute('data-sie-ga', GA_ID);
    document.head.appendChild(script);
  }, []);

  return null;
}
