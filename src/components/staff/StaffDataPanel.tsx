import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StaffDataPanelProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function StaffDataPanel({ children, className, noPadding }: StaffDataPanelProps) {
  return (
    <div
      className={cn(
        'app-card overflow-hidden',
        !noPadding && 'p-0',
        className
      )}
    >
      {children}
    </div>
  );
}

export type StaffPanelAccent =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'info'
  | 'accent'
  | 'neutral';

const headerAccentStyles: Record<StaffPanelAccent, string> = {
  primary:
    'border-b-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-card',
  secondary:
    'border-b-secondary/30 bg-gradient-to-r from-secondary/15 via-secondary/5 to-card',
  success:
    'border-b-success/30 bg-gradient-to-r from-success/15 via-success/5 to-card',
  warning:
    'border-b-warning/30 bg-gradient-to-r from-warning/15 via-warning/5 to-card',
  info: 'border-b-info/30 bg-gradient-to-r from-info/15 via-info/5 to-card',
  accent:
    'border-b-accent/30 bg-gradient-to-r from-accent/15 via-accent/5 to-card',
  neutral:
    'border-b-border/80 bg-gradient-to-r from-muted/55 via-muted/25 to-card',
};

interface StaffDataPanelHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  accent?: StaffPanelAccent;
}

export function StaffDataPanelHeader({
  title,
  description,
  action,
  compact,
  accent = 'neutral',
}: StaffDataPanelHeaderProps) {
  return (
    <div
      className={cn(
        'app-card-header flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between',
        headerAccentStyles[accent],
        compact ? 'px-3 py-2.5 sm:px-4' : 'gap-2 px-4 py-3 sm:px-5 sm:py-4'
      )}
    >
      <div className="min-w-0">
        <h3 className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-sm sm:text-base')}>
          {title}
        </h3>
        {description && (
          <p className={cn('text-muted-foreground', compact ? 'text-[11px]' : 'mt-0.5 text-xs sm:text-sm')}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function StaffDataPanelBody({
  children,
  className,
  compact,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn(compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5', className)}>{children}</div>
  );
}
