import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StaffActivityItemProps {
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
}

export function StaffActivityItem({
  title,
  subtitle,
  meta,
  trailing,
  onClick,
  icon,
}: StaffActivityItemProps) {
  const Comp = onClick ? 'button' : 'div';

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'app-activity-item flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors',
        onClick && 'cursor-pointer hover:border-primary/20 hover:bg-primary/5 hover:shadow-sm'
      )}
    >
      {icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-warning/20 bg-warning/10 text-warning shadow-sm">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
        {meta && <p className="mt-0.5 text-[11px] text-muted-foreground/80">{meta}</p>}
      </div>
      {trailing}
    </Comp>
  );
}
