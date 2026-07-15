import { useEffect } from 'react';

interface PerformanceMetrics {
  pageLoadTime: number;
  timeToInteractive: number;
  firstContentfulPaint: number;
}

export const usePerformanceMetrics = (pageName: string) => {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.performance) return;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');

    const metrics: PerformanceMetrics = {
      pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
      timeToInteractive: navigation.domInteractive - navigation.fetchStart,
      firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
    };

    // Log para desarrollo
    if (import.meta.env.DEV) {
      console.log(
        `[Performance] ${pageName}:`,
        `Carga: ${metrics.pageLoadTime.toFixed(2)}ms,`,
        `Interactivo: ${metrics.timeToInteractive.toFixed(2)}ms,`,
        `FCP: ${metrics.firstContentfulPaint.toFixed(2)}ms`
      );
    }

    // En producción, aquí se podría enviar a un servicio de analytics
    // Ejemplo: analytics.track('page_performance', { page: pageName, ...metrics });

    return () => {
      // Cleanup si es necesario
    };
  }, [pageName]);
};

