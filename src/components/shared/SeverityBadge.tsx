import { FaultSeverity } from '@/types';
import { cn } from '@/lib/utils';

interface SeverityBadgeProps {
  severity: FaultSeverity;
  className?: string;
}

export const SeverityBadge = ({ severity, className }: SeverityBadgeProps) => {
  const isGrave = severity === 'Grave';
  return (
    <span
      className={cn(
        'app-level-pill',
        isGrave ? 'app-level-pill--5' : 'app-level-pill--1',
        className
      )}
    >
      {severity}
    </span>
  );
};
