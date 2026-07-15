import { useState, useCallback } from 'react';

interface LoadingScreenState {
  isLoading: boolean;
  message: string;
}

export const useLoadingScreen = () => {
  const [loadingState, setLoadingState] = useState<LoadingScreenState>({
    isLoading: false,
    message: 'Cargando...',
  });

  const showLoading = useCallback((message: string = 'Cargando...') => {
    setLoadingState({
      isLoading: true,
      message,
    });
  }, []);

  const hideLoading = useCallback(() => {
    setLoadingState((prev) => ({
      ...prev,
      isLoading: false,
    }));
  }, []);

  return {
    loadingState,
    showLoading,
    hideLoading,
  };
};

