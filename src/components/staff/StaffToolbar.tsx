import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StaffToolbarProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

export function StaffToolbar({
  title,
  description,
  children,
  className,
  footer,
}: StaffToolbarProps) {
  return (
    <section className={cn('app-toolbar', className)} aria-label={title ?? 'Filtros'}>
      {(title || description) && (
        <div className="mb-4 border-b border-border/60 pb-3">
          {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className="app-toolbar-grid">{children}</div>
      {footer && <div className="mt-4 border-t border-border/60 pt-3">{footer}</div>}
    </section>
  );
}
