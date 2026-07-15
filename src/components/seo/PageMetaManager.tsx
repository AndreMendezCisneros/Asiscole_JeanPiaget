import { usePageMeta } from '@/hooks/usePageMeta';

/** Sincroniza metadatos del documento con la ruta actual. */
export function PageMetaManager() {
  usePageMeta();
  return null;
}
