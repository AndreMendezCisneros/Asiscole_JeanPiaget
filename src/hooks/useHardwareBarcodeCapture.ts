import { useEffect, useRef } from 'react';

type UseHardwareBarcodeCaptureOptions = {
  enabled: boolean;
  onScan: (code: string) => void;
  minLength?: number;
  maxGapMs?: number;
};

/**
 * Captura lecturas de pistola lectora a nivel documento (fase capture).
 * Permite escanear el siguiente carnet sin cerrar el perfil del alumno anterior.
 */
export function useHardwareBarcodeCapture({
  enabled,
  onScan,
  minLength = 4,
  maxGapMs = 120,
}: UseHardwareBarcodeCaptureOptions) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    let buffer = '';
    let lastAt = 0;

    const flush = (e?: KeyboardEvent) => {
      const code = buffer.trim();
      buffer = '';
      if (code.length < minLength) return;
      e?.preventDefault();
      e?.stopPropagation();
      onScanRef.current(code);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLTextAreaElement) return;
      if (target?.closest('[data-tutor-incident-dialog]')) return;

      const nameInput = document.getElementById('name-search-input');
      if (nameInput instanceof HTMLInputElement && target === nameInput) {
        return;
      }

      if (target?.id === 'barcode-input' || target?.id === 'tutor-hardware-scan-sink') {
        return;
      }

      const now = Date.now();
      if (now - lastAt > maxGapMs) buffer = '';
      lastAt = now;

      if (e.key === 'Enter' || e.key === 'Tab') {
        if (buffer.length >= minLength) flush(e);
        return;
      }

      if (e.key.length === 1 && /^[0-9A-Za-z]$/.test(e.key)) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, minLength, maxGapMs]);
}
