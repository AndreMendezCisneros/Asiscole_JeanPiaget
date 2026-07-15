import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error capturado por ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const detail =
        import.meta.env.DEV && this.state.error
          ? this.state.error.message
          : null;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-2xl font-bold text-destructive">Algo salió mal</h1>
            <p className="text-muted-foreground">
              No se pudo cargar esta sección. Recargue la página o vuelva al inicio.
            </p>
            {detail && (
              <pre className="text-left text-xs bg-muted p-3 rounded-md overflow-auto text-destructive/90">
                {detail}
              </pre>
            )}
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Recargar página
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = '/'; }}
                className="px-4 py-2 border border-border rounded-md hover:bg-muted"
              >
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

