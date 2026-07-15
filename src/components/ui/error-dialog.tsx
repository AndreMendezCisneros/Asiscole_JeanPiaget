import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message: string;
  buttonText?: string;
  onConfirm?: () => void;
  variant?: 'error' | 'warning' | 'info';
}

export const ErrorDialog: React.FC<ErrorDialogProps> = ({
  open,
  onOpenChange,
  title = 'Error',
  message,
  buttonText = 'OK',
  onConfirm,
  variant = 'error',
}) => {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onOpenChange(false);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          iconBg: 'bg-yellow-500',
          buttonBg: 'bg-yellow-600 hover:bg-yellow-700',
        };
      case 'info':
        return {
          iconBg: 'bg-blue-500',
          buttonBg: 'bg-blue-600 hover:bg-blue-700',
        };
      default:
        return {
          iconBg: 'bg-red-500',
          buttonBg: 'bg-purple-600 hover:bg-purple-700',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-2xl border-0 p-0 overflow-hidden [&>button]:hidden">
        <div className="flex flex-col items-center p-8">
          {/* Icono de error */}
          <div className={cn('w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg', styles.iconBg)}>
            <X className="w-10 h-10 text-white" strokeWidth={3} />
          </div>

          {/* Título */}
          <DialogHeader className="text-center">
            <DialogTitle className="text-2xl font-bold text-gray-900 mb-2">
              {title}
            </DialogTitle>
            <DialogDescription className="text-base text-gray-700 mt-2">
              {message}
            </DialogDescription>
          </DialogHeader>

          {/* Botón OK */}
          <DialogFooter className="mt-6 w-full">
            <Button
              onClick={handleConfirm}
              className={cn(
                'w-full py-3 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg',
                styles.buttonBg
              )}
            >
              {buttonText}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

