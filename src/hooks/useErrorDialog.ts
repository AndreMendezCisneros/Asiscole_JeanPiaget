import { useState, useCallback } from 'react';

interface ErrorDialogState {
  open: boolean;
  title: string;
  message: string;
  variant?: 'error' | 'warning' | 'info';
}

export const useErrorDialog = () => {
  const [errorDialog, setErrorDialog] = useState<ErrorDialogState>({
    open: false,
    title: 'Error',
    message: '',
    variant: 'error',
  });

  const showError = useCallback((message: string, title: string = 'Error', variant: 'error' | 'warning' | 'info' = 'error') => {
    setErrorDialog({
      open: true,
      title,
      message,
      variant,
    });
  }, []);

  const showAuthError = useCallback((message: string = 'Credenciales inválidas. Por favor, verifique su usuario y contraseña.') => {
    showError(message, 'Error de Autenticación', 'error');
  }, [showError]);

  const showWarning = useCallback((message: string, title: string = 'Advertencia') => {
    showError(message, title, 'warning');
  }, [showError]);

  const showInfo = useCallback((message: string, title: string = 'Información') => {
    showError(message, title, 'info');
  }, [showError]);

  const closeError = useCallback(() => {
    setErrorDialog((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    errorDialog,
    showError,
    showAuthError,
    showWarning,
    showInfo,
    closeError,
  };
};

