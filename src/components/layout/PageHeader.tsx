import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PageHeaderAccent =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'info'
  | 'accent';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  accent?: PageHeaderAccent;
  children?: ReactNode;
  className?: string;
}

const accentStyles: Record<
  PageHeaderAccent,
  { border: string; icon: string; eyebrow: string }
> = {
  primary: {
    border: 'border-l-primary',
    icon: 'bg-primary/10 text-primary',
    eyebrow: 'text-primary',
  },
  secondary: {
    border: 'border-l-secondary',
    icon: 'bg-secondary/10 text-secondary',
    eyebrow: 'text-secondary',
  },
  success: {
    border: 'border-l-success',
    icon: 'bg-success/10 text-success',
    eyebrow: 'text-success',
  },
  warning: {
    border: 'border-l-warning',
    icon: 'bg-warning/10 text-warning',
    eyebrow: 'text-warning',
  },
  info: {
    border: 'border-l-info',
    icon: 'bg-info/10 text-info',
    eyebrow: 'text-info',
  },
  accent: {
    border: 'border-l-accent',
    icon: 'bg-accent/10 text-accent',
    eyebrow: 'text-accent',
  },
};

export const PageHeader = ({
  title,
  description,
  eyebrow,
  icon: Icon,
  accent = 'primary',
  children,
  className,
}: PageHeaderProps) => {
  const styles = accentStyles[accent];

  return (
    <header
      className={cn(
        'rounded-2xl border border-border bg-card shadow-sm',
        'border-l-[3px]',
        styles.border,
        className
      )}
    >
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {Icon && (
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                styles.icon
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p
                className={cn(
                  'mb-0.5 text-[10px] font-medium uppercase tracking-wider',
                  styles.eyebrow
                )}
              >
                {eyebrow}
              </p>
            )}
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {children && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {children}
          </div>
        )}
      </div>
    </header>
  );
};
