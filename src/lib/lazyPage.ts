import { lazy, type ComponentType } from 'react';
import { logger } from '@/lib/utils/logger';

type ModuleWithDefault<T> = { default: T };

const CHUNK_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 3;

function importWithTimeout<T>(importFn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Tiempo de espera agotado al cargar la pantalla (${ms}ms)`));
    }, ms);

    importFn()
      .then((module) => {
        window.clearTimeout(timer);
        resolve(module);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|importing a module script failed|chunk load|tiempo de espera/i.test(
    message,
  );
}

/**
 * lazy() con timeout y reintentos si falla o se cuelga la descarga del chunk.
 */
export function lazyPage<T extends ComponentType<unknown>>(
  importFn: () => Promise<ModuleWithDefault<T>>,
) {
  return lazy(async () => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await importWithTimeout(importFn, CHUNK_TIMEOUT_MS);
      } catch (error) {
        lastError = error;
        logger.error(`Error al cargar página (intento ${attempt}/${MAX_ATTEMPTS})`, error);

        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt));
        }
      }
    }

    if (isChunkLoadError(lastError)) {
      throw lastError instanceof Error
        ? lastError
        : new Error('No se pudo cargar la pantalla. Compruebe la conexión y recargue.');
    }

    throw lastError;
  });
}
