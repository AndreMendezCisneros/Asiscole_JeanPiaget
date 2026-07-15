interface PageLoaderProps {
  message?: string;
}

/** Loader ligero (sin react-spring) para no bloquear la carga inicial. */
export function PageLoader({ message = 'Cargando…' }: PageLoaderProps) {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
