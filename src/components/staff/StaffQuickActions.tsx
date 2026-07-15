import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface StaffQuickAction {
  label: string;
  description?: string;
  icon: LucideIcon;
  to: string;
  tone?: 'primary' | 'success' | 'warning' | 'info';
}

const toneStyles = {
  primary:
    'border-primary/25 bg-primary/10 shadow-sm [&_svg]:text-primary hover:border-primary/45 hover:bg-primary/15 hover:shadow-md',
  success:
    'border-success/25 bg-success/10 shadow-sm [&_svg]:text-success hover:border-success/45 hover:bg-success/15 hover:shadow-md',
  warning:
    'border-warning/25 bg-warning/10 shadow-sm [&_svg]:text-warning hover:border-warning/45 hover:bg-warning/15 hover:shadow-md',
  info: 'border-info/25 bg-info/10 shadow-sm [&_svg]:text-info hover:border-info/45 hover:bg-info/15 hover:shadow-md',
};

interface StaffQuickActionsProps {
  actions: StaffQuickAction[];
  className?: string;
}

export function StaffQuickActions({ actions, className }: StaffQuickActionsProps) {
  const navigate = useNavigate();

  return (
    <nav
      className={cn('app-quick-actions', className)}
      aria-label="Accesos rápidos"
    >
      {actions.map((action) => {
        const Icon = action.icon;
        const tone = action.tone ?? 'primary';
        return (
          <button
            key={action.to + action.label}
            type="button"
            onClick={() => navigate(action.to)}
            className={cn('app-quick-action', toneStyles[tone])}
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="min-w-0 text-left">
              <span className="block text-sm font-semibold text-foreground">
                {action.label}
              </span>
              {action.description && (
                <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-1">
                  {action.description}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
