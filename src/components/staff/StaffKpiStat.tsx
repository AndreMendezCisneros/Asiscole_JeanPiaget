import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StaffKpiTone = 'primary' | 'warning' | 'accent' | 'success' | 'info' | 'secondary';

const toneMap: Record<
  StaffKpiTone,
  { border: string; icon: string; hint: string }
> = {
  primary: {
    border: 'border-l-primary',
    icon: 'bg-primary/12 text-primary',
    hint: 'text-primary',
  },
  warning: {
    border: 'border-l-warning',
    icon: 'bg-warning/12 text-warning',
    hint: 'text-warning',
  },
  accent: {
    border: 'border-l-accent',
    icon: 'bg-accent/12 text-accent',
    hint: 'text-accent',
  },
  success: {
    border: 'border-l-success',
    icon: 'bg-success/12 text-success',
    hint: 'text-success',
  },
  info: {
    border: 'border-l-info',
    icon: 'bg-info/12 text-info',
    hint: 'text-info',
  },
  secondary: {
    border: 'border-l-secondary',
    icon: 'bg-secondary/12 text-secondary',
    hint: 'text-secondary',
  },
};

interface StaffKpiStatProps {
  label: string;
  value: string | number;
  hint?: string;
  hintIcon?: LucideIcon;
  icon: LucideIcon;
  tone?: StaffKpiTone;
  className?: string;
}

export function StaffKpiStat({
  label,
  value,
  hint,
  hintIcon: HintIcon,
  icon: Icon,
  tone = 'primary',
  className,
}: StaffKpiStatProps) {
  const styles = toneMap[tone];

  return (
    <article
      className={cn(
        'app-kpi-stat rounded-2xl border border-border bg-card',
        'border-l-[3px] px-4 py-4 sm:px-5 sm:py-5',
        styles.border,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">
            {value}
          </p>
          {hint && (
            <p className={cn('mt-2 flex items-center gap-1 text-xs font-medium', styles.hint)}>
              {HintIcon && <HintIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              <span className="truncate">{hint}</span>
            </p>
          )}
        </div>
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm',
            styles.icon
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
      </div>
    </article>
  );
}
