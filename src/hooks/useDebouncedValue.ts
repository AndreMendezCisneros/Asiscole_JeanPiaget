import { useEffect, useState } from 'react';

/** Retrasa actualizaciones de un valor (p. ej. búsqueda) para evitar ráfagas de peticiones. */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
