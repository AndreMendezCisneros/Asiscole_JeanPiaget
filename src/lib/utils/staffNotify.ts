import { createElement } from 'react';
import { toast } from 'sonner';
import { CircleAlert, AlertTriangle, Info } from 'lucide-react';
import { showSuccessFlash } from '@/lib/utils/successFlashBus';

const errorDefaults = {
  duration: 3500,
  classNames: {
    toast: 'staff-toast staff-toast--error',
    title: 'staff-toast__title',
    description: 'staff-toast__description',
  },
} as const;

const warningDefaults = {
  duration: 3200,
  classNames: {
    toast: 'staff-toast staff-toast--warning',
    title: 'staff-toast__title',
    description: 'staff-toast__description',
  },
} as const;

/** Avisos para personal: éxito = flash breve al centro; errores = toast corto arriba */
export const staffNotify = {
  /** Animación centrada ~1.5 s — no bloquea clics (sigue trabajando) */
  success(title: string, description?: string) {
    showSuccessFlash({ title, description });
  },

  error(title: string, description?: string) {
    return toast.error(title, {
      ...errorDefaults,
      description,
      icon: createElement(CircleAlert, {
        className: 'h-6 w-6 shrink-0 text-[hsl(0_72%_42%)]',
        strokeWidth: 2.25,
      }),
    });
  },

  warning(title: string, description?: string) {
    return toast.warning(title, {
      ...warningDefaults,
      description,
      icon: createElement(AlertTriangle, {
        className: 'h-6 w-6 shrink-0 text-[hsl(32_90%_38%)]',
        strokeWidth: 2.25,
      }),
    });
  },

  info(title: string, description?: string) {
    return toast.info(title, {
      duration: 2800,
      classNames: {
        toast: 'staff-toast staff-toast--info',
        title: 'staff-toast__title',
        description: 'staff-toast__description',
      },
      description,
      icon: createElement(Info, {
        className: 'h-6 w-6 shrink-0 text-[hsl(217_52%_40%)]',
        strokeWidth: 2.25,
      }),
    });
  },
};
