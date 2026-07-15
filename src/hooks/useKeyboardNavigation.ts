import { useEffect, useRef } from 'react';

export const useKeyboardNavigation = () => {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape para cerrar modales
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('[role="dialog"][aria-hidden="false"]');
        if (activeModal) {
          const closeButton = activeModal.querySelector('[aria-label*="cerrar"], [aria-label*="close"], button[aria-label*="Cerrar"]');
          if (closeButton instanceof HTMLElement) {
            closeButton.click();
          }
        }
      }

      // Navegación con flechas en listas
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const focusableElements = containerRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements && focusableElements.length > 0) {
          const currentIndex = Array.from(focusableElements).findIndex(
            el => el === document.activeElement
          );
          if (currentIndex !== -1) {
            e.preventDefault();
            const nextIndex = e.key === 'ArrowDown' 
              ? (currentIndex + 1) % focusableElements.length
              : (currentIndex - 1 + focusableElements.length) % focusableElements.length;
            (focusableElements[nextIndex] as HTMLElement)?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return containerRef;
};

