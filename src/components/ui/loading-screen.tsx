import React from 'react';
import { GraduationCap } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  /** true → cubre toda la pantalla (solo para rutas sin Layout). */
  fullScreen?: boolean;
}

/** Loader ligero con CSS — sin react-spring en el camino crítico de arranque. */
const LoaderBody: React.FC<{ message: string }> = ({ message }) => (
  <>
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-primary/15 blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-accent/10 blur-3xl animate-pulse [animation-delay:700ms]" />
    </div>

    <div className="relative z-10 flex flex-col items-center gap-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/20 ring-1 ring-primary/30 animate-pulse">
        <GraduationCap className="h-10 w-10 text-primary-foreground/90" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <div className="mb-4 flex items-center justify-center gap-1.5">
          {[0, 150, 300].map((delay) => (
            <div
              key={delay}
              className="h-2 w-2 rounded-full bg-primary/80 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
        <p className="text-lg font-medium text-foreground/90">{message}</p>
      </div>
    </div>
  </>
);

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Cargando…',
  fullScreen = true,
}) => {
  const shell = (
    <div className="relative flex min-h-[65vh] flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-background via-muted/30 to-background px-6 py-16">
      <LoaderBody message={message} />
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-background animate-in fade-in duration-300"
        style={{ animationDelay: '150ms', animationFillMode: 'both' }}
      >
        {shell}
      </div>
    );
  }

  return (
    <div
      className="w-full animate-in fade-in duration-300"
      style={{ animationDelay: '150ms', animationFillMode: 'both' }}
    >
      <div className="mx-4 my-4">{shell}</div>
    </div>
  );
};
