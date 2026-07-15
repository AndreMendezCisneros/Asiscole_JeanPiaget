import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StaffSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function StaffSection({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  contentClassName,
}: StaffSectionProps) {
  return (
    <section className={cn('app-section', className)}>
      <header className="app-section-head">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="app-section-title">{title}</h2>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={cn('app-section-body', contentClassName)}>{children}</div>
    </section>
  );
}
